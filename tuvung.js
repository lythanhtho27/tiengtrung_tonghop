/**
 * ==========================================================================
 * TUVUNG.JS - Logic Ứng Dụng Ôn Tập Từ Vựng Tiếng Trung Boya (TC1 - TC4)
 * Bao gồm: Tra cứu, Bộ lọc, Flashcard 3D, Trắc nghiệm trắc trở, Ghép từ, TTS
 * ==========================================================================
 */

(function () {
    "use strict";

    // Global App State
    const state = {
        books: [],
        allWords: [],
        selectedBook: "all",
        selectedLesson: "all",
        starredOnly: false,
        searchQuery: "",
        typeFilter: "all",
        hidePinyin: false,
        hideMean: false,
        currentMode: "table", // 'table' | 'flashcard' | 'quiz' | 'match'
        
        // Flashcard state
        fcList: [],
        fcIndex: 0,
        fcFlipped: false,
        fcFrontType: "hz", // 'hz' (Chinese front) or 'mean' (Vietnamese front)
        
        // Quiz state
        quizQuestions: [],
        quizCurrentIdx: 0,
        quizScore: 0,
        quizIncorrect: [],
        quizAnswered: false,
        
        // Matching game state
        gameTiles: [],
        gameSelectedTile: null,
        gameMatchedCount: 0,
        gameTimer: null,
        gameSeconds: 0,
        
        // Storage
        starredWords: new Set(),
        masteredWords: new Set()
    };

    // Load LocalStorage Data
    function loadStorage() {
        try {
            const savedStarred = localStorage.getItem("boya_starred_words");
            if (savedStarred) {
                state.starredWords = new Set(JSON.parse(savedStarred));
            }
            const savedMastered = localStorage.getItem("boya_mastered_words");
            if (savedMastered) {
                state.masteredWords = new Set(JSON.parse(savedMastered));
            }
        } catch (e) {
            console.warn("Could not load from localStorage", e);
        }
    }

    function saveStarred() {
        try {
            localStorage.setItem("boya_starred_words", JSON.stringify(Array.from(state.starredWords)));
            updateHeaderStats();
        } catch (e) {
            console.warn("Could not save starred to localStorage", e);
        }
    }

    function saveMastered() {
        try {
            localStorage.setItem("boya_mastered_words", JSON.stringify(Array.from(state.masteredWords)));
            updateHeaderStats();
        } catch (e) {
            console.warn("Could not save mastered to localStorage", e);
        }
    }

    // Text-to-Speech (TTS)
    let zhVoice = null;
    function initTTS() {
        if (!("speechSynthesis" in window)) return;
        function findZhVoice() {
            const voices = window.speechSynthesis.getVoices();
            zhVoice = voices.find(v => v.lang.startsWith("zh")) || null;
        }
        findZhVoice();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = findZhVoice;
        }
    }

    function speakChinese(text) {
        if (!("speechSynthesis" in window)) {
            showToast("Trình duyệt không hỗ trợ phát âm!");
            return;
        }
        window.speechSynthesis.cancel();
        // remove asterisks or notes
        const cleanText = text.replace(/[*#]/g, "").trim();
        const utter = new SpeechSynthesisUtterance(cleanText);
        utter.lang = "zh-CN";
        if (zhVoice) utter.voice = zhVoice;
        utter.rate = 0.85; // slightly slower for clear learning
        window.speechSynthesis.speak(utter);
    }

    // Toast helper
    function showToast(msg) {
        let toast = document.getElementById("app-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "app-toast";
            toast.className = "toast-msg";
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add("show");
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.classList.remove("show");
        }, 2200);
    }

    // Initialize Data
    function initData() {
        loadStorage();
        initTTS();

        if (window.BOYA_VOCAB_DATA && window.BOYA_VOCAB_DATA.books) {
            state.books = window.BOYA_VOCAB_DATA.books;
        } else {
            console.error("BOYA_VOCAB_DATA is not available!");
            return;
        }

        // Flatten all words
        state.allWords = [];
        state.books.forEach(book => {
            book.lessons.forEach(lesson => {
                lesson.words.forEach(w => {
                    state.allWords.push(w);
                });
            });
        });

        populateLessonFilter();
        populateTypeFilter();
        bindEvents();
        updateHeaderStats();
        renderCurrentMode();
    }

    // Header Stats
    function updateHeaderStats() {
        const totalElem = document.getElementById("stat-total-words");
        const starElem = document.getElementById("stat-starred-words");
        const filtered = getFilteredWords();

        if (totalElem) totalElem.textContent = `${filtered.length} từ`;
        if (starElem) starElem.textContent = `${state.starredWords.size} đã lưu`;
    }

    // Get Filtered Words
    function getFilteredWords() {
        let words = state.allWords;

        // Filter by book
        if (state.selectedBook !== "all") {
            words = words.filter(w => w.book_id === state.selectedBook);
        }

        // Filter by lesson
        if (state.selectedLesson !== "all") {
            words = words.filter(w => {
                const combinedId = `${w.book_id}_${w.lesson_num}`;
                return combinedId === state.selectedLesson || `bai${w.lesson_num}` === state.selectedLesson;
            });
        }

        // Filter by Starred
        if (state.starredOnly) {
            words = words.filter(w => state.starredWords.has(w.id));
        }

        // Filter by Type
        if (state.typeFilter !== "all") {
            if (state.typeFilter === "proper") {
                words = words.filter(w => w.is_proper || (w.type && w.type.includes("专名")));
            } else {
                words = words.filter(w => w.type && w.type.includes(state.typeFilter));
            }
        }

        // Filter by Search
        if (state.searchQuery) {
            const q = state.searchQuery.toLowerCase().trim();
            words = words.filter(w => 
                (w.hz && w.hz.toLowerCase().includes(q)) ||
                (w.py && w.py.toLowerCase().includes(q)) ||
                (w.mean && w.mean.toLowerCase().includes(q))
            );
        }

        return words;
    }

    // Populate Lesson Dropdown
    function populateLessonFilter() {
        const select = document.getElementById("select-lesson");
        if (!select) return;

        select.innerHTML = '<option value="all">Tất cả bài học</option>';

        let relevantBooks = state.books;
        if (state.selectedBook !== "all") {
            relevantBooks = state.books.filter(b => b.id === state.selectedBook);
        }

        relevantBooks.forEach(book => {
            const group = document.createElement("optgroup");
            group.label = book.name;
            book.lessons.forEach(l => {
                const opt = document.createElement("option");
                opt.value = `${book.id}_${l.lesson_num}`;
                opt.textContent = `${l.lesson_name}: ${l.title || ''} (${l.total_vocab} từ)`;
                group.appendChild(opt);
            });
            select.appendChild(group);
        });

        // Set value
        if (state.selectedLesson !== "all") {
            select.value = state.selectedLesson;
        } else {
            select.value = "all";
        }

        updateAudioBar();
    }

    // Populate Word Type Dropdown
    function populateTypeFilter() {
        const select = document.getElementById("select-type");
        if (!select) return;

        select.innerHTML = `
            <option value="all">Tất cả từ loại</option>
            <option value="名">【名】 Danh từ</option>
            <option value="动">【动】 Động từ</option>
            <option value="形">【形】 Tính từ</option>
            <option value="副">【副】 Phó từ</option>
            <option value="连">【连】 Liên từ</option>
            <option value="量">【量】 Lượng từ</option>
            <option value="介">【介】 Giới từ</option>
            <option value="代">【代】 Đại từ</option>
            <option value="助">【助】 Trợ từ</option>
            <option value="proper">【专名】 Tên riêng</option>
        `;
    }

    // Audio Bar Update
    function updateAudioBar() {
        const audioBar = document.getElementById("lesson-audio-bar");
        const audioElem = document.getElementById("lesson-audio-player");
        const audioLabel = document.getElementById("audio-lesson-title");
        if (!audioBar || !audioElem) return;

        // Only show if a single specific lesson is selected
        if (state.selectedLesson !== "all") {
            const [bookId, lessonNumStr] = state.selectedLesson.split("_");
            const lessonNum = parseInt(lessonNumStr, 10);
            const book = state.books.find(b => b.id === bookId);
            if (book) {
                const lesson = book.lessons.find(l => l.lesson_num === lessonNum);
                if (lesson && lesson.audio) {
                    audioElem.src = lesson.audio;
                    if (audioLabel) {
                        audioLabel.textContent = `🎧 Nghe Audio Từ Vựng: ${book.name} - ${lesson.lesson_name} (${lesson.title || ''})`;
                    }
                    audioBar.classList.add("show");
                    return;
                }
            }
        }
        audioBar.classList.remove("show");
        audioElem.pause();
    }

    // Bind Event Listeners
    function bindEvents() {
        // Book selector buttons
        document.querySelectorAll(".book-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".book-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                state.selectedBook = btn.dataset.book;
                state.selectedLesson = "all";
                populateLessonFilter();
                updateHeaderStats();
                renderCurrentMode();
            });
        });

        // Lesson selector
        const selectLesson = document.getElementById("select-lesson");
        if (selectLesson) {
            selectLesson.addEventListener("change", (e) => {
                state.selectedLesson = e.target.value;
                updateAudioBar();
                updateHeaderStats();
                renderCurrentMode();
            });
        }

        // Starred toggle filter
        const starToggleBtn = document.getElementById("btn-filter-starred");
        if (starToggleBtn) {
            starToggleBtn.addEventListener("click", () => {
                state.starredOnly = !state.starredOnly;
                starToggleBtn.classList.toggle("active", state.starredOnly);
                updateHeaderStats();
                renderCurrentMode();
            });
        }

        // Word type filter
        const selectType = document.getElementById("select-type");
        if (selectType) {
            selectType.addEventListener("change", (e) => {
                state.typeFilter = e.target.value;
                updateHeaderStats();
                renderCurrentMode();
            });
        }

        // Search box
        const searchInput = document.getElementById("vocab-search");
        if (searchInput) {
            let searchTimeout = null;
            searchInput.addEventListener("input", (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    state.searchQuery = e.target.value;
                    updateHeaderStats();
                    renderCurrentMode();
                }, 200);
            });
        }

        // Mode switch tabs
        document.querySelectorAll(".tab-btn").forEach(tab => {
            tab.addEventListener("click", () => {
                document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
                document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
                
                tab.classList.add("active");
                state.currentMode = tab.dataset.mode;
                const targetContent = document.getElementById(`mode-${state.currentMode}`);
                if (targetContent) targetContent.classList.add("active");

                renderCurrentMode();
            });
        });

        // Toggle Pinyin
        const togglePyBtn = document.getElementById("btn-toggle-pinyin");
        if (togglePyBtn) {
            togglePyBtn.addEventListener("click", () => {
                state.hidePinyin = !state.hidePinyin;
                togglePyBtn.classList.toggle("active", state.hidePinyin);
                const tableWrap = document.getElementById("table-wrapper");
                if (tableWrap) tableWrap.classList.toggle("hidden-pinyin", state.hidePinyin);
            });
        }

        // Toggle Meaning
        const toggleMeanBtn = document.getElementById("btn-toggle-mean");
        if (toggleMeanBtn) {
            toggleMeanBtn.addEventListener("click", () => {
                state.hideMean = !state.hideMean;
                toggleMeanBtn.classList.toggle("active", state.hideMean);
                const tableWrap = document.getElementById("table-wrapper");
                if (tableWrap) tableWrap.classList.toggle("hidden-mean", state.hideMean);
            });
        }

        // Keyboard listener for Flashcards
        window.addEventListener("keydown", handleKeydown);
    }

    function renderCurrentMode() {
        switch (state.currentMode) {
            case "table":
                renderTableMode();
                break;
            case "flashcard":
                setupFlashcardMode();
                break;
            case "quiz":
                setupQuizMode();
                break;
            case "match":
                setupMatchMode();
                break;
        }
    }

    // =========================================================================
    // MODE 1: VOCABULARY TABLE
    // =========================================================================
    function renderTableMode() {
        const tbody = document.getElementById("vocab-tbody");
        const countElem = document.getElementById("table-count-info");
        if (!tbody) return;

        const words = getFilteredWords();
        tbody.innerHTML = "";

        if (countElem) {
            countElem.textContent = `Đang hiển thị ${words.length} / ${state.allWords.length} từ vựng`;
        }

        if (words.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <div class="empty-icon">🔍</div>
                            <div class="empty-title">Không tìm thấy từ vựng nào</div>
                            <div class="empty-sub">Hãy thử đổi bộ lọc hoặc từ khóa tìm kiếm khác</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();

        words.forEach((w, index) => {
            const tr = document.createElement("tr");

            const isStarred = state.starredWords.has(w.id);
            const isProper = w.is_proper || (w.type && w.type.includes("专名"));

            // Examples HTML
            let examplesHtml = "";
            if (w.examples && w.examples.length > 0) {
                examplesHtml = `
                    <div class="mean-examples">
                        ${w.examples.map(ex => `
                            <div class="example-item">
                                <span>${escapeHtml(ex)}</span>
                                <button class="btn-mini-speak" title="Nghe ví dụ" data-speak="${encodeURIComponent(ex)}">🔊</button>
                            </div>
                        `).join("")}
                    </div>
                `;
            }

            tr.innerHTML = `
                <td class="col-stt">${index + 1}</td>
                <td class="col-star">
                    <button class="star-btn ${isStarred ? 'starred' : ''}" title="${isStarred ? 'Bỏ lưu' : 'Đánh dấu từ quan trọng'}" data-id="${w.id}">
                        ${isStarred ? '★' : '☆'}
                    </button>
                </td>
                <td class="col-hz">
                    <div class="hz-wrap">
                        <span>${escapeHtml(w.hz)}</span>
                        <button class="btn-speak" title="Nghe phát âm" data-hz="${escapeHtml(w.hz)}">🔊</button>
                    </div>
                </td>
                <td class="col-py">${escapeHtml(w.py)}</td>
                <td class="col-type">
                    <span class="type-badge ${isProper ? 'proper' : ''}">${escapeHtml(w.type || (isProper ? '【专名】' : ''))}</span>
                </td>
                <td class="col-mean">
                    <div>${escapeHtml(w.mean)}</div>
                    ${examplesHtml}
                </td>
                <td class="col-lesson">
                    ${escapeHtml(w.book_name)} - B.${w.lesson_num}
                </td>
            `;

            // Star click
            const starBtn = tr.querySelector(".star-btn");
            starBtn.addEventListener("click", () => {
                toggleStarWord(w.id, starBtn);
            });

            // Speak click
            const speakBtn = tr.querySelector(".btn-speak");
            speakBtn.addEventListener("click", () => {
                speakChinese(w.hz);
            });

            // Mini speak click for examples
            tr.querySelectorAll(".btn-mini-speak").forEach(miniBtn => {
                miniBtn.addEventListener("click", () => {
                    const textToSpeak = decodeURIComponent(miniBtn.dataset.speak);
                    speakChinese(textToSpeak);
                });
            });

            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
    }

    function toggleStarWord(wordId, buttonElem) {
        if (state.starredWords.has(wordId)) {
            state.starredWords.delete(wordId);
            if (buttonElem) {
                buttonElem.classList.remove("starred");
                buttonElem.textContent = "☆";
            }
            showToast("Đã bỏ đánh dấu từ");
        } else {
            state.starredWords.add(wordId);
            if (buttonElem) {
                buttonElem.classList.add("starred");
                buttonElem.textContent = "★";
            }
            showToast("Đã lưu vào danh sách từ quan trọng ★");
        }
        saveStarred();
    }

    // =========================================================================
    // MODE 2: FLASHCARDS 3D
    // =========================================================================
    function setupFlashcardMode() {
        const words = getFilteredWords();
        state.fcList = [...words];
        state.fcIndex = 0;
        state.fcFlipped = false;

        renderFlashcardUI();
    }

    function renderFlashcardUI() {
        const container = document.getElementById("flashcard-container");
        if (!container) return;

        if (state.fcList.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🗂️</div>
                    <div class="empty-title">Không có từ vựng nào trong danh sách hiện tại</div>
                    <div class="empty-sub">Hãy chọn quyển/bài học khác hoặc bỏ bộ lọc</div>
                </div>
            `;
            return;
        }

        // Current word
        const w = state.fcList[state.fcIndex];
        const isStarred = state.starredWords.has(w.id);
        const isMastered = state.masteredWords.has(w.id);
        const progressPercent = Math.round(((state.fcIndex + 1) / state.fcList.length) * 100);

        let examplesBackHtml = "";
        if (w.examples && w.examples.length > 0) {
            examplesBackHtml = `
                <div class="fc-examples">
                    <div style="font-weight:600; margin-bottom:4px; font-size:12px; color:#64748b;">VÍ DỤ TRONG BÀI:</div>
                    ${w.examples.map(ex => `<div>• ${escapeHtml(ex)}</div>`).join("")}
                </div>
            `;
        }

        container.innerHTML = `
            <div class="flashcard-wrapper">
                <div class="fc-meta">
                    <div><strong>${escapeHtml(w.book_name)}</strong> • Bài ${w.lesson_num}: ${escapeHtml(w.lesson_title || '')}</div>
                    <div>Thẻ <strong>${state.fcIndex + 1}</strong> / ${state.fcList.length} (${progressPercent}%)</div>
                </div>

                <div class="fc-progress-bar">
                    <div class="fc-progress-fill" style="width: ${progressPercent}%;"></div>
                </div>

                <div class="flashcard-scene" id="fc-scene">
                    <div class="flashcard ${state.fcFlipped ? 'flipped' : ''}" id="fc-card">
                        
                        <!-- MẶT TRƯỚC -->
                        <div class="flashcard-face flashcard-front">
                            <div class="card-top-info">
                                <span>Nhấn vào thẻ hoặc phím [Space] để lật</span>
                                <button class="star-btn ${isStarred ? 'starred' : ''}" id="fc-star-btn">
                                    ${isStarred ? '★' : '☆'}
                                </button>
                            </div>

                            <div class="card-center">
                                <div class="fc-hanzi">${escapeHtml(w.hz)}</div>
                                <button class="btn-speak" style="width:36px; height:36px; font-size:16px;" id="fc-front-speak" title="Nghe phát âm">🔊</button>
                                ${state.fcFlipped ? '' : '<div class="card-hint">Nhấp để xem Phiên âm & Nghĩa</div>'}
                            </div>

                            <div class="card-hint">
                                ${w.type ? `<span class="type-badge">${escapeHtml(w.type)}</span>` : ''}
                            </div>
                        </div>

                        <!-- MẶT SAU -->
                        <div class="flashcard-face flashcard-back">
                            <div class="card-top-info">
                                <span>${escapeHtml(w.book_name)} - Bài ${w.lesson_num}</span>
                                <button class="btn-speak" style="width:32px; height:32px; font-size:14px;" id="fc-back-speak" title="Nghe phát âm">🔊</button>
                            </div>

                            <div class="card-center">
                                <div style="font-size:32px; font-weight:700; color:#1e293b;">${escapeHtml(w.hz)}</div>
                                <div class="fc-pinyin">${escapeHtml(w.py)}</div>
                                ${w.type ? `<span class="fc-type">${escapeHtml(w.type)}</span>` : ''}
                                <div class="fc-mean">${escapeHtml(w.mean)}</div>
                                ${examplesBackHtml}
                            </div>

                            <div class="card-hint">Nhấp để lật lại mặt trước</div>
                        </div>

                    </div>
                </div>

                <!-- CONTROLS -->
                <div class="fc-controls">
                    <button class="fc-action-btn btn-prev" id="fc-btn-prev" ${state.fcIndex === 0 ? 'disabled' : ''}>
                        ◀ Trước
                    </button>

                    <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
                        <button class="fc-action-btn btn-hard" id="fc-btn-hard" title="Chưa nhớ (Ôn lại)">
                            ❌ Chưa nhớ
                        </button>
                        <button class="fc-action-btn" id="fc-btn-flip-action" style="background:#e0f2fe; color:#0284c7;" title="Lật mặt thẻ">
                            🔄 Lật thẻ
                        </button>
                        <button class="fc-action-btn btn-easy" id="fc-btn-easy" title="Đã thuộc">
                            ✅ Đã thuộc
                        </button>
                    </div>

                    <button class="fc-action-btn btn-next" id="fc-btn-next" ${state.fcIndex === state.fcList.length - 1 ? 'disabled' : ''}>
                        Tiếp ▶
                    </button>
                </div>

                <div class="fc-extra-actions">
                    <button class="btn-pill" id="fc-btn-shuffle">🔀 Xáo trộn thẻ</button>
                    <button class="btn-pill" id="fc-btn-reset">🔄 Về thẻ đầu tiên</button>
                </div>

                <div class="key-hints">
                    Phím tắt: <kbd>Space</kbd> Lật thẻ • <kbd>←</kbd> Thẻ trước • <kbd>→</kbd> Thẻ sau • <kbd>1</kbd> Chưa nhớ • <kbd>2</kbd> Đã thuộc
                </div>
            </div>
        `;

        // Card flip event
        const cardScene = document.getElementById("fc-scene");
        if (cardScene) {
            cardScene.addEventListener("click", (e) => {
                // Don't flip if clicking speaker or star
                if (e.target.closest(".btn-speak") || e.target.closest(".star-btn")) return;
                state.fcFlipped = !state.fcFlipped;
                const card = document.getElementById("fc-card");
                if (card) card.classList.toggle("flipped", state.fcFlipped);
            });
        }

        const flipActionBtn = document.getElementById("fc-btn-flip-action");
        if (flipActionBtn) {
            flipActionBtn.addEventListener("click", () => {
                state.fcFlipped = !state.fcFlipped;
                const card = document.getElementById("fc-card");
                if (card) card.classList.toggle("flipped", state.fcFlipped);
            });
        }

        // Speakers
        const frontSpeak = document.getElementById("fc-front-speak");
        if (frontSpeak) frontSpeak.addEventListener("click", () => speakChinese(w.hz));
        const backSpeak = document.getElementById("fc-back-speak");
        if (backSpeak) backSpeak.addEventListener("click", () => speakChinese(w.hz));

        // Star
        const fcStarBtn = document.getElementById("fc-star-btn");
        if (fcStarBtn) {
            fcStarBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleStarWord(w.id, fcStarBtn);
            });
        }

        // Prev & Next
        const btnPrev = document.getElementById("fc-btn-prev");
        if (btnPrev) btnPrev.addEventListener("click", () => moveFlashcard(-1));
        const btnNext = document.getElementById("fc-btn-next");
        if (btnNext) btnNext.addEventListener("click", () => moveFlashcard(1));

        // Hard & Easy
        const btnHard = document.getElementById("fc-btn-hard");
        if (btnHard) {
            btnHard.addEventListener("click", () => {
                state.masteredWords.delete(w.id);
                saveMastered();
                showToast("Đã ghi nhận: Cần ôn lại từ này");
                moveFlashcard(1);
            });
        }

        const btnEasy = document.getElementById("fc-btn-easy");
        if (btnEasy) {
            btnEasy.addEventListener("click", () => {
                state.masteredWords.add(w.id);
                saveMastered();
                showToast("Xuất sắc! Đã thuộc từ này 🎉");
                moveFlashcard(1);
            });
        }

        // Shuffle
        const btnShuffle = document.getElementById("fc-btn-shuffle");
        if (btnShuffle) {
            btnShuffle.addEventListener("click", () => {
                shuffleArray(state.fcList);
                state.fcIndex = 0;
                state.fcFlipped = false;
                renderFlashcardUI();
                showToast("Đã xáo trộn thứ tự các thẻ!");
            });
        }

        // Reset
        const btnReset = document.getElementById("fc-btn-reset");
        if (btnReset) {
            btnReset.addEventListener("click", () => {
                state.fcIndex = 0;
                state.fcFlipped = false;
                renderFlashcardUI();
            });
        }
    }

    function moveFlashcard(delta) {
        const nextIdx = state.fcIndex + delta;
        if (nextIdx >= 0 && nextIdx < state.fcList.length) {
            state.fcIndex = nextIdx;
            state.fcFlipped = false;
            renderFlashcardUI();
        }
    }

    function handleKeydown(e) {
        if (state.currentMode !== "flashcard") return;
        // Don't trigger if user is typing in search box
        if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

        if (e.code === "Space") {
            e.preventDefault();
            state.fcFlipped = !state.fcFlipped;
            const card = document.getElementById("fc-card");
            if (card) card.classList.toggle("flipped", state.fcFlipped);
        } else if (e.code === "ArrowRight") {
            e.preventDefault();
            moveFlashcard(1);
        } else if (e.code === "ArrowLeft") {
            e.preventDefault();
            moveFlashcard(-1);
        } else if (e.key === "1") {
            const btnHard = document.getElementById("fc-btn-hard");
            if (btnHard) btnHard.click();
        } else if (e.key === "2") {
            const btnEasy = document.getElementById("fc-btn-easy");
            if (btnEasy) btnEasy.click();
        }
    }

    // =========================================================================
    // MODE 3: TRẮC NGHIỆM (QUIZ)
    // =========================================================================
    function setupQuizMode() {
        const container = document.getElementById("quiz-container");
        if (!container) return;

        const words = getFilteredWords();
        if (words.length < 4) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-title">Cần tối thiểu 4 từ vựng để tạo bài trắc nghiệm</div>
                    <div class="empty-sub">Hãy chọn phạm vi bài học rộng hơn để bắt đầu</div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="quiz-wrapper">
                <div class="quiz-setup-card" id="quiz-setup-view">
                    <h2>🎯 Luyện Tập Trắc Nghiệm Phản Xạ</h2>
                    <p>Ngân hàng câu hỏi hiện tại: <strong>${words.length} từ vựng</strong> đang chọn</p>

                    <div class="quiz-options-grid">
                        <div class="quiz-opt-box">
                            <label for="quiz-count-select">Số lượng câu hỏi:</label>
                            <select id="quiz-count-select" class="custom-select">
                                <option value="10">10 câu</option>
                                <option value="20" selected>20 câu</option>
                                <option value="30">30 câu</option>
                                <option value="all">Tất cả (${words.length} câu)</option>
                            </select>
                        </div>

                        <div class="quiz-opt-box">
                            <label for="quiz-mode-select">Dạng bài thi:</label>
                            <select id="quiz-mode-select" class="custom-select">
                                <option value="mix_no_audio" selected>📖 Hỗn hợp Đọc & Nghĩa (Không nghe âm thanh)</option>
                                <option value="mix">🔀 Hỗn hợp toàn diện (Bao gồm nghe âm thanh)</option>
                                <option value="hz_to_mean">🀄 Nhìn Chữ Hán -> Chọn Nghĩa</option>
                                <option value="mean_to_hz">🇻🇳 Nhìn Nghĩa -> Chọn Chữ Hán</option>
                                <option value="audio_to_hz">🎧 Nghe Âm Thanh -> Chọn Chữ Hán</option>
                            </select>
                        </div>
                    </div>

                    <button class="btn-start-quiz" id="btn-start-quiz">Bắt Đầu Làm Bài</button>
                </div>

                <div class="quiz-play-card" id="quiz-play-view"></div>
                <div class="quiz-result-card" id="quiz-result-view"></div>
            </div>
        `;

        const startBtn = document.getElementById("btn-start-quiz");
        if (startBtn) {
            startBtn.addEventListener("click", () => {
                const countVal = document.getElementById("quiz-count-select").value;
                const modeVal = document.getElementById("quiz-mode-select").value;
                startQuizSession(countVal, modeVal);
            });
        }
    }

    function startQuizSession(countVal, modeVal) {
        const pool = [...getFilteredWords()];
        shuffleArray(pool);

        let totalQ = countVal === "all" ? pool.length : Math.min(parseInt(countVal, 10), pool.length);
        const selectedWords = pool.slice(0, totalQ);

        // Generate questions
        state.quizQuestions = selectedWords.map(targetWord => {
            // Determine question type
            let qType = modeVal;
            if (modeVal === "mix") {
                const types = ["hz_to_mean", "mean_to_hz", "audio_to_hz"];
                qType = types[Math.floor(Math.random() * types.length)];
            } else if (modeVal === "mix_no_audio") {
                const types = ["hz_to_mean", "mean_to_hz"];
                qType = types[Math.floor(Math.random() * types.length)];
            }

            // Pick 3 distractors from allWords
            const distractors = [];
            const otherWords = state.allWords.filter(w => w.id !== targetWord.id && w.mean !== targetWord.mean && w.hz !== targetWord.hz);
            shuffleArray(otherWords);

            for (let i = 0; i < otherWords.length && distractors.length < 3; i++) {
                distractors.push(otherWords[i]);
            }

            // Create options
            const options = [targetWord, ...distractors];
            shuffleArray(options);

            return {
                word: targetWord,
                type: qType,
                options: options,
                correctWord: targetWord
            };
        });

        state.quizCurrentIdx = 0;
        state.quizScore = 0;
        state.quizIncorrect = [];
        state.quizAnswered = false;

        document.getElementById("quiz-setup-view").style.display = "none";
        document.getElementById("quiz-result-view").style.display = "none";
        document.getElementById("quiz-play-view").style.display = "block";

        renderQuizQuestion();
    }

    function renderQuizQuestion() {
        const playView = document.getElementById("quiz-play-view");
        if (!playView) return;

        state.quizAnswered = false;
        const q = state.quizQuestions[state.quizCurrentIdx];
        const total = state.quizQuestions.length;
        const currentNum = state.quizCurrentIdx + 1;
        const progressPercent = Math.round((currentNum / total) * 100);

        let promptHtml = "";
        let promptLabel = "";
        let audioPlayBtn = "";

        if (q.type === "hz_to_mean") {
            promptLabel = "Chọn nghĩa tiếng Việt đúng cho từ:";
            promptHtml = `<div class="quiz-q-prompt">${escapeHtml(q.word.hz)}</div>
                          <div class="quiz-q-sub">${escapeHtml(q.word.py)}</div>`;
        } else if (q.type === "mean_to_hz") {
            promptLabel = "Chọn Chữ Hán tương ứng với nghĩa:";
            promptHtml = `<div class="quiz-q-prompt mean-prompt">${escapeHtml(q.word.mean)}</div>
                          <div class="quiz-q-sub" style="font-size:14px; color:#64748b;">${q.word.type ? escapeHtml(q.word.type) : ''}</div>`;
        } else if (q.type === "audio_to_hz") {
            promptLabel = "Nghe âm thanh và chọn Chữ Hán đúng:";
            promptHtml = `
                <div style="margin: 15px 0;">
                    <button class="btn-speak" style="width:68px; height:68px; font-size:30px;" id="btn-quiz-audio" title="Bấm để nghe lại">🔊</button>
                </div>
                <div class="quiz-q-sub">Nhấn loa để nghe lại</div>
            `;
            // auto play audio once
            setTimeout(() => speakChinese(q.word.hz), 250);
        }

        const letters = ["A", "B", "C", "D"];

        playView.innerHTML = `
            <div class="quiz-header">
                <div>Câu hỏi <strong>${currentNum}</strong> / ${total}</div>
                <div>Điểm số: <strong style="color:var(--primary);">${state.quizScore}</strong></div>
            </div>

            <div class="quiz-progress-bar">
                <div class="quiz-progress-fill" style="width: ${progressPercent}%;"></div>
            </div>

            <div class="quiz-question-box">
                <div class="quiz-q-label">${promptLabel}</div>
                ${promptHtml}
            </div>

            <div class="quiz-answers-grid">
                ${q.options.map((opt, i) => {
                    let contentHtml = "";
                    if (q.type === "hz_to_mean") {
                        contentHtml = `<span class="ans-mean">${escapeHtml(opt.mean)}</span>`;
                    } else {
                        contentHtml = `
                            <div class="ans-hz-wrap">
                                <span class="ans-hz">${escapeHtml(opt.hz)}</span>
                                <span class="ans-py">${escapeHtml(opt.py)}</span>
                            </div>
                        `;
                    }
                    return `
                        <button class="ans-btn ${q.type !== 'hz_to_mean' ? 'ans-btn-hz' : ''}" data-id="${opt.id}" data-idx="${i}">
                            <span class="ans-letter">${letters[i]}</span>
                            <div class="ans-content">
                                ${contentHtml}
                            </div>
                        </button>
                    `;
                }).join("")}
            </div>

            <div class="quiz-feedback" id="quiz-feedback-box"></div>

            <div class="quiz-footer">
                <button class="btn-next-q" id="btn-quiz-next">
                    ${currentNum === total ? 'Xem Kết Quả' : 'Câu Tiếp Theo ▶'}
                </button>
            </div>
        `;

        // Audio play button if audio type
        const audioBtn = document.getElementById("btn-quiz-audio");
        if (audioBtn) {
            audioBtn.addEventListener("click", () => speakChinese(q.word.hz));
        }

        // Answer click
        playView.querySelectorAll(".ans-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                if (state.quizAnswered) return;
                handleAnswerSelection(btn, q);
            });
        });

        // Next button
        const nextBtn = document.getElementById("btn-quiz-next");
        if (nextBtn) {
            nextBtn.addEventListener("click", () => {
                state.quizCurrentIdx++;
                if (state.quizCurrentIdx < state.quizQuestions.length) {
                    renderQuizQuestion();
                } else {
                    renderQuizResults();
                }
            });
        }
    }

    function handleAnswerSelection(selectedBtn, question) {
        state.quizAnswered = true;
        const selectedId = selectedBtn.dataset.id;
        const isCorrect = (selectedId === question.correctWord.id);
        const playView = document.getElementById("quiz-play-view");
        const feedbackBox = document.getElementById("quiz-feedback-box");
        const nextBtn = document.getElementById("btn-quiz-next");

        // Speak word
        speakChinese(question.correctWord.hz);

        // Highlight answers
        playView.querySelectorAll(".ans-btn").forEach(btn => {
            btn.disabled = true;
            if (btn.dataset.id === question.correctWord.id) {
                btn.classList.add("correct");
            } else if (btn === selectedBtn && !isCorrect) {
                btn.classList.add("wrong");
            }
        });

        if (isCorrect) {
            state.quizScore++;
            feedbackBox.className = "quiz-feedback show correct";
            feedbackBox.innerHTML = `
                🎉 <strong>Chính xác!</strong> 
                <strong>${escapeHtml(question.correctWord.hz)}</strong> [${escapeHtml(question.correctWord.py)}]: ${escapeHtml(question.correctWord.mean)}
            `;
        } else {
            state.quizIncorrect.push(question.correctWord);
            feedbackBox.className = "quiz-feedback show wrong";
            feedbackBox.innerHTML = `
                ❌ <strong>Chưa chính xác!</strong> Đáp án đúng là: 
                <strong>${escapeHtml(question.correctWord.hz)}</strong> [${escapeHtml(question.correctWord.py)}]: ${escapeHtml(question.correctWord.mean)}
            `;
        }

        nextBtn.classList.add("show");
    }

    function renderQuizResults() {
        document.getElementById("quiz-play-view").style.display = "none";
        const resultView = document.getElementById("quiz-result-view");
        resultView.style.display = "block";

        const total = state.quizQuestions.length;
        const score = state.quizScore;
        const percent = Math.round((score / total) * 100);

        let badge = "🎉";
        let title = "Làm Tốt Lắm!";
        if (percent === 100) {
            badge = "🏆";
            title = "Hoàn Hảo! Điểm Tuyệt Đối!";
        } else if (percent >= 80) {
            badge = "🌟";
            title = "Xuất Sắc! Bạn Nhớ Rất Tốt!";
        } else if (percent < 50) {
            badge = "💪";
            title = "Cần Cố Gắng Thêm Nhé!";
        }

        let incorrectHtml = "";
        if (state.quizIncorrect.length > 0) {
            incorrectHtml = `
                <div style="text-align: left; margin-top: 25px; padding: 20px; background: #fff5f5; border-radius: 12px; border: 1px solid #fed7d7;">
                    <h3 style="font-size: 15px; color: #c53030; margin-bottom: 12px;">Các từ cần ôn lại (${state.quizIncorrect.length} từ):</h3>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${state.quizIncorrect.map(w => `
                            <div style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 8px 12px; border-radius: 8px; border: 1px solid #feb2b2;">
                                <div>
                                    <strong style="font-size: 16px;">${escapeHtml(w.hz)}</strong> 
                                    <span style="color: #e67e22; font-size: 13px;">${escapeHtml(w.py)}</span>: 
                                    <span style="color: #4a5568; font-size: 13px;">${escapeHtml(w.mean)}</span>
                                </div>
                                <button class="btn-speak quiz-inc-speak" data-speak="${encodeURIComponent(w.hz)}" title="Nghe phát âm">🔊</button>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
        }

        resultView.innerHTML = `
            <div class="result-badge">${badge}</div>
            <h2>${title}</h2>
            <p style="color: var(--text-muted); font-size: 14px;">Bạn đã hoàn thành bài kiểm tra trắc nghiệm</p>

            <div class="quiz-score-circle" style="--percent: ${percent};">
                <span class="score-num">${score}/${total}</span>
                <span class="score-label">${percent}% Đúng</span>
            </div>

            ${incorrectHtml}

            <div class="result-actions">
                <button class="btn-pill" id="btn-quiz-retry">🔄 Làm Lại Bài Này</button>
                ${state.quizIncorrect.length > 0 ? `<button class="btn-pill" id="btn-quiz-review-wrong" style="background:#fee2e2; color:#dc2626; border-color:#fca5a5;">⚠️ Chỉ Ôn Lại Các Câu Sai</button>` : ''}
                <button class="btn-pill" id="btn-quiz-new-config">⚙️ Cài Đặt Mới</button>
            </div>
        `;

        resultView.querySelectorAll(".quiz-inc-speak").forEach(spkBtn => {
            spkBtn.addEventListener("click", () => {
                const txt = decodeURIComponent(spkBtn.dataset.speak);
                speakChinese(txt);
            });
        });

        document.getElementById("btn-quiz-retry").addEventListener("click", () => {
            const countVal = document.getElementById("quiz-count-select") ? document.getElementById("quiz-count-select").value : "20";
            const modeVal = document.getElementById("quiz-mode-select") ? document.getElementById("quiz-mode-select").value : "mix";
            startQuizSession(countVal, modeVal);
        });

        const reviewWrongBtn = document.getElementById("btn-quiz-review-wrong");
        if (reviewWrongBtn) {
            reviewWrongBtn.addEventListener("click", () => {
                // temporarily filter to incorrect words
                state.quizQuestions = state.quizIncorrect.map(targetWord => {
                    const distractors = [];
                    const otherWords = state.allWords.filter(w => w.id !== targetWord.id && w.mean !== targetWord.mean);
                    shuffleArray(otherWords);
                    for (let i = 0; i < otherWords.length && distractors.length < 3; i++) {
                        distractors.push(otherWords[i]);
                    }
                    const options = [targetWord, ...distractors];
                    shuffleArray(options);
                    return {
                        word: targetWord,
                        type: "hz_to_mean",
                        options: options,
                        correctWord: targetWord
                    };
                });
                state.quizCurrentIdx = 0;
                state.quizScore = 0;
                state.quizIncorrect = [];
                state.quizAnswered = false;
                document.getElementById("quiz-result-view").style.display = "none";
                document.getElementById("quiz-play-view").style.display = "block";
                renderQuizQuestion();
            });
        }

        document.getElementById("btn-quiz-new-config").addEventListener("click", () => {
            setupQuizMode();
        });
    }

    // =========================================================================
    // MODE 4: MATCHING GAME (GHÉP TỪ)
    // =========================================================================
    function setupMatchMode() {
        const container = document.getElementById("match-container");
        if (!container) return;

        const words = getFilteredWords();
        if (words.length < 6) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🧩</div>
                    <div class="empty-title">Cần tối thiểu 6 từ vựng để chơi trò chơi ghép thẻ</div>
                    <div class="empty-sub">Hãy chọn phạm vi bài học rộng hơn để bắt đầu</div>
                </div>
            `;
            return;
        }

        // Pick 8 words (or min 6)
        const pairCount = Math.min(8, words.length);
        const pool = [...words];
        shuffleArray(pool);
        const selectedPairs = pool.slice(0, pairCount);

        // Generate tiles
        const tiles = [];
        selectedPairs.forEach(w => {
            // Hanzi tile
            tiles.push({
                id: `hz_${w.id}`,
                wordId: w.id,
                type: "hz",
                text: w.hz,
                subText: w.py,
                speakText: w.hz
            });
            // Meaning tile
            tiles.push({
                id: `mean_${w.id}`,
                wordId: w.id,
                type: "mean",
                text: w.mean,
                subText: "",
                speakText: w.hz
            });
        });

        shuffleArray(tiles);
        state.gameTiles = tiles;
        state.gameSelectedTile = null;
        state.gameMatchedCount = 0;
        state.gameSeconds = 0;

        clearInterval(state.gameTimer);
        state.gameTimer = setInterval(() => {
            state.gameSeconds++;
            const timerElem = document.getElementById("game-timer-display");
            if (timerElem) {
                const mins = String(Math.floor(state.gameSeconds / 60)).padStart(2, "0");
                const secs = String(state.gameSeconds % 60).padStart(2, "0");
                timerElem.textContent = `${mins}:${secs}`;
            }
        }, 1000);

        container.innerHTML = `
            <div class="game-wrapper">
                <div class="game-header">
                    <div class="game-stat">Ghép đúng: <strong id="game-matched-display" style="color:var(--success);">0 / ${pairCount}</strong> cặp</div>
                    <div class="game-stat">Thời gian: <strong id="game-timer-display">00:00</strong></div>
                    <button class="btn-pill" id="btn-restart-game">🔄 Chơi ván mới</button>
                </div>

                <div class="match-grid" id="match-grid">
                    ${tiles.map(tile => `
                        <div class="match-tile" data-tile-id="${tile.id}" data-word-id="${tile.wordId}" data-type="${tile.type}">
                            ${tile.type === 'hz' 
                                ? `<div class="tile-hz">${escapeHtml(tile.text)}</div><div style="font-size:12px; color:#e67e22; margin-top:4px;">${escapeHtml(tile.subText)}</div>`
                                : `<div class="tile-mean">${escapeHtml(tile.text)}</div>`
                            }
                        </div>
                    `).join("")}
                </div>
            </div>
        `;

        document.getElementById("btn-restart-game").addEventListener("click", () => {
            setupMatchMode();
        });

        // Tile clicks
        const grid = document.getElementById("match-grid");
        grid.querySelectorAll(".match-tile").forEach(tileElem => {
            tileElem.addEventListener("click", () => {
                handleTileClick(tileElem, pairCount);
            });
        });
    }

    function handleTileClick(tileElem, totalPairs) {
        if (tileElem.classList.contains("matched") || tileElem.classList.contains("selected")) return;

        const tileId = tileElem.dataset.tileId;
        const wordId = tileElem.dataset.wordId;
        const tileType = tileElem.dataset.type;

        // If no first tile selected
        if (!state.gameSelectedTile) {
            state.gameSelectedTile = { elem: tileElem, wordId, tileType, tileId };
            tileElem.classList.add("selected");
            return;
        }

        // If same tile or same type (e.g. two hanzi) clicked, swap selection
        if (state.gameSelectedTile.tileType === tileType) {
            state.gameSelectedTile.elem.classList.remove("selected");
            state.gameSelectedTile = { elem: tileElem, wordId, tileType, tileId };
            tileElem.classList.add("selected");
            return;
        }

        // Two different types selected -> Check Match!
        const first = state.gameSelectedTile;
        tileElem.classList.add("selected");

        if (first.wordId === wordId) {
            // MATCH!
            const matchedWord = state.allWords.find(w => w.id === wordId);
            if (matchedWord) speakChinese(matchedWord.hz);

            setTimeout(() => {
                first.elem.classList.remove("selected");
                tileElem.classList.remove("selected");
                first.elem.classList.add("matched");
                tileElem.classList.add("matched");

                state.gameMatchedCount++;
                const countElem = document.getElementById("game-matched-display");
                if (countElem) countElem.textContent = `${state.gameMatchedCount} / ${totalPairs}`;

                state.gameSelectedTile = null;

                // Win check
                if (state.gameMatchedCount === totalPairs) {
                    clearInterval(state.gameTimer);
                    const mins = String(Math.floor(state.gameSeconds / 60)).padStart(2, "0");
                    const secs = String(state.gameSeconds % 60).padStart(2, "0");
                    showToast(`🎉 Xuất sắc! Hoàn thành trong ${mins}:${secs}!`);
                }
            }, 300);
        } else {
            // WRONG!
            setTimeout(() => {
                first.elem.classList.add("wrong");
                tileElem.classList.add("wrong");

                setTimeout(() => {
                    first.elem.classList.remove("selected", "wrong");
                    tileElem.classList.remove("selected", "wrong");
                    state.gameSelectedTile = null;
                }, 400);
            }, 200);
        }
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function escapeHtml(str) {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Global helper for inline onclick handlers
    window.boyaApp = {
        speak: speakChinese
    };

    // Auto-init on DOM ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initData);
    } else {
        initData();
    }
})();
