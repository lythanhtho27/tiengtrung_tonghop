/**
 * BOYA LEARNING PLATFORM - BOYA_LEARNING.JS
 * Quản trị toàn bộ logic tương tác học tập Boya (6 Quyển · 74 Bài · 2.674+ Từ · Audio · Flashcard · Quiz · PDF)
 */

(function () {
    'use strict';

    // ==========================================================================
    // 1. STORAGE KEYS & INITIAL STATE
    // ==========================================================================
    const STORAGE_KEY_PROGRESS = 'boya_learning_progress_v1';
    const STORAGE_KEY_STARRED  = 'boya_learning_starred_words_v1';
    const STORAGE_KEY_THEME    = 'boya_learning_dark_mode_v1';
    const STORAGE_KEY_SETTINGS = 'boya_learning_settings_v1';

    let state = {
        activeBookId: 'tc1',
        activeLessonNum: 1,
        activeMode: 'reading',      // 'reading' | 'vocab' | 'grammar' | 'flashcard' | 'quiz' | 'pdf' | 'podcast'
        activeReadingIdx: 0,
        
        // Reading Options
        pinyinVisible: true,
        transVisible: true,
        clozeMode: false,
        fontStyle: 'kaiti',        // 'kaiti' | 'heiti' | 'songti'
        fontSize: 22,

        // Filters
        sidebarFilter: 'all',      // 'all' | 'todo' | 'done' | 'star'
        sidebarSearch: '',
        vocabSearch: '',
        vocabTypeFilter: 'all',
        grammarSearch: '',

        // Flashcards
        fcIndex: 0,
        fcFlipped: false,
        fcScope: 'all',            // 'all' | 'starred'
        fcDeck: [],
        fcAutoplayTimer: null,

        // Quiz
        quizSubMode: 'mcq',        // 'mcq' | 'match' | 'listen'
        quizStreak: 0,
        quizScore: 0,
        quizTotal: 0,
        quizCurrentQ: null,
        quizAnswered: false,

        // Matching Game
        matchCards: [],
        matchSelected: null,
        matchPairsFound: 0,
        matchTimer: 0,
        matchTimerId: null,

        // Hands-free Podcast
        podcastRunning: false,
        podcastIndex: 0,
        podcastStep: 'word',       // 'word' | 'meaning' | 'example'
        podcastTimer: null,
        podcastSpeed: 1.0,

        // User Data
        completedLessons: {},      // { "tc1_bai1": true }
        starredWords: {},          // { "tc1_1_1": true }
        streak: 1,
        lastDate: ''
    };

    // DOM Elements Cache
    let dom = {};

    // ==========================================================================
    // 2. INITIALIZATION
    // ==========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        loadPersistedData();
        cacheDOMElements();
        applyTheme();
        bindGlobalEvents();

        // Check data availability
        if (!window.BOYA_DATA || !window.BOYA_DATA.books) {
            console.error("BOYA_DATA not found. Please ensure boya_data.js is loaded.");
            return;
        }

        renderBookSelector();
        switchBook(state.activeBookId, state.activeLessonNum, false);
        initAudioDock();
    });

    function loadPersistedData() {
        try {
            const prog = localStorage.getItem(STORAGE_KEY_PROGRESS);
            if (prog) state.completedLessons = JSON.parse(prog);

            const star = localStorage.getItem(STORAGE_KEY_STARRED);
            if (star) state.starredWords = JSON.parse(star);

            const sett = localStorage.getItem(STORAGE_KEY_SETTINGS);
            if (sett) {
                const parsed = JSON.parse(sett);
                if (parsed.activeBookId) state.activeBookId = parsed.activeBookId;
                if (parsed.fontSize) state.fontSize = parsed.fontSize;
                if (parsed.fontStyle) state.fontStyle = parsed.fontStyle;
                if (parsed.pinyinVisible !== undefined) state.pinyinVisible = parsed.pinyinVisible;
                if (parsed.transVisible !== undefined) state.transVisible = parsed.transVisible;
            }

            // Streak check
            const today = new Date().toISOString().slice(0, 10);
            const last = localStorage.getItem('boya_last_study_date');
            let streak = parseInt(localStorage.getItem('boya_streak_count') || '1', 10);
            if (last) {
                const diffDays = Math.round((new Date(today) - new Date(last)) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    streak++;
                } else if (diffDays > 1) {
                    streak = 1;
                }
            }
            state.streak = streak;
            state.lastDate = today;
            localStorage.setItem('boya_streak_count', streak.toString());
            localStorage.setItem('boya_last_study_date', today);
        } catch (e) {
            console.warn("Storage load error:", e);
        }
    }

    function saveSettings() {
        try {
            const sett = {
                activeBookId: state.activeBookId,
                fontSize: state.fontSize,
                fontStyle: state.fontStyle,
                pinyinVisible: state.pinyinVisible,
                transVisible: state.transVisible
            };
            localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(sett));
        } catch (e) {}
    }

    function cacheDOMElements() {
        dom.bookPillsNav    = document.getElementById('bookPillsNav');
        dom.sidebarLessonList = document.getElementById('sidebarLessonList');
        dom.sidebarSearch   = document.getElementById('sidebarSearch');
        dom.sidebarProgressFill = document.getElementById('sidebarProgressFill');
        dom.sidebarProgressLabel = document.getElementById('sidebarProgressLabel');
        dom.sidebarBookBadge = document.getElementById('sidebarBookBadge');
        dom.boyaSidebar     = document.getElementById('boyaSidebar');
        dom.sidebarBackdrop = document.getElementById('sidebarBackdrop');

        dom.lessonMainTitle = document.getElementById('lessonMainTitle');
        dom.lessonMetaBadge = document.getElementById('lessonMetaBadge');
        dom.lessonSubtitle  = document.getElementById('lessonSubtitle');
        dom.btnMarkComplete = document.getElementById('btnMarkComplete');

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
        dom.hdrStreakCount  = document.getElementById('hdrStreakCount');
    }

    function applyTheme() {
        const isDark = localStorage.getItem(STORAGE_KEY_THEME) === 'true';
        if (isDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        if (dom.hdrStreakCount) dom.hdrStreakCount.textContent = state.streak;
    }

    // ==========================================================================
    // 3. BOOK & LESSON SWITCHING
    // ==========================================================================
    function getActiveBook() {
        return window.BOYA_DATA.books.find(b => b.id === state.activeBookId) || window.BOYA_DATA.books[0];
    }

    function getActiveLesson() {
        const book = getActiveBook();
        return book.lessons.find(l => l.lesson_num === state.activeLessonNum) || book.lessons[0];
    }

    function renderBookSelector() {
        if (!dom.bookPillsNav) return;
        dom.bookPillsNav.innerHTML = window.BOYA_DATA.books.map(b => `
            <button class="book-pill-btn ${b.id === state.activeBookId ? 'active' : ''}" data-book="${b.id}">
                <span>${b.icon}</span>
                <span>${b.name}</span>
            </button>
        `).join('');

        dom.bookPillsNav.querySelectorAll('.book-pill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const bookId = btn.getAttribute('data-book');
                switchBook(bookId, 1, true);
            });
        });
    }

    function switchBook(bookId, lessonNum = 1, scrollToTop = true) {
        state.activeBookId = bookId;
        state.activeLessonNum = lessonNum;
        state.activeReadingIdx = 0;
        saveSettings();

        // Apply Book Color Theme Variable
        const book = getActiveBook();
        document.documentElement.style.setProperty('--primary', book.color);
        document.documentElement.style.setProperty('--primary-hover', book.color_dark);

        // Update Nav Pills Active state
        if (dom.bookPillsNav) {
            dom.bookPillsNav.querySelectorAll('.book-pill-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-book') === bookId);
            });
        }

        renderSidebar();
        renderLessonHeader();
        renderCurrentMode();

        if (scrollToTop) {
            if (dom.modeContainer) dom.modeContainer.scrollTop = 0;
            const panel = document.querySelector('.boya-main-panel');
            if (panel) panel.scrollTop = 0;
        }

        // Close mobile drawer if open
        closeSidebar();
    }

    function switchLesson(lessonNum) {
        state.activeLessonNum = lessonNum;
        state.activeReadingIdx = 0;
        renderSidebar();
        renderLessonHeader();
        renderCurrentMode();
        closeSidebar();

        if (dom.modeContainer) {
            dom.modeContainer.scrollTop = 0;
        }
        const panel = document.querySelector('.boya-main-panel');
        if (panel) panel.scrollTop = 0;

        // Autoplay audio for lesson reading if in reading mode
        const lesson = getActiveLesson();
        if (lesson && lesson.audio_baikhoa && state.activeMode === 'reading') {
            loadAudioTrack(lesson.audio_baikhoa, `${getActiveBook().name} • Bài ${lesson.lesson_num} (Bài Khóa)`, false);
        }
    }

    // ==========================================================================
    // 4. SIDEBAR RENDERING & FILTERING
    // ==========================================================================
    function renderSidebar() {
        const book = getActiveBook();
        if (dom.sidebarBookBadge) dom.sidebarBookBadge.textContent = `${book.name} (${book.chinese_name})`;

        // Calculate progress
        let doneCount = 0;
        book.lessons.forEach(l => {
            if (state.completedLessons[`${book.id}_bai${l.lesson_num}`]) doneCount++;
        });
        const pct = Math.round((doneCount / book.lessons.length) * 100);
        if (dom.sidebarProgressFill) dom.sidebarProgressFill.style.width = `${pct}%`;
        if (dom.sidebarProgressLabel) dom.sidebarProgressLabel.textContent = `${doneCount}/${book.lessons.length} Bài (${pct}%)`;

        // Filter lessons
        let filtered = book.lessons.filter(l => {
            const isDone = !!state.completedLessons[`${book.id}_bai${l.lesson_num}`];
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
            const isDone = !!state.completedLessons[`${book.id}_bai${l.lesson_num}`];
            return `
                <div class="lesson-card-item ${isCurrent ? 'active' : ''} ${isDone ? 'completed' : ''}" data-lesson="${l.lesson_num}">
                    <div class="lci-left">
                        <div class="lci-num-badge">${l.lesson_num}</div>
                        <div class="lci-info">
                            <div class="lci-title">${l.title}</div>
                            <div class="lci-sub">
                                <span>${l.total_vocab} từ</span>
                                <span>•</span>
                                <span>${(l.grammar || []).length} ngữ pháp</span>
                                <span>•</span>
                                <span>${l.readings.length} bài đọc</span>
                            </div>
                        </div>
                    </div>
                    <div class="lci-right">
                        <span class="lci-status-icon">${isDone ? '✓' : '○'}</span>
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
                <span>${book.icon} ${book.name}</span>
                <span>•</span>
                <span>BÀI ${lesson.lesson_num} / ${book.total_lessons}</span>
            `;
        }

        if (dom.lessonMainTitle) dom.lessonMainTitle.textContent = lesson.title;
        if (dom.lessonSubtitle) {
            dom.lessonSubtitle.innerHTML = `
                <span>📝 ${lesson.total_vocab} Từ vựng</span>
                <span>📐 ${(lesson.grammar || []).length} Điểm ngữ pháp</span>
                <span>🎧 ${lesson.readings.length} Phần bài đọc</span>
                <span>📖 Sách: ${book.chinese_name}</span>
            `;
        }

        // Complete Button state
        const lessonKey = `${book.id}_bai${lesson.lesson_num}`;
        const isDone = !!state.completedLessons[lessonKey];
        if (dom.btnMarkComplete) {
            dom.btnMarkComplete.classList.toggle('is-done', isDone);
            dom.btnMarkComplete.innerHTML = isDone 
                ? '✓ <span class="complete-btn-text">Đã hoàn thành</span>' 
                : '○ <span class="complete-btn-text">Đánh dấu hoàn thành</span>';
        }

        // Update Tab Badges dynamically
        if (dom.tabBadgeVocab) {
            dom.tabBadgeVocab.textContent = lesson.total_vocab || (lesson.words ? lesson.words.length : 0);
        }
        if (dom.tabBadgeGrammar) {
            dom.tabBadgeGrammar.textContent = (lesson.grammar || []).length;
        }
    }

    // ==========================================================================
    // 5. STUDY MODES ROUTING & RENDERING
    // ==========================================================================
    function switchMode(newMode) {
        state.activeMode = newMode;
        if (dom.modeTabs) {
            dom.modeTabs.forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-mode') === newMode);
            });
        }
        renderCurrentMode();
        if (dom.modeContainer) {
            dom.modeContainer.scrollTop = 0;
        }
        const panel = document.querySelector('.boya-main-panel');
        if (panel) panel.scrollTop = 0;
    }

    function renderCurrentMode() {
        if (!dom.modeContainer) return;

        // Stop podcast if switching away
        if (state.activeMode !== 'podcast' && state.podcastRunning) {
            stopPodcast();
        }

        switch (state.activeMode) {
            case 'reading':
                renderReadingStudio();
                break;
            case 'vocab':
                renderVocabStudio();
                break;
            case 'grammar':
                renderGrammarStudio();
                break;
            case 'flashcard':
                renderFlashcardStudio();
                break;
            case 'quiz':
                renderQuizStudio();
                break;
            case 'pdf':
                renderPdfStudio();
                break;
            case 'podcast':
                renderPodcastStudio();
                break;
            default:
                renderReadingStudio();
        }
    }

    // ==========================================================================
    // 6. MODE 1: BÀI KHÓA (READING STUDIO)
    // ==========================================================================
    function renderReadingStudio() {
        const lesson = getActiveLesson();
        const book = getActiveBook();

        if (!lesson.readings || lesson.readings.length === 0) {
            dom.modeContainer.innerHTML = `<div class="empty-state">Không có nội dung bài đọc cho bài này.</div>`;
            return;
        }

        const reading = lesson.readings[state.activeReadingIdx] || lesson.readings[0];

        // Process Chinese text for font, pinyin, cloze
        let processedHtml = reading.chinese_html || '';

        // If cloze mode is enabled, wrap random hanzi words in cloze spans
        if (state.clozeMode) {
            processedHtml = applyClozeFilter(processedHtml);
        }

        const subBarHtml = lesson.readings.length > 1 ? `
            <div class="sub-readings-bar">
                ${lesson.readings.map((r, idx) => `
                    <button class="sub-reading-btn ${idx === state.activeReadingIdx ? 'active' : ''}" data-idx="${idx}">
                        ${r.title}
                    </button>
                `).join('')}
            </div>
        ` : '';

        dom.modeContainer.innerHTML = `
            <div class="reading-studio">
                ${subBarHtml}

                <div class="reading-toolbar">
                    <div class="rt-group">
                        ${reading.audio ? `
                            <button class="rt-btn audio-play-btn" id="btnPlayReadingAudio" data-audio="${reading.audio}" data-title="${book.name} - Bài ${lesson.lesson_num} (${reading.title})">
                                🔊 Nghe Bài Này
                            </button>
                        ` : ''}
                        <button class="rt-btn ${state.pinyinVisible ? 'active' : ''}" id="btnTogglePinyin">
                            👁️ Pinyin: ${state.pinyinVisible ? 'Bật' : 'Tắt'}
                        </button>
                        <button class="rt-btn ${state.transVisible ? 'active' : ''}" id="btnToggleTrans">
                            🇻🇳 Bản Dịch: ${state.transVisible ? 'Hiện' : 'Ẩn'}
                        </button>
                        <button class="rt-btn ${state.clozeMode ? 'active' : ''}" id="btnToggleCloze" title="Ẩn bớt từ để tự luyện trí nhớ">
                            🌫️ Ẩn Từ: ${state.clozeMode ? 'Bật' : 'Tắt'}
                        </button>
                        <button class="rt-btn" id="btnQuickToVocab" title="Xem danh sách từ vựng bài này" style="color:var(--primary); font-weight:700;">
                            🏮 ${lesson.total_vocab} Từ Vựng ➔
                        </button>
                        <button class="rt-btn" id="btnQuickToGrammar" title="Xem các điểm ngữ pháp bài này" style="color:var(--primary); font-weight:700;">
                            📐 ${(lesson.grammar || []).length} Ngữ Pháp ➔
                        </button>
                    </div>

                    <div class="rt-group">
                        <select class="rt-btn" id="selectFontFamily">
                            <option value="kaiti" ${state.fontStyle === 'kaiti' ? 'selected' : ''}>Khải Thư (Chuẩn)</option>
                            <option value="heiti" ${state.fontStyle === 'heiti' ? 'selected' : ''}>Hán Thể Không Chân</option>
                            <option value="songti" ${state.fontStyle === 'songti' ? 'selected' : ''}>Tống Thể</option>
                        </select>

                        <div class="zoom-controls">
                            <button class="zoom-btn" id="btnZoomOut">A-</button>
                            <span class="zoom-label">${state.fontSize}px</span>
                            <button class="zoom-btn" id="btnZoomIn">A+</button>
                        </div>
                    </div>
                </div>

                <div class="reading-card">
                    <div class="reading-title-area">
                        <h2 class="reading-passage-title">${reading.title}</h2>
                    </div>

                    <div class="chinese-text-content ${state.pinyinVisible ? '' : 'hide-pinyin'} font-${state.fontStyle}" 
                         id="chineseTextContent" 
                         style="--reading-font-size: ${state.fontSize}px;">
                        ${processedHtml}
                    </div>
                </div>

                <div class="translation-section" id="translationSection" style="display: ${state.transVisible ? 'block' : 'none'};">
                    <div class="translation-header">
                        <span class="th-title">🇻🇳 Bản Dịch Tham Khảo</span>
                        <span style="font-size: 12px; color: var(--text-muted);">${reading.translations.length} Đoạn dịch</span>
                    </div>
                    <div class="translation-body">
                        ${reading.translations.map((t, i) => `
                            <div class="translation-line">${t}</div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Bind Sub-reading buttons
        dom.modeContainer.querySelectorAll('.sub-reading-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.activeReadingIdx = parseInt(btn.getAttribute('data-idx'), 10);
                renderReadingStudio();
            });
        });

        // Quick Jump Shortcuts from Reading to Vocab / Grammar
        const btnQVocab = document.getElementById('btnQuickToVocab');
        if (btnQVocab) btnQVocab.addEventListener('click', () => switchMode('vocab'));
        const btnQGrammar = document.getElementById('btnQuickToGrammar');
        if (btnQGrammar) btnQGrammar.addEventListener('click', () => switchMode('grammar'));

        // Bind Audio Play Button
        const btnPlay = document.getElementById('btnPlayReadingAudio');
        if (btnPlay) {
            btnPlay.addEventListener('click', () => {
                const aud = btnPlay.getAttribute('data-audio');
                const tit = btnPlay.getAttribute('data-title');
                loadAudioTrack(aud, tit, true);
            });
        }

        // Bind Pinyin Toggle
        const btnPinyin = document.getElementById('btnTogglePinyin');
        if (btnPinyin) {
            btnPinyin.addEventListener('click', () => {
                state.pinyinVisible = !state.pinyinVisible;
                saveSettings();
                renderReadingStudio();
            });
        }

        // Bind Translation Toggle
        const btnTrans = document.getElementById('btnToggleTrans');
        if (btnTrans) {
            btnTrans.addEventListener('click', () => {
                state.transVisible = !state.transVisible;
                saveSettings();
                const sec = document.getElementById('translationSection');
                if (sec) sec.style.display = state.transVisible ? 'block' : 'none';
                btnTrans.classList.toggle('active', state.transVisible);
                btnTrans.textContent = `🇻🇳 Bản Dịch: ${state.transVisible ? 'Hiện' : 'Ẩn'}`;
            });
        }

        // Bind Cloze Mode Toggle
        const btnCloze = document.getElementById('btnToggleCloze');
        if (btnCloze) {
            btnCloze.addEventListener('click', () => {
                state.clozeMode = !state.clozeMode;
                renderReadingStudio();
            });
        }

        // Bind Cloze click reveal
        dom.modeContainer.querySelectorAll('.cloze-hidden-word').forEach(cw => {
            cw.addEventListener('click', () => {
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
                    content.className = `chinese-text-content ${state.pinyinVisible ? '' : 'hide-pinyin'} font-${state.fontStyle}`;
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

        // Double click on Hanzi word to speak TTS
        dom.modeContainer.querySelectorAll('#chineseTextContent ruby').forEach(rb => {
            rb.addEventListener('click', () => {
                const text = rb.innerText.replace(/[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, '').trim();
                if (text) speakChinese(text);
            });
        });
    }

    function applyClozeFilter(html) {
        // Wrap every 4th ruby or block with a cloze test box
        let count = 0;
        return html.replace(/<ruby>([\s\S]*?)<\/ruby>/g, (match) => {
            count++;
            if (count % 4 === 0) {
                return `<span class="cloze-hidden-word">${match}</span>`;
            }
            return match;
        });
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
                            <input type="text" id="inputVocabSearch" placeholder="Lọc từ (Hán, Pinyin, Nghĩa)..." value="${state.vocabSearch}">
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

                        <button class="rt-btn" id="btnQuickToGrammarFromVocab" title="Xem các điểm ngữ pháp bài này" style="color:var(--primary); font-weight:700;">
                            📐 ${(lesson.grammar || []).length} Ngữ Pháp ➔
                        </button>
                    </div>

                    <div style="font-size: 13px; color: var(--text-muted); font-weight: 600;">
                        Hiển thị ${words.length} / ${lesson.words.length} từ
                    </div>
                </div>

                <div class="vocab-grid">
                    ${words.map((w, idx) => {
                        const isStarred = !!state.starredWords[w.id];
                        return `
                            <div class="vocab-card" id="card-${w.id}">
                                <div class="vc-left">
                                    <div class="vc-num">${idx + 1}</div>
                                    <div class="vc-main-word">
                                        <div class="vc-hz" data-hz="${w.hz}" title="Nhấp để nghe phát âm">
                                            ${w.hz}
                                            <span style="font-size: 14px; color: var(--text-light);">🔊</span>
                                        </div>
                                        <div class="vc-py">${w.py}</div>
                                    </div>
                                    <div class="vc-details">
                                        <div class="vc-tag-row">
                                            ${w.type ? `<span class="vc-type-badge">${w.type}</span>` : ''}
                                            ${w.is_proper ? `<span class="vc-type-badge" style="background:#fef3c7; color:#b45309;">Tên riêng</span>` : ''}
                                        </div>
                                        <div class="vc-meaning">${w.mean}</div>
                                        ${w.examples && w.examples.length > 0 ? `
                                            <div class="vc-examples-list">
                                                ${w.examples.map(ex => `
                                                    <div class="vc-example-item">
                                                        <span class="vc-example-text">${ex}</span>
                                                        <button class="btn-icon-round btn-speak-ex" data-text="${ex}" title="Nghe câu ví dụ">🔊</button>
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
                if (state.starredWords[wid]) {
                    delete state.starredWords[wid];
                    btn.classList.remove('is-starred');
                } else {
                    state.starredWords[wid] = true;
                    btn.classList.add('is-starred');
                }
                localStorage.setItem(STORAGE_KEY_STARRED, JSON.stringify(state.starredWords));
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
                        <button class="btn-grammar-action" id="btnQuickToVocabFromGrammar" title="Xem danh sách từ vựng bài này" style="color:var(--primary); font-weight:700;">
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
                    <p style="font-size:16px; font-weight:600; color:var(--text-muted); margin-bottom:8px;">
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
                </article>
            `;
        });

        html += `</div></div>`;
        dom.modeContainer.innerHTML = html;
        attachGrammarEvents(lesson, points, filteredPoints);
    }

    function attachGrammarEvents(lesson, allPoints, filteredPoints) {
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
    // 8. MODE 3: FLASHCARDS 3D
    // ==========================================================================
    function renderFlashcardStudio() {
        const lesson = getActiveLesson();
        let words = lesson.words || [];

        if (state.fcScope === 'starred') {
            words = words.filter(w => !!state.starredWords[w.id]);
        }

        state.fcDeck = words;

        if (state.fcDeck.length === 0) {
            dom.modeContainer.innerHTML = `
                <div class="flashcard-studio">
                    <div class="empty-state">
                        <p>Không có từ vựng nào trong danh sách thẻ!</p>
                        ${state.fcScope === 'starred' ? `
                            <button class="rt-btn" id="btnFcShowAll" style="margin-top:12px;">Xem tất cả các từ</button>
                        ` : ''}
                    </div>
                </div>
            `;
            const btnShowAll = document.getElementById('btnFcShowAll');
            if (btnShowAll) {
                btnShowAll.addEventListener('click', () => {
                    state.fcScope = 'all';
                    renderFlashcardStudio();
                });
            }
            return;
        }

        if (state.fcIndex >= state.fcDeck.length) state.fcIndex = 0;
        const currentWord = state.fcDeck[state.fcIndex];
        const isStarred = !!state.starredWords[currentWord.id];

        dom.modeContainer.innerHTML = `
            <div class="flashcard-studio">
                <div class="fc-meta-bar">
                    <div class="fc-counter-badge">
                        Thẻ ${state.fcIndex + 1} / ${state.fcDeck.length}
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
                        <!-- FRONT -->
                        <div class="fc-face fc-front">
                            <div class="fc-front-hz">${currentWord.hz}</div>
                            <div class="fc-front-py">${currentWord.py}</div>
                            <div class="fc-hint-tag">💡 Chạm hoặc nhấn Space để lật nghĩa</div>
                        </div>

                        <!-- BACK -->
                        <div class="fc-face fc-back">
                            <div class="fc-back-top">
                                <span class="vc-type-badge">${currentWord.type || 'Từ vựng'}</span>
                                <button class="btn-icon-round btn-star-fc ${isStarred ? 'is-starred' : ''}" id="btnStarFc">★</button>
                            </div>
                            <div class="fc-back-word-row">
                                <div class="fc-back-hz">${currentWord.hz}</div>
                                <div class="fc-back-py">${currentWord.py}</div>
                            </div>
                            <div class="fc-back-meaning">${currentWord.mean}</div>
                            ${currentWord.examples && currentWord.examples.length > 0 ? `
                                <div class="fc-back-examples">
                                    ${currentWord.examples[0]}
                                </div>
                            ` : ''}
                            <button class="rt-btn" id="btnSpeakFc" style="margin-top: 10px;">🔊 Phát âm</button>
                        </div>
                    </div>
                </div>

                <div class="fc-bottom-nav">
                    <button class="btn-fc-nav" id="btnFcPrev">← Trước</button>
                    <button class="btn-fc-nav btn-fc-flip" id="btnFcFlip">🔄 Lật Thẻ</button>
                    <button class="btn-fc-nav" id="btnFcNext">Tiếp →</button>
                </div>
            </div>
        `;

        // Flip Card Click
        const stage = document.getElementById('flashcardStage');
        if (stage) {
            stage.addEventListener('click', (e) => {
                if (e.target.closest('#btnStarFc') || e.target.closest('#btnSpeakFc')) return;
                state.fcFlipped = !state.fcFlipped;
                stage.classList.toggle('flipped', state.fcFlipped);
            });
        }

        const btnFlip = document.getElementById('btnFcFlip');
        if (btnFlip) {
            btnFlip.addEventListener('click', () => {
                state.fcFlipped = !state.fcFlipped;
                if (stage) stage.classList.toggle('flipped', state.fcFlipped);
            });
        }

        // Navigation Next / Prev
        const btnNext = document.getElementById('btnFcNext');
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                state.fcIndex = (state.fcIndex + 1) % state.fcDeck.length;
                state.fcFlipped = false;
                renderFlashcardStudio();
                speakChinese(state.fcDeck[state.fcIndex].hz);
            });
        }

        const btnPrev = document.getElementById('btnFcPrev');
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                state.fcIndex = (state.fcIndex - 1 + state.fcDeck.length) % state.fcDeck.length;
                state.fcFlipped = false;
                renderFlashcardStudio();
                speakChinese(state.fcDeck[state.fcIndex].hz);
            });
        }

        // Star Toggle
        const btnStar = document.getElementById('btnStarFc');
        if (btnStar) {
            btnStar.addEventListener('click', (e) => {
                e.stopPropagation();
                if (state.starredWords[currentWord.id]) {
                    delete state.starredWords[currentWord.id];
                    btnStar.classList.remove('is-starred');
                } else {
                    state.starredWords[currentWord.id] = true;
                    btnStar.classList.add('is-starred');
                }
                localStorage.setItem(STORAGE_KEY_STARRED, JSON.stringify(state.starredWords));
            });
        }

        // Speak Button
        const btnSpeak = document.getElementById('btnSpeakFc');
        if (btnSpeak) {
            btnSpeak.addEventListener('click', (e) => {
                e.stopPropagation();
                speakChinese(currentWord.hz);
            });
        }

        // Shuffle
        const btnShuf = document.getElementById('btnFcShuffle');
        if (btnShuf) {
            btnShuf.addEventListener('click', () => {
                state.fcDeck.sort(() => Math.random() - 0.5);
                state.fcIndex = 0;
                state.fcFlipped = false;
                renderFlashcardStudio();
            });
        }

        // Toggle Scope
        const btnScope = document.getElementById('btnFcToggleScope');
        if (btnScope) {
            btnScope.addEventListener('click', () => {
                state.fcScope = state.fcScope === 'all' ? 'starred' : 'all';
                state.fcIndex = 0;
                state.fcFlipped = false;
                renderFlashcardStudio();
            });
        }
    }

    // ==========================================================================
    // 9. MODE 4: TRẮC NGHIỆM & TRÒ CHƠI (QUIZ HUB)
    // ==========================================================================
    function renderQuizStudio() {
        dom.modeContainer.innerHTML = `
            <div class="quiz-hub-studio">
                <div class="quiz-sub-modes-bar">
                    <button class="quiz-sub-mode-btn ${state.quizSubMode === 'mcq' ? 'active' : ''}" data-sub="mcq">
                        🎯 Trắc Nghiệm Phản Xạ
                    </button>
                    <button class="quiz-sub-mode-btn ${state.quizSubMode === 'match' ? 'active' : ''}" data-sub="match">
                        🧩 Ghép Cặp Hán - Việt
                    </button>
                    <button class="quiz-sub-mode-btn ${state.quizSubMode === 'listen' ? 'active' : ''}" data-sub="listen">
                        🎧 Luyện Nghe Chọn Từ
                    </button>
                </div>

                <div id="quizSubModeContainer">
                    <!-- Dynamically populated -->
                </div>
            </div>
        `;

        dom.modeContainer.querySelectorAll('.quiz-sub-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.quizSubMode = btn.getAttribute('data-sub');
                renderQuizStudio();
            });
        });

        if (state.quizSubMode === 'mcq') {
            initMcqQuiz(false);
        } else if (state.quizSubMode === 'listen') {
            initMcqQuiz(true);
        } else if (state.quizSubMode === 'match') {
            initMatchGame();
        }
    }

    function initMcqQuiz(isListening = false) {
        const container = document.getElementById('quizSubModeContainer');
        if (!container) return;

        const lesson = getActiveLesson();
        const words = lesson.words || [];
        if (words.length < 4) {
            container.innerHTML = `<div class="empty-state">Bài này cần ít nhất 4 từ vựng để tạo bài trắc nghiệm.</div>`;
            return;
        }

        // Pick random question
        const targetWord = words[Math.floor(Math.random() * words.length)];
        
        // Pick 3 distractors
        const distractors = words.filter(w => w.id !== targetWord.id)
                                 .sort(() => Math.random() - 0.5)
                                 .slice(0, 3);
        
        const options = [targetWord, ...distractors].sort(() => Math.random() - 0.5);

        state.quizCurrentQ = {
            target: targetWord,
            options: options,
            isListening: isListening
        };
        state.quizAnswered = false;

        container.innerHTML = `
            <div class="quiz-card">
                <div class="quiz-progress-row">
                    <span class="quiz-stat-pill">Điểm: ${state.quizScore} / ${state.quizTotal}</span>
                    <span class="quiz-stat-pill streak">🔥 Streak: ${state.quizStreak}</span>
                </div>

                <div class="quiz-question-box">
                    <div class="qq-prompt">${isListening ? '🎧 Nghe phát âm và chọn chữ Hán đúng:' : 'Chọn nghĩa tiếng Việt chính xác:'}</div>
                    ${isListening ? `
                        <button class="rt-btn audio-play-btn" id="btnPlayQuizAudio" style="font-size: 16px; padding: 12px 24px; margin: 16px auto;">
                            🔊 Nghe Lại Âm Thanh
                        </button>
                    ` : `
                        <div class="qq-word">${targetWord.hz}</div>
                        <div class="qq-py">${targetWord.py}</div>
                    `}
                </div>

                <div class="quiz-options-grid">
                    ${options.map((opt, i) => `
                        <button class="quiz-opt-btn" data-wid="${opt.id}">
                            <span class="opt-prefix">${String.fromCharCode(65 + i)}</span>
                            <span>${isListening ? `${opt.hz} (${opt.py})` : opt.mean}</span>
                        </button>
                    `).join('')}
                </div>

                <div style="margin-top: 24px; text-align: center;">
                    <button class="rt-btn" id="btnNextQuizQ" style="display: none; margin: 0 auto;">Câu tiếp theo ➔</button>
                </div>
            </div>
        `;

        if (isListening) {
            speakChinese(targetWord.hz);
            const btnAudio = document.getElementById('btnPlayQuizAudio');
            if (btnAudio) {
                btnAudio.addEventListener('click', () => speakChinese(targetWord.hz));
            }
        }

        // Option selection
        container.querySelectorAll('.quiz-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (state.quizAnswered) return;
                state.quizAnswered = true;
                state.quizTotal++;

                const selectedId = btn.getAttribute('data-wid');
                const isCorrect = selectedId === targetWord.id;

                if (isCorrect) {
                    btn.classList.add('correct');
                    state.quizScore++;
                    state.quizStreak++;
                } else {
                    btn.classList.add('wrong');
                    state.quizStreak = 0;
                    // Highlight correct option
                    container.querySelectorAll('.quiz-opt-btn').forEach(b => {
                        if (b.getAttribute('data-wid') === targetWord.id) {
                            b.classList.add('correct');
                        }
                    });
                }

                const btnNext = document.getElementById('btnNextQuizQ');
                if (btnNext) {
                    btnNext.style.display = 'inline-flex';
                    btnNext.addEventListener('click', () => initMcqQuiz(isListening));
                }
            });
        });
    }

    function initMatchGame() {
        const container = document.getElementById('quizSubModeContainer');
        if (!container) return;

        const lesson = getActiveLesson();
        const words = (lesson.words || []).slice(0, 6);

        if (words.length < 4) {
            container.innerHTML = `<div class="empty-state">Cần ít nhất 4 từ vựng để chơi ghép cặp.</div>`;
            return;
        }

        // Create 12 cards: 6 Hanzi + 6 Meanings
        let cards = [];
        words.forEach(w => {
            cards.push({ id: w.id, type: 'hz', text: w.hz, py: w.py });
            cards.push({ id: w.id, type: 'vn', text: w.mean });
        });
        cards.sort(() => Math.random() - 0.5);

        state.matchCards = cards;
        state.matchSelected = null;
        state.matchPairsFound = 0;
        state.matchTimer = 0;
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
                        <div class="match-tile ${c.type === 'hz' ? 'is-hanzi' : ''}" data-idx="${i}" data-id="${c.id}" data-type="${c.type}">
                            ${c.text}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Start timer
        state.matchTimerId = setInterval(() => {
            state.matchTimer++;
            const tLbl = document.getElementById('matchTimerLabel');
            if (tLbl) tLbl.textContent = `⏱️ ${state.matchTimer}s`;
        }, 1000);

        // Restart button
        const btnRestart = document.getElementById('btnRestartMatch');
        if (btnRestart) btnRestart.addEventListener('click', () => initMatchGame());

        // Card clicks
        container.querySelectorAll('.match-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                if (tile.classList.contains('matched') || tile.classList.contains('selected')) return;

                const idx = parseInt(tile.getAttribute('data-idx'), 10);
                const card = state.matchCards[idx];

                if (card.type === 'hz') speakChinese(card.text);

                if (!state.matchSelected) {
                    // First card selected
                    state.matchSelected = { idx, card, el: tile };
                    tile.classList.add('selected');
                } else {
                    // Second card selected
                    const first = state.matchSelected;
                    tile.classList.add('selected');

                    // Check if match
                    if (first.card.id === card.id && first.card.type !== card.type) {
                        // Match!
                        setTimeout(() => {
                            first.el.classList.add('matched');
                            tile.classList.add('matched');
                            first.el.classList.remove('selected');
                            tile.classList.remove('selected');
                            state.matchPairsFound++;
                            const pLbl = document.getElementById('matchPairsLabel');
                            if (pLbl) pLbl.textContent = `Đã ghép: ${state.matchPairsFound} / ${words.length}`;

                            if (state.matchPairsFound === words.length) {
                                clearInterval(state.matchTimerId);
                                alert(`🎉 Xuất sắc! Bạn đã hoàn thành bài ghép từ trong ${state.matchTimer} giây!`);
                            }
                        }, 250);
                    } else {
                        // Mismatch
                        setTimeout(() => {
                            first.el.classList.remove('selected');
                            tile.classList.remove('selected');
                        }, 500);
                    }
                    state.matchSelected = null;
                }
            });
        });
    }

    // ==========================================================================
    // 10. MODE 5: SÁCH GỐC PDF (ORIGINAL PDF VIEWER)
    // ==========================================================================
    function renderPdfStudio() {
        const book = getActiveBook();

        dom.modeContainer.innerHTML = `
            <div class="pdf-studio">
                <div class="pdf-toolbar">
                    <div class="rt-group">
                        <span style="font-weight: 700; color: var(--text-main);">📑 Sách gốc: ${book.name} (${book.chinese_name})</span>
                    </div>
                    <div class="rt-group">
                        <a href="${book.pdf}" target="_blank" class="rt-btn">
                            ↗️ Mở trong Tab Mới
                        </a>
                        <a href="${book.pdf}" download class="rt-btn">
                            ⬇️ Tải file PDF về máy
                        </a>
                    </div>
                </div>

                <div class="pdf-frame-wrap">
                    <iframe src="${book.pdf}" title="Giáo trình Boya PDF"></iframe>
                </div>
            </div>
        `;
    }

    // ==========================================================================
    // 11. MODE 6: PODCAST / CHẠY NỀN RẢNH TAY
    // ==========================================================================
    function renderPodcastStudio() {
        const lesson = getActiveLesson();
        const words = lesson.words || [];

        dom.modeContainer.innerHTML = `
            <div class="quiz-card" style="max-width: 600px; margin: 0 auto; text-align: center;">
                <h2 style="font-size: 22px; margin-bottom: 8px;">🎧 Chế Độ Học Thụ Động (Hands-free Podcast)</h2>
                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 24px;">
                    Hệ thống sẽ tự động phát âm lần lượt: Chữ Hán ➔ Pinyin ➔ Nghĩa Tiếng Việt ➔ Câu ví dụ để bạn luyện nghe rảnh tay khi làm việc hoặc thư giãn.
                </p>

                <div style="font-size: 52px; font-weight: 800; font-family: var(--font-chinese); color: var(--text-main); margin-bottom: 8px;" id="podWordHz">
                    ${words[state.podcastIndex]?.hz || 'Bắt đầu'}
                </div>
                <div style="font-size: 18px; color: var(--primary); font-weight: 600; margin-bottom: 12px;" id="podWordPy">
                    ${words[state.podcastIndex]?.py || ''}
                </div>
                <div style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 30px;" id="podWordMean">
                    ${words[state.podcastIndex]?.mean || ''}
                </div>

                <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                    <button class="rt-btn audio-play-btn" id="btnTogglePodcastRun" style="padding: 10px 24px; font-size: 14px;">
                        ${state.podcastRunning ? '⏸ Tạm dừng' : '▶️ Bắt đầu Nghe'}
                    </button>
                    <button class="rt-btn" id="btnPodcastNext">Bỏ qua từ này ➔</button>
                </div>
            </div>
        `;

        const btnRun = document.getElementById('btnTogglePodcastRun');
        if (btnRun) {
            btnRun.addEventListener('click', () => {
                if (state.podcastRunning) {
                    stopPodcast();
                    btnRun.innerHTML = '▶️ Bắt đầu Nghe';
                } else {
                    startPodcast();
                    btnRun.innerHTML = '⏸ Tạm dừng';
                }
            });
        }

        const btnSkip = document.getElementById('btnPodcastNext');
        if (btnSkip) {
            btnSkip.addEventListener('click', () => {
                const words = getActiveLesson().words || [];
                state.podcastIndex = (state.podcastIndex + 1) % words.length;
                updatePodcastUI();
                if (state.podcastRunning) playPodcastStep();
            });
        }
    }

    function startPodcast() {
        state.podcastRunning = true;
        playPodcastStep();
    }

    function stopPodcast() {
        state.podcastRunning = false;
        clearTimeout(state.podcastTimer);
        window.speechSynthesis.cancel();
    }

    function playPodcastStep() {
        if (!state.podcastRunning) return;
        const words = getActiveLesson().words || [];
        if (words.length === 0) return;

        const word = words[state.podcastIndex];
        updatePodcastUI();

        // Step 1: Speak Chinese Word
        speakChinese(word.hz, () => {
            if (!state.podcastRunning) return;
            state.podcastTimer = setTimeout(() => {
                // Step 2: Speak Vietnamese meaning
                speakVietnamese(word.mean, () => {
                    if (!state.podcastRunning) return;
                    state.podcastTimer = setTimeout(() => {
                        // Move to next word
                        state.podcastIndex = (state.podcastIndex + 1) % words.length;
                        playPodcastStep();
                    }, 1200);
                });
            }, 800);
        });
    }

    function updatePodcastUI() {
        const words = getActiveLesson().words || [];
        const word = words[state.podcastIndex];
        if (!word) return;
        const hz = document.getElementById('podWordHz');
        const py = document.getElementById('podWordPy');
        const mean = document.getElementById('podWordMean');
        if (hz) hz.textContent = word.hz;
        if (py) py.textContent = word.py;
        if (mean) mean.textContent = word.mean;
    }

    // ==========================================================================
    // 12. TEXT-TO-SPEECH (TTS) ENGINES
    // ==========================================================================
    function speakChinese(text, onEndCallback) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.9;

        // Try to pick a Chinese voice
        const voices = window.speechSynthesis.getVoices();
        const zhVoice = voices.find(v => v.lang.startsWith('zh'));
        if (zhVoice) utterance.voice = zhVoice;

        if (onEndCallback) utterance.onend = onEndCallback;
        window.speechSynthesis.speak(utterance);
    }

    function speakVietnamese(text, onEndCallback) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
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

        // Collapse / Expand Audio Dock Toggle
        const btnToggleDock = document.getElementById('btnToggleAudioDock');
        const audioDock = document.querySelector('.boya-audio-dock');
        if (btnToggleDock && audioDock) {
            btnToggleDock.addEventListener('click', () => {
                const isCollapsed = audioDock.classList.toggle('is-collapsed');
                btnToggleDock.textContent = isCollapsed ? '▴' : '▾';
                btnToggleDock.title = isCollapsed ? 'Mở rộng trình phát nhạc' : 'Thu gọn trình phát nhạc';
                document.documentElement.style.setProperty('--player-height', isCollapsed ? '38px' : '72px');
            });
        }
    }

    function loadAudioTrack(url, title, autoPlay = true) {
        if (!dom.audioPlayer) return;
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
        // Complete Lesson Toggle
        if (dom.btnMarkComplete) {
            dom.btnMarkComplete.addEventListener('click', () => {
                const book = getActiveBook();
                const lessonKey = `${book.id}_bai${state.activeLessonNum}`;
                if (state.completedLessons[lessonKey]) {
                    delete state.completedLessons[lessonKey];
                } else {
                    state.completedLessons[lessonKey] = true;
                }
                localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(state.completedLessons));
                renderLessonHeader();
                renderSidebar();
            });
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

        // Theme Toggle
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const isDark = document.body.classList.toggle('dark-mode');
                localStorage.setItem(STORAGE_KEY_THEME, isDark.toString());
            });
        }

        // Sidebar Mobile Toggle
        const sidebarToggle = document.getElementById('sidebarToggleBtn');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', toggleSidebar);
        }
        const sidebarClose = document.getElementById('sidebarCloseBtn');
        if (sidebarClose) {
            sidebarClose.addEventListener('click', closeSidebar);
        }
        if (dom.sidebarBackdrop) {
            dom.sidebarBackdrop.addEventListener('click', closeSidebar);
        }

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
            // Escape closes modals
            if (e.key === 'Escape') {
                closeSearchModal();
                closeSidebar();
            }
            // Pinyin Shortcut: 'p'
            if (e.key === 'p' || e.key === 'P') {
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    state.pinyinVisible = !state.pinyinVisible;
                    saveSettings();
                    if (state.activeMode === 'reading') renderReadingStudio();
                }
            }
        });
    }

    function toggleSidebar() {
        if (!dom.boyaSidebar) return;
        const isOpen = dom.boyaSidebar.classList.toggle('open');
        if (dom.sidebarBackdrop) dom.sidebarBackdrop.classList.toggle('active', isOpen);
    }

    function closeSidebar() {
        if (dom.boyaSidebar) dom.boyaSidebar.classList.remove('open');
        if (dom.sidebarBackdrop) dom.sidebarBackdrop.classList.remove('active');
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
            const totV = window.BOYA_DATA?.total_vocab || '2.674+';
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
                                <div style="font-size: 11px; color: var(--primary);">${escapeHtml(r.grammar.structure || r.grammar.pinyin || '')}</div>
                            </div>
                        </div>
                        <span class="mri-tag" style="background:rgba(37,99,235,0.12);color:var(--primary);font-weight:700;">Ngữ pháp • Bài ${r.lessonNum}</span>
                    </div>
                `;
            } else {
                return `
                    <div class="modal-result-item" data-book="${r.bookId}" data-lesson="${r.lessonNum}" data-mode="vocab">
                        <div class="mri-left">
                            <div class="mri-hz">${r.word.hz}</div>
                            <div>
                                <div class="mri-py">${r.word.py}</div>
                                <div class="mri-mean">${r.word.mean}</div>
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
                switchBook(bId, lNum, true);
                switchMode(mode);
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
            toast.style.cssText = 'position:fixed;bottom:90px;right:24px;background:rgba(15,23,42,0.92);color:#fff;padding:10px 18px;border-radius:9999px;font-size:13.5px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,0.3);z-index:99999;transition:all 0.3s cubic-bezier(0.16,1,0.3,1);transform:translateY(20px);opacity:0;pointer-events:none;backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.15);';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.transform = 'translateY(20px)';
            toast.style.opacity = '0';
        }, 2200);
    }

})();
