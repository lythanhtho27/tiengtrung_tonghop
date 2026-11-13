/**
 * word_learning.js
 * Hệ thống Học & Luyện Tập Từ Vựng HSK 3.0 (Cấp 1 – 9) từ dữ liệu JSON
 * Gồm 8 quyển · 368 Bài (Units) · 11.092 Từ vựng chuẩn GF 0025-2021
 * Hỗ trợ đầy đủ Desktop, Tablet & Mobile
 */

(function () {
    'use strict';

    // ==================== STORAGE KEYS ====================
    // Sáng/tối dùng chung: shared/theme.js (key "hoc_theme"). Key theme cũ 'hsk_wl_json_theme_v2' đã bỏ
    // (được chuyển sang hoc_theme bằng script nhỏ trong <head>).
    const STORAGE_KEY_PROGRESS   = 'hsk_wl_json_progress_v2';   // + settings, daily (thêm trường, vẫn tương thích)
    const STORAGE_KEY_FONT       = 'hsk_wl_json_font_v2';
    const STORAGE_KEY_TONE_COLOR = 'hsk_wl_json_tone_color_v2';
    const STORAGE_KEY_SRS        = 'hsk_wl_srs_v3';              // SRS SM-2 (mới)
    const STORAGE_KEY_SRS_OLD    = 'hsk_wl_srs_data_v2';         // SRS Leitner cũ — chỉ đọc để chuyển dữ liệu, không xóa
    const STORAGE_KEY_GAMIFY     = 'hsk_wl_gamify_data_v2';

    // Lộ trình & SRS
    const PASS_PCT = 80;            // bài hoàn thành khi kiểm tra / bài tập đạt ≥ 80%
    const DAY_MS = 86400000;
    const RELEARN_MS = 10 * 60000;  // từ sai: ôn lại sau 10 phút
    const SLOW_MS = 3000;           // nhận diện chậm hơn 3 giây -> "từ chậm"

    // ==================== STATE ====================
    let state = {
        activeBookId: 'q1',
        activeUnitNum: 1,
        activeWordNum: 1,
        studyMode: 'memory',       // 'memory' | 'games' (Luyện tập) | 'flashcard' (Ôn tập) | 'extra' (Trò chơi · Luyện nói)
        extraSubMode: 'bubble',    // 'bubble' | 'shadowing'
        unitFilter: 'all',         // 'all' | 'todo' | 'done' | 'star' | 'srs'
        unitSearchQuery: '',
        globalSearchQuery: '',
        showPinyin: true,
        showMeaning: true,
        onlyStarredWords: false,
        targetGridCollapsed: true,
        viewMode: localStorage.getItem('wl_view_mode') || 'compact',
        speakingAll: false,

        // Kiểu chữ Hán & màu thanh điệu
        hanziFont: 'calligraphy',  // 'calligraphy' | 'sans'
        enableToneColors: true,

        // User progress persisted in localStorage
        doneUnits: {},             // { "q1_1": true }
        starredUnits: {},          // { "q1_1": true }
        starredWords: {},          // { "L1-0001": true }
        practiceScores: {},        // { "q1_1": { score: 40, total: 45 } }  (điểm cao nhất)
        settings: { sequential: true },   // học theo thứ tự (khóa bài sau)
        daily: { d: '', n: 0, r: 0 },     // hôm nay: từ mới / lượt ôn

        // SRS SM-2 cho mọi từ đã học, gộp mọi quyển
        // { [wordId]: { ef, iv, reps, lapses, first, last, due, rt?, b: bookId, u: unitNum, hz, py, vi, pos } }
        srsData: {},
        practiceRevealed: false,   // đã bấm "Điền đáp án mẫu" -> không tính điểm

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
        fcScope: 'due',            // 'due' | 'slow' | 'unit' | 'starred' | 'book'
        fcBookFilter: 'all',       // lọc quyển cho 'due' / 'slow'
        fcFaceMode: 'hz',          // 'visual' | 'hz' | 'vi' | 'audio'
        fcShownAt: 0,              // thời điểm hiện mặt trước (đo tốc độ nhận diện)
        fcFlipMs: null,
        fcAutoSpeak: true,
        fcDeck: [],
        fcIndex: 0,
        fcFlipped: false,

        // Games & Practice Hub state
        gamesSubMode: 'quiz',      // 'quiz' | 'practice'
        bubbleGame: {
            isRunning: false,
            score: 0,
            combo: 1,
            maxCombo: 1,
            lives: 3,
            timeLeft: 60,
            target: null,
            timerId: null,
            poppedCount: 0,
            mode: 'vn_to_hz'       // 'vn_to_hz' | 'audio_to_hz' | 'py_to_hz'
        },

        // Quiz state
        quizType: 'hz_to_vn',      // 'hz_to_vn' | 'vn_to_hz' | 'audio_to_hz'
        quizScope: 'test',         // 'test' (kiểm tra bài) | 'unit' | 'slow' | 'due'
        quizPool: [],
        quizTest: null,            // { deck, idx, correct, wrong:Set, rt:{} }
        quizShownAt: 0,
        quizAdvanceId: null,
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
        initHanziFont();
        initToneColors();
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
        scheduleSummarySave();
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
            hydrateSrsFromBook(bookId);   // quyển nạp sẵn bằng thẻ <script> (vd. quyển 1)
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
            const data = await loadingBookPromises[bookId];
            hydrateSrsFromBook(bookId);
            return data;
        } finally {
            delete loadingBookPromises[bookId];
        }
    }

    // Nạp các quyển chứa những thẻ SRS cần hiển thị (dữ liệu từng quyển được nạp lười)
    async function ensureBooksForCardIds(ids) {
        const books = new Set();
        ids.forEach(id => {
            const c = state.srsData[id];
            if (c && c.b && !window.HSK_BOOK_JSON[c.b]) books.add(c.b);
        });
        for (const b of books) {
            try { await ensureBookDataLoaded(b); } catch (e) { console.warn(e); }
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
                state.settings       = Object.assign({ sequential: true }, parsed.settings || {});
                if (parsed.daily) state.daily = parsed.daily;
                if (parsed.lastBookId && getBookIndexMeta(parsed.lastBookId)) {
                    state.activeBookId = parsed.lastBookId;
                }
                if (parsed.lastUnitNum && !isNaN(Number(parsed.lastUnitNum))) {
                    state.activeUnitNum = Number(parsed.lastUnitNum);
                }
            }

            // SRS: đọc bản SM-2; nếu chưa có thì chuyển từ dữ liệu Leitner cũ
            loadSrsData();

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
                settings: state.settings,
                daily: state.daily,
                lastBookId: state.activeBookId,
                lastUnitNum: state.activeUnitNum
            }));

            localStorage.setItem(STORAGE_KEY_SRS, JSON.stringify(state.srsData || {}));
            localStorage.setItem(STORAGE_KEY_GAMIFY, JSON.stringify(state.gamify || {}));
        } catch (e) {
            console.warn('Không thể lưu tiến độ:', e);
        }
        scheduleSummarySave();
    }

    // ---------- Tóm tắt tiến độ cho trang chủ (shared/progress.js) ----------
    let summaryTimer = null;
    function scheduleSummarySave() {
        if (summaryTimer) clearTimeout(summaryTimer);
        summaryTimer = setTimeout(saveSummary, 250);
    }

    function bookLabel(meta) {
        return meta ? `HSK 3.0 · ${meta.title}` : '';
    }

    function saveSummary() {
        summaryTimer = null;
        if (!window.HocProgress || typeof HSK_BOOKS_INDEX === 'undefined') return;
        const target = findContinueTarget();
        const groups = {};
        HSK_BOOKS_INDEX.forEach(b => {
            groups[b.id] = { done: countDoneUnits(b), total: b.unit_count, label: bookLabel(b) };
        });
        const tMeta = target ? getBookIndexMeta(target.bookId) : null;
        const td = todayStats();
        HocProgress.save('word_learning', {
            next: target ? `${bookLabel(tMeta)} · Bài ${target.unit}` : 'Đã hoàn thành mọi bài',
            nextUrl: target
                ? `word_learning/word_learning.html?book=${encodeURIComponent(target.bookId)}&unit=${target.unit}`
                : 'word_learning/word_learning.html',
            due: getDueCardIds('all').length,
            learned: Object.keys(state.srsData || {}).length,
            today: { n: td.n, r: td.r },
            groups
        });
    }

    function localDayKey(t) {
        const d = new Date(t || Date.now());
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function todayStats() {
        const k = localDayKey();
        if (!state.daily || state.daily.d !== k) state.daily = { d: k, n: 0, r: 0 };
        return state.daily;
    }
    function bumpDaily(field) {
        const d = todayStats();
        d[field] = (d[field] || 0) + 1;
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
            } else if (type === 'pop') {
                // Bouncy bubble pop chirp
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(980, now);
                osc.frequency.exponentialRampToValueAtTime(320, now + 0.09);
                gain.gain.setValueAtTime(0.22, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.09);
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
        { id: 'b_srs_first', icon: '🧠', title: 'Người Rèn Luyện', desc: 'Có từ vựng đầu tiên trong lịch ôn tập', xp: 50 },
        { id: 'b_srs_master_10', icon: '💎', title: 'Trí Nhớ Thép', desc: 'Có 10 từ đạt mức Thuộc (khoảng ôn ≥ 21 ngày)', xp: 350 },
        { id: 'b_podcast_fan', icon: '🎧', title: 'Thính Giả Chăm Chỉ', desc: 'Bật chế độ nghe thụ động Hands-free Podcast', xp: 60 },
        { id: 'b_voice_first', icon: '🎙️', title: 'Tiếng Nói Đầu Tiên', desc: 'Ghi âm và luyện phát âm từ vựng đầu tiên', xp: 60 },
        { id: 'b_voice_master', icon: '🌟', title: 'Bản Xứ Chuẩn Giọng', desc: 'Đạt điểm phát âm xuất sắc (>=85 điểm) với AI', xp: 150 },
        { id: 'b_unit_master', icon: '🏆', title: 'Chinh Phục Bài Học', desc: 'Đạt 100% Kiểm tra bài hoặc Bài tập SGK của một bài', xp: 150 }
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

    // ==================== VISUAL MNEMONICS & RADICAL ENGINE ====================
    const RADICAL_MEANINGS = {
        '氵': { name: 'Bộ Thủy', vi: 'Nước, chất lỏng, sông suối', icon: '💧' },
        '水': { name: 'Bộ Thủy', vi: 'Nước, chất lỏng', icon: '💧' },
        '亻': { name: 'Bộ Nhân đứng', vi: 'Con người, hành vi, mối quan hệ', icon: '👤' },
        '人': { name: 'Bộ Nhân', vi: 'Con người', icon: '👤' },
        '口': { name: 'Bộ Khẩu', vi: 'Cái miệng, ăn uống, lời nói', icon: '👄' },
        '木': { name: 'Bộ Mộc', vi: 'Cây cối, rừng, đồ gỗ', icon: '🌳' },
        '火': { name: 'Bộ Hỏa', vi: 'Ngọn lửa, nhiệt độ, nấu nướng', icon: '🔥' },
        '灬': { name: 'Bộ Hỏa', vi: 'Bốn chấm lửa, đun nấu', icon: '🔥' },
        '讠': { name: 'Bộ Ngôn', vi: 'Lời nói, ngôn ngữ, giao tiếp', icon: '💬' },
        '言': { name: 'Bộ Ngôn', vi: 'Lời nói, ngôn ngữ', icon: '💬' },
        '日': { name: 'Bộ Nhật', vi: 'Mặt trời, ban ngày, thời gian', icon: '☀️' },
        '月': { name: 'Bộ Nguyệt', vi: 'Mặt trăng / Bộ Nhục (cơ thể, da thịt)', icon: '🌙' },
        '目': { name: 'Bộ Mục', vi: 'Con mắt, nhìn ngắm', icon: '👀' },
        '手': { name: 'Bộ Thủ', vi: 'Bàn tay, lao động', icon: '✋' },
        '扌': { name: 'Bộ Tài gảy', vi: 'Bàn tay cầm nắm, thao tác', icon: '✋' },
        '足': { name: 'Bộ Túc', vi: 'Bàn chân, bước đi, đá, nhảy', icon: '🦶' },
        '𧾷': { name: 'Bộ Túc', vi: 'Bàn chân, chạy nhảy', icon: '🦶' },
        '心': { name: 'Bộ Tâm', vi: 'Trái tim, tình cảm, suy nghĩ', icon: '❤️' },
        '忄': { name: 'Bộ Tâm đứng', vi: 'Cảm xúc, tâm trạng nội tâm', icon: '💭' },
        '食': { name: 'Bộ Thực', vi: 'Thực phẩm, ăn uống, món ăn', icon: '🍲' },
        '饣': { name: 'Bộ Thực', vi: 'Thức ăn, ẩm thực', icon: '🍲' },
        '辶': { name: 'Bộ Quai xước', vi: 'Di chuyển, đi đường, tiến bước', icon: '🚶' },
        '钅': { name: 'Bộ Kim', vi: 'Kim loại, tiền bạc, vàng bạc', icon: '💰' },
        '金': { name: 'Bộ Kim', vi: 'Vàng, kim loại', icon: '💰' },
        '犭': { name: 'Bộ Khuyển', vi: 'Động vật, thú nuôi, muông thú', icon: '🐾' },
        '犬': { name: 'Bộ Khuyển', vi: 'Con chó, thú vật', icon: '🐾' },
        '宀': { name: 'Bộ Miên', vi: 'Mái nhà, gia đình, nơi ở che chở', icon: '🏠' },
        '女': { name: 'Bộ Nữ', vi: 'Phụ nữ, mẹ, chị em gái', icon: '👩' },
        '子': { name: 'Bộ Tử', vi: 'Con cái, trẻ nhỏ, mầm sống', icon: '👶' },
        '车': { name: 'Bộ Xa', vi: 'Xe cộ, phương tiện giao thông', icon: '🚗' },
        '门': { name: 'Bộ Môn', vi: 'Cửa ra vào, cổng chào', icon: '🚪' },
        '雨': { name: 'Bộ Vũ', vi: 'Mưa, sấm sét, thời tiết mây mù', icon: '🌧️' },
        '艹': { name: 'Bộ Thảo', vi: 'Cây cỏ, hoa lá, thảo mộc', icon: '🌿' },
        '衣': { name: 'Bộ Y', vi: 'Áo quần, vải vóc trang phục', icon: '👕' },
        '衤': { name: 'Bộ Y', vi: 'Trang phục, y phục', icon: '👕' },
        '山': { name: 'Bộ Sơn', vi: 'Núi non, địa hình cao lớn', icon: '⛰️' },
        '田': { name: 'Bộ Điền', vi: 'Ruộng đất, nông nghiệp', icon: '🌾' },
        '力': { name: 'Bộ Lực', vi: 'Sức mạnh, cơ bắp, nỗ lực', icon: '💪' },
        '刀': { name: 'Bộ Đao', vi: 'Con dao, chặt, cắt, chia', icon: '🔪' },
        '刂': { name: 'Bộ Đao đứng', vi: 'Vũ khí sắc nhọn, phân chia', icon: '🔪' },
        '土': { name: 'Bộ Thổ', vi: 'Đất đai, mặt đất, bờ cõi', icon: '🧱' },
        '石': { name: 'Bộ Thạch', vi: 'Hòn đá, khoáng vật, kiên cố', icon: '🪨' },
        '禾': { name: 'Bộ Hòa', vi: 'Cây lúa, ngũ cốc, mùa màng', icon: '🌾' },
        '攵': { name: 'Bộ Phộc', vi: 'Đánh khẽ, hành động giục giã', icon: '✍️' },
        '夂': { name: 'Bộ Trĩ', vi: 'Bước đi theo sau, chậm rãi', icon: '👣' },
        '爫': { name: 'Bộ Trảo', vi: 'Móng vuốt, nắm bắt, che chở', icon: '🦅' }
    };

    const WORD_VISUAL_MAP = {
        '爱': {
            icon: '❤️',
            radicals: [
                { r: '爫', name: 'Bộ Trảo (Bàn tay che chở / Móng vuốt)' },
                { r: '冖', name: 'Bộ Miên (Mái nhà / Nơi chốn ấm áp)' },
                { r: '心', name: 'Bộ Tâm (Trái tim / Tình cảm)' },
                { r: '夂', name: 'Bộ Trĩ (Bước theo / Cùng nhau đồng hành)' }
            ],
            story: 'Dưới mái nhà (冖), hai người trao trọn con tim (心), dùng bàn tay nâng niu che chở (爫) và nguyện cùng nhau sánh bước (夂) trọn đời ➔ Đó chính là TÌNH YÊU (爱).',
            family: [
                { word: '爱情', py: 'àiqíng', vi: 'tình yêu' },
                { word: '爱好', py: 'àihào', vi: 'sở thích' },
                { word: '爱心', py: 'àixīn', vi: 'lòng nhân ái' },
                { word: '可爱', py: 'kě\'ài', vi: 'đáng yêu' }
            ]
        },
        '好': {
            icon: '👍',
            radicals: [
                { r: '女', name: 'Bộ Nữ (Người mẹ / Phụ nữ)' },
                { r: '子', name: 'Bộ Tử (Đứa con thơ)' }
            ],
            story: 'Người mẹ (女) âu yếm bế đứa con nhỏ (子) trong lòng ➔ Cảnh tượng gia đình đầm ấm, trọn vẹn là điều TỐT ĐẸP nhất (好).',
            family: [
                { word: '你好', py: 'nǐ hǎo', vi: 'xin chào' },
                { word: '好看', py: 'hǎokàn', vi: 'đẹp, hay' },
                { word: '好吃', py: 'hǎochī', vi: 'ngon miệng' },
                { word: '好处', py: 'hǎochu', vi: 'lợi ích' }
            ]
        },
        '家': {
            icon: '🏠',
            radicals: [
                { r: '宀', name: 'Bộ Miên (Mái nhà che mưa nắng)' },
                { r: '豕', name: 'Bộ Thỉ (Con heo / Gia súc ấm no)' }
            ],
            story: 'Dưới mái nhà (宀) có nuôi gia súc (豕) no ấm, sung túc ➔ Nơi bình yên ấm cúng để trở về chính là NHÀ (家).',
            family: [
                { word: '大家', py: 'dàjiā', vi: 'mọi người' },
                { word: '家人', py: 'jiārén', vi: 'người nhà' },
                { word: '回家', py: 'huí jiā', vi: 'về nhà' },
                { word: '国家', py: 'guójiā', vi: 'quốc gia' }
            ]
        },
        '看': {
            icon: '👀',
            radicals: [
                { r: '手', name: 'Bộ Thủ (Bàn tay)' },
                { r: '目', name: 'Bộ Mục (Đôi mắt)' }
            ],
            story: 'Đưa bàn tay (手) lên trán che bớt nắng chói để đôi mắt (目) nhìn rõ vật ở phía xa ➔ Nghĩa là NHÌN, XEM (看).',
            family: [
                { word: '看见', py: 'kànjiàn', vi: 'nhìn thấy' },
                { word: '看书', py: 'kàn shū', vi: 'đọc sách' },
                { word: '好看', py: 'hǎokàn', vi: 'đẹp, ưa nhìn' }
            ]
        },
        '听': {
            icon: '🎧',
            radicals: [
                { r: '口', name: 'Bộ Khẩu (Cái miệng / Âm thanh)' },
                { r: '斤', name: 'Bộ Cân (Cái búa / Cân nhắc)' }
            ],
            story: 'Mở tai lắng nghe từng lời nói từ miệng (口) một cách cẩn trọng, cân nhắc (斤) từng câu chữ ➔ Nghĩa là NGHE (听).',
            family: [
                { word: '听到', py: 'tīng dào', vi: 'nghe được' },
                { word: '听说', py: 'tīngshuō', vi: 'nghe nói' },
                { word: '好听', py: 'hǎotīng', vi: 'hay, êm tai' }
            ]
        },
        '吃': {
            icon: '🍜',
            radicals: [
                { r: '口', name: 'Bộ Khẩu (Cái miệng)' },
                { r: '乞', name: 'Bộ Khất (Cầu xin / Nạp vào)' }
            ],
            story: 'Cái miệng (口) đưa thức ăn vào để nuôi sống cơ thể ➔ Nghĩa là ĂN (吃).',
            family: [
                { word: '吃饭', py: 'chī fàn', vi: 'ăn cơm' },
                { word: '好吃', py: 'hǎochī', vi: 'ngon' },
                { word: '小吃', py: 'xiǎochī', vi: 'đồ ăn vặt' }
            ]
        },
        '喝': {
            icon: '🥤',
            radicals: [
                { r: '口', name: 'Bộ Khẩu (Cái miệng)' },
                { r: '日', name: 'Mặt trời nắng gắt' }
            ],
            story: 'Trời nắng gắt cổ họng khô khát, miệng (口) cần dòng nước mát giải tỏa ➔ Nghĩa là UỐNG (喝).',
            family: [
                { word: '喝水', py: 'hē shuǐ', vi: 'uống nước' },
                { word: '喝茶', py: 'hē chá', vi: 'uống trà' }
            ]
        },
        '学': {
            icon: '🎓',
            radicals: [
                { r: '冖', name: 'Mái trường' },
                { r: '子', name: 'Bộ Tử (Học trò, con trẻ)' }
            ],
            story: 'Học trò nhỏ (子) ngồi dưới mái trường (冖) tiếp thu kiến thức và khai sáng tư duy ➔ Nghĩa là HỌC TẬP (学).',
            family: [
                { word: '学校', py: 'xuéxiào', vi: 'trường học' },
                { word: '学生', py: 'xuéshēng', vi: 'học sinh' },
                { word: '学习', py: 'xuéxí', vi: 'học tập' },
                { word: '大学', py: 'dàxué', vi: 'đại học' }
            ]
        },
        '书': {
            icon: '📚',
            radicals: [
                { r: '乛', name: 'Tay cầm bút lông' },
                { r: '丨', name: 'Nét chữ ghi chép' }
            ],
            story: 'Bàn tay cầm bút ghi chép lại lời răn dạy của người xưa trên từng trang giấy ➔ Nghĩa là SÁCH (书).',
            family: [
                { word: '书店', py: 'shūdiàn', vi: 'hiệu sách' },
                { word: '看书', py: 'kàn shū', vi: 'đọc sách' },
                { word: '买书', py: 'mǎi shū', vi: 'mua sách' }
            ]
        },
        '买': {
            icon: '🛒',
            radicals: [
                { r: '乛', name: 'Chiếc giỏ mua sắm' },
                { r: '头', name: 'Người mang tiền đi chợ' }
            ],
            story: 'Cầm tiền đi chợ chọn lựa hàng hóa bỏ vào giỏ ➔ Nghĩa là MUA (买).',
            family: [
                { word: '买单', py: 'mǎidān', vi: 'thanh toán' },
                { word: '买卖', py: 'mǎimai', vi: 'buôn bán' }
            ]
        },
        '水': {
            icon: '💧',
            radicals: [{ r: '水', name: 'Bộ Thủy (Dòng nước uốn lượn)' }],
            story: 'Hình vẽ dòng sông uốn khúc ở giữa và những bọt nước bắn tung tóe hai bên ➔ Nghĩa là NƯỚC (水).',
            family: [
                { word: '水果', py: 'shuǐguǒ', vi: 'hoa quả' },
                { word: '开水', py: 'kāishuǐ', vi: 'nước sôi' },
                { word: '喝水', py: 'hē shuǐ', vi: 'uống nước' }
            ]
        },
        '火': {
            icon: '🔥',
            radicals: [{ r: '火', name: 'Bộ Hỏa (Ngọn lửa bốc cháy)' }],
            story: 'Hình ngọn lửa bùng cháy từ củi khô, tàn lửa bay rực sáng ➔ Nghĩa là LỬA (火).',
            family: [
                { word: '火车', py: 'huǒchē', vi: 'xe lửa, tàu hỏa' },
                { word: '红火', py: 'hónghuo', vi: 'thịnh vượng, đỏ rực' }
            ]
        },
        '车': {
            icon: '🚗',
            radicals: [{ r: '车', name: 'Bộ Xa (Cỗ xe hai bánh)' }],
            story: 'Hình cỗ xe nhìn từ trên cao với bánh xe và thanh trục kéo vững chắc ➔ Nghĩa là XE CỘ (车).',
            family: [
                { word: '车站', py: 'chēzhàn', vi: 'bến xe' },
                { word: '打车', py: 'dǎchē', vi: 'bắt taxi' },
                { word: '开车', py: 'kāi chē', vi: 'lái xe' }
            ]
        },
        '钱': {
            icon: '💰',
            radicals: [
                { r: '钅', name: 'Bộ Kim (Kim loại quý)' },
                { r: '戋', name: 'Những đồng tiền xếp lớp' }
            ],
            story: 'Những đồng tiền bằng kim loại quý (钅) được xếp thành từng chồng lấp lánh ➔ Nghĩa là TIỀN (钱).',
            family: [
                { word: '钱包', py: 'qiánbāo', vi: 'ví tiền' },
                { word: '多少钱', py: 'duōshao qián', vi: 'bao nhiêu tiền' },
                { word: '有钱', py: 'yǒu qián', vi: 'giàu có' }
            ]
        },
        '朋友': {
            icon: '🤝',
            radicals: [
                { r: '月', name: 'Hai vầng trăng song hành' },
                { r: '又', name: 'Hai bàn tay nắm chặt' }
            ],
            story: 'Hai người như hai vầng trăng soi chiếu cho nhau, hai bàn tay (又) nắm chặt cùng sẻ chia ngọt bùi ➔ Nghĩa là BẠN BÈ (朋友).',
            family: [
                { word: '好朋友', py: 'hǎo péngyou', vi: 'bạn thân' },
                { word: '老朋友', py: 'lǎo péngyou', vi: 'bạn cũ' },
                { word: '交朋友', py: 'jiāo péngyou', vi: 'kết bạn' }
            ]
        },
        '医生': {
            icon: '👨‍⚕️',
            radicals: [
                { r: '匚', name: 'Hộp cứu thương / Mũi tên' },
                { r: '生', name: 'Sự sống nảy mầm' }
            ],
            story: 'Người dùng y thuật và thuốc thang để bảo vệ sự sống (生) cho muôn người ➔ Nghĩa là BÁC SĨ (医生).',
            family: [
                { word: '医院', py: 'yīyuàn', vi: 'bệnh viện' },
                { word: '看病', py: 'kàn bìng', vi: 'khám bệnh' }
            ]
        },
        '飞机': {
            icon: '✈️',
            radicals: [
                { r: '飞', name: 'Cánh chim giang rộng bay lượn' },
                { r: '机', name: 'Cỗ máy hoạt động' }
            ],
            story: 'Cỗ máy khổng lồ có cánh sải dài bay vút lên bầu trời như loài chim ➔ Nghĩa là MÁY BAY (飞机).',
            family: [
                { word: '机场', py: 'jīchǎng', vi: 'sân bay' },
                { word: '飞机场', py: 'fēijīchǎng', vi: 'phi trường' },
                { word: '起飞', py: 'qǐfēi', vi: 'cất cánh' }
            ]
        },
        '苹果': {
            icon: '🍎',
            radicals: [
                { r: '艹', name: 'Cây cỏ thực vật' },
                { r: '果', name: 'Trái ngọt trên cây' }
            ],
            story: 'Loại quả ngọt ngào mọc từ cành lá xum xuê mang hương thơm thanh mát ➔ Nghĩa là QUẢ TÁO (苹果).',
            family: [
                { word: '水果', py: 'shuǐguǒ', vi: 'trái cây' },
                { word: '苹果树', py: 'píngguǒ shù', vi: 'cây táo' }
            ]
        }
    };

    function getWordVisualData(word, vi = '', en = '') {
        const cleanWord = (word || '').trim();
        if (WORD_VISUAL_MAP[cleanWord]) {
            return WORD_VISUAL_MAP[cleanWord];
        }

        const chars = cleanWord.split('');
        const foundRadicals = [];
        let matchedIcon = null;

        chars.forEach(ch => {
            for (const [radChar, info] of Object.entries(RADICAL_MEANINGS)) {
                if (ch.includes(radChar)) {
                    foundRadicals.push({ r: radChar, name: info.name, vi: info.vi });
                    if (!matchedIcon) matchedIcon = info.icon;
                    break;
                }
            }
        });

        const viLower = (vi || '').toLowerCase();
        if (!matchedIcon) {
            if (/yêu|thích|nhớ|tình|tim|cảm/.test(viLower)) matchedIcon = '❤️';
            else if (/ăn|cơm|bánh|đói|món|thực/.test(viLower)) matchedIcon = '🍲';
            else if (/uống|nước|trà|bia|rượu|canh/.test(viLower)) matchedIcon = '🥤';
            else if (/người|bố|mẹ|anh|chị|ông|bà|con|thầy|cô|bạn/.test(viLower)) matchedIcon = '👤';
            else if (/sách|học|đọc|viết|vở|bài|chữ/.test(viLower)) matchedIcon = '📚';
            else if (/xe|đi|chạy|bước|đường|bay|tàu/.test(viLower)) matchedIcon = '🚗';
            else if (/nhà|phòng|trường|viện|quán|chợ|cửa/.test(viLower)) matchedIcon = '🏠';
            else if (/tiền|mua|bán|giá|đắt|rẻ/.test(viLower)) matchedIcon = '💰';
            else if (/thời gian|ngày|tháng|năm|giờ|sáng|tối|trưa/.test(viLower)) matchedIcon = '⏰';
            else if (/to|nhỏ|cao|thấp|dài|ngắn|nặng/.test(viLower)) matchedIcon = '📐';
            else if (/vui|buồn|cười|khóc|sợ|giận/.test(viLower)) matchedIcon = '😊';
            else matchedIcon = '✨';
        }

        if (!foundRadicals.length) {
            foundRadicals.push({ r: chars[0] || '字', name: 'Nét chữ Hán', vi: 'Bộ phận cấu thành tự nhiên' });
        }

        const story = `Chữ “${cleanWord}” mang hình tượng ${matchedIcon}, mang nghĩa “${vi || en}”. Hãy liên tưởng hình ảnh ${matchedIcon} với âm thanh và các nét chữ để khắc sâu vào tiềm thức.`;

        return {
            icon: matchedIcon,
            radicals: foundRadicals,
            story: story,
            family: []
        };
    }

    // ==================== LẶP LẠI NGẮT QUÃNG (SRS SM-2, GỘP MỌI QUYỂN) ====================
    // Logic chép từ hsk_lotrinh.js (introduce / schedule / ivLabel / updateRT), không import.
    // rating: 1 Quên · 2 Khó · 3 Nhớ · 4 Dễ. Hạn ôn (trừ "10 phút") làm tròn về đầu ngày.
    function startOfDay(t) {
        const d = new Date(t || Date.now());
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }

    // Tìm quyển & bài chứa một từ theo ID ("L1-0001", "L7-2821"…) — dùng metadata nhẹ, không cần nạp quyển
    function locateWordId(wordId) {
        const m = /^L(\d+)-(\d+)$/.exec(wordId || '');
        if (!m || typeof HSK_BOOKS_INDEX === 'undefined') return null;
        const lv = parseInt(m[1], 10);
        const num = parseInt(m[2], 10);
        for (const b of HSK_BOOKS_INDEX) {
            const sameLevel = b.level === lv || (lv >= 7 && b.level >= 7);
            if (!sameLevel) continue;
            const u = (b.units_index || []).find(x => num >= x.word_start && num <= x.word_end);
            if (u) return { bookId: b.id, unit: getUnitNum(u) };
        }
        return null;
    }

    // Thông tin hiển thị lưu kèm thẻ, để ôn được cả khi quyển chưa nạp
    function cardInfoFromWord(w) {
        return {
            hz: w.word || '',
            py: w.pinyin || '',
            vi: truncateText(w.meaning_vi || w.meaning_primary || w.meaning_en || '', 90),
            pos: w.pos_full || w.pos || ''
        };
    }

    // Bảng tra từ theo ID cho từng quyển đã nạp
    const bookWordIndex = {};
    function getBookWordIndex(bookId) {
        if (bookWordIndex[bookId]) return bookWordIndex[bookId];
        const data = getLoadedBookData(bookId);
        if (!data || !data.units) return null;
        const idx = {};
        data.units.forEach(u => (u.target_words || []).forEach(w => { idx[w.id] = { w, unit: u.unit }; }));
        bookWordIndex[bookId] = idx;
        return idx;
    }

    function findWordById(wordId) {
        const c = state.srsData[wordId];
        const loc = (c && c.b) ? { bookId: c.b } : locateWordId(wordId);
        if (loc) {
            const idx = getBookWordIndex(loc.bookId);
            if (idx && idx[wordId]) return idx[wordId].w;
        }
        return null;
    }

    // Đối tượng từ để hiển thị (đầy đủ nếu quyển đã nạp, rút gọn từ thẻ nếu chưa)
    function wordFromCard(wordId) {
        const full = findWordById(wordId);
        if (full) return full;
        const c = state.srsData[wordId] || {};
        return {
            id: wordId, num: 0, word: c.hz || '？', pinyin: c.py || '', meaning_vi: c.vi || '',
            meaning_primary: c.vi || '', meaning_en: '', pos_full: c.pos || '', pos: c.pos || '',
            han_viet: '', traditional: '', examples: [], _book: c.b || ''
        };
    }

    // Bổ sung thông tin hiển thị cho các thẻ thiếu (vd. thẻ chuyển từ Leitner) khi một quyển vừa nạp xong
    const hydratedBooks = new Set();
    function hydrateSrsFromBook(bookId) {
        if (hydratedBooks.has(bookId)) return;
        const idx = getBookWordIndex(bookId);
        if (!idx) return;
        hydratedBooks.add(bookId);
        let changed = false;
        for (const [wid, c] of Object.entries(state.srsData || {})) {
            if (!idx[wid]) continue;
            if (!c.hz || !c.b) {
                Object.assign(c, cardInfoFromWord(idx[wid].w));
                c.b = bookId;
                c.u = c.u || idx[wid].unit;
                changed = true;
            }
        }
        if (changed) persistSrs();
    }

    function persistSrs() {
        try {
            localStorage.setItem(STORAGE_KEY_SRS, JSON.stringify(state.srsData || {}));
        } catch (e) {
            console.warn('Không thể lưu dữ liệu ôn tập:', e);
        }
    }

    function loadSrsData() {
        const raw = localStorage.getItem(STORAGE_KEY_SRS);
        if (raw) {
            try { state.srsData = JSON.parse(raw) || {}; } catch (e) { state.srsData = {}; }
            return;
        }
        const old = localStorage.getItem(STORAGE_KEY_SRS_OLD);
        if (old) {
            let parsed = {};
            try { parsed = JSON.parse(old) || {}; } catch (e) { parsed = {}; }
            state.srsData = migrateLeitnerSrs(parsed);
            persistSrs();   // giữ nguyên key cũ, chỉ ghi thêm key mới
            const n = Object.keys(state.srsData).length;
            if (n) setTimeout(() => showToast('Đã chuyển dữ liệu ôn tập', `${n} từ trong Hộp từ khó cũ đã được chuyển sang lịch ôn mới.`, '🧠'), 600);
        }
    }

    // Leitner 5 hộp (0/1/3/7/14 ngày) -> SM-2: giữ hạn ôn cũ, hộp quy ra khoảng cách (iv) & số lần nhớ (reps)
    function migrateLeitnerSrs(oldData) {
        const BOX_IV = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };
        const out = {};
        const now = Date.now();
        for (const [wid, it] of Object.entries(oldData || {})) {
            if (!it || typeof it !== 'object') continue;
            const box = Math.min(5, Math.max(1, parseInt(it.box, 10) || 1));
            const loc = locateWordId(wid);
            out[wid] = {
                ef: box === 1 ? 2.3 : 2.5,
                iv: BOX_IV[box],
                reps: box - 1,
                lapses: 0,
                first: it.addedAt || now,
                last: it.lastReviewed || it.addedAt || now,
                due: typeof it.nextDue === 'number' ? it.nextDue : now,
                b: loc ? loc.bookId : '',
                u: loc ? loc.unit : 0,
                hz: '', py: '', vi: '', pos: ''
            };
        }
        return out;
    }

    function newCardBase(w, bookId, unitNum) {
        const now = Date.now();
        const loc = bookId ? { bookId, unit: unitNum || 0 } : (locateWordId(w.id) || { bookId: w._book || '', unit: 0 });
        return Object.assign({ ef: 2.5, iv: 0, reps: 0, lapses: 0, first: now, last: now, due: now,
            b: loc.bookId, u: loc.unit }, cardInfoFromWord(w));
    }

    function noteWordLearned() {
        bumpDaily('n');
        state.gamify.stats.wordsLearned = (state.gamify.stats.wordsLearned || 0) + 1;
    }

    // Đưa từ vừa học vào lịch ôn: đúng ngay lần đầu -> 1 ngày, sai -> 10 phút.
    // Từ đã có thẻ: trả lời sai thì kéo hạn ôn về trong 10 phút (không đổi khoảng cách).
    function introduceWord(w, knewIt, bookId, unitNum) {
        if (!w || !w.id) return false;
        const c = state.srsData[w.id];
        if (c) {
            if (!knewIt) c.due = Math.min(c.due || Date.now(), Date.now() + RELEARN_MS);
            if (!c.hz) Object.assign(c, cardInfoFromWord(w));
            return false;
        }
        const card = newCardBase(w, bookId, unitNum);
        card.iv = knewIt ? 1 : 0;
        card.reps = knewIt ? 1 : 0;
        card.due = knewIt ? startOfDay() + DAY_MS : Date.now() + RELEARN_MS;
        state.srsData[w.id] = card;
        noteWordLearned();
        return true;
    }

    // Mọi từ của bài vào lịch ôn (gọi khi hoàn thành kiểm tra / bài tập)
    function introduceUnitWords(unitData, wrongIds) {
        if (!unitData || !unitData.target_words) return 0;
        let added = 0;
        unitData.target_words.forEach(w => {
            if (introduceWord(w, !(wrongIds && wrongIds.has(w.id)), state.activeBookId, unitData.unit)) added++;
        });
        persistSrs();
        updateSrsHeaderBadge();
        checkBadgeUnlocks();
        return added;
    }

    function scheduleCard(c, rating) {
        const n = Object.assign({}, c);
        n.last = Date.now();
        if (rating === 1) {
            n.reps = 0; n.lapses = (n.lapses || 0) + 1; n.ef = Math.max(1.3, (n.ef || 2.5) - 0.2);
            n.iv = 0; n.due = Date.now() + RELEARN_MS;
            return n;
        }
        const ef = c.ef || 2.5;
        const civ = c.iv || 0;
        let iv;
        if (rating === 2) { iv = Math.max(1, Math.round(civ * 1.2)); n.ef = Math.max(1.3, ef - 0.15); }
        else if (rating === 3) { iv = civ < 1 ? 1 : ((c.reps || 0) <= 1 ? Math.max(3, civ + 1) : Math.round(civ * ef)); }
        else { iv = civ < 1 ? 3 : Math.round(Math.max(4, civ * ef * 1.3)); n.ef = ef + 0.15; }
        n.iv = Math.min(iv, 365); n.reps = (c.reps || 0) + 1;
        n.due = startOfDay() + n.iv * DAY_MS;
        return n;
    }

    const NEW_CARD = { ef: 2.5, iv: 0, reps: 0 };
    function srsIvLabel(c, rating) {
        const n = scheduleCard(c || NEW_CARD, rating);
        if (n.iv === 0) return '10 phút';
        if (n.iv < 30) return n.iv + ' ngày';
        if (n.iv < 365) return Math.round(n.iv / 30) + ' tháng';
        return '1 năm';
    }

    // Chấm thẻ (Flashcard / ôn tập). Từ chưa có thẻ thì tạo thẻ mới rồi chấm.
    function rateSrsWord(w, rating) {
        const id = typeof w === 'string' ? w : (w && w.id);
        if (!id) return;
        let c = state.srsData[id];
        if (!c) {
            if (typeof w === 'string') return;
            const loc = (w._book ? { bookId: w._book, unit: 0 } : null) || locateWordId(id);
            c = newCardBase(w, loc ? loc.bookId : null, loc ? loc.unit : 0);
            noteWordLearned();
        }
        const n = scheduleCard(c, rating);
        if (n.iv >= 21 && (c.iv || 0) < 21) {
            state.gamify.stats.srsMastered = (state.gamify.stats.srsMastered || 0) + 1;
        }
        state.srsData[id] = n;
        bumpDaily('r');
        if (rating >= 3) awardXp(rating === 4 ? 8 : 6, 'Ôn tập từ vựng');
        saveProgress();
        updateSrsHeaderBadge();
        checkBadgeUnlocks();
    }

    // Tốc độ nhận diện: trung bình trượt 0,6 cũ + 0,4 mới (ms), lưu ở thẻ (c.rt)
    function updateRT(wordId, ms, ok) {
        const c = state.srsData[wordId];
        if (!c) return;
        ms = Math.max(150, Math.min(ms, 15000));
        if (!ok) ms = Math.max(ms, SLOW_MS + 500);   // trả lời sai = coi như chưa nhận diện được
        c.rt = c.rt ? Math.round(c.rt * 0.6 + ms * 0.4) : Math.round(ms);
    }

    function fmtSec(ms) { return (ms / 1000).toFixed(1).replace('.', ',') + 's'; }

    function fmtUntil(ms) {
        if (ms <= 0) return 'bây giờ';
        const min = Math.round(ms / 60000);
        if (min < 60) return `${Math.max(1, min)} phút`;
        const h = Math.round(ms / 3600000);
        if (h < 24) return `${h} giờ`;
        const d = Math.round(ms / DAY_MS);
        if (d < 30) return `${d} ngày`;
        return `${Math.round(d / 30)} tháng`;
    }

    function srsStatus(c) {
        if (!c) return 'new';
        if (c.iv >= 21) return 'mastered';
        if (c.iv >= 7) return 'familiar';
        return 'learning';
    }
    const SRS_STATUS_LABEL = { new: 'Chưa học', learning: 'Đang học', familiar: 'Quen', mastered: 'Thuộc' };

    function srsBadgeText(c) {
        if (!c) return 'Từ mới';
        const left = (c.due || 0) - Date.now();
        return left <= 0 ? 'Đến hạn ôn' : `Ôn sau ${fmtUntil(left)}`;
    }

    function removeWordFromSrs(wordId) {
        if (state.srsData && state.srsData[wordId]) {
            delete state.srsData[wordId];
            saveProgress();
            updateSrsHeaderBadge();
            renderSrsModal();
        }
    }

    // Từ đến hạn của MỌI quyển (lọc theo quyển nếu cần), sắp theo hạn ôn
    function getDueCardIds(bookFilter) {
        const now = Date.now();
        return Object.keys(state.srsData || {})
            .filter(id => {
                const c = state.srsData[id];
                return c && c.due <= now && (!bookFilter || bookFilter === 'all' || c.b === bookFilter);
            })
            .sort((a, b) => state.srsData[a].due - state.srsData[b].due);
    }

    // Từ nhận diện chậm (rt ≥ 3s), chậm nhất trước
    function getSlowCardIds(bookFilter) {
        return Object.keys(state.srsData || {})
            .filter(id => {
                const c = state.srsData[id];
                return c && c.rt >= SLOW_MS && (!bookFilter || bookFilter === 'all' || c.b === bookFilter);
            })
            .sort((a, b) => state.srsData[b].rt - state.srsData[a].rt);
    }

    // Thẻ thuộc quyển đang mở (dùng cho Podcast)
    function getAllSrsWordsForCurrentBook() {
        const idx = getBookWordIndex(state.activeBookId);
        if (!idx) return [];
        return Object.keys(state.srsData || {})
            .filter(id => idx[id])
            .map(id => ({ word: idx[id].w, srs: state.srsData[id] }));
    }

    function updateSrsHeaderBadge() {
        const due = getDueCardIds('all').length;
        const badge = document.getElementById('hdrSrsCount');
        if (badge) {
            badge.textContent = due;
            badge.classList.toggle('hidden', due === 0);
        }
        const tabBadge = document.getElementById('lblTabDue');
        if (tabBadge) {
            tabBadge.textContent = due;
            tabBadge.classList.toggle('hidden', due === 0);
        }
    }

    function fillBookFilterSelect(sel, value) {
        if (!sel || typeof HSK_BOOKS_INDEX === 'undefined') return;
        const counts = {};
        Object.values(state.srsData || {}).forEach(c => { counts[c.b] = (counts[c.b] || 0) + 1; });
        sel.innerHTML = `<option value="all">📚 Mọi quyển</option>` + HSK_BOOKS_INDEX.map(b =>
            `<option value="${b.id}">${escapeHtml(b.title)}${counts[b.id] ? ` (${counts[b.id]} thẻ)` : ''}</option>`).join('');
        sel.value = value || 'all';
    }

    // ==================== LỘ TRÌNH: HOÀN THÀNH BÀI, HỌC THEO THỨ TỰ, HỌC TIẾP ====================
    function unitKeyOf(bookId, unitNum) { return `${bookId}_${unitNum}`; }
    function isUnitDone(bookId, unitNum) { return !!state.doneUnits[unitKeyOf(bookId, unitNum)]; }
    function countDoneUnits(meta) {
        return (meta.units_index || []).filter(u => isUnitDone(meta.id, getUnitNum(u))).length;
    }

    // Bài bị khóa khi bật "học theo thứ tự", bài trước chưa đạt và bản thân bài chưa đạt
    function getLockingUnit(bookId, unitNum) {
        if (!state.settings || !state.settings.sequential) return null;
        const meta = getBookIndexMeta(bookId);
        if (!meta || !meta.units_index) return null;
        const idx = meta.units_index.findIndex(u => getUnitNum(u) === unitNum);
        if (idx <= 0) return null;
        if (isUnitDone(bookId, unitNum)) return null;
        const prev = getUnitNum(meta.units_index[idx - 1]);
        return isUnitDone(bookId, prev) ? null : prev;
    }
    function isUnitLocked(bookId, unitNum) { return getLockingUnit(bookId, unitNum) !== null; }

    // Bài chưa xong kế tiếp trong một quyển (tính từ bài fromUnit, rồi quay lại đầu quyển)
    function findNextUnitInBook(bookId, fromUnit) {
        const meta = getBookIndexMeta(bookId);
        if (!meta || !meta.units_index || meta.id !== bookId) return null;
        const list = meta.units_index.map(getUnitNum);
        let start = list.indexOf(fromUnit);
        if (start < 0) start = 0;
        const order = list.slice(start).concat(list.slice(0, start));
        for (const u of order) {
            if (!isUnitDone(bookId, u) && !isUnitLocked(bookId, u)) return u;
        }
        return null;
    }

    // Đích "Học tiếp": bài chưa xong kế tiếp ở quyển đang học, hết thì sang các quyển sau
    function findContinueTarget() {
        if (typeof HSK_BOOKS_INDEX === 'undefined') return null;
        const cur = state.activeBookId;
        const u = findNextUnitInBook(cur, state.activeUnitNum);
        if (u !== null) return { bookId: cur, unit: u };
        const ids = HSK_BOOKS_INDEX.map(b => b.id);
        const i = ids.indexOf(cur);
        const order = ids.slice(i + 1).concat(ids.slice(0, Math.max(0, i)));
        for (const b of order) {
            const meta = getBookIndexMeta(b);
            const first = meta && meta.units_index.length ? getUnitNum(meta.units_index[0]) : 1;
            const nu = findNextUnitInBook(b, first);
            if (nu !== null) return { bookId: b, unit: nu };
        }
        return null;
    }

    async function continueStudy() {
        const t = findContinueTarget();
        if (!t) {
            showToast('Đã hoàn thành mọi bài!', 'Hãy tiếp tục ôn các từ đến hạn mỗi ngày.', '🏆');
            return;
        }
        if (t.bookId !== state.activeBookId) {
            await selectBook(t.bookId, t.unit);
        } else if (t.unit !== state.activeUnitNum) {
            selectUnit(t.unit);
        }
        switchStudyMode('memory');
        const meta = getBookIndexMeta(t.bookId);
        showToast('Học tiếp', `${bookLabel(meta)} · Bài ${t.unit}`, '▶');
    }

    // Chọn bài theo thao tác người dùng (tôn trọng khóa học theo thứ tự)
    function trySelectUnit(unitNum) {
        const lockBy = getLockingUnit(state.activeBookId, unitNum);
        if (lockBy !== null) {
            showToast('Bài đang khóa', `Hãy hoàn thành Bài ${lockBy} (đạt ≥ ${PASS_PCT}%) trước, hoặc tắt "Học theo thứ tự" trong Cài đặt.`, '🔒');
            return false;
        }
        selectUnit(unitNum);
        return true;
    }

    // Ghi kết quả kiểm tra / bài tập của bài đang mở: điểm cao nhất, mọi từ vào lịch ôn, đạt ≥ 80% thì hoàn thành
    function recordUnitResult(unitData, score, total, wrongIds, source) {
        const key = unitKeyOf(state.activeBookId, unitData.unit);
        const pct = total > 0 ? Math.round((score / total) * 100) : 0;
        const prev = state.practiceScores[key];
        const prevPct = prev && prev.total ? Math.round((prev.score / prev.total) * 100) : -1;
        if (pct >= prevPct) state.practiceScores[key] = { score, total, src: source };

        const added = introduceUnitWords(unitData, wrongIds);
        const wasDone = !!state.doneUnits[key];
        const passed = pct >= PASS_PCT;
        if (passed && !wasDone) {
            state.doneUnits[key] = true;
            awardXp(40, 'Hoàn thành bài học');
        }
        if (pct === 100) unlockBadge('b_unit_master');
        saveProgress();
        updateUnitActionButtons();
        const meta = getBookIndexMeta(state.activeBookId);
        if (meta) {
            renderSidebarSummary(meta);
            renderUnitList(meta);
            renderBookShelf();
        }
        renderBentoStatsCard(unitData);
        return { pct, passed, newlyDone: passed && !wasDone, added };
    }

    let srsModalFilter = 'all';
    function renderSrsModal() {
        const modal = document.getElementById('srsModal');
        const boxesBar = document.getElementById('srsBoxesBar');
        const listEl = document.getElementById('srsWordList');
        if (!modal || !boxesBar || !listEl) return;

        fillBookFilterSelect(document.getElementById('srsBookFilter'), srsModalFilter);
        const now = Date.now();
        const ids = Object.keys(state.srsData || {}).filter(id => srsModalFilter === 'all' || state.srsData[id].b === srsModalFilter);
        const counts = { due: 0, learning: 0, familiar: 0, mastered: 0, slow: 0 };
        ids.forEach(id => {
            const c = state.srsData[id];
            if (c.due <= now) counts.due++;
            counts[srsStatus(c)]++;
            if (c.rt >= SLOW_MS) counts.slow++;
        });

        boxesBar.innerHTML = [
            ['due', '🧠 Đến hạn', counts.due],
            ['learning', 'Đang học', counts.learning],
            ['familiar', 'Quen (≥ 7 ngày)', counts.familiar],
            ['mastered', 'Thuộc (≥ 21 ngày)', counts.mastered],
            ['slow', '🐢 Chậm (≥ 3s)', counts.slow]
        ].map(([k, label, n]) => `
            <div class="srs-box-chip st-${k}">
                <div class="sbc-title">${label}</div>
                <div class="sbc-count">${n}</div>
            </div>
        `).join('');

        if (!ids.length) {
            listEl.innerHTML = `
                <div class="empty-msg" style="padding:40px 16px;">
                    Chưa có từ nào trong lịch ôn. Hãy học một bài rồi làm <strong>Kiểm tra bài</strong> hoặc <strong>Bài tập SGK</strong>:
                    mọi từ của bài sẽ tự vào đây (từ đúng ôn sau 1 ngày, từ sai ôn sau 10 phút).
                </div>
            `;
            return;
        }

        const LIMIT = 300;
        const sorted = ids.sort((a, b) => state.srsData[a].due - state.srsData[b].due);
        const rows = sorted.slice(0, LIMIT).map(id => {
            const c = state.srsData[id];
            const meta = c.b ? getBookIndexMeta(c.b) : null;
            const hz = c.hz || (findWordById(id) || {}).word || id;
            return `
            <div class="srs-item-row ${c.due <= now ? 'is-due' : ''}" id="srs-row-${id}">
                <div class="sir-left">
                    <span class="sir-hz" data-speak="${escapeAttr(cleanHanziForTts(hz))}" title="Nhấn để nghe">${escapeHtml(hz)}</span>
                    <span class="sir-py">${escapeHtml(c.py || '')}</span>
                    <span class="sir-vn">${escapeHtml(c.vi || '')}</span>
                </div>
                <div class="sir-right">
                    <span class="sir-meta">${meta ? escapeHtml(meta.title) : ''}${c.u ? ` · Bài ${c.u}` : ''}</span>
                    ${c.rt ? `<span class="sir-rt ${c.rt >= SLOW_MS ? 'slow' : ''}" title="Tốc độ nhận diện trung bình">⏱ ${fmtSec(c.rt)}</span>` : ''}
                    <span class="sir-box-badge">${escapeHtml(SRS_STATUS_LABEL[srsStatus(c)])} · ${escapeHtml(srsBadgeText(c))}</span>
                    <button class="sir-remove-btn" data-remove-srs="${id}">Bỏ theo dõi</button>
                </div>
            </div>`;
        }).join('');
        listEl.innerHTML = rows + (sorted.length > LIMIT
            ? `<div class="empty-msg">… và ${sorted.length - LIMIT} từ khác (chỉ hiện ${LIMIT} từ có hạn ôn gần nhất).</div>` : '');

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

    // ==================== CÀI ĐẶT NHANH, KIỂU CHỮ & MÀU THANH ĐIỆU ====================
    // Sáng/tối do shared/theme.js quản lý (nút [data-ui-theme-toggle] trên thanh đầu trang).
    function toggleSettingsDropdown(forceState) {
        const wrapper = document.getElementById('settingsMenuWrapper') || document.getElementById('themePickerWrapper');
        const menu    = document.getElementById('settingsDropdownMenu') || document.getElementById('themeDropdownMenu');
        if (!menu) return;
        const isHidden = menu.classList.contains('hidden');
        const shouldShow = typeof forceState === 'boolean' ? forceState : isHidden;
        if (shouldShow) {
            menu.classList.remove('hidden');
            if (wrapper) wrapper.classList.add('active');
        } else {
            menu.classList.add('hidden');
            if (wrapper) wrapper.classList.remove('active');
        }
    }

    function initHanziFont() {
        const savedFont = localStorage.getItem(STORAGE_KEY_FONT) || 'calligraphy';
        applyHanziFont(savedFont);
    }

    function applyHanziFont(fontKey) {
        state.hanziFont = fontKey;
        try {
            localStorage.setItem(STORAGE_KEY_FONT, fontKey);
        } catch (e) {}

        const isCalligraphy = fontKey === 'calligraphy';
        document.body.classList.toggle('font-calligraphy', isCalligraphy);
        document.documentElement.setAttribute('data-font', fontKey);

        const lbl = document.getElementById('lblHanziFont');
        const btn = document.getElementById('btnToggleHanziFont');
        if (lbl) {
            lbl.textContent = isCalligraphy ? 'Khải Thể' : 'Chữ In';
        }
        if (btn) {
            btn.classList.toggle('active', isCalligraphy);
            btn.title = isCalligraphy 
                ? 'Đang dùng: Thư pháp Khải Thể (Bấm để đổi sang Chữ In Hiện Đại)' 
                : 'Đang dùng: Chữ In Hiện Đại (Bấm để đổi sang Thư pháp Khải Thể)';
        }
    }

    function toggleHanziFont() {
        const next = state.hanziFont === 'calligraphy' ? 'sans' : 'calligraphy';
        applyHanziFont(next);
        showToast(next === 'calligraphy' ? 'Đã chuyển sang chữ Khải Thể' : 'Đã chuyển sang chữ in hiện đại', '', '✍️');
    }

    function initToneColors() {
        const saved = localStorage.getItem(STORAGE_KEY_TONE_COLOR);
        const enabled = saved === null ? true : saved === 'true';
        applyToneColors(enabled);
    }

    function applyToneColors(enabled) {
        state.enableToneColors = enabled;
        try {
            localStorage.setItem(STORAGE_KEY_TONE_COLOR, enabled ? 'true' : 'false');
        } catch (e) {}

        document.body.classList.toggle('enable-tone-colors', enabled);

        const btn = document.getElementById('btnToggleToneColor');
        if (btn) {
            btn.classList.toggle('active', enabled);
            btn.title = enabled 
                ? 'Màu thanh điệu: BẬT (Thanh 1: Lam, 2: Lục, 3: Cam, 4: Đỏ) - Bấm để Tắt' 
                : 'Màu thanh điệu: TẮT - Bấm để BẬT';
        }
    }

    function toggleToneColors() {
        const next = !state.enableToneColors;
        applyToneColors(next);
        showToast(next ? 'Đã BẬT màu thanh điệu Pinyin' : 'Đã TẮT màu thanh điệu', '', '🎨');
        if (state.studyMode === 'memory') {
            const unitData = getCurrentUnitData();
            if (unitData) renderMemoryPane(unitData);
        }
    }

    function getToneFromPinyinSyllable(syllable) {
        if (!syllable) return 0;
        if (/[āēīōūǖ]/i.test(syllable)) return 1;
        if (/[áéíóúǘ]/i.test(syllable)) return 2;
        if (/[ǎěǐǒǔǚ]/i.test(syllable)) return 3;
        if (/[àèìòùǜ]/i.test(syllable)) return 4;
        return 0; // neutral tone
    }

    function formatPinyinWithToneColors(pinyinStr) {
        if (!pinyinStr) return '';
        const parts = pinyinStr.split(/(\s+|,|·|\/|\(|\))/);
        return parts.map(part => {
            if (/^\s+$/.test(part) || /^[,·\/\(\)]$/.test(part) || !part) return part;
            const tone = getToneFromPinyinSyllable(part);
            return `<span class="py-syl tone-${tone}">${escapeHtml(part)}</span>`;
        }).join('');
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
    }

    async function selectBook(bookId, targetUnitNum) {
        stopSpeakingAll();
        state.activeBookId = bookId;
        const meta = getBookIndexMeta(bookId);
        if (!meta) return;

        const firstUnit = meta.units_index.length ? getUnitNum(meta.units_index[0]) : 1;
        const validUnits = new Set(meta.units_index.map(u => getUnitNum(u)));
        if (targetUnitNum && validUnits.has(targetUnitNum)) {
            state.activeUnitNum = targetUnitNum;
        } else if (!validUnits.has(state.activeUnitNum)) {
            state.activeUnitNum = firstUnit;
        }
        // Học theo thứ tự: bài đang khóa -> chuyển tới bài chưa xong kế tiếp được phép học
        if (isUnitLocked(bookId, state.activeUnitNum)) {
            state.activeUnitNum = findNextUnitInBook(bookId, firstUnit) || firstUnit;
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

        const doneCount = countDoneUnits(meta);
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
        // Các bài có từ đến hạn ôn (thẻ SRS tự lưu quyển & bài)
        const now = Date.now();
        const dueUnits = new Set();
        Object.values(state.srsData || {}).forEach(c => {
            if (c.b === meta.id && c.due <= now && c.u) dueUnits.add(c.u);
        });

        const filtered = (meta.units_index || []).filter(u => {
            const uNum = getUnitNum(u);
            const key = `${meta.id}_${uNum}`;
            const isDone = !!state.doneUnits[key];
            const isStar = !!state.starredUnits[key];

            if (state.unitFilter === 'todo' && isDone) return false;
            if (state.unitFilter === 'done' && !isDone) return false;
            if (state.unitFilter === 'star' && !isStar) return false;
            if (state.unitFilter === 'srs' && !dueUnits.has(uNum)) return false;

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
            const isLocked = isUnitLocked(meta.id, uNum);
            const scoreObj = state.practiceScores[key];
            const scorePct = scoreObj && scoreObj.total ? Math.round((scoreObj.score / scoreObj.total) * 100) : null;

            return `
                <div class="unit-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${isLocked ? 'locked' : ''}"
                     data-unit-num="${uNum}" ${isLocked ? 'title="Bài đang khóa: hoàn thành bài trước (≥ 80%)"' : ''}>
                    <div class="ui-left">
                        <span class="ui-num">${isDone ? '✓ ' : (isLocked ? '🔒 ' : '')}Bài ${uNum}</span>
                        <div class="ui-info">
                            <div class="ui-range">${escapeHtml(u.range)}</div>
                            <div class="ui-py">${escapeHtml(startPy)} – ${escapeHtml(endPy)}</div>
                        </div>
                    </div>
                    <div class="ui-right">
                        <span class="ui-page">Từ ${u.word_start}–${u.word_end}</span>
                        <span style="font-size:0.72rem;">
                            ${isStar ? '⭐ ' : ''}
                            ${dueUnits.has(uNum) ? '<span class="ui-due" title="Có từ đến hạn ôn">🧠</span> ' : ''}
                            ${scorePct !== null ? `<strong class="ui-score ${scorePct >= PASS_PCT ? 'pass' : 'fail'}">${scorePct}%</strong>` : ''}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('.unit-item').forEach(el => {
            el.addEventListener('click', () => {
                const uNum = parseInt(el.getAttribute('data-unit-num'), 10);
                if (!isNaN(uNum) && trySelectUnit(uNum)) {
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
        state.practiceRevealed = false;
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
        const lblCount  = document.getElementById('lblTargetCount');

        if (badgeEl) {
            badgeEl.textContent = `Bài ${unitData.unit}`;
            if (meta) badgeEl.style.background = meta.color;
        }
        if (headingEl) headingEl.textContent = unitData.range.replace('—', ' — ');
        if (lblCount) {
            lblCount.textContent = `${unitData.target_words ? unitData.target_words.length : 20} từ`;
        }

        updateUnitActionButtons();

        renderMemoryPane(unitData);
        renderPracticePane(unitData);
        // Ôn hôm nay (gộp mọi quyển) không phụ thuộc bài đang mở: chỉ dựng lại bộ thẻ theo bài
        if (['unit', 'book', 'starred'].includes(state.fcScope) || !state.fcDeck.length) initFlashcardDeck();
        if (state.studyMode === 'games' && state.gamesSubMode === 'quiz') {
            initReflexQuiz();
        } else if (state.quizTimerId) {
            clearInterval(state.quizTimerId);
            state.quizTimerId = null;
        }
        if (state.studyMode === 'extra' && state.extraSubMode === 'bubble' && state.bubbleGame.isRunning) {
            spawnBubbleRound();
        }
        if (state.studyMode === 'extra' && state.extraSubMode === 'shadowing') {
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

        // Không còn đánh dấu tay: bài xong khi kiểm tra / bài tập đạt ≥ 80%
        const scoreObj = state.practiceScores[key];
        const bestPct = scoreObj && scoreObj.total ? Math.round((scoreObj.score / scoreObj.total) * 100) : null;
        const btnDone = document.getElementById('btnToggleUnitDone');
        if (btnDone) {
            btnDone.classList.toggle('done', isDone);
            btnDone.innerHTML = isDone
                ? `✓ <span class="hide-xs">Đã đạt${bestPct !== null ? ` ${bestPct}%` : ''}</span>`
                : `✍️ <span class="hide-xs">${bestPct !== null ? `Cao nhất ${bestPct}% · ` : ''}Kiểm tra bài</span>`;
            btnDone.title = isDone
                ? 'Bài đã hoàn thành (đạt ≥ 80%). Bấm để luyện lại.'
                : 'Bài hoàn thành khi Kiểm tra bài hoặc Bài tập SGK đạt ≥ 80%. Bấm để làm kiểm tra.';
        }

        const mobDone = document.getElementById('mobToggleDone');
        if (mobDone) {
            mobDone.classList.toggle('done-active', isDone);
            mobDone.innerHTML = isDone ? '✓ Đạt' : '✍️ Luyện';
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

    // ==================== MODE 1: BENTO DASHBOARD TỪ VỰNG ====================
    function setMemoryLayout(mode) {
        state.memoryLayout = mode;
        try {
            localStorage.setItem('hsk_wl_memory_layout', mode);
        } catch (e) {}

        const bentoGrid   = document.getElementById('bentoDashboardGrid');
        const classicList = document.getElementById('classicListContainer');
        const btnBento    = document.getElementById('btnViewBento');
        const btnClassic  = document.getElementById('btnViewClassic');

        if (btnBento)   btnBento.classList.toggle('active', mode === 'bento');
        if (btnClassic) btnClassic.classList.toggle('active', mode === 'classic');

        if (mode === 'bento') {
            if (bentoGrid)   bentoGrid.classList.remove('hidden');
            if (classicList) classicList.classList.add('hidden');
        } else {
            if (bentoGrid)   bentoGrid.classList.add('hidden');
            if (classicList) classicList.classList.remove('hidden');
        }
    }

    function renderMemoryPane(unitData) {
        if (!unitData) return;
        const words = unitData.target_words || [];
        const gQuery = state.globalSearchQuery.trim();

        // If user is searching globally in this book
        if (gQuery) {
            const listEl = document.getElementById('quickMemoryList');
            const gridEl = document.getElementById('bentoWordsGrid') || document.getElementById('targetWordsGrid');
            if (listEl && gridEl) {
                setMemoryLayout('classic');
                renderGlobalSearchInMemoryPane(gQuery, gridEl, listEl);
                return;
            }
        }

        // 1. Render Bento Dashboard View (Default modern workstation)
        renderBentoDashboard(unitData);

        // 2. Render Classic Scrollable List View (Secondary option)
        renderClassicMemoryList(unitData);

        // Apply saved layout mode (Default: 'bento')
        const savedLayout = localStorage.getItem('hsk_wl_memory_layout') || 'bento';
        setMemoryLayout(savedLayout);
    }

    function renderBentoDashboard(unitData) {
        const words = unitData.target_words || [];
        if (!words.length) return;

        // Ensure activeWordNum is valid
        if (!words.some(w => w.num === state.activeWordNum)) {
            state.activeWordNum = words[0].num;
        }

        const currentWord = words.find(w => w.num === state.activeWordNum) || words[0];

        // 1. Render Hero Word Inspector
        renderBentoHeroWord(currentWord, words.length, unitData.unit);

        // 2. Render Stats & SRS Card
        renderBentoStatsCard(unitData);

        // 3. Render Mnemonic Card
        renderBentoMnemonicCard(currentWord);

        // 4. Render 20-Word Interactive Strip
        renderBentoWordStrip(words, unitData);
    }

    function renderBentoHeroWord(w, totalWords, unitNum) {
        const heroEl = document.getElementById('bentoHeroCard');
        if (!heroEl || !w) return;

        const isStar = !!state.starredWords[w.id];
        const srsInfo = state.srsData && state.srsData[w.id];
        const isSrs = !!srsInfo;
        const cleanHz = cleanHanziForTts(w.word);
        const vData = getWordVisualData(w.word, w.meaning_vi || w.meaning_primary, w.meaning_en);
        // Vị trí trong bài (num là số thứ tự trong cả quyển: bài 2 bắt đầu từ 21)
        const unitWords = (getCurrentUnitData() || {}).target_words || [];
        const pos = Math.max(1, unitWords.findIndex(x => x.id === w.id) + 1);
        const prevW = unitWords[pos - 2];
        const nextW = unitWords[pos];
        const showTrad = w.traditional && w.traditional !== w.word && !w.word.includes(w.traditional);
        const conciseEn = formatConciseEnglish(w.meaning_en, w.meaning_vi);
        const examples = w.examples || [];

        const collocationsHtml = w.collocations
            ? `<strong>🔗 Cụm từ hay gặp:</strong> ${escapeHtml(w.collocations)} ${w.collocations_pinyin ? `<span style="color:var(--text-muted);font-size:0.8rem;">(${formatPinyinWithToneColors(w.collocations_pinyin)})</span>` : ''}`
            : '';

        heroEl.innerHTML = `
            <div class="bhc-header">
                <div class="bhc-num-tag" title="Từ số ${w.num} trong quyển">${pos} / ${totalWords}</div>
                <div class="bhc-meta-tags">
                    <span class="bhc-icon" data-hero-mnemonic="${w.id}" title="Xem tranh minh họa & chiết tự">${vData.icon}</span>
                    ${w.han_viet ? `<span class="bhc-hv-badge">Hán Việt: ${escapeHtml(w.han_viet.toUpperCase())}</span>` : ''}
                    ${w.pos_full ? `<span class="bhc-pos-badge">${escapeHtml(w.pos_full)}</span>` : ''}
                    ${isSrs ? `<span class="bhc-srs-badge">🧠 ${escapeHtml(srsBadgeText(srsInfo))}</span>` : ''}
                </div>
                <div class="bhc-quick-tools">
                    <button class="bhc-tool-btn ${isStar ? 'starred' : ''}" id="btnHeroStar" title="${isStar ? 'Bỏ lưu sao' : 'Đánh dấu sao'}">
                        ${isStar ? '⭐' : '☆'}
                    </button>
                    <button class="bhc-tool-btn" id="btnHeroSrs" title="${isSrs ? 'Bỏ khỏi lịch ôn' : 'Thêm vào lịch ôn (ôn lại sau 10 phút)'}">
                        🧠
                    </button>
                    <button class="bhc-tool-btn" id="btnHeroMnemonic" title="Xem Chiết tự & Mẹo nhớ">
                        🎨
                    </button>
                    <button class="bhc-tool-btn" id="btnHeroShadowing" title="Luyện nói AI (Shadowing)">
                        🗣️
                    </button>
                </div>
            </div>

            <div class="bhc-body">
                <div class="bhc-main-word-row">
                    <div class="bhc-hz" id="heroWordHz" title="Nhấn để nghe phát âm">${escapeHtml(w.word)}</div>
                    ${showTrad ? `<div class="bhc-trad" title="Chữ phồn thể">[${escapeHtml(w.traditional)}]</div>` : ''}
                    <div class="bhc-py">${formatPinyinWithToneColors(w.pinyin)}</div>
                    <button class="bhc-speak-hero-btn" id="btnHeroSpeak" title="Nghe phát âm chuẩn bản xứ">
                        <span class="bshb-icon">🔊</span>
                        <span class="bshb-label">Phát âm</span>
                    </button>
                </div>

                <div class="bhc-meaning-box">
                    <div class="bhc-meaning-vi">🇻🇳 ${escapeHtml(w.meaning_vi || w.meaning_primary || '')}</div>
                    ${conciseEn ? `<div class="bhc-meaning-en">🇬🇧 ${escapeHtml(conciseEn)}</div>` : ''}
                </div>

                ${collocationsHtml ? `<div class="bhc-collocations">${collocationsHtml}</div>` : ''}

                <!-- Examples Section -->
                ${examples.length ? `
                    <div class="bhc-examples-section">
                        <div class="bhes-title">💬 Câu ví dụ trong ngữ cảnh (${examples.length}):</div>
                        <div class="bhes-list">
                            ${examples.map((ex, idx) => `
                                <div class="bhes-item">
                                    <div class="bhes-hz-row">
                                        <span class="bhes-num">${idx + 1}.</span>
                                        <span class="bhes-hz">${highlightTargetWord(ex.hz, w.word)}</span>
                                        <button class="ex-speak-btn" data-speak="${escapeAttr(ex.hz)}" title="Nghe câu này">🔊</button>
                                    </div>
                                    <div class="bhes-py ${state.showPinyin ? '' : 'hidden'}">${formatPinyinWithToneColors(ex.py)}</div>
                                    <div class="bhes-vn ${state.showMeaning ? '' : 'hidden'}">${escapeHtml(ex.vn)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>

            <div class="bhc-footer">
                <button class="bhc-nav-btn" id="btnHeroPrevWord" ${!prevW ? 'disabled style="opacity:0.5"' : ''} title="Từ trước (Phím ←)">
                    ◀ Từ trước
                </button>
                <div class="bhc-counter">Từ <strong>${pos}</strong> / ${totalWords}</div>
                <button class="bhc-nav-btn" id="btnHeroNextWord" ${!nextW ? 'disabled style="opacity:0.5"' : ''} title="Từ sau (Phím →)">
                    Từ sau ▶
                </button>
            </div>
        `;

        // Bind events for Hero Card
        const btnSpeak = heroEl.querySelector('#btnHeroSpeak');
        const hzText = heroEl.querySelector('#heroWordHz');
        if (btnSpeak) btnSpeak.addEventListener('click', () => speakChinese(cleanHz, btnSpeak));
        if (hzText) hzText.addEventListener('click', () => speakChinese(cleanHz, hzText));

        const btnPrev = heroEl.querySelector('#btnHeroPrevWord');
        const btnNext = heroEl.querySelector('#btnHeroNextWord');
        if (btnPrev && prevW) btnPrev.addEventListener('click', () => selectBentoWordByNum(prevW.num));
        if (btnNext && nextW) btnNext.addEventListener('click', () => selectBentoWordByNum(nextW.num));

        const btnStar = heroEl.querySelector('#btnHeroStar');
        if (btnStar) {
            btnStar.addEventListener('click', () => {
                if (state.starredWords[w.id]) delete state.starredWords[w.id];
                else state.starredWords[w.id] = true;
                saveProgress();
                renderBentoHeroWord(w, totalWords, unitNum);
                const stripChip = document.querySelector(`.bws-chip[data-bento-num="${w.num}"]`);
                if (stripChip) {
                    const top = stripChip.querySelector('.bws-top');
                    if (top) {
                        top.innerHTML = `<span class="bws-num">#${w.num}</span>${state.starredWords[w.id] ? '<span class="bws-star">⭐</span>' : ''}`;
                    }
                }
            });
        }

        const btnSrs = heroEl.querySelector('#btnHeroSrs');
        if (btnSrs) {
            btnSrs.addEventListener('click', () => {
                if (state.srsData && state.srsData[w.id]) {
                    delete state.srsData[w.id];
                    showToast('Đã bỏ khỏi lịch ôn', 'Đã bỏ theo dõi từ vựng này', 'ℹ️');
                } else {
                    introduceWord(w, false, state.activeBookId, state.activeUnitNum);
                    showToast('Đã thêm vào lịch ôn', 'Từ sẽ đến hạn ôn sau 10 phút', '🧠');
                }
                saveProgress();
                updateSrsHeaderBadge();
                renderBentoHeroWord(w, totalWords, unitNum);
                const unitData = getCurrentUnitData();
                if (unitData) renderBentoStatsCard(unitData);
            });
        }

        const btnMnem = heroEl.querySelector('#btnHeroMnemonic');
        if (btnMnem) btnMnem.addEventListener('click', () => openMnemonicModal(w.id));

        const btnShad = heroEl.querySelector('#btnHeroShadowing');
        if (btnShad) {
            btnShad.addEventListener('click', () => {
                switchStudyMode('shadowing');
                selectShadowingWordByText(cleanHz);
            });
        }

        heroEl.querySelectorAll('.ex-speak-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const spk = btn.getAttribute('data-speak');
                if (spk) speakChinese(spk, btn);
            });
        });
    }

    function renderBentoStatsCard(unitData) {
        const statsEl = document.getElementById('bentoStatsCard');
        if (!statsEl || !unitData) return;

        const words = unitData.target_words || [];
        const totalWords = words.length;
        const uKey = `${state.activeBookId}_${unitData.unit}`;
        const isUnitDone = !!state.doneUnits[uKey];

        let srsCount = 0;
        let starredCount = 0;
        words.forEach(w => {
            if (state.srsData && state.srsData[w.id]) srsCount++;
            if (state.starredWords[w.id]) starredCount++;
        });

        // Calculate progress percentage
        // Tiến độ = tỉ lệ từ đã vào lịch ôn (đã học), bài đạt thì 100%
        const scoreObj = state.practiceScores[uKey];
        const bestPct = scoreObj && scoreObj.total ? Math.round((scoreObj.score / scoreObj.total) * 100) : null;
        const pct = isUnitDone ? 100 : Math.round((srsCount / Math.max(1, totalWords)) * 100);

        statsEl.innerHTML = `
            <div class="bsc-head">
                <div class="bsc-title">📊 Tiến Độ Bài ${unitData.unit}</div>
                <span class="bsc-badge ${isUnitDone ? 'is-done' : ''}">${isUnitDone ? '✓ Đã đạt' : (bestPct !== null ? `Cao nhất ${bestPct}%` : 'Chưa kiểm tra')}</span>
            </div>
            <div class="bsc-progress-bar-wrap">
                <div class="bsc-progress-bar-fill" style="width: ${pct}%"></div>
            </div>
            <div class="bsc-metrics-grid">
                <div class="bsc-metric-item">
                    <span class="bmi-val">${totalWords}</span>
                    <span class="bmi-label">Tổng số từ</span>
                </div>
                <div class="bsc-metric-item">
                    <span class="bmi-val" style="color:var(--accent-amber)">${starredCount}</span>
                    <span class="bmi-label">Đã lưu ⭐</span>
                </div>
                <div class="bsc-metric-item">
                    <span class="bmi-val" style="color:var(--accent-emerald)">${srsCount}</span>
                    <span class="bmi-label">Đã vào lịch ôn</span>
                </div>
            </div>
            <div class="bsc-actions">
                <button class="bsc-btn-quiz" id="btnBentoJumpQuiz" title="Kiểm tra từ vựng của bài (đạt ≥ 80% để hoàn thành)">
                    ✍️ Kiểm tra bài
                </button>
                <button class="bsc-btn-fc" id="btnBentoJumpFc" title="Lật thẻ các từ của bài này">
                    🎴 Lật thẻ
                </button>
            </div>
        `;

        const bQuiz = statsEl.querySelector('#btnBentoJumpQuiz');
        const bFc = statsEl.querySelector('#btnBentoJumpFc');
        if (bQuiz) {
            bQuiz.addEventListener('click', startUnitTest);
        }
        if (bFc) {
            bFc.addEventListener('click', () => openFlashcardScope('unit'));
        }
    }

    function renderBentoMnemonicCard(w) {
        const mnemEl = document.getElementById('bentoMnemonicCard');
        if (!mnemEl || !w) return;

        const vData = getWordVisualData(w.word, w.meaning_vi || w.meaning_primary, w.meaning_en);
        const rads = vData.radicals || [];

        const radsHtml = rads.length
            ? rads.map(r => `
                <div class="bmc-rad-chip">
                    <span class="bmc-rad-char">${escapeHtml(r.r)}</span>
                    <span>${escapeHtml(r.name)} (${escapeHtml(r.vi)})</span>
                </div>
              `).join('')
            : `<span style="font-size:0.78rem;color:var(--text-muted)">Chữ đơn thể hoặc nét cơ bản</span>`;

        mnemEl.innerHTML = `
            <div class="bmc-head">
                <div class="bmc-title">🎨 Chiết Tự: “${escapeHtml(w.word)}”</div>
                <button class="bmc-expand-btn" id="btnBmcExpand" title="Mở sơ đồ chiết tự & gia đình từ">Phóng to ↗</button>
            </div>
            <div class="bmc-radicals-row">
                ${radsHtml}
            </div>
            <div class="bmc-story-card">
                <div class="bmsc-tag">💡 Mẹo Nhớ Hình Tượng:</div>
                <div>${escapeHtml(vData.story || 'Chữ Hán tượng hình ghi nhớ qua cấu trúc bộ thủ và hình tượng truyền thống.')}</div>
            </div>
        `;

        const btnExp = mnemEl.querySelector('#btnBmcExpand');
        if (btnExp) btnExp.addEventListener('click', () => openMnemonicModal(w.id));
    }

    function renderBentoWordStrip(words, unitData) {
        const gridEl = document.getElementById('bentoWordsGrid');
        const countEl = document.getElementById('bentoWordsCount');
        if (!gridEl) return;

        if (countEl) countEl.textContent = `${words.length} từ`;

        gridEl.innerHTML = words.map(w => {
            const isActive = w.num === state.activeWordNum;
            const isStar = !!state.starredWords[w.id];
            const isSrs = state.srsData && !!state.srsData[w.id];
            const shortVi = truncateText(w.meaning_vi || w.meaning_primary || '', 20);

            return `
                <div class="bws-chip ${isActive ? 'active' : ''} ${isSrs ? 'is-learned' : ''}" data-bento-num="${w.num}">
                    <div class="bws-top">
                        <span class="bws-num">#${w.num}</span>
                        ${isStar ? '<span class="bws-star">⭐</span>' : ''}
                    </div>
                    <div class="bws-hz">${escapeHtml(w.word)}</div>
                    <div class="bws-py">${formatPinyinWithToneColors(w.pinyin)}</div>
                    <div class="bws-vi">${escapeHtml(shortVi)}</div>
                </div>
            `;
        }).join('');

        gridEl.querySelectorAll('.bws-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const num = parseInt(chip.getAttribute('data-bento-num'), 10);
                selectBentoWordByNum(num);
                const wObj = words.find(item => item.num === num);
                if (wObj) speakChinese(cleanHanziForTts(wObj.word), chip);
            });
        });
    }

    function selectBentoWordByNum(num) {
        const unitData = getCurrentUnitData();
        if (!unitData || !unitData.target_words) return;
        const words = unitData.target_words;
        const word = words.find(w => w.num === num);
        if (!word) return;

        state.activeWordNum = num;

        // 1. Update Hero Word Card
        renderBentoHeroWord(word, words.length, unitData.unit);

        // 2. Update Mnemonic Card
        renderBentoMnemonicCard(word);

        // 3. Highlight chip in Word Strip
        document.querySelectorAll('.bws-chip').forEach(chip => {
            const cNum = parseInt(chip.getAttribute('data-bento-num'), 10);
            chip.classList.toggle('active', cNum === num);
        });

        // 4. Scroll active chip into view horizontally if needed
        const activeChip = document.querySelector(`.bws-chip[data-bento-num="${num}"]`);
        if (activeChip) {
            activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    function renderClassicMemoryList(unitData) {
        const listEl = document.getElementById('quickMemoryList');
        if (!listEl || !unitData) return;

        const words = unitData.target_words || [];
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

    function setViewMode(mode) {
        state.viewMode = mode;
        try {
            localStorage.setItem('wl_view_mode', mode);
        } catch (e) {}

        const btnCompact = document.getElementById('btnViewCompact');
        const btnFull    = document.getElementById('btnViewFull');
        if (btnCompact) btnCompact.classList.toggle('active', mode === 'compact');
        if (btnFull)    btnFull.classList.toggle('active', mode === 'full');

        const listEl = document.getElementById('quickMemoryList');
        if (!listEl) return;

        listEl.querySelectorAll('.qm-word-card').forEach(card => {
            const col = card.querySelector('.qmc-collapsible-content');
            const arrow = card.querySelector('.ex-arrow');
            if (mode === 'compact') {
                card.classList.add('is-compact');
                if (col) col.classList.add('hidden');
                if (arrow) arrow.textContent = '▾';
            } else {
                card.classList.remove('is-compact');
                if (col) col.classList.remove('hidden');
                if (arrow) arrow.textContent = '▴';
            }
        });
    }

    function renderQuickMemoryCardHtml(w, unitBadgeInfo) {
        const isStar = !!state.starredWords[w.id];
        const cleanHz = cleanHanziForTts(w.word);
        const showTrad = w.traditional && w.traditional !== w.word && !w.word.includes(w.traditional);
        const conciseEn = formatConciseEnglish(w.meaning_en, w.meaning_vi);
        const srsInfo = state.srsData && state.srsData[w.id];
        const isSrs = !!srsInfo;
        const isCompact = state.viewMode === 'compact';
        const vData = getWordVisualData(w.word, w.meaning_vi || w.meaning_primary, w.meaning_en);

        const collocationsHtml = w.collocations
            ? `<div class="qmc-collocations">
                   <strong>🔗 Cụm từ thường gặp:</strong> ${escapeHtml(w.collocations)}
                   ${w.collocations_pinyin ? `<span style="color:var(--text-muted);font-size:0.78rem;"> (${formatPinyinWithToneColors(w.collocations_pinyin)})</span>` : ''}
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
                           ${ex.py ? `<div class="qmc-ex-py ${state.showPinyin ? '' : 'hidden'}">${formatPinyinWithToneColors(ex.py)}</div>` : ''}
                           ${ex.vn ? `<div class="qmc-ex-vn ${state.showMeaning ? '' : 'hidden'}">${escapeHtml(ex.vn)}</div>` : ''}
                       </div>
                   `).join('')}
               </div>`
            : '';

        return `
            <div class="qm-word-card ${isCompact ? 'is-compact' : ''}" id="qm-word-${w.num}" data-word-id="${w.id}">
                <div class="qmc-head">
                    <div class="qmc-title-group">
                        <span class="qmc-num">#${w.num}</span>
                        <button class="qmc-visual-pill" data-mnemonic-id="${w.id}" title="Xem Chiết tự & Mẹo nhớ hình ảnh (${escapeAttr(vData.icon)})">
                            <span class="qmc-vis-icon">${vData.icon}</span>
                        </button>
                        <span class="qmc-hz" data-speak="${escapeAttr(cleanHz)}" title="Nhấn để nghe phát âm">${escapeHtml(w.word)}</span>
                        ${showTrad ? `<span class="qmc-trad" title="Chữ Phồn thể">[${escapeHtml(w.traditional)}]</span>` : ''}
                        <span class="qmc-py">${formatPinyinWithToneColors(w.pinyin)}</span>
                        ${w.pos_full ? `<span class="qmc-pos">${escapeHtml(w.pos_full)}</span>` : ''}
                        ${w.han_viet ? `<span class="qmc-hv">HV: ${escapeHtml(w.han_viet)}</span>` : ''}
                        ${isSrs ? `<span class="qmc-srs-pill" title="Trong lịch ôn">🧠 ${escapeHtml(srsBadgeText(srsInfo))}</span>` : ''}
                    </div>
                    <div class="qmc-actions">
                        ${examples.length ? `
                            <button class="qmc-icon-btn qmc-toggle-ex-btn" data-toggle-ex="${w.num}" title="Gập/Mở câu ví dụ">
                                💬 ${examples.length} ví dụ <span class="ex-arrow">${isCompact ? '▾' : '▴'}</span>
                            </button>
                        ` : ''}
                        <button class="qmc-icon-btn qmc-speak-btn" data-speak="${escapeAttr(cleanHz)}" title="Nghe phát âm từ vựng">🔊</button>
                        <button class="qmc-icon-btn qmc-star-btn ${isStar ? 'starred' : ''}" data-star-id="${w.id}" title="${isStar ? 'Bỏ lưu từ này' : 'Lưu từ vựng'}">
                            ${isStar ? '⭐' : '☆'}
                        </button>

                        <div class="qmc-more-wrap">
                            <button class="qmc-icon-btn qmc-more-btn" data-more-id="${w.num}" title="Tùy chọn khác">⋯</button>
                            <div class="qmc-more-menu hidden" id="qmcMoreMenu-${w.num}">
                                <button class="qmm-item" data-mnemonic-id="${w.id}">
                                    🎨 ${vData.icon} Xem chiết tự & mẹo nhớ
                                </button>
                                <button class="qmm-item" data-srs-id="${w.id}">
                                    ${isSrs ? '🧠 Bỏ khỏi lịch ôn' : '🧠 Thêm vào lịch ôn'}
                                </button>
                                <button class="qmm-item" data-speak-word-ex="${w.num}">
                                    ▶️ Đọc từ kèm câu ví dụ
                                </button>
                                <button class="qmm-item" data-shad-word="${escapeAttr(cleanHz)}">
                                    🗣️ Luyện nói & Shadowing
                                </button>
                                ${unitBadgeInfo ? `<button class="qmm-item" data-jump-unit="${unitBadgeInfo.unit}">📖 Chuyển tới Bài ${unitBadgeInfo.unit}</button>` : ''}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="qmc-meaning-box">
                    <div class="qmc-meaning-vi">🇻🇳 ${escapeHtml(w.meaning_vi || w.meaning_primary || '')}</div>
                    ${conciseEn ? `<div class="qmc-meaning-en">🇬🇧 ${escapeHtml(conciseEn)}</div>` : ''}
                </div>

                <div class="qmc-collapsible-content ${isCompact ? 'hidden' : ''}">
                    ${collocationsHtml}
                    ${examplesHtml}
                </div>
            </div>
        `;
    }

    function selectShadowingWordByText(text) {
        if (!text) return;
        const words = getShadowingWords();
        const cleanT = cleanHanziForTts(text);
        const idx = words.findIndex(w => w.word === text || cleanHanziForTts(w.word) === cleanT);
        if (idx !== -1) {
            state.shadowing.wordIndex = idx;
            const sel = document.getElementById('shadWordSelect');
            if (sel) sel.value = idx;
            renderShadowingActiveTarget();
        }
    }

    function bindQuickMemoryCardEvents(container) {
        // Toggle individual card examples accordion
        container.querySelectorAll('[data-toggle-ex]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wNum = btn.getAttribute('data-toggle-ex');
                const card = document.getElementById(`qm-word-${wNum}`);
                if (!card) return;
                const colContent = card.querySelector('.qmc-collapsible-content');
                if (!colContent) return;
                const isHidden = colContent.classList.contains('hidden');
                colContent.classList.toggle('hidden', !isHidden);
                const arrow = btn.querySelector('.ex-arrow');
                if (arrow) arrow.textContent = isHidden ? '▴' : '▾';
            });
        });

        // More options dropdown toggle
        container.querySelectorAll('[data-more-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wNum = btn.getAttribute('data-more-id');
                const menu = document.getElementById(`qmcMoreMenu-${wNum}`);
                document.querySelectorAll('.qmc-more-menu').forEach(m => {
                    if (m !== menu) m.classList.add('hidden');
                });
                if (menu) menu.classList.toggle('hidden');
            });
        });

        // Jump to shadowing
        container.querySelectorAll('[data-shad-word]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.qmc-more-menu').forEach(m => m.classList.add('hidden'));
                const wText = btn.getAttribute('data-shad-word');
                switchStudyMode('shadowing');
                selectShadowingWordByText(wText);
            });
        });

        container.querySelectorAll('[data-speak]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                stopSpeakingAll();
                const text = el.getAttribute('data-speak');
                if (text) speakChinese(text, el);
            });
        });

        container.querySelectorAll('[data-speak-word-ex]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.qmc-more-menu').forEach(m => m.classList.add('hidden'));
                const wNum = parseInt(btn.getAttribute('data-speak-word-ex'), 10);
                const unitData = getCurrentUnitData();
                if (!unitData || !unitData.target_words) return;
                const wordObj = unitData.target_words.find(item => item.num === wNum);
                if (wordObj) {
                    startSpeakingWordsWithExamples([wordObj]);
                }
            });
        });

        // Visual Mnemonics Modal trigger
        container.querySelectorAll('[data-mnemonic-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.qmc-more-menu').forEach(m => m.classList.add('hidden'));
                const wid = btn.getAttribute('data-mnemonic-id');
                if (wid) openMnemonicModal(wid);
            });
        });

        container.querySelectorAll('[data-srs-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.qmc-more-menu').forEach(m => m.classList.add('hidden'));
                const wid = btn.getAttribute('data-srs-id');
                if (!wid) return;
                if (state.srsData && state.srsData[wid]) {
                    delete state.srsData[wid];
                    showToast('Đã bỏ theo dõi', 'Đã xóa từ khỏi lịch ôn', 'ℹ️');
                } else {
                    const wObj = findWordById(wid);
                    if (wObj) introduceWord(wObj, false);
                    showToast('Đã thêm vào lịch ôn', 'Từ sẽ đến hạn ôn sau 10 phút', '🧠');
                }
                saveProgress();
                updateSrsHeaderBadge();
                const unitData = getCurrentUnitData();
                if (unitData && !state.globalSearchQuery) {
                    renderMemoryPane(unitData);
                }
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
                    btn.textContent = '☆';
                    btn.title = 'Lưu từ vựng';
                } else {
                    state.starredWords[wid] = true;
                    btn.classList.add('starred');
                    btn.textContent = '⭐';
                    btn.title = 'Bỏ lưu từ này';
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
                document.querySelectorAll('.qmc-more-menu').forEach(m => m.classList.add('hidden'));
                const uNum = parseInt(btn.getAttribute('data-jump-unit'), 10);
                if (!isNaN(uNum) && !isUnitLocked(state.activeBookId, uNum)) {
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

    function checkPracticeAnswers(revealOnly) {
        revealOnly = revealOnly === true;   // khi gắn vào nút, tham số đầu là sự kiện click
        const unitData = getCurrentUnitData();
        if (!unitData || !unitData.exercises) return;

        const ex = unitData.exercises;
        let score = 0;
        let total = 0;
        const wrongIds = new Set();

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
                    if (targetWord) wrongIds.add(targetWord.id);
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
                        if (targetWord) wrongIds.add(targetWord.id);
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
                    if (targetWord) wrongIds.add(targetWord.id);
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

        if (revealOnly || state.practiceRevealed) {
            if (!revealOnly) {
                showToast('Không tính điểm', 'Bạn đã xem đáp án mẫu. Bấm "Làm lại" để làm và tính điểm.', 'ℹ️');
            }
            return;
        }

        const res = recordUnitResult(unitData, score, total, wrongIds, 'sgk');
        if (score > 0) {
            awardXp(score * 2, 'Luyện tập bài tập');
            playSoundEffect(res.passed ? 'badge' : 'correct');
        } else {
            playSoundEffect('wrong');
        }
        if (res.newlyDone) {
            showToast('Hoàn thành bài!', `Đạt ${res.pct}%. Mọi từ của bài đã vào lịch ôn. Bấm "Học tiếp" để sang bài mới.`, '🏆');
        } else if (!res.passed) {
            showToast(`Đạt ${res.pct}%`, `Cần ≥ ${PASS_PCT}% để hoàn thành bài. Từ làm sai sẽ được ôn lại sau 10 phút.`, '✍️');
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

        state.practiceRevealed = true;
        renderPracticePane(unitData);
        checkPracticeAnswers(true);
    }

    function resetPracticeAnswers() {
        state.practiceRevealed = false;
        state.userAnswers = {
            sec1Pinyin: {},
            sec1Meaning: {},
            sec2Cloze: {},
            sec3Mcq: {}
        };
        const unitData = getCurrentUnitData();
        if (unitData) renderPracticePane(unitData);
    }

    // ==================== ÔN TẬP: FLASHCARD SM-2 (ÔN HÔM NAY GỘP MỌI QUYỂN) ====================
    function getWordsForScope(scope) {
        const bookData = getLoadedBookData(state.activeBookId);
        const unitData = getCurrentUnitData();

        if (scope === 'due' || scope === 'srs') {
            return getDueCardIds(state.fcBookFilter).map(wordFromCard);
        }
        if (scope === 'slow') {
            return getSlowCardIds(state.fcBookFilter).map(wordFromCard);
        }
        if (!bookData) return [];

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

    // Mở tab Ôn tập với một nguồn thẻ; 'due' / 'slow' nạp trước các quyển chứa thẻ để hiện đủ ví dụ
    async function openFlashcardScope(scope) {
        state.fcScope = scope;
        const sel = document.getElementById('fcScopeSelect');
        if (sel) sel.value = scope;
        switchStudyMode('flashcard', { skipDeck: true });
        if (scope === 'due' || scope === 'slow') {
            const ids = scope === 'due' ? getDueCardIds(state.fcBookFilter) : getSlowCardIds(state.fcBookFilter);
            await ensureBooksForCardIds(ids);
        }
        initFlashcardDeck();
    }

    function initFlashcardDeck() {
        state.fcDeck = getWordsForScope(state.fcScope);
        state.fcIndex = 0;
        state.fcFlipped = false;
        const filterWrap = document.getElementById('fcBookFilterWrap');
        if (filterWrap) filterWrap.classList.toggle('hidden', !['due', 'slow', 'srs'].includes(state.fcScope));
        renderFlashcard();
    }

    function renderFlashcardEmpty(show) {
        const empty = document.getElementById('fcEmptyState');
        const cardEl = document.getElementById('fcCard3d');
        const actions = document.getElementById('fcSrsActions');
        const controls = document.querySelector('#paneFlashcard .fc-controls');
        const progress = document.querySelector('#paneFlashcard .fc-progress-container');
        [cardEl, actions, controls, progress].forEach(el => { if (el) el.classList.toggle('hidden', show); });
        if (!empty) return;
        empty.classList.toggle('hidden', !show);
        if (!show) return;

        let html;
        if (state.fcScope === 'due' || state.fcScope === 'srs') {
            const upcoming = Object.values(state.srsData || {})
                .filter(c => state.fcBookFilter === 'all' || c.b === state.fcBookFilter)
                .map(c => c.due).filter(d => d > Date.now()).sort((a, b) => a - b)[0];
            const total = Object.keys(state.srsData || {}).length;
            html = total
                ? `<div class="fes-icon">🎉</div><h3>Đã ôn xong hôm nay!</h3>
                   <p>${upcoming ? `Lần ôn kế tiếp: sau <strong>${fmtUntil(upcoming - Date.now())}</strong>.` : ''} Bạn đang theo dõi <strong>${total}</strong> từ.</p>`
                : `<div class="fes-icon">🧠</div><h3>Chưa có từ nào cần ôn</h3>
                   <p>Học một bài rồi làm <strong>Kiểm tra bài</strong>: mọi từ của bài sẽ vào lịch ôn tự động.</p>`;
        } else if (state.fcScope === 'slow') {
            html = `<div class="fes-icon">🐢</div><h3>Chưa có từ nhận diện chậm</h3>
                    <p>Tốc độ nhận diện được đo khi bạn làm trắc nghiệm "Chữ ➔ Nghĩa" và lật thẻ có mặt trước là chữ Hán. Từ trung bình ≥ ${SLOW_MS / 1000} giây sẽ hiện ở đây.</p>`;
        } else {
            html = `<div class="fes-icon">📭</div><h3>Không có thẻ</h3><p>Nguồn thẻ này đang trống.</p>`;
        }
        empty.innerHTML = html + `
            <div class="fes-actions">
                <button class="btn-primary-action" data-fes="continue">▶ Học tiếp</button>
                <button class="btn-secondary-action" data-fes="unit">🎴 Lật thẻ bài đang học</button>
            </div>`;
        empty.querySelector('[data-fes="continue"]').addEventListener('click', continueStudy);
        empty.querySelector('[data-fes="unit"]').addEventListener('click', () => openFlashcardScope('unit'));
    }

    function renderFlashcard() {
        const cardEl = document.getElementById('fcCard3d');
        if (!cardEl) return;
        cardEl.classList.toggle('flipped', state.fcFlipped);

        if (!state.fcDeck.length) {
            renderFlashcardEmpty(true);
            return;
        }
        renderFlashcardEmpty(false);

        if (state.fcIndex >= state.fcDeck.length) state.fcIndex = 0;
        const w = state.fcDeck[state.fcIndex];
        const card = state.srsData[w.id];

        // Header info
        const deckBadge = document.getElementById('fcDeckBadge');
        const srsBoxBadge = document.getElementById('fcSrsBoxBadge');
        const numBadge = document.getElementById('fcWordNumBadge');
        const progBar = document.getElementById('fcDeckProgressBar');
        const counterEl = document.getElementById('fcCounter');

        if (deckBadge) {
            const scopeLabels = {
                unit: `Bài ${state.activeUnitNum}`, due: `Còn ${state.fcDeck.length} thẻ đến hạn`, srs: `Còn ${state.fcDeck.length} thẻ đến hạn`,
                slow: `🐢 ${state.fcDeck.length} từ chậm`, starred: '⭐ Đã lưu', book: 'Toàn quyển'
            };
            deckBadge.textContent = scopeLabels[state.fcScope] || `Bài ${state.activeUnitNum}`;
        }

        if (srsBoxBadge) {
            srsBoxBadge.textContent = card ? srsBadgeText(card) : 'Từ mới';
            srsBoxBadge.classList.remove('hidden');
        }

        if (numBadge) {
            const meta = card && card.b ? getBookIndexMeta(card.b) : null;
            numBadge.textContent = (['due', 'srs', 'slow'].includes(state.fcScope) && meta)
                ? `${meta.title}${card.u ? ` · B${card.u}` : ''}`
                : (w.num ? `#${w.num}` : '');
        }
        if (counterEl) counterEl.textContent = `${state.fcIndex + 1} / ${state.fcDeck.length}`;

        if (progBar) {
            const pct = Math.round(((state.fcIndex + 1) / state.fcDeck.length) * 100);
            progBar.style.width = `${pct}%`;
        }

        // Khoảng cách tới lần ôn sau cho từng mức đánh giá
        document.querySelectorAll('[data-rate-iv]').forEach(el => {
            el.textContent = srsIvLabel(card, parseInt(el.getAttribute('data-rate-iv'), 10));
        });
        const actions = document.getElementById('fcSrsActions');
        if (actions) actions.classList.toggle('is-waiting', !state.fcFlipped);

        // Visual & Mnemonics Data
        const vData = getWordVisualData(w.word, w.meaning_vi || w.meaning_primary, w.meaning_en);

        // Front Face Display according to fcFaceMode
        const frontHz = document.getElementById('fcFrontHanzi');
        const frontSub = document.getElementById('fcFrontSub');
        const frontPos = document.getElementById('fcFrontPos');
        const frontVis = document.getElementById('fcFrontVisual');

        if (frontVis) {
            frontVis.textContent = vData.icon || '✨';
            frontVis.style.display = (state.fcFaceMode === 'visual') ? 'flex' : 'none';
        }

        if (state.fcFaceMode === 'visual') {
            if (frontHz) {
                frontHz.textContent = '❓ Đoán chữ Hán?';
                frontHz.style.fontSize = '1.75rem';
            }
            if (frontSub) frontSub.textContent = `Gợi ý nghĩa: ${w.meaning_vi || w.meaning_primary || ''}`;
            if (frontPos) frontPos.textContent = `[${w.pos_full || w.pos || 'Từ vựng'}] Nhấn thẻ để xem chữ & chiết tự`;
        } else if (state.fcFaceMode === 'vi') {
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
            // Mặc định 'hz': đo thời gian từ lúc hiện chữ tới lúc lật thẻ
            if (frontHz) {
                frontHz.textContent = w.word;
                frontHz.style.fontSize = '3.1rem';
            }
            if (frontSub) frontSub.textContent = '';
            if (frontPos) frontPos.textContent = w.pos_full || w.pos || 'Từ vựng';
        }
        if (!state.fcFlipped) {
            state.fcShownAt = performance.now();
            state.fcFlipMs = null;
        }

        // Back Face Display
        const backHz = document.getElementById('fcBackHanzi');
        const backPy = document.getElementById('fcBackPinyin');
        const backMn = document.getElementById('fcBackMeaning');
        const backHv = document.getElementById('fcBackHanViet');
        const backEx = document.getElementById('fcBackExample');
        const backVis = document.getElementById('fcBackVisual');
        const backRads = document.getElementById('fcBackRadicals');
        const backStory = document.getElementById('fcBackMnemonicStory');

        if (backVis) backVis.textContent = vData.icon || '✨';
        if (backHz) backHz.textContent = w.word;
        if (backPy) backPy.innerHTML = formatPinyinWithToneColors(w.pinyin);
        if (backMn) backMn.textContent = w.meaning_vi || w.meaning_primary || w.meaning_en;

        if (backHv) {
            if (w.han_viet) {
                backHv.textContent = `Hán Việt: ${w.han_viet.toUpperCase()}`;
                backHv.classList.remove('hidden');
            } else {
                backHv.classList.add('hidden');
            }
        }

        if (backRads) {
            if (vData.radicals && vData.radicals.length) {
                backRads.innerHTML = vData.radicals.map(r => `
                    <span class="fcm-rad-chip" title="${escapeAttr(r.name)}: ${escapeAttr(r.vi)}">
                        <strong class="fcm-rc-char">${escapeHtml(r.r)}</strong>
                        <span class="fcm-rc-info">${escapeHtml(r.name)} (${escapeHtml(r.vi)})</span>
                    </span>
                `).join('');
            } else {
                backRads.innerHTML = '';
            }
        }

        if (backStory) {
            backStory.textContent = vData.story || '';
        }

        if (backEx) {
            const ex = (w.examples && w.examples[0]) ? w.examples[0] : null;
            backEx.innerHTML = ex
                ? `<div><strong>${escapeHtml(ex.hz)}</strong></div>
                   <div class="fc-ex-py">${escapeHtml(ex.py || '')}</div>
                   <div class="fc-ex-vn">${escapeHtml(ex.vn || '')}</div>`
                : (card && card.rt ? `<div class="fc-ex-vn">⏱ Tốc độ nhận diện trung bình: ${fmtSec(card.rt)}</div>` : '');
        }

        // Auto speak on flip
        if (state.fcFlipped && state.fcAutoSpeak && state.fcFaceMode !== 'audio') {
            speakChinese(cleanHanziForTts(w.word));
        }
    }

    function flipFlashcard() {
        if (!state.fcDeck.length) return;
        if (!state.fcFlipped && state.fcShownAt) {
            state.fcFlipMs = performance.now() - state.fcShownAt;
        }
        state.fcFlipped = !state.fcFlipped;
        playSoundEffect('flip');
        renderFlashcard();
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
        // Phải lật thẻ (tự nhớ lại) trước khi chấm
        if (!state.fcFlipped) {
            flipFlashcard();
            return;
        }

        const flipMs = state.fcFlipMs;
        rateSrsWord(w, rating);
        if (state.fcFaceMode === 'hz' && flipMs) updateRT(w.id, flipMs, rating >= 2);
        state.gamify.stats.flashcardsFlipped = (state.gamify.stats.flashcardsFlipped || 0) + 1;
        checkBadgeUnlocks();
        saveProgress();
        playSoundEffect(rating === 1 ? 'wrong' : 'correct');

        if (['due', 'srs'].includes(state.fcScope)) {
            // Ôn hôm nay: thẻ đã chấm rời khỏi hàng; "Quên" thì xếp lại cuối hàng để gặp lại trong phiên
            state.fcDeck.splice(state.fcIndex, 1);
            if (rating === 1) state.fcDeck.push(w);
            if (state.fcIndex >= state.fcDeck.length) state.fcIndex = 0;
            state.fcFlipped = false;
            renderFlashcard();
        } else {
            advanceFlashcard(1);
        }
    }

    // ==================== LUYỆN TẬP: KIỂM TRA BÀI & TRẮC NGHIỆM (TÍNH GIỜ, ĐO TỐC ĐỘ) ====================
    function isQuizActive() {
        return state.studyMode === 'games' && state.gamesSubMode === 'quiz';
    }

    function shuffleArr(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function clearQuizTimers() {
        if (state.quizTimerId) {
            clearInterval(state.quizTimerId);
            state.quizTimerId = null;
        }
        if (state.quizAdvanceId) {
            clearTimeout(state.quizAdvanceId);
            state.quizAdvanceId = null;
        }
    }

    function showQuizResultBox(html) {
        const box = document.getElementById('quizResultBox');
        const qBox = document.getElementById('quizQuestionBox');
        const opts = document.getElementById('quizOptions');
        const bottom = document.querySelector('#subPaneQuiz .quiz-bottom-bar');
        const show = !!html;
        if (box) {
            box.classList.toggle('hidden', !show);
            box.innerHTML = html || '';
        }
        [qBox, opts, bottom].forEach(el => { if (el) el.classList.toggle('hidden', show); });
        return box;
    }

    // Kiểm tra bài: mỗi từ của bài hỏi 1 lần, đạt ≥ 80% thì bài hoàn thành
    function startUnitTest() {
        state.quizScope = 'test';
        const sel = document.getElementById('quizScopeSelect');
        if (sel) sel.value = 'test';
        switchStudyMode('games');
        switchGamesSubMode('quiz');
    }

    async function startSlowPractice() {
        state.quizScope = 'slow';
        state.quizType = 'hz_to_vn';
        document.querySelectorAll('.qtype-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-qtype') === 'hz_to_vn'));
        const sel = document.getElementById('quizScopeSelect');
        if (sel) sel.value = 'slow';
        if (!state.quizTimerEnabled) {
            state.quizTimerEnabled = true;
            const btn = document.getElementById('btnQuizToggleTimer');
            const lbl = document.getElementById('lblQuizTimerStatus');
            if (btn) btn.classList.add('active');
            if (lbl) lbl.textContent = 'BẬT';
        }
        await ensureBooksForCardIds(getSlowCardIds('all'));
        switchStudyMode('games');
        switchGamesSubMode('quiz');
    }

    async function initReflexQuiz() {
        clearQuizTimers();
        state.quizCorrect = 0;
        state.quizTotal = 0;
        state.quizStreak = 0;
        state.quizCurrentQ = null;
        updateQuizScoreUI();
        updateQuizStreakUI();
        showQuizResultBox('');

        const scope = state.quizScope;
        if (scope === 'test') {
            const unitData = getCurrentUnitData();
            const words = (unitData && unitData.target_words) ? unitData.target_words : [];
            state.quizTest = { deck: shuffleArr(words), idx: 0, correct: 0, wrong: new Set(), rt: {}, unit: unitData ? unitData.unit : 0 };
            state.quizPool = words.slice();
        } else {
            state.quizTest = null;
            if (scope === 'slow' || scope === 'due') {
                const ids = scope === 'slow' ? getSlowCardIds('all') : getDueCardIds('all');
                await ensureBooksForCardIds(ids);
                state.quizPool = ids.map(wordFromCard);
            } else {
                state.quizPool = getWordsForScope('unit');
            }
        }
        updateQuizTestProgress();

        if (!state.quizPool.length) {
            const msg = scope === 'slow'
                ? `<div class="qrb-icon">🐢</div><h3>Chưa có từ nhận diện chậm</h3><p>Hãy làm trắc nghiệm "Chữ ➔ Nghĩa" hoặc ôn thẻ có mặt trước là chữ Hán. Từ có thời gian trung bình ≥ ${SLOW_MS / 1000}s sẽ được gom vào đây.</p>`
                : (scope === 'due'
                    ? `<div class="qrb-icon">🎉</div><h3>Không có từ đến hạn</h3><p>Bạn đã ôn hết từ đến hạn hôm nay.</p>`
                    : `<div class="qrb-icon">📭</div><h3>Bài này chưa có từ vựng</h3>`);
            showQuizResultBox(msg);
            return;
        }
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

    function updateQuizTestProgress() {
        const lbl = document.getElementById('quizTestProgress');
        const wrap = document.getElementById('quizTestBarWrap');
        const fill = document.getElementById('quizTestBar');
        const t = state.quizTest;
        if (t) {
            const n = t.deck.length;
            const cur = Math.min(t.idx + 1, n);
            if (lbl) lbl.textContent = `Câu ${cur}/${n} · đúng ${t.correct}`;
            if (wrap) wrap.classList.remove('hidden');
            if (fill) fill.style.width = `${n ? Math.round((t.idx / n) * 100) : 0}%`;
        } else {
            const labels = { unit: 'Luyện tự do — không tính hoàn thành bài', slow: `🐢 ${state.quizPool.length} từ chậm · đo lại tốc độ`, due: `🧠 ${state.quizPool.length} từ đến hạn` };
            if (lbl) lbl.textContent = labels[state.quizScope] || '';
            if (wrap) wrap.classList.add('hidden');
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

        if (!isQuizActive() || !state.quizTimerEnabled) {
            timerWrap.classList.add('hidden');
            return;
        }
        timerWrap.classList.remove('hidden');

        const totalMs = 10000;
        const intervalMs = 100;
        let remaining = totalMs;
        timerFill.style.width = '100%';

        state.quizTimerId = setInterval(() => {
            if (!isQuizActive() || state.quizAnswered) {
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
        if (!isQuizActive() || state.quizAnswered || !state.quizCurrentQ) return;
        const target = state.quizCurrentQ.target;
        processQuizAnswer(false, 10000);
        showToast('Hết giờ!', `Đáp án đúng là: “${target.word}” (${target.meaning_vi || target.meaning_primary})`, '⏰');

        const optsEl = document.getElementById('quizOptions');
        if (optsEl) {
            optsEl.querySelectorAll('.quiz-opt-btn').forEach(b => {
                if (b.getAttribute('data-quiz-id') === target.id) {
                    b.classList.add('correct');
                }
            });
        }
    }

    // Đáp án nhiễu: ưu tiên từ cùng nhóm, thiếu thì lấy thêm từ bài/quyển đang mở
    function pickDistractors(target, n) {
        const seen = new Set([target.id]);
        const tMean = (target.meaning_vi || target.meaning_primary || '').trim();
        const out = [];
        const sources = [state.quizPool, (getCurrentUnitData() || {}).target_words || []];
        const bookData = getLoadedBookData(state.activeBookId);
        if (bookData && bookData.units) {
            sources.push(shuffleArr(bookData.units).slice(0, 6).flatMap(u => u.target_words || []));
        }
        for (const src of sources) {
            for (const w of shuffleArr(src || [])) {
                if (out.length >= n) return out;
                if (!w || seen.has(w.id) || w.word === target.word) continue;
                if ((w.meaning_vi || w.meaning_primary || '').trim() === tMean) continue;
                seen.add(w.id);
                out.push(w);
            }
        }
        return out;
    }

    function nextReflexQuizQuestion() {
        clearQuizTimers();

        let target;
        const t = state.quizTest;
        if (t) {
            if (t.idx >= t.deck.length) {
                finishUnitTest();
                return;
            }
            target = t.deck[t.idx];
        } else {
            const pool = state.quizPool;
            if (!pool.length) return;
            const prevId = state.quizCurrentQ && state.quizCurrentQ.target ? state.quizCurrentQ.target.id : null;
            const candidates = pool.length > 1 ? pool.filter(w => w.id !== prevId) : pool;
            target = candidates[Math.floor(Math.random() * candidates.length)];
        }
        updateQuizTestProgress();

        const distractors = pickDistractors(target, 3);
        const options = shuffleArr([target, ...distractors]);
        state.quizCurrentQ = { target, options };
        state.quizAnswered = false;

        const wordEl = document.getElementById('quizPromptWord');
        const pyEl   = document.getElementById('quizPromptPinyin');
        const btnSpk = document.getElementById('btnQuizSpeak');
        const optsEl = document.getElementById('quizOptions');

        const letters = ['A', 'B', 'C', 'D'];

        if (state.quizType === 'vn_to_hz') {
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
                        <strong class="qo-hz">${escapeHtml(opt.word)}</strong>
                        <span class="qo-py">(${escapeHtml(opt.pinyin)})</span>
                    </button>
                `).join('');
            }
        } else if (state.quizType === 'audio_to_hz') {
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
                        <strong class="qo-hz">${escapeHtml(opt.word)}</strong>
                        <span class="qo-mean">— ${escapeHtml(opt.meaning_vi || opt.meaning_primary)}</span>
                    </button>
                `).join('');
            }
        } else {
            // 'hz_to_vn': nhận diện chữ Hán -> đo tốc độ nhận diện
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
                        <span class="qo-text">${escapeHtml(opt.meaning_vi || opt.meaning_primary || opt.meaning_en)}</span>
                    </button>
                `).join('');
            }
        }

        bindQuizOptionEvents();
        state.quizShownAt = performance.now();
        startQuizTimer();
    }

    // Ghi nhận một câu trả lời: điểm, SRS, tốc độ nhận diện
    function processQuizAnswer(isCorrect, ms) {
        const target = state.quizCurrentQ.target;
        state.quizAnswered = true;
        state.quizTotal += 1;
        clearQuizTimers();
        const measureRT = state.quizType === 'hz_to_vn';

        if (isCorrect) {
            state.quizCorrect += 1;
            state.quizStreak += 1;
            state.gamify.stats.quizzesCompleted = (state.gamify.stats.quizzesCompleted || 0) + 1;
            state.gamify.stats.quizStreakBest = Math.max(state.gamify.stats.quizStreakBest || 0, state.quizStreak);
            awardXp(10 + Math.min(20, state.quizStreak * 2), 'Trả lời đúng');
        } else {
            state.quizStreak = 0;
        }

        const t = state.quizTest;
        if (t) {
            // Kiểm tra bài: từ vào lịch ôn khi kết thúc bài kiểm tra
            if (isCorrect) t.correct += 1;
            else t.wrong.add(target.id);
            if (measureRT) t.rt[target.id] = { ms, ok: isCorrect };
            t.idx += 1;
            updateQuizTestProgress();
        } else {
            const card = state.srsData[target.id];
            if (state.quizScope === 'due' && card && card.due <= Date.now()) {
                rateSrsWord(target, isCorrect ? 3 : 1);
            } else {
                introduceWord(target, isCorrect);
            }
            if (measureRT) updateRT(target.id, ms, isCorrect);
            saveProgress();
            updateSrsHeaderBadge();
            if (!isCorrect) {
                showToast('Sẽ ôn lại sau 10 phút', `“${target.word}” — ${target.meaning_vi || target.meaning_primary || ''}`, '🧠');
            }
        }
        updateQuizScoreUI();
        updateQuizStreakUI();

        // Kiểm tra bài: trả lời đúng thì tự sang câu sau
        if (t && isCorrect) {
            state.quizAdvanceId = setTimeout(() => {
                state.quizAdvanceId = null;
                if (isQuizActive() && state.quizTest === t) nextReflexQuizQuestion();
            }, 750);
        }
    }

    function bindQuizOptionEvents() {
        const optsEl = document.getElementById('quizOptions');
        if (!optsEl || !state.quizCurrentQ) return;
        const target = state.quizCurrentQ.target;

        optsEl.querySelectorAll('.quiz-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (state.quizAnswered) return;
                const ms = performance.now() - state.quizShownAt;
                const isCorrect = btn.getAttribute('data-quiz-id') === target.id;

                if (isCorrect) {
                    btn.classList.add('correct');
                    playSoundEffect('correct');
                    speakChinese(cleanHanziForTts(target.word));
                } else {
                    btn.classList.add('wrong');
                    playSoundEffect('wrong');
                    optsEl.querySelectorAll('.quiz-opt-btn').forEach(b => {
                        if (b.getAttribute('data-quiz-id') === target.id) b.classList.add('correct');
                    });
                }
                processQuizAnswer(isCorrect, ms);
            });
        });
    }

    function finishUnitTest() {
        const t = state.quizTest;
        const unitData = getCurrentUnitData();
        if (!t || !unitData) return;
        clearQuizTimers();
        const total = t.deck.length;
        const res = recordUnitResult(unitData, t.correct, total, t.wrong, 'test');
        Object.entries(t.rt).forEach(([id, r]) => updateRT(id, r.ms, r.ok));
        persistSrs();
        playSoundEffect(res.passed ? 'badge' : 'wrong');
        state.quizTest = Object.assign({}, t, { finished: true });

        const wrongWords = t.deck.filter(w => t.wrong.has(w.id));
        const next = findContinueTarget();
        const box = showQuizResultBox(`
            <div class="qrb-icon">${res.passed ? '🏆' : '💪'}</div>
            <h3>${res.passed ? 'Đạt! Bài đã hoàn thành' : 'Chưa đạt'} — ${res.pct}%</h3>
            <p>Đúng <strong>${t.correct}/${total}</strong> từ. ${res.passed ? '' : `Cần ≥ ${PASS_PCT}% để hoàn thành bài. `}
               Mọi từ của bài đã vào lịch ôn: từ đúng ôn sau 1 ngày, từ sai ôn sau 10 phút.</p>
            ${wrongWords.length ? `<div class="qrb-wrong">${wrongWords.map(w => `
                <span class="qrb-chip"><strong>${escapeHtml(w.word)}</strong> ${escapeHtml(w.pinyin)} — ${escapeHtml(truncateText(w.meaning_vi || w.meaning_primary || '', 40))}</span>`).join('')}</div>` : ''}
            <div class="qrb-actions">
                ${res.passed && next ? `<button class="btn-primary-action" data-qrb="next">▶ Học tiếp: Bài ${next.unit}${next.bookId !== state.activeBookId ? ' (' + escapeHtml(getBookIndexMeta(next.bookId).title) + ')' : ''}</button>` : ''}
                <button class="${res.passed ? 'btn-secondary-action' : 'btn-primary-action'}" data-qrb="retry">🔁 Làm lại</button>
                ${!res.passed ? `<button class="btn-secondary-action" data-qrb="learn">📖 Xem lại từ</button>` : ''}
                <button class="btn-ghost-action" data-qrb="sgk">📝 Bài tập SGK</button>
            </div>
        `);
        if (!box) return;
        const on = (k, fn) => { const b = box.querySelector(`[data-qrb="${k}"]`); if (b) b.addEventListener('click', fn); };
        on('next', continueStudy);
        on('retry', initReflexQuiz);
        on('learn', () => switchStudyMode('memory'));
        on('sgk', () => switchGamesSubMode('practice'));
    }

    // ==================== CHUYỂN CHẾ ĐỘ HỌC ====================
    // Luồng chính: Học từ (memory) → Luyện tập (games: kiểm tra bài + bài tập SGK) → Ôn tập (flashcard)
    // Phụ: Trò chơi · Luyện nói (extra: bắn bong bóng + luyện nói)
    function stopBubbleGameIfRunning() {
        if (state.bubbleGame && state.bubbleGame.isRunning) {
            if (state.bubbleGame.timerId) clearInterval(state.bubbleGame.timerId);
            state.bubbleGame.timerId = null;
            state.bubbleGame.isRunning = false;
        }
    }

    function switchStudyMode(mode, opts) {
        opts = opts || {};
        // Tên cũ / lối tắt
        if (mode === 'quiz' || mode === 'practice') {
            state.gamesSubMode = mode;
            mode = 'games';
        } else if (mode === 'bubble' || mode === 'shadowing') {
            state.extraSubMode = mode;
            mode = 'extra';
        }

        // Dọn bộ đếm giờ khi rời chế độ
        if (state.studyMode === 'games' && mode !== 'games') clearQuizTimers();
        if (state.studyMode === 'extra' && mode !== 'extra') stopBubbleGameIfRunning();

        state.studyMode = mode;
        document.querySelectorAll('.sm-tab').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-smode') === mode);
        });
        document.querySelectorAll('.smode-pane').forEach(pane => {
            pane.classList.remove('active');
        });

        const map = { memory: 'paneMemory', flashcard: 'paneFlashcard', games: 'paneGames', extra: 'paneExtra' };
        const targetPane = document.getElementById(map[mode]);
        if (targetPane) targetPane.classList.add('active');

        if (mode === 'flashcard') {
            if (!opts.skipDeck) initFlashcardDeck();
        } else if (mode === 'games') {
            switchGamesSubMode(state.gamesSubMode || 'quiz');
        } else if (mode === 'extra') {
            switchExtraSubMode(state.extraSubMode || 'bubble');
        }

        const stage = document.getElementById('unitStageScroll');
        if (stage) stage.scrollTop = 0;
    }

    function switchGamesSubMode(subMode) {
        if (subMode !== 'quiz' && subMode !== 'practice') subMode = 'quiz';
        if (state.gamesSubMode === 'quiz' && subMode !== 'quiz') clearQuizTimers();
        state.gamesSubMode = subMode;

        document.querySelectorAll('.ghh-tab').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-gsub') === subMode);
        });
        document.querySelectorAll('.gsub-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        const targetSubPane = document.getElementById(subMode === 'quiz' ? 'subPaneQuiz' : 'subPanePractice');
        if (targetSubPane) targetSubPane.classList.add('active');

        if (subMode === 'quiz') initReflexQuiz();
    }

    function switchExtraSubMode(subMode) {
        if (subMode !== 'bubble' && subMode !== 'shadowing') subMode = 'bubble';
        if (state.extraSubMode === 'bubble' && subMode !== 'bubble') stopBubbleGameIfRunning();
        state.extraSubMode = subMode;

        document.querySelectorAll('.xsub-tab').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-xsub') === subMode);
        });
        const bubblePane = document.getElementById('subPaneBubble');
        const shadPane = document.getElementById('paneShadowing');
        if (bubblePane) bubblePane.classList.toggle('active', subMode === 'bubble');
        if (shadPane) shadPane.classList.toggle('active', subMode === 'shadowing');

        if (subMode === 'bubble') initBubbleGame();
        else initShadowingStudio();
    }

    // ==================== WORD BUBBLE POP GAME CONTROLLER ====================
    const BUBBLE_THEMES = [
        { bg: 'radial-gradient(circle at 32% 28%, rgba(56, 189, 248, 0.42), rgba(14, 165, 233, 0.16))', border: 'rgba(56, 189, 248, 0.65)', shadow: '0 8px 24px rgba(14, 165, 233, 0.35)' },
        { bg: 'radial-gradient(circle at 32% 28%, rgba(244, 114, 182, 0.42), rgba(236, 72, 153, 0.16))', border: 'rgba(244, 114, 182, 0.65)', shadow: '0 8px 24px rgba(236, 72, 153, 0.35)' },
        { bg: 'radial-gradient(circle at 32% 28%, rgba(167, 139, 250, 0.42), rgba(139, 92, 246, 0.16))', border: 'rgba(167, 139, 250, 0.65)', shadow: '0 8px 24px rgba(139, 92, 246, 0.35)' },
        { bg: 'radial-gradient(circle at 32% 28%, rgba(52, 211, 153, 0.42), rgba(16, 185, 129, 0.16))', border: 'rgba(52, 211, 153, 0.65)', shadow: '0 8px 24px rgba(16, 185, 129, 0.35)' },
        { bg: 'radial-gradient(circle at 32% 28%, rgba(251, 191, 36, 0.42), rgba(245, 158, 11, 0.16))', border: 'rgba(251, 191, 36, 0.65)', shadow: '0 8px 24px rgba(245, 158, 11, 0.35)' }
    ];

    function initBubbleGame() {
        const arena = document.getElementById('bubbleArena');
        const overlay = document.getElementById('bubbleStartOverlay');
        const resModal = document.getElementById('bpopResultModal');
        const btnRestart = document.getElementById('btnBpopRestart');
        const btnStart = document.getElementById('btnBpopStart');

        if (resModal) resModal.classList.add('hidden');

        if (!state.bubbleGame.isRunning) {
            if (overlay) overlay.classList.remove('hidden');
            if (btnRestart) btnRestart.classList.add('hidden');
            if (btnStart) btnStart.classList.remove('hidden');
            if (arena) {
                arena.querySelectorAll('.game-bubble').forEach(b => b.remove());
            }
        }
        updateBubbleHUD();
    }

    function startBubbleGame() {
        if (state.bubbleGame.timerId) {
            clearInterval(state.bubbleGame.timerId);
            state.bubbleGame.timerId = null;
        }

        state.bubbleGame.isRunning = true;
        state.bubbleGame.score = 0;
        state.bubbleGame.combo = 1;
        state.bubbleGame.maxCombo = 1;
        state.bubbleGame.lives = 3;
        state.bubbleGame.timeLeft = 60;
        state.bubbleGame.poppedCount = 0;

        const overlay = document.getElementById('bubbleStartOverlay');
        const resModal = document.getElementById('bpopResultModal');
        const btnRestart = document.getElementById('btnBpopRestart');
        const btnStart = document.getElementById('btnBpopStart');

        if (overlay) overlay.classList.add('hidden');
        if (resModal) resModal.classList.add('hidden');
        if (btnRestart) btnRestart.classList.remove('hidden');
        if (btnStart) btnStart.classList.add('hidden');

        updateBubbleHUD();
        spawnBubbleRound();

        state.bubbleGame.timerId = setInterval(() => {
            if (!state.bubbleGame.isRunning) return;
            state.bubbleGame.timeLeft -= 1;
            updateBubbleHUD();

            if (state.bubbleGame.timeLeft <= 0) {
                endBubbleGame(true);
            }
        }, 1000);
    }

    function spawnBubbleRound() {
        const arena = document.getElementById('bubbleArena');
        if (!arena) return;

        // Clean previous bubbles
        arena.querySelectorAll('.game-bubble').forEach(b => b.remove());

        // Pool words: prefer current unit
        const curUnit = getCurrentUnitData();
        let pool = (curUnit && curUnit.target_words && curUnit.target_words.length >= 4)
            ? [...curUnit.target_words]
            : (state.fcDeck && state.fcDeck.length >= 4)
                ? [...state.fcDeck]
                : [];

        if (pool.length < 4) {
            const bMeta = getLoadedBookData(state.activeBookId);
            if (bMeta && bMeta.units) {
                bMeta.units.forEach(u => {
                    if (u.target_words) pool.push(...u.target_words);
                });
            }
        }

        if (pool.length < 4) {
            pool = [
                { word: '爱', pinyin: 'ài', meaning_vi: 'yêu, thích', pos_full: 'Động từ' },
                { word: '八', pinyin: 'bā', meaning_vi: 'số tám (8)', pos_full: 'Số từ' },
                { word: '爸爸', pinyin: 'bàba', meaning_vi: 'bố, cha', pos_full: 'Danh từ' },
                { word: '杯子', pinyin: 'bēizi', meaning_vi: 'cốc, chén', pos_full: 'Danh từ' }
            ];
        }

        // Pick 1 target
        const target = pool[Math.floor(Math.random() * pool.length)];
        state.bubbleGame.target = target;

        // Pick 3 distractors
        const otherWords = pool.filter(w => w.word !== target.word);
        otherWords.sort(() => Math.random() - 0.5);
        const options = [target, otherWords[0], otherWords[1], otherWords[2]];
        options.sort(() => Math.random() - 0.5);

        // Update Prompt in HUD
        const promptText = document.getElementById('bpopPromptText');
        const promptSub = document.getElementById('bpopPromptSub');
        const vTarget = getWordVisualData(target.word, target.meaning_vi || target.meaning_primary, target.meaning_en);

        if (state.bubbleGame.mode === 'audio_to_hz') {
            if (promptText) promptText.textContent = `🔊 Nghe phát âm & Bắn chữ`;
            if (promptSub) promptSub.textContent = `[${target.pos_full || target.pos || 'Từ vựng'}] ${vTarget.icon}`;
            speakChinese(cleanHanziForTts(target.word));
        } else if (state.bubbleGame.mode === 'py_to_hz') {
            if (promptText) promptText.textContent = target.pinyin;
            if (promptSub) promptSub.textContent = `[${target.pos_full || target.pos || 'Từ vựng'}] ${vTarget.icon}`;
        } else {
            // Default vn_to_hz
            if (promptText) promptText.textContent = target.meaning_vi || target.meaning_primary || target.meaning_en;
            if (promptSub) promptSub.textContent = `[${target.pos_full || target.pos || 'Từ vựng'}] ${vTarget.icon}`;
        }

        // Slot positions across width: [8%, 32%, 56%, 80%] with gentle jitter
        const slots = [8, 32, 56, 80];
        slots.sort(() => Math.random() - 0.5);

        options.forEach((optWord, i) => {
            const vData = getWordVisualData(optWord.word, optWord.meaning_vi || optWord.meaning_primary, optWord.meaning_en);
            const theme = BUBBLE_THEMES[i % BUBBLE_THEMES.length];
            const slotX = slots[i];
            const jitterX = (Math.random() * 8) - 4;
            const leftPct = Math.max(5, Math.min(85, slotX + jitterX));
            const floatDur = (3.2 + Math.random() * 1.6).toFixed(2);
            const floatDelay = -(Math.random() * 2).toFixed(2);

            const bubble = document.createElement('div');
            bubble.className = 'game-bubble';
            bubble.setAttribute('data-hz', optWord.word);
            bubble.style.left = `${leftPct}%`;
            bubble.style.background = theme.bg;
            bubble.style.borderColor = theme.border;
            bubble.style.boxShadow = theme.shadow;
            bubble.style.animationDuration = `${floatDur}s`;
            bubble.style.animationDelay = `${floatDelay}s`;

            bubble.innerHTML = `
                <span class="gb-icon">${vData.icon}</span>
                <span class="gb-hz">${escapeHtml(optWord.word)}</span>
                <span class="gb-py">${escapeHtml(optWord.pinyin || '')}</span>
            `;

            bubble.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!state.bubbleGame.isRunning) return;
                const isCorrect = (optWord.word === state.bubbleGame.target.word);
                handleBubbleClick(bubble, optWord, isCorrect);
            });

            arena.appendChild(bubble);
        });
    }

    function handleBubbleClick(bubbleEl, wordObj, isCorrect) {
        if (bubbleEl.classList.contains('popped') || bubbleEl.classList.contains('wrong-shake')) return;

        const arena = document.getElementById('bubbleArena');

        if (isCorrect) {
            playSoundEffect('pop');
            bubbleEl.classList.add('popped');

            // Floating +score text animation
            const addedScore = 10 * state.bubbleGame.combo;
            state.bubbleGame.score += addedScore;
            state.bubbleGame.combo += 1;
            state.bubbleGame.maxCombo = Math.max(state.bubbleGame.maxCombo, state.bubbleGame.combo);
            state.bubbleGame.poppedCount += 1;

            if (arena) {
                const floatText = document.createElement('div');
                floatText.className = 'bpop-floating-text';
                floatText.textContent = `+${addedScore}`;
                const rect = bubbleEl.getBoundingClientRect();
                const arenaRect = arena.getBoundingClientRect();
                floatText.style.left = `${rect.left - arenaRect.left + (rect.width / 2)}px`;
                floatText.style.top = `${rect.top - arenaRect.top}px`;
                arena.appendChild(floatText);
                setTimeout(() => floatText.remove(), 700);
            }

            // Speak word
            speakChinese(cleanHanziForTts(wordObj.word));

            updateBubbleHUD();

            // Next question after a tiny delay
            setTimeout(() => {
                if (state.bubbleGame.isRunning) {
                    spawnBubbleRound();
                }
            }, 320);
        } else {
            playSoundEffect('wrong');
            bubbleEl.classList.add('wrong-shake');
            state.bubbleGame.combo = 1;
            state.bubbleGame.lives -= 1;
            updateBubbleHUD();

            setTimeout(() => {
                bubbleEl.classList.remove('wrong-shake');
            }, 500);

            if (state.bubbleGame.lives <= 0) {
                endBubbleGame(false);
            }
        }
    }

    function updateBubbleHUD() {
        const sEl = document.getElementById('bpopScore');
        const cEl = document.getElementById('bpopCombo');
        const lEl = document.getElementById('bpopLives');
        const tEl = document.getElementById('bpopTimer');

        if (sEl) sEl.textContent = state.bubbleGame.score;
        if (cEl) {
            cEl.textContent = `x${state.bubbleGame.combo}`;
            cEl.style.color = (state.bubbleGame.combo >= 3) ? 'var(--ui-warning)' : 'inherit';
        }
        if (lEl) {
            const lives = Math.max(0, state.bubbleGame.lives);
            lEl.textContent = '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, 3 - lives));
        }
        if (tEl) {
            tEl.textContent = `${Math.max(0, state.bubbleGame.timeLeft)}s`;
            tEl.style.color = (state.bubbleGame.timeLeft <= 10) ? 'var(--ui-danger)' : 'inherit';
        }
    }

    function endBubbleGame(victory) {
        if (state.bubbleGame.timerId) {
            clearInterval(state.bubbleGame.timerId);
            state.bubbleGame.timerId = null;
        }
        state.bubbleGame.isRunning = false;

        const xpEarned = Math.max(10, Math.floor(state.bubbleGame.score / 2));
        awardXp(xpEarned, 'Game Bắn Bong Bóng Từ Vựng');
        playSoundEffect(victory ? 'badge' : 'wrong');

        const arena = document.getElementById('bubbleArena');
        if (arena) arena.querySelectorAll('.game-bubble').forEach(b => b.remove());

        const resModal = document.getElementById('bpopResultModal');
        const rIcon = document.getElementById('brmIcon');
        const rTitle = document.getElementById('brmTitle');
        const rScore = document.getElementById('brmScore');
        const rCombo = document.getElementById('brmMaxCombo');
        const rPopped = document.getElementById('brmPopped');
        const rXp = document.getElementById('brmXp');

        if (rIcon) rIcon.textContent = victory ? '🏆' : '💥';
        if (rTitle) rTitle.textContent = victory ? 'Hết Giờ - Kết Quả Xuất Sắc!' : 'Hết Mạng! Hãy Thử Lại Nhé!';
        if (rScore) rScore.textContent = state.bubbleGame.score;
        if (rCombo) rCombo.textContent = `x${state.bubbleGame.maxCombo}`;
        if (rPopped) rPopped.textContent = state.bubbleGame.poppedCount;
        if (rXp) rXp.textContent = `+${xpEarned} XP`;

        if (resModal) resModal.classList.remove('hidden');

        const btnRestart = document.getElementById('btnBpopRestart');
        const btnStart = document.getElementById('btnBpopStart');
        if (btnRestart) btnRestart.classList.add('hidden');
        if (btnStart) btnStart.classList.remove('hidden');
    }

    // ==================== VISUAL MNEMONICS & WORD FAMILY MODAL ====================
    function findWordObject(wordId) {
        if (!wordId) return null;
        const curUnit = getCurrentUnitData();
        if (curUnit && curUnit.target_words) {
            const found = curUnit.target_words.find(w => w.id === wordId);
            if (found) return found;
        }
        if (state.fcDeck && state.fcDeck.length) {
            const found = state.fcDeck.find(w => w.id === wordId);
            if (found) return found;
        }
        return findWordById(wordId);
    }

    function openMnemonicModal(wordId) {
        const modal = document.getElementById('visualMnemonicModal');
        if (!modal) return;

        const w = findWordObject(wordId);
        if (!w) return;

        const vData = getWordVisualData(w.word, w.meaning_vi || w.meaning_primary, w.meaning_en);

        const vNum = document.getElementById('vmmNum');
        const vAvatar = document.getElementById('vmmVisualAvatar');
        const vHz = document.getElementById('vmmHz');
        const vPy = document.getElementById('vmmPy');
        const vMn = document.getElementById('vmmMeaning');
        const vHv = document.getElementById('vmmHanViet');
        const radGrid = document.getElementById('vmmRadicalsGrid');
        const storyCard = document.getElementById('vmmStoryCard');
        const familyTree = document.getElementById('vmmFamilyTree');

        if (vNum) vNum.textContent = `#${w.num}`;
        if (vAvatar) vAvatar.textContent = vData.icon;
        if (vHz) vHz.textContent = w.word;
        if (vPy) vPy.innerHTML = formatPinyinWithToneColors(w.pinyin);
        if (vMn) vMn.textContent = w.meaning_vi || w.meaning_primary || w.meaning_en;
        if (vHv) {
            vHv.textContent = `Hán Việt: ${(w.han_viet || '').toUpperCase()} · Từ loại: ${w.pos_full || w.pos || 'Từ vựng'}`;
        }

        // Radicals Breakdown
        if (radGrid) {
            if (vData.radicals && vData.radicals.length) {
                radGrid.innerHTML = vData.radicals.map(r => `
                    <div class="vmm-rad-item">
                        <span class="vmm-rad-char">${escapeHtml(r.r)}</span>
                        <div class="vmm-rad-info">
                            <strong>${escapeHtml(r.name)}</strong>
                            <span class="vmm-rad-vi">${escapeHtml(r.vi)}</span>
                        </div>
                    </div>
                `).join('');
            } else {
                radGrid.innerHTML = '<div class="text-muted" style="padding:10px;">Chữ Hán tự nhiên cấu thành từ các nét cơ bản.</div>';
            }
        }

        // Mnemonic Story
        if (storyCard) {
            storyCard.innerHTML = `
                <div class="vmm-story-icon">${vData.icon}</div>
                <div class="vmm-story-text">${escapeHtml(vData.story)}</div>
            `;
        }

        // Word Family Mindmap
        if (familyTree) {
            let families = (vData.family && vData.family.length) ? [...vData.family] : [];

            // Add related words from current unit if none or few
            if (families.length < 3) {
                const curUnit = getCurrentUnitData();
                if (curUnit && curUnit.target_words) {
                    curUnit.target_words.forEach(ow => {
                        if (ow.id !== w.id && (ow.word.includes(w.word) || w.word.includes(ow.word))) {
                            if (!families.some(f => f.word === ow.word)) {
                                families.push({ word: ow.word, py: ow.pinyin, vi: ow.meaning_vi || ow.meaning_primary });
                            }
                        }
                    });
                }
            }

            if (!families.length) {
                families = [
                    { word: w.word, py: w.pinyin, vi: w.meaning_vi || w.meaning_primary }
                ];
            }

            familyTree.innerHTML = families.map(f => `
                <div class="vmm-family-chip" data-speak="${escapeAttr(cleanHanziForTts(f.word))}">
                    <span class="vfc-hz">${escapeHtml(f.word)}</span>
                    <span class="vfc-py">${escapeHtml(f.py)}</span>
                    <span class="vfc-vi">${escapeHtml(f.vi)}</span>
                    <span class="vfc-audio">🔊</span>
                </div>
            `).join('');

            familyTree.querySelectorAll('.vmm-family-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    const spk = chip.getAttribute('data-speak');
                    if (spk) speakChinese(spk);
                });
            });
        }

        modal.classList.remove('hidden');
    }

    function closeMnemonicModal() {
        const modal = document.getElementById('visualMnemonicModal');
        if (modal) modal.classList.add('hidden');
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

    function speakChinese(text, triggerEl) {
        if (!text || !('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'zh-CN';
            utter.rate = 0.9;

            if (triggerEl && triggerEl instanceof HTMLElement) {
                triggerEl.classList.add('is-speaking');
                const card = triggerEl.closest('.qm-word-card') || triggerEl.closest('.tw-chip');
                if (card) card.classList.add('speaking-card');

                const cleanup = () => {
                    triggerEl.classList.remove('is-speaking');
                    if (card) card.classList.remove('speaking-card');
                };

                utter.onend = cleanup;
                utter.onerror = cleanup;
                setTimeout(cleanup, Math.max(1600, text.length * 450));
            }

            window.speechSynthesis.speak(utter);
        } catch (e) {
            console.warn('TTS error:', e);
        }
    }

    let speakAllTimerId = null;

    function updateSpeakAllButtonsUI(isActive, labelText) {
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
        if (idx > 0) trySelectUnit(getUnitNum(meta.units_index[idx - 1]));
    }

    function goNextUnit() {
        const meta = getBookIndexMeta(state.activeBookId);
        if (!meta || !meta.units_index) return;
        const idx = meta.units_index.findIndex(u => getUnitNum(u) === state.activeUnitNum);
        if (idx >= 0 && idx < meta.units_index.length - 1) {
            trySelectUnit(getUnitNum(meta.units_index[idx + 1]));
        }
    }

    function setSequential(on) {
        state.settings.sequential = !!on;
        saveProgress();
        const meta = getBookIndexMeta(state.activeBookId);
        if (meta) renderUnitList(meta);
        showToast(on ? 'Đã bật học theo thứ tự' : 'Đã tắt học theo thứ tự',
            on ? `Bài sau mở khi bài trước đạt ≥ ${PASS_PCT}%.` : 'Bạn có thể học bất kỳ bài nào.', on ? '🔒' : '🔓');
    }

    function bindEvents() {
        // Quick Settings Popover Menu & Theme Grid Toggle
        const settingsBtn = document.getElementById('btnOpenSettings') || document.getElementById('themePickerBtn') || document.getElementById('themeToggleBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSettingsDropdown();
            });
        }

        // Close settings dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#settingsMenuWrapper') && !e.target.closest('#themePickerWrapper')) {
                toggleSettingsDropdown(false);
            }
        });

        // Học theo thứ tự (khóa bài sau tới khi bài trước đạt ≥ 80%)
        const chkSeq = document.getElementById('chkSequential');
        if (chkSeq) {
            chkSeq.checked = !!state.settings.sequential;
            chkSeq.addEventListener('change', () => setSequential(chkSeq.checked));
        }

        // Luồng chính trên thanh đầu trang
        const btnContinue = document.getElementById('btnContinueStudy');
        if (btnContinue) btnContinue.addEventListener('click', continueStudy);

        // Hanzi Font Switcher (Artistic Calligraphy <-> Modern Sans)
        const fontBtn = document.getElementById('btnToggleHanziFont');
        if (fontBtn) fontBtn.addEventListener('click', toggleHanziFont);

        // Tone-based Color Switcher
        const toneBtn = document.getElementById('btnToggleToneColor');
        if (toneBtn) toneBtn.addEventListener('click', toggleToneColors);

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
                btnCollapseGrid.textContent = state.targetGridCollapsed ? '🔽 Xem bảng từ' : '🔼 Thu gọn';
            });
        }

        // Bento Dashboard Layout Switcher (Bento Grid vs Classic List)
        const btnViewBento   = document.getElementById('btnViewBento');
        const btnViewClassic = document.getElementById('btnViewClassic');
        if (btnViewBento)   btnViewBento.addEventListener('click', () => setMemoryLayout('bento'));
        if (btnViewClassic) btnViewClassic.addEventListener('click', () => setMemoryLayout('classic'));

        // Global Keyboard Shortcuts (Spotlight Search, Unit Nav & Bento Mode)
        document.addEventListener('keydown', (e) => {
            // Spotlight Search Hotkey: Ctrl+K or Cmd+K
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                const gSearch = document.getElementById('globalWordSearch');
                if (gSearch) {
                    gSearch.focus();
                    gSearch.select();
                }
                return;
            }

            // Escape to blur search
            if (e.key === 'Escape' && document.activeElement && document.activeElement.id === 'globalWordSearch') {
                document.activeElement.blur();
                return;
            }

            // Don't trigger study shortcuts if typing in any input/textarea/select
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

            // Unit Quick Navigation: Alt + Left / Alt + Right
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                goPrevUnit();
                return;
            }
            if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                goNextUnit();
                return;
            }

            // Bento Mode Shortcuts (ArrowLeft, ArrowRight, Space for TTS)
            if (state.studyMode === 'memory') {
                const curLayout = state.memoryLayout || localStorage.getItem('hsk_wl_memory_layout') || 'bento';
                if (curLayout === 'bento') {
                    const unitData = getCurrentUnitData();
                    if (!unitData || !unitData.target_words) return;
                    const words = unitData.target_words;
                    const total = words.length;

                    const curIdx = words.findIndex(w => w.num === state.activeWordNum);
                    if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        if (curIdx > 0) {
                            selectBentoWordByNum(words[curIdx - 1].num);
                        }
                    } else if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        if (curIdx >= 0 && curIdx < total - 1) {
                            selectBentoWordByNum(words[curIdx + 1].num);
                        }
                    } else if (e.code === 'Space') {
                        e.preventDefault();
                        const curWord = words.find(w => w.num === state.activeWordNum);
                        if (curWord) {
                            speakChinese(cleanHanziForTts(curWord.word), document.getElementById('btnHeroSpeak'));
                        }
                    }
                }
            }
        });

        // Close any open card more menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.qmc-more-wrap')) {
                document.querySelectorAll('.qmc-more-menu').forEach(m => m.classList.add('hidden'));
            }
        });

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
        if (btnDone) btnDone.addEventListener('click', startUnitTest);
        if (mobDone) mobDone.addEventListener('click', startUnitTest);

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
        const btnGoNext = document.getElementById('btnGoToNextUnitBottom');
        if (btnGoPrac) btnGoPrac.addEventListener('click', startUnitTest);
        if (btnGoFc)   btnGoFc.addEventListener('click', () => openFlashcardScope('unit'));
        if (btnGoNext) btnGoNext.addEventListener('click', continueStudy);

        // Master Speak All Words in Unit controls (Sticky Top & Mobile Bottom)
        const btnSpeakAllTop = document.getElementById('btnSpeakAllTop');
        const mobBtnSpeakAll = document.getElementById('mobBtnSpeakAll');
        if (btnSpeakAllTop) btnSpeakAllTop.addEventListener('click', toggleSpeakAllWords);
        if (mobBtnSpeakAll) mobBtnSpeakAll.addEventListener('click', toggleSpeakAllWords);

        const btnTogglePy = document.getElementById('btnTogglePinyin');
        if (btnTogglePy) {
            btnTogglePy.addEventListener('click', () => {
                state.showPinyin = !state.showPinyin;
                btnTogglePy.classList.toggle('active', state.showPinyin);
                document.querySelectorAll('.qmc-ex-py, .bhes-py').forEach(el => {
                    el.classList.toggle('hidden', !state.showPinyin);
                });
            });
        }

        const btnToggleMn = document.getElementById('btnToggleMeaning');
        if (btnToggleMn) {
            btnToggleMn.addEventListener('click', () => {
                state.showMeaning = !state.showMeaning;
                btnToggleMn.classList.toggle('active', state.showMeaning);
                document.querySelectorAll('.qmc-ex-vn, .bhes-vn').forEach(el => {
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
        if (btnSrsHeader) {
            btnSrsHeader.addEventListener('click', () => {
                state.fcBookFilter = 'all';
                const bf = document.getElementById('fcBookFilter');
                if (bf) bf.value = 'all';
                openFlashcardScope('due');
            });
        }
        const btnFcOpenList = document.getElementById('btnFcOpenList');
        if (btnFcOpenList && modalSrs) {
            btnFcOpenList.addEventListener('click', async () => {
                renderSrsModal();
                modalSrs.classList.remove('hidden');
                // Thẻ chuyển từ Leitner chưa có chữ Hán: nạp quyển tương ứng rồi vẽ lại
                const missing = Object.keys(state.srsData || {}).filter(id => !state.srsData[id].hz);
                if (missing.length) {
                    await ensureBooksForCardIds(missing);
                    renderSrsModal();
                }
            });
        }
        const srsBookFilter = document.getElementById('srsBookFilter');
        if (srsBookFilter) {
            srsBookFilter.addEventListener('change', () => {
                srsModalFilter = srsBookFilter.value || 'all';
                renderSrsModal();
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
                state.fcBookFilter = srsModalFilter;
                const bf = document.getElementById('fcBookFilter');
                if (bf) bf.value = srsModalFilter;
                openFlashcardScope('due');
            });
        }
        if (btnStartSrsQz) {
            btnStartSrsQz.addEventListener('click', () => {
                if (modalSrs) modalSrs.classList.add('hidden');
                state.quizScope = 'due';
                const qs = document.getElementById('quizScopeSelect');
                if (qs) qs.value = 'due';
                switchStudyMode('games');
                switchGamesSubMode('quiz');
            });
        }
        if (btnClearSrs) {
            // Nút thứ 3 nay là "Luyện từ chậm" (trắc nghiệm tính giờ 10s, đo lại tốc độ nhận diện)
            btnClearSrs.addEventListener('click', () => {
                if (modalSrs) modalSrs.classList.add('hidden');
                startSlowPractice();
            });
        }

        // Hands-free Podcast Player Controls
        const btnTogPod = document.getElementById('btnTogglePodcast');
        if (btnTogPod) {
            btnTogPod.addEventListener('click', () => {
                toggleSettingsDropdown(false);
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
            fcScopeSel.value = state.fcScope;
            fcScopeSel.addEventListener('change', () => openFlashcardScope(fcScopeSel.value));
        }
        const fcBookFilter = document.getElementById('fcBookFilter');
        if (fcBookFilter) {
            fillBookFilterSelect(fcBookFilter, state.fcBookFilter);
            fcBookFilter.addEventListener('focus', () => fillBookFilterSelect(fcBookFilter, state.fcBookFilter));
            fcBookFilter.addEventListener('change', () => {
                state.fcBookFilter = fcBookFilter.value || 'all';
                openFlashcardScope(state.fcScope);
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
                flipFlashcard();
            });
        }

        document.querySelectorAll('.fc-rate-btn[data-rate]').forEach(btn => {
            btn.addEventListener('click', () => handleFlashcardRate(parseInt(btn.getAttribute('data-rate'), 10)));
        });

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

        const quizScopeSel = document.getElementById('quizScopeSelect');
        if (quizScopeSel) {
            quizScopeSel.addEventListener('change', () => {
                state.quizScope = quizScopeSel.value || 'test';
                initReflexQuiz();
            });
        }

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
            btnNextQuiz.addEventListener('click', () => {
                // Kiểm tra bài: phải trả lời câu hiện tại trước khi sang câu sau
                if (state.quizTest && !state.quizAnswered) {
                    showToast('Chọn một đáp án', 'Hãy trả lời câu này trước khi sang câu tiếp theo.', 'ℹ️');
                    return;
                }
                nextReflexQuizQuestion();
            });
        }

        // Global Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

            if (state.studyMode === 'flashcard') {
                if (e.code === 'Space') {
                    e.preventDefault();
                    flipFlashcard();
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
                } else if (e.key === '4') {
                    handleFlashcardRate(4);
                } else if (e.key === 'r' || e.key === 'R') {
                    const w = state.fcDeck[state.fcIndex];
                    if (w) speakChinese(cleanHanziForTts(w.word));
                }
            } else if (isQuizActive()) {
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
                    if (state.quizAnswered && !(state.quizTest && state.quizTest.finished)) nextReflexQuizQuestion();
                } else if (e.key === 'r' || e.key === 'R') {
                    const btnQuizSpeak = document.getElementById('btnQuizSpeak');
                    if (btnQuizSpeak) btnQuizSpeak.click();
                }
            }
        });



        // ==================== LUYỆN TẬP / TRÒ CHƠI: TAB CON ====================
        document.querySelectorAll('.ghh-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const sub = tab.getAttribute('data-gsub');
                if (sub) switchGamesSubMode(sub);
            });
        });
        document.querySelectorAll('.xsub-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const sub = tab.getAttribute('data-xsub');
                if (sub) switchExtraSubMode(sub);
            });
        });

        const btnBpopStart = document.getElementById('btnBpopStart');
        const btnStartBubbleDirect = document.getElementById('btnStartBubbleGameDirect');
        const btnBpopRestart = document.getElementById('btnBpopRestart');
        const btnBpopAudio = document.getElementById('btnBpopAudio');
        const bpopModeSel = document.getElementById('bpopModeSelect');
        const btnBrmPlayAgain = document.getElementById('btnBrmPlayAgain');
        const btnBrmSwitchQuiz = document.getElementById('btnBrmSwitchQuiz');

        if (btnBpopStart) btnBpopStart.addEventListener('click', startBubbleGame);
        if (btnStartBubbleDirect) btnStartBubbleDirect.addEventListener('click', startBubbleGame);
        if (btnBpopRestart) btnBpopRestart.addEventListener('click', startBubbleGame);
        if (btnBpopAudio) {
            btnBpopAudio.addEventListener('click', () => {
                if (state.bubbleGame.target) {
                    speakChinese(cleanHanziForTts(state.bubbleGame.target.word));
                }
            });
        }
        if (bpopModeSel) {
            bpopModeSel.addEventListener('change', () => {
                state.bubbleGame.mode = bpopModeSel.value;
                if (state.bubbleGame.isRunning) spawnBubbleRound();
            });
        }
        if (btnBrmPlayAgain) {
            btnBrmPlayAgain.addEventListener('click', () => {
                const modal = document.getElementById('bpopResultModal');
                if (modal) modal.classList.add('hidden');
                startBubbleGame();
            });
        }
        if (btnBrmSwitchQuiz) {
            btnBrmSwitchQuiz.addEventListener('click', () => {
                const modal = document.getElementById('bpopResultModal');
                if (modal) modal.classList.add('hidden');
                state.quizScope = 'unit';
                const qs = document.getElementById('quizScopeSelect');
                if (qs) qs.value = 'unit';
                switchStudyMode('games');
                switchGamesSubMode('quiz');
            });
        }

        // ==================== VISUAL MNEMONICS MODAL EVENTS ====================
        const btnCloseMnemonic = document.getElementById('btnCloseMnemonicModal');
        const modalMnemonic = document.getElementById('visualMnemonicModal');
        const btnVmmSpeak = document.getElementById('btnVmmSpeak');

        if (btnCloseMnemonic) btnCloseMnemonic.addEventListener('click', closeMnemonicModal);
        if (modalMnemonic) {
            modalMnemonic.addEventListener('click', (e) => {
                if (e.target === modalMnemonic) closeMnemonicModal();
            });
        }
        if (btnVmmSpeak) {
            btnVmmSpeak.addEventListener('click', () => {
                const hzEl = document.getElementById('vmmHz');
                if (hzEl && hzEl.textContent) speakChinese(cleanHanziForTts(hzEl.textContent));
            });
        }

        const btnGrammar   = document.getElementById('btnGrammarModal');
        const closeGrammar = document.getElementById('btnCloseGrammarModal');
        const modalGrammar = document.getElementById('grammarModal');
        if (btnGrammar && modalGrammar) {
            btnGrammar.addEventListener('click', () => {
                toggleSettingsDropdown(false);
                modalGrammar.classList.remove('hidden');
            });
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
                engineTag.style.color = 'var(--ui-success)';
            } else {
                engineTag.textContent = 'Ghi âm & Đối chiếu: Sẵn sàng';
                engineTag.style.color = 'var(--ui-pinyin)';
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
        if (pyEl) pyEl.innerHTML = formatPinyinWithToneColors(w.pinyin);
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
            if (exPy) exPy.innerHTML = formatPinyinWithToneColors(activeEx.py);
            if (exVn) exVn.textContent = activeEx.vn;
            if (sepCounter) sepCounter.textContent = `${state.shadowing.targetExIndex + 1}/${examples.length}`;
            if (sepLabel) sepLabel.textContent = `💬 Câu ví dụ đang luyện:`;
            if (lblPlay) lblPlay.textContent = `Nghe câu ví dụ mẫu #${state.shadowing.targetExIndex + 1}`;

            // Teleprompter display in Recording Card
            if (stpHz) stpHz.textContent = activeEx.hz;
            if (stpPy) stpPy.innerHTML = formatPinyinWithToneColors(activeEx.py);
            if (stpVn) stpVn.textContent = activeEx.vn;
            if (stpTypeBadge) stpTypeBadge.textContent = '💬 CÂU VÍ DỤ SHADOWING:';
            if (stpExNav) stpExNav.classList.toggle('hidden', examples.length <= 1);
            if (stpExCounter) stpExCounter.textContent = `Câu ${state.shadowing.targetExIndex + 1}/${examples.length}`;
        } else {
            if (exBox) exBox.classList.add('hidden');
            if (lblPlay) lblPlay.textContent = 'Nghe phát âm từ vựng mẫu';

            // Teleprompter display in Recording Card
            if (stpHz) stpHz.textContent = w.word;
            if (stpPy) stpPy.innerHTML = formatPinyinWithToneColors(w.pinyin);
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
