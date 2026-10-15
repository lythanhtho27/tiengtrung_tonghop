/**
 * word_learning.js
 * Hệ thống Học & Luyện Tập Từ Vựng HSK 3.0 (Cấp 1 – 9) từ dữ liệu JSON
 * Gồm 8 quyển · 368 Bài (Units) · 11.092 Từ vựng chuẩn GF 0025-2021
 * Hỗ trợ đầy đủ Desktop, Tablet & Mobile
 */

(function () {
    'use strict';

    // ==================== STORAGE KEYS ====================
    const STORAGE_KEY_PROGRESS = 'hsk_wl_json_progress_v2';
    const STORAGE_KEY_THEME    = 'hsk_wl_json_theme_v2';
    const STORAGE_KEY_SRS      = 'hsk_wl_srs_data_v2';
    const STORAGE_KEY_GAMIFY   = 'hsk_wl_gamify_data_v2';

    // ==================== STATE ====================
    let state = {
        activeBookId: 'q1',
        activeUnitNum: 1,
        activeWordNum: 1,
        studyMode: 'memory',       // 'memory' | 'practice' | 'flashcard' | 'pdf'
        unitFilter: 'all',         // 'all' | 'todo' | 'done' | 'star' | 'srs'
        unitSearchQuery: '',
        globalSearchQuery: '',
        showPinyin: true,
        showMeaning: true,
        onlyStarredWords: false,
        targetGridCollapsed: false,
        speakingAll: false,
        currentPdfPage: 9,

        // User progress persisted in localStorage
        doneUnits: {},             // { "q1_1": true }
        starredUnits: {},          // { "q1_1": true }
        starredWords: {},          // { "L1-0001": true }
        practiceScores: {},        // { "q1_1": { score: 40, total: 45 } }

        // SRS Spaced Repetition (Leitner 5 boxes)
        srsData: {},               // { [wordId]: { box, addedAt, nextDue, reviewCount } }

        // Gamification: Streak, XP, Level, Badges & Stats
        gamify: {
            streak: 1,
            lastDate: '',
            longestStreak: 1,
            xp: 0,
            level: 1,
            stats: {
                wordsLearned: 0,
                quizzesCompleted: 0,
                quizStreakBest: 0,
                flashcardsFlipped: 0,
                podcastRuns: 0,
                srsMastered: 0
            },
            unlockedBadges: {}
        },

        // Current unit user answers in Mode 2 (Practice)
        userAnswers: {
            sec1Pinyin: {},        // { q_num: 'A' }
            sec1Meaning: {},       // { q_num: 'a' }
            sec2Cloze: {},         // { "g1_q1": 'D' }
            sec3Mcq: {}            // { q_num: 'C' }
        },
        practiceChecked: false,

        // Flashcard state
        fcScope: 'unit',           // 'unit' | 'srs' | 'starred' | 'book'
        fcFaceMode: 'hz',          // 'hz' | 'vi' | 'audio'
        fcAutoSpeak: true,
        fcDeck: [],
        fcIndex: 0,
        fcFlipped: false,

        // Quiz state
        quizType: 'hz_to_vn',      // 'hz_to_vn' | 'vn_to_hz' | 'audio_to_hz'
        quizTimerEnabled: true,
        quizSoundEnabled: true,
        quizStreak: 0,
        quizCorrect: 0,
        quizTotal: 0,
        quizCurrentQ: null,
        quizAnswered: false,
        quizTimerId: null,

        // Hands-free Podcast Player state
        podcast: {
            active: false,
            isPlaying: false,
            list: [],
            index: 0,
            step: 'word',          // 'word' | 'meaning' | 'ex' | 'ex_vn'
            speed: 1.0,
            voiceMode: 'bilingual', // 'bilingual' | 'zh_only'
            scope: 'unit',
            loop: true,
            timerId: null
        },

        // Voice & Shadowing Studio state
        shadowing: {
            wordIndex: 0,
            targetType: 'word',     // 'word' | 'ex'
            targetExIndex: 0,
            speed: 0.9,
            isRecording: false,
            mediaRecorder: null,
            audioChunks: [],
            audioBlobUrl: null,
            userAudio: null,
            recTimerId: null,
            recSeconds: 0,
            recognition: null,
            recognizedText: '',
            score: null,
            stream: null
        }
    };

    // Cache of loaded book JSON objects
    window.HSK_BOOK_JSON = window.HSK_BOOK_JSON || {};
    const loadingBookPromises = {};

    function getUnitNum(u) {
        return (u && (u.u !== undefined ? u.u : u.unit)) || 1;
    }

    function getUnitStartPy(u) {
        return (u && (u.start_py || u.start_pinyin)) || '';
    }

    function getUnitEndPy(u) {
        return (u && (u.end_py || u.end_pinyin)) || '';
    }

    // ==================== INITIALIZATION ====================
    document.addEventListener('DOMContentLoaded', async () => {
        loadSavedProgress();
        initTheme();
        renderGrammarModalTable();
        bindEvents();

        const params = new URLSearchParams(window.location.search);
        const urlBook = params.get('book');
        const urlUnit = parseInt(params.get('unit'), 10);
        if (urlBook && getBookIndexMeta(urlBook)) {
            state.activeBookId = urlBook;
        }

        renderBookShelf();
        await selectBook(state.activeBookId, urlUnit || null);
    });

    function getBookIndexMeta(bookId) {
        if (typeof HSK_BOOKS_INDEX === 'undefined') return null;
        return HSK_BOOKS_INDEX.find(b => b.id === bookId) || HSK_BOOKS_INDEX[0];
    }

    function getLoadedBookData(bookId) {
        return window.HSK_BOOK_JSON[bookId] || null;
    }

    async function ensureBookDataLoaded(bookId) {
        if (window.HSK_BOOK_JSON[bookId]) {
            return window.HSK_BOOK_JSON[bookId];
        }
        if (loadingBookPromises[bookId]) {
            return loadingBookPromises[bookId];
        }

        const meta = getBookIndexMeta(bookId);
        if (!meta) return null;

        loadingBookPromises[bookId] = (async () => {
            if (window.location.protocol !== 'file:' && meta.json_file) {
                try {
                    const res = await fetch(meta.json_file);
                    if (res.ok) {
                        const data = await res.json();
                        window.HSK_BOOK_JSON[bookId] = data;
                        return data;
                    }
                } catch (err) {
                    // Fallback to .js script injection below
                }
            }

            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = meta.js_file;
                script.async = true;
                script.onload = () => {
                    resolve(window.HSK_BOOK_JSON[bookId] || null);
                };
                script.onerror = () => {
                    reject(new Error('Không thể tải dữ liệu sách: ' + meta.js_file));
                };
                document.body.appendChild(script);
            });
        })();

        try {
            return await loadingBookPromises[bookId];
        } finally {
            delete loadingBookPromises[bookId];
        }
    }

    // ==================== LOCAL STORAGE & PERSISTENCE ====================
    function loadSavedProgress() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
            if (raw) {
                const parsed = JSON.parse(raw);
                state.doneUnits      = parsed.doneUnits || {};
                state.starredUnits   = parsed.starredUnits || {};
                state.starredWords   = parsed.starredWords || {};
                state.practiceScores = parsed.practiceScores || {};
                if (parsed.lastBookId && getBookIndexMeta(parsed.lastBookId)) {
                    state.activeBookId = parsed.lastBookId;
                }
                if (parsed.lastUnitNum && !isNaN(Number(parsed.lastUnitNum))) {
                    state.activeUnitNum = Number(parsed.lastUnitNum);
                }
            }

            // Load SRS data
            const rawSrs = localStorage.getItem(STORAGE_KEY_SRS);
            if (rawSrs) {
                state.srsData = JSON.parse(rawSrs) || {};
            }

            // Load Gamification data
            const rawGamify = localStorage.getItem(STORAGE_KEY_GAMIFY);
            if (rawGamify) {
                const g = JSON.parse(rawGamify);
                state.gamify = {
                    streak: g.streak || 1,
                    lastDate: g.lastDate || '',
                    longestStreak: g.longestStreak || 1,
                    xp: g.xp || 0,
                    level: g.level || 1,
                    stats: Object.assign({
                        wordsLearned: 0,
                        quizzesCompleted: 0,
                        quizStreakBest: 0,
                        flashcardsFlipped: 0,
                        podcastRuns: 0,
                        srsMastered: 0
                    }, g.stats || {}),
                    unlockedBadges: g.unlockedBadges || {}
                };
            }

            checkDailyStreak();
            updateGamifyUI();
            updateSrsHeaderBadge();
        } catch (e) {
            console.warn('Không thể đọc tiến độ từ localStorage:', e);
        }
    }

    function saveProgress() {
        try {
            localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify({
                doneUnits: state.doneUnits,
                starredUnits: state.starredUnits,
                starredWords: state.starredWords,
                practiceScores: state.practiceScores,
                lastBookId: state.activeBookId,
                lastUnitNum: state.activeUnitNum
            }));

            localStorage.setItem(STORAGE_KEY_SRS, JSON.stringify(state.srsData || {}));
            localStorage.setItem(STORAGE_KEY_GAMIFY, JSON.stringify(state.gamify || {}));
        } catch (e) {
            console.warn('Không thể lưu tiến độ:', e);
        }
    }

    // ==================== AUDIO SOUND FX ENGINE (WEB AUDIO API) ====================
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playSoundEffect(type) {
        if (!state.quizSoundEnabled && type !== 'badge') return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            if (type === 'correct') {
                // Two-tone bright bell chime: D5 -> A5
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, now);
                osc.frequency.setValueAtTime(880.00, now + 0.1);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.4);
            } else if (type === 'wrong') {
                // Soft buzzer
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.linearRampToValueAtTime(130, now + 0.25);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === 'flip') {
                // Crisp click
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(420, now);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'badge') {
                // Celebration fanfare: C5 -> E5 -> G5 -> C6
                const notes = [523.25, 659.25, 783.99, 1046.50];
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.1);
                    gain.gain.setValueAtTime(0.25, now + idx * 0.1);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + idx * 0.1);
                    osc.stop(now + idx * 0.1 + 0.35);
                });
            }
        } catch (e) {
            // Audio context not allowed or supported
        }
    }

    // ==================== TOAST NOTIFICATIONS ====================
    function showToast(title, message, icon = '✨', isBadge = false) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `wl-toast ${isBadge ? 'toast-badge' : ''}`;
        toast.innerHTML = `
            <div class="wl-toast-icon">${escapeHtml(icon)}</div>
            <div class="wl-toast-content">
                <div class="wl-toast-title">${escapeHtml(title)}</div>
                <div class="wl-toast-msg">${escapeHtml(message)}</div>
            </div>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(60px)';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3600);
    }

    // ==================== GAMIFICATION: STREAK, LEVEL, BADGES ====================
    const BADGES_CATALOG = [
        { id: 'b_first_word', icon: '🥉', title: 'Khởi Đầu Nan', desc: 'Học hoặc ôn tập từ vựng đầu tiên', xp: 50 },
        { id: 'b_streak_3', icon: '🔥', title: 'Giữ Lửa 3 Ngày', desc: 'Duy trì chuỗi học liên tục 3 ngày', xp: 100 },
        { id: 'b_streak_7', icon: '⚡', title: 'Chiến Binh Chăm Chỉ', desc: 'Duy trì chuỗi học liên tục 7 ngày', xp: 250 },
        { id: 'b_streak_30', icon: '👑', title: 'Bậc Thầy Kiên Trì', desc: 'Duy trì chuỗi học liên tục 30 ngày', xp: 1000 },
        { id: 'b_fc_50', icon: '🎴', title: 'Thợ Lật Thẻ', desc: 'Lật 50 lượt thẻ Flashcard', xp: 80 },
        { id: 'b_fc_200', icon: '🃏', title: 'Chuyên Gia Flashcard', desc: 'Lật 200 lượt thẻ Flashcard', xp: 300 },
        { id: 'b_quiz_streak_5', icon: '🎯', title: 'Phản Xạ Nhạy Bén', desc: 'Đạt combo 5 câu Quiz đúng liên tiếp', xp: 100 },
        { id: 'b_quiz_streak_10', icon: '🏹', title: 'Xạ Thủ Bách Phát', desc: 'Đạt combo 10 câu Quiz đúng liên tiếp', xp: 300 },
        { id: 'b_srs_first', icon: '🧠', title: 'Người Rèn Luyện', desc: 'Đưa từ vựng đầu tiên vào Hộp từ khó SRS', xp: 50 },
        { id: 'b_srs_master_10', icon: '💎', title: 'Trí Nhớ Thép', desc: 'Đạt Hộp 5 (Thành thạo) cho 10 từ trong SRS', xp: 350 },
        { id: 'b_podcast_fan', icon: '🎧', title: 'Thính Giả Chăm Chỉ', desc: 'Bật chế độ nghe thụ động Hands-free Podcast', xp: 60 },
        { id: 'b_voice_first', icon: '🎙️', title: 'Tiếng Nói Đầu Tiên', desc: 'Ghi âm và luyện phát âm từ vựng đầu tiên', xp: 60 },
        { id: 'b_voice_master', icon: '🌟', title: 'Bản Xứ Chuẩn Giọng', desc: 'Đạt điểm phát âm xuất sắc (>=85 điểm) với AI', xp: 150 },
        { id: 'b_unit_master', icon: '🏆', title: 'Chinh Phục Bài Học', desc: 'Hoàn thành trọn vẹn cả 3 phần bài tập một bài học', xp: 150 }
    ];

    function getLevelInfo(xp) {
        const titles = [
            'Tân thủ HSK',
            'Sơ cấp 1',
            'Sơ cấp 2',
            'Trung cấp 1',
            'Trung cấp 2',
            'Cao cấp 1',
            'Cao cấp 2',
            'Bậc thầy HSK',
            'Đại tông sư HSK'
        ];
        let lvl = 1;
        let prevThresh = 0;
        let nextThresh = 100;

        for (let i = 1; i <= 20; i++) {
            const step = 80 + i * 50;
            if (xp < prevThresh + step) {
                lvl = i;
                nextThresh = prevThresh + step;
                break;
            }
            prevThresh += step;
        }

        const titleIndex = Math.min(lvl - 1, titles.length - 1);
        const title = titles[titleIndex];
        const curLevelXp = xp - prevThresh;
        const neededXp = nextThresh - prevThresh;
        const pct = Math.min(100, Math.round((curLevelXp / neededXp) * 100));

        return { level: lvl, title, curLevelXp, neededXp, pct, totalXp: xp };
    }

    function checkDailyStreak() {
        const todayStr = new Date().toISOString().split('T')[0];
        const last = state.gamify.lastDate;

        if (!last) {
            state.gamify.lastDate = todayStr;
            state.gamify.streak = 1;
            state.gamify.longestStreak = Math.max(state.gamify.longestStreak || 1, 1);
            saveProgress();
            return;
        }

        if (last === todayStr) {
            return;
        }

        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (last === yesterday) {
            state.gamify.streak = (state.gamify.streak || 1) + 1;
            state.gamify.lastDate = todayStr;
            state.gamify.longestStreak = Math.max(state.gamify.longestStreak || 1, state.gamify.streak);
            showToast('🔥 Tăng chuỗi ngày học!', `Bạn đã duy trì học liên tục ${state.gamify.streak} ngày!`, '🔥');
            awardXp(30, 'Duy trì streak hàng ngày');
        } else {
            state.gamify.streak = 1;
            state.gamify.lastDate = todayStr;
        }
        saveProgress();
        checkBadgeUnlocks();
        updateGamifyUI();
    }

    function awardXp(amount, reason = '') {
        const oldLvl = getLevelInfo(state.gamify.xp || 0).level;
        state.gamify.xp = (state.gamify.xp || 0) + amount;
        const newLvlInfo = getLevelInfo(state.gamify.xp);

        if (newLvlInfo.level > oldLvl) {
            playSoundEffect('badge');
            showToast('⚡ THĂNG CẤP MỚI!', `Chúc mừng! Bạn đã đạt Cấp ${newLvlInfo.level} · ${newLvlInfo.title}!`, '🎉', true);
        }

        saveProgress();
        updateGamifyUI();
        checkBadgeUnlocks();
    }

    function unlockBadge(badgeId) {
        if (!state.gamify.unlockedBadges) state.gamify.unlockedBadges = {};
        if (state.gamify.unlockedBadges[badgeId]) return;

        const badge = BADGES_CATALOG.find(b => b.id === badgeId);
        if (!badge) return;

        const todayStr = new Date().toLocaleDateString('vi-VN');
        state.gamify.unlockedBadges[badgeId] = todayStr;
        state.gamify.xp = (state.gamify.xp || 0) + badge.xp;
        saveProgress();

        playSoundEffect('badge');
        showToast(`🎉 Mở khóa Huy hiệu: ${badge.title}!`, `${badge.desc} (+${badge.xp} XP)`, badge.icon, true);
        updateGamifyUI();
    }

    function checkBadgeUnlocks() {
        const stats = state.gamify.stats || {};
        const streak = state.gamify.streak || 1;

        if (stats.wordsLearned >= 1) unlockBadge('b_first_word');
        if (streak >= 3) unlockBadge('b_streak_3');
        if (streak >= 7) unlockBadge('b_streak_7');
        if (streak >= 30) unlockBadge('b_streak_30');
        if (stats.flashcardsFlipped >= 50) unlockBadge('b_fc_50');
        if (stats.flashcardsFlipped >= 200) unlockBadge('b_fc_200');
        if (stats.quizStreakBest >= 5) unlockBadge('b_quiz_streak_5');
        if (stats.quizStreakBest >= 10) unlockBadge('b_quiz_streak_10');
        if (Object.keys(state.srsData || {}).length >= 1) unlockBadge('b_srs_first');
        if (stats.srsMastered >= 10) unlockBadge('b_srs_master_10');
        if (stats.podcastRuns >= 1) unlockBadge('b_podcast_fan');
        if (stats.voicePracticed >= 1) unlockBadge('b_voice_first');
        if (stats.voiceScoreBest >= 85) unlockBadge('b_voice_master');
    }

    function updateGamifyUI() {
        const streakEl = document.getElementById('hdrStreakCount');
        const lvlEl = document.getElementById('hdrUserLevel');
        const lvlInfo = getLevelInfo(state.gamify.xp || 0);

        if (streakEl) streakEl.textContent = state.gamify.streak || 1;
        if (lvlEl) lvlEl.textContent = `Lv.${lvlInfo.level}`;

        // Inside Badges Modal
        const bmStreak = document.getElementById('bmStreakCount');
        const bmLongest = document.getElementById('bmLongestStreak');
        const bmLevelTitle = document.getElementById('bmLevelTitle');
        const bmCurrentXp = document.getElementById('bmCurrentXp');
        const bmNextXp = document.getElementById('bmNextXp');
        const bmXpFill = document.getElementById('bmXpFill');

        if (bmStreak) bmStreak.textContent = state.gamify.streak || 1;
        if (bmLongest) bmLongest.textContent = state.gamify.longestStreak || 1;
        if (bmLevelTitle) bmLevelTitle.textContent = `Cấp ${lvlInfo.level} · ${lvlInfo.title}`;
        if (bmCurrentXp) bmCurrentXp.textContent = lvlInfo.curLevelXp;
        if (bmNextXp) bmNextXp.textContent = lvlInfo.neededXp;
        if (bmXpFill) bmXpFill.style.width = `${lvlInfo.pct}%`;

        const stats = state.gamify.stats || {};
        const statWords = document.getElementById('bmStatWords');
        const statQuiz = document.getElementById('bmStatQuiz');
        const statFc = document.getElementById('bmStatFc');
        const statSrs = document.getElementById('bmStatSrs');

        if (statWords) statWords.textContent = stats.wordsLearned || 0;
        if (statQuiz) statQuiz.textContent = stats.quizzesCompleted || 0;
        if (statFc) statFc.textContent = stats.flashcardsFlipped || 0;
        if (statSrs) statSrs.textContent = stats.srsMastered || 0;

        renderBadgesGrid();
    }

    function renderBadgesGrid() {
        const grid = document.getElementById('badgesGrid');
        const countEl = document.getElementById('bmBadgesUnlockedCount');
        if (!grid) return;

        const unlocked = state.gamify.unlockedBadges || {};
        const unlockedCount = Object.keys(unlocked).length;
        if (countEl) countEl.textContent = `${unlockedCount} / ${BADGES_CATALOG.length} huy hiệu`;

        grid.innerHTML = BADGES_CATALOG.map(b => {
            const isUnlocked = !!unlocked[b.id];
            const dateStr = unlocked[b.id] || '';
            return `
                <div class="badge-card ${isUnlocked ? 'unlocked' : 'locked'}">
                    <div class="badge-icon">${b.icon}</div>
                    <div class="badge-info">
                        <div class="badge-title">${escapeHtml(b.title)}</div>
                        <div class="badge-desc">${escapeHtml(b.desc)}</div>
                        ${isUnlocked
                            ? `<div class="badge-date">✓ Đã đạt: ${dateStr}</div>`
                            : `<div class="badge-xp-reward">+${b.xp} XP khi mở khóa</div>`}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==================== SPACED REPETITION (SRS / LEITNER) ENGINE ====================
    const SRS_INTERVALS_MS = {
        1: 0,                   // Box 1: Immediate / today
        2: 1 * 86400000,        // Box 2: 1 day
        3: 3 * 86400000,        // Box 3: 3 days
        4: 7 * 86400000,        // Box 4: 7 days
        5: 14 * 86400000        // Box 5: 14 days (Mastered)
    };

    function addToSrs(wordId, initialBox = 1) {
        if (!state.srsData) state.srsData = {};
        const existing = state.srsData[wordId];
        const now = Date.now();

        state.srsData[wordId] = {
            wordId,
            box: initialBox,
            addedAt: existing ? existing.addedAt : now,
            lastReviewed: now,
            nextDue: now + (SRS_INTERVALS_MS[initialBox] || 0),
            reviewCount: existing ? existing.reviewCount + 1 : 1
        };

        saveProgress();
        updateSrsHeaderBadge();
        checkBadgeUnlocks();
    }

    function rateSrsWord(wordId, rating) {
        if (!state.srsData) state.srsData = {};
        const item = state.srsData[wordId] || { wordId, box: 1, reviewCount: 0 };
        const now = Date.now();
        let newBox = 1;

        if (rating === 1) {
            newBox = 1;
        } else if (rating === 2) {
            newBox = Math.max(1, Math.min(3, item.box));
        } else if (rating === 3) {
            newBox = Math.min(5, (item.box || 1) + 1);
            if (newBox === 5 && item.box < 5) {
                state.gamify.stats.srsMastered = (state.gamify.stats.srsMastered || 0) + 1;
            }
            awardXp(12, 'Ghi nhớ từ trong SRS');
        }

        state.srsData[wordId] = {
            wordId,
            box: newBox,
            addedAt: item.addedAt || now,
            lastReviewed: now,
            nextDue: now + (SRS_INTERVALS_MS[newBox] || 0),
            reviewCount: (item.reviewCount || 0) + 1
        };

        saveProgress();
        updateSrsHeaderBadge();
        checkBadgeUnlocks();
    }

    function removeWordFromSrs(wordId) {
        if (state.srsData && state.srsData[wordId]) {
            delete state.srsData[wordId];
            saveProgress();
            updateSrsHeaderBadge();
            renderSrsModal();
        }
    }

    function getSrsDueWords() {
        const bookData = getLoadedBookData(state.activeBookId);
        if (!bookData || !bookData.units) return [];
        const now = Date.now();
        const dueWords = [];

        const wordMap = {};
        bookData.units.forEach(u => {
            (u.target_words || []).forEach(w => {
                wordMap[w.id] = w;
            });
        });

        for (const [wid, srsInfo] of Object.entries(state.srsData || {})) {
            if (wordMap[wid] && srsInfo.nextDue <= now + 60000) {
                dueWords.push(wordMap[wid]);
            }
        }
        return dueWords;
    }

    function getAllSrsWordsForCurrentBook() {
        const bookData = getLoadedBookData(state.activeBookId);
        if (!bookData || !bookData.units) return [];
        const srsWords = [];

        const wordMap = {};
        bookData.units.forEach(u => {
            (u.target_words || []).forEach(w => {
                wordMap[w.id] = w;
            });
        });

        for (const [wid, srsInfo] of Object.entries(state.srsData || {})) {
            if (wordMap[wid]) {
                srsWords.push({ word: wordMap[wid], srs: srsInfo });
            }
        }
        return srsWords;
    }

    function updateSrsHeaderBadge() {
        const badge = document.getElementById('hdrSrsCount');
        if (!badge) return;
        const due = getSrsDueWords().length;
        badge.textContent = due;
        badge.classList.toggle('hidden', due === 0);
    }

    function renderSrsModal() {
        const modal = document.getElementById('srsModal');
        const boxesBar = document.getElementById('srsBoxesBar');
        const listEl = document.getElementById('srsWordList');
        if (!modal || !boxesBar || !listEl) return;

        const allSrs = getAllSrsWordsForCurrentBook();
        const boxCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        allSrs.forEach(item => {
            const b = item.srs.box || 1;
            boxCounts[b] = (boxCounts[b] || 0) + 1;
        });

        boxesBar.innerHTML = [1, 2, 3, 4, 5].map(b => `
            <div class="srs-box-chip box-${b}" data-box-filter="${b}">
                <div class="sbc-title">Hộp ${b}</div>
                <div class="sbc-count">${boxCounts[b]}</div>
            </div>
        `).join('');

        if (!allSrs.length) {
            listEl.innerHTML = `
                <div class="empty-msg" style="padding:40px 16px;">
                    🎉 Hộp từ khó của bạn hiện đang trống! Khi bạn làm sai câu hỏi hoặc bấm nút <strong>🧠 Cần ôn</strong> trên thẻ từ, các từ vựng sẽ tự động tập hợp về đây để bạn ôn tập ngắt quãng.
                </div>
            `;
            return;
        }

        listEl.innerHTML = allSrs.map(item => `
            <div class="srs-item-row" id="srs-row-${item.word.id}">
                <div class="sir-left">
                    <span class="sir-hz" data-speak="${escapeAttr(cleanHanziForTts(item.word.word))}" title="Nhấn để nghe">${escapeHtml(item.word.word)}</span>
                    <span class="sir-py">${escapeHtml(item.word.pinyin)}</span>
                    <span class="sir-vn">${escapeHtml(item.word.meaning_vi || item.word.meaning_primary)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="sir-box-badge">Hộp ${item.srs.box || 1}</span>
                    <button class="sir-remove-btn" data-remove-srs="${item.word.id}">Bỏ theo dõi</button>
                </div>
            </div>
        `).join('');

        listEl.querySelectorAll('[data-speak]').forEach(el => {
            el.addEventListener('click', () => speakChinese(el.getAttribute('data-speak')));
        });

        listEl.querySelectorAll('[data-remove-srs]').forEach(btn => {
            btn.addEventListener('click', () => {
                const wid = btn.getAttribute('data-remove-srs');
                removeWordFromSrs(wid);
            });
        });
    }

    // ==================== HANDS-FREE PODCAST PLAYER ENGINE ====================
    function openPodcastPlayer() {
        const bar = document.getElementById('podcastPlayerBar');
        const btnHeader = document.getElementById('btnTogglePodcast');
        if (bar) bar.classList.remove('hidden');
        if (btnHeader) btnHeader.classList.add('active');

        state.podcast.active = true;
        initPodcastPlaylist();
        startPodcastPlayback();
    }

    function closePodcastPlayer() {
        const bar = document.getElementById('podcastPlayerBar');
        const btnHeader = document.getElementById('btnTogglePodcast');
        if (bar) bar.classList.add('hidden');
        if (btnHeader) btnHeader.classList.remove('active');

        stopPodcastPlayback();
        state.podcast.active = false;
    }

    function initPodcastPlaylist() {
        const scope = state.podcast.scope;
        let words = [];

        if (scope === 'srs') {
            words = getAllSrsWordsForCurrentBook().map(item => item.word);
        } else if (scope === 'star') {
            words = getWordsForScope('starred');
        } else if (scope === 'book') {
            words = getWordsForScope('book');
        } else {
            words = getWordsForScope('unit');
        }

        state.podcast.list = words.length ? words : (getCurrentUnitData() ? getCurrentUnitData().target_words : []);
        state.podcast.index = 0;
        state.podcast.step = 'word';
        updatePodcastUI();
    }

    function updatePodcastUI() {
        const bar = document.getElementById('podcastPlayerBar');
        const hzEl = document.getElementById('ppbHz');
        const pyEl = document.getElementById('ppbPy');
        const vnEl = document.getElementById('ppbVn');
        const stepEl = document.getElementById('ppbStepBadge');
        const exEl = document.getElementById('ppbExPreview');
        const counterEl = document.getElementById('ppbCounter');
        const fillEl = document.getElementById('ppbProgressBar');
        const btnPlay = document.getElementById('ppbBtnPlay');

        if (!state.podcast.list.length) return;
        const w = state.podcast.list[state.podcast.index] || state.podcast.list[0];

        if (hzEl) hzEl.textContent = w.word;
        if (pyEl) pyEl.textContent = w.pinyin;
        if (vnEl) vnEl.textContent = w.meaning_vi || w.meaning_primary || '';

        const stepLabels = {
            word: '🔊 Từ vựng (x2)',
            meaning: '🇻🇳 Nghĩa tiếng Việt',
            ex: '💬 Câu ví dụ',
            ex_vn: '📝 Dịch câu ví dụ'
        };
        if (stepEl) stepEl.textContent = stepLabels[state.podcast.step] || '🔊 Phát âm';

        const ex = (w.examples && w.examples[0]) ? w.examples[0] : null;
        if (exEl) {
            exEl.textContent = ex ? `“${ex.hz}”` : '';
        }

        if (counterEl) {
            counterEl.textContent = `${state.podcast.index + 1} / ${state.podcast.list.length}`;
        }
        if (fillEl) {
            const pct = Math.round(((state.podcast.index + 1) / state.podcast.list.length) * 100);
            fillEl.style.width = `${pct}%`;
        }
        if (btnPlay) {
            btnPlay.textContent = state.podcast.isPlaying ? '⏸️' : '▶️';
        }
        if (bar) {
            bar.classList.toggle('playing', state.podcast.isPlaying);
        }
    }

    function startPodcastPlayback() {
        state.podcast.isPlaying = true;
        updatePodcastUI();
        state.gamify.stats.podcastRuns = (state.gamify.stats.podcastRuns || 0) + 1;
        awardXp(15, 'Nghe podcast thụ động');
        playPodcastCurrentStep();
    }

    function stopPodcastPlayback() {
        state.podcast.isPlaying = false;
        if (state.podcast.timerId) {
            clearTimeout(state.podcast.timerId);
            state.podcast.timerId = null;
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        updatePodcastUI();
    }

    function playPodcastCurrentStep() {
        if (!state.podcast.isPlaying || !state.podcast.list.length) return;

        const w = state.podcast.list[state.podcast.index];
        if (!w) return;

        const ex = (w.examples && w.examples[0]) ? w.examples[0] : null;
        updatePodcastUI();

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }

        const step = state.podcast.step;
        let textToSpeak = '';
        let lang = 'zh-CN';
        let rate = state.podcast.speed || 1.0;

        if (step === 'word') {
            textToSpeak = `${cleanHanziForTts(w.word)}, , ${cleanHanziForTts(w.word)}`;
            lang = 'zh-CN';
        } else if (step === 'meaning') {
            textToSpeak = w.meaning_vi || w.meaning_primary || '';
            lang = 'vi-VN';
        } else if (step === 'ex') {
            if (ex && ex.hz) {
                textToSpeak = ex.hz;
                lang = 'zh-CN';
            } else {
                advancePodcastStep();
                return;
            }
        } else if (step === 'ex_vn') {
            if (ex && ex.vn) {
                textToSpeak = ex.vn;
                lang = 'vi-VN';
            } else {
                advancePodcastStep();
                return;
            }
        }

        if (!textToSpeak) {
            advancePodcastStep();
            return;
        }

        const utter = new SpeechSynthesisUtterance(textToSpeak);
        utter.lang = lang;
        utter.rate = rate;

        utter.onend = () => {
            if (!state.podcast.isPlaying) return;
            const pause = step === 'word' ? 600 : (step === 'meaning' ? 700 : 900);
            state.podcast.timerId = setTimeout(advancePodcastStep, pause);
        };

        utter.onerror = () => {
            if (!state.podcast.isPlaying) return;
            state.podcast.timerId = setTimeout(advancePodcastStep, 500);
        };

        window.speechSynthesis.speak(utter);
    }

    function advancePodcastStep() {
        if (!state.podcast.isPlaying) return;

        const w = state.podcast.list[state.podcast.index];
        const hasEx = w && w.examples && w.examples.length;
        const isBilingual = state.podcast.voiceMode === 'bilingual';

        if (state.podcast.step === 'word') {
            if (isBilingual) {
                state.podcast.step = 'meaning';
            } else if (hasEx) {
                state.podcast.step = 'ex';
            } else {
                gotoNextPodcastWord();
                return;
            }
        } else if (state.podcast.step === 'meaning') {
            if (hasEx) {
                state.podcast.step = 'ex';
            } else {
                gotoNextPodcastWord();
                return;
            }
        } else if (state.podcast.step === 'ex') {
            if (isBilingual && hasEx) {
                state.podcast.step = 'ex_vn';
            } else {
                gotoNextPodcastWord();
                return;
            }
        } else if (state.podcast.step === 'ex_vn') {
            gotoNextPodcastWord();
            return;
        }

        playPodcastCurrentStep();
    }

    function gotoNextPodcastWord() {
        state.podcast.step = 'word';
        if (state.podcast.index < state.podcast.list.length - 1) {
            state.podcast.index += 1;
        } else {
            if (state.podcast.loop) {
                state.podcast.index = 0;
            } else {
                stopPodcastPlayback();
                showToast('🎧 Hoàn thành Podcast!', 'Bạn đã nghe xong toàn bộ danh sách từ vựng!', '🎉');
                return;
            }
        }
        playPodcastCurrentStep();
    }

    function initTheme() {
        const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'dark';
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
        updateThemeBtnIcon();
    }

    function toggleTheme() {
        const isLight = document.body.classList.toggle('light-mode');
        localStorage.setItem(STORAGE_KEY_THEME, isLight ? 'light' : 'dark');
        updateThemeBtnIcon();
    }

    function updateThemeBtnIcon() {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;
        const isLight = document.body.classList.contains('light-mode');
        btn.textContent = isLight ? '🌙' : '☀️';
    }

    // ==================== SIDEBAR DRAWER (MOBILE / TABLET / DESKTOP) ====================
    function isMobileOrTabletViewport() {
        return window.innerWidth <= 1024;
    }

    function openMobileSidebar() {
        const sidebarEl  = document.getElementById('wlSidebar');
        const backdropEl = document.getElementById('sidebarBackdrop');
        if (sidebarEl) sidebarEl.classList.add('mobile-open');
        if (backdropEl) backdropEl.classList.remove('hidden');
    }

    function closeMobileSidebar() {
        const sidebarEl  = document.getElementById('wlSidebar');
        const backdropEl = document.getElementById('sidebarBackdrop');
        if (sidebarEl) sidebarEl.classList.remove('mobile-open');
        if (backdropEl) backdropEl.classList.add('hidden');
    }

    function toggleSidebar() {
        const sidebarEl = document.getElementById('wlSidebar');
        if (!sidebarEl) return;
        if (isMobileOrTabletViewport()) {
            if (sidebarEl.classList.contains('mobile-open')) {
                closeMobileSidebar();
            } else {
                openMobileSidebar();
            }
        } else {
            sidebarEl.classList.toggle('collapsed');
        }
    }

    // ==================== BOOK SHELF & SIDEBAR ====================
    function renderBookShelf() {
        if (typeof HSK_BOOKS_INDEX === 'undefined') return;

        // 1. Populate Dropdown
        const sel = document.getElementById('bookSelectDropdown');
        if (sel) {
            sel.innerHTML = HSK_BOOKS_INDEX.map(book => {
                const doneCount = (book.units_index || []).filter(u => state.doneUnits[`${book.id}_${getUnitNum(u)}`]).length;
                const doneText = doneCount > 0 ? ` (✓ ${doneCount}/${book.unit_count})` : '';
                return `
                    <option value="${book.id}" ${book.id === state.activeBookId ? 'selected' : ''}>
                        ${escapeHtml(book.title)} · ${book.unit_count} bài · ${book.word_count.toLocaleString('vi-VN')} từ${doneText}
                    </option>
                `;
            }).join('');
            sel.value = state.activeBookId;

            if (!sel.dataset.bound) {
                sel.dataset.bound = 'true';
                sel.addEventListener('change', () => {
                    const bid = sel.value;
                    if (bid && bid !== state.activeBookId) {
                        selectBook(bid, null);
                    }
                });
            }
        }

        // 2. Populate Mini-Chips Track
        const track = document.getElementById('bookChipsTrack');
        if (track) {
            track.innerHTML = HSK_BOOKS_INDEX.map(book => {
                const isActive = book.id === state.activeBookId;
                const doneCount = (book.units_index || []).filter(u => state.doneUnits[`${book.id}_${getUnitNum(u)}`]).length;
                const shortName = book.id === 'q7' ? 'Q.7-9 上' : (book.id === 'q8' ? 'Q.7-9 下' : `Q.${book.level}`);

                return `
                    <button class="bsb-chip ${isActive ? 'active' : ''}"
                            style="--book-color: ${book.color}"
                            data-book-id="${book.id}"
                            title="${escapeHtml(book.title)} (${book.unit_count} bài · ${book.word_count.toLocaleString('vi-VN')} từ)">
                        <span class="bc-dot"></span>
                        <span class="bc-label">${shortName}</span>
                        ${doneCount > 0 ? `<span class="bc-done">✓</span>` : ''}
                    </button>
                `;
            }).join('');

            track.querySelectorAll('.bsb-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const bid = chip.getAttribute('data-book-id');
                    if (bid && bid !== state.activeBookId) {
                        selectBook(bid, null);
                    }
                });
            });

            const activeChip = track.querySelector('.bsb-chip.active');
            if (activeChip) {
                activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        }
    }

    async function selectBook(bookId, targetUnitNum) {
        stopSpeakingAll();
        state.activeBookId = bookId;
        const meta = getBookIndexMeta(bookId);
        if (!meta) return;

        const dlBtn = document.getElementById('btnDownloadJson');
        if (dlBtn && meta.json_file) {
            dlBtn.href = meta.json_file;
            dlBtn.setAttribute('download', meta.json_file.split('/').pop());
        }

        const firstUnit = meta.units_index.length ? getUnitNum(meta.units_index[0]) : 1;
        const validUnits = new Set(meta.units_index.map(u => getUnitNum(u)));
        if (targetUnitNum && validUnits.has(targetUnitNum)) {
            state.activeUnitNum = targetUnitNum;
        } else if (!validUnits.has(state.activeUnitNum)) {
            state.activeUnitNum = firstUnit;
        }

        renderBookShelf();
        renderSidebarSummary(meta);
        renderUnitList(meta);

        if (!getLoadedBookData(bookId)) {
            const qmList = document.getElementById('quickMemoryList');
            if (qmList) {
                qmList.innerHTML = `<div class="empty-msg">⏳ Đang tải dữ liệu JSON của <strong>${escapeHtml(meta.title)}</strong> (${meta.word_count.toLocaleString('vi-VN')} từ vựng)...</div>`;
            }
        }

        try {
            await ensureBookDataLoaded(bookId);
        } catch (err) {
            console.error(err);
        }

        selectUnit(state.activeUnitNum);
    }

    function renderSidebarSummary(meta) {
        const box = document.getElementById('sidebarBookSummary');
        if (!box) return;

        const doneCount = (meta.units_index || []).filter(u => state.doneUnits[`${meta.id}_${getUnitNum(u)}`]).length;
        const pct = meta.unit_count > 0 ? Math.round((doneCount / meta.unit_count) * 100) : 0;

        box.innerHTML = `
            <div class="sbs-head-row">
                <select class="sbs-book-select" id="sidebarBookSelect" title="Đổi quyển học">
                    ${HSK_BOOKS_INDEX.map(b => `<option value="${b.id}" ${b.id === meta.id ? 'selected' : ''}>📚 ${escapeHtml(b.title)}</option>`).join('')}
                </select>
            </div>
            <div class="sbs-sub">${escapeHtml(meta.translator)}</div>
            <div class="sbs-progress-row">
                <span>Tiến độ học</span>
                <strong>${doneCount} / ${meta.unit_count} bài (${pct}%)</strong>
            </div>
            <div class="sbs-bar">
                <div class="sbs-fill" style="width:${pct}%"></div>
            </div>
        `;

        const sSel = box.querySelector('#sidebarBookSelect');
        if (sSel) {
            sSel.addEventListener('change', () => {
                if (sSel.value && sSel.value !== state.activeBookId) {
                    selectBook(sSel.value, null);
                }
            });
        }
    }

    function renderUnitList(meta) {
        const listEl = document.getElementById('unitList');
        if (!listEl) return;

        const q = state.unitSearchQuery.trim().toLowerCase();
        const qNoTone = removePinyinTones(q);

        const fullBook = getLoadedBookData(meta.id);
        const unitMap = {};
        if (fullBook && fullBook.units) {
            fullBook.units.forEach(u => { unitMap[u.unit] = u; });
        }

        const filtered = (meta.units_index || []).filter(u => {
            const uNum = getUnitNum(u);
            const key = `${meta.id}_${uNum}`;
            const isDone = !!state.doneUnits[key];
            const isStar = !!state.starredUnits[key];

            if (state.unitFilter === 'todo' && isDone) return false;
            if (state.unitFilter === 'done' && !isDone) return false;
            if (state.unitFilter === 'star' && !isStar) return false;
            if (state.unitFilter === 'srs') {
                const fullU = unitMap[uNum];
                if (!fullU || !fullU.target_words) return false;
                const hasSrs = fullU.target_words.some(w => !!state.srsData[w.id]);
                if (!hasSrs) return false;
            }

            if (!q) return true;

            const startPy = getUnitStartPy(u);
            const endPy   = getUnitEndPy(u);
            const titleMatch = `bài ${uNum}`.includes(q) ||
                               `${uNum}` === q ||
                               (u.range && u.range.toLowerCase().includes(q)) ||
                               (startPy && removePinyinTones(startPy.toLowerCase()).includes(qNoTone)) ||
                               (endPy && removePinyinTones(endPy.toLowerCase()).includes(qNoTone));
            if (titleMatch) return true;

            const fullU = unitMap[uNum];
            if (fullU && fullU.target_words) {
                return fullU.target_words.some(w =>
                    w.word.toLowerCase().includes(q) ||
                    removePinyinTones(w.pinyin.toLowerCase()).includes(qNoTone) ||
                    (w.meaning_vi && w.meaning_vi.toLowerCase().includes(q))
                );
            }
            return false;
        });

        if (!filtered.length) {
            listEl.innerHTML = `<div class="empty-msg">Không tìm thấy bài học phù hợp.</div>`;
            return;
        }

        listEl.innerHTML = filtered.map(u => {
            const uNum = getUnitNum(u);
            const startPy = getUnitStartPy(u);
            const endPy   = getUnitEndPy(u);
            const key = `${meta.id}_${uNum}`;
            const isDone = !!state.doneUnits[key];
            const isStar = !!state.starredUnits[key];
            const isActive = uNum === state.activeUnitNum;
            const scoreObj = state.practiceScores[key];

            return `
                <div class="unit-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}"
                     data-unit-num="${uNum}">
                    <div class="ui-left">
                        <span class="ui-num">${isDone ? '✓ ' : ''}Bài ${uNum}</span>
                        <div class="ui-info">
                            <div class="ui-range">${escapeHtml(u.range)}</div>
                            <div class="ui-py">${escapeHtml(startPy)} – ${escapeHtml(endPy)}</div>
                        </div>
                    </div>
                    <div class="ui-right">
                        <span class="ui-page">Từ ${u.word_start}–${u.word_end}</span>
                        <span style="font-size:0.72rem;">
                            ${isStar ? '⭐ ' : ''}
                            ${scoreObj ? `<strong style="color:#34d399">${scoreObj.score}/${scoreObj.total}</strong>` : ''}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('.unit-item').forEach(el => {
            el.addEventListener('click', () => {
                const uNum = parseInt(el.getAttribute('data-unit-num'), 10);
                if (!isNaN(uNum)) {
                    selectUnit(uNum);
                    if (isMobileOrTabletViewport()) {
                        closeMobileSidebar();
                    }
                }
            });
        });
    }

    // ==================== SELECT & RENDER UNIT ====================
    function getCurrentUnitData() {
        const bookData = getLoadedBookData(state.activeBookId);
        if (!bookData || !bookData.units) return null;
        return bookData.units.find(u => u.unit === state.activeUnitNum) || bookData.units[0] || null;
    }

    function selectUnit(unitNum) {
        stopSpeakingAll();
        state.activeUnitNum = unitNum;
        state.practiceChecked = false;
        state.userAnswers = {
            sec1Pinyin: {},
            sec1Meaning: {},
            sec2Cloze: {},
            sec3Mcq: {}
        };

        const unitData = getCurrentUnitData();
        if (unitData && unitData.target_words && unitData.target_words.length) {
            state.activeWordNum = unitData.target_words[0].num;
        }

        saveProgress();

        const meta = getBookIndexMeta(state.activeBookId);
        if (meta) {
            renderSidebarSummary(meta);
            renderUnitList(meta);
            renderBookShelf();
        }

        const activeSidebarItem = document.querySelector(`.unit-item[data-unit-num="${unitNum}"]`);
        if (activeSidebarItem) {
            activeSidebarItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        if (!unitData) return;

        const badgeEl   = document.getElementById('activeUnitBadge');
        const headingEl = document.getElementById('activeUnitHeading');
        const subEl     = document.getElementById('activeUnitSub');
        const lblCount  = document.getElementById('lblTargetCount');

        if (badgeEl) {
            badgeEl.textContent = `Bài ${unitData.unit}`;
            if (meta) badgeEl.style.background = meta.color;
        }
        if (headingEl) headingEl.textContent = unitData.range.replace('—', ' — ');
        if (subEl) {
            subEl.textContent = `(Từ ${unitData.word_start} – ${unitData.word_end} · Trang sách ${unitData.book_page})`;
        }
        if (lblCount) {
            lblCount.textContent = `${unitData.target_words ? unitData.target_words.length : 20} từ`;
        }

        updateUnitActionButtons();

        renderMemoryPane(unitData);
        renderPracticePane(unitData);
        initFlashcardDeck();
        initReflexQuiz();
        if (state.studyMode === 'shadowing') {
            initShadowingStudio();
        } else {
            updateShadowingWordList();
        }

        const stage = document.getElementById('unitStageScroll');
        if (stage) stage.scrollTop = 0;
    }

    function updateUnitActionButtons() {
        const key = `${state.activeBookId}_${state.activeUnitNum}`;
        const isDone = !!state.doneUnits[key];
        const isStar = !!state.starredUnits[key];

        const btnDone = document.getElementById('btnToggleUnitDone');
        if (btnDone) {
            btnDone.classList.toggle('done', isDone);
            btnDone.innerHTML = isDone ? '✓ Đã hoàn thành' : '☐ Đánh dấu Đã học';
        }

        const mobDone = document.getElementById('mobToggleDone');
        if (mobDone) {
            mobDone.classList.toggle('done-active', isDone);
            mobDone.innerHTML = isDone ? '✓ Học' : '☐ Học';
        }

        const btnStar = document.getElementById('btnToggleUnitStar');
        if (btnStar) {
            btnStar.classList.toggle('starred', isStar);
            btnStar.textContent = isStar ? '⭐' : '☆';
        }

        const meta = getBookIndexMeta(state.activeBookId);
        if (meta && meta.units_index) {
            const idx = meta.units_index.findIndex(u => getUnitNum(u) === state.activeUnitNum);
            const atFirst = idx <= 0;
            const atLast  = idx < 0 || idx >= meta.units_index.length - 1;

            const btnPrev = document.getElementById('btnPrevUnit');
            const btnNext = document.getElementById('btnNextUnit');
            if (btnPrev) btnPrev.disabled = atFirst;
            if (btnNext) btnNext.disabled = atLast;

            const mobPrev = document.getElementById('mobPrevUnit');
            const mobNext = document.getElementById('mobNextUnit');
            const mobLbl  = document.getElementById('mobCurrentUnitLabel');
            if (mobPrev) mobPrev.disabled = atFirst;
            if (mobNext) mobNext.disabled = atLast;
            if (mobLbl) {
                mobLbl.textContent = `Bài ${state.activeUnitNum}`;
                mobLbl.title = `Bài ${state.activeUnitNum} (${idx + 1}/${meta.units_index.length})`;
            }
        }
    }

    // ==================== MODE 1: GHI NHỚ NHANH (目标词语 & 速记) ====================
    function renderMemoryPane(unitData) {
        const gridEl = document.getElementById('targetWordsGrid');
        const listEl = document.getElementById('quickMemoryList');
        if (!gridEl || !listEl || !unitData) return;

        const words = unitData.target_words || [];

        const gQuery = state.globalSearchQuery.trim();
        if (gQuery) {
            renderGlobalSearchInMemoryPane(gQuery, gridEl, listEl);
            return;
        }

        gridEl.innerHTML = words.map(w => {
            const isStar = !!state.starredWords[w.id];
            const isActive = w.num === state.activeWordNum;
            const shortVi = truncateText(w.meaning_vi || w.meaning_primary || '', 26);

            return `
                <div class="tw-chip ${isActive ? 'active' : ''}"
                     data-word-num="${w.num}"
                     data-hanzi="${escapeAttr(cleanHanziForTts(w.word))}"
                     title="Nhấn để nghe phát âm và nhảy tới thẻ giải nghĩa #${w.num}">
                    <span class="tw-num">${w.num}</span>
                    <div class="tw-chip-body">
                        <div class="tw-chip-top">
                            <span class="tw-hz">${escapeHtml(w.word)}</span>
                            <span class="tw-py">${escapeHtml(w.pinyin)}</span>
                            ${isStar ? '<span style="font-size:0.75rem;">⭐</span>' : ''}
                        </div>
                        <div class="tw-vi">${escapeHtml(shortVi)}</div>
                    </div>
                </div>
            `;
        }).join('');

        gridEl.querySelectorAll('.tw-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const num = parseInt(chip.getAttribute('data-word-num'), 10);
                const hz  = chip.getAttribute('data-hanzi');
                state.activeWordNum = num;

                gridEl.querySelectorAll('.tw-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');

                if (hz) speakChinese(hz);

                const card = document.getElementById(`qm-word-${num}`);
                if (card) {
                    document.querySelectorAll('.qm-word-card.highlight-flash').forEach(el => {
                        el.classList.remove('highlight-flash');
                    });
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.classList.add('highlight-flash');
                    setTimeout(() => card.classList.remove('highlight-flash'), 2200);
                }
            });
        });

        const displayWords = state.onlyStarredWords
            ? words.filter(w => !!state.starredWords[w.id])
            : words;

        if (!displayWords.length) {
            listEl.innerHTML = `<div class="empty-msg">Chưa có từ vựng nào được đánh dấu sao (⭐) trong bài này. Hãy nhấn nút <strong>☆ Lưu</strong> ở góc phải thẻ từ vựng để lưu từ cần ôn tập.</div>`;
            return;
        }

        listEl.innerHTML = displayWords.map(w => renderQuickMemoryCardHtml(w, null)).join('');
        bindQuickMemoryCardEvents(listEl);
    }

    function renderQuickMemoryCardHtml(w, unitBadgeInfo) {
        const isStar = !!state.starredWords[w.id];
        const cleanHz = cleanHanziForTts(w.word);
        const showTrad = w.traditional && w.traditional !== w.word && !w.word.includes(w.traditional);
        const conciseEn = formatConciseEnglish(w.meaning_en, w.meaning_vi);

        const collocationsHtml = w.collocations
            ? `<div class="qmc-collocations">
                   <strong>🔗 Cụm từ thường gặp:</strong> ${escapeHtml(w.collocations)}
                   ${w.collocations_pinyin ? `<span style="color:var(--text-muted);font-size:0.78rem;"> (${escapeHtml(w.collocations_pinyin)})</span>` : ''}
               </div>`
            : '';

        const examples = w.examples || [];
        const examplesHtml = examples.length
            ? `<div class="qmc-examples">
                   ${examples.map((ex, idx) => `
                       <div class="qmc-ex-item" id="qm-word-${w.num}-ex-${idx}">
                           <div class="qmc-ex-hz">
                               <span><strong>${idx + 1}.</strong> ${highlightTargetWord(ex.hz, w.word)}</span>
                               <button class="ex-speak-btn" data-speak="${escapeAttr(ex.hz)}" title="Nghe câu ví dụ">🔊</button>
                           </div>
                           ${ex.py ? `<div class="qmc-ex-py ${state.showPinyin ? '' : 'hidden'}">${escapeHtml(ex.py)}</div>` : ''}
                           ${ex.vn ? `<div class="qmc-ex-vn ${state.showMeaning ? '' : 'hidden'}">${escapeHtml(ex.vn)}</div>` : ''}
                       </div>
                   `).join('')}
               </div>`
            : '';

        const srsInfo = state.srsData && state.srsData[w.id];
        const isSrs = !!srsInfo;

        return `
            <div class="qm-word-card" id="qm-word-${w.num}" data-word-id="${w.id}">
                <div class="qmc-head">
                    <div class="qmc-title-group">
                        <span class="qmc-num">#${w.num}</span>
                        <span class="qmc-hz" data-speak="${escapeAttr(cleanHz)}" title="Nhấn để nghe phát âm">${escapeHtml(w.word)}</span>
                        ${showTrad ? `<span class="qmc-trad" title="Chữ Phồn thể">[${escapeHtml(w.traditional)}]</span>` : ''}
                        <span class="qmc-py">${escapeHtml(w.pinyin)}</span>
                        ${w.pos_full ? `<span class="qmc-pos">${escapeHtml(w.pos_full)}</span>` : ''}
                        ${w.han_viet ? `<span class="qmc-hv">HV: ${escapeHtml(w.han_viet)}</span>` : ''}
                    </div>
                    <div class="qmc-actions">
                        ${unitBadgeInfo ? `<button class="qmc-icon-btn" data-jump-unit="${unitBadgeInfo.unit}" title="Chuyển tới Bài ${unitBadgeInfo.unit}">📖 Bài ${unitBadgeInfo.unit}</button>` : ''}
                        <button class="qmc-icon-btn" data-speak="${escapeAttr(cleanHz)}" title="Chỉ nghe phát âm từ vựng">🔊 Từ</button>
                        <button class="qmc-icon-btn" data-speak-word-ex="${w.num}" title="Đọc từ vựng này rồi đọc tiếp các câu ví dụ của từ">▶️ Từ + VD</button>
                        <button class="qmc-icon-btn ${isSrs ? 'srs-hard' : ''}" data-srs-id="${w.id}" title="Đánh dấu từ khó / Hộp lặp lại ngắt quãng SRS">
                            ${isSrs ? `🧠 Hộp ${srsInfo.box || 1}` : '🧠 Cần ôn'}
                        </button>
                        <button class="qmc-icon-btn ${isStar ? 'starred' : ''}" data-star-id="${w.id}" title="Lưu từ vựng này">
                            ${isStar ? '⭐ Đã lưu' : '☆ Lưu'}
                        </button>
                    </div>
                </div>

                <div class="qmc-meaning-box">
                    <div class="qmc-meaning-vi">🇻🇳 ${escapeHtml(w.meaning_vi || w.meaning_primary || '')}</div>
                    ${conciseEn ? `<div class="qmc-meaning-en">🇬🇧 ${escapeHtml(conciseEn)}</div>` : ''}
                </div>

                ${collocationsHtml}
                ${examplesHtml}
            </div>
        `;
    }

    function bindQuickMemoryCardEvents(container) {
        container.querySelectorAll('[data-speak]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                stopSpeakingAll();
                const text = el.getAttribute('data-speak');
                if (text) speakChinese(text);
            });
        });

        container.querySelectorAll('[data-speak-word-ex]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wNum = parseInt(btn.getAttribute('data-speak-word-ex'), 10);
                const unitData = getCurrentUnitData();
                if (!unitData || !unitData.target_words) return;
                const wordObj = unitData.target_words.find(item => item.num === wNum);
                if (wordObj) {
                    startSpeakingWordsWithExamples([wordObj]);
                }
            });
        });

        container.querySelectorAll('[data-srs-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wid = btn.getAttribute('data-srs-id');
                if (!wid) return;
                if (state.srsData && state.srsData[wid]) {
                    delete state.srsData[wid];
                    btn.classList.remove('srs-hard');
                    btn.textContent = '🧠 Cần ôn';
                    showToast('Đã bỏ theo dõi', 'Đã xóa từ khỏi Hộp từ khó SRS', 'ℹ️');
                } else {
                    addToSrs(wid, 1);
                    btn.classList.add('srs-hard');
                    btn.textContent = '🧠 Hộp 1';
                    showToast('🧠 Đã thêm vào Hộp SRS!', 'Từ này sẽ được lên lịch ôn ngắt quãng', '🧠');
                }
                saveProgress();
                updateSrsHeaderBadge();
            });
        });

        container.querySelectorAll('[data-star-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wid = btn.getAttribute('data-star-id');
                if (!wid) return;
                if (state.starredWords[wid]) {
                    delete state.starredWords[wid];
                    btn.classList.remove('starred');
                    btn.textContent = '☆ Lưu';
                } else {
                    state.starredWords[wid] = true;
                    btn.classList.add('starred');
                    btn.textContent = '⭐ Đã lưu';
                }
                saveProgress();
                const unitData = getCurrentUnitData();
                if (unitData && !state.globalSearchQuery) {
                    renderMemoryPane(unitData);
                }
            });
        });

        container.querySelectorAll('[data-jump-unit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const uNum = parseInt(btn.getAttribute('data-jump-unit'), 10);
                if (!isNaN(uNum)) {
                    state.globalSearchQuery = '';
                    const gInput = document.getElementById('globalWordSearch');
                    const clearBtn = document.getElementById('clearGlobalSearch');
                    if (gInput) gInput.value = '';
                    if (clearBtn) clearBtn.classList.add('hidden');
                    selectUnit(uNum);
                }
            });
        });
    }

    function renderGlobalSearchInMemoryPane(query, gridEl, listEl) {
        const bookData = getLoadedBookData(state.activeBookId);
        if (!bookData || !bookData.units) return;

        const qLower = query.toLowerCase();
        const qNoTone = removePinyinTones(qLower);
        const matches = [];

        for (const u of bookData.units) {
            for (const w of (u.target_words || [])) {
                const matchHz = w.word.toLowerCase().includes(qLower) || (w.traditional && w.traditional.includes(qLower));
                const matchPy = w.pinyin.toLowerCase().includes(qLower) || removePinyinTones(w.pinyin.toLowerCase()).includes(qNoTone);
                const matchVi = (w.meaning_vi && w.meaning_vi.toLowerCase().includes(qLower)) ||
                                (w.meaning_en && w.meaning_en.toLowerCase().includes(qLower)) ||
                                (w.han_viet && w.han_viet.toLowerCase().includes(qLower));
                if (matchHz || matchPy || matchVi) {
                    matches.push({ word: w, unit: u.unit });
                    if (matches.length >= 100) break;
                }
            }
            if (matches.length >= 100) break;
        }

        gridEl.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 6px 4px; font-size: 0.9rem; color: var(--text-secondary);">
                🔍 Kết quả tìm kiếm cho <strong>"${escapeHtml(query)}"</strong> trong <strong>${escapeHtml(bookData.title)}</strong>:
                Tìm thấy <strong>${matches.length}${matches.length >= 100 ? '+' : ''}</strong> từ vựng.
            </div>
        `;

        if (!matches.length) {
            listEl.innerHTML = `<div class="empty-msg">Không tìm thấy từ vựng nào khớp với "${escapeHtml(query)}" trong quyển này.</div>`;
            return;
        }

        listEl.innerHTML = matches.map(m => renderQuickMemoryCardHtml(m.word, { unit: m.unit })).join('');
        bindQuickMemoryCardEvents(listEl);
    }

    // ==================== MODE 2: LUYỆN TẬP NHANH (◎ 速练) ====================
    function renderPracticePane(unitData) {
        const bannerUnit = document.getElementById('pracBannerUnit');
        if (bannerUnit && unitData) {
            bannerUnit.textContent = `Bài ${unitData.unit} (${unitData.range})`;
        }

        const scoreBadge = document.getElementById('practiceScoreBadge');
        const scoreBadgeBottom = document.getElementById('practiceScoreBadgeBottom');
        if (scoreBadge) scoreBadge.classList.add('hidden');
        if (scoreBadgeBottom) scoreBadgeBottom.classList.add('hidden');

        const ex = (unitData && unitData.exercises) ? unitData.exercises : null;
        if (!ex) return;

        renderExSection1(ex.section1);
        renderExSection2(ex.section2);
        renderExSection3(ex.section3);
    }

    function renderExSection1(sec1) {
        const container = document.getElementById('exSection1');
        if (!container || !sec1) return;

        const pyBankHtml = (sec1.pinyin_bank || []).map(item => `
            <span class="s1-bank-chip"><strong>${item.letter}.</strong> ${escapeHtml(item.text)}</span>
        `).join('');

        const mnBankHtml = (sec1.meaning_bank || []).map(item => `
            <span class="s1-bank-chip"><strong>${item.letter}.</strong> ${escapeHtml(item.text)}</span>
        `).join('');

        const pyLetters = (sec1.pinyin_bank || []).map(i => i.letter);
        const mnLetters = (sec1.meaning_bank || []).map(i => i.letter);

        const rowsHtml = (sec1.questions || []).map(q => {
            const curPy = state.userAnswers.sec1Pinyin[q.q_num] || '';
            const curMn = state.userAnswers.sec1Meaning[q.q_num] || '';

            return `
                <div class="s1-q-row" id="s1-row-${q.q_num}">
                    <div class="s1-q-top">
                        <div>
                            <span class="s1-q-num">${q.q_num}.</span>
                            <span class="s1-q-word" data-speak="${escapeAttr(cleanHanziForTts(q.word))}" style="cursor:pointer" title="Nhấn để nghe phát âm">
                                ${escapeHtml(q.word)} 🔊
                            </span>
                        </div>
                        <span class="s1-feedback hidden" id="s1-fb-${q.q_num}"></span>
                    </div>
                    <div class="s1-select-group">
                        <div class="s1-select-wrap">
                            <span class="s1-select-label">Chọn Pinyin (A–J):</span>
                            <select class="s1-select" data-s1-py="${q.q_num}">
                                <option value="">-- Pinyin --</option>
                                ${pyLetters.map(l => {
                                    const bankItem = sec1.pinyin_bank.find(b => b.letter === l);
                                    return `<option value="${l}" ${curPy === l ? 'selected' : ''}>${l}. ${bankItem ? escapeHtml(bankItem.text) : ''}</option>`;
                                }).join('')}
                            </select>
                        </div>
                        <div class="s1-select-wrap">
                            <span class="s1-select-label">Chọn Nghĩa (a–j):</span>
                            <select class="s1-select" data-s1-mn="${q.q_num}">
                                <option value="">-- Nghĩa --</option>
                                ${mnLetters.map(l => {
                                    const bankItem = sec1.meaning_bank.find(b => b.letter === l);
                                    return `<option value="${l}" ${curMn === l ? 'selected' : ''}>${l}. ${bankItem ? escapeHtml(truncateText(bankItem.text, 30)) : ''}</option>`;
                                }).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="ex-head">
                <div class="ex-title">${escapeHtml(sec1.title)}</div>
                <span class="au-pinyin">10 từ × 2 cột = 20 điểm</span>
            </div>
            <div class="ex-body">
                <div class="s1-banks-grid">
                    <div class="s1-bank-box">
                        <h4>🔤 Ngân hàng Phiên âm Pinyin (A – J)</h4>
                        <div class="s1-bank-items">${pyBankHtml}</div>
                    </div>
                    <div class="s1-bank-box">
                        <h4>🇻🇳 Ngân hàng Nghĩa tiếng Việt (a – j)</h4>
                        <div class="s1-bank-items">${mnBankHtml}</div>
                    </div>
                </div>
                <div class="s1-questions-list">
                    ${rowsHtml}
                </div>
            </div>
        `;

        container.querySelectorAll('[data-speak]').forEach(el => {
            el.addEventListener('click', () => speakChinese(el.getAttribute('data-speak')));
        });

        container.querySelectorAll('[data-s1-py]').forEach(sel => {
            sel.addEventListener('change', () => {
                const qNum = sel.getAttribute('data-s1-py');
                state.userAnswers.sec1Pinyin[qNum] = sel.value;
            });
        });

        container.querySelectorAll('[data-s1-mn]').forEach(sel => {
            sel.addEventListener('change', () => {
                const qNum = sel.getAttribute('data-s1-mn');
                state.userAnswers.sec1Meaning[qNum] = sel.value;
            });
        });
    }

    function renderExSection2(sec2) {
        const container = document.getElementById('exSection2');
        if (!container || !sec2) return;

        const groupsHtml = (sec2.groups || []).map(grp => {
            const optsBankHtml = (grp.options || []).map(o => `
                <div class="s2-word-opt" data-speak="${escapeAttr(cleanHanziForTts(o.word))}" style="cursor:pointer" title="Nhấn để nghe">
                    <span class="s2-opt-letter">${o.letter}.</span>
                    <span class="s2-opt-hz">${escapeHtml(o.word)}</span>
                    <span class="s2-opt-py">(${escapeHtml(o.pinyin)})</span>
                </div>
            `).join('');

            const questionsHtml = (grp.questions || []).map(q => {
                const key = `g${grp.group_num}_q${q.q_num}`;
                const chosenLetter = state.userAnswers.sec2Cloze[key] || '';
                const chosenOpt = (grp.options || []).find(o => o.letter === chosenLetter);
                const blankDisplay = chosenOpt ? `[${chosenLetter}] ${chosenOpt.word}` : '______';

                const sentenceHtml = escapeHtml(q.sentence).replace(
                    '______',
                    `<span class="s2-blank-slot ${chosenLetter ? 'filled' : ''}" id="s2-slot-${key}">${escapeHtml(blankDisplay)}</span>`
                );

                return `
                    <div class="s2-q-item" id="s2-item-${key}">
                        <div class="s2-q-sentence">
                            <div><span class="s1-q-num">${q.q_num}.</span> ${sentenceHtml}</div>
                            <div class="s2-q-hint hidden" id="s2-hint-${key}">
                                💡 <em>${escapeHtml(q.hint_py || '')}</em> — ${escapeHtml(q.hint_vn || '')}
                            </div>
                        </div>
                        <div class="s2-q-choices">
                            ${(grp.options || []).map(o => `
                                <button class="s2-choice-pill ${chosenLetter === o.letter ? 'selected' : ''}"
                                        data-s2-key="${key}"
                                        data-s2-letter="${o.letter}"
                                        data-s2-word="${escapeAttr(o.word)}"
                                        title="${escapeAttr(o.word)} (${escapeAttr(o.pinyin)})">
                                    ${o.letter}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="s2-group-card">
                    <div class="s2-group-title">Nhóm ${escapeHtml(grp.group_title)}</div>
                    <div class="s2-word-bank">${optsBankHtml}</div>
                    <div class="s2-q-list">${questionsHtml}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="ex-head">
                <div class="ex-title">${escapeHtml(sec2.title)}</div>
                <span class="au-pinyin">4 nhóm × 5 câu = 20 điểm</span>
            </div>
            <div class="ex-body">
                <div class="s2-groups-grid">${groupsHtml}</div>
            </div>
        `;

        container.querySelectorAll('[data-speak]').forEach(el => {
            el.addEventListener('click', () => speakChinese(el.getAttribute('data-speak')));
        });

        container.querySelectorAll('[data-s2-key]').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-s2-key');
                const letter = btn.getAttribute('data-s2-letter');
                const word = btn.getAttribute('data-s2-word');

                state.userAnswers.sec2Cloze[key] = letter;

                const slot = document.getElementById(`s2-slot-${key}`);
                if (slot) {
                    slot.textContent = `[${letter}] ${word}`;
                    slot.classList.add('filled');
                    slot.classList.remove('correct', 'wrong');
                }

                const parent = btn.closest('.s2-q-choices');
                if (parent) {
                    parent.querySelectorAll('.s2-choice-pill').forEach(b => {
                        b.classList.remove('selected', 'correct-ans', 'wrong-ans');
                    });
                }
                btn.classList.add('selected');
            });
        });
    }

    function renderExSection3(sec3) {
        const container = document.getElementById('exSection3');
        if (!container || !sec3) return;

        const questionsHtml = (sec3.questions || []).map(q => {
            const chosen = state.userAnswers.sec3Mcq[q.q_num] || '';
            const chosenOpt = (q.options || []).find(o => o.letter === chosen);
            const blankDisplay = chosenOpt ? `[${chosen}] ${chosenOpt.word}` : '______';
            const sentenceHtml = escapeHtml(q.sentence).replace(
                '______',
                `<span class="s2-blank-slot ${chosen ? 'filled' : ''}" id="s3-slot-${q.q_num}">${escapeHtml(blankDisplay)}</span>`
            );

            return `
                <div class="s3-q-card" id="s3-card-${q.q_num}">
                    <div class="s3-q-sentence">${q.q_num}. ${sentenceHtml}</div>
                    <div class="s3-q-trans hidden" id="s3-trans-${q.q_num}">
                        🇻🇳 Nghĩa: ${escapeHtml(q.translation || '')} — <strong>Đáp án đúng: ${q.answer}</strong> (${escapeHtml(q.explanation || '')})
                    </div>
                    <div class="s3-options-grid">
                        ${(q.options || []).map(o => `
                            <button class="s3-opt-btn ${chosen === o.letter ? 'selected' : ''}"
                                    data-s3-q="${q.q_num}"
                                    data-s3-letter="${o.letter}"
                                    data-s3-word="${escapeAttr(o.word)}">
                                <span class="s3-opt-letter">${o.letter}</span>
                                <div>
                                    <div class="s3-opt-word">${escapeHtml(o.word)}</div>
                                    <div class="s3-opt-py">${escapeHtml(o.pinyin)}</div>
                                </div>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="ex-head">
                <div class="ex-title">${escapeHtml(sec3.title)}</div>
                <span class="au-pinyin">5 câu × 1 điểm = 5 điểm</span>
            </div>
            <div class="ex-body">
                <div class="s3-list">${questionsHtml}</div>
            </div>
        `;

        container.querySelectorAll('[data-s3-q]').forEach(btn => {
            btn.addEventListener('click', () => {
                const qNum = btn.getAttribute('data-s3-q');
                const letter = btn.getAttribute('data-s3-letter');
                const word = btn.getAttribute('data-s3-word');

                state.userAnswers.sec3Mcq[qNum] = letter;

                const slot = document.getElementById(`s3-slot-${qNum}`);
                if (slot) {
                    slot.textContent = `[${letter}] ${word}`;
                    slot.classList.add('filled');
                    slot.classList.remove('correct', 'wrong');
                }

                const card = document.getElementById(`s3-card-${qNum}`);
                if (card) {
                    card.querySelectorAll('.s3-opt-btn').forEach(b => {
                        b.classList.remove('selected', 'correct-ans', 'wrong-ans');
                    });
                }
                btn.classList.add('selected');
            });
        });
    }

    function checkPracticeAnswers() {
        const unitData = getCurrentUnitData();
        if (!unitData || !unitData.exercises) return;

        const ex = unitData.exercises;
        let score = 0;
        let total = 0;

        if (ex.section1 && ex.section1.questions) {
            ex.section1.questions.forEach(q => {
                total += 2;
                const userPy = state.userAnswers.sec1Pinyin[q.q_num] || '';
                const userMn = state.userAnswers.sec1Meaning[q.q_num] || '';

                const pySelect = document.querySelector(`[data-s1-py="${q.q_num}"]`);
                const mnSelect = document.querySelector(`[data-s1-mn="${q.q_num}"]`);
                const fbEl     = document.getElementById(`s1-fb-${q.q_num}`);

                const pyOk = userPy === q.answer_pinyin;
                const mnOk = userMn === q.answer_meaning;

                if (pyOk) score += 1;
                if (mnOk) score += 1;

                if (pySelect) {
                    pySelect.classList.remove('correct', 'wrong');
                    pySelect.classList.add(pyOk ? 'correct' : 'wrong');
                }
                if (mnSelect) {
                    mnSelect.classList.remove('correct', 'wrong');
                    mnSelect.classList.add(mnOk ? 'correct' : 'wrong');
                }
                if (fbEl) {
                    fbEl.classList.remove('hidden', 'ok', 'err');
                    if (pyOk && mnOk) {
                        fbEl.classList.add('ok');
                        fbEl.textContent = `✓ Đúng (${q.answer_pinyin} - ${q.answer_meaning})`;
                    } else {
                        fbEl.classList.add('err');
                        fbEl.textContent = `Đáp án: ${q.answer_pinyin} - ${q.answer_meaning}`;
                    }
                }
                if (!pyOk || !mnOk) {
                    const targetWord = (unitData.target_words || []).find(w => w.num === q.word_num);
                    if (targetWord) addToSrs(targetWord.id, 1);
                }
            });
        }

        if (ex.section2 && ex.section2.groups) {
            ex.section2.groups.forEach(grp => {
                (grp.questions || []).forEach(q => {
                    total += 1;
                    const key = `g${grp.group_num}_q${q.q_num}`;
                    const userChoice = state.userAnswers.sec2Cloze[key] || '';
                    const isOk = userChoice === q.answer;
                    if (isOk) {
                        score += 1;
                    } else {
                        const targetWord = (unitData.target_words || []).find(w => w.word === q.target_word);
                        if (targetWord) addToSrs(targetWord.id, 1);
                    }

                    const slot = document.getElementById(`s2-slot-${key}`);
                    const hint = document.getElementById(`s2-hint-${key}`);
                    const item = document.getElementById(`s2-item-${key}`);

                    if (slot) {
                        slot.classList.remove('correct', 'wrong');
                        slot.classList.add(isOk ? 'correct' : 'wrong');
                        if (!isOk) {
                            slot.textContent = `${userChoice ? `[${userChoice}] ✗ → ` : ''}[${q.answer}] ${q.target_word}`;
                        }
                    }
                    if (hint) hint.classList.remove('hidden');

                    if (item) {
                        item.querySelectorAll('.s2-choice-pill').forEach(pill => {
                            const pLetter = pill.getAttribute('data-s2-letter');
                            pill.classList.remove('correct-ans', 'wrong-ans');
                            if (pLetter === q.answer) {
                                pill.classList.add('correct-ans');
                            } else if (pLetter === userChoice && !isOk) {
                                pill.classList.add('wrong-ans');
                            }
                        });
                    }
                });
            });
        }

        if (ex.section3 && ex.section3.questions) {
            ex.section3.questions.forEach(q => {
                total += 1;
                const userChoice = state.userAnswers.sec3Mcq[q.q_num] || '';
                const isOk = userChoice === q.answer;
                if (isOk) {
                    score += 1;
                } else {
                    const targetWord = (unitData.target_words || []).find(w => w.word === q.target_word);
                    if (targetWord) addToSrs(targetWord.id, 1);
                }

                const slot  = document.getElementById(`s3-slot-${q.q_num}`);
                const trans = document.getElementById(`s3-trans-${q.q_num}`);
                const card  = document.getElementById(`s3-card-${q.q_num}`);

                if (slot) {
                    slot.classList.remove('correct', 'wrong');
                    slot.classList.add(isOk ? 'correct' : 'wrong');
                }
                if (trans) trans.classList.remove('hidden');

                if (card) {
                    card.querySelectorAll('.s3-opt-btn').forEach(btn => {
                        const bLetter = btn.getAttribute('data-s3-letter');
                        btn.classList.remove('correct-ans', 'wrong-ans');
                        if (bLetter === q.answer) {
                            btn.classList.add('correct-ans');
                        } else if (bLetter === userChoice && !isOk) {
                            btn.classList.add('wrong-ans');
                        }
                    });
                }
            });
        }

        const scoreBadge = document.getElementById('practiceScoreBadge');
        const scoreBadgeBottom = document.getElementById('practiceScoreBadgeBottom');
        const pct = total > 0 ? Math.round((score / total) * 100) : 0;
        const scoreText = `🎯 Điểm: ${score} / ${total} (${pct}%)`;

        if (scoreBadge) {
            scoreBadge.textContent = scoreText;
            scoreBadge.classList.remove('hidden');
        }
        if (scoreBadgeBottom) {
            scoreBadgeBottom.textContent = scoreText;
            scoreBadgeBottom.classList.remove('hidden');
        }

        const unitKey = `${state.activeBookId}_${state.activeUnitNum}`;
        state.practiceScores[unitKey] = { score, total };
        if (pct >= 80) {
            state.doneUnits[unitKey] = true;
            updateUnitActionButtons();
        }

        if (score > 0) {
            awardXp(score * 2, 'Luyện tập bài tập');
            playSoundEffect(pct >= 80 ? 'badge' : 'correct');
        } else {
            playSoundEffect('wrong');
        }
        if (pct === 100) {
            unlockBadge('b_unit_master');
        }

        saveProgress();
        updateSrsHeaderBadge();

        const meta = getBookIndexMeta(state.activeBookId);
        if (meta) {
            renderSidebarSummary(meta);
            renderUnitList(meta);
            renderBookShelf();
        }
    }

    function fillPracticeModelAnswers() {
        const unitData = getCurrentUnitData();
        if (!unitData || !unitData.exercises) return;
        const ex = unitData.exercises;

        if (ex.section1 && ex.section1.questions) {
            ex.section1.questions.forEach(q => {
                state.userAnswers.sec1Pinyin[q.q_num] = q.answer_pinyin;
                state.userAnswers.sec1Meaning[q.q_num] = q.answer_meaning;
            });
        }
        if (ex.section2 && ex.section2.groups) {
            ex.section2.groups.forEach(grp => {
                (grp.questions || []).forEach(q => {
                    state.userAnswers.sec2Cloze[`g${grp.group_num}_q${q.q_num}`] = q.answer;
                });
            });
        }
        if (ex.section3 && ex.section3.questions) {
            ex.section3.questions.forEach(q => {
                state.userAnswers.sec3Mcq[q.q_num] = q.answer;
            });
        }

        renderPracticePane(unitData);
        checkPracticeAnswers();
    }

    function resetPracticeAnswers() {
        state.userAnswers = {
            sec1Pinyin: {},
            sec1Meaning: {},
            sec2Cloze: {},
            sec3Mcq: {}
        };
        const unitData = getCurrentUnitData();
        if (unitData) renderPracticePane(unitData);
    }

    // ==================== MODE 3: FLASHCARD 3D & REFLEX QUIZ (UPGRADED) ====================
    function getWordsForScope(scope) {
        const bookData = getLoadedBookData(state.activeBookId);
        const unitData = getCurrentUnitData();
        if (!bookData) return [];

        if (scope === 'srs') {
            const allWords = [];
            (bookData.units || []).forEach(u => {
                (u.target_words || []).forEach(w => {
                    if (state.srsData && state.srsData[w.id]) allWords.push(w);
                });
            });
            return allWords.length ? allWords : (unitData ? unitData.target_words : []);
        }

        if (scope === 'starred') {
            const allWords = [];
            (bookData.units || []).forEach(u => {
                (u.target_words || []).forEach(w => {
                    if (state.starredWords[w.id]) allWords.push(w);
                });
            });
            return allWords.length ? allWords : (unitData ? unitData.target_words : []);
        }

        if (scope === 'book') {
            const allWords = [];
            (bookData.units || []).forEach(u => {
                (u.target_words || []).forEach(w => allWords.push(w));
            });
            return allWords;
        }

        return (unitData && unitData.target_words) ? [...unitData.target_words] : [];
    }

    function initFlashcardDeck() {
        state.fcDeck = getWordsForScope(state.fcScope);
        state.fcIndex = 0;
        state.fcFlipped = false;
        renderFlashcard();
    }

    function renderFlashcard() {
        const cardEl = document.getElementById('fcCard3d');
        if (!cardEl) return;
        cardEl.classList.toggle('flipped', state.fcFlipped);

        if (!state.fcDeck.length) {
            const frontHz = document.getElementById('fcFrontHanzi');
            if (frontHz) frontHz.textContent = 'Trống';
            return;
        }

        const w = state.fcDeck[state.fcIndex] || state.fcDeck[0];

        // Header info
        const deckBadge = document.getElementById('fcDeckBadge');
        const srsBoxBadge = document.getElementById('fcSrsBoxBadge');
        const numBadge = document.getElementById('fcWordNumBadge');
        const progBar = document.getElementById('fcDeckProgressBar');
        const counterEl = document.getElementById('fcCounter');

        if (deckBadge) {
            const scopeLabels = { unit: `Bài ${state.activeUnitNum}`, srs: '🧠 Hộp SRS', starred: '⭐ Đã lưu', book: 'Toàn quyển' };
            deckBadge.textContent = scopeLabels[state.fcScope] || `Bài ${state.activeUnitNum}`;
        }

        if (srsBoxBadge) {
            const srsInfo = state.srsData && state.srsData[w.id];
            if (srsInfo) {
                srsBoxBadge.textContent = `Hộp SRS ${srsInfo.box || 1}`;
                srsBoxBadge.classList.remove('hidden');
            } else {
                srsBoxBadge.classList.add('hidden');
            }
        }

        if (numBadge) numBadge.textContent = `#${w.num}`;
        if (counterEl) counterEl.textContent = `${state.fcIndex + 1} / ${state.fcDeck.length}`;

        if (progBar) {
            const pct = Math.round(((state.fcIndex + 1) / state.fcDeck.length) * 100);
            progBar.style.width = `${pct}%`;
        }

        // Front Face Display according to fcFaceMode
        const frontHz = document.getElementById('fcFrontHanzi');
        const frontSub = document.getElementById('fcFrontSub');
        const frontPos = document.getElementById('fcFrontPos');

        if (state.fcFaceMode === 'vi') {
            if (frontHz) {
                frontHz.textContent = w.meaning_vi || w.meaning_primary || '';
                frontHz.style.fontSize = '1.75rem';
            }
            if (frontSub) frontSub.textContent = `[${w.pos_full || w.pos || 'Từ vựng'}]`;
            if (frontPos) frontPos.textContent = 'Nhấn vào thẻ (hoặc Space) để xem Chữ Hán & Pinyin';
        } else if (state.fcFaceMode === 'audio') {
            if (frontHz) {
                frontHz.textContent = '🔊';
                frontHz.style.fontSize = '3.5rem';
            }
            if (frontSub) frontSub.textContent = 'Lắng nghe & Đoán từ vựng';
            if (frontPos) frontPos.textContent = `[${w.pos_full || w.pos || 'Từ vựng'}] Nhấn thẻ để xem chữ`;
            if (state.fcAutoSpeak && !state.fcFlipped) {
                speakChinese(cleanHanziForTts(w.word));
            }
        } else {
            // Default 'hz'
            if (frontHz) {
                frontHz.textContent = w.word;
                frontHz.style.fontSize = '3.1rem';
            }
            if (frontSub) frontSub.textContent = '';
            if (frontPos) frontPos.textContent = w.pos_full || w.pos || 'Từ vựng';
        }

        // Back Face Display
        const backHz = document.getElementById('fcBackHanzi');
        const backPy = document.getElementById('fcBackPinyin');
        const backMn = document.getElementById('fcBackMeaning');
        const backEx = document.getElementById('fcBackExample');

        if (backHz) backHz.textContent = w.word;
        if (backPy) backPy.textContent = w.pinyin;
        if (backMn) backMn.textContent = w.meaning_vi || w.meaning_primary || w.meaning_en;

        if (backEx) {
            const ex = (w.examples && w.examples[0]) ? w.examples[0] : null;
            backEx.innerHTML = ex
                ? `<div><strong>${escapeHtml(ex.hz)}</strong></div>
                   <div style="font-size:0.82rem;opacity:0.85">${escapeHtml(ex.py || '')}</div>
                   <div style="font-size:0.84rem;margin-top:2px">${escapeHtml(ex.vn || '')}</div>`
                : `<div>Cấp độ ${state.activeBookId.toUpperCase()}</div>`;
        }

        // Auto speak on flip
        if (state.fcFlipped && state.fcAutoSpeak && state.fcFaceMode !== 'audio') {
            speakChinese(cleanHanziForTts(w.word));
        }
    }

    function advanceFlashcard(delta = 1) {
        if (!state.fcDeck.length) return;
        state.fcIndex = (state.fcIndex + delta + state.fcDeck.length) % state.fcDeck.length;
        state.fcFlipped = false;
        renderFlashcard();
    }

    function handleFlashcardRate(rating) {
        if (!state.fcDeck.length) return;
        const w = state.fcDeck[state.fcIndex];
        if (!w) return;

        rateSrsWord(w.id, rating);
        state.gamify.stats.flashcardsFlipped = (state.gamify.stats.flashcardsFlipped || 0) + 1;
        checkBadgeUnlocks();
        saveProgress();

        playSoundEffect(rating === 1 ? 'wrong' : 'correct');
        advanceFlashcard(1);
    }

    // ==================== ENHANCED REFLEX QUIZ ====================
    function initReflexQuiz() {
        state.quizCorrect = 0;
        state.quizTotal = 0;
        state.quizStreak = 0;
        updateQuizScoreUI();
        updateQuizStreakUI();
        nextReflexQuizQuestion();
    }

    function updateQuizScoreUI() {
        const sEl = document.getElementById('quizScore');
        const tEl = document.getElementById('quizTotal');
        const rEl = document.getElementById('quizAccRate');
        if (sEl) sEl.textContent = state.quizCorrect;
        if (tEl) tEl.textContent = state.quizTotal;
        if (rEl) {
            const pct = state.quizTotal > 0 ? Math.round((state.quizCorrect / state.quizTotal) * 100) : 0;
            rEl.textContent = `(${pct}%)`;
        }
    }

    function updateQuizStreakUI() {
        const badge = document.getElementById('quizStreakBadge');
        const count = document.getElementById('quizStreakCount');
        if (!badge || !count) return;

        count.textContent = state.quizStreak;
        if (state.quizStreak >= 3) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    function startQuizTimer() {
        if (state.quizTimerId) {
            clearInterval(state.quizTimerId);
            state.quizTimerId = null;
        }

        const timerWrap = document.getElementById('quizTimerWrap');
        const timerFill = document.getElementById('quizTimerFill');
        if (!timerWrap || !timerFill) return;

        if (!state.quizTimerEnabled) {
            timerWrap.classList.add('hidden');
            return;
        }
        timerWrap.classList.remove('hidden');

        const totalMs = 10000;
        const intervalMs = 100;
        let remaining = totalMs;
        timerFill.style.width = '100%';

        state.quizTimerId = setInterval(() => {
            if (state.quizAnswered) {
                clearInterval(state.quizTimerId);
                state.quizTimerId = null;
                return;
            }

            remaining -= intervalMs;
            const pct = Math.max(0, (remaining / totalMs) * 100);
            timerFill.style.width = `${pct}%`;

            if (remaining <= 0) {
                clearInterval(state.quizTimerId);
                state.quizTimerId = null;
                handleQuizTimeout();
            }
        }, intervalMs);
    }

    function handleQuizTimeout() {
        if (state.quizAnswered) return;
        state.quizAnswered = true;
        state.quizTotal += 1;
        state.quizStreak = 0;
        updateQuizStreakUI();

        playSoundEffect('wrong');

        const target = state.quizCurrentQ.target;
        addToSrs(target.id, 1);
        showToast('⏱️ Hết giờ!', `Đáp án đúng là: “${target.word}” (${target.meaning_vi || target.meaning_primary})`, '⏰');

        const optsEl = document.getElementById('quizOptions');
        if (optsEl) {
            optsEl.querySelectorAll('.quiz-opt-btn').forEach(b => {
                if (b.getAttribute('data-quiz-id') === target.id) {
                    b.classList.add('correct');
                }
            });
        }
        updateQuizScoreUI();
    }

    function nextReflexQuizQuestion() {
        if (state.quizTimerId) {
            clearInterval(state.quizTimerId);
            state.quizTimerId = null;
        }

        const pool = state.fcDeck.length >= 4 ? state.fcDeck : getWordsForScope('unit');
        if (!pool.length) return;

        const target = pool[Math.floor(Math.random() * pool.length)];
        const distractors = pool
            .filter(w => w.id !== target.id)
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);

        const options = [target, ...distractors].sort(() => Math.random() - 0.5);
        state.quizCurrentQ = { target, options };
        state.quizAnswered = false;

        const wordEl = document.getElementById('quizPromptWord');
        const pyEl   = document.getElementById('quizPromptPinyin');
        const btnSpk = document.getElementById('btnQuizSpeak');
        const optsEl = document.getElementById('quizOptions');

        const letters = ['A', 'B', 'C', 'D'];

        if (state.quizType === 'vn_to_hz') {
            // Prompt is Vietnamese meaning, options are Hanzi
            if (wordEl) {
                wordEl.textContent = target.meaning_vi || target.meaning_primary;
                wordEl.style.fontSize = '1.75rem';
            }
            if (pyEl) pyEl.textContent = `[${target.pos_full || target.pos || 'Từ vựng'}] Chọn chữ Hán tương ứng:`;
            if (btnSpk) btnSpk.classList.add('hidden');

            if (optsEl) {
                optsEl.innerHTML = options.map((opt, idx) => `
                    <button class="quiz-opt-btn" data-quiz-id="${opt.id}" data-opt-letter="${letters[idx]}">
                        <span class="kbd-key">${letters[idx]}</span>
                        <strong style="font-family:var(--font-cn);font-size:1.5rem;margin-left:4px;">${escapeHtml(opt.word)}</strong>
                        <span style="color:var(--accent-sky);font-size:0.84rem;margin-left:6px;">(${escapeHtml(opt.pinyin)})</span>
                    </button>
                `).join('');
            }
        } else if (state.quizType === 'audio_to_hz') {
            // Prompt is audio button, options are Hanzi
            if (wordEl) {
                wordEl.textContent = '🎧';
                wordEl.style.fontSize = '3.2rem';
            }
            if (pyEl) pyEl.textContent = 'Lắng nghe phát âm và chọn chữ Hán đúng:';
            if (btnSpk) btnSpk.classList.remove('hidden');

            speakChinese(cleanHanziForTts(target.word));

            if (optsEl) {
                optsEl.innerHTML = options.map((opt, idx) => `
                    <button class="quiz-opt-btn" data-quiz-id="${opt.id}" data-opt-letter="${letters[idx]}">
                        <span class="kbd-key">${letters[idx]}</span>
                        <strong style="font-family:var(--font-cn);font-size:1.5rem;margin-left:4px;">${escapeHtml(opt.word)}</strong>
                        <span style="color:var(--text-muted);font-size:0.82rem;margin-left:6px;">— ${escapeHtml(opt.meaning_vi || opt.meaning_primary)}</span>
                    </button>
                `).join('');
            }
        } else {
            // Default 'hz_to_vn'
            if (wordEl) {
                wordEl.textContent = target.word;
                wordEl.style.fontSize = '2.3rem';
            }
            if (pyEl) pyEl.textContent = `${target.pinyin} · ${target.pos_full || target.pos || ''}`;
            if (btnSpk) btnSpk.classList.remove('hidden');

            if (optsEl) {
                optsEl.innerHTML = options.map((opt, idx) => `
                    <button class="quiz-opt-btn" data-quiz-id="${opt.id}" data-opt-letter="${letters[idx]}">
                        <span class="kbd-key">${letters[idx]}</span>
                        <span style="margin-left:4px;">${escapeHtml(opt.meaning_vi || opt.meaning_primary || opt.meaning_en)}</span>
                    </button>
                `).join('');
            }
        }

        bindQuizOptionEvents();
        startQuizTimer();
    }

    function bindQuizOptionEvents() {
        const optsEl = document.getElementById('quizOptions');
        if (!optsEl || !state.quizCurrentQ) return;
        const target = state.quizCurrentQ.target;

        optsEl.querySelectorAll('.quiz-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (state.quizAnswered) return;
                state.quizAnswered = true;
                state.quizTotal += 1;

                if (state.quizTimerId) {
                    clearInterval(state.quizTimerId);
                    state.quizTimerId = null;
                }

                const pickedId = btn.getAttribute('data-quiz-id');
                const isCorrect = pickedId === target.id;

                if (isCorrect) {
                    state.quizCorrect += 1;
                    state.quizStreak += 1;
                    btn.classList.add('correct');
                    playSoundEffect('correct');
                    speakChinese(cleanHanziForTts(target.word));

                    state.gamify.stats.quizzesCompleted = (state.gamify.stats.quizzesCompleted || 0) + 1;
                    state.gamify.stats.quizStreakBest = Math.max(state.gamify.stats.quizStreakBest || 0, state.quizStreak);

                    const streakBonus = Math.min(20, state.quizStreak * 2);
                    awardXp(10 + streakBonus, 'Trả lời Quiz đúng');

                    if (state.srsData && state.srsData[target.id]) {
                        rateSrsWord(target.id, 3);
                    }
                } else {
                    state.quizStreak = 0;
                    btn.classList.add('wrong');
                    playSoundEffect('wrong');

                    optsEl.querySelectorAll('.quiz-opt-btn').forEach(b => {
                        if (b.getAttribute('data-quiz-id') === target.id) {
                            b.classList.add('correct');
                        }
                    });

                    addToSrs(target.id, 1);
                    showToast('Đã đưa vào Hộp từ khó', `Từ “${target.word}” đã được thêm vào SRS để bạn ôn lại!`, '🧠');
                }

                updateQuizScoreUI();
                updateQuizStreakUI();
            });
        });
    }

    // ==================== STUDY MODE SWITCHER ====================
    function switchStudyMode(mode) {
        state.studyMode = mode;
        document.querySelectorAll('.sm-tab').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-smode') === mode);
        });
        document.querySelectorAll('.smode-pane').forEach(pane => {
            pane.classList.remove('active');
        });

        const map = {
            memory: 'paneMemory',
            practice: 'panePractice',
            flashcard: 'paneFlashcard',
            quiz: 'paneQuiz',
            shadowing: 'paneShadowing'
        };
        const targetPane = document.getElementById(map[mode]);
        if (targetPane) targetPane.classList.add('active');

        if (mode === 'flashcard') {
            initFlashcardDeck();
        } else if (mode === 'quiz') {
            initReflexQuiz();
        } else if (mode === 'shadowing') {
            initShadowingStudio();
        }

        const stage = document.getElementById('unitStageScroll');
        if (stage) stage.scrollTop = 0;
    }

    // ==================== GRAMMAR ABBREVIATIONS MODAL ====================
    function renderGrammarModalTable() {
        const tbody = document.getElementById('grammarTableBody');
        if (!tbody || typeof HSK_GRAMMAR_ABBR === 'undefined') return;

        tbody.innerHTML = HSK_GRAMMAR_ABBR.map(row => `
            <tr>
                <td><code>${escapeHtml(row.abbr)}</code></td>
                <td><strong>${escapeHtml(row.vi)}</strong></td>
                <td style="font-family:var(--font-cn)">${escapeHtml(row.zh)}</td>
            </tr>
        `).join('');
    }

    // ==================== TTS AUDIO (WEB SPEECH API) ====================
    function cleanHanziForTts(wordStr) {
        if (!wordStr) return '';
        return wordStr.split('|')[0].replace(/[0-9()（）]/g, '').trim();
    }

    function speakChinese(text) {
        if (!text || !('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'zh-CN';
            utter.rate = 0.9;
            window.speechSynthesis.speak(utter);
        } catch (e) {
            console.warn('TTS error:', e);
        }
    }

    let speakAllTimerId = null;

    function updateSpeakAllButtonsUI(isActive, labelText) {
        const defaultLabel = '🔊 Đọc cả bài (Từ + Ví dụ)';
        const text = isActive ? (labelText || '⏹️ Dừng đọc') : defaultLabel;
        ['btnSpeakAllWords', 'btnSpeakAllWordsQm'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.toggle('active', isActive);
                btn.textContent = text;
            }
        });

        const topBtn = document.getElementById('btnSpeakAllTop');
        if (topBtn) {
            topBtn.classList.toggle('active', isActive);
            topBtn.innerHTML = isActive
                ? `<span class="tsa-icon">⏹️</span> <span class="tsa-text">${escapeHtml(labelText || 'Dừng đọc')}</span>`
                : `<span class="tsa-icon">🔊</span> <span class="tsa-text">Đọc cả bài</span>`;
        }

        const mobBtn = document.getElementById('mobBtnSpeakAll');
        if (mobBtn) {
            mobBtn.classList.toggle('active', isActive);
            mobBtn.textContent = isActive ? '⏹️ Dừng' : '🔊 Đọc';
        }
    }

    function clearSpeakingHighlights() {
        document.querySelectorAll('.qm-word-card.speaking-card').forEach(el => el.classList.remove('speaking-card'));
        document.querySelectorAll('.qmc-hz.speaking-word-now').forEach(el => el.classList.remove('speaking-word-now'));
        document.querySelectorAll('.qmc-ex-item.speaking-ex-now').forEach(el => el.classList.remove('speaking-ex-now'));
    }

    function startSpeakingWordsWithExamples(wordsList) {
        if (!wordsList || !wordsList.length) return;
        if (!('speechSynthesis' in window)) return;

        stopSpeakingAll();
        state.speakingAll = true;

        // Build playback queue: Word -> Example 1 -> Example 2 -> Next Word ...
        const queue = [];
        wordsList.forEach(w => {
            const cleanHz = cleanHanziForTts(w.word);
            if (cleanHz) {
                queue.push({
                    type: 'word',
                    word: w,
                    text: cleanHz,
                    exIdx: -1,
                    statusLabel: `⏹️ Dừng (#${w.num} ${w.word})`
                });
            }
            (w.examples || []).forEach((ex, exIdx) => {
                if (ex && ex.hz) {
                    queue.push({
                        type: 'example',
                        word: w,
                        text: ex.hz,
                        exIdx: exIdx,
                        statusLabel: `⏹️ Dừng (#${w.num} ${w.word} · Ví dụ ${exIdx + 1})`
                    });
                }
            });
        });

        if (!queue.length) {
            stopSpeakingAll();
            return;
        }

        let qIdx = 0;

        function speakNextStep() {
            if (!state.speakingAll || qIdx >= queue.length) {
                stopSpeakingAll();
                return;
            }

            const item = queue[qIdx++];
            const w = item.word;

            clearSpeakingHighlights();
            updateSpeakAllButtonsUI(true, item.statusLabel);

            // Highlight target word chip in top box
            document.querySelectorAll('.tw-chip').forEach(chip => {
                const cNum = parseInt(chip.getAttribute('data-word-num'), 10);
                chip.classList.toggle('active', cNum === w.num);
            });

            // Highlight and scroll to the word card in Quick Memory
            const card = document.getElementById(`qm-word-${w.num}`);
            if (card) {
                card.classList.add('speaking-card');
                if (item.type === 'word') {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const hzEl = card.querySelector('.qmc-hz');
                    if (hzEl) hzEl.classList.add('speaking-word-now');
                } else if (item.type === 'example') {
                    const exEl = document.getElementById(`qm-word-${w.num}-ex-${item.exIdx}`);
                    if (exEl) {
                        exEl.classList.add('speaking-ex-now');
                        exEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
            }

            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(item.text);
            utter.lang = 'zh-CN';
            utter.rate = item.type === 'word' ? 0.86 : 0.9;

            utter.onend = () => {
                if (!state.speakingAll) return;
                const pauseMs = item.type === 'word' ? 420 : 650;
                speakAllTimerId = setTimeout(speakNextStep, pauseMs);
            };

            utter.onerror = () => {
                if (!state.speakingAll) return;
                speakAllTimerId = setTimeout(speakNextStep, 300);
            };

            window.speechSynthesis.speak(utter);
        }

        speakNextStep();
    }

    function toggleSpeakAllWords() {
        if (state.speakingAll) {
            stopSpeakingAll();
            return;
        }
        const unitData = getCurrentUnitData();
        if (!unitData || !unitData.target_words || !unitData.target_words.length) return;

        const wordsToSpeak = state.onlyStarredWords
            ? unitData.target_words.filter(w => !!state.starredWords[w.id])
            : unitData.target_words;

        if (!wordsToSpeak.length) return;
        startSpeakingWordsWithExamples(wordsToSpeak);
    }

    function stopSpeakingAll() {
        state.speakingAll = false;
        if (speakAllTimerId) {
            clearTimeout(speakAllTimerId);
            speakAllTimerId = null;
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        clearSpeakingHighlights();
        updateSpeakAllButtonsUI(false);
    }

    // ==================== EVENT BINDINGS ====================
    function goPrevUnit() {
        const meta = getBookIndexMeta(state.activeBookId);
        if (!meta || !meta.units_index) return;
        const idx = meta.units_index.findIndex(u => getUnitNum(u) === state.activeUnitNum);
        if (idx > 0) selectUnit(getUnitNum(meta.units_index[idx - 1]));
    }

    function goNextUnit() {
        const meta = getBookIndexMeta(state.activeBookId);
        if (!meta || !meta.units_index) return;
        const idx = meta.units_index.findIndex(u => getUnitNum(u) === state.activeUnitNum);
        if (idx >= 0 && idx < meta.units_index.length - 1) {
            selectUnit(getUnitNum(meta.units_index[idx + 1]));
        }
    }

    function toggleCurrentUnitDone() {
        const key = `${state.activeBookId}_${state.activeUnitNum}`;
        if (state.doneUnits[key]) delete state.doneUnits[key];
        else state.doneUnits[key] = true;
        saveProgress();
        updateUnitActionButtons();
        const meta = getBookIndexMeta(state.activeBookId);
        if (meta) {
            renderSidebarSummary(meta);
            renderUnitList(meta);
            renderBookShelf();
        }
    }

    function bindEvents() {
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

        // Sidebar toggle & mobile drawer controls
        const sidebarBtn   = document.getElementById('toggleSidebarBtn');
        const closeSideBtn = document.getElementById('closeSidebarBtn');
        const backdropEl   = document.getElementById('sidebarBackdrop');
        const titleArea    = document.getElementById('activeUnitTitleArea');
        const mobOpenBtn   = document.getElementById('mobOpenUnitDrawer');

        if (sidebarBtn)   sidebarBtn.addEventListener('click', toggleSidebar);
        if (closeSideBtn) closeSideBtn.addEventListener('click', closeMobileSidebar);
        if (backdropEl)   backdropEl.addEventListener('click', closeMobileSidebar);
        if (mobOpenBtn)   mobOpenBtn.addEventListener('click', openMobileSidebar);
        if (titleArea) {
            titleArea.addEventListener('click', () => {
                if (isMobileOrTabletViewport()) openMobileSidebar();
            });
        }

        // Collapse / Expand Target Words Grid
        const btnCollapseGrid = document.getElementById('btnCollapseTargetGrid');
        const targetGridEl    = document.getElementById('targetWordsGrid');
        const targetHeaderEl  = document.querySelector('.twb-header');
        if (btnCollapseGrid && targetGridEl) {
            btnCollapseGrid.addEventListener('click', () => {
                state.targetGridCollapsed = !state.targetGridCollapsed;
                targetGridEl.classList.toggle('hidden', state.targetGridCollapsed);
                if (targetHeaderEl) {
                    targetHeaderEl.classList.toggle('collapsed-head', state.targetGridCollapsed);
                }
                btnCollapseGrid.textContent = state.targetGridCollapsed ? '🔽 Mở bảng từ' : '🔼 Thu gọn';
            });
        }

        document.querySelectorAll('.sm-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.getAttribute('data-smode');
                if (mode) switchStudyMode(mode);
            });
        });

        document.querySelectorAll('.uf-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.uf-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                state.unitFilter = pill.getAttribute('data-filter') || 'all';
                const meta = getBookIndexMeta(state.activeBookId);
                if (meta) renderUnitList(meta);
            });
        });

        const unitSearch = document.getElementById('unitSearchInput');
        if (unitSearch) {
            unitSearch.addEventListener('input', () => {
                state.unitSearchQuery = unitSearch.value;
                const meta = getBookIndexMeta(state.activeBookId);
                if (meta) renderUnitList(meta);
            });
        }

        const globalSearch = document.getElementById('globalWordSearch');
        const clearGlobal  = document.getElementById('clearGlobalSearch');
        if (globalSearch) {
            globalSearch.addEventListener('input', () => {
                state.globalSearchQuery = globalSearch.value;
                if (clearGlobal) {
                    clearGlobal.classList.toggle('hidden', !state.globalSearchQuery);
                }
                if (state.studyMode !== 'memory') {
                    switchStudyMode('memory');
                }
                const unitData = getCurrentUnitData();
                if (unitData) renderMemoryPane(unitData);
            });
        }
        if (clearGlobal && globalSearch) {
            clearGlobal.addEventListener('click', () => {
                globalSearch.value = '';
                state.globalSearchQuery = '';
                clearGlobal.classList.add('hidden');
                const unitData = getCurrentUnitData();
                if (unitData) renderMemoryPane(unitData);
            });
        }

        // Unit Done, Star & Prev/Next (Desktop + Mobile Sticky Bar)
        const btnDone = document.getElementById('btnToggleUnitDone');
        const mobDone = document.getElementById('mobToggleDone');
        if (btnDone) btnDone.addEventListener('click', toggleCurrentUnitDone);
        if (mobDone) mobDone.addEventListener('click', toggleCurrentUnitDone);

        const btnStar = document.getElementById('btnToggleUnitStar');
        if (btnStar) {
            btnStar.addEventListener('click', () => {
                const key = `${state.activeBookId}_${state.activeUnitNum}`;
                if (state.starredUnits[key]) delete state.starredUnits[key];
                else state.starredUnits[key] = true;
                saveProgress();
                updateUnitActionButtons();
                const meta = getBookIndexMeta(state.activeBookId);
                if (meta) renderUnitList(meta);
            });
        }

        const btnPrevUnit = document.getElementById('btnPrevUnit');
        const btnNextUnit = document.getElementById('btnNextUnit');
        const mobPrevUnit = document.getElementById('mobPrevUnit');
        const mobNextUnit = document.getElementById('mobNextUnit');
        if (btnPrevUnit) btnPrevUnit.addEventListener('click', goPrevUnit);
        if (btnNextUnit) btnNextUnit.addEventListener('click', goNextUnit);
        if (mobPrevUnit) mobPrevUnit.addEventListener('click', goPrevUnit);
        if (mobNextUnit) mobNextUnit.addEventListener('click', goNextUnit);

        // Bottom CTAs in Memory Mode
        const btnGoPrac = document.getElementById('btnGoToPracticeBottom');
        const btnGoFc   = document.getElementById('btnGoToFlashcardBottom');
        if (btnGoPrac) btnGoPrac.addEventListener('click', () => switchStudyMode('practice'));
        if (btnGoFc)   btnGoFc.addEventListener('click', () => switchStudyMode('flashcard'));

        // Speak All Words in Unit controls (Header, Quick Memory, Sticky Top & Mobile Bottom)
        const btnSpeakAll    = document.getElementById('btnSpeakAllWords');
        const btnSpeakAllQm  = document.getElementById('btnSpeakAllWordsQm');
        const btnSpeakAllTop = document.getElementById('btnSpeakAllTop');
        const mobBtnSpeakAll = document.getElementById('mobBtnSpeakAll');
        if (btnSpeakAll)    btnSpeakAll.addEventListener('click', toggleSpeakAllWords);
        if (btnSpeakAllQm)  btnSpeakAllQm.addEventListener('click', toggleSpeakAllWords);
        if (btnSpeakAllTop) btnSpeakAllTop.addEventListener('click', toggleSpeakAllWords);
        if (mobBtnSpeakAll) mobBtnSpeakAll.addEventListener('click', toggleSpeakAllWords);

        const btnTogglePy = document.getElementById('btnTogglePinyin');
        if (btnTogglePy) {
            btnTogglePy.addEventListener('click', () => {
                state.showPinyin = !state.showPinyin;
                btnTogglePy.classList.toggle('active', state.showPinyin);
                document.querySelectorAll('.qmc-ex-py').forEach(el => {
                    el.classList.toggle('hidden', !state.showPinyin);
                });
            });
        }

        const btnToggleMn = document.getElementById('btnToggleMeaning');
        if (btnToggleMn) {
            btnToggleMn.addEventListener('click', () => {
                state.showMeaning = !state.showMeaning;
                btnToggleMn.classList.toggle('active', state.showMeaning);
                document.querySelectorAll('.qmc-ex-vn').forEach(el => {
                    el.classList.toggle('hidden', !state.showMeaning);
                });
            });
        }

        const btnStarFilter = document.getElementById('btnFilterStarredWords');
        if (btnStarFilter) {
            btnStarFilter.addEventListener('click', () => {
                state.onlyStarredWords = !state.onlyStarredWords;
                btnStarFilter.classList.toggle('active', state.onlyStarredWords);
                const unitData = getCurrentUnitData();
                if (unitData) renderMemoryPane(unitData);
            });
        }

        // Mode 2 Practice buttons (Top & Bottom bars)
        const btnCheck       = document.getElementById('btnCheckPractice');
        const btnShow        = document.getElementById('btnShowPracticeAnswers');
        const btnReset       = document.getElementById('btnResetPractice');
        const btnCheckBottom = document.getElementById('btnCheckPracticeBottom');
        const btnShowBottom  = document.getElementById('btnShowPracticeAnswersBottom');
        const btnResetBottom = document.getElementById('btnResetPracticeBottom');

        if (btnCheck)       btnCheck.addEventListener('click', checkPracticeAnswers);
        if (btnShow)        btnShow.addEventListener('click', fillPracticeModelAnswers);
        if (btnReset)       btnReset.addEventListener('click', resetPracticeAnswers);
        if (btnCheckBottom) btnCheckBottom.addEventListener('click', checkPracticeAnswers);
        if (btnShowBottom)  btnShowBottom.addEventListener('click', fillPracticeModelAnswers);
        if (btnResetBottom) btnResetBottom.addEventListener('click', resetPracticeAnswers);

        // Header Action Widgets (Badges/Streak, SRS, Podcast)
        const btnBadges = document.getElementById('btnBadgesModal');
        const modalBadges = document.getElementById('badgesModal');
        const closeBadges = document.getElementById('btnCloseBadgesModal');
        if (btnBadges && modalBadges) {
            btnBadges.addEventListener('click', () => {
                updateGamifyUI();
                modalBadges.classList.remove('hidden');
            });
        }
        if (closeBadges && modalBadges) {
            closeBadges.addEventListener('click', () => modalBadges.classList.add('hidden'));
        }
        if (modalBadges) {
            modalBadges.addEventListener('click', (e) => {
                if (e.target === modalBadges) modalBadges.classList.add('hidden');
            });
        }

        const btnSrsHeader = document.getElementById('btnSrsQuickReview');
        const modalSrs = document.getElementById('srsModal');
        const closeSrs = document.getElementById('btnCloseSrsModal');
        if (btnSrsHeader && modalSrs) {
            btnSrsHeader.addEventListener('click', () => {
                renderSrsModal();
                modalSrs.classList.remove('hidden');
            });
        }
        if (closeSrs && modalSrs) {
            closeSrs.addEventListener('click', () => modalSrs.classList.add('hidden'));
        }
        if (modalSrs) {
            modalSrs.addEventListener('click', (e) => {
                if (e.target === modalSrs) modalSrs.classList.add('hidden');
            });
        }

        const btnStartSrsFc = document.getElementById('btnStartSrsFlashcard');
        const btnStartSrsQz = document.getElementById('btnStartSrsQuiz');
        const btnClearSrs = document.getElementById('btnClearMasteredSrs');

        if (btnStartSrsFc) {
            btnStartSrsFc.addEventListener('click', () => {
                if (modalSrs) modalSrs.classList.add('hidden');
                switchStudyMode('flashcard');
                state.fcScope = 'srs';
                const fcScopeSel = document.getElementById('fcScopeSelect');
                if (fcScopeSel) fcScopeSel.value = 'srs';
                initFlashcardDeck();
            });
        }
        if (btnStartSrsQz) {
            btnStartSrsQz.addEventListener('click', () => {
                if (modalSrs) modalSrs.classList.add('hidden');
                switchStudyMode('quiz');
                state.fcScope = 'srs';
                const fcScopeSel = document.getElementById('fcScopeSelect');
                if (fcScopeSel) fcScopeSel.value = 'srs';
                initReflexQuiz();
            });
        }
        if (btnClearSrs) {
            btnClearSrs.addEventListener('click', () => {
                let cleared = 0;
                for (const [wid, info] of Object.entries(state.srsData || {})) {
                    if (info.box >= 5) {
                        delete state.srsData[wid];
                        cleared += 1;
                    }
                }
                saveProgress();
                updateSrsHeaderBadge();
                renderSrsModal();
                showToast('Đã dọn dẹp Hộp SRS', `Đã xóa ${cleared} từ đã ghi nhớ thành thạo (Hộp 5).`, '🧹');
            });
        }

        // Hands-free Podcast Player Controls
        const btnTogPod = document.getElementById('btnTogglePodcast');
        if (btnTogPod) {
            btnTogPod.addEventListener('click', () => {
                if (state.podcast.active) closePodcastPlayer();
                else openPodcastPlayer();
            });
        }

        const ppbBtnPlay = document.getElementById('ppbBtnPlay');
        const ppbBtnNext = document.getElementById('ppbBtnNext');
        const ppbBtnPrev = document.getElementById('ppbBtnPrev');
        const ppbSpeedSel = document.getElementById('ppbSpeedSelect');
        const ppbVoiceSel = document.getElementById('ppbVoiceModeSelect');
        const ppbScopeSel = document.getElementById('ppbScopeSelect');
        const ppbBtnLoop  = document.getElementById('ppbBtnLoop');
        const ppbBtnClose = document.getElementById('ppbBtnClose');

        if (ppbBtnPlay) {
            ppbBtnPlay.addEventListener('click', () => {
                if (state.podcast.isPlaying) stopPodcastPlayback();
                else startPodcastPlayback();
            });
        }
        if (ppbBtnNext) ppbBtnNext.addEventListener('click', gotoNextPodcastWord);
        if (ppbBtnPrev) {
            ppbBtnPrev.addEventListener('click', () => {
                if (state.podcast.index > 0) state.podcast.index -= 1;
                else state.podcast.index = state.podcast.list.length - 1;
                state.podcast.step = 'word';
                playPodcastCurrentStep();
            });
        }
        if (ppbSpeedSel) {
            ppbSpeedSel.addEventListener('change', () => {
                state.podcast.speed = parseFloat(ppbSpeedSel.value) || 1.0;
            });
        }
        if (ppbVoiceSel) {
            ppbVoiceSel.addEventListener('change', () => {
                state.podcast.voiceMode = ppbVoiceSel.value;
            });
        }
        if (ppbScopeSel) {
            ppbScopeSel.addEventListener('change', () => {
                state.podcast.scope = ppbScopeSel.value;
                initPodcastPlaylist();
                if (state.podcast.isPlaying) playPodcastCurrentStep();
            });
        }
        if (ppbBtnLoop) {
            ppbBtnLoop.addEventListener('click', () => {
                state.podcast.loop = !state.podcast.loop;
                ppbBtnLoop.classList.toggle('active', state.podcast.loop);
                ppbBtnLoop.title = `Lặp lại danh sách: ${state.podcast.loop ? 'BẬT' : 'TẮT'}`;
            });
        }
        if (ppbBtnClose) ppbBtnClose.addEventListener('click', closePodcastPlayer);

        // Mode 3 Flashcard Controls
        const fcScopeSel = document.getElementById('fcScopeSelect');
        if (fcScopeSel) {
            fcScopeSel.addEventListener('change', () => {
                state.fcScope = fcScopeSel.value;
                initFlashcardDeck();
                initReflexQuiz();
            });
        }

        const fcFaceSel = document.getElementById('fcFaceModeSelect');
        if (fcFaceSel) {
            fcFaceSel.addEventListener('change', () => {
                state.fcFaceMode = fcFaceSel.value;
                renderFlashcard();
            });
        }

        const chkAutoSpk = document.getElementById('chkFcAutoSpeak');
        if (chkAutoSpk) {
            chkAutoSpk.addEventListener('change', () => {
                state.fcAutoSpeak = chkAutoSpk.checked;
            });
        }

        const fcCard = document.getElementById('fcCard3d');
        if (fcCard) {
            fcCard.addEventListener('click', (e) => {
                if (e.target.closest('.fc-audio-btn')) return;
                state.fcFlipped = !state.fcFlipped;
                playSoundEffect('flip');
                renderFlashcard();
            });
        }

        const btnFcRateHard = document.getElementById('btnFcRateHard');
        const btnFcRateMed  = document.getElementById('btnFcRateMed');
        const btnFcRateEasy = document.getElementById('btnFcRateEasy');
        if (btnFcRateHard) btnFcRateHard.addEventListener('click', () => handleFlashcardRate(1));
        if (btnFcRateMed)  btnFcRateMed.addEventListener('click', () => handleFlashcardRate(2));
        if (btnFcRateEasy) btnFcRateEasy.addEventListener('click', () => handleFlashcardRate(3));

        const btnFcSpeakF = document.getElementById('btnFcSpeakFront');
        const btnFcSpeakB = document.getElementById('btnFcSpeakBack');
        const speakFcWord = (e) => {
            e.stopPropagation();
            const w = state.fcDeck[state.fcIndex];
            if (w) speakChinese(cleanHanziForTts(w.word));
        };
        if (btnFcSpeakF) btnFcSpeakF.addEventListener('click', speakFcWord);
        if (btnFcSpeakB) btnFcSpeakB.addEventListener('click', speakFcWord);

        const btnFcPrev = document.getElementById('btnFcPrev');
        const btnFcNext = document.getElementById('btnFcNext');
        const btnFcShuf = document.getElementById('btnFcShuffle');
        if (btnFcPrev) btnFcPrev.addEventListener('click', () => advanceFlashcard(-1));
        if (btnFcNext) btnFcNext.addEventListener('click', () => advanceFlashcard(1));
        if (btnFcShuf) {
            btnFcShuf.addEventListener('click', () => {
                state.fcDeck.sort(() => Math.random() - 0.5);
                state.fcIndex = 0;
                state.fcFlipped = false;
                renderFlashcard();
            });
        }

        // Mode 3 Quiz Controls
        document.querySelectorAll('.qtype-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.qtype-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.quizType = btn.getAttribute('data-qtype') || 'hz_to_vn';
                nextReflexQuizQuestion();
            });
        });

        const btnTogTimer = document.getElementById('btnQuizToggleTimer');
        const lblTimer = document.getElementById('lblQuizTimerStatus');
        if (btnTogTimer) {
            btnTogTimer.addEventListener('click', () => {
                state.quizTimerEnabled = !state.quizTimerEnabled;
                btnTogTimer.classList.toggle('active', state.quizTimerEnabled);
                if (lblTimer) lblTimer.textContent = state.quizTimerEnabled ? 'BẬT' : 'TẮT';
                startQuizTimer();
            });
        }

        const btnTogSnd = document.getElementById('btnQuizToggleSound');
        const lblSnd = document.getElementById('lblQuizSoundStatus');
        if (btnTogSnd) {
            btnTogSnd.addEventListener('click', () => {
                state.quizSoundEnabled = !state.quizSoundEnabled;
                btnTogSnd.classList.toggle('active', state.quizSoundEnabled);
                if (lblSnd) lblSnd.textContent = state.quizSoundEnabled ? 'BẬT' : 'TẮT';
            });
        }

        const btnResetQz = document.getElementById('btnQuizResetScore');
        if (btnResetQz) btnResetQz.addEventListener('click', initReflexQuiz);

        const btnQuizSpeak = document.getElementById('btnQuizSpeak');
        if (btnQuizSpeak) {
            btnQuizSpeak.addEventListener('click', () => {
                if (state.quizCurrentQ && state.quizCurrentQ.target) {
                    speakChinese(cleanHanziForTts(state.quizCurrentQ.target.word));
                }
            });
        }
        const btnNextQuiz = document.getElementById('btnNextQuizQ');
        if (btnNextQuiz) {
            btnNextQuiz.addEventListener('click', nextReflexQuizQuestion);
        }

        // Global Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

            if (state.studyMode === 'flashcard') {
                if (e.code === 'Space') {
                    e.preventDefault();
                    state.fcFlipped = !state.fcFlipped;
                    playSoundEffect('flip');
                    renderFlashcard();
                } else if (e.code === 'ArrowLeft') {
                    e.preventDefault();
                    advanceFlashcard(-1);
                } else if (e.code === 'ArrowRight') {
                    e.preventDefault();
                    advanceFlashcard(1);
                } else if (e.key === '1') {
                    handleFlashcardRate(1);
                } else if (e.key === '2') {
                    handleFlashcardRate(2);
                } else if (e.key === '3') {
                    handleFlashcardRate(3);
                } else if (e.key === 'r' || e.key === 'R') {
                    const w = state.fcDeck[state.fcIndex];
                    if (w) speakChinese(cleanHanziForTts(w.word));
                }
            } else if (state.studyMode === 'quiz') {
                if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
                    const letter = e.key.toUpperCase();
                    const btn = document.querySelector(`.quiz-opt-btn[data-opt-letter="${letter}"]`);
                    if (btn) btn.click();
                } else if (['1', '2', '3', '4'].includes(e.key)) {
                    const idx = parseInt(e.key, 10) - 1;
                    const letter = ['A', 'B', 'C', 'D'][idx];
                    const btn = document.querySelector(`.quiz-opt-btn[data-opt-letter="${letter}"]`);
                    if (btn) btn.click();
                } else if (e.code === 'Enter') {
                    if (state.quizAnswered) nextReflexQuizQuestion();
                } else if (e.key === 'r' || e.key === 'R') {
                    const btnQuizSpeak = document.getElementById('btnQuizSpeak');
                    if (btnQuizSpeak) btnQuizSpeak.click();
                }
            }
        });



        const btnGrammar   = document.getElementById('btnGrammarModal');
        const closeGrammar = document.getElementById('btnCloseGrammarModal');
        const modalGrammar = document.getElementById('grammarModal');
        if (btnGrammar && modalGrammar) {
            btnGrammar.addEventListener('click', () => modalGrammar.classList.remove('hidden'));
        }
        if (closeGrammar && modalGrammar) {
            closeGrammar.addEventListener('click', () => modalGrammar.classList.add('hidden'));
        }
        if (modalGrammar) {
            modalGrammar.addEventListener('click', (e) => {
                if (e.target === modalGrammar) modalGrammar.classList.add('hidden');
            });
        }

        // Voice & Shadowing Studio controls
        const btnShadPrev = document.getElementById('btnShadPrevWord');
        const btnShadNext = document.getElementById('btnShadNextWord');
        const btnShadRandom = document.getElementById('btnShadRandomWord');
        const shadWordSelect = document.getElementById('shadWordSelect');
        const btnShadModeWord = document.getElementById('btnShadModeWord');
        const btnShadModeEx = document.getElementById('btnShadModeEx');
        const btnPlayNative = document.getElementById('btnPlayNativeAudio');
        const btnRepeatNative = document.getElementById('btnRepeatNativeAudio');
        const btnMicToggle = document.getElementById('btnShadMicToggle');
        const btnPlayUser = document.getElementById('btnPlayUserAudio');
        const btnCompare = document.getElementById('btnCompareAudios');
        const btnRetest = document.getElementById('btnShadRetest');

        if (btnShadPrev) {
            btnShadPrev.addEventListener('click', () => {
                const words = getShadowingWords();
                if (!words.length) return;
                state.shadowing.wordIndex = (state.shadowing.wordIndex - 1 + words.length) % words.length;
                state.shadowing.targetType = 'word';
                updateShadowingWordList();
                renderShadowingActiveTarget();
            });
        }

        if (btnShadNext) {
            btnShadNext.addEventListener('click', () => {
                const words = getShadowingWords();
                if (!words.length) return;
                state.shadowing.wordIndex = (state.shadowing.wordIndex + 1) % words.length;
                state.shadowing.targetType = 'word';
                updateShadowingWordList();
                renderShadowingActiveTarget();
            });
        }

        if (btnShadRandom) {
            btnShadRandom.addEventListener('click', () => {
                const words = getShadowingWords();
                if (!words.length) return;
                state.shadowing.wordIndex = Math.floor(Math.random() * words.length);
                state.shadowing.targetType = 'word';
                updateShadowingWordList();
                renderShadowingActiveTarget();
            });
        }

        if (shadWordSelect) {
            shadWordSelect.addEventListener('change', () => {
                state.shadowing.wordIndex = parseInt(shadWordSelect.value, 10) || 0;
                state.shadowing.targetType = 'word';
                renderShadowingActiveTarget();
            });
        }

        if (btnShadModeWord) {
            btnShadModeWord.addEventListener('click', () => {
                state.shadowing.targetType = 'word';
                btnShadModeWord.classList.add('active');
                if (btnShadModeEx) btnShadModeEx.classList.remove('active');
                renderShadowingActiveTarget();
            });
        }

        if (btnShadModeEx) {
            btnShadModeEx.addEventListener('click', () => {
                state.shadowing.targetType = 'ex';
                btnShadModeEx.classList.add('active');
                if (btnShadModeWord) btnShadModeWord.classList.remove('active');
                renderShadowingActiveTarget();
            });
        }

        if (btnPlayNative) btnPlayNative.addEventListener('click', () => playNativeShadowingAudio(1));
        if (btnRepeatNative) btnRepeatNative.addEventListener('click', () => playNativeShadowingAudio(3));
        if (btnMicToggle) btnMicToggle.addEventListener('click', toggleVoiceRecording);
        if (btnPlayUser) btnPlayUser.addEventListener('click', playUserRecordedAudio);
        if (btnCompare) btnCompare.addEventListener('click', compareNativeAndUserAudios);
        if (btnRetest) btnRetest.addEventListener('click', () => startVoiceRecording());

        const btnStpListen = document.getElementById('btnStpListen');
        if (btnStpListen) {
            btnStpListen.addEventListener('click', () => playNativeShadowingAudio(1));
        }
        const btnStpPrev = document.getElementById('btnStpPrevEx');
        const btnStpNext = document.getElementById('btnStpNextEx');
        const btnSepPrev = document.getElementById('btnSepPrevEx');
        const btnSepNext = document.getElementById('btnSepNextEx');
        if (btnStpPrev) btnStpPrev.addEventListener('click', () => changeShadowingSentence(-1));
        if (btnStpNext) btnStpNext.addEventListener('click', () => changeShadowingSentence(1));
        if (btnSepPrev) btnSepPrev.addEventListener('click', () => changeShadowingSentence(-1));
        if (btnSepNext) btnSepNext.addEventListener('click', () => changeShadowingSentence(1));

        const btnStpSpeed = document.getElementById('btnStpSpeed');
        const speedSel = document.getElementById('shadSpeedSelect');
        if (btnStpSpeed) {
            if (speedSel) btnStpSpeed.textContent = `${speedSel.value}x`;
            btnStpSpeed.addEventListener('click', () => {
                const speeds = ['0.75', '0.9', '1.0'];
                const cur = speedSel ? speedSel.value : '0.9';
                let idx = speeds.indexOf(cur);
                const next = speeds[(idx + 1) % speeds.length];
                if (speedSel) speedSel.value = next;
                btnStpSpeed.textContent = `${next}x`;
            });
        }
        if (speedSel) {
            speedSel.addEventListener('change', () => {
                if (btnStpSpeed) btnStpSpeed.textContent = `${speedSel.value}x`;
            });
        }
    }

    // ==================== MODE 5: VOICE & SHADOWING STUDIO ENGINE ====================
    function getSpeechRecognitionClass() {
        return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    }

    function initShadowingStudio() {
        const engineTag = document.getElementById('shadEngineTag');
        const SpeechRec = getSpeechRecognitionClass();
        if (engineTag) {
            if (SpeechRec) {
                engineTag.textContent = 'Web Speech AI: Sẵn sàng';
                engineTag.style.color = '#34d399';
            } else {
                engineTag.textContent = 'Ghi âm & Đối chiếu: Sẵn sàng';
                engineTag.style.color = '#38bdf8';
            }
        }

        updateShadowingWordList();
        renderShadowingActiveTarget();
    }

    function getShadowingWords() {
        const unitData = getCurrentUnitData();
        return (unitData && unitData.target_words && unitData.target_words.length) ? unitData.target_words : [];
    }

    function updateShadowingWordList() {
        const sel = document.getElementById('shadWordSelect');
        if (!sel) return;

        const words = getShadowingWords();
        if (!words.length) {
            sel.innerHTML = '<option value="0">Không có từ vựng</option>';
            return;
        }

        sel.innerHTML = words.map((w, idx) => `
            <option value="${idx}" ${idx === state.shadowing.wordIndex ? 'selected' : ''}>
                #${w.num} ${escapeHtml(w.word)} (${escapeHtml(w.pinyin)}) — ${escapeHtml(truncateText(w.meaning_vi || w.meaning_primary || '', 24))}
            </option>
        `).join('');
    }

    function getToneGuidance(pinyin) {
        if (!pinyin) return 'Chú ý mở rộng khẩu hình và phát âm tròn vành rõ chữ.';
        const cleanPy = pinyin.toLowerCase();

        const hasTone1 = /[āōēīūǖ]/.test(cleanPy);
        const hasTone2 = /[áóéíúǘ]/.test(cleanPy);
        const hasTone3 = /[ǎǒěǐǔǚ]/.test(cleanPy);
        const hasTone4 = /[àòèìùǜ]/.test(cleanPy);

        const tips = [];
        if (hasTone1) {
            tips.push('<strong>Thanh 1 (ngang/cao 5-5)</strong>: Giữ cao độ bằng phẳng và cao, phát âm ngân đều, không hạ giọng.');
        }
        if (hasTone2) {
            tips.push('<strong>Thanh 2 (sắc 3-5)</strong>: Đi từ độ cao trung bình vút thẳng lên cao như hỏi "Hả?", dứt khoát.');
        }
        if (hasTone3) {
            tips.push('<strong>Thanh 3 (hỏi 2-1-4)</strong>: Hạ giọng sâu trầm ở cổ họng rồi hơi nâng nhẹ lên, không lướt qua quá nhanh.');
        }
        if (hasTone4) {
            tips.push('<strong>Thanh 4 (huyền/rơi 5-1)</strong>: Rơi dứt khoát và nhanh từ điểm cao nhất xuống thấp nhất, dứt khoát hạ giọng.');
        }

        if (!tips.length) {
            tips.push('<strong>Thanh nhẹ (khinh thanh)</strong>: Đọc ngắn, nhẹ và nhanh, cơ miệng và lưỡi thả lỏng tự nhiên.');
        }

        return tips.join('<br>');
    }

    function renderShadowingActiveTarget() {
        const words = getShadowingWords();
        if (!words.length) return;

        if (state.shadowing.wordIndex < 0 || state.shadowing.wordIndex >= words.length) {
            state.shadowing.wordIndex = 0;
        }

        const w = words[state.shadowing.wordIndex];
        const hzEl = document.getElementById('shadHz');
        const pyEl = document.getElementById('shadPy');
        const vnEl = document.getElementById('shadVn');
        const posEl = document.getElementById('shadPos');
        const toneTipEl = document.getElementById('shadToneTip');
        const exBox = document.getElementById('shadExPreviewBox');
        const exHz = document.getElementById('shadExHz');
        const exPy = document.getElementById('shadExPy');
        const exVn = document.getElementById('shadExVn');
        const lblPlay = document.getElementById('lblPlayNativeAudio');
        const ssbWord = document.getElementById('ssbCurrentWord');
        const ssbList = document.getElementById('shadSentencesList');

        const stpHz = document.getElementById('stpTextHz');
        const stpPy = document.getElementById('stpTextPy');
        const stpVn = document.getElementById('stpTextVn');
        const stpTypeBadge = document.getElementById('stpTypeBadge');
        const stpStatusBadge = document.getElementById('stpStatusBadge');
        const stpExNav = document.getElementById('stpExNav');
        const stpExCounter = document.getElementById('stpExCounter');
        const sepCounter = document.getElementById('sepCounter');
        const sepLabel = document.getElementById('sepLabel');

        if (hzEl) hzEl.textContent = w.word;
        if (pyEl) pyEl.textContent = w.pinyin;
        if (vnEl) vnEl.textContent = w.meaning_vi || w.meaning_primary || '';
        if (posEl) posEl.textContent = w.pos_full || w.pos || 'Từ vựng';
        if (toneTipEl) toneTipEl.innerHTML = getToneGuidance(w.pinyin);
        if (ssbWord) ssbWord.textContent = w.word;

        const examples = w.examples || [];
        const isExMode = state.shadowing.targetType === 'ex' && examples.length > 0;

        if (isExMode) {
            if (state.shadowing.targetExIndex >= examples.length) {
                state.shadowing.targetExIndex = 0;
            }
            const activeEx = examples[state.shadowing.targetExIndex];
            if (exBox) exBox.classList.remove('hidden');
            if (exHz) exHz.textContent = activeEx.hz;
            if (exPy) exPy.textContent = activeEx.py;
            if (exVn) exVn.textContent = activeEx.vn;
            if (sepCounter) sepCounter.textContent = `${state.shadowing.targetExIndex + 1}/${examples.length}`;
            if (sepLabel) sepLabel.textContent = `💬 Câu ví dụ đang luyện:`;
            if (lblPlay) lblPlay.textContent = `Nghe câu ví dụ mẫu #${state.shadowing.targetExIndex + 1}`;

            // Teleprompter display in Recording Card
            if (stpHz) stpHz.textContent = activeEx.hz;
            if (stpPy) stpPy.textContent = activeEx.py;
            if (stpVn) stpVn.textContent = activeEx.vn;
            if (stpTypeBadge) stpTypeBadge.textContent = '💬 CÂU VÍ DỤ SHADOWING:';
            if (stpExNav) stpExNav.classList.toggle('hidden', examples.length <= 1);
            if (stpExCounter) stpExCounter.textContent = `Câu ${state.shadowing.targetExIndex + 1}/${examples.length}`;
        } else {
            if (exBox) exBox.classList.add('hidden');
            if (lblPlay) lblPlay.textContent = 'Nghe phát âm từ vựng mẫu';

            // Teleprompter display in Recording Card
            if (stpHz) stpHz.textContent = w.word;
            if (stpPy) stpPy.textContent = w.pinyin;
            if (stpVn) stpVn.textContent = w.meaning_vi || w.meaning_primary || '';
            if (stpTypeBadge) stpTypeBadge.textContent = '🔤 TỪ VỰNG MỤC TIÊU:';
            if (stpExNav) stpExNav.classList.add('hidden');
        }

        if (stpStatusBadge) {
            stpStatusBadge.textContent = 'Đang chờ thu âm';
            stpStatusBadge.className = 'stp-status-badge';
        }

        // Render sentences list for current word
        if (ssbList) {
            if (!examples.length) {
                ssbList.innerHTML = `<div class="empty-msg" style="padding:20px 10px;">Từ này không có câu ví dụ riêng trong bài. Bạn hãy tập trung luyện phát âm từ mục tiêu nhé!</div>`;
            } else {
                ssbList.innerHTML = examples.map((ex, idx) => {
                    const isSelected = isExMode && state.shadowing.targetExIndex === idx;
                    return `
                        <div class="shad-sentence-card ${isSelected ? 'active' : ''}" id="shad-sent-${idx}">
                            <div class="ssc-text-wrap">
                                <div class="ssc-hz"><strong>${idx + 1}.</strong> ${escapeHtml(ex.hz)}</div>
                                <div class="ssc-py">${escapeHtml(ex.py)}</div>
                                <div class="ssc-vn">${escapeHtml(ex.vn)}</div>
                            </div>
                            <div class="ssc-actions">
                                <button class="btn-ssc-speak" data-speak="${escapeAttr(ex.hz)}" title="Nghe câu này">🔊 Nghe</button>
                                <button class="btn-ssc-select" data-select-ex="${idx}" title="Chọn câu này để luyện Shadowing">🎙️ Luyện câu này</button>
                            </div>
                        </div>
                    `;
                }).join('');

                ssbList.querySelectorAll('.btn-ssc-speak').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const text = btn.getAttribute('data-speak');
                        if (text) speakChinese(text);
                    });
                });

                ssbList.querySelectorAll('.btn-ssc-select').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const exIdx = parseInt(btn.getAttribute('data-select-ex'), 10);
                        selectShadowingExample(exIdx);
                    });
                });

                ssbList.querySelectorAll('.shad-sentence-card').forEach(card => {
                    card.addEventListener('click', () => {
                        const selectBtn = card.querySelector('.btn-ssc-select');
                        if (selectBtn) {
                            const exIdx = parseInt(selectBtn.getAttribute('data-select-ex'), 10);
                            selectShadowingExample(exIdx);
                        }
                    });
                });
            }
        }

        // Reset previous recording session UI for new target
        resetShadowingRecordingSession();
    }

    function selectShadowingExample(exIdx) {
        state.shadowing.targetType = 'ex';
        state.shadowing.targetExIndex = exIdx;

        const btnWord = document.getElementById('btnShadModeWord');
        const btnEx = document.getElementById('btnShadModeEx');
        if (btnWord) btnWord.classList.remove('active');
        if (btnEx) btnEx.classList.add('active');

        renderShadowingActiveTarget();
        playNativeShadowingAudio(1);

        const teleprompter = document.getElementById('shadTeleprompter');
        if (teleprompter) {
            teleprompter.scrollIntoView({ behavior: 'smooth', block: 'center' });
            teleprompter.classList.add('highlight-pulse');
            setTimeout(() => teleprompter.classList.remove('highlight-pulse'), 1400);
        }
    }

    function changeShadowingSentence(delta) {
        const words = getShadowingWords();
        if (!words.length) return;
        const w = words[state.shadowing.wordIndex];
        const examples = w.examples || [];
        if (!examples.length) return;

        state.shadowing.targetType = 'ex';
        state.shadowing.targetExIndex = (state.shadowing.targetExIndex + delta + examples.length) % examples.length;

        const btnWord = document.getElementById('btnShadModeWord');
        const btnEx = document.getElementById('btnShadModeEx');
        if (btnWord) btnWord.classList.remove('active');
        if (btnEx) btnEx.classList.add('active');

        renderShadowingActiveTarget();
        playNativeShadowingAudio(1);
    }

    function resetShadowingRecordingSession() {
        stopVoiceRecording();
        const pBar = document.getElementById('shadPlaybackBar');
        const evalBox = document.getElementById('shadEvalBox');
        const noticeBox = document.getElementById('shadNoticeBox');
        if (pBar) pBar.classList.add('hidden');
        if (evalBox) evalBox.classList.add('hidden');
        if (noticeBox) noticeBox.classList.add('hidden');

        const teleprompter = document.getElementById('shadTeleprompter');
        if (teleprompter) {
            teleprompter.classList.remove('recording');
            teleprompter.classList.remove('highlight-pulse');
        }
        const stpStatus = document.getElementById('stpStatusBadge');
        if (stpStatus) {
            stpStatus.textContent = 'Đang chờ thu âm';
            stpStatus.className = 'stp-status-badge';
        }

        const prompt = document.getElementById('shadRecPrompt');
        if (prompt) {
            prompt.textContent = 'Nhấn micro và đọc to theo nội dung hiển thị ở trên';
        }
    }

    function getShadowingCurrentTargetText() {
        const words = getShadowingWords();
        if (!words.length) return '';
        const w = words[state.shadowing.wordIndex];
        if (state.shadowing.targetType === 'ex' && w.examples && w.examples[state.shadowing.targetExIndex]) {
            return w.examples[state.shadowing.targetExIndex].hz;
        }
        return cleanHanziForTts(w.word);
    }

    function playNativeShadowingAudio(repeatTimes = 1) {
        const text = getShadowingCurrentTargetText();
        if (!text || !('speechSynthesis' in window)) return;

        window.speechSynthesis.cancel();
        const speedSel = document.getElementById('shadSpeedSelect');
        const rate = speedSel ? (parseFloat(speedSel.value) || 0.9) : 0.9;
        const playBtn = document.getElementById('btnPlayNativeAudio');

        if (playBtn) playBtn.classList.add('playing');

        let timesPlayed = 0;
        function playOnce() {
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'zh-CN';
            utter.rate = rate;

            utter.onend = () => {
                timesPlayed++;
                if (timesPlayed < repeatTimes) {
                    setTimeout(playOnce, 450);
                } else {
                    if (playBtn) playBtn.classList.remove('playing');
                }
            };

            utter.onerror = () => {
                if (playBtn) playBtn.classList.remove('playing');
            };

            window.speechSynthesis.speak(utter);
        }

        playOnce();
    }

    async function toggleVoiceRecording() {
        if (state.shadowing.isRecording) {
            stopVoiceRecording();
        } else {
            await startVoiceRecording();
        }
    }

    async function startVoiceRecording() {
        resetShadowingRecordingSession();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showShadNotice('Trình duyệt của bạn không hỗ trợ tính năng thu âm qua getUserMedia hoặc bạn đang mở trang không qua giao thức an toàn (HTTPS/Localhost).');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.shadowing.stream = stream;
            state.shadowing.audioChunks = [];
            state.shadowing.recognizedText = '';

            const options = {};
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                options.mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                options.mimeType = 'audio/ogg;codecs=opus';
            }

            const recorder = new MediaRecorder(stream, options);
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    state.shadowing.audioChunks.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(state.shadowing.audioChunks, { type: recorder.mimeType || 'audio/webm' });
                if (state.shadowing.audioBlobUrl) {
                    URL.revokeObjectURL(state.shadowing.audioBlobUrl);
                }
                state.shadowing.audioBlobUrl = URL.createObjectURL(blob);
                state.shadowing.userAudio = new Audio(state.shadowing.audioBlobUrl);

                const pBar = document.getElementById('shadPlaybackBar');
                if (pBar) pBar.classList.remove('hidden');

                setTimeout(evaluatePronunciation, 350);
            };

            recorder.start(100);
            state.shadowing.mediaRecorder = recorder;

            // Start SpeechRecognition concurrently if available
            const SpeechRec = getSpeechRecognitionClass();
            if (SpeechRec) {
                try {
                    const rec = new SpeechRec();
                    rec.lang = 'zh-CN';
                    rec.continuous = false;
                    rec.interimResults = false;
                    rec.maxAlternatives = 3;

                    rec.onresult = (e) => {
                        if (e.results && e.results[0] && e.results[0][0]) {
                            state.shadowing.recognizedText = e.results[0][0].transcript;
                        }
                    };

                    rec.onerror = (e) => {
                        console.warn('SpeechRecognition error:', e.error);
                    };

                    rec.start();
                    state.shadowing.recognition = rec;
                } catch (recErr) {
                    console.warn('SpeechRecognition start failed:', recErr);
                }
            }

            // Update UI state
            state.shadowing.isRecording = true;
            state.shadowing.recSeconds = 0;

            const micBtn = document.getElementById('btnShadMicToggle');
            const micWrap = document.getElementById('shadMicWrap');
            const micIcon = document.getElementById('shadMicIcon');
            const micLabel = document.getElementById('shadMicLabel');
            const timerEl = document.getElementById('shadRecTimer');
            const prompt = document.getElementById('shadRecPrompt');

            if (micBtn) micBtn.classList.add('recording');
            if (micWrap) micWrap.classList.add('recording');
            if (micIcon) micIcon.textContent = '⏹️';
            if (micLabel) micLabel.textContent = 'Dừng Nói';
            if (timerEl) {
                timerEl.classList.remove('hidden');
                timerEl.textContent = '00:00';
            }
            if (prompt) prompt.textContent = '🔴 Đang lắng nghe... Hãy đọc to và rõ ràng câu/từ tiếng Trung!';

            const teleprompter = document.getElementById('shadTeleprompter');
            if (teleprompter) teleprompter.classList.add('recording');
            const stpStatus = document.getElementById('stpStatusBadge');
            if (stpStatus) {
                stpStatus.textContent = '🔴 Đang ghi âm...';
                stpStatus.className = 'stp-status-badge recording';
            }

            state.shadowing.recTimerId = setInterval(() => {
                state.shadowing.recSeconds += 1;
                const m = String(Math.floor(state.shadowing.recSeconds / 60)).padStart(2, '0');
                const s = String(state.shadowing.recSeconds % 60).padStart(2, '0');
                if (timerEl) timerEl.textContent = `${m}:${s}`;

                if (state.shadowing.recSeconds >= 15) {
                    stopVoiceRecording();
                }
            }, 1000);

        } catch (err) {
            console.warn('getUserMedia error:', err);
            showShadNotice('Không thể kích hoạt micro. Vui lòng kiểm tra quyền cho phép Micro (Microphone permission) trong cài đặt trình duyệt.');
        }
    }

    function stopVoiceRecording() {
        if (!state.shadowing.isRecording) return;
        state.shadowing.isRecording = false;

        if (state.shadowing.recTimerId) {
            clearInterval(state.shadowing.recTimerId);
            state.shadowing.recTimerId = null;
        }

        if (state.shadowing.mediaRecorder && state.shadowing.mediaRecorder.state !== 'inactive') {
            try { state.shadowing.mediaRecorder.stop(); } catch (e) {}
        }

        if (state.shadowing.stream) {
            state.shadowing.stream.getTracks().forEach(track => track.stop());
            state.shadowing.stream = null;
        }

        if (state.shadowing.recognition) {
            try { state.shadowing.recognition.stop(); } catch (e) {}
            state.shadowing.recognition = null;
        }

        const micBtn = document.getElementById('btnShadMicToggle');
        const micWrap = document.getElementById('shadMicWrap');
        const micIcon = document.getElementById('shadMicIcon');
        const micLabel = document.getElementById('shadMicLabel');
        const timerEl = document.getElementById('shadRecTimer');
        const prompt = document.getElementById('shadRecPrompt');

        if (micBtn) micBtn.classList.remove('recording');
        if (micWrap) micWrap.classList.remove('recording');
        if (micIcon) micIcon.textContent = '🎙️';
        if (micLabel) micLabel.textContent = 'Bấm để Nói';
        if (timerEl) timerEl.classList.add('hidden');
        if (prompt) prompt.textContent = '✅ Đã ghi âm xong! Đang phân tích âm sắc & chấm điểm...';

        const teleprompter = document.getElementById('shadTeleprompter');
        if (teleprompter) teleprompter.classList.remove('recording');
        const stpStatus = document.getElementById('stpStatusBadge');
        if (stpStatus) {
            stpStatus.textContent = '✅ Đã ghi âm';
            stpStatus.className = 'stp-status-badge done';
        }
    }

    function showShadNotice(msg) {
        const box = document.getElementById('shadNoticeBox');
        if (box) {
            box.textContent = msg;
            box.classList.remove('hidden');
        }
    }

    function cleanChineseString(str) {
        if (!str) return '';
        return String(str).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').toLowerCase().trim();
    }

    function calculateLevenshtein(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    function evaluatePronunciation() {
        const evalBox = document.getElementById('shadEvalBox');
        const scoreCircle = document.getElementById('shadScoreCircle');
        const scoreVal = document.getElementById('shadScoreVal');
        const ratingTitle = document.getElementById('shadRatingTitle');
        const ratingSub = document.getElementById('shadRatingSub');
        const recogText = document.getElementById('shadRecognizedText');
        const breakdown = document.getElementById('shadCharBreakdown');
        const prompt = document.getElementById('shadRecPrompt');

        if (!evalBox) return;

        const targetRaw = getShadowingCurrentTargetText();
        const expected = cleanChineseString(targetRaw);
        const spoken = cleanChineseString(state.shadowing.recognizedText);

        state.gamify.stats.voicePracticed = (state.gamify.stats.voicePracticed || 0) + 1;

        if (!spoken) {
            const hasRecClass = !!getSpeechRecognitionClass();
            evalBox.classList.remove('hidden');
            if (recogText) recogText.textContent = '(Chưa bắt được âm tiết rõ ràng)';
            if (breakdown) breakdown.innerHTML = '<span class="char-chip missed">⚠️ Không phát hiện âm thanh rõ</span>';

            if (scoreCircle) {
                scoreCircle.className = 'seb-score-circle grade-low';
            }
            if (scoreVal) scoreVal.textContent = '--';
            if (ratingTitle) ratingTitle.textContent = hasRecClass ? 'Chưa nghe rõ giọng bạn' : 'Đã thu âm giọng nói';
            if (ratingSub) {
                ratingSub.textContent = hasRecClass
                    ? 'Hãy thử nói to hơn, sát micro hơn hoặc bấm "Thu lại".'
                    : 'Trình duyệt chưa hỗ trợ AI chấm điểm tự động, nhưng bạn có thể nghe lại giọng và bấm So sánh với bản xứ!';
            }
            if (prompt) prompt.textContent = 'Hoàn tất ghi âm. Bạn có thể nghe lại hoặc thu lại bất cứ lúc nào.';
            saveProgress();
            return;
        }

        // Compare expected and spoken
        if (recogText) recogText.textContent = state.shadowing.recognizedText;

        const maxLen = Math.max(expected.length, spoken.length);
        const dist = calculateLevenshtein(expected, spoken);
        let scorePct = Math.round(Math.max(0, (1 - dist / maxLen)) * 100);

        if (spoken === expected) {
            scorePct = 98;
        } else if (spoken.includes(expected) || expected.includes(spoken)) {
            scorePct = Math.max(scorePct, 88);
        }

        state.shadowing.score = scorePct;
        state.gamify.stats.voiceScoreBest = Math.max(state.gamify.stats.voiceScoreBest || 0, scorePct);

        if (scoreVal) scoreVal.textContent = scorePct;

        // Breakdown character chips
        if (breakdown) {
            const expectedChars = targetRaw.replace(/[0-9()（）]/g, '').trim().split('');
            breakdown.innerHTML = expectedChars.map(char => {
                const isMatch = spoken.includes(char.toLowerCase());
                return `
                    <span class="char-chip ${isMatch ? 'matched' : 'missed'}">
                        ${isMatch ? '✅' : '❌'} ${escapeHtml(char)}
                    </span>
                `;
            }).join('');
        }

        // Ratings & XP
        if (scoreCircle) {
            scoreCircle.className = 'seb-score-circle';
            if (scorePct >= 85) scoreCircle.classList.add('grade-good');
            else if (scorePct >= 65) scoreCircle.classList.add('grade-mid');
            else scoreCircle.classList.add('grade-low');
        }

        if (scorePct >= 85) {
            if (ratingTitle) ratingTitle.textContent = '🌟 Phát âm xuất sắc!';
            if (ratingSub) ratingSub.textContent = `Thanh điệu và phát âm chuẩn xác ngữ âm bản xứ! (+25 XP)`;
            playSoundEffect('correct');
            awardXp(25, 'Luyện nói xuất sắc');
        } else if (scorePct >= 65) {
            if (ratingTitle) ratingTitle.textContent = '👍 Phát âm khá tốt!';
            if (ratingSub) ratingSub.textContent = `Khẩu hình và cao độ tương đối rõ ràng. Hãy nghe lại để hoàn thiện hơn (+18 XP)`;
            awardXp(18, 'Luyện nói khá tốt');
        } else {
            if (ratingTitle) ratingTitle.textContent = '💪 Cần luyện tập thêm!';
            if (ratingSub) ratingSub.textContent = `Một số âm tiết chưa chuẩn. Hãy bấm "Nghe Mẫu ➔ Giọng bạn" để đối chiếu nhé (+10 XP)`;
            awardXp(10, 'Luyện nói');
        }

        if (prompt) prompt.textContent = `Đã hoàn tất chấm điểm: ${scorePct}/100 điểm.`;
        evalBox.classList.remove('hidden');
        saveProgress();
    }

    function playUserRecordedAudio() {
        if (!state.shadowing.userAudio) return;
        state.shadowing.userAudio.currentTime = 0;
        state.shadowing.userAudio.play();
    }

    function compareNativeAndUserAudios() {
        if (!state.shadowing.userAudio) return;

        const target = getShadowingCurrentTargetText();
        if (!target || !('speechSynthesis' in window)) return;

        const speedSel = document.getElementById('shadSpeedSelect');
        const rate = speedSel ? (parseFloat(speedSel.value) || 0.9) : 0.9;
        const compareBtn = document.getElementById('btnCompareAudios');

        if (compareBtn) compareBtn.classList.add('active');

        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(target);
        utter.lang = 'zh-CN';
        utter.rate = rate;

        utter.onend = () => {
            setTimeout(() => {
                if (state.shadowing.userAudio) {
                    state.shadowing.userAudio.currentTime = 0;
                    state.shadowing.userAudio.play();
                    state.shadowing.userAudio.onended = () => {
                        if (compareBtn) compareBtn.classList.remove('active');
                    };
                } else {
                    if (compareBtn) compareBtn.classList.remove('active');
                }
            }, 450);
        };

        utter.onerror = () => {
            if (compareBtn) compareBtn.classList.remove('active');
        };

        window.speechSynthesis.speak(utter);
    }

    // ==================== HELPERS ====================
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        return escapeHtml(str).replace(/'/g, '&#39;');
    }

    function truncateText(str, maxLen) {
        if (!str) return '';
        const clean = String(str).trim();
        return clean.length > maxLen ? clean.slice(0, maxLen - 1) + '…' : clean;
    }

    function formatConciseEnglish(enStr, viStr) {
        if (!enStr || enStr === viStr) return '';
        const cleaned = String(enStr).replace(/^[a-z]+\.\s*:\s*/i, '');
        const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
        return parts.slice(0, 4).join(', ');
    }

    function highlightTargetWord(sentence, wordStr) {
        const safeSent = escapeHtml(sentence || '');
        if (!wordStr) return safeSent;

        const variants = wordStr
            .split('|')
            .map(v => v.replace(/[0-9()（）]/g, '').trim())
            .filter(Boolean)
            .sort((a, b) => b.length - a.length);

        let result = safeSent;
        for (const v of variants) {
            const safeV = escapeHtml(v);
            if (safeV && result.includes(safeV)) {
                result = result.split(safeV).join(`<span class="target-hl">${safeV}</span>`);
                break;
            }
        }
        return result;
    }

    function removePinyinTones(str) {
        if (!str) return '';
        return str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ü/g, 'v');
    }
})();
