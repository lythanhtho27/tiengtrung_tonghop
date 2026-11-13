/**
 * BOYA LEARNING PLATFORM - BOYA_LEARNING.JS
 * Quản trị toàn bộ logic học Boya (6 Quyển · 74 Bài · 2.770 Từ):
 * lộ trình 4 bước mỗi bài, bài kiểm tra cuối bài, ôn tập ngắt quãng (SM-2),
 * đọc tính giờ, audio, flashcard, luyện tập, podcast.
 */

(function () {
    'use strict';

    // ==========================================================================
    // 1. STORAGE KEYS & INITIAL STATE
    // ==========================================================================
    const STORAGE_KEY_PROGRESS_V1 = 'boya_learning_progress_v1';   // cũ: { "tc1_bai1": true }
    const STORAGE_KEY_PROGRESS = 'boya_learning_progress_v2';      // mới: xem DEFAULT_PROGRESS
    const STORAGE_KEY_STARRED  = 'boya_learning_starred_words_v1';
    const STORAGE_KEY_THEME_OLD = 'boya_learning_dark_mode_v1';    // cũ, chỉ đọc để chuyển sang hoc_theme
    const STORAGE_KEY_SETTINGS = 'boya_learning_settings_v1';
    const STORAGE_KEY_SIDEBAR  = 'boya_learning_sidebar_collapsed';

    const PASS_TEST = 80;          // % tối thiểu để hoàn thành bài
    const TEST_VOCAB_MAX = 12;     // số câu từ vựng tối đa trong bài kiểm tra
    const TEST_GRAMMAR_MAX = 3;    // số câu ngữ pháp tối đa
    const PRACTICE_SIZE = 10;      // số câu mỗi lượt luyện tập
    const STREAK_MIN = 10;         // số câu/thẻ tối thiểu trong ngày để tính streak
    const DAY = 86400000;
    const MODES = ['vocab', 'flashcard', 'reading', 'grammar', 'quiz', 'test', 'podcast', 'review'];
    const BOOK_ALIAS = { cc1: 'gc1', cc2: 'gc2' };

    let state = {
        activeBookId: 'tc1',
        activeLessonNum: 1,
        activeMode: 'reading',      // xem MODES
        prevMode: 'reading',        // để quay lại từ "Ôn hôm nay"
        activeReadingIdx: 0,

        // Reading Options
        pinyinVisible: true,
        transVisible: false,
        readingLayout: 'interlinear', // 'interlinear' | 'standard'
        clozeMode: false,
        fontStyle: 'kaiti',        // 'kaiti' | 'heiti' | 'songti'
        fontSize: 22,
        readRenderAt: 0,
        timed: null,               // { start, lid, idx, timerId, prevPinyin, run }
        timedResult: null,         // kết quả lần đọc vừa xong (hiển thị)
        shadow: null,              // nghe-nhại: { el, round, timer }

        // Filters
        sidebarFilter: 'all',      // 'all' | 'todo' | 'done'
        sidebarSearch: '',
        vocabSearch: '',
        vocabTypeFilter: 'all',
        grammarSearch: '',

        // Flashcards
        fcIndex: 0,
        fcFlipped: false,
        fcScope: 'all',            // 'all' | 'starred'
        fcDeck: [],
        fcDeckKey: '',

        // Luyện tập / kiểm tra
        quizSubMode: 'mcq',        // 'mcq' | 'match' | 'listen'
        quiz: null,                // phiên trắc nghiệm đang chạy (runQuiz)
        testStarted: false,

        // Matching Game
        matchCards: [],
        matchSelected: null,
        matchPairsFound: 0,
        matchTimer: 0,
        matchTimerId: null,

        // Ôn hôm nay
        review: null,              // { queue: [id], flipped, done }

        // Hands-free Podcast
        podcastRunning: false,
        podcastIndex: 0,
        podcastTimer: null,

        // User Data
        starredWords: {}           // { "tc1_1_1": true }
    };

    // Tiến độ học (localStorage boya_learning_progress_v2)
    function DEFAULT_PROGRESS() {
        return {
            v: 2,
            // lessons["tc1_bai1"] = { fc:{wordId:1}, rd:{idx:1}, gr:{idx:1}, best, tries, done, doneAt, legacy }
            lessons: {},
            // srs[wordId] = { ef, iv, reps, lapses, due(ms), last(ms) }
            srs: {},
            // days["2026-11-13"] = { q: câu đã làm, r: thẻ đã ôn, c: bài hoàn thành, rd: lần đọc tính giờ }
            days: {},
            streak: { count: 0, last: '', best: 0 },
            // reading["tc1_bai1#0"] = [{ d: ngày, cpm, sec, chars }]
            reading: {}
        };
    }
    let P = DEFAULT_PROGRESS();

    // Chỉ mục từ vựng toàn bộ 6 quyển: id → { w, book, lesson }
    const WORDS = new Map();

    // DOM Elements Cache
    let dom = {};

    // ==========================================================================
    // 2. INITIALIZATION
    // ==========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        cacheDOMElements();

        // Check data availability
        if (!window.BOYA_DATA || !window.BOYA_DATA.books) {
            console.error("BOYA_DATA not found. Please ensure boya_data.js is loaded.");
            return;
        }
        window.BOYA_DATA.books.forEach(b => b.lessons.forEach(l => (l.words || []).forEach(w => {
            WORDS.set(w.id, { w, book: b, lesson: l });
        })));

        loadPersistedData();
        applyUrlParams();
        bindGlobalEvents();

        renderBookSelector();
        switchBook(state.activeBookId, state.activeLessonNum, false, true);
        initAudioDock();
        updatePinyinUI();
        initSidebarState();
        refreshGlobal();
    });

    function dayKey(d) {
        d = d || new Date(); // giờ địa phương (toISOString là UTC → ở VN đổi ngày lúc 7h sáng)
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function startOfDay(t) { const d = new Date(t || Date.now()); d.setHours(0, 0, 0, 0); return d.getTime(); }
    function yesterdayKey() { return dayKey(new Date(startOfDay() - DAY / 2)); }

    function loadPersistedData() {
        try {
            // Theme cũ của trang → theme chung (chỉ lần đầu)
            if (window.HocTheme && localStorage.getItem('hoc_theme') === null && localStorage.getItem(STORAGE_KEY_THEME_OLD) === 'true') {
                HocTheme.set('dark');
            }

            const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
            if (raw) {
                P = Object.assign(DEFAULT_PROGRESS(), JSON.parse(raw));
            } else {
                migrateFromV1();
            }

            const star = localStorage.getItem(STORAGE_KEY_STARRED);
            if (star) state.starredWords = JSON.parse(star) || {};

            const sett = localStorage.getItem(STORAGE_KEY_SETTINGS);
            if (sett) {
                const parsed = JSON.parse(sett);
                if (parsed.activeBookId) state.activeBookId = parsed.activeBookId;
                if (parsed.activeLessonNum) state.activeLessonNum = parsed.activeLessonNum;
                if (parsed.activeMode && MODES.includes(parsed.activeMode) && parsed.activeMode !== 'review') state.activeMode = parsed.activeMode;
                if (parsed.fontSize) state.fontSize = parsed.fontSize;
                if (parsed.fontStyle) state.fontStyle = parsed.fontStyle;
                if (parsed.readingLayout) state.readingLayout = parsed.readingLayout;
                if (parsed.pinyinVisible !== undefined) state.pinyinVisible = parsed.pinyinVisible;
                if (parsed.quizSubMode) state.quizSubMode = parsed.quizSubMode;
                // Mặc định bản dịch luôn thu gọn để người học tự luyện đọc trước
                state.transVisible = false;
            }
            if (!findBook(state.activeBookId)) state.activeBookId = 'tc1';
        } catch (e) {
            console.warn("Storage load error:", e);
        }
    }

    // Chuyển dữ liệu từ key cũ: bài đã đánh dấu xong vẫn tính là xong,
    // từ của các bài đó được đưa vào hàng ôn (rải 20 từ/ngày để không dồn một lúc).
    function migrateFromV1() {
        let old = null;
        try { old = JSON.parse(localStorage.getItem(STORAGE_KEY_PROGRESS_V1) || 'null'); } catch (e) {}
        if (old && typeof old === 'object') {
            let i = 0;
            Object.keys(old).forEach(lid => {
                if (!old[lid]) return;
                const L = lessonState(lid);
                L.done = true; L.legacy = true; L.doneAt = L.doneAt || '';
                const found = findLessonById(lid);
                if (found) {
                    eligibleWords(found.lesson).forEach(w => {
                        if (P.srs[w.id]) return;
                        P.srs[w.id] = newCard(startOfDay() + (1 + Math.floor(i / 20)) * DAY, 1);
                        i++;
                    });
                }
            });
        }
        // Streak cũ (đếm theo số ngày mở trang): giữ lại nếu chưa đứt
        try {
            const last = localStorage.getItem('boya_last_study_date');
            const cnt = parseInt(localStorage.getItem('boya_streak_count') || '0', 10) || 0;
            if (last && (last === dayKey() || last === yesterdayKey()) && cnt > 0) {
                // hôm nay vẫn phải học đủ mới được tính, nên lùi "last" về hôm qua
                P.streak = { count: last === dayKey() ? Math.max(0, cnt - 1) : cnt, last: yesterdayKey(), best: cnt };
            }
        } catch (e) {}
        saveProgress();
    }

    function saveProgress() {
        try { localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(P)); } catch (e) {}
        publishSummary();
    }

    function saveSettings() {
        try {
            const sett = {
                activeBookId: state.activeBookId,
                activeLessonNum: state.activeLessonNum,
                activeMode: state.activeMode === 'review' ? state.prevMode : state.activeMode,
                fontSize: state.fontSize,
                fontStyle: state.fontStyle,
                readingLayout: state.readingLayout,
                pinyinVisible: state.pinyinVisible,
                transVisible: state.transVisible,
                quizSubMode: state.quizSubMode
            };
            localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(sett));
        } catch (e) {}
    }

    // ?book=<id>&lesson=<n>  (trang chủ link thẳng vào bài)
    function applyUrlParams() {
        try {
            const q = new URLSearchParams(location.search);
            let b = (q.get('book') || '').toLowerCase();
            b = BOOK_ALIAS[b] || b;
            if (b && findBook(b)) {
                state.activeBookId = b;
                const n = parseInt(q.get('lesson') || '1', 10);
                const book = findBook(b);
                state.activeLessonNum = book.lessons.some(l => l.lesson_num === n) ? n : book.lessons[0].lesson_num;
            }
            const m = q.get('mode');
            if (m && MODES.includes(m) && m !== 'review') state.activeMode = m;
            if (m === 'review') { state.prevMode = state.activeMode; state.activeMode = 'review'; }
        } catch (e) {}
    }

    function updateUrl() {
        try {
            const url = location.pathname + '?book=' + state.activeBookId + '&lesson=' + state.activeLessonNum;
            history.replaceState(null, '', url);
        } catch (e) {}
    }

    function cacheDOMElements() {
        dom.bookPillsNav    = document.getElementById('bookPillsNav');
        dom.sidebarLessonList = document.getElementById('sidebarLessonList');
        dom.sidebarSearch   = document.getElementById('sidebarSearch');
        dom.sidebarProgressFill = document.getElementById('sidebarProgressFill');
        dom.sidebarProgressLabel = document.getElementById('sidebarProgressLabel');
        dom.sidebarBookSelect = document.getElementById('sidebarBookSelect');
        dom.boyaSidebar     = document.getElementById('boyaSidebar');
        dom.sidebarBackdrop = document.getElementById('sidebarBackdrop');
        dom.mainPanel       = document.querySelector('.boya-main-panel');

        dom.lessonMainTitle = document.getElementById('lessonMainTitle');
        dom.lessonMetaBadge = document.getElementById('lessonMetaBadge');
        dom.lessonStatusArea = document.getElementById('lessonStatusArea');
        dom.lessonPath      = document.getElementById('lessonPath');

        dom.modeTabs        = document.querySelectorAll('.mode-tab-btn');
        dom.modeContainer   = document.getElementById('modeContentContainer');
        dom.tabBadgeVocab   = document.getElementById('tabBadgeVocab');
        dom.tabBadgeGrammar = document.getElementById('tabBadgeGrammar');

        dom.audioPlayer     = document.getElementById('globalAudioElement');
        dom.dockTrackTitle  = document.getElementById('dockTrackTitle');
        dom.dockTrackSub    = document.getElementById('dockTrackSub');
        dom.btnPlayPause    = document.getElementById('btnPlayPause');
        dom.audioScrubber   = document.getElementById('audioScrubber');
        dom.timeCurrent     = document.getElementById('timeCurrent');
        dom.timeTotal       = document.getElementById('timeTotal');
        dom.btnSpeedToggle  = document.getElementById('btnSpeedToggle');

        dom.searchModal     = document.getElementById('searchModal');
        dom.modalSearchInput = document.getElementById('modalSearchInput');
        dom.modalResultsList = document.getElementById('modalResultsList');
        dom.statsModal      = document.getElementById('statsModal');
        dom.statsBody       = document.getElementById('statsBody');
        dom.hdrStreakCount  = document.getElementById('hdrStreakCount');
        dom.hdrDueCount     = document.getElementById('hdrDueCount');
    }

    // ==========================================================================
    // 2b. TIẾN ĐỘ BÀI HỌC · LỘ TRÌNH 4 BƯỚC
    // ==========================================================================
    function findBook(id) { return window.BOYA_DATA.books.find(b => b.id === id); }
    function lessonId(book, lesson) { return `${book.id}_bai${lesson.lesson_num}`; }
    function findLessonById(lid) {
        for (const b of window.BOYA_DATA.books) {
            for (const l of b.lessons) if (lessonId(b, l) === lid) return { book: b, lesson: l };
        }
        return null;
    }
    function lessonState(lid) {
        if (!P.lessons[lid]) P.lessons[lid] = { fc: {}, rd: {}, gr: {}, best: 0, tries: 0, done: false, doneAt: '' };
        const L = P.lessons[lid];
        L.fc = L.fc || {}; L.rd = L.rd || {}; L.gr = L.gr || {};
        return L;
    }
    function peekLesson(lid) { return P.lessons[lid] || null; }
    function isLessonDone(book, lesson) { const L = peekLesson(lessonId(book, lesson)); return !!(L && L.done); }

    // Chữ Hán sạch: bỏ dấu *, chú thích trong ngoặc
    function cleanHz(hz) { return String(hz || '').replace(/[*＊]/g, '').replace(/[（(][^）)]*[）)]/g, '').trim(); }
    function cleanMean(m) { return String(m || '').replace(/\s*\/\s*$/, '').replace(/\s+/g, ' ').trim(); }

    // Từ dùng cho thẻ/kiểm tra: có chữ Hán, không trùng chữ trong bài
    function eligibleWords(lesson) {
        const seen = new Set();
        return (lesson.words || []).filter(w => {
            const h = cleanHz(w.hz);
            if (!h || seen.has(h)) return false;
            seen.add(h);
            return true;
        });
    }

    // Tính trạng thái 4 bước của một bài
    function lessonSteps(book, lesson) {
        const lid = lessonId(book, lesson);
        const L = peekLesson(lid) || { fc: {}, rd: {}, gr: {}, best: 0 };
        const words = eligibleWords(lesson);
        const fcN = words.filter(w => L.fc && L.fc[w.id]).length;
        const readings = lesson.readings || [];
        const rdN = readings.filter((r, i) => L.rd && L.rd[i]).length;
        const grammar = lesson.grammar || [];
        const grN = grammar.filter((g, i) => L.gr && L.gr[i]).length;
        const best = L.best || 0;
        const steps = [
            { key: 'vocab', mode: 'flashcard', icon: '🏮', label: 'Từ vựng', n: fcN, total: words.length,
              done: !!L.done || fcN >= words.length,
              crit: `Lật hết thẻ Flashcards của bài (${fcN}/${words.length} thẻ)` },
            { key: 'reading', mode: 'reading', icon: '📖', label: 'Bài khóa', n: rdN, total: readings.length,
              done: !!L.done || rdN >= readings.length,
              crit: `Đọc tới cuối từng phần bài khóa (${rdN}/${readings.length} phần)` },
            { key: 'grammar', mode: 'grammar', icon: '📐', label: 'Ngữ pháp', n: grN, total: grammar.length,
              done: !!L.done || grN >= grammar.length,
              crit: grammar.length ? `Cuộn xem hết các điểm ngữ pháp (${grN}/${grammar.length})` : 'Bài này không có mục ngữ pháp' },
            { key: 'test', mode: 'test', icon: '🏁', label: 'Kiểm tra', n: best, total: 100,
              done: !!L.done,
              crit: L.done && L.legacy && !best ? 'Đã hoàn thành (đánh dấu từ phiên bản cũ)'
                  : `Đạt ≥ ${PASS_TEST}% bài kiểm tra cuối bài${best ? ` (cao nhất: ${best}%)` : ''}` }
        ];
        const next = steps.find(s => !s.done) || null;
        return { steps, next, done: !!L.done, L };
    }

    function markSeen(kind, idx, wordId) {
        const book = getActiveBook(), lesson = getActiveLesson();
        const L = lessonState(lessonId(book, lesson));
        const map = L[kind];
        const key = kind === 'fc' ? wordId : idx;
        if (map[key]) return;
        const before = lessonSteps(book, lesson);
        map[key] = 1;
        saveProgress();
        const after = lessonSteps(book, lesson);
        renderLessonPath();
        // Thông báo khi vừa xong một bước
        after.steps.forEach((s, i) => {
            if (s.done && !before.steps[i].done) showToast(`✓ Xong bước "${s.label}"${after.next ? ` · Tiếp theo: ${after.next.label}` : ''}`);
        });
    }

    // ==========================================================================
    // 2c. ÔN TẬP NGẮT QUÃNG (SM-2 rút gọn, chép từ hsk_lotrinh.js)
    // ==========================================================================
    function newCard(due, iv) {
        return { ef: 2.5, iv: iv || 0, reps: iv ? 1 : 0, lapses: 0, due: due || Date.now(), last: 0 };
    }
    // Tính lần ôn kế tiếp; rating: 1 Quên, 2 Khó, 3 Nhớ, 4 Dễ
    function schedule(c, rating) {
        const n = Object.assign({}, c);
        n.last = Date.now();
        if (rating === 1) {
            n.reps = 0; n.lapses = (n.lapses || 0) + 1; n.ef = Math.max(1.3, n.ef - 0.2);
            n.iv = 0; n.due = Date.now() + 10 * 60000;
            return n;
        }
        let iv;
        if (rating === 2) { iv = Math.max(1, Math.round(c.iv * 1.2)); n.ef = Math.max(1.3, n.ef - 0.15); }
        else if (rating === 3) { iv = c.iv < 1 ? 1 : (c.reps <= 1 ? Math.max(3, c.iv + 1) : Math.round(c.iv * c.ef)); }
        else { iv = c.iv < 1 ? 3 : Math.round(Math.max(4, c.iv * c.ef * 1.3)); n.ef = n.ef + 0.15; }
        n.iv = Math.min(iv, 365); n.reps = (c.reps || 0) + 1;
        n.due = startOfDay() + n.iv * DAY;
        return n;
    }
    function ivLabel(c, rating) {
        const n = schedule(c, rating);
        if (n.iv === 0) return "10 phút";
        if (n.iv < 30) return n.iv + " ngày";
        if (n.iv < 365) return Math.round(n.iv / 30) + " tháng";
        return "1 năm";
    }
    function rateWord(id, rating) {
        if (!P.srs[id]) today().n = (today().n || 0) + 1;
        const c = P.srs[id] || newCard();
        P.srs[id] = schedule(c, rating);
        addActivity('r');
    }
    function dueIds() {
        const now = Date.now();
        return Object.keys(P.srs).filter(id => WORDS.has(id) && P.srs[id].due <= now)
            .sort((a, b) => P.srs[a].due - P.srs[b].due);
    }
    // Từ sai trong bài kiểm tra/luyện tập: đưa về ôn ngay hôm nay
    function pushWordsSoon(ids) {
        const now = Date.now();
        ids.forEach(id => {
            const c = P.srs[id];
            if (!c) { P.srs[id] = newCard(now); return; }
            c.due = Math.min(c.due, now);
            c.iv = Math.min(c.iv || 0, 1);
        });
    }
    // Bài hoàn thành: từ chưa có trong hàng ôn được thêm, hạn ôn đầu tiên là ngày mai
    function enrollLessonWords(lesson) {
        eligibleWords(lesson).forEach(w => {
            if (!P.srs[w.id]) { P.srs[w.id] = newCard(startOfDay() + DAY, 1); today().n = (today().n || 0) + 1; }
        });
    }

    // ==========================================================================
    // 2d. HOẠT ĐỘNG HẰNG NGÀY · STREAK · TÓM TẮT CHO TRANG CHỦ
    // ==========================================================================
    function today() {
        const k = dayKey();
        if (!P.days[k]) P.days[k] = { q: 0, r: 0, c: 0, rd: 0 };
        return P.days[k];
    }
    // kind: 'q' câu trả lời, 'r' thẻ ôn, 'c' bài hoàn thành, 'rd' lần đọc tính giờ
    function addActivity(kind, n) {
        const d = today();
        d[kind] = (d[kind] || 0) + (n || 1);
        const units = (d.q || 0) + (d.r || 0);
        const k = dayKey();
        if (units >= STREAK_MIN && P.streak.last !== k) {
            P.streak.count = P.streak.last === yesterdayKey() ? (P.streak.count || 0) + 1 : 1;
            P.streak.last = k;
            P.streak.best = Math.max(P.streak.best || 0, P.streak.count);
            showToast(`🔥 Chuỗi ngày học: ${P.streak.count} ngày!`);
        }
        saveProgress();
        refreshGlobal();
    }
    function currentStreak() {
        const s = P.streak || {};
        return (s.last === dayKey() || s.last === yesterdayKey()) ? (s.count || 0) : 0;
    }

    function refreshGlobal() {
        if (dom.hdrStreakCount) dom.hdrStreakCount.textContent = currentStreak();
        const streakPill = document.getElementById('hdrStreakBtn');
        if (streakPill) streakPill.classList.toggle('is-today', P.streak.last === dayKey());
        const due = dueIds().length;
        if (dom.hdrDueCount) {
            dom.hdrDueCount.textContent = due;
            dom.hdrDueCount.hidden = due === 0;
        }
    }

    // Bài nên học tiếp: bài đang mở nếu chưa xong, nếu không thì bài chưa xong kế tiếp
    function lessonAfter(book, lesson) {
        const books = window.BOYA_DATA.books;
        const i = book.lessons.indexOf(lesson);
        if (i + 1 < book.lessons.length) return { book, lesson: book.lessons[i + 1] };
        const bi = books.indexOf(book);
        if (bi + 1 < books.length) return { book: books[bi + 1], lesson: books[bi + 1].lessons[0] };
        return null;
    }
    function recommendedLesson() {
        let cur = { book: getActiveBook(), lesson: getActiveLesson() };
        let guard = 0;
        while (cur && isLessonDone(cur.book, cur.lesson) && guard++ < 200) cur = lessonAfter(cur.book, cur.lesson);
        if (cur) return cur;
        // Đã xong tới cuối: tìm bài chưa xong đầu tiên
        for (const b of window.BOYA_DATA.books) for (const l of b.lessons) if (!isLessonDone(b, l)) return { book: b, lesson: l };
        return null;
    }

    function publishSummary() {
        if (!window.HocProgress || !window.BOYA_DATA) return;
        try {
            const groups = {};
            window.BOYA_DATA.books.forEach(b => {
                groups[b.id] = { done: b.lessons.filter(l => isLessonDone(b, l)).length, total: b.lessons.length, label: b.name };
            });
            const rec = recommendedLesson();
            const d = P.days[dayKey()] || {};
            const data = {
                due: dueIds().length,
                learned: Object.keys(P.srs).filter(id => WORDS.has(id)).length,
                today: { n: d.n || 0, r: d.r || 0, q: d.q || 0 },
                streak: currentStreak(),
                groups
            };
            if (rec) {
                data.next = `${rec.book.name} · Bài ${rec.lesson.lesson_num}: ${rec.lesson.title}`;
                data.nextUrl = `boya_learning/boya_learning.html?book=${rec.book.id}&lesson=${rec.lesson.lesson_num}`;
            }
            HocProgress.save('boya_learning', data);
        } catch (e) { console.warn(e); }
    }

    // ==========================================================================
    // 3. BOOK & LESSON SWITCHING
    // ==========================================================================
    function getActiveBook() {
        return findBook(state.activeBookId) || window.BOYA_DATA.books[0];
    }

    function getActiveLesson() {
        const book = getActiveBook();
        return book.lessons.find(l => l.lesson_num === state.activeLessonNum) || book.lessons[0];
    }

    // Tên ngắn cho tab quyển trên header khi màn hình không đủ rộng (tên đầy đủ vẫn ở title)
    const BOOK_SHORT_NAMES = { tc1: 'Chuẩn TC1', tc2: 'Chuẩn TC2', tc3: 'TC1', tc4: 'TC2', gc1: 'CC1', gc2: 'CC2' };

    function renderBookSelector() {
        if (dom.bookPillsNav) {
            dom.bookPillsNav.innerHTML = window.BOYA_DATA.books.map(b => `
                <button class="book-pill-btn ${b.id === state.activeBookId ? 'active' : ''}" data-book="${b.id}" title="${escapeHtml(b.name)}">
                    <span>${b.icon}</span>
                    <span class="bp-full">${escapeHtml(b.name)}</span>
                    <span class="bp-short">${escapeHtml(BOOK_SHORT_NAMES[b.id] || b.name)}</span>
                </button>
            `).join('');

            dom.bookPillsNav.querySelectorAll('.book-pill-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const bookId = btn.getAttribute('data-book');
                    const rec = firstTodoLesson(findBook(bookId));
                    switchBook(bookId, rec, true);
                });
            });
        }

        // Render Sidebar Book Selector Dropdown
        if (dom.sidebarBookSelect) {
            dom.sidebarBookSelect.innerHTML = window.BOYA_DATA.books.map(b => `
                <option value="${b.id}" ${b.id === state.activeBookId ? 'selected' : ''}>
                    ${b.icon} ${escapeHtml(b.name)} (${escapeHtml(b.chinese_name)})
                </option>
            `).join('');

            dom.sidebarBookSelect.onchange = (e) => {
                switchBook(e.target.value, firstTodoLesson(findBook(e.target.value)), true);
            };
        }
    }

    // Đổi quyển: mở bài chưa xong đầu tiên của quyển đó
    function firstTodoLesson(book) {
        if (!book) return 1;
        const l = book.lessons.find(x => !isLessonDone(book, x));
        return (l || book.lessons[0]).lesson_num;
    }

    function switchBook(bookId, lessonNum = 1, scrollToTop = true, keepMode = false) {
        if (!findBook(bookId)) bookId = 'tc1';
        state.activeBookId = bookId;
        state.activeLessonNum = lessonNum;
        state.activeReadingIdx = 0;
        onLessonChanged();

        // Màu chính theo quyển: lấy từ bảng màu chung (shared/theme.css)
        document.documentElement.style.setProperty('--book', `var(--ui-book-${bookId})`);

        // Update Nav Pills Active state and scroll into view
        if (dom.bookPillsNav) {
            dom.bookPillsNav.querySelectorAll('.book-pill-btn').forEach(btn => {
                const isActive = btn.getAttribute('data-book') === bookId;
                btn.classList.toggle('active', isActive);
                if (isActive) {
                    try {
                        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    } catch (e) {}
                }
            });
        }

        if (dom.sidebarBookSelect) dom.sidebarBookSelect.value = bookId;

        renderSidebar();
        renderLessonHeader();
        if (!keepMode && state.activeMode === 'review') state.activeMode = state.prevMode || 'reading';
        syncModeTabs();
        renderCurrentMode();

        if (scrollToTop) scrollMainTop();

        // Close mobile drawer if open
        closeSidebar();
    }

    function switchLesson(lessonNum) {
        state.activeLessonNum = lessonNum;
        state.activeReadingIdx = 0;
        onLessonChanged();
        if (state.activeMode === 'review') state.activeMode = state.prevMode || 'reading';
        syncModeTabs();
        renderSidebar();
        renderLessonHeader();
        renderCurrentMode();
        closeSidebar();
        scrollMainTop();

        // Nạp sẵn audio bài khóa (không tự phát)
        const lesson = getActiveLesson();
        if (lesson && lesson.audio_baikhoa && state.activeMode === 'reading') {
            loadAudioTrack(lesson.audio_baikhoa, `${getActiveBook().name} • Bài ${lesson.lesson_num} (Bài Khóa)`, false);
        }
    }

    // Dọn trạng thái gắn với bài cũ, lưu bài đang học
    function onLessonChanged() {
        state.fcIndex = 0; state.fcFlipped = false; state.fcDeckKey = '';
        state.testStarted = false; state.quiz = null;
        state.timedResult = null;
        state.vocabSearch = ''; state.grammarSearch = '';
        stopTimedReading(true);
        stopShadow();
        saveSettings();
        updateUrl();
        publishSummary();
    }

    function scrollMainTop() {
        if (dom.modeContainer) dom.modeContainer.scrollTop = 0;
        if (dom.mainPanel) dom.mainPanel.scrollTop = 0;
    }

    // ==========================================================================
    // 4. SIDEBAR RENDERING & FILTERING
    // ==========================================================================
    function renderSidebar() {
        const book = getActiveBook();
        if (dom.sidebarBookSelect) dom.sidebarBookSelect.value = book.id;

        // Calculate progress
        const doneCount = book.lessons.filter(l => isLessonDone(book, l)).length;
        const pct = Math.round((doneCount / book.lessons.length) * 100);
        if (dom.sidebarProgressFill) dom.sidebarProgressFill.style.width = `${pct}%`;
        if (dom.sidebarProgressLabel) dom.sidebarProgressLabel.textContent = `${doneCount}/${book.lessons.length} Bài (${pct}%)`;

        // Filter lessons
        let filtered = book.lessons.filter(l => {
            const isDone = isLessonDone(book, l);
            if (state.sidebarFilter === 'todo' && isDone) return false;
            if (state.sidebarFilter === 'done' && !isDone) return false;

            if (state.sidebarSearch) {
                const q = state.sidebarSearch.toLowerCase();
                const matchNum = l.lesson_num.toString().includes(q) || `bài ${l.lesson_num}`.includes(q);
                const matchTitle = l.title.toLowerCase().includes(q);
                return matchNum || matchTitle;
            }
            return true;
        });

        if (!dom.sidebarLessonList) return;
        dom.sidebarLessonList.innerHTML = filtered.map(l => {
            const isCurrent = l.lesson_num === state.activeLessonNum;
            const info = lessonSteps(book, l);
            const isDone = info.done;
            const stepsDone = info.steps.filter(s => s.done).length;
            const status = isDone
                ? '✓'
                : (stepsDone > 0 ? `<span class="lci-steps">${stepsDone}/4</span>` : '○');
            return `
                <div class="lesson-card-item ${isCurrent ? 'active' : ''} ${isDone ? 'completed' : ''}" data-lesson="${l.lesson_num}">
                    <div class="lci-left">
                        <div class="lci-num-badge">${l.lesson_num}</div>
                        <div class="lci-info">
                            <div class="lci-title">${escapeHtml(l.title)}</div>
                            <div class="lci-sub">
                                <span>${(l.words || []).length} từ</span>
                                <span>•</span>
                                <span>${(l.grammar || []).length} ngữ pháp</span>
                                ${info.L.best ? `<span>•</span><span>KT ${info.L.best}%</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="lci-right">
                        <span class="lci-status-icon" title="${isDone ? 'Đã hoàn thành' : stepsDone + '/4 bước'}">${status}</span>
                    </div>
                </div>
            `;
        }).join('');

        dom.sidebarLessonList.querySelectorAll('.lesson-card-item').forEach(card => {
            card.addEventListener('click', () => {
                const num = parseInt(card.getAttribute('data-lesson'), 10);
                switchLesson(num);
            });
        });
    }

    function renderLessonHeader() {
        const book = getActiveBook();
        const lesson = getActiveLesson();

        if (dom.lessonMetaBadge) {
            dom.lessonMetaBadge.innerHTML = `
                <span>${book.icon} ${escapeHtml(book.name)}</span>
                <span>•</span>
                <span>BÀI ${lesson.lesson_num} / ${book.lessons.length}</span>
            `;
        }

        if (dom.lessonMainTitle) dom.lessonMainTitle.textContent = lesson.title;

        // Update Tab Badges dynamically
        if (dom.tabBadgeVocab) dom.tabBadgeVocab.textContent = (lesson.words || []).length;
        if (dom.tabBadgeGrammar) dom.tabBadgeGrammar.textContent = (lesson.grammar || []).length;

        renderLessonPath();
    }

    function fmtDate(k) {
        if (!k) return '';
        const p = k.split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : k;
    }

    // Checklist 4 bước ở đầu bài, bước kế tiếp được làm nổi bật
    function renderLessonPath() {
        if (!dom.lessonPath) return;
        const book = getActiveBook(), lesson = getActiveLesson();
        const info = lessonSteps(book, lesson);
        const nxt = lessonAfter(book, lesson);

        const chips = info.steps.map((s, i) => {
            const cls = s.done ? 'is-done' : (info.next === s ? 'is-next' : '');
            const sub = s.key === 'test'
                ? (s.done ? (info.L.best ? `${info.L.best}%` : 'Xong') : (info.L.best ? `Cao nhất ${info.L.best}%` : `Cần ≥ ${PASS_TEST}%`))
                : (s.total ? `${s.n}/${s.total}` : '—');
            return `
                <button class="lp-step ${cls} ${state.activeMode === s.mode ? 'is-current' : ''}" data-mode="${s.mode}" title="${escapeHtml(s.crit)}">
                    <span class="lp-dot">${s.done ? '✓' : i + 1}</span>
                    <span class="lp-text">
                        <span class="lp-label">${s.label}</span>
                        <span class="lp-sub">${sub}</span>
                    </span>
                </button>
            `;
        }).join('<span class="lp-sep" aria-hidden="true"></span>');

        let note;
        if (info.done) {
            const L = info.L;
            note = `<span class="lp-note-done">✓ Đã hoàn thành${L.doneAt ? ` ngày ${fmtDate(L.doneAt)}` : ''}${L.best ? ` · điểm cao nhất ${L.best}%` : ''}</span>
                ${nxt ? `<button class="lp-next-lesson" id="btnNextLesson">Bài tiếp: ${nxt.book !== book ? escapeHtml(nxt.book.name) + ' · ' : ''}Bài ${nxt.lesson.lesson_num} →</button>` : ''}`;
        } else {
            note = `<span class="lp-note-label">Bước tiếp theo:</span> <b>${info.next.label}</b> — ${escapeHtml(info.next.crit)}`;
        }

        dom.lessonPath.innerHTML = `
            <div class="lp-steps" role="list">${chips}</div>
            <div class="lp-note">${note}</div>
        `;
        dom.lessonPath.querySelectorAll('.lp-step').forEach(b => b.addEventListener('click', () => switchMode(b.getAttribute('data-mode'))));
        const bn = document.getElementById('btnNextLesson');
        if (bn && nxt) bn.addEventListener('click', () => goToLesson(nxt.book.id, nxt.lesson.lesson_num));

        if (dom.lessonStatusArea) {
            const doneSteps = info.steps.filter(s => s.done).length;
            dom.lessonStatusArea.innerHTML = info.done
                ? `<span class="lesson-status-pill is-done">✓ Hoàn thành</span>`
                : `<span class="lesson-status-pill">${doneSteps}/4 bước</span>`;
        }
    }

    function goToLesson(bookId, num, mode) {
        if (bookId !== state.activeBookId) switchBook(bookId, num, true);
        else switchLesson(num);
        if (mode) switchMode(mode);
        renderSidebar();
    }

    // ==========================================================================
    // 5. STUDY MODES ROUTING & RENDERING
    // ==========================================================================
    function syncModeTabs() {
        if (dom.modeTabs) {
            dom.modeTabs.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-mode') === state.activeMode));
        }
        if (dom.mainPanel) dom.mainPanel.classList.toggle('is-review', state.activeMode === 'review');
        const rb = document.getElementById('hdrReviewBtn');
        if (rb) rb.classList.toggle('active', state.activeMode === 'review');
    }

    function switchMode(newMode) {
        if (!MODES.includes(newMode)) newMode = 'reading';
        if (newMode === 'review' && state.activeMode !== 'review') state.prevMode = state.activeMode;
        if (newMode === 'review') state.review = null; // gom lại danh sách đến hạn
        state.activeMode = newMode;
        syncModeTabs();
        saveSettings();
        renderCurrentMode();
        renderLessonPath();
        scrollMainTop();
    }

    function renderCurrentMode() {
        if (!dom.modeContainer) return;

        // Dọn các tiến trình chạy nền của chế độ cũ
        if (state.activeMode !== 'podcast' && state.podcastRunning) stopPodcast();
        clearInterval(state.matchTimerId);
        state.matchTimerId = null;
        if (state.activeMode !== 'reading') { stopTimedReading(true); stopShadow(); }
        if (state.activeMode !== 'quiz' && state.activeMode !== 'test') state.quiz = null;
        if (state.activeMode !== 'test') state.testStarted = false;
        sentinelCheck = null;

        switch (state.activeMode) {
            case 'reading': renderReadingStudio(); break;
            case 'vocab': renderVocabStudio(); break;
            case 'grammar': renderGrammarStudio(); break;
            case 'flashcard': renderFlashcardStudio(); break;
            case 'quiz': renderQuizStudio(); break;
            case 'test': renderTestStudio(); break;
            case 'podcast': renderPodcastStudio(); break;
            case 'review': renderReviewStudio(); break;
            default: renderReadingStudio();
        }
    }

    // Theo dõi phần tử "đã xem tới cuối" (bài khóa, ngữ pháp)
    // Kiểm tra bằng vị trí khi cuộn (mọi vùng cuộn) — đơn giản, chạy ổn trên mọi trình duyệt.
    let sentinelCheck = null;
    let sentinelTick = 0;
    function observeSentinels(onSeen) {
        const pending = new Set(dom.modeContainer.querySelectorAll('.seen-sentinel'));
        if (!pending.size) { sentinelCheck = null; return; }
        const check = () => {
            const box = dom.modeContainer.getBoundingClientRect();
            const bottom = Math.min(box.bottom, window.innerHeight);
            pending.forEach(el => {
                if (!el.isConnected) { pending.delete(el); return; }
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.top < bottom && r.bottom > box.top - 2) {
                    pending.delete(el);
                    onSeen(el);
                }
            });
            if (!pending.size && sentinelCheck === check) sentinelCheck = null;
        };
        sentinelCheck = check;
        setTimeout(() => { if (sentinelCheck === check) check(); }, 400);
    }
    function onAnyScroll() {
        if (!sentinelCheck || sentinelTick) return;
        sentinelTick = setTimeout(() => { sentinelTick = 0; if (sentinelCheck) sentinelCheck(); }, 120);
    }

    // ==========================================================================
    // 6. MODE 1: BÀI KHÓA (READING STUDIO)
    // ==========================================================================
    function buildInterlinearReadingHtml(html, translations) {
        // Split HTML into blocks based on <span class="block"
        const blockMatches = [...html.matchAll(/<span class="block"[^>]*>/g)];
        if (!blockMatches || blockMatches.length === 0) {
            return html;
        }
        translations = translations || [];

        // Map translations by 【N】
        const transMap = {};
        translations.forEach((t) => {
            const m = t.match(/^\s*【(\d+)】/);
            if (m) {
                transMap[parseInt(m[1], 10)] = t;
            }
        });

        const rawBlocks = [];
        for (let i = 0; i < blockMatches.length; i++) {
            const start = blockMatches[i].index;
            const end = (i + 1 < blockMatches.length) ? blockMatches[i + 1].index : html.length;
            rawBlocks.push(html.slice(start, end).trim());
        }

        const shadowBtn = `<button class="btn-shadow" type="button" title="Nghe-nhại: máy đọc đoạn này, bạn đọc lại theo (3 lượt)">🗣 Nhại</button>`;

        let seqTransIdx = 0;
        const cardsHtml = rawBlocks.map((bHtml, bIdx) => {
            const cleanText = bHtml.replace(/<rt>[\s\S]*?<\/rt>/g, '').replace(/<[^>]+>/g, '').trim();
            if (!cleanText) return '';

            const isTitle = bHtml.includes('text-align: center') || (bHtml.includes('font-weight: bold') && bIdx === 0) || bHtml.includes('font-size: 26px') || bHtml.includes('font-size: 24px');
            const isAttr = bHtml.includes('text-align: right') || cleanText.startsWith('（根据') || cleanText.startsWith('（选自') || cleanText.startsWith('(根据') || cleanText.startsWith('(选自');

            let matchedTrans = null;
            let paraLabel = '';

            const mNum = cleanText.match(/【(\d+)】/);
            if (mNum) {
                const num = parseInt(mNum[1], 10);
                paraLabel = `Đoạn ${num}`;
                if (transMap[num]) {
                    matchedTrans = transMap[num];
                }
            }

            if (!matchedTrans && !isTitle && !isAttr) {
                if (seqTransIdx < translations.length) {
                    matchedTrans = translations[seqTransIdx];
                    seqTransIdx++;
                    paraLabel = `Đoạn ${seqTransIdx}`;
                }
            }

            let cleanTransText = matchedTrans || '';
            if (cleanTransText && mNum) {
                cleanTransText = cleanTransText.replace(new RegExp(`^\\s*【${mNum[1]}】\\s*`), '');
            } else if (cleanTransText) {
                cleanTransText = cleanTransText.replace(/^\s*【\d+】\s*/, '');
            }

            if (isTitle) {
                return `<div class="para-card is-title-card"><div class="para-chinese">${bHtml}</div></div>`;
            }
            if (isAttr) {
                return `<div class="para-card is-attr-card"><div class="para-chinese">${bHtml}</div></div>`;
            }

            if (!matchedTrans) {
                return `<div class="para-card"><div class="para-tools">${shadowBtn}</div><div class="para-chinese">${bHtml}</div></div>`;
            }

            return `
                <div class="para-card has-translation" data-para-idx="${bIdx}">
                    <div class="para-tools">${shadowBtn}</div>
                    <div class="para-chinese">
                        ${bHtml}
                    </div>
                    <div class="para-translation ${state.transVisible ? '' : 'collapsed'}" data-para-idx="${bIdx}">
                        <div class="pt-header" title="Nhấp để Ẩn / Hiện bản dịch đoạn này">
                            <span class="pt-tag">🇻🇳 ${paraLabel || 'Bản dịch'}</span>
                            <button class="btn-pt-toggle" type="button" title="Thu gọn / Mở rộng">
                                <span class="pt-toggle-text">${state.transVisible ? 'Thu gọn' : 'Xem dịch'}</span>
                                <span class="pt-toggle-icon">${state.transVisible ? '▴' : '▾'}</span>
                            </button>
                        </div>
                        <div class="pt-content">
                            ${cleanTransText}
                        </div>
                    </div>
                </div>
            `;
        }).join('\n');

        return cardsHtml;
    }

    // Đếm chữ Hán thật trong bài (bỏ pinyin trong <rt>, thẻ HTML, dấu câu)
    function countHanChars(html) {
        const text = String(html || '').replace(/<rt>[\s\S]*?<\/rt>/g, '').replace(/<[^>]+>/g, '');
        const m = text.match(/\p{Script=Han}/gu);
        return m ? m.length : 0;
    }

    function readingKey(idx) {
        return `${lessonId(getActiveBook(), getActiveLesson())}#${idx}`;
    }

    // Khung "Đọc tính giờ" phía trên bài đọc
    function renderSpeedPanelHtml(reading) {
        const hist = P.reading[readingKey(state.activeReadingIdx)] || [];
        const chars = countHanChars(reading.chinese_html);
        const n = hist.length + 1;
        if (state.timed) {
            return `
                <div class="speed-panel is-running" id="speedPanel">
                    <div class="sp-left">
                        <span class="sp-timer" id="speedTimer">00:00</span>
                        <span class="sp-info">Đang đọc lần ${state.timed.run} · ${chars} chữ Hán${!state.pinyinVisible ? ' · pinyin đang tắt' : ''}</span>
                    </div>
                    <button class="sp-btn sp-btn-stop" id="btnTimedStop">⏹ Đọc xong</button>
                </div>`;
        }
        const last = hist[hist.length - 1];
        const best = hist.reduce((m, h) => Math.max(m, h.cpm), 0);
        let resHtml = '';
        const r = state.timedResult;
        if (r && r.key === readingKey(state.activeReadingIdx)) {
            const diff = r.prev ? Math.round((r.cpm - r.prev) / r.prev * 100) : null;
            resHtml = `
                <div class="sp-result">
                    <div class="sp-big">${r.cpm} <small>chữ/phút</small></div>
                    <div class="sp-detail">
                        Lần ${r.run}: ${r.chars} chữ trong ${fmtDuration(r.sec)}
                        ${diff !== null ? ` · <span class="${diff >= 0 ? 'sp-up' : 'sp-down'}">${diff >= 0 ? '▲ +' : '▼ '}${diff}% so với lần trước</span>` : ''}
                        ${r.record && r.run > 1 ? ' · <span class="sp-up">🏆 Kỷ lục mới!</span>' : ''}
                    </div>
                </div>`;
        }
        const startLabel = n === 1 ? '⏱ Bắt đầu đọc tính giờ' : `⏱ Đọc lại lần ${n} (pinyin tắt sẵn)`;
        return `
            <div class="speed-panel" id="speedPanel">
                <div class="sp-left">
                    ${resHtml || `
                        <span class="sp-title">⏱ Luyện đọc nhanh</span>
                        <span class="sp-info">${hist.length
                            ? `Lần trước: <b>${last.cpm}</b> chữ/phút · Kỷ lục: <b>${best}</b> · Đã đọc ${hist.length} lần`
                            : `Bấm bắt đầu, đọc hết ${chars} chữ Hán rồi bấm "Đọc xong" để đo số chữ/phút.`}</span>`}
                </div>
                <button class="sp-btn" id="btnTimedStart">${startLabel}</button>
            </div>`;
    }

    function fmtDuration(sec) {
        sec = Math.round(sec);
        return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    }

    function startTimedReading() {
        const hist = P.reading[readingKey(state.activeReadingIdx)] || [];
        const run = hist.length + 1;
        state.timedResult = null;
        state.timed = { start: Date.now(), idx: state.activeReadingIdx, run, prevPinyin: state.pinyinVisible, prevTrans: state.transVisible, timerId: null };
        // Từ lần đọc thứ 2: tắt pinyin để luyện nhận mặt chữ
        if (run >= 2) state.pinyinVisible = false;
        state.transVisible = false;
        renderReadingStudio();
        updatePinyinUI();
        state.timed.timerId = setInterval(() => {
            const el = document.getElementById('speedTimer');
            if (el && state.timed) el.textContent = fmtDuration((Date.now() - state.timed.start) / 1000).padStart(5, '0');
        }, 500);
    }

    // silent = true: hủy (rời trang / đổi bài), không lưu
    function stopTimedReading(silent) {
        const t = state.timed;
        if (!t) return;
        clearInterval(t.timerId);
        state.timed = null;
        state.pinyinVisible = t.prevPinyin;
        state.transVisible = t.prevTrans;
        updatePinyinUI();
        if (silent) return;

        const lesson = getActiveLesson();
        const reading = lesson.readings[t.idx];
        const sec = (Date.now() - t.start) / 1000;
        const chars = countHanChars(reading && reading.chinese_html);
        if (sec < 5 || !chars) {
            showToast('Thời gian quá ngắn, lần đọc này không được lưu.');
            renderReadingStudio();
            return;
        }
        const cpm = Math.round(chars / (sec / 60));
        if (cpm > 1200) {
            // nhanh hơn mức đọc hiểu thực tế → có lẽ chỉ lướt qua, không tính kỷ lục
            showToast(`${cpm} chữ/phút là quá nhanh để đọc hiểu — lần này không được lưu.`);
            renderReadingStudio();
            return;
        }
        const key = readingKey(t.idx);
        const hist = P.reading[key] = P.reading[key] || [];
        const prev = hist.length ? hist[hist.length - 1].cpm : 0;
        const best = hist.reduce((m, h) => Math.max(m, h.cpm), 0);
        hist.push({ d: dayKey(), cpm, sec: Math.round(sec), chars });
        if (hist.length > 30) hist.splice(0, hist.length - 30);
        state.timedResult = { key, cpm, sec, chars, prev, run: hist.length, record: cpm > best };
        // Đọc hết một lượt tính giờ = đã đọc phần này
        lessonState(lessonId(getActiveBook(), lesson)).rd[t.idx] = 1;
        addActivity('rd');
        renderReadingStudio();
        renderLessonPath();
        renderSidebar();
    }

    // Nghe-nhại theo đoạn bằng TTS: đọc → chờ người học nhại → lặp 3 lượt
    function stopShadow() {
        const s = state.shadow;
        if (!s) return;
        clearTimeout(s.timer);
        state.shadow = null;
        if (s.el) {
            s.el.classList.remove('is-shadowing', 'is-your-turn');
            const b = s.el.querySelector('.btn-shadow');
            if (b) b.textContent = '🗣 Nhại';
        }
        if (window.speechSynthesis) window.speechSynthesis.cancel();
    }

    function startShadow(card) {
        const wasSame = state.shadow && state.shadow.el === card;
        stopShadow();
        if (wasSame) return;
        const zh = card.querySelector('.para-chinese');
        if (!zh) return;
        const clone = zh.cloneNode(true);
        clone.querySelectorAll('rt').forEach(r => r.remove());
        const text = clone.textContent.replace(/【\d+】/g, '').replace(/\s+/g, '').trim();
        if (!text) return;
        const sh = state.shadow = { el: card, round: 0, timer: null };
        const btn = card.querySelector('.btn-shadow');
        card.classList.add('is-shadowing');
        const pauseMs = Math.max(2500, countHanChars(text) * 330);
        const loop = () => {
            if (state.shadow !== sh) return;
            sh.round++;
            if (sh.round > 3) { stopShadow(); showToast('✓ Xong 3 lượt nghe-nhại đoạn này'); return; }
            card.classList.remove('is-your-turn');
            if (btn) btn.textContent = `⏹ Nghe ${sh.round}/3`;
            speakChinese(text, () => {
                if (state.shadow !== sh) return;
                card.classList.add('is-your-turn');
                if (btn) btn.textContent = `🎙 Bạn nhại ${sh.round}/3`;
                sh.timer = setTimeout(loop, pauseMs);
            }, 0.8);
        };
        loop();
    }

    function renderReadingStudio() {
        const lesson = getActiveLesson();
        const book = getActiveBook();

        if (!lesson.readings || lesson.readings.length === 0) {
            dom.modeContainer.innerHTML = `<div class="empty-state">Không có nội dung bài đọc cho bài này.</div>`;
            return;
        }
        if (state.activeReadingIdx >= lesson.readings.length) state.activeReadingIdx = 0;
        const reading = lesson.readings[state.activeReadingIdx];

        let processedHtml = reading.chinese_html || '';
        let clozeCount = 0;
        // Ôn bài khóa: che các từ vựng của bài trong văn bản
        if (state.clozeMode && !state.timed) {
            const res = applyClozeFilter(processedHtml, lesson.words || []);
            processedHtml = res.html;
            clozeCount = res.count;
        }

        const L = peekLesson(lessonId(book, lesson)) || { rd: {} };
        const subBarHtml = lesson.readings.length > 1 ? `
            <div class="sub-readings-bar">
                ${lesson.readings.map((r, idx) => `
                    <button class="sub-reading-btn ${idx === state.activeReadingIdx ? 'active' : ''}" data-idx="${idx}">
                        ${L.rd && L.rd[idx] ? '✓ ' : ''}${escapeHtml(r.title)}
                    </button>
                `).join('')}
            </div>
        ` : '';

        const displayHtml = state.readingLayout === 'interlinear'
            ? buildInterlinearReadingHtml(processedHtml, reading.translations || [])
            : processedHtml;

        dom.modeContainer.innerHTML = `
            <div class="reading-studio">
                ${subBarHtml}

                <div class="reading-toolbar">
                    <div class="rt-group">
                        ${reading.audio ? `
                            <button class="rt-btn audio-play-btn" id="btnPlayReadingAudio" data-audio="${escapeHtml(reading.audio)}" data-title="${escapeHtml(`${book.name} - Bài ${lesson.lesson_num} (${reading.title})`)}">
                                🔊 Nghe Bài Này
                            </button>
                        ` : ''}

                        <button class="rt-btn trans-toggle-btn ${state.transVisible ? 'active' : ''}" id="btnToggleTrans" title="Bật / Tắt hiển thị bản dịch (Phím T)">
                            <span>🇻🇳</span>
                            <span>Bản Dịch: <strong id="transStatusText">${state.transVisible ? 'Hiện' : 'Ẩn'}</strong></span>
                        </button>

                        <button class="rt-btn ${state.clozeMode ? 'active' : ''}" id="btnToggleCloze" title="Ôn bài khóa: che các từ vựng của bài, chạm vào ô để hiện lại">
                            🙈 Che từ vựng${state.clozeMode ? `: ${clozeCount}` : ''}
                        </button>

                        <select class="rt-btn" id="selectReadingLayout" title="Bố cục hiển thị bản dịch">
                            <option value="interlinear" ${state.readingLayout === 'interlinear' ? 'selected' : ''}>📝 Dịch xen kẽ từng đoạn</option>
                            <option value="standard" ${state.readingLayout === 'standard' ? 'selected' : ''}>📄 Dịch ở cuối bài</option>
                        </select>
                    </div>

                    <div class="rt-group">
                        <select class="rt-btn" id="selectFontFamily" title="Kiểu chữ Hán">
                            <option value="kaiti" ${state.fontStyle === 'kaiti' ? 'selected' : ''}>Khải Thư (Chuẩn)</option>
                            <option value="heiti" ${state.fontStyle === 'heiti' ? 'selected' : ''}>Hán Thể Không Chân</option>
                            <option value="songti" ${state.fontStyle === 'songti' ? 'selected' : ''}>Tống Thể</option>
                        </select>

                        <div class="zoom-controls" title="Cỡ chữ">
                            <button class="zoom-btn" id="btnZoomOut">A-</button>
                            <span class="zoom-label">${state.fontSize}px</span>
                            <button class="zoom-btn" id="btnZoomIn">A+</button>
                        </div>
                    </div>
                </div>

                ${renderSpeedPanelHtml(reading)}

                <div class="reading-card">
                    <div class="reading-title-area">
                        <h2 class="reading-passage-title">${escapeHtml(reading.title)}</h2>
                    </div>

                    <div class="chinese-text-content ${state.pinyinVisible ? '' : 'hide-pinyin'} font-${state.fontStyle} layout-${state.readingLayout}"
                         id="chineseTextContent"
                         style="--reading-font-size: ${state.fontSize}px;">
                        ${displayHtml}
                    </div>
                    <div class="seen-sentinel" data-kind="rd" data-idx="${state.activeReadingIdx}"></div>
                    ${L.rd && L.rd[state.activeReadingIdx] ? '' : `<div class="read-end-hint">Cuộn tới đây là đã đọc xong phần này ✓</div>`}
                </div>

                ${state.timed ? '' : (state.readingLayout === 'interlinear' ? `
                    <div class="translation-section full-summary-section" id="translationSection">
                        <div class="translation-header" id="fullTransToggleHeader" title="Nhấp để Mở rộng / Thu gọn toàn bộ bản dịch">
                            <span class="th-title">🇻🇳 Toàn Bộ Bản Dịch Tham Khảo</span>
                            <span class="th-count">
                                ${(reading.translations || []).length} Đoạn dịch <span id="fullTransIco">▾</span>
                            </span>
                        </div>
                        <div class="translation-body" id="fullTransBody" style="display: none;">
                            ${(reading.translations || []).map(t => `
                                <div class="translation-line">${t}</div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="translation-section" id="translationSection" style="display: ${state.transVisible ? 'block' : 'none'};">
                        <div class="translation-header">
                            <span class="th-title">🇻🇳 Bản Dịch Tham Khảo</span>
                            <span class="th-count">${(reading.translations || []).length} Đoạn dịch</span>
                        </div>
                        <div class="translation-body">
                            ${(reading.translations || []).map(t => `
                                <div class="translation-line">${t}</div>
                            `).join('')}
                        </div>
                    </div>
                `)}
            </div>
        `;

        // Đã đọc tới cuối: cần ở lại đủ lâu (ước lượng tối đa ~600 chữ/phút, tối đa 20 giây)
        state.readRenderAt = Date.now();
        const renderedLid = lessonId(book, lesson);
        const needMs = Math.min(20000, countHanChars(reading.chinese_html) * 100);
        observeSentinels(el => {
            const idx = parseInt(el.getAttribute('data-idx'), 10);
            const wait = Math.max(0, needMs - (Date.now() - state.readRenderAt));
            setTimeout(() => {
                if (state.activeMode !== 'reading' || lessonId(getActiveBook(), getActiveLesson()) !== renderedLid) return;
                markSeen('rd', idx);
                const hint = dom.modeContainer.querySelector('.read-end-hint');
                if (hint && state.activeReadingIdx === idx) hint.remove();
                const sb = dom.modeContainer.querySelector(`.sub-reading-btn[data-idx="${idx}"]`);
                if (sb && !sb.textContent.trim().startsWith('✓')) sb.textContent = '✓ ' + sb.textContent.trim();
            }, wait);
        });

        // Bind Sub-reading buttons
        dom.modeContainer.querySelectorAll('.sub-reading-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                stopTimedReading(true);
                stopShadow();
                state.activeReadingIdx = parseInt(btn.getAttribute('data-idx'), 10);
                state.timedResult = null;
                renderReadingStudio();
            });
        });

        // Bind Audio Play Button
        const btnPlay = document.getElementById('btnPlayReadingAudio');
        if (btnPlay) {
            btnPlay.addEventListener('click', () => {
                loadAudioTrack(btnPlay.getAttribute('data-audio'), btnPlay.getAttribute('data-title'), true);
            });
        }
        updatePinyinUI();

        // Đọc tính giờ
        const bStart = document.getElementById('btnTimedStart');
        if (bStart) bStart.addEventListener('click', startTimedReading);
        const bStop = document.getElementById('btnTimedStop');
        if (bStop) bStop.addEventListener('click', () => stopTimedReading(false));

        // Bind Translation Toggle Button
        const btnTrans = document.getElementById('btnToggleTrans');
        if (btnTrans) btnTrans.addEventListener('click', toggleTranslation);
        updateTranslationUI();

        // Bind Reading Layout Switcher
        const selLayout = document.getElementById('selectReadingLayout');
        if (selLayout) {
            selLayout.addEventListener('change', (e) => {
                state.readingLayout = e.target.value;
                saveSettings();
                renderReadingStudio();
            });
        }

        // Bind Individual Paragraph Translation Toggle (Accordion)
        dom.modeContainer.querySelectorAll('.para-translation .pt-header').forEach(hdr => {
            hdr.addEventListener('click', (e) => {
                e.stopPropagation();
                const pt = hdr.closest('.para-translation');
                if (pt) {
                    const isCollapsed = pt.classList.toggle('collapsed');
                    const txt = pt.querySelector('.pt-toggle-text');
                    const ico = pt.querySelector('.pt-toggle-icon');
                    if (txt) txt.textContent = isCollapsed ? 'Xem dịch' : 'Thu gọn';
                    if (ico) ico.textContent = isCollapsed ? '▾' : '▴';
                }
            });
        });

        // Nghe-nhại theo đoạn
        dom.modeContainer.querySelectorAll('.btn-shadow').forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                startShadow(b.closest('.para-card'));
            });
        });

        // Bind Full Summary Translation Toggle (in Interlinear mode)
        const fullHdr = document.getElementById('fullTransToggleHeader');
        if (fullHdr) {
            fullHdr.addEventListener('click', () => {
                const body = document.getElementById('fullTransBody');
                const ico = document.getElementById('fullTransIco');
                if (body) {
                    const isHidden = body.style.display === 'none';
                    body.style.display = isHidden ? 'block' : 'none';
                    if (ico) ico.textContent = isHidden ? '▴' : '▾';
                }
            });
        }

        // Che từ vựng (ôn bài khóa)
        const btnCloze = document.getElementById('btnToggleCloze');
        if (btnCloze) {
            btnCloze.addEventListener('click', () => {
                state.clozeMode = !state.clozeMode;
                renderReadingStudio();
                if (state.clozeMode) showToast('🙈 Đã che từ vựng của bài. Nhớ lại từ rồi chạm vào ô để kiểm tra.');
            });
        }

        // Bind Cloze click reveal
        dom.modeContainer.querySelectorAll('.cloze-hidden-word').forEach(cw => {
            cw.addEventListener('click', (e) => {
                e.stopPropagation();
                cw.classList.toggle('revealed');
            });
        });

        // Bind Font Select
        const selFont = document.getElementById('selectFontFamily');
        if (selFont) {
            selFont.addEventListener('change', (e) => {
                state.fontStyle = e.target.value;
                saveSettings();
                const content = document.getElementById('chineseTextContent');
                if (content) {
                    content.className = `chinese-text-content ${state.pinyinVisible ? '' : 'hide-pinyin'} font-${state.fontStyle} layout-${state.readingLayout}`;
                }
            });
        }

        // Bind Zoom In / Out
        const btnZoomIn = document.getElementById('btnZoomIn');
        const btnZoomOut = document.getElementById('btnZoomOut');
        if (btnZoomIn) {
            btnZoomIn.addEventListener('click', () => {
                if (state.fontSize < 36) {
                    state.fontSize += 2;
                    saveSettings();
                    renderReadingStudio();
                }
            });
        }
        if (btnZoomOut) {
            btnZoomOut.addEventListener('click', () => {
                if (state.fontSize > 16) {
                    state.fontSize -= 2;
                    saveSettings();
                    renderReadingStudio();
                }
            });
        }

        // Chạm vào chữ Hán để nghe phát âm
        dom.modeContainer.querySelectorAll('#chineseTextContent ruby').forEach(rb => {
            rb.addEventListener('click', () => {
                if (rb.closest('.cloze-hidden-word:not(.revealed)')) return;
                const clone = rb.cloneNode(true);
                clone.querySelectorAll('rt').forEach(r => r.remove());
                const text = clone.textContent.trim();
                if (text) speakChinese(text);
            });
        });
    }

    function toggleTranslation() {
        state.transVisible = !state.transVisible;
        saveSettings();
        updateTranslationUI();
    }

    function updateTranslationUI() {
        const btnTrans = document.getElementById('btnToggleTrans');
        if (btnTrans) {
            btnTrans.classList.toggle('active', state.transVisible);
            const st = btnTrans.querySelector('#transStatusText');
            if (st) st.textContent = state.transVisible ? 'Hiện' : 'Ẩn';
        }

        // Update interlinear cards
        const ptCards = dom.modeContainer ? dom.modeContainer.querySelectorAll('.para-translation') : [];
        ptCards.forEach(pt => {
            pt.classList.toggle('collapsed', !state.transVisible);
            const txt = pt.querySelector('.pt-toggle-text');
            const ico = pt.querySelector('.pt-toggle-icon');
            if (txt) txt.textContent = state.transVisible ? 'Thu gọn' : 'Xem dịch';
            if (ico) ico.textContent = state.transVisible ? '▴' : '▾';
        });

        // In standard layout, toggle translationSection
        const sec = document.getElementById('translationSection');
        if (sec && state.readingLayout === 'standard') {
            sec.style.display = state.transVisible ? 'block' : 'none';
        }
    }

    function togglePinyin() {
        state.pinyinVisible = !state.pinyinVisible;
        if (!state.timed) saveSettings();
        updatePinyinUI();
    }

    function updatePinyinUI() {
        const stickyBtn = document.getElementById('stickyTogglePinyin');
        const stickyText = document.getElementById('stickyPinyinStatus');
        if (stickyBtn) {
            stickyBtn.classList.toggle('active', state.pinyinVisible);
            stickyBtn.setAttribute('aria-pressed', state.pinyinVisible ? 'true' : 'false');
        }
        if (stickyText) stickyText.textContent = state.pinyinVisible ? 'Bật' : 'Tắt';

        // Đổi ngay trên bài đọc, không cần vẽ lại
        const textContent = document.getElementById('chineseTextContent');
        if (textContent) textContent.classList.toggle('hide-pinyin', !state.pinyinVisible);
    }

    // Che các từ vựng của bài trong văn bản (mỗi chữ Hán nằm trong một <ruby>)
    function applyClozeFilter(html, words) {
        const re = /<ruby>([^<]*)<rt>[^<]*<\/rt><\/ruby>/g;
        const toks = [];
        let m;
        while ((m = re.exec(html))) toks.push({ s: m.index, e: m.index + m[0].length, ch: m[1] });
        if (!toks.length) return { html, count: 0 };

        // Chuỗi chữ liền nhau; '|' đánh dấu chỗ bị ngắt (dấu câu, thẻ khác)
        let text = '';
        const pos = []; // vị trí ký tự trong text → chỉ số token
        toks.forEach((t, i) => {
            if (i > 0 && toks[i - 1].e !== t.s) { text += '|'; pos.push(-1); }
            for (const c of t.ch) { text += c; pos.push(i); }
        });

        const mark = new Array(toks.length).fill(0); // 0: không che, >0: id nhóm
        let gid = 0;
        const targets = [...new Set((words || []).map(w => cleanHz(w.hz)).filter(h => h.length >= 2))]
            .sort((a, b) => b.length - a.length);
        targets.forEach(h => {
            let from = 0, at;
            while ((at = text.indexOf(h, from)) >= 0) {
                from = at + h.length;
                const ids = [];
                for (let k = at; k < at + h.length; k++) ids.push(pos[k]);
                if (ids.some(x => x < 0 || mark[x])) continue;
                gid++;
                ids.forEach(x => { mark[x] = gid; });
            }
        });

        let out = '', last = 0;
        for (let i = 0; i < toks.length; i++) {
            if (!mark[i]) continue;
            if (i > 0 && mark[i - 1] === mark[i]) continue;
            let j = i;
            while (j + 1 < toks.length && mark[j + 1] === mark[i]) j++;
            out += html.slice(last, toks[i].s) + `<span class="cloze-hidden-word">` + html.slice(toks[i].s, toks[j].e) + `</span>`;
            last = toks[j].e;
        }
        out += html.slice(last);
        return { html: out, count: gid };
    }


    // ==========================================================================
    // 7. MODE 2: BẢNG TỪ VỰNG (VOCABULARY STUDIO)
    // ==========================================================================
    function renderVocabStudio() {
        const lesson = getActiveLesson();
        const book = getActiveBook();

        let words = lesson.words || [];

        // Filter by search
        if (state.vocabSearch) {
            const q = state.vocabSearch.toLowerCase();
            words = words.filter(w => 
                w.hz.toLowerCase().includes(q) || 
                w.py.toLowerCase().includes(q) || 
                w.mean.toLowerCase().includes(q)
            );
        }

        // Filter by word type
        if (state.vocabTypeFilter !== 'all') {
            words = words.filter(w => w.type.includes(state.vocabTypeFilter));
        }

        dom.modeContainer.innerHTML = `
            <div class="vocab-studio">
                <div class="vocab-actions-bar">
                    <div class="vab-left">
                        ${lesson.audio_tuvung ? `
                            <button class="rt-btn audio-play-btn" id="btnPlayAllVocabAudio" data-audio="${lesson.audio_tuvung}">
                                🔊 Nghe Toàn Bộ Từ Vựng
                            </button>
                        ` : ''}

                        <div class="vab-search">
                            <span class="vab-search-icon">🔍</span>
                            <input type="text" id="inputVocabSearch" placeholder="Lọc từ (Hán, Pinyin, Nghĩa)..." value="${escapeHtml(state.vocabSearch)}">
                        </div>

                        <select class="rt-btn" id="selectVocabType">
                            <option value="all" ${state.vocabTypeFilter === 'all' ? 'selected' : ''}>Tất cả loại từ (${lesson.words.length})</option>
                            <option value="名" ${state.vocabTypeFilter === '名' ? 'selected' : ''}>Danh từ 【名】</option>
                            <option value="动" ${state.vocabTypeFilter === '动' ? 'selected' : ''}>Động từ 【动】</option>
                            <option value="形" ${state.vocabTypeFilter === '形' ? 'selected' : ''}>Tính từ 【形】</option>
                            <option value="副" ${state.vocabTypeFilter === '副' ? 'selected' : ''}>Phó từ 【副】</option>
                            <option value="连" ${state.vocabTypeFilter === '连' ? 'selected' : ''}>Liên từ 【连】</option>
                            <option value="专名" ${state.vocabTypeFilter === '专名' ? 'selected' : ''}>Tên riêng 【专名】</option>
                        </select>

                        <button class="rt-btn" id="btnQuickToGrammarFromVocab" title="Xem các điểm ngữ pháp bài này" >
                            📐 ${(lesson.grammar || []).length} Ngữ Pháp ➔
                        </button>
                    </div>

                    <div class="vab-count">
                        Hiển thị ${words.length} / ${lesson.words.length} từ
                    </div>
                </div>

                <div class="step-hint">
                    <span>🏮 Bước <b>Từ vựng</b> được tính là xong khi bạn lật hết thẻ của bài trong Flashcards.</span>
                    <button class="rt-btn audio-play-btn" id="btnGoFlashcards">Mở Flashcards ➔</button>
                </div>

                <div class="vocab-grid">
                    ${words.map((w, idx) => {
                        const isStarred = !!state.starredWords[w.id];
                        return `
                            <div class="vocab-card" id="card-${w.id}">
                                <div class="vc-left">
                                    <div class="vc-num">${idx + 1}</div>
                                    <div class="vc-main-word">
                                        <div class="vc-hz" data-hz="${escapeHtml(cleanHz(w.hz))}" title="Nhấp để nghe phát âm">
                                            ${escapeHtml(w.hz)}
                                            <span class="vc-speak-ico">🔊</span>
                                        </div>
                                        <div class="vc-py">${escapeHtml(w.py)}</div>
                                    </div>
                                    <div class="vc-details">
                                        <div class="vc-tag-row">
                                            ${w.type ? `<span class="vc-type-badge">${escapeHtml(w.type)}</span>` : ''}
                                            ${w.is_proper ? `<span class="vc-type-badge is-proper">Tên riêng</span>` : ''}
                                            ${P.srs[w.id] ? `<span class="vc-type-badge is-srs" title="Từ đã vào hàng ôn tập">🔁 ${P.srs[w.id].iv >= 21 ? 'Đã thuộc' : 'Đang ôn'}</span>` : ''}
                                        </div>
                                        <div class="vc-meaning">${escapeHtml(w.mean)}</div>
                                        ${w.examples && w.examples.length > 0 ? `
                                            <div class="vc-examples-list">
                                                ${w.examples.map(ex => `
                                                    <div class="vc-example-item">
                                                        <span class="vc-example-text">${escapeHtml(ex)}</span>
                                                        <button class="btn-icon-round btn-speak-ex" data-text="${escapeHtml(fillTilde(ex, w.hz))}" title="Nghe câu ví dụ">🔊</button>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                                <div class="vc-right">
                                    <button class="btn-icon-round btn-star-word ${isStarred ? 'is-starred' : ''}" data-wid="${w.id}" title="Lưu vào danh sách từ khó cần ôn">
                                        ★
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        // Bind Play All Vocab Audio
        const btnPlayAll = document.getElementById('btnPlayAllVocabAudio');
        if (btnPlayAll) {
            btnPlayAll.addEventListener('click', () => {
                const aud = btnPlayAll.getAttribute('data-audio');
                loadAudioTrack(aud, `${book.name} - Bài ${lesson.lesson_num} (Toàn bộ từ vựng)`, true);
            });
        }

        const btnGoFc = document.getElementById('btnGoFlashcards');
        if (btnGoFc) btnGoFc.addEventListener('click', () => switchMode('flashcard'));

        // Quick Jump to Grammar
        const btnQGrammar = document.getElementById('btnQuickToGrammarFromVocab');
        if (btnQGrammar) {
            btnQGrammar.addEventListener('click', () => switchMode('grammar'));
        }

        // Bind Vocab Search Input
        const inpSearch = document.getElementById('inputVocabSearch');
        if (inpSearch) {
            inpSearch.addEventListener('input', (e) => {
                state.vocabSearch = e.target.value;
                renderVocabStudio();
                const newInput = document.getElementById('inputVocabSearch');
                if (newInput) {
                    newInput.focus();
                    newInput.setSelectionRange(newInput.value.length, newInput.value.length);
                }
            });
        }

        // Bind Vocab Type Filter
        const selType = document.getElementById('selectVocabType');
        if (selType) {
            selType.addEventListener('change', (e) => {
                state.vocabTypeFilter = e.target.value;
                renderVocabStudio();
            });
        }

        // Speak Word TTS
        dom.modeContainer.querySelectorAll('.vc-hz').forEach(el => {
            el.addEventListener('click', () => {
                const hz = el.getAttribute('data-hz');
                speakChinese(hz);
            });
        });

        // Speak Example TTS
        dom.modeContainer.querySelectorAll('.btn-speak-ex').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-text');
                speakChinese(text);
            });
        });

        // Star Word Toggle
        dom.modeContainer.querySelectorAll('.btn-star-word').forEach(btn => {
            btn.addEventListener('click', () => {
                const wid = btn.getAttribute('data-wid');
                toggleStar(wid);
                btn.classList.toggle('is-starred', !!state.starredWords[wid]);
            });
        });
    }

    // ==========================================================================
    // 7b. MODE 2B: NGỮ PHÁP & ĐIỂM NGÔN NGỮ (GRAMMAR STUDIO)
    // ==========================================================================
    function renderGrammarStudio() {
        const lesson = getActiveLesson();
        const book = getActiveBook();
        const points = lesson.grammar || [];

        let filteredPoints = points;
        if (state.grammarSearch && state.grammarSearch.trim()) {
            const q = state.grammarSearch.toLowerCase().trim();
            filteredPoints = points.filter(p => {
                const matchPoint = (p.point || '').toLowerCase().includes(q);
                const matchPinyin = (p.pinyin || '').toLowerCase().includes(q);
                const matchStructure = (p.structure || '').toLowerCase().includes(q);
                const matchExp = (p.explanation || '').toLowerCase().includes(q);
                const matchEx = (p.examples || []).some(ex => 
                    (ex.zh || '').toLowerCase().includes(q) ||
                    (ex.pinyin || '').toLowerCase().includes(q) ||
                    (ex.vi || '').toLowerCase().includes(q)
                );
                return matchPoint || matchPinyin || matchStructure || matchExp || matchEx;
            });
        }

        let html = `
            <div class="grammar-studio">
                <div class="grammar-toolbar">
                    <div class="grammar-toolbar-left">
                        <div class="grammar-badge">
                            <span>📐</span>
                            <span>${points.length} Điểm Ngữ Pháp Trọng Tâm</span>
                        </div>
                    </div>
                    <div class="grammar-search-wrap">
                        <span class="grammar-search-icon">🔍</span>
                        <input type="text" class="grammar-search-input" id="grammarSearchInput"
                            placeholder="Tìm điểm ngữ pháp, cấu trúc, ví dụ..."
                            value="${escapeHtml(state.grammarSearch)}">
                    </div>
                    <div class="grammar-toolbar-right">
                        <button class="btn-grammar-action" id="btnQuickToVocabFromGrammar" title="Xem danh sách từ vựng bài này" >
                            <span>🏮</span>
                            <span>${lesson.total_vocab} Từ Vựng ➔</span>
                        </button>
                        <button class="btn-grammar-action" id="btnCopyAllGrammar" title="Sao chép toàn bộ ngữ pháp bài này">
                            <span>📋</span>
                            <span>Sao chép tóm tắt</span>
                        </button>
                    </div>
                </div>
        `;

        if (filteredPoints.length === 0) {
            html += `
                <div class="empty-state">
                    <p class="empty-title">
                        ${state.grammarSearch ? 'Không tìm thấy điểm ngữ pháp phù hợp với từ khóa.' : 'Chưa có dữ liệu ngữ pháp cho bài này.'}
                    </p>
                    ${state.grammarSearch ? `<button class="btn-grammar-action" id="btnClearGrammarSearch">Xóa bộ lọc tìm kiếm</button>` : ''}
                </div>
            </div>
            `;
            dom.modeContainer.innerHTML = html;
            attachGrammarEvents(lesson, points, filteredPoints);
            return;
        }

        html += `<div class="grammar-cards-grid">`;

        filteredPoints.forEach((item, idx) => {
            const originalIdx = points.indexOf(item) + 1;
            const purePointZh = (item.point || '').split('(')[0].trim();

            html += `
                <article class="grammar-card" id="grammar-card-${idx}">
                    <div class="grammar-card-header">
                        <div class="grammar-title-wrap">
                            <span class="grammar-index-badge">#${originalIdx}</span>
                            <h2 class="grammar-point-title">${escapeHtml(item.point)}</h2>
                            ${item.pinyin ? `<span class="grammar-pinyin-pill">${escapeHtml(item.pinyin)}</span>` : ''}
                        </div>
                        <div class="grammar-actions-wrap">
                            <button class="btn-grammar-icon btn-speak-grammar-point" data-text="${escapeHtml(purePointZh)}" title="Phát âm tiếng Hán">
                                🔊
                            </button>
                            <button class="btn-grammar-icon btn-copy-grammar-point" data-idx="${idx}" title="Sao chép nội dung điểm này">
                                📋
                            </button>
                        </div>
                    </div>

                    <div class="grammar-card-body">
                        ${item.structure ? `
                            <div class="grammar-formula-box">
                                <span class="grammar-formula-label">Cấu trúc / Mẫu câu</span>
                                <div class="grammar-formula-text">${escapeHtml(item.structure)}</div>
                            </div>
                        ` : ''}

                        <div class="grammar-explanation">
                            ${escapeHtml(item.explanation)}
                        </div>

                        ${item.examples && item.examples.length > 0 ? `
                            <div class="grammar-examples-section">
                                <div class="grammar-examples-header">
                                    <span class="grammar-examples-title">
                                        <span>💬</span>
                                        <span>Câu ví dụ thực tế & Ngữ cảnh áp dụng (${item.examples.length})</span>
                                    </span>
                                </div>
                                <div class="grammar-examples-list">
                                    ${item.examples.map((ex, exIdx) => `
                                        <div class="grammar-example-item">
                                            <div class="example-content">
                                                <div class="example-zh">${escapeHtml(ex.zh)}</div>
                                                ${ex.pinyin ? `<div class="example-pinyin">${escapeHtml(ex.pinyin)}</div>` : ''}
                                                <div class="example-vi">${escapeHtml(ex.vi)}</div>
                                            </div>
                                            <div class="example-actions">
                                                <button class="btn-example-speak" data-text="${escapeHtml(ex.zh)}" title="Phát âm câu này">🔊</button>
                                                <button class="btn-example-copy" data-text="${escapeHtml(ex.zh + '\n' + (ex.pinyin || '') + '\n' + ex.vi)}" title="Sao chép câu">📋</button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="seen-sentinel" data-kind="gr" data-idx="${originalIdx - 1}"></div>
                </article>
            `;
        });

        html += `</div></div>`;
        dom.modeContainer.innerHTML = html;
        attachGrammarEvents(lesson, points, filteredPoints);
    }

    function attachGrammarEvents(lesson, allPoints, filteredPoints) {
        // Bước Ngữ pháp: mỗi điểm được tính là đã xem khi cuộn tới cuối thẻ của nó
        observeSentinels(el => {
            const idx = parseInt(el.getAttribute('data-idx'), 10);
            const card = el.closest('.grammar-card');
            if (card) card.classList.add('is-seen');
            markSeen('gr', idx);
        });

        // Search Input
        const searchInput = document.getElementById('grammarSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.grammarSearch = e.target.value;
                renderGrammarStudio();
                const newInput = document.getElementById('grammarSearchInput');
                if (newInput) {
                    newInput.focus();
                    newInput.setSelectionRange(newInput.value.length, newInput.value.length);
                }
            });
        }

        // Clear Search Button
        const btnClear = document.getElementById('btnClearGrammarSearch');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                state.grammarSearch = '';
                renderGrammarStudio();
            });
        }

        // Quick Jump to Vocab from Grammar
        const btnQVocab = document.getElementById('btnQuickToVocabFromGrammar');
        if (btnQVocab) {
            btnQVocab.addEventListener('click', () => switchMode('vocab'));
        }

        // Copy All Grammar Summary
        const btnCopyAll = document.getElementById('btnCopyAllGrammar');
        if (btnCopyAll) {
            btnCopyAll.addEventListener('click', () => {
                const book = getActiveBook();
                let txt = `📚 NGỮ PHÁP: ${book.title || ''} - BÀI ${lesson.lesson_num}: ${lesson.title}\n`;
                txt += `========================================================\n\n`;

                allPoints.forEach((p, i) => {
                    txt += `${i + 1}. ${p.point} [${p.pinyin || ''}]\n`;
                    if (p.structure) txt += `   Cấu trúc: ${p.structure}\n`;
                    txt += `   Giải thích: ${p.explanation}\n`;
                    if (p.examples && p.examples.length > 0) {
                        txt += `   Ví dụ:\n`;
                        p.examples.forEach(ex => {
                            txt += `   - ${ex.zh} (${ex.pinyin || ''}): ${ex.vi}\n`;
                        });
                    }
                    txt += `\n`;
                });

                if (navigator.clipboard) {
                    navigator.clipboard.writeText(txt).then(() => {
                        showToast('✓ Đã sao chép toàn bộ tóm tắt ngữ pháp bài học!');
                    }).catch(() => {
                        showToast('Không thể truy cập bộ nhớ tạm.');
                    });
                }
            });
        }

        // Speak Point Name
        dom.modeContainer.querySelectorAll('.btn-speak-grammar-point').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-text');
                if (text) speakChinese(text);
            });
        });

        // Copy Single Point
        dom.modeContainer.querySelectorAll('.btn-copy-grammar-point').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                const item = (filteredPoints && filteredPoints[idx]) ? filteredPoints[idx] : allPoints[idx];
                if (!item) return;

                let txt = `${item.point} [${item.pinyin || ''}]\n`;
                if (item.structure) txt += `Cấu trúc: ${item.structure}\n`;
                txt += `Giải thích: ${item.explanation}\n`;
                if (item.examples && item.examples.length > 0) {
                    txt += `Ví dụ:\n`;
                    item.examples.forEach(ex => {
                        txt += `- ${ex.zh} (${ex.pinyin || ''}): ${ex.vi}\n`;
                    });
                }

                if (navigator.clipboard) {
                    navigator.clipboard.writeText(txt).then(() => {
                        showToast(`✓ Đã sao chép: ${item.point}`);
                    });
                }
            });
        });

        // Speak Example
        dom.modeContainer.querySelectorAll('.btn-example-speak').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-text');
                if (text) speakChinese(text);
            });
        });

        // Copy Example
        dom.modeContainer.querySelectorAll('.btn-example-copy').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-text');
                if (text && navigator.clipboard) {
                    navigator.clipboard.writeText(text).then(() => {
                        showToast('✓ Đã sao chép câu ví dụ!');
                    });
                }
            });
        });
    }

    // ==========================================================================
    // 8. MODE 3: FLASHCARDS 3D + CHẤM ĐIỂM SM-2
    // ==========================================================================
    function rateButtonsHtml(card) {
        const c = card || newCard();
        const defs = [[1, 'Quên', 'again'], [2, 'Khó', 'hard'], [3, 'Nhớ', 'good'], [4, 'Dễ', 'easy']];
        return defs.map(([r, label, cls]) => `
            <button class="srs-rate-btn rate-${cls}" data-rate="${r}" title="Phím ${r}">
                <span class="srs-rate-label">${label}</span>
                <span class="srs-rate-iv">${ivLabel(c, r)}</span>
            </button>`).join('');
    }

    function exampleFor(word) {
        const ex = (word.examples || [])[0];
        return ex ? fillTilde(ex, word.hz) : '';
    }

    function renderFlashcardStudio() {
        const lesson = getActiveLesson();
        const book = getActiveBook();
        let words = eligibleWords(lesson);
        if (state.fcScope === 'starred') words = words.filter(w => !!state.starredWords[w.id]);

        // Giữ thứ tự đã xáo khi vẽ lại cùng bộ thẻ
        const deckKey = lessonId(book, lesson) + ':' + state.fcScope + ':' + words.length;
        if (state.fcDeckKey !== deckKey) {
            state.fcDeck = words;
            state.fcDeckKey = deckKey;
        }

        const L = peekLesson(lessonId(book, lesson)) || { fc: {} };
        const all = eligibleWords(lesson);
        const seenN = all.filter(w => L.fc && L.fc[w.id]).length;

        if (state.fcDeck.length === 0) {
            dom.modeContainer.innerHTML = `
                <div class="flashcard-studio">
                    <div class="empty-state">
                        <p>Không có từ vựng nào trong danh sách thẻ!</p>
                        ${state.fcScope === 'starred' ? `<button class="rt-btn" id="btnFcShowAll" style="margin-top:12px;">Xem tất cả các từ</button>` : ''}
                    </div>
                </div>
            `;
            const btnShowAll = document.getElementById('btnFcShowAll');
            if (btnShowAll) btnShowAll.addEventListener('click', () => { state.fcScope = 'all'; renderFlashcardStudio(); });
            return;
        }

        if (state.fcIndex >= state.fcDeck.length) state.fcIndex = 0;
        const w = state.fcDeck[state.fcIndex];
        const isStarred = !!state.starredWords[w.id];
        const card = P.srs[w.id];
        const ex = exampleFor(w);

        dom.modeContainer.innerHTML = `
            <div class="flashcard-studio ${state.fcFlipped ? 'is-flipped' : ''}" id="fcStudio">
                <div class="fc-step-note ${seenN >= all.length ? 'is-done' : ''}">
                    ${seenN >= all.length
                        ? `✓ Đã lật hết ${all.length} thẻ của bài — bước Từ vựng hoàn thành.`
                        : `<span>Bước 1 · Từ vựng: lật hết thẻ của bài để hoàn thành bước này — <b>${seenN}/${all.length}</b> thẻ.</span>`}
                    <span class="fc-step-tip">Lật thẻ rồi tự chấm Quên / Khó / Nhớ / Dễ để lên lịch ôn.</span>
                </div>
                <div class="fc-meta-bar">
                    <div class="fc-counter-badge">
                        Thẻ ${state.fcIndex + 1} / ${state.fcDeck.length}${L.fc && L.fc[w.id] ? ' · đã lật' : ''}
                    </div>
                    <div class="fc-controls-top">
                        <button class="rt-btn ${state.fcScope === 'starred' ? 'active' : ''}" id="btnFcToggleScope">
                            ★ Chỉ từ đã lưu (${Object.keys(state.starredWords).length})
                        </button>
                        <button class="rt-btn" id="btnFcShuffle" title="Xáo trộn ngẫu nhiên">🔀 Xáo</button>
                    </div>
                </div>

                <div class="flashcard-stage ${state.fcFlipped ? 'flipped' : ''}" id="flashcardStage">
                    <div class="flashcard-inner">
                        <div class="fc-face fc-front">
                            <div class="fc-front-hz">${escapeHtml(w.hz)}</div>
                            ${state.pinyinVisible ? `<div class="fc-front-py">${escapeHtml(w.py)}</div>` : ''}
                            <div class="fc-hint-tag">💡 Chạm hoặc nhấn Space để lật</div>
                        </div>
                        <div class="fc-face fc-back">
                            <div class="fc-back-top">
                                <span class="vc-type-badge">${escapeHtml(w.type || 'Từ vựng')}</span>
                                <button class="btn-icon-round btn-star-fc ${isStarred ? 'is-starred' : ''}" id="btnStarFc" title="Lưu từ khó">★</button>
                            </div>
                            <div class="fc-back-word-row">
                                <div class="fc-back-hz">${escapeHtml(w.hz)}</div>
                                <div class="fc-back-py">${escapeHtml(w.py)}</div>
                            </div>
                            <div class="fc-back-meaning">${escapeHtml(cleanMean(w.mean))}</div>
                            ${ex ? `<div class="fc-back-examples">${escapeHtml(ex)}</div>` : ''}
                            <button class="rt-btn" id="btnSpeakFc" style="margin-top: 10px;">🔊 Phát âm</button>
                        </div>
                    </div>
                </div>

                <div class="srs-rate-row" id="fcRateRow">${rateButtonsHtml(card)}</div>

                <div class="fc-bottom-nav">
                    <button class="btn-fc-nav" id="btnFcPrev">← Trước</button>
                    <button class="btn-fc-nav btn-fc-flip" id="btnFcFlip">🔄 Lật Thẻ</button>
                    <button class="btn-fc-nav" id="btnFcNext">Tiếp →</button>
                </div>
            </div>
        `;

        const stage = document.getElementById('flashcardStage');
        const flip = () => {
            state.fcFlipped = !state.fcFlipped;
            stage.classList.toggle('flipped', state.fcFlipped);
            const st = document.getElementById('fcStudio');
            if (st) st.classList.toggle('is-flipped', state.fcFlipped);
            if (state.fcFlipped) {
                speakChinese(w.hz);
                markSeen('fc', 0, w.id);
                updateFcNote();
            }
        };
        state.fcFlip = flip;
        stage.addEventListener('click', (e) => {
            if (e.target.closest('#btnStarFc') || e.target.closest('#btnSpeakFc')) return;
            flip();
        });
        document.getElementById('btnFcFlip').addEventListener('click', flip);

        const go = (delta) => {
            state.fcIndex = (state.fcIndex + delta + state.fcDeck.length) % state.fcDeck.length;
            state.fcFlipped = false;
            renderFlashcardStudio();
        };
        state.fcGo = go;
        document.getElementById('btnFcNext').addEventListener('click', () => go(1));
        document.getElementById('btnFcPrev').addEventListener('click', () => go(-1));

        dom.modeContainer.querySelectorAll('#fcRateRow .srs-rate-btn').forEach(b => {
            b.addEventListener('click', () => fcRate(parseInt(b.getAttribute('data-rate'), 10)));
        });

        const btnStar = document.getElementById('btnStarFc');
        btnStar.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleStar(w.id);
            btnStar.classList.toggle('is-starred', !!state.starredWords[w.id]);
        });

        document.getElementById('btnSpeakFc').addEventListener('click', (e) => {
            e.stopPropagation();
            speakChinese(w.hz);
        });

        document.getElementById('btnFcShuffle').addEventListener('click', () => {
            state.fcDeck = shuffle(state.fcDeck.slice());
            state.fcIndex = 0;
            state.fcFlipped = false;
            renderFlashcardStudio();
        });

        document.getElementById('btnFcToggleScope').addEventListener('click', () => {
            state.fcScope = state.fcScope === 'all' ? 'starred' : 'all';
            state.fcIndex = 0;
            state.fcFlipped = false;
            renderFlashcardStudio();
        });
    }

    function updateFcNote() {
        const book = getActiveBook(), lesson = getActiveLesson();
        const L = peekLesson(lessonId(book, lesson)) || { fc: {} };
        const all = eligibleWords(lesson);
        const seenN = all.filter(w => L.fc[w.id]).length;
        const note = dom.modeContainer.querySelector('.fc-step-note b');
        if (note) note.textContent = `${seenN}/${all.length}`;
    }

    function fcRate(r) {
        const w = state.fcDeck[state.fcIndex];
        if (!w || !state.fcFlipped) return;
        markSeen('fc', 0, w.id);
        rateWord(w.id, r);
        showToast(r === 1 ? 'Sẽ hỏi lại sau 10 phút' : `Ôn lại sau ${P.srs[w.id].iv} ngày`);
        if (state.fcGo) state.fcGo(1);
    }

    function toggleStar(id) {
        if (state.starredWords[id]) delete state.starredWords[id];
        else state.starredWords[id] = true;
        try { localStorage.setItem(STORAGE_KEY_STARRED, JSON.stringify(state.starredWords)); } catch (e) {}
    }

    // ==========================================================================
    // 9. ENGINE TRẮC NGHIỆM DÙNG CHUNG (luyện tập + kiểm tra cuối bài)
    // ==========================================================================
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Câu ví dụ có "～" dùng làm câu điền từ; ưu tiên câu hoàn chỉnh
    function clozeSentence(word) {
        const parts = [];
        (word.examples || []).forEach(ex => String(ex).split(/\s*\/\s*/).forEach(p => {
            const s = p.replace(/[①-⑳]/g, '').trim();
            if (s.includes('～') && s.replace(/～/g, '').length >= 3) parts.push(s);
        }));
        if (!parts.length) return null;
        parts.sort((a, b) => (/[。！？]$/.test(b) ? 1 : 0) - (/[。！？]$/.test(a) ? 1 : 0) || b.length - a.length);
        return parts[0];
    }

    // Từ "yếu": hay quên, đến hạn, đã lưu sao, sai gần đây
    function weakScore(w) {
        const c = P.srs[w.id];
        let s = Math.random();
        if (c) { s += (c.lapses || 0) * 2; if (c.due <= Date.now()) s += 1.5; if (c.ef < 2.3) s += 1; }
        if (state.starredWords[w.id]) s += 1.5;
        return s;
    }

    // Chọn 3 đáp án nhiễu khác nhãn với đáp án đúng; thiếu thì lấy thêm từ cả quyển
    function pickDistractors(word, labelFn, pool, extraPool) {
        const right = labelFn(word);
        const seen = new Set([right]);
        const out = [];
        const take = (list) => {
            shuffle(list.slice()).forEach(w => {
                if (out.length >= 3) return;
                const lb = labelFn(w);
                if (!lb || seen.has(lb)) return;
                seen.add(lb); out.push(lb);
            });
        };
        take(pool);
        if (out.length < 3 && extraPool) take(extraPool);
        return out;
    }

    function bookWords(book) {
        const out = [];
        book.lessons.forEach(l => eligibleWords(l).forEach(w => out.push(w)));
        return out;
    }

    function makeOptions(right, wrongs) {
        const opts = shuffle([right, ...wrongs]);
        return { options: opts, answer: opts.indexOf(right) };
    }

    // type: 'meaning' (Hán → nghĩa, KHÔNG hiện pinyin) | 'reverse' (nghĩa → Hán) | 'cloze' | 'listen'
    function makeWordQuestion(w, type, pool, extra) {
        const hz = cleanHz(w.hz);
        const reveal = `<span class="qr-hz">${escapeHtml(hz)}</span> <span class="qr-py">${escapeHtml(w.py)}</span> — ${escapeHtml(cleanMean(w.mean))}`;
        const base = { wordId: w.id, speak: hz, reveal };
        if (type === 'meaning') {
            const o = makeOptions(cleanMean(w.mean), pickDistractors(w, x => cleanMean(x.mean), pool, extra));
            return Object.assign(base, { kind: 'meaning', prompt: 'Chọn nghĩa đúng của từ', main: `<div class="qq-word">${escapeHtml(hz)}</div>`, optCn: false }, o);
        }
        if (type === 'reverse') {
            const o = makeOptions(hz, pickDistractors(w, x => cleanHz(x.hz), pool, extra));
            return Object.assign(base, { kind: 'reverse', prompt: 'Chọn chữ Hán đúng với nghĩa', main: `<div class="qq-meaning">${escapeHtml(cleanMean(w.mean))}</div>`, optCn: true }, o);
        }
        if (type === 'cloze') {
            const s = clozeSentence(w);
            const o = makeOptions(hz, pickDistractors(w, x => cleanHz(x.hz), pool, extra));
            const sent = escapeHtml(s).replace(/～/g, '<span class="qq-blank">＿＿</span>');
            return Object.assign(base, { kind: 'cloze', prompt: 'Điền từ thích hợp vào chỗ trống', main: `<div class="qq-sentence">${sent}</div>`, optCn: true,
                reveal: reveal + `<div class="qr-sent">${escapeHtml(fillTilde(s, w.hz))}</div>`, speak: fillTilde(s, w.hz) }, o);
        }
        // listen
        const o = makeOptions(hz, pickDistractors(w, x => cleanHz(x.hz), pool, extra));
        return Object.assign(base, { kind: 'listen', prompt: 'Nghe và chọn từ đúng', main: `<button class="rt-btn audio-play-btn qq-listen" data-speak="${escapeHtml(hz)}">🔊 Nghe lại</button>`, optCn: true, autoSpeak: hz }, o);
    }

    // Câu hỏi ngữ pháp: đọc câu ví dụ, chọn bản dịch đúng
    function grammarQuestions(book, lesson, max) {
        const own = [];
        (lesson.grammar || []).forEach(g => (g.examples || []).forEach(ex => { if (ex.zh && ex.vi) own.push({ g, ex }); }));
        if (!own.length) return [];
        const pool = [];
        book.lessons.forEach(l => (l.grammar || []).forEach(g => (g.examples || []).forEach(ex => { if (ex.zh && ex.vi) pool.push(ex.vi); })));
        // mỗi điểm ngữ pháp tối đa 1 câu trước, rồi mới lấy thêm
        const byPoint = new Map();
        shuffle(own).forEach(it => { if (!byPoint.has(it.g)) byPoint.set(it.g, it); });
        let chosen = [...byPoint.values()];
        own.forEach(it => { if (chosen.length < max && !chosen.includes(it)) chosen.push(it); });
        chosen = chosen.slice(0, max);
        return chosen.map(({ g, ex }) => {
            const wrongs = [];
            const seen = new Set([ex.vi]);
            shuffle(pool.slice()).forEach(v => { if (wrongs.length < 3 && !seen.has(v)) { seen.add(v); wrongs.push(v); } });
            if (wrongs.length < 3) return null;
            const o = makeOptions(ex.vi, wrongs);
            return Object.assign({
                kind: 'grammar',
                prompt: `Ngữ pháp · ${escapeHtml(g.point || '')}: chọn nghĩa đúng của câu`,
                main: `<div class="qq-sentence">${escapeHtml(ex.zh)}</div>`,
                optCn: false,
                speak: ex.zh,
                reveal: `<span class="qr-py">${escapeHtml(ex.pinyin || '')}</span>${g.structure ? `<div class="qr-note">Cấu trúc: ${escapeHtml(g.structure)}</div>` : ''}`
            }, o);
        }).filter(Boolean);
    }

    // Bài kiểm tra cuối bài: mỗi từ đúng 1 lần, số câu cố định
    function buildLessonTest(book, lesson) {
        let words = eligibleWords(lesson);
        const nonProper = words.filter(w => !w.is_proper);
        if (nonProper.length >= 4) words = nonProper;
        const extra = bookWords(book);
        const chosen = shuffle(words.slice()).sort((a, b) => weakScore(b) - weakScore(a)).slice(0, TEST_VOCAB_MAX);
        const clozeMax = Math.ceil(chosen.length / 3);
        let nCloze = 0, k = 0;
        const qs = chosen.map(w => {
            let type;
            if (nCloze < clozeMax && clozeSentence(w)) { type = 'cloze'; nCloze++; }
            else type = (k++ % 2 === 0) ? 'meaning' : 'reverse';
            return makeWordQuestion(w, type, words, extra);
        });
        return shuffle(qs.concat(grammarQuestions(book, lesson, TEST_GRAMMAR_MAX)));
    }

    function buildPractice(book, lesson, listen) {
        let words = eligibleWords(lesson);
        const extra = bookWords(book);
        const chosen = words.slice().sort((a, b) => weakScore(b) - weakScore(a)).slice(0, PRACTICE_SIZE);
        const types = ['meaning', 'reverse', 'cloze'];
        let k = 0;
        return shuffle(chosen.map(w => {
            if (listen) return makeWordQuestion(w, 'listen', words, extra);
            let t = types[k++ % 3];
            if (t === 'cloze' && !clozeSentence(w)) t = 'meaning';
            return makeWordQuestion(w, t, words, extra);
        }));
    }

    // Chạy một lượt trắc nghiệm. Câu sai được hỏi lại ở cuối lượt (tối đa 2 lần).
    // Điểm tính theo lần trả lời đầu tiên.
    function runQuiz(container, questions, opts) {
        const run = {
            container, qs: questions, opts: opts || {},
            queue: questions.map((q, i) => i), pos: 0,
            first: {}, retries: {}, correct: 0, answered: false, token: 0
        };
        state.quiz = run;
        renderQuizQuestion(run);
        return run;
    }

    function renderQuizQuestion(run) {
        if (state.quiz !== run || !document.body.contains(run.container)) return;
        if (run.pos >= run.queue.length) { finishQuiz(run); return; }
        const qi = run.queue[run.pos];
        const q = run.qs[qi];
        const total = run.qs.length;
        const isRetry = run.first[qi] !== undefined;
        const doneFirst = Object.keys(run.first).length;
        run.answered = false;
        run.token++;

        run.container.innerHTML = `
            <div class="quiz-card">
                <div class="quiz-progress-row">
                    <span class="quiz-stat-pill">${run.opts.title || 'Luyện tập'} · Câu ${Math.min(doneFirst + (isRetry ? 0 : 1), total)}/${total}</span>
                    ${isRetry ? `<span class="quiz-stat-pill retry">↻ Làm lại câu sai</span>` : `<span class="quiz-stat-pill">Đúng: ${run.correct}</span>`}
                </div>
                <div class="quiz-progress-bar"><div style="width:${Math.round(doneFirst / total * 100)}%"></div></div>
                <div class="quiz-question-box">
                    <div class="qq-prompt">${q.prompt}</div>
                    ${q.main}
                </div>
                <div class="quiz-options-grid">
                    ${q.options.map((opt, i) => `
                        <button class="quiz-opt-btn ${q.optCn ? 'is-cn' : ''}" data-i="${i}">
                            <span class="opt-prefix">${i + 1}</span>
                            <span class="opt-label">${escapeHtml(opt)}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="quiz-feedback" id="quizFeedback" hidden></div>
            </div>
        `;
        run.container.querySelectorAll('.quiz-opt-btn').forEach(b => {
            b.addEventListener('click', () => answerQuiz(run, parseInt(b.getAttribute('data-i'), 10)));
        });
        const lb = run.container.querySelector('.qq-listen');
        if (lb) lb.addEventListener('click', () => speakChinese(lb.getAttribute('data-speak')));
        if (q.autoSpeak) speakChinese(q.autoSpeak);
    }

    function answerQuiz(run, i) {
        if (run.answered || state.quiz !== run) return;
        run.answered = true;
        const qi = run.queue[run.pos];
        const q = run.qs[qi];
        const ok = i === q.answer;
        const firstTime = run.first[qi] === undefined;
        if (firstTime) { run.first[qi] = ok; if (ok) run.correct++; }
        if (!ok) {
            run.retries[qi] = (run.retries[qi] || 0) + 1;
            if (run.retries[qi] <= 2) run.queue.push(qi);
        }
        addActivity('q');

        const btns = run.container.querySelectorAll('.quiz-opt-btn');
        btns.forEach((b, k) => {
            b.disabled = true;
            if (k === q.answer) b.classList.add('correct');
            else if (k === i) b.classList.add('wrong');
        });
        const fb = document.getElementById('quizFeedback');
        if (fb) {
            fb.hidden = false;
            fb.className = 'quiz-feedback ' + (ok ? 'is-ok' : 'is-bad');
            fb.innerHTML = `
                <div class="qf-text">
                    <div class="qf-title">${ok ? '✓ Chính xác!' : '✗ Chưa đúng' + (run.retries[qi] <= 2 ? ' — câu này sẽ được hỏi lại cuối lượt' : '')}</div>
                    <div class="qf-reveal">${q.reveal || ''}</div>
                </div>
                <button class="rt-btn audio-play-btn" id="btnQuizNext">Tiếp ➔ <kbd>Enter</kbd></button>
            `;
            document.getElementById('btnQuizNext').addEventListener('click', () => nextQuiz(run));
        }
        if (q.speak && q.kind !== 'grammar') speakChinese(q.speak);
        // Đúng thì tự sang câu sau
        if (ok) {
            const tk = run.token;
            setTimeout(() => { if (run.token === tk && run.answered) nextQuiz(run); }, 1300);
        }
    }

    function nextQuiz(run) {
        if (state.quiz !== run || !run.answered) return;
        run.pos++;
        renderQuizQuestion(run);
    }

    function finishQuiz(run) {
        const total = run.qs.length;
        const pct = total ? Math.round(run.correct / total * 100) : 0;
        const wrongIds = [];
        const wrongItems = [];
        run.qs.forEach((q, i) => {
            if (run.first[i] === false) {
                if (q.wordId) wrongIds.push(q.wordId);
                wrongItems.push(q);
            }
        });
        if (wrongIds.length) pushWordsSoon(wrongIds);
        const res = { total, correct: run.correct, pct, wrongIds };
        const extra = run.opts.onFinish ? run.opts.onFinish(res) : {};
        state.quiz = null;
        saveProgress();
        refreshGlobal();

        run.container.innerHTML = `
            <div class="quiz-card quiz-result ${extra.passed === false ? 'is-fail' : (extra.passed ? 'is-pass' : '')}">
                <div class="qres-score">${pct}%</div>
                <div class="qres-sub">Đúng ${run.correct}/${total} câu ngay lần đầu</div>
                ${extra.message ? `<div class="qres-msg">${extra.message}</div>` : ''}
                ${wrongItems.length ? `
                    <div class="qres-wrong">
                        <div class="qres-wrong-title">Câu sai (${wrongItems.length})${wrongIds.length ? ' — các từ này đã được đưa vào "Ôn hôm nay"' : ''}:</div>
                        ${wrongItems.map(q => `<div class="qres-wrong-item">${q.reveal}</div>`).join('')}
                    </div>` : ''}
                <div class="qres-actions">
                    ${(extra.actions || []).map((a, i) => `<button class="rt-btn ${a.primary ? 'audio-play-btn' : ''}" data-act="${i}">${a.label}</button>`).join('')}
                </div>
            </div>
        `;
        run.container.querySelectorAll('[data-act]').forEach(b => {
            b.addEventListener('click', () => extra.actions[parseInt(b.getAttribute('data-act'), 10)].fn());
        });
    }

    // ==========================================================================
    // 9b. MODE 4: LUYỆN TẬP (trắc nghiệm, nghe chọn từ, ghép cặp)
    // ==========================================================================
    function renderQuizStudio() {
        dom.modeContainer.innerHTML = `
            <div class="quiz-hub-studio">
                <div class="quiz-sub-modes-bar">
                    <button class="quiz-sub-mode-btn ${state.quizSubMode === 'mcq' ? 'active' : ''}" data-sub="mcq">🎯 Trắc nghiệm</button>
                    <button class="quiz-sub-mode-btn ${state.quizSubMode === 'listen' ? 'active' : ''}" data-sub="listen">🎧 Nghe chọn từ</button>
                    <button class="quiz-sub-mode-btn ${state.quizSubMode === 'match' ? 'active' : ''}" data-sub="match">🧩 Ghép cặp</button>
                </div>
                <div id="quizSubModeContainer"></div>
            </div>
        `;

        dom.modeContainer.querySelectorAll('.quiz-sub-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.quizSubMode = btn.getAttribute('data-sub');
                saveSettings();
                renderCurrentMode();
            });
        });

        const container = document.getElementById('quizSubModeContainer');
        if (state.quizSubMode === 'match') { initMatchGame(); return; }
        startPractice(container, state.quizSubMode === 'listen');
    }

    function startPractice(container, listen) {
        const book = getActiveBook(), lesson = getActiveLesson();
        if (eligibleWords(lesson).length < 4) {
            container.innerHTML = `<div class="empty-state">Bài này cần ít nhất 4 từ vựng để luyện tập.</div>`;
            return;
        }
        const qs = buildPractice(book, lesson, listen);
        runQuiz(container, qs, {
            title: listen ? 'Nghe chọn từ' : 'Luyện tập',
            onFinish: (res) => ({
                message: res.pct >= PASS_TEST ? '👏 Tốt lắm! Sẵn sàng làm bài kiểm tra cuối bài.' : 'Ôn lại các từ sai rồi làm thêm một lượt nhé.',
                actions: [
                    { label: '🔄 Lượt mới', primary: true, fn: () => startPractice(container, listen) },
                    { label: '🏁 Làm bài kiểm tra', fn: () => switchMode('test') }
                ]
            })
        });
    }

    function initMatchGame() {
        const container = document.getElementById('quizSubModeContainer');
        if (!container) return;
        const lesson = getActiveLesson();
        const all = eligibleWords(lesson);
        if (all.length < 4) {
            container.innerHTML = `<div class="empty-state">Cần ít nhất 4 từ vựng để chơi ghép cặp.</div>`;
            return;
        }
        // 3 từ yếu nhất + phần còn lại ngẫu nhiên, tối đa 6 cặp
        const sorted = all.slice().sort((a, b) => weakScore(b) - weakScore(a));
        const weak = sorted.slice(0, 3);
        const rest = shuffle(sorted.slice(3)).slice(0, 6 - weak.length);
        const words = weak.concat(rest);

        let cards = [];
        words.forEach(w => {
            cards.push({ id: w.id, type: 'hz', text: cleanHz(w.hz) });
            cards.push({ id: w.id, type: 'vn', text: cleanMean(w.mean) });
        });
        cards = shuffle(cards);

        state.matchCards = cards;
        state.matchSelected = null;
        state.matchPairsFound = 0;
        state.matchTimer = 0;
        state.matchMistakes = 0;
        clearInterval(state.matchTimerId);

        container.innerHTML = `
            <div class="quiz-card">
                <div class="quiz-progress-row">
                    <span class="quiz-stat-pill" id="matchPairsLabel">Đã ghép: 0 / ${words.length}</span>
                    <span class="quiz-stat-pill" id="matchTimerLabel">⏱️ 0s</span>
                    <button class="rt-btn" id="btnRestartMatch">🔄 Chơi lại</button>
                </div>
                <div class="match-game-grid" id="matchGrid">
                    ${cards.map((c, i) => `
                        <div class="match-tile ${c.type === 'hz' ? 'is-hanzi' : ''}" data-idx="${i}">${escapeHtml(c.text)}</div>
                    `).join('')}
                </div>
            </div>
        `;

        state.matchTimerId = setInterval(() => {
            const tLbl = document.getElementById('matchTimerLabel');
            if (!tLbl) { clearInterval(state.matchTimerId); return; } // đã rời tab
            state.matchTimer++;
            tLbl.textContent = `⏱️ ${state.matchTimer}s`;
        }, 1000);

        document.getElementById('btnRestartMatch').addEventListener('click', () => initMatchGame());

        container.querySelectorAll('.match-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                if (tile.classList.contains('matched') || tile.classList.contains('selected')) return;
                const idx = parseInt(tile.getAttribute('data-idx'), 10);
                const card = state.matchCards[idx];
                if (card.type === 'hz') speakChinese(card.text);

                if (!state.matchSelected) {
                    state.matchSelected = { idx, card, el: tile };
                    tile.classList.add('selected');
                    return;
                }
                const first = state.matchSelected;
                state.matchSelected = null;
                tile.classList.add('selected');
                if (first.card.id === card.id && first.card.type !== card.type) {
                    setTimeout(() => {
                        first.el.classList.add('matched');
                        tile.classList.add('matched');
                        first.el.classList.remove('selected');
                        tile.classList.remove('selected');
                        state.matchPairsFound++;
                        addActivity('q');
                        const pLbl = document.getElementById('matchPairsLabel');
                        if (pLbl) pLbl.textContent = `Đã ghép: ${state.matchPairsFound} / ${words.length}`;
                        if (state.matchPairsFound === words.length) {
                            clearInterval(state.matchTimerId);
                            showMatchResult(container, words);
                        }
                    }, 250);
                } else {
                    state.matchMistakes++;
                    first.el.classList.add('mismatch');
                    tile.classList.add('mismatch');
                    setTimeout(() => {
                        first.el.classList.remove('selected', 'mismatch');
                        tile.classList.remove('selected', 'mismatch');
                    }, 500);
                }
            });
        });
    }

    function showMatchResult(container, words) {
        container.innerHTML = `
            <div class="quiz-card quiz-result is-pass">
                <div class="qres-score">🎉 ${state.matchTimer}s</div>
                <div class="qres-sub">Ghép xong ${words.length} cặp · ${state.matchMistakes} lần ghép nhầm</div>
                <div class="qres-wrong">
                    ${words.map(w => `<div class="qres-wrong-item"><span class="qr-hz">${escapeHtml(cleanHz(w.hz))}</span> <span class="qr-py">${escapeHtml(w.py)}</span> — ${escapeHtml(cleanMean(w.mean))}</div>`).join('')}
                </div>
                <div class="qres-actions">
                    <button class="rt-btn audio-play-btn" id="btnMatchAgain">🔄 Chơi lượt mới</button>
                </div>
            </div>
        `;
        document.getElementById('btnMatchAgain').addEventListener('click', () => initMatchGame());
    }

    // ==========================================================================
    // 9c. MODE: KIỂM TRA CUỐI BÀI (≥ 80% mới hoàn thành bài)
    // ==========================================================================
    function renderTestStudio() {
        const book = getActiveBook(), lesson = getActiveLesson();
        const info = lessonSteps(book, lesson);
        const L = info.L;
        dom.modeContainer.innerHTML = `<div class="quiz-hub-studio" id="testWrap"></div>`;
        const wrap = document.getElementById('testWrap');

        if (eligibleWords(lesson).length < 4) {
            wrap.innerHTML = `<div class="empty-state">Bài này có quá ít từ vựng để tạo bài kiểm tra.</div>`;
            return;
        }
        if (state.testStarted) { startTest(wrap); return; }

        const preview = buildLessonTest(book, lesson);
        const nCloze = preview.filter(q => q.kind === 'cloze').length;
        const nGram = preview.filter(q => q.kind === 'grammar').length;
        const pending = info.steps.slice(0, 3).filter(s => !s.done);
        wrap.innerHTML = `
            <div class="quiz-card test-intro">
                <div class="ti-icon">🏁</div>
                <h2 class="ti-title">Bài kiểm tra cuối bài ${lesson.lesson_num}</h2>
                <p class="ti-desc">${preview.length} câu: ${preview.length - nCloze - nGram} câu từ vựng${nCloze ? `, ${nCloze} câu điền từ vào ví dụ` : ''}${nGram ? `, ${nGram} câu ngữ pháp` : ''}.
                    Mỗi từ chỉ hỏi một lần, câu sai được hỏi lại cuối lượt. Đạt <b>≥ ${PASS_TEST}%</b> (tính lần trả lời đầu) để hoàn thành bài.</p>
                <div class="ti-stats">
                    <span>Điểm cao nhất: <b>${L.best ? L.best + '%' : '—'}</b></span>
                    <span>Số lần làm: <b>${L.tries || 0}</b></span>
                    ${L.done ? `<span class="ti-done">✓ Đã hoàn thành${L.doneAt ? ' ' + fmtDate(L.doneAt) : ''}</span>` : ''}
                </div>
                ${pending.length ? `<div class="ti-warn">Gợi ý: nên làm xong ${pending.map(s => `<button class="ti-link" data-mode="${s.mode}">${s.label}</button>`).join(', ')} trước khi kiểm tra.</div>` : ''}
                <button class="rt-btn audio-play-btn ti-start" id="btnStartTest">Bắt đầu kiểm tra ➔</button>
            </div>
        `;
        wrap.querySelectorAll('.ti-link').forEach(b => b.addEventListener('click', () => switchMode(b.getAttribute('data-mode'))));
        document.getElementById('btnStartTest').addEventListener('click', () => {
            state.testStarted = true;
            startTest(wrap);
        });
    }

    function startTest(wrap) {
        const book = getActiveBook(), lesson = getActiveLesson();
        const lid = lessonId(book, lesson);
        runQuiz(wrap, buildLessonTest(book, lesson), {
            title: 'Kiểm tra',
            onFinish: (res) => {
                const L = lessonState(lid);
                L.tries = (L.tries || 0) + 1;
                const isBest = res.pct > (L.best || 0);
                L.best = Math.max(L.best || 0, res.pct);
                const passed = res.pct >= PASS_TEST;
                let justDone = false;
                if (passed && !L.done) {
                    L.done = true; L.doneAt = dayKey(); justDone = true;
                    addActivity('c');
                }
                if (passed && !L.doneAt) L.doneAt = dayKey();
                if (passed) enrollLessonWords(lesson);
                state.testStarted = false;
                saveProgress();
                renderSidebar();
                renderLessonPath();
                const nxt = lessonAfter(book, lesson);
                const actions = [];
                if (passed && nxt) actions.push({ label: `Bài tiếp: ${nxt.book !== book ? escapeHtml(nxt.book.name) + ' · ' : ''}Bài ${nxt.lesson.lesson_num} ➔`, primary: true, fn: () => goToLesson(nxt.book.id, nxt.lesson.lesson_num, 'flashcard') });
                actions.push({ label: '🔄 Làm lại', primary: !passed, fn: () => { state.testStarted = true; startTest(wrap); } });
                if (dueIds().length) actions.push({ label: `🔁 Ôn hôm nay (${dueIds().length})`, fn: () => switchMode('review') });
                return {
                    passed,
                    message: passed
                        ? (justDone ? `🎉 Hoàn thành bài ${lesson.lesson_num}! Từ vựng của bài đã được đưa vào hàng ôn tập.` : `✓ Đạt yêu cầu${isBest ? ' · điểm cao nhất mới!' : ''}`)
                        : `Cần đạt ≥ ${PASS_TEST}% để hoàn thành bài. Ôn lại từ sai rồi thử lại nhé!`,
                    actions
                };
            }
        });
    }

    // ==========================================================================
    // 9d. ÔN HÔM NAY: gom từ đến hạn của mọi bài, mọi quyển
    // ==========================================================================
    function renderReviewStudio() {
        if (!state.review) state.review = { queue: dueIds(), flipped: false, done: 0 };
        const rv = state.review;
        // bỏ thẻ không còn tồn tại; thẻ chấm "Quên" vẫn được hỏi lại trong phiên này
        while (rv.queue.length && (!P.srs[rv.queue[0]] || !WORDS.has(rv.queue[0]))) rv.queue.shift();

        const backBtn = `<button class="rt-btn" id="btnReviewBack">← Về bài đang học</button>`;
        if (!rv.queue.length) {
            const tomorrow = Object.keys(P.srs).filter(id => WORDS.has(id) && P.srs[id].due < startOfDay() + 2 * DAY).length;
            const total = Object.keys(P.srs).filter(id => WORDS.has(id)).length;
            dom.modeContainer.innerHTML = `
                <div class="review-studio">
                    <div class="quiz-card quiz-result is-pass">
                        <div class="qres-score">${rv.done ? '🎉' : '☕'}</div>
                        <div class="qres-sub">${rv.done ? `Đã ôn xong ${rv.done} thẻ hôm nay!` : 'Không có từ nào đến hạn ôn.'}</div>
                        <div class="qres-msg">Hàng ôn có ${total} từ · ngày mai đến hạn khoảng ${tomorrow} từ.
                            ${total ? '' : '<br>Từ của bài sẽ tự vào hàng ôn khi bạn hoàn thành bài kiểm tra cuối bài, hoặc khi chấm thẻ trong Flashcards.'}</div>
                        <div class="qres-actions">${backBtn}</div>
                    </div>
                </div>`;
            document.getElementById('btnReviewBack').addEventListener('click', () => switchMode(state.prevMode || 'reading'));
            return;
        }

        const id = rv.queue[0];
        const it = WORDS.get(id);
        const w = it.w;
        const ex = exampleFor(w);
        dom.modeContainer.innerHTML = `
            <div class="review-studio flashcard-studio ${rv.flipped ? 'is-flipped' : ''}" id="fcStudio">
                <div class="review-head">
                    <div>
                        <div class="review-title">🔁 Ôn hôm nay</div>
                        <div class="review-sub">Còn ${rv.queue.length} thẻ · đã ôn ${rv.done} · từ mọi bài, mọi quyển</div>
                    </div>
                    ${backBtn}
                </div>
                <div class="flashcard-stage ${rv.flipped ? 'flipped' : ''}" id="flashcardStage">
                    <div class="flashcard-inner">
                        <div class="fc-face fc-front">
                            <span class="review-src">${escapeHtml(it.book.name)} · Bài ${it.lesson.lesson_num}</span>
                            <div class="fc-front-hz">${escapeHtml(w.hz)}</div>
                            <div class="fc-hint-tag">💡 Nhớ lại nghĩa, rồi chạm hoặc nhấn Space để lật</div>
                        </div>
                        <div class="fc-face fc-back">
                            <div class="fc-back-top">
                                <span class="vc-type-badge">${escapeHtml(w.type || 'Từ vựng')}</span>
                                <span class="review-src">${escapeHtml(it.book.name)} · Bài ${it.lesson.lesson_num}</span>
                            </div>
                            <div class="fc-back-word-row">
                                <div class="fc-back-hz">${escapeHtml(w.hz)}</div>
                                <div class="fc-back-py">${escapeHtml(w.py)}</div>
                            </div>
                            <div class="fc-back-meaning">${escapeHtml(cleanMean(w.mean))}</div>
                            ${ex ? `<div class="fc-back-examples">${escapeHtml(ex)}</div>` : ''}
                            <button class="rt-btn" id="btnSpeakFc" style="margin-top: 10px;">🔊 Phát âm</button>
                        </div>
                    </div>
                </div>
                <div class="srs-rate-row" id="fcRateRow">${rateButtonsHtml(P.srs[id])}</div>
                <div class="fc-bottom-nav">
                    <button class="btn-fc-nav btn-fc-flip" id="btnFcFlip">🔄 Lật thẻ (Space)</button>
                </div>
            </div>
        `;
        const stage = document.getElementById('flashcardStage');
        const flip = () => {
            rv.flipped = !rv.flipped;
            stage.classList.toggle('flipped', rv.flipped);
            document.getElementById('fcStudio').classList.toggle('is-flipped', rv.flipped);
            if (rv.flipped) speakChinese(w.hz);
        };
        state.fcFlip = flip;
        stage.addEventListener('click', (e) => { if (!e.target.closest('#btnSpeakFc')) flip(); });
        document.getElementById('btnFcFlip').addEventListener('click', flip);
        document.getElementById('btnSpeakFc').addEventListener('click', (e) => { e.stopPropagation(); speakChinese(w.hz); });
        document.getElementById('btnReviewBack').addEventListener('click', () => switchMode(state.prevMode || 'reading'));
        dom.modeContainer.querySelectorAll('#fcRateRow .srs-rate-btn').forEach(b => {
            b.addEventListener('click', () => reviewRate(parseInt(b.getAttribute('data-rate'), 10)));
        });
    }

    function reviewRate(r) {
        const rv = state.review;
        if (!rv || !rv.flipped || !rv.queue.length) return;
        const id = rv.queue.shift();
        rateWord(id, r);
        rv.done++;
        if (r === 1) rv.queue.push(id); // Quên: hỏi lại cuối phiên
        rv.flipped = false;
        renderReviewStudio();
    }

    // ==========================================================================
    // 9e. THỐNG KÊ THEO NGÀY
    // ==========================================================================
    function openStatsModal() {
        if (!dom.statsModal || !dom.statsBody) return;
        const days = [];
        for (let i = 13; i >= 0; i--) {
            const k = dayKey(new Date(startOfDay() - i * DAY + DAY / 2));
            const d = P.days[k] || {};
            days.push({ k, q: d.q || 0, r: d.r || 0, c: d.c || 0, rd: d.rd || 0 });
        }
        const max = Math.max(STREAK_MIN, ...days.map(d => d.q + d.r));
        const t = P.days[dayKey()] || {};
        const totalDone = window.BOYA_DATA.books.reduce((s, b) => s + b.lessons.filter(l => isLessonDone(b, l)).length, 0);
        const inSrs = Object.keys(P.srs).filter(id => WORDS.has(id));
        const mature = inSrs.filter(id => P.srs[id].iv >= 21).length;
        const todayUnits = (t.q || 0) + (t.r || 0);
        dom.statsBody.innerHTML = `
            <div class="stats-grid">
                <div class="stats-tile"><div class="st-num">🔥 ${currentStreak()}</div><div class="st-lbl">ngày liên tiếp (kỷ lục ${P.streak.best || 0})</div></div>
                <div class="stats-tile"><div class="st-num">${todayUnits}</div><div class="st-lbl">câu + thẻ hôm nay${todayUnits < STREAK_MIN ? ` (cần ${STREAK_MIN} để giữ streak)` : ' ✓'}</div></div>
                <div class="stats-tile"><div class="st-num">${totalDone}/74</div><div class="st-lbl">bài đã hoàn thành</div></div>
                <div class="stats-tile"><div class="st-num">${inSrs.length}</div><div class="st-lbl">từ trong hàng ôn · ${mature} từ đã thuộc lâu</div></div>
            </div>
            <div class="stats-chart-title">14 ngày gần nhất (câu trả lời + thẻ ôn)</div>
            <div class="stats-chart">
                ${days.map(d => {
                    const v = d.q + d.r;
                    const h = Math.round(v / max * 100);
                    return `<div class="sc-col" title="${fmtDate(d.k)}: ${d.q} câu, ${d.r} thẻ ôn${d.c ? `, ${d.c} bài xong` : ''}${d.rd ? `, ${d.rd} lần đọc tính giờ` : ''}">
                        <div class="sc-val">${v || ''}</div>
                        <div class="sc-bar ${v >= STREAK_MIN ? 'is-ok' : ''}" style="height:${Math.max(h, v ? 4 : 0)}%"></div>
                        <div class="sc-day">${d.k.slice(8)}</div>
                    </div>`;
                }).join('')}
            </div>
            <div class="stats-note">Streak chỉ tăng khi trong ngày bạn làm ít nhất ${STREAK_MIN} câu luyện tập/kiểm tra hoặc ôn ${STREAK_MIN} thẻ.</div>
        `;
        dom.statsModal.classList.add('open');
    }
    function closeStatsModal() { if (dom.statsModal) dom.statsModal.classList.remove('open'); }

    // ==========================================================================
    // 11. MODE 6: PODCAST / CHẠY NỀN RẢNH TAY
    // ==========================================================================
    function renderPodcastStudio() {
        const words = getActiveLesson().words || [];
        if (state.podcastIndex >= words.length) state.podcastIndex = 0;
        const w = words[state.podcastIndex];

        dom.modeContainer.innerHTML = `
            <div class="quiz-card podcast-card">
                <h2 class="podcast-title">🎧 Chế Độ Học Thụ Động (Hands-free Podcast)</h2>
                <p class="podcast-desc">
                    Hệ thống tự đọc lần lượt từng từ: Chữ Hán ➔ Nghĩa tiếng Việt ➔ Câu ví dụ (nếu có), pinyin hiện trên màn hình.
                    Phù hợp để nghe rảnh tay khi làm việc hoặc thư giãn.
                </p>
                <div class="podcast-hz" id="podWordHz">${w ? escapeHtml(w.hz) : 'Bắt đầu'}</div>
                <div class="podcast-py" id="podWordPy">${w ? escapeHtml(w.py) : ''}</div>
                <div class="podcast-mean" id="podWordMean">${w ? escapeHtml(cleanMean(w.mean)) : ''}</div>
                <div class="podcast-ex" id="podWordEx">${w ? escapeHtml(exampleFor(w)) : ''}</div>
                <div class="podcast-actions">
                    <button class="rt-btn audio-play-btn" id="btnTogglePodcastRun">
                        ${state.podcastRunning ? '⏸ Tạm dừng' : '▶️ Bắt đầu Nghe'}
                    </button>
                    <button class="rt-btn" id="btnPodcastNext">Bỏ qua từ này ➔</button>
                </div>
                <div class="podcast-progress" id="podProgress">${words.length ? `Từ ${state.podcastIndex + 1}/${words.length}` : ''}</div>
            </div>
        `;

        const btnRun = document.getElementById('btnTogglePodcastRun');
        btnRun.addEventListener('click', () => {
            if (state.podcastRunning) {
                stopPodcast();
                btnRun.innerHTML = '▶️ Bắt đầu Nghe';
            } else {
                startPodcast();
                btnRun.innerHTML = '⏸ Tạm dừng';
            }
        });

        document.getElementById('btnPodcastNext').addEventListener('click', () => {
            const ws = getActiveLesson().words || [];
            if (!ws.length) return;
            state.podcastIndex = (state.podcastIndex + 1) % ws.length;
            updatePodcastUI();
            if (state.podcastRunning) { clearTimeout(state.podcastTimer); playPodcastStep(); }
        });
    }

    function startPodcast() {
        state.podcastRunning = true;
        playPodcastStep();
    }

    function stopPodcast() {
        state.podcastRunning = false;
        clearTimeout(state.podcastTimer);
        if (window.speechSynthesis) window.speechSynthesis.cancel();
    }

    function playPodcastStep() {
        if (!state.podcastRunning) return;
        const words = getActiveLesson().words || [];
        if (words.length === 0) return;
        if (state.podcastIndex >= words.length) state.podcastIndex = 0; // bài mới có thể ít từ hơn

        const word = words[state.podcastIndex];
        const ex = (word.examples || [])[0];
        updatePodcastUI();
        const next = () => {
            if (!state.podcastRunning) return;
            state.podcastTimer = setTimeout(() => {
                state.podcastIndex = (state.podcastIndex + 1) % words.length;
                playPodcastStep();
            }, 1200);
        };

        // 1. Chữ Hán → 2. Nghĩa tiếng Việt → 3. Câu ví dụ (nếu có)
        speakChinese(word.hz, () => {
            if (!state.podcastRunning) return;
            state.podcastTimer = setTimeout(() => {
                speakVietnamese(cleanMean(word.mean), () => {
                    if (!state.podcastRunning) return;
                    if (!ex) { next(); return; }
                    state.podcastTimer = setTimeout(() => {
                        speakChinese(fillTilde(ex, word.hz), next);
                    }, 700);
                });
            }, 800);
        });
    }

    function updatePodcastUI() {
        const words = getActiveLesson().words || [];
        const word = words[state.podcastIndex];
        if (!word) return;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('podWordHz', word.hz);
        set('podWordPy', word.py);
        set('podWordMean', cleanMean(word.mean));
        set('podWordEx', exampleFor(word));
        set('podProgress', `Từ ${state.podcastIndex + 1}/${words.length}`);
    }

    // ==========================================================================
    // 12. TEXT-TO-SPEECH (TTS) ENGINES
    // ==========================================================================
    // Thay "～" trong câu ví dụ bằng chính từ đó, bỏ số thứ tự ①②…
    function fillTilde(text, hz) {
        return String(text || '').replace(/[①-⑳]\s*/g, '').replace(/[～~]/g, cleanHz(hz)).trim();
    }
    // Làm sạch chuỗi trước khi đọc: bỏ ～, ①…, *, chú thích 【】, đổi "/" thành ngắt câu
    function ttsClean(text) {
        return String(text || '')
            .replace(/[①-⑳]/g, '')
            .replace(/[～~*＊]/g, '')
            .replace(/【[^】]*】/g, '')
            .replace(/\s*\/\s*/g, '，')
            .replace(/^[，\s]+|[，\s]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function speakChinese(text, onEndCallback, rate) {
        if (!window.speechSynthesis) { if (onEndCallback) setTimeout(onEndCallback, 600); return; }
        window.speechSynthesis.cancel();
        const clean = ttsClean(text);
        if (!clean) { if (onEndCallback) setTimeout(onEndCallback, 300); return; }

        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = 'zh-CN';
        utterance.rate = rate || 0.9;

        const voices = window.speechSynthesis.getVoices();
        const zhVoice = voices.find(v => v.lang.startsWith('zh'));
        if (zhVoice) utterance.voice = zhVoice;

        if (onEndCallback) utterance.onend = onEndCallback;
        window.speechSynthesis.speak(utterance);
    }

    function speakVietnamese(text, onEndCallback) {
        if (!window.speechSynthesis) { if (onEndCallback) setTimeout(onEndCallback, 600); return; }
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(String(text || '').replace(/[\/*]/g, ' '));
        utterance.lang = 'vi-VN';
        utterance.rate = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find(v => v.lang.startsWith('vi'));
        if (viVoice) utterance.voice = viVoice;

        if (onEndCallback) utterance.onend = onEndCallback;
        window.speechSynthesis.speak(utterance);
    }

    // ==========================================================================
    // 13. STICKY GLOBAL AUDIO PLAYER
    // ==========================================================================
    function initAudioDock() {
        if (!dom.audioPlayer) return;

        // Play / Pause Toggle
        if (dom.btnPlayPause) {
            dom.btnPlayPause.addEventListener('click', () => {
                if (dom.audioPlayer.paused) {
                    dom.audioPlayer.play();
                } else {
                    dom.audioPlayer.pause();
                }
            });
        }

        // Audio state listeners
        dom.audioPlayer.addEventListener('play', () => {
            if (dom.btnPlayPause) dom.btnPlayPause.innerHTML = '⏸';
        });

        dom.audioPlayer.addEventListener('pause', () => {
            if (dom.btnPlayPause) dom.btnPlayPause.innerHTML = '▶';
        });

        dom.audioPlayer.addEventListener('timeupdate', () => {
            if (!dom.audioPlayer.duration) return;
            const cur = dom.audioPlayer.currentTime;
            const dur = dom.audioPlayer.duration;
            if (dom.audioScrubber) dom.audioScrubber.value = (cur / dur) * 100;
            if (dom.timeCurrent) dom.timeCurrent.textContent = formatTime(cur);
            if (dom.timeTotal) dom.timeTotal.textContent = formatTime(dur);
        });

        // Scrubber input
        if (dom.audioScrubber) {
            dom.audioScrubber.addEventListener('input', (e) => {
                if (!dom.audioPlayer.duration) return;
                const pct = e.target.value / 100;
                dom.audioPlayer.currentTime = pct * dom.audioPlayer.duration;
            });
        }

        // Skip buttons
        const btnRewind = document.getElementById('btnAudioRewind');
        if (btnRewind) {
            btnRewind.addEventListener('click', () => {
                dom.audioPlayer.currentTime = Math.max(0, dom.audioPlayer.currentTime - 10);
            });
        }

        const btnForward = document.getElementById('btnAudioForward');
        if (btnForward) {
            btnForward.addEventListener('click', () => {
                dom.audioPlayer.currentTime = Math.min(dom.audioPlayer.duration || 0, dom.audioPlayer.currentTime + 10);
            });
        }

        // Playback Speed Toggle
        const speeds = [1.0, 1.25, 1.5, 0.75];
        let speedIdx = 0;
        if (dom.btnSpeedToggle) {
            dom.btnSpeedToggle.addEventListener('click', () => {
                speedIdx = (speedIdx + 1) % speeds.length;
                const spd = speeds[speedIdx];
                dom.audioPlayer.playbackRate = spd;
                dom.btnSpeedToggle.textContent = `${spd}x`;
            });
        }

        // Collapse / Expand Audio Dock Toggle & Floating Pill Mode
        const btnToggleDock = document.getElementById('btnToggleAudioDock');
        const btnPillToggle = document.getElementById('btnPillModeToggle');
        const audioDock = document.querySelector('.boya-audio-dock');

        if (audioDock) {
            // Restore saved pill mode (default: true for Floating Pill Player)
            const savedPillMode = localStorage.getItem('boya_audio_pill_mode');
            const isPill = savedPillMode === null ? true : savedPillMode === 'true';
            if (isPill) {
                audioDock.classList.add('mode-pill');
                document.documentElement.style.setProperty('--player-height', '0px');
                if (btnPillToggle) {
                    btnPillToggle.title = 'Chuyển về Thanh đáy (Bottom Dock)';
                    btnPillToggle.style.opacity = '1';
                }
            } else {
                audioDock.classList.remove('mode-pill');
                if (btnPillToggle) {
                    btnPillToggle.title = 'Chuyển sang Viên thuốc nổi (Floating Pill)';
                    btnPillToggle.style.opacity = '0.7';
                }
            }

            // Restore saved collapsed state
            const savedCollapsed = localStorage.getItem('boya_audio_dock_collapsed') === 'true';
            if (savedCollapsed) {
                audioDock.classList.add('is-collapsed');
                if (btnToggleDock) {
                    btnToggleDock.textContent = '▴';
                    btnToggleDock.title = 'Mở rộng trình phát nhạc';
                }
                if (!isPill) {
                    document.documentElement.style.setProperty('--player-height', '38px');
                }
            }

            if (btnToggleDock) {
                btnToggleDock.addEventListener('click', () => {
                    const isCollapsed = audioDock.classList.toggle('is-collapsed');
                    btnToggleDock.textContent = isCollapsed ? '▴' : '▾';
                    btnToggleDock.title = isCollapsed ? 'Mở rộng trình phát nhạc' : 'Thu gọn trình phát nhạc';
                    if (!audioDock.classList.contains('mode-pill')) {
                        document.documentElement.style.setProperty('--player-height', isCollapsed ? '38px' : '72px');
                    }
                    localStorage.setItem('boya_audio_dock_collapsed', isCollapsed ? 'true' : 'false');
                });
            }

            if (btnPillToggle) {
                btnPillToggle.addEventListener('click', () => {
                    const nowPill = audioDock.classList.toggle('mode-pill');
                    if (nowPill) {
                        document.documentElement.style.setProperty('--player-height', '0px');
                        btnPillToggle.title = 'Chuyển về Thanh đáy (Bottom Dock)';
                        btnPillToggle.style.opacity = '1';
                    } else {
                        const isCol = audioDock.classList.contains('is-collapsed');
                        document.documentElement.style.setProperty('--player-height', isCol ? '38px' : '72px');
                        btnPillToggle.title = 'Chuyển sang Viên thuốc nổi (Floating Pill)';
                        btnPillToggle.style.opacity = '0.7';
                    }
                    localStorage.setItem('boya_audio_pill_mode', nowPill ? 'true' : 'false');
                });
            }
        }
    }

    function loadAudioTrack(url, title, autoPlay = true) {
        if (!dom.audioPlayer) return;
        // dữ liệu lưu đường dẫn tính từ thư mục gốc ("audio/..."), trang nằm trong thư mục con
        if (!/^(https?:|\.\.\/|\/|blob:|data:)/.test(url)) url = "../" + url;
        dom.audioPlayer.src = encodeURI(url);
        if (dom.dockTrackTitle) dom.dockTrackTitle.textContent = title;
        if (dom.dockTrackSub) dom.dockTrackSub.textContent = getActiveBook().name;

        if (autoPlay) {
            dom.audioPlayer.play().catch(e => console.log("Audio autoplay prevented:", e));
        }
    }

    function formatTime(secs) {
        if (isNaN(secs)) return "00:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // ==========================================================================
    // 14. GLOBAL EVENT BINDINGS & SEARCH MODAL
    // ==========================================================================
    function bindGlobalEvents() {
        // Theo dõi cuộn để tính "đã đọc/xem tới cuối" (bắt sự kiện cuộn của mọi vùng)
        document.addEventListener('scroll', onAnyScroll, true);
        window.addEventListener('resize', onAnyScroll);

        // Ôn hôm nay & thống kê
        const reviewBtn = document.getElementById('hdrReviewBtn');
        if (reviewBtn) reviewBtn.addEventListener('click', () => switchMode('review'));
        const streakBtn = document.getElementById('hdrStreakBtn');
        if (streakBtn) streakBtn.addEventListener('click', openStatsModal);
        if (dom.statsModal) {
            dom.statsModal.addEventListener('click', (e) => {
                if (e.target === dom.statsModal || e.target.closest('[data-close-stats]')) closeStatsModal();
            });
        }

        // Tiến độ đổi ở tab khác → đọc lại
        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY_PROGRESS && e.newValue) {
                try { P = Object.assign(DEFAULT_PROGRESS(), JSON.parse(e.newValue)); } catch (err) { return; }
                renderSidebar(); renderLessonPath(); refreshGlobal();
            }
        });

        // Sticky Tab Pinyin Toggle
        const stickyPinyin = document.getElementById('stickyTogglePinyin');
        if (stickyPinyin) {
            stickyPinyin.addEventListener('click', togglePinyin);
        }

        // Mode Navigation Tabs
        if (dom.modeTabs) {
            dom.modeTabs.forEach(btn => {
                btn.addEventListener('click', () => {
                    const mode = btn.getAttribute('data-mode');
                    switchMode(mode);
                });
            });
        }

        // Sidebar Search
        if (dom.sidebarSearch) {
            dom.sidebarSearch.addEventListener('input', (e) => {
                state.sidebarSearch = e.target.value;
                renderSidebar();
            });
        }

        // Sidebar Filter Pills
        document.querySelectorAll('.sf-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.sf-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                state.sidebarFilter = pill.getAttribute('data-filter');
                renderSidebar();
            });
        });

        // Theme Toggle: dùng bảng màu chung (shared/theme.js)
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => { if (window.HocTheme) HocTheme.toggle(); });
        }

        // Sidebar Desktop & Mobile Toggles
        const hdrSidebarToggle = document.getElementById('hdrSidebarToggleBtn');
        if (hdrSidebarToggle) {
            hdrSidebarToggle.addEventListener('click', toggleSidebar);
        }
        const sidebarToggle = document.getElementById('sidebarToggleBtn');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', toggleSidebar);
        }
        const sidebarClose = document.getElementById('sidebarCloseBtn');
        if (sidebarClose) {
            sidebarClose.addEventListener('click', () => {
                if (isMobileView()) {
                    closeSidebar();
                } else {
                    toggleSidebar();
                }
            });
        }
        if (dom.sidebarBackdrop) {
            dom.sidebarBackdrop.addEventListener('click', closeSidebar);
        }

        // Responsive resize listener
        window.addEventListener('resize', () => {
            if (isMobileView()) {
                if (dom.boyaSidebar) dom.boyaSidebar.classList.remove('collapsed');
            } else {
                initSidebarState();
            }
        });

        // Search Modal Triggers
        const searchBtn = document.getElementById('globalSearchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', openSearchModal);
        }

        if (dom.searchModal) {
            dom.searchModal.addEventListener('click', (e) => {
                if (e.target === dom.searchModal) closeSearchModal();
            });
        }

        if (dom.modalSearchInput) {
            dom.modalSearchInput.addEventListener('input', (e) => {
                handleGlobalSearch(e.target.value);
            });
        }

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + K for search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                openSearchModal();
            }
            // Cmd/Ctrl + B for sidebar toggle
            if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
                e.preventDefault();
                toggleSidebar();
            }
            // Escape closes modals
            if (e.key === 'Escape') {
                closeSearchModal();
                closeStatsModal();
                closeSidebar();
            }
            if (handleStudyKeys(e)) return;
            // Pinyin Shortcut: 'p'
            if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    togglePinyin();
                }
            }
            // Translation Shortcut: 't'
            if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    toggleTranslation();
                }
            }
        });
    }

    // Phím tắt khi học: Space lật thẻ, 1–4 chấm thẻ / chọn đáp án, Enter câu tiếp, ←/→ đổi thẻ
    function handleStudyKeys(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return false;
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
        if (dom.searchModal && dom.searchModal.classList.contains('open')) return false;
        const m = state.activeMode;
        const n = parseInt(e.key, 10);
        if (m === 'flashcard' || m === 'review') {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
                if (state.fcFlip) state.fcFlip();
                return true;
            }
            if (n >= 1 && n <= 4) {
                if (m === 'flashcard') fcRate(n); else reviewRate(n);
                return true;
            }
            if (m === 'flashcard' && state.fcGo && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                state.fcGo(e.key === 'ArrowRight' ? 1 : -1);
                return true;
            }
        }
        if ((m === 'quiz' || m === 'test') && state.quiz) {
            const run = state.quiz;
            if (n >= 1 && n <= 4 && !run.answered) { answerQuiz(run, n - 1); return true; }
            if (e.key === 'Enter' && run.answered) {
                e.preventDefault();
                nextQuiz(run);
                return true;
            }
        }
        return false;
    }

    function isMobileView() {
        return window.innerWidth <= 1024;
    }

    function initSidebarState() {
        if (!isMobileView()) {
            const savedCollapsed = localStorage.getItem(STORAGE_KEY_SIDEBAR) === 'true';
            if (savedCollapsed && dom.boyaSidebar) {
                dom.boyaSidebar.classList.add('collapsed');
                updateSidebarToggleButtons(true);
            }
        }
    }

    function toggleSidebar() {
        if (!dom.boyaSidebar) return;
        if (isMobileView()) {
            const isOpen = dom.boyaSidebar.classList.toggle('open');
            if (dom.sidebarBackdrop) dom.sidebarBackdrop.classList.toggle('active', isOpen);
        } else {
            const isCollapsed = dom.boyaSidebar.classList.toggle('collapsed');
            try {
                localStorage.setItem(STORAGE_KEY_SIDEBAR, isCollapsed ? 'true' : 'false');
            } catch (e) {}
            updateSidebarToggleButtons(isCollapsed);
            showToast(isCollapsed ? "◀ Đã thu gọn danh mục bài học" : "▶ Đã mở danh mục bài học");
        }
    }

    function closeSidebar() {
        if (!dom.boyaSidebar) return;
        if (isMobileView()) {
            dom.boyaSidebar.classList.remove('open');
            if (dom.sidebarBackdrop) dom.sidebarBackdrop.classList.remove('active');
        }
    }

    function updateSidebarToggleButtons(isCollapsed) {
        const hdrBtn = document.getElementById('hdrSidebarToggleBtn');
        const mainBtn = document.getElementById('sidebarToggleBtn');
        const title = isCollapsed ? 'Mở danh mục bài học (Ctrl + B)' : 'Thu gọn danh mục bài học (Ctrl + B)';
        if (hdrBtn) {
            hdrBtn.classList.toggle('sidebar-collapsed', isCollapsed);
            hdrBtn.title = title;
        }
        if (mainBtn) {
            mainBtn.classList.toggle('sidebar-collapsed', isCollapsed);
            mainBtn.title = title;
        }
    }

    function openSearchModal() {
        if (!dom.searchModal) return;
        dom.searchModal.classList.add('open');
        if (dom.modalSearchInput) {
            dom.modalSearchInput.value = '';
            dom.modalSearchInput.focus();
        }
        handleGlobalSearch('');
    }

    function closeSearchModal() {
        if (!dom.searchModal) return;
        dom.searchModal.classList.remove('open');
    }

    function handleGlobalSearch(query) {
        if (!dom.modalResultsList) return;
        const q = query.trim().toLowerCase();

        if (!q) {
            const totV = window.BOYA_DATA?.total_vocab || 2770;
            const totL = window.BOYA_DATA?.total_lessons || 74;
            dom.modalResultsList.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
                    Nhập chữ Hán, Pinyin, nghĩa tiếng Việt hoặc số bài để tìm kiếm trong ${totL} bài học & ${totV} từ vựng.
                </div>
            `;
            return;
        }

        let results = [];

        // Search in all books & lessons
        window.BOYA_DATA.books.forEach(b => {
            b.lessons.forEach(l => {
                // Check lesson title
                if (l.title.toLowerCase().includes(q)) {
                    results.push({
                        type: 'lesson',
                        bookId: b.id,
                        bookName: b.name,
                        lessonNum: l.lesson_num,
                        title: l.title
                    });
                }
                // Check words
                l.words.forEach(w => {
                    if (w.hz.toLowerCase().includes(q) || w.py.toLowerCase().includes(q) || w.mean.toLowerCase().includes(q)) {
                        results.push({
                            type: 'word',
                            bookId: b.id,
                            bookName: b.title || b.name,
                            lessonNum: l.lesson_num,
                            word: w
                        });
                    }
                });

                // Check grammar points
                if (l.grammar && l.grammar.length > 0) {
                    l.grammar.forEach(g => {
                        const pt = (g.point || '').toLowerCase();
                        const py = (g.pinyin || '').toLowerCase();
                        const st = (g.structure || '').toLowerCase();
                        const ex = (g.explanation || '').toLowerCase();
                        if (pt.includes(q) || py.includes(q) || st.includes(q) || ex.includes(q)) {
                            results.push({
                                type: 'grammar',
                                bookId: b.id,
                                bookName: b.title || b.name,
                                lessonNum: l.lesson_num,
                                grammar: g
                            });
                        }
                    });
                }
            });
        });

        if (results.length === 0) {
            dom.modalResultsList.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
                    Không tìm thấy kết quả nào phù hợp với "<b>${escapeHtml(query)}</b>".
                </div>
            `;
            return;
        }

        // Limit to 40 results
        const displayed = results.slice(0, 40);

        dom.modalResultsList.innerHTML = displayed.map(r => {
            if (r.type === 'lesson') {
                return `
                    <div class="modal-result-item" data-book="${r.bookId}" data-lesson="${r.lessonNum}" data-mode="reading">
                        <div class="mri-left">
                            <span style="font-size: 18px;">📖</span>
                            <div>
                                <div style="font-weight: 700; color: var(--text-main); font-size: 14px;">Bài ${r.lessonNum}: ${r.title}</div>
                                <div style="font-size: 11px; color: var(--text-muted);">${r.bookName}</div>
                            </div>
                        </div>
                        <span class="mri-tag">Bài học</span>
                    </div>
                `;
            } else if (r.type === 'grammar') {
                return `
                    <div class="modal-result-item" data-book="${r.bookId}" data-lesson="${r.lessonNum}" data-mode="grammar">
                        <div class="mri-left">
                            <span style="font-size: 18px;">📐</span>
                            <div>
                                <div style="font-weight: 700; color: var(--text-main); font-size: 14px;">${escapeHtml(r.grammar.point)}</div>
                                <div style="font-size: 11px; color: var(--primary-text);">${escapeHtml(r.grammar.structure || r.grammar.pinyin || '')}</div>
                            </div>
                        </div>
                        <span class="mri-tag is-grammar">Ngữ pháp • Bài ${r.lessonNum}</span>
                    </div>
                `;
            } else {
                return `
                    <div class="modal-result-item" data-book="${r.bookId}" data-lesson="${r.lessonNum}" data-mode="vocab">
                        <div class="mri-left">
                            <div class="mri-hz">${escapeHtml(r.word.hz)}</div>
                            <div>
                                <div class="mri-py">${escapeHtml(r.word.py)}</div>
                                <div class="mri-mean">${escapeHtml(r.word.mean)}</div>
                            </div>
                        </div>
                        <span class="mri-tag">${r.bookName} • Bài ${r.lessonNum}</span>
                    </div>
                `;
            }
        }).join('');

        // Jump to selected result
        dom.modalResultsList.querySelectorAll('.modal-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const bId = item.getAttribute('data-book');
                const lNum = parseInt(item.getAttribute('data-lesson'), 10);
                const mode = item.getAttribute('data-mode');
                closeSearchModal();
                goToLesson(bId, lNum, mode);
            });
        });
    }

    // ==========================================================================
    // 16. HELPER & UTILITY FUNCTIONS
    // ==========================================================================
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showToast(message) {
        let toast = document.getElementById('boyaGlobalToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'boyaGlobalToast';
            toast.className = 'boya-toast';
            toast.setAttribute('role', 'status');
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), 2400);
    }

})();
