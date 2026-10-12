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

    // ==================== STATE ====================
    let state = {
        activeBookId: 'q1',
        activeUnitNum: 1,
        activeWordNum: 1,
        studyMode: 'memory',       // 'memory' | 'practice' | 'flashcard' | 'pdf'
        unitFilter: 'all',         // 'all' | 'todo' | 'done' | 'star'
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

        // Current unit user answers in Mode 2 (Practice)
        userAnswers: {
            sec1Pinyin: {},        // { q_num: 'A' }
            sec1Meaning: {},       // { q_num: 'a' }
            sec2Cloze: {},         // { "g1_q1": 'D' }
            sec3Mcq: {}            // { q_num: 'C' }
        },
        practiceChecked: false,

        // Flashcard & Quiz state
        fcScope: 'unit',           // 'unit' | 'starred' | 'book'
        fcDeck: [],
        fcIndex: 0,
        fcFlipped: false,
        quizCorrect: 0,
        quizTotal: 0,
        quizCurrentQ: null,
        quizAnswered: false
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

    // ==================== LOCAL STORAGE & THEME ====================
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
        } catch (e) {
            console.warn('Không thể lưu tiến độ:', e);
        }
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
        const shelf = document.getElementById('bookShelfBar');
        if (!shelf || typeof HSK_BOOKS_INDEX === 'undefined') return;

        shelf.innerHTML = HSK_BOOKS_INDEX.map(book => {
            const isActive = book.id === state.activeBookId;
            const doneCount = (book.units_index || []).filter(u => state.doneUnits[`${book.id}_${getUnitNum(u)}`]).length;
            const shortTitle = book.title.split('—')[0].trim();

            return `
                <div class="book-tab-card ${isActive ? 'active' : ''}"
                     style="--book-color: ${book.color}"
                     data-book-id="${book.id}">
                    <span class="bt-dot"></span>
                    <div class="bt-info">
                        <div class="bt-name">
                            <span>${escapeHtml(shortTitle)}</span>
                            <span class="bt-json-tag">${escapeHtml(book.badge)}</span>
                        </div>
                        <div class="bt-meta">
                            <span>📚 ${book.unit_count} bài</span>
                            <span>·</span>
                            <span>🔤 ${book.word_count.toLocaleString('vi-VN')} từ</span>
                            ${doneCount > 0 ? `<span>· ✓ ${doneCount}/${book.unit_count}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        shelf.querySelectorAll('.book-tab-card').forEach(card => {
            card.addEventListener('click', () => {
                const bid = card.getAttribute('data-book-id');
                if (bid && bid !== state.activeBookId) {
                    selectBook(bid, null);
                }
            });
        });

        const activeCard = shelf.querySelector('.book-tab-card.active');
        if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
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
            <div class="sbs-title">
                <span>${escapeHtml(meta.title)}</span>
                <span class="au-badge" style="background:${meta.color}">${escapeHtml(meta.badge)}</span>
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
        state.currentPdfPage = unitData.pdf_page || 1;
        if (state.studyMode === 'pdf') {
            renderPdfPane();
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
            mobDone.innerHTML = isDone ? '✓ Đã học' : '☐ Đã học';
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
                mobLbl.textContent = `Bài ${state.activeUnitNum} (${idx + 1}/${meta.units_index.length})`;
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
                       <div class="qmc-ex-item">
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
                        <button class="qmc-icon-btn" data-speak="${escapeAttr(cleanHz)}" title="Nghe phát âm">🔊 Nghe</button>
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
                const text = el.getAttribute('data-speak');
                if (text) speakChinese(text);
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
            });
        }

        if (ex.section2 && ex.section2.groups) {
            ex.section2.groups.forEach(grp => {
                (grp.questions || []).forEach(q => {
                    total += 1;
                    const key = `g${grp.group_num}_q${q.q_num}`;
                    const userChoice = state.userAnswers.sec2Cloze[key] || '';
                    const isOk = userChoice === q.answer;
                    if (isOk) score += 1;

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
                if (isOk) score += 1;

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
        saveProgress();

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

    // ==================== MODE 3: FLASHCARD 3D & REFLEX QUIZ ====================
    function getWordsForScope(scope) {
        const bookData = getLoadedBookData(state.activeBookId);
        const unitData = getCurrentUnitData();
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

        if (!state.fcDeck.length) return;
        const w = state.fcDeck[state.fcIndex] || state.fcDeck[0];

        const numBadge   = document.getElementById('fcWordNumBadge');
        const frontHz    = document.getElementById('fcFrontHanzi');
        const frontPos   = document.getElementById('fcFrontPos');
        const backHz     = document.getElementById('fcBackHanzi');
        const backPy     = document.getElementById('fcBackPinyin');
        const backMn     = document.getElementById('fcBackMeaning');
        const backEx     = document.getElementById('fcBackExample');
        const counterEl  = document.getElementById('fcCounter');

        if (numBadge) numBadge.textContent = `#${w.num}`;
        if (frontHz)  frontHz.textContent  = w.word;
        if (frontPos) frontPos.textContent = w.pos_full || w.pos || 'Từ vựng';
        if (backHz)   backHz.textContent   = w.word;
        if (backPy)   backPy.textContent   = w.pinyin;
        if (backMn)   backMn.textContent   = w.meaning_vi || w.meaning_primary || w.meaning_en;

        if (backEx) {
            const ex = (w.examples && w.examples[0]) ? w.examples[0] : null;
            backEx.innerHTML = ex
                ? `<div><strong>${escapeHtml(ex.hz)}</strong></div>
                   <div style="font-size:0.82rem;opacity:0.85">${escapeHtml(ex.py || '')}</div>
                   <div style="font-size:0.84rem;margin-top:2px">${escapeHtml(ex.vn || '')}</div>`
                : `<div>Cấp độ ${state.activeBookId.toUpperCase()}</div>`;
        }

        if (counterEl) {
            counterEl.textContent = `${state.fcIndex + 1} / ${state.fcDeck.length}`;
        }
    }

    function initReflexQuiz() {
        state.quizCorrect = 0;
        state.quizTotal = 0;
        updateQuizScoreUI();
        nextReflexQuizQuestion();
    }

    function updateQuizScoreUI() {
        const sEl = document.getElementById('quizScore');
        const tEl = document.getElementById('quizTotal');
        if (sEl) sEl.textContent = state.quizCorrect;
        if (tEl) tEl.textContent = state.quizTotal;
    }

    function nextReflexQuizQuestion() {
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
        const optsEl = document.getElementById('quizOptions');

        if (wordEl) wordEl.textContent = target.word;
        if (pyEl)   pyEl.textContent   = `${target.pinyin} · ${target.pos_full || target.pos || ''}`;

        if (optsEl) {
            const letters = ['A', 'B', 'C', 'D'];
            optsEl.innerHTML = options.map((opt, idx) => `
                <button class="quiz-opt-btn" data-quiz-id="${opt.id}">
                    <strong>${letters[idx]}.</strong> ${escapeHtml(opt.meaning_vi || opt.meaning_primary || opt.meaning_en)}
                </button>
            `).join('');

            optsEl.querySelectorAll('.quiz-opt-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (state.quizAnswered) return;
                    state.quizAnswered = true;
                    state.quizTotal += 1;

                    const pickedId = btn.getAttribute('data-quiz-id');
                    const isCorrect = pickedId === target.id;
                    if (isCorrect) {
                        state.quizCorrect += 1;
                        btn.classList.add('correct');
                        speakChinese(cleanHanziForTts(target.word));
                    } else {
                        btn.classList.add('wrong');
                        optsEl.querySelectorAll('.quiz-opt-btn').forEach(b => {
                            if (b.getAttribute('data-quiz-id') === target.id) {
                                b.classList.add('correct');
                            }
                        });
                    }
                    updateQuizScoreUI();
                });
            });
        }
    }

    // ==================== MODE 4: XEM SÁCH PDF GỐC ====================
    function renderPdfPane() {
        const meta = getBookIndexMeta(state.activeBookId);
        const wrap = document.getElementById('pdfRefFrameWrap');
        const lbl  = document.getElementById('lblCurrentPdfPage');
        if (!meta || !wrap) return;

        if (lbl) lbl.textContent = `Trang PDF: ${state.currentPdfPage}`;

        if (!meta.has_pdf || !meta.pdf_file) {
            wrap.innerHTML = `
                <div class="empty-msg" style="padding:60px 24px;">
                    <h3 style="font-size:1.2rem;margin-bottom:10px;color:var(--text-primary);">
                        📗 Quyển 2 (Cấp độ 2) đã được tích hợp 100% dữ liệu JSON (39 Bài · 772 Từ)
                    </h3>
                    <p style="max-width:560px;margin:0 auto 16px;line-height:1.6;">
                        Mặc dù thư mục <code>word_learning_book</code> của bạn thiếu file scan <code>QUYỂN 2.pdf</code>,
                        toàn bộ <strong>39 Bài học (772 từ vựng mục tiêu, phiên âm, từ loại, nghĩa tiếng Việt, câu ví dụ và bài tập 3 phần)</strong>
                        của Quyển 2 đã được khôi phục đầy đủ trong file <code>json_data/quyen_2.json</code>!
                    </p>
                    <button class="btn-primary-action" id="btnBackToMemoryFromPdf">📖 Quay lại học bản Điện tử JSON</button>
                </div>
            `;
            const backBtn = document.getElementById('btnBackToMemoryFromPdf');
            if (backBtn) {
                backBtn.addEventListener('click', () => switchStudyMode('memory'));
            }
            return;
        }

        const encodedPdf = meta.pdf_file.split('/').map(encodeURIComponent).join('/');
        wrap.innerHTML = `<iframe id="pdfRefIframe" title="Sách PDF gốc" src="${encodedPdf}#page=${state.currentPdfPage}&view=FitH"></iframe>`;
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
            pdf: 'panePdf'
        };
        const targetPane = document.getElementById(map[mode]);
        if (targetPane) targetPane.classList.add('active');

        if (mode === 'pdf') {
            renderPdfPane();
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

    function toggleSpeakAllWords() {
        if (state.speakingAll) {
            stopSpeakingAll();
            return;
        }
        const unitData = getCurrentUnitData();
        if (!unitData || !unitData.target_words || !unitData.target_words.length) return;

        state.speakingAll = true;
        const btn = document.getElementById('btnSpeakAllWords');
        if (btn) {
            btn.classList.add('active');
            btn.textContent = '⏹️ Dừng đọc';
        }

        const words = unitData.target_words;
        let idx = 0;

        function speakNext() {
            if (!state.speakingAll || idx >= words.length) {
                stopSpeakingAll();
                return;
            }
            const w = words[idx++];
            const card = document.getElementById(`qm-word-${w.num}`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('highlight-flash');
                setTimeout(() => card.classList.remove('highlight-flash'), 1200);
            }

            if (!('speechSynthesis' in window)) {
                stopSpeakingAll();
                return;
            }
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(cleanHanziForTts(w.word));
            utter.lang = 'zh-CN';
            utter.rate = 0.88;
            utter.onend = () => {
                if (state.speakingAll) {
                    setTimeout(speakNext, 450);
                }
            };
            utter.onerror = () => stopSpeakingAll();
            window.speechSynthesis.speak(utter);
        }

        speakNext();
    }

    function stopSpeakingAll() {
        state.speakingAll = false;
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        const btn = document.getElementById('btnSpeakAllWords');
        if (btn) {
            btn.classList.remove('active');
            btn.textContent = '🔊 Nghe cả bài';
        }
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

        // Mode 1 controls
        const btnSpeakAll = document.getElementById('btnSpeakAllWords');
        if (btnSpeakAll) btnSpeakAll.addEventListener('click', toggleSpeakAllWords);

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

        // Mode 3 Flashcard & Quiz
        const fcScopeSel = document.getElementById('fcScopeSelect');
        if (fcScopeSel) {
            fcScopeSel.addEventListener('change', () => {
                state.fcScope = fcScopeSel.value;
                initFlashcardDeck();
                initReflexQuiz();
            });
        }

        const fcCard = document.getElementById('fcCard3d');
        if (fcCard) {
            fcCard.addEventListener('click', (e) => {
                if (e.target.closest('.fc-audio-btn')) return;
                state.fcFlipped = !state.fcFlipped;
                fcCard.classList.toggle('flipped', state.fcFlipped);
            });
        }

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
        if (btnFcPrev) {
            btnFcPrev.addEventListener('click', () => {
                if (!state.fcDeck.length) return;
                state.fcIndex = (state.fcIndex - 1 + state.fcDeck.length) % state.fcDeck.length;
                state.fcFlipped = false;
                renderFlashcard();
            });
        }
        if (btnFcNext) {
            btnFcNext.addEventListener('click', () => {
                if (!state.fcDeck.length) return;
                state.fcIndex = (state.fcIndex + 1) % state.fcDeck.length;
                state.fcFlipped = false;
                renderFlashcard();
            });
        }
        if (btnFcShuf) {
            btnFcShuf.addEventListener('click', () => {
                state.fcDeck.sort(() => Math.random() - 0.5);
                state.fcIndex = 0;
                state.fcFlipped = false;
                renderFlashcard();
            });
        }

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

        // Mode 4 PDF buttons
        const btnPdfTheory = document.getElementById('btnPdfJumpTheory');
        const btnPdfPrac   = document.getElementById('btnPdfJumpPractice');
        const btnPdfIndex  = document.getElementById('btnPdfJumpIndex');
        const btnPdfPrev   = document.getElementById('btnPdfPrevPage');
        const btnPdfNext   = document.getElementById('btnPdfNextPage');

        if (btnPdfTheory) {
            btnPdfTheory.addEventListener('click', () => {
                const u = getCurrentUnitData();
                if (u) {
                    state.currentPdfPage = u.pdf_page || 1;
                    renderPdfPane();
                }
            });
        }
        if (btnPdfPrac) {
            btnPdfPrac.addEventListener('click', () => {
                const u = getCurrentUnitData();
                if (u) {
                    state.currentPdfPage = u.practice_pdf_page || (u.pdf_page + 1) || 1;
                    renderPdfPane();
                }
            });
        }
        if (btnPdfIndex) {
            btnPdfIndex.addEventListener('click', () => {
                const meta = getBookIndexMeta(state.activeBookId);
                if (meta && meta.index_pdf_page) {
                    state.currentPdfPage = meta.index_pdf_page;
                    renderPdfPane();
                }
            });
        }
        if (btnPdfPrev) {
            btnPdfPrev.addEventListener('click', () => {
                if (state.currentPdfPage > 1) {
                    state.currentPdfPage -= 1;
                    renderPdfPane();
                }
            });
        }
        if (btnPdfNext) {
            btnPdfNext.addEventListener('click', () => {
                const meta = getBookIndexMeta(state.activeBookId);
                const maxP = (meta && meta.total_pdf_pages) ? meta.total_pdf_pages : 999;
                if (state.currentPdfPage < maxP) {
                    state.currentPdfPage += 1;
                    renderPdfPane();
                }
            });
        }

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
