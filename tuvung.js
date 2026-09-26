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
        currentMode: "table", // 'table' | 'flashcard' | 'quiz' | 'games'
        activeGame: null,     // null | 'match' | 'tf' | 'scramble' | 'hunter'
        
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

    // Web Audio API Synthesizer for Game Sound FX
    const soundFX = {
        ctx: null,
        enabled: true,
        init() {
            if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioCtx();
            }
            if (this.ctx && this.ctx.state === "suspended") {
                this.ctx.resume();
            }
        },
        playTone(freq, type, duration, startTime = 0) {
            if (!this.enabled) return;
            try {
                this.init();
                if (!this.ctx) return;
                const t = this.ctx.currentTime + startTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, t);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(t);
                osc.stop(t + duration);
            } catch (e) {}
        },
        correct() {
            this.playTone(523.25, "sine", 0.1, 0);
            this.playTone(659.25, "sine", 0.1, 0.08);
            this.playTone(783.99, "sine", 0.22, 0.16);
        },
        wrong() {
            if (!this.enabled) return;
            try {
                this.init();
                if (!this.ctx) return;
                const t = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(160, t);
                osc.frequency.linearRampToValueAtTime(110, t + 0.22);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(t);
                osc.stop(t + 0.22);
            } catch (e) {}
        },
        tick() {
            this.playTone(800, "triangle", 0.03, 0);
        },
        fanfare() {
            const notes = [
                { f: 523.25, d: 0.12, t: 0 },
                { f: 659.25, d: 0.12, t: 0.11 },
                { f: 783.99, d: 0.12, t: 0.22 },
                { f: 1046.50, d: 0.35, t: 0.33 }
            ];
            notes.forEach(n => this.playTone(n.f, "triangle", n.d, n.t));
        }
    };

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
        if (typeof audioElem.pause === "function") {
            audioElem.pause();
        }
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

        // Sound Toggle
        const soundBtn = document.getElementById("btn-toggle-sound");
        if (soundBtn) {
            soundBtn.addEventListener("click", () => {
                soundFX.enabled = !soundFX.enabled;
                soundBtn.textContent = soundFX.enabled ? "🔊 Âm thanh" : "🔇 Tắt tiếng";
                soundBtn.style.opacity = soundFX.enabled ? "1" : "0.7";
                showToast(soundFX.enabled ? "Đã bật hiệu ứng âm thanh 🔊" : "Đã tắt hiệu ứng âm thanh 🔇");
            });
        }

        // Keyboard listener for Flashcards & Speed True/False
        window.addEventListener("keydown", handleKeydown);
    }

    function renderCurrentMode() {
        clearGameTimers();
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
            case "games":
            case "match":
                setupGameZone();
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
        // Don't trigger if user is typing in input or select
        if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

        if (state.currentMode === "flashcard") {
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
        } else if (state.currentMode === "games" && state.activeGame === "tf") {
            if (e.code === "ArrowLeft") {
                e.preventDefault();
                const btnTrue = document.getElementById("btn-tf-true");
                if (btnTrue && !btnTrue.disabled) btnTrue.click();
            } else if (e.code === "ArrowRight") {
                e.preventDefault();
                const btnFalse = document.getElementById("btn-tf-false");
                if (btnFalse && !btnFalse.disabled) btnFalse.click();
            }
        } else if (state.currentMode === "quiz") {
            if (["1", "2", "3", "4"].includes(e.key)) {
                const idx = parseInt(e.key, 10) - 1;
                const btns = document.querySelectorAll("#quiz-play-view .ans-btn");
                if (btns[idx] && !btns[idx].disabled) btns[idx].click();
            } else if (["a", "b", "c", "d", "A", "B", "C", "D"].includes(e.key)) {
                const map = { a: 0, b: 1, c: 2, d: 3, A: 0, B: 1, C: 2, D: 3 };
                const idx = map[e.key];
                const btns = document.querySelectorAll("#quiz-play-view .ans-btn");
                if (btns[idx] && !btns[idx].disabled) btns[idx].click();
            } else if (e.code === "Space" || e.code === "Enter") {
                const nextBtn = document.getElementById("btn-quiz-next");
                if (nextBtn && nextBtn.classList.contains("show")) {
                    e.preventDefault();
                    nextBtn.click();
                }
            }
        }
    }

    // =========================================================================
    // MODE 3: TRẮC NGHIỆM (QUIZ)
    // =========================================================================
    function generatePinyinDistractors(targetPy, pool) {
        if (!targetPy) return [];

        const TONE_REPLACEMENTS = {
            'ā': ['á', 'ǎ', 'à'], 'á': ['ā', 'ǎ', 'à'], 'ǎ': ['ā', 'á', 'à'], 'à': ['ā', 'á', 'ǎ'],
            'ē': ['é', 'ě', 'è'], 'é': ['ē', 'ě', 'è'], 'ě': ['ē', 'é', 'è'], 'è': ['ē', 'é', 'ě'],
            'ī': ['í', 'ǐ', 'ì'], 'í': ['ī', 'ǐ', 'ì'], 'ǐ': ['ī', 'í', 'ì'], 'ì': ['ī', 'í', 'ǐ'],
            'ō': ['ó', 'ǒ', 'ò'], 'ó': ['ō', 'ǒ', 'ò'], 'ǒ': ['ō', 'ó', 'ò'], 'ò': ['ō', 'ó', 'ǒ'],
            'ū': ['ú', 'ǔ', 'ù'], 'ú': ['ū', 'ǔ', 'ù'], 'ǔ': ['ū', 'ú', 'ù'], 'ù': ['ū', 'ú', 'ǔ'],
            'ǖ': ['ǘ', 'ǚ', 'ǜ'], 'ǘ': ['ǖ', 'ǚ', 'ǜ'], 'ǚ': ['ǖ', 'ǘ', 'ǜ'], 'ǜ': ['ǖ', 'ǘ', 'ǚ']
        };

        const CONFUSING_PAIRS = [
            { from: /zh/g, to: 'z' }, { from: /(^|[^zcs])z(?!h)/g, to: '$1zh' },
            { from: /ch/g, to: 'c' }, { from: /(^|[^zcs])c(?!h)/g, to: '$1ch' },
            { from: /sh/g, to: 's' }, { from: /(^|[^zcs])s(?!h)/g, to: '$1sh' },
            { from: /ing/g, to: 'in' }, { from: /in(?![g])/g, to: 'ing' },
            { from: /eng/g, to: 'en' }, { from: /en(?![g])/g, to: 'eng' },
            { from: /ang/g, to: 'an' }, { from: /an(?![g])/g, to: 'ang' }
        ];

        const candidates = new Set();
        const occurrences = [];
        for (let i = 0; i < targetPy.length; i++) {
            if (TONE_REPLACEMENTS[targetPy[i]]) {
                occurrences.push({ index: i, char: targetPy[i] });
            }
        }

        // Alter single tone
        occurrences.forEach(occ => {
            const repls = TONE_REPLACEMENTS[occ.char];
            repls.forEach(r => {
                const variant = targetPy.substring(0, occ.index) + r + targetPy.substring(occ.index + 1);
                if (variant !== targetPy) candidates.add(variant);
            });
        });

        // Alter multiple tones if 2 or more syllables
        if (occurrences.length >= 2) {
            const occ1 = occurrences[0];
            const occ2 = occurrences[1];
            TONE_REPLACEMENTS[occ1.char].forEach(r1 => {
                TONE_REPLACEMENTS[occ2.char].forEach(r2 => {
                    let v = targetPy.substring(0, occ1.index) + r1 + targetPy.substring(occ1.index + 1);
                    v = v.substring(0, occ2.index) + r2 + v.substring(occ2.index + 1);
                    if (v !== targetPy) candidates.add(v);
                });
            });
        }

        // Confusing initial/final swaps (zh/ch/sh vs z/c/s, in/ing, en/eng)
        CONFUSING_PAIRS.forEach(pair => {
            if (pair.from.test(targetPy)) {
                const variant = targetPy.replace(pair.from, pair.to);
                if (variant !== targetPy) candidates.add(variant);
            }
        });

        // Combine swaps with tone shift
        const swapList = [...candidates];
        swapList.forEach(sv => {
            for (let i = 0; i < sv.length; i++) {
                if (TONE_REPLACEMENTS[sv[i]]) {
                    TONE_REPLACEMENTS[sv[i]].forEach(r => {
                        const v = sv.substring(0, i) + r + sv.substring(i + 1);
                        if (v !== targetPy) candidates.add(v);
                    });
                }
            }
        });

        // Fallback: Pick from other words in pool
        if (candidates.size < 3 && pool && pool.length > 0) {
            const otherPys = pool
                .filter(w => w.py && w.py !== targetPy)
                .map(w => w.py);
            shuffleArray(otherPys);
            otherPys.forEach(py => {
                if (candidates.size < 6 && py !== targetPy) {
                    candidates.add(py);
                }
            });
        }

        const candidateList = [...candidates].filter(c => c !== targetPy);
        shuffleArray(candidateList);
        return candidateList.slice(0, 3);
    }

    function buildQuizQuestion(targetWord, qType, pool) {
        if (qType === "hz_to_py") {
            const distractorsPy = generatePinyinDistractors(targetWord.py, pool);
            const options = [
                { id: targetWord.id, py: targetWord.py, hz: targetWord.hz, mean: targetWord.mean },
                { id: "distractor_0_" + Math.random(), py: distractorsPy[0] || "pīnyīn", hz: targetWord.hz, mean: targetWord.mean },
                { id: "distractor_1_" + Math.random(), py: distractorsPy[1] || "pínyīn", hz: targetWord.hz, mean: targetWord.mean },
                { id: "distractor_2_" + Math.random(), py: distractorsPy[2] || "pǐnyīn", hz: targetWord.hz, mean: targetWord.mean }
            ];
            shuffleArray(options);
            return {
                word: targetWord,
                type: qType,
                options: options,
                correctWord: targetWord
            };
        }

        const distractors = [];
        const otherWords = state.allWords.filter(w => w.id !== targetWord.id && w.mean !== targetWord.mean && w.hz !== targetWord.hz);
        shuffleArray(otherWords);

        for (let i = 0; i < otherWords.length && distractors.length < 3; i++) {
            distractors.push(otherWords[i]);
        }

        const options = [targetWord, ...distractors];
        shuffleArray(options);

        return {
            word: targetWord,
            type: qType,
            options: options,
            correctWord: targetWord
        };
    }

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
                                <option value="mix_no_audio" selected>📖 Hỗn hợp Đọc & Nghĩa (Không audio)</option>
                                <option value="mix">🔀 Hỗn hợp toàn diện (Đọc, Nghĩa, Pinyin & Audio)</option>
                                <option value="hz_to_mean">🀄 Nhìn Chữ Hán -> Chọn Nghĩa Tiếng Việt</option>
                                <option value="mean_to_hz">🇻🇳 Nhìn Nghĩa -> Chọn Chữ Hán</option>
                                <option value="hz_to_py">🔤 Nhìn Chữ Hán -> Chọn Pinyin & Thanh điệu</option>
                                <option value="audio_to_hz">🎧 Nghe Âm Thanh -> Chọn Chữ Hán</option>
                            </select>
                        </div>
                    </div>

                    <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
                        💡 <em>Mẹo phản xạ: Dùng phím số <strong>1, 2, 3, 4</strong> hoặc phím chữ <strong>A, B, C, D</strong> để chọn đáp án và phím <strong>Space/Enter</strong> để chuyển câu nhanh!</em>
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
                const types = ["hz_to_mean", "mean_to_hz", "hz_to_py", "audio_to_hz"];
                qType = types[Math.floor(Math.random() * types.length)];
            } else if (modeVal === "mix_no_audio") {
                const types = ["hz_to_mean", "mean_to_hz"];
                qType = types[Math.floor(Math.random() * types.length)];
            }

            return buildQuizQuestion(targetWord, qType, pool);
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

        if (q.type === "hz_to_mean") {
            promptLabel = "Chọn nghĩa tiếng Việt đúng cho từ:";
            promptHtml = `<div class="quiz-q-prompt">${escapeHtml(q.word.hz)}</div>
                          <div class="quiz-q-sub">${escapeHtml(q.word.py)}</div>`;
        } else if (q.type === "mean_to_hz") {
            promptLabel = "Chọn Chữ Hán tương ứng với nghĩa:";
            promptHtml = `<div class="quiz-q-prompt mean-prompt">${escapeHtml(q.word.mean)}</div>
                          <div class="quiz-q-sub" style="font-size:14px; color:#64748b;">${q.word.type ? escapeHtml(q.word.type) : ''}</div>`;
        } else if (q.type === "hz_to_py") {
            promptLabel = "Chọn phiên âm Pinyin & Thanh điệu chính xác:";
            promptHtml = `<div class="quiz-q-prompt">${escapeHtml(q.word.hz)}</div>
                          <div class="quiz-q-sub" style="font-size:14.5px; color:#475569; margin-top:4px;">Nghĩa: <em>${escapeHtml(q.word.mean)}</em> ${q.word.type ? `(${escapeHtml(q.word.type)})` : ''}</div>`;
        } else if (q.type === "audio_to_hz") {
            promptLabel = "Nghe âm thanh và chọn Chữ Hán đúng:";
            promptHtml = `
                <div style="margin: 15px 0;">
                    <button class="btn-speak" style="width:68px; height:68px; font-size:30px;" id="btn-quiz-audio" title="Bấm để nghe lại">🔊</button>
                </div>
                <div class="quiz-q-sub">Nhấn loa để nghe lại</div>
            `;
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
                    } else if (q.type === "hz_to_py") {
                        contentHtml = `
                            <div class="ans-hz-wrap" style="padding: 2px 0;">
                                <span class="ans-py" style="font-size: 21px; font-weight: 700; color: #ea580c; letter-spacing: 0.5px;">${escapeHtml(opt.py)}</span>
                            </div>
                        `;
                    } else {
                        contentHtml = `
                            <div class="ans-hz-wrap">
                                <span class="ans-hz">${escapeHtml(opt.hz)}</span>
                                <span class="ans-py">${escapeHtml(opt.py)}</span>
                            </div>
                        `;
                    }
                    return `
                        <button class="ans-btn ${q.type === 'mean_to_hz' || q.type === 'audio_to_hz' ? 'ans-btn-hz' : ''}" data-id="${opt.id}" data-idx="${i}">
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
                    ${currentNum === total ? 'Xem Kết Quả' : 'Câu Tiếp Theo ▶ (Space/Enter)'}
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
            if (typeof soundFX !== "undefined" && soundFX.correct) soundFX.correct();
            state.quizScore++;
            feedbackBox.className = "quiz-feedback show correct";
            feedbackBox.innerHTML = `
                🎉 <strong>Chính xác!</strong> 
                <strong>${escapeHtml(question.correctWord.hz)}</strong> [<span style="color:#ea580c; font-weight:700;">${escapeHtml(question.correctWord.py)}</span>]: ${escapeHtml(question.correctWord.mean)}
            `;
        } else {
            if (typeof soundFX !== "undefined" && soundFX.wrong) soundFX.wrong();
            state.quizIncorrect.push(question.correctWord);
            feedbackBox.className = "quiz-feedback show wrong";
            feedbackBox.innerHTML = `
                ❌ <strong>Chưa chính xác!</strong> Đáp án đúng là: 
                <strong>${escapeHtml(question.correctWord.hz)}</strong> [<span style="color:#ea580c; font-weight:700;">${escapeHtml(question.correctWord.py)}</span>]: ${escapeHtml(question.correctWord.mean)}
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
            if (typeof soundFX !== "undefined" && soundFX.fanfare) soundFX.fanfare();
            badge = "🏆";
            title = "Hoàn Hảo! Điểm Tuyệt Đối!";
        } else if (percent >= 80) {
            if (typeof soundFX !== "undefined" && soundFX.fanfare) soundFX.fanfare();
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
                const modeVal = document.getElementById("quiz-mode-select") ? document.getElementById("quiz-mode-select").value : "mix";
                const pool = [...getFilteredWords()];
                state.quizQuestions = state.quizIncorrect.map(targetWord => {
                    let qType = modeVal;
                    if (modeVal === "mix") {
                        const types = ["hz_to_mean", "mean_to_hz", "hz_to_py", "audio_to_hz"];
                        qType = types[Math.floor(Math.random() * types.length)];
                    } else if (modeVal === "mix_no_audio") {
                        const types = ["hz_to_mean", "mean_to_hz"];
                        qType = types[Math.floor(Math.random() * types.length)];
                    }
                    return buildQuizQuestion(targetWord, qType, pool);
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
    // MODE 4: KHU TRÒ CHƠI ÔN TẬP (GAME ZONE: 4 GAMES)
    // =========================================================================
    let gameTimers = [];
    function addGameTimer(t) {
        gameTimers.push(t);
        return t;
    }
    function clearGameTimers() {
        if (state.gameTimer) {
            clearInterval(state.gameTimer);
            state.gameTimer = null;
        }
        gameTimers.forEach(t => {
            clearInterval(t);
            clearTimeout(t);
        });
        gameTimers = [];
    }

    function setupGameZone() {
        clearGameTimers();
        state.activeGame = null;
        renderGameHub();
    }

    function renderGameHub() {
        clearGameTimers();
        state.activeGame = null;
        const container = document.getElementById("games-container") || document.getElementById("match-container");
        if (!container) return;

        const words = getFilteredWords();
        const wordCount = words.length;

        container.innerHTML = `
            <div class="game-zone-wrapper">
                <div class="game-hub-header">
                    <h2>🎮 Khu Luyện Tập & Trò Chơi Ôn Tập (12 Chế Độ Toàn Diện)</h2>
                    <p>Kho từ hiện tại: <strong>${wordCount} từ</strong> (theo phạm vi bộ lọc đang chọn). Hãy chọn thử thách yêu thích để bắt đầu!</p>
                </div>

                <!-- PHẦN 1: ĐẤU TRÍ & THỬ THÁCH ĐẶC BIỆT (RPG & PUZZLE) -->
                <div class="game-hub-section-title">
                    <span class="hub-sec-icon">⚔️</span>
                    <span>Đấu Trí & Thử Thách Đặc Biệt (RPG & Câu Đố)</span>
                </div>
                <div class="game-hub-grid">
                    <div class="game-card-item game-card-boss" data-game="boss">
                        <div class="game-card-top">
                            <span class="game-card-icon">⚔️</span>
                            <span class="game-card-badge badge-hot">Siêu Hot • RPG</span>
                        </div>
                        <div class="game-card-title">1. Đấu Boss Từ Vựng (Boss Battle)</div>
                        <div class="game-card-desc">Chiến đấu với Ma Vương Quên Lãng (1000 HP). Trả lời thần tốc gây sát thương bạo kích và bảo vệ 3 mạng sống!</div>
                        <button class="game-card-btn">Chiến Ngay ▶</button>
                    </div>

                    <div class="game-card-item game-card-wordle" data-game="wordle">
                        <div class="game-card-top">
                            <span class="game-card-icon">🟩</span>
                            <span class="game-card-badge badge-hot">Mới • Giải Đố</span>
                        </div>
                        <div class="game-card-title">2. Wordle Chữ Hán (Hanzi Wordle)</div>
                        <div class="game-card-desc">Đoán từ vựng 2 chữ Hán bí mật trong 5 lượt thử với ô xanh, vàng, xám và gợi ý Pinyin, nghĩa tiếng Việt.</div>
                        <button class="game-card-btn">Đoán Ngay ▶</button>
                    </div>

                    <div class="game-card-item game-card-alchemy" data-game="alchemy">
                        <div class="game-card-top">
                            <span class="game-card-icon">🧪</span>
                            <span class="game-card-badge badge-hot">Mới • Bộ Thủ</span>
                        </div>
                        <div class="game-card-title">3. Chế Tác Chữ Hán (Radical Alchemy)</div>
                        <div class="game-card-desc">Ghép các bộ thủ và thành phần biểu âm rời rạc thành chữ Hán hoàn chỉnh. Nhớ sâu cấu trúc chữ Hán!</div>
                        <button class="game-card-btn">Chế Tác ▶</button>
                    </div>

                    <div class="game-card-item game-card-chain" data-game="chain">
                        <div class="game-card-top">
                            <span class="game-card-icon">🐉</span>
                            <span class="game-card-badge badge-hot">Mới • 12 Giây</span>
                        </div>
                        <div class="game-card-title">4. Nối Từ Tiếp Sức (Word Chain)</div>
                        <div class="game-card-desc">Lấy chữ cuối của từ trước làm chữ đầu của từ sau trong 12 giây phản xạ. Kéo dài chuỗi rồng từ vựng!</div>
                        <button class="game-card-btn">Nối Từ ▶</button>
                    </div>
                </div>

                <!-- PHẦN 2: BÀI KHÓA, NGỮ PHÁP & CỤM TỪ THỰC CHIẾN -->
                <div class="game-hub-section-title" style="margin-top: 28px;">
                    <span class="hub-sec-icon">📖</span>
                    <span>Luyện Bài Khóa, Ngữ Pháp & Cụm Từ Thực Chiến (Boya HSK)</span>
                </div>
                <div class="game-hub-grid">
                    <div class="game-card-item game-card-cloze" data-game="cloze">
                        <div class="game-card-top">
                            <span class="game-card-icon">🧩</span>
                            <span class="game-card-badge">Bài Khóa</span>
                        </div>
                        <div class="game-card-title">5. Điền Từ Bài Khóa (Cloze Test)</div>
                        <div class="game-card-desc">Thử thách điền từ vựng còn thiếu vào câu trích thực tế từ bài khóa và câu ví dụ để nhớ ngữ cảnh.</div>
                        <button class="game-card-btn">Luyện Ngay ▶</button>
                    </div>

                    <div class="game-card-item game-card-scramble-sentence" data-game="scramble_sentence">
                        <div class="game-card-top">
                            <span class="game-card-icon">🔤</span>
                            <span class="game-card-badge">Ngữ Pháp HSK</span>
                        </div>
                        <div class="game-card-title">6. Sắp Xếp Trật Tự Câu (Sentence Scramble)</div>
                        <div class="game-card-desc">Ghép các khối từ rời rạc thành câu hoàn chỉnh đúng chuẩn ngữ pháp tiếng Trung (dạng bài thi HSK 4-5).</div>
                        <button class="game-card-btn">Luyện Ngay ▶</button>
                    </div>

                    <div class="game-card-item game-card-collocation" data-game="collocation">
                        <div class="game-card-top">
                            <span class="game-card-icon">🔗</span>
                            <span class="game-card-badge">Cụm Cố Định</span>
                        </div>
                        <div class="game-card-title">7. Nối Cụm Từ Phối Hợp (Collocation Matching)</div>
                        <div class="game-card-desc">Nối các cặp Động từ – Danh từ, Tính từ – Danh từ kinh điển trong bài học (như 克服困难, 珍惜时间...).</div>
                        <button class="game-card-btn">Luyện Ngay ▶</button>
                    </div>

                    <div class="game-card-item game-card-synonyms" data-game="synonyms">
                        <div class="game-card-top">
                            <span class="game-card-icon">⚖️</span>
                            <span class="game-card-badge">Biện Tích</span>
                        </div>
                        <div class="game-card-title">8. Phân Biệt Từ Gần Nghĩa (Synonyms Drill)</div>
                        <div class="game-card-desc">Chọn từ chính xác nhất giữa các cặp từ dễ nhầm lẫn (như 满足 vs 满意, 珍惜 vs 爱惜) kèm lời giải sư phạm chi tiết!</div>
                        <button class="game-card-btn">Luyện Ngay ▶</button>
                    </div>
                </div>

                <!-- PHẦN 3: PHẢN XẠ TỪ VỰNG, TRÍ NHỚ & ÂM THANH -->
                <div class="game-hub-section-title" style="margin-top: 28px;">
                    <span class="hub-sec-icon">⚡</span>
                    <span>Phản Xạ Từ Vựng, Trí Nhớ & Âm Thanh</span>
                </div>
                <div class="game-hub-grid">
                    <div class="game-card-item game-card-1" data-game="match">
                        <div class="game-card-top">
                            <span class="game-card-icon">🃏</span>
                            <span class="game-card-badge">Trí Nhớ & Ghép Đôi</span>
                        </div>
                        <div class="game-card-title">9. Ghép Cặp Thẻ (Card Matching)</div>
                        <div class="game-card-desc">Lật và ghép các cặp Chữ Hán với Nghĩa Tiếng Việt tương ứng nhanh nhất có thể.</div>
                        <button class="game-card-btn">Chơi Ngay ▶</button>
                    </div>

                    <div class="game-card-item game-card-2" data-game="tf">
                        <div class="game-card-top">
                            <span class="game-card-icon">⚡</span>
                            <span class="game-card-badge">Tốc Độ Cao</span>
                        </div>
                        <div class="game-card-title">10. Đúng Hay Sai? (Speed Rush)</div>
                        <div class="game-card-desc">Chữ Hán và Nghĩa có khớp nhau không? Phản xạ 5 giây, bảo vệ 3 mạng sống và tích chuỗi combo!</div>
                        <button class="game-card-btn">Chơi Ngay ▶</button>
                    </div>

                    <div class="game-card-item game-card-3" data-game="scramble">
                        <div class="game-card-top">
                            <span class="game-card-icon">🧩</span>
                            <span class="game-card-badge">Tái Tạo Chữ Hán</span>
                        </div>
                        <div class="game-card-title">11. Xếp Từ Hán Tự (Word Builder)</div>
                        <div class="game-card-desc">Sắp xếp các ký tự Hán tự bị xáo trộn vào đúng vị trí để tạo thành từ vựng hoàn chỉnh.</div>
                        <button class="game-card-btn">Chơi Ngay ▶</button>
                    </div>

                    <div class="game-card-item game-card-4" data-game="hunter">
                        <div class="game-card-top">
                            <span class="game-card-icon">🎯</span>
                            <span class="game-card-badge">Luyện Nghe Phản Xạ</span>
                        </div>
                        <div class="game-card-title">12. Bắt Chữ Theo Âm (Audio Hunter)</div>
                        <div class="game-card-desc">Lắng nghe phát âm chuẩn và nhanh tay chọn trúng Chữ Hán chính xác trong 6 mục tiêu!</div>
                        <button class="game-card-btn">Chơi Ngay ▶</button>
                    </div>
                </div>
            </div>
        `;

        container.querySelectorAll(".game-card-item").forEach(card => {
            card.addEventListener("click", () => {
                const gameType = card.dataset.game;
                if (gameType === "boss") startBossBattle();
                else if (gameType === "wordle") startHanziWordle();
                else if (gameType === "alchemy") startRadicalAlchemy();
                else if (gameType === "chain") startWordChain();
                else if (gameType === "cloze") startClozeTest();
                else if (gameType === "scramble_sentence") startSentenceScramble();
                else if (gameType === "collocation") startCollocationGame();
                else if (gameType === "synonyms") startSynonymsDrill();
                else if (gameType === "match") startMatchingGame();
                else if (gameType === "tf") startTrueFalseGame();
                else if (gameType === "scramble") startScrambleGame();
                else if (gameType === "hunter") startAudioHunterGame();
            });
        });
    }

    // -------------------------------------------------------------------------
    // GAME 1: CARD MATCHING (GHÉP CẶP THẺ)
    // -------------------------------------------------------------------------
    function startMatchingGame() {
        clearGameTimers();
        state.activeGame = "match";
        const container = document.getElementById("games-container") || document.getElementById("match-container");
        if (!container) return;

        let words = getFilteredWords();
        if (words.length < 6) {
            words = state.allWords;
        }
        if (words.length < 6) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🧩</div>
                    <div class="empty-title">Cần tối thiểu 6 từ vựng để bắt đầu</div>
                    <button class="btn-pill" id="btn-back-hub" style="margin-top:15px;">← Quay lại Khu Trò Chơi</button>
                </div>
            `;
            const bBtn = document.getElementById("btn-back-hub");
            if (bBtn) bBtn.addEventListener("click", renderGameHub);
            return;
        }

        const pairCount = Math.min(8, words.length);
        const pool = [...words];
        shuffleArray(pool);
        const selectedPairs = pool.slice(0, pairCount);

        const tiles = [];
        selectedPairs.forEach(w => {
            tiles.push({
                id: `hz_${w.id}`,
                wordId: w.id,
                type: "hz",
                text: w.hz,
                subText: w.py,
                speakText: w.hz
            });
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
                <div class="game-top-bar">
                    <button class="btn-back-hub" id="btn-game-back">← Khu trò chơi</button>
                    <div class="game-stats-group">
                        <div>Ghép đúng: <strong id="game-matched-display" style="color:var(--success);">0 / ${pairCount}</strong> cặp</div>
                        <div>Thời gian: <strong id="game-timer-display">00:00</strong></div>
                    </div>
                    <button class="btn-pill" id="btn-restart-game">🔄 Ván mới</button>
                </div>

                <div class="match-grid" id="match-grid">
                    ${tiles.map(tile => `
                        <div class="match-tile" data-tile-id="${tile.id}" data-word-id="${tile.wordId}" data-type="${tile.type}">
                            ${tile.type === 'hz' 
                                ? `<div class="tile-hz">${escapeHtml(tile.text)}</div><div style="font-size:13px; color:#e67e22; margin-top:4px; font-weight:600;">${escapeHtml(tile.subText)}</div>`
                                : `<div class="tile-mean">${escapeHtml(tile.text)}</div>`
                            }
                        </div>
                    `).join("")}
                </div>
            </div>
        `;

        document.getElementById("btn-game-back").addEventListener("click", renderGameHub);
        document.getElementById("btn-restart-game").addEventListener("click", startMatchingGame);

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

        soundFX.tick();

        if (!state.gameSelectedTile) {
            state.gameSelectedTile = { elem: tileElem, wordId, tileType, tileId };
            tileElem.classList.add("selected");
            return;
        }

        if (state.gameSelectedTile.tileType === tileType) {
            state.gameSelectedTile.elem.classList.remove("selected");
            state.gameSelectedTile = { elem: tileElem, wordId, tileType, tileId };
            tileElem.classList.add("selected");
            return;
        }

        const first = state.gameSelectedTile;
        tileElem.classList.add("selected");

        if (first.wordId === wordId) {
            // MATCH!
            soundFX.correct();
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

                if (state.gameMatchedCount === totalPairs) {
                    clearInterval(state.gameTimer);
                    soundFX.fanfare();
                    const mins = String(Math.floor(state.gameSeconds / 60)).padStart(2, "0");
                    const secs = String(state.gameSeconds % 60).padStart(2, "0");
                    showToast(`🎉 Xuất sắc! Hoàn thành ván trong ${mins}:${secs}!`);
                }
            }, 250);
        } else {
            // WRONG!
            soundFX.wrong();
            setTimeout(() => {
                first.elem.classList.add("wrong");
                tileElem.classList.add("wrong");

                setTimeout(() => {
                    first.elem.classList.remove("selected", "wrong");
                    tileElem.classList.remove("selected", "wrong");
                    state.gameSelectedTile = null;
                }, 400);
            }, 180);
        }
    }

    // -------------------------------------------------------------------------
    // GAME 2: SPEED TRUE/FALSE RUSH (ĐÚNG HAY SAI?)
    // -------------------------------------------------------------------------
    function startTrueFalseGame() {
        clearGameTimers();
        state.activeGame = "tf";
        const container = document.getElementById("games-container") || document.getElementById("match-container");
        if (!container) return;

        let words = getFilteredWords();
        if (words.length < 4) words = state.allWords;
        if (words.length < 4) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚡</div>
                    <div class="empty-title">Cần tối thiểu 4 từ vựng để chơi Đúng Hay Sai</div>
                    <button class="btn-pill" id="btn-back-hub" style="margin-top:15px;">← Quay lại Khu Trò Chơi</button>
                </div>
            `;
            const bBtn = document.getElementById("btn-back-hub");
            if (bBtn) bBtn.addEventListener("click", renderGameHub);
            return;
        }

        const shuffledPool = [...words];
        shuffleArray(shuffledPool);

        const totalQ = Math.min(15, shuffledPool.length);
        let currentQIdx = 0;
        let lives = 3;
        let score = 0;
        let combo = 0;
        let maxCombo = 0;
        let answered = false;
        let timerInterval = null;
        const TIME_LIMIT = 5000; // 5 seconds

        container.innerHTML = `
            <div class="game-wrapper">
                <div class="game-top-bar">
                    <button class="btn-back-hub" id="btn-game-back">← Khu trò chơi</button>
                    <div class="game-stats-group">
                        <div>Mạng: <span id="tf-lives-display" style="font-size:18px; letter-spacing:2px;">❤️❤️❤️</span></div>
                        <div>Điểm: <strong id="tf-score-display" style="color:#e67e22;">0</strong></div>
                        <div id="tf-combo-badge" class="tf-streak-badge" style="display:none;">🔥 Combo x0</div>
                        <div>Câu: <strong id="tf-prog-display">1 / ${totalQ}</strong></div>
                    </div>
                    <button class="btn-pill" id="btn-tf-restart">🔄 Chơi lại</button>
                </div>

                <div class="tf-play-box" id="tf-box">
                    <div class="tf-timer-wrap">
                        <div class="tf-timer-bar" id="tf-timer-bar" style="width: 100%;"></div>
                    </div>

                    <div class="tf-card-display" id="tf-card-view">
                        <div class="tf-hz" id="tf-hz">...</div>
                        <div class="tf-py" id="tf-py">...</div>
                        <div class="tf-divider">Có nghĩa là?</div>
                        <div class="tf-mean" id="tf-mean">...</div>
                    </div>

                    <div class="tf-buttons">
                        <button class="btn-tf btn-tf-true" id="btn-tf-true">
                            <span>✅</span> ĐÚNG 
                            <span style="font-size:12px; opacity:0.85; margin-left:4px;">(← Phím Trái)</span>
                        </button>
                        <button class="btn-tf btn-tf-false" id="btn-tf-false">
                            <span>❌</span> SAI 
                            <span style="font-size:12px; opacity:0.85; margin-left:4px;">(Phím Phải →)</span>
                        </button>
                    </div>

                    <div id="tf-feedback" style="min-height: 28px; font-size: 15px; font-weight: 600; margin-top: 10px;"></div>
                </div>
            </div>
        `;

        document.getElementById("btn-game-back").addEventListener("click", () => {
            clearGameTimers();
            renderGameHub();
        });
        document.getElementById("btn-tf-restart").addEventListener("click", startTrueFalseGame);

        function updateStatsDisplay() {
            const livesElem = document.getElementById("tf-lives-display");
            if (livesElem) {
                let hearts = "";
                for (let i = 0; i < 3; i++) {
                    hearts += (i < lives) ? "❤️" : "🖤";
                }
                livesElem.textContent = hearts;
            }
            const scoreElem = document.getElementById("tf-score-display");
            if (scoreElem) scoreElem.textContent = score;

            const comboBadge = document.getElementById("tf-combo-badge");
            if (comboBadge) {
                if (combo >= 2) {
                    comboBadge.style.display = "inline-flex";
                    comboBadge.textContent = `🔥 Combo x${combo}`;
                } else {
                    comboBadge.style.display = "none";
                }
            }

            const progElem = document.getElementById("tf-prog-display");
            if (progElem) progElem.textContent = `${currentQIdx + 1} / ${totalQ}`;
        }

        function loadQuestion() {
            if (lives <= 0 || currentQIdx >= totalQ) {
                finishGame();
                return;
            }

            answered = false;
            updateStatsDisplay();

            const targetWord = shuffledPool[currentQIdx];
            const isTrue = Math.random() < 0.5;
            let displayedMean = targetWord.mean;

            if (!isTrue) {
                const otherWords = words.filter(w => w.id !== targetWord.id && w.mean !== targetWord.mean);
                if (otherWords.length > 0) {
                    const randomOther = otherWords[Math.floor(Math.random() * otherWords.length)];
                    displayedMean = randomOther.mean;
                }
            }

            const hzElem = document.getElementById("tf-hz");
            const pyElem = document.getElementById("tf-py");
            const meanElem = document.getElementById("tf-mean");
            const timerBar = document.getElementById("tf-timer-bar");
            const feedbackElem = document.getElementById("tf-feedback");
            const cardView = document.getElementById("tf-card-view");

            if (hzElem) hzElem.textContent = targetWord.hz;
            if (pyElem) pyElem.textContent = targetWord.py;
            if (meanElem) meanElem.textContent = displayedMean;
            if (feedbackElem) feedbackElem.textContent = "";
            if (cardView) cardView.style.borderColor = "#e2e8f0";

            // Reset timer bar
            if (timerBar) {
                timerBar.style.width = "100%";
                timerBar.style.backgroundColor = "#22c55e";
            }

            let startTime = Date.now();
            clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, TIME_LIMIT - elapsed);
                const percent = (remaining / TIME_LIMIT) * 100;

                if (timerBar) {
                    timerBar.style.width = `${percent}%`;
                    if (percent < 30) {
                        timerBar.style.backgroundColor = "#ef4444";
                    } else if (percent < 60) {
                        timerBar.style.backgroundColor = "#f59e0b";
                    }
                }

                if (remaining <= 0) {
                    clearInterval(timerInterval);
                    if (!answered) {
                        handleChoice(null, isTrue, targetWord);
                    }
                }
            }, 50);
            addGameTimer(timerInterval);

            // Button handlers
            const btnTrue = document.getElementById("btn-tf-true");
            const btnFalse = document.getElementById("btn-tf-false");

            btnTrue.onclick = () => {
                if (!answered) handleChoice(true, isTrue, targetWord);
            };
            btnFalse.onclick = () => {
                if (!answered) handleChoice(false, isTrue, targetWord);
            };
        }

        function handleChoice(userChoice, isActuallyTrue, targetWord) {
            answered = true;
            clearInterval(timerInterval);

            const isCorrect = (userChoice !== null && userChoice === isActuallyTrue);
            const feedbackElem = document.getElementById("tf-feedback");
            const cardView = document.getElementById("tf-card-view");

            if (isCorrect) {
                soundFX.correct();
                combo++;
                if (combo > maxCombo) maxCombo = combo;
                const points = 100 * Math.min(combo, 5);
                score += points;
                if (feedbackElem) {
                    feedbackElem.style.color = "var(--success)";
                    feedbackElem.textContent = `🎉 Đúng rồi! (+${points} điểm)`;
                }
                if (cardView) cardView.style.borderColor = "var(--success)";
                speakChinese(targetWord.hz);
            } else {
                soundFX.wrong();
                lives--;
                combo = 0;
                if (feedbackElem) {
                    feedbackElem.style.color = "var(--danger)";
                    const reason = (userChoice === null) ? "Hết thời gian 5s!" : "Chưa chính xác!";
                    feedbackElem.innerHTML = `❌ ${reason} Nghĩa đúng: <strong>${escapeHtml(targetWord.mean)}</strong>`;
                }
                if (cardView) cardView.style.borderColor = "var(--danger)";
                speakChinese(targetWord.hz);
            }

            updateStatsDisplay();

            const delayTimer = setTimeout(() => {
                currentQIdx++;
                loadQuestion();
            }, 1000);
            addGameTimer(delayTimer);
        }

        function finishGame() {
            clearInterval(timerInterval);
            const box = document.getElementById("tf-box");
            if (!box) return;

            const isVictory = (lives > 0);
            if (isVictory) soundFX.fanfare();

            box.innerHTML = `
                <div style="text-align: center; padding: 20px 10px;">
                    <div style="font-size: 56px; margin-bottom: 12px;">${isVictory ? '🏆' : '💥'}</div>
                    <h2 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                        ${isVictory ? 'Tuyệt Vời! Vượt Qua Thử Thách!' : 'Hết Mạng! Trò Chơi Kết Thúc'}
                    </h2>
                    <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px;">
                        ${isVictory ? 'Bạn có phản xạ nhận diện từ vựng rất nhanh và chuẩn xác!' : 'Đừng nản lòng, phản xạ nhanh cần rèn luyện thường xuyên!'}
                    </p>

                    <div style="display: flex; justify-content: center; gap: 24px; margin-bottom: 30px; flex-wrap: wrap;">
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 22px; text-align: center;">
                            <div style="font-size: 13px; color: var(--text-muted);">Tổng Điểm</div>
                            <div style="font-size: 28px; font-weight: 700; color: #e67e22;">${score}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 22px; text-align: center;">
                            <div style="font-size: 13px; color: var(--text-muted);">Combo Dài Nhất</div>
                            <div style="font-size: 28px; font-weight: 700; color: #ea580c;">🔥 x${maxCombo}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 22px; text-align: center;">
                            <div style="font-size: 13px; color: var(--text-muted);">Số Câu Trả Lời</div>
                            <div style="font-size: 28px; font-weight: 700; color: #2980b9;">${currentQIdx} / ${totalQ}</div>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: center; gap: 14px;">
                        <button class="btn-pill" id="btn-tf-again">🔄 Chơi Lại Ván Khác</button>
                        <button class="btn-pill" id="btn-tf-to-hub">🏠 Về Khu Trò Chơi</button>
                    </div>
                </div>
            `;

            document.getElementById("btn-tf-again").addEventListener("click", startTrueFalseGame);
            document.getElementById("btn-tf-to-hub").addEventListener("click", renderGameHub);
        }

        loadQuestion();
    }

    // -------------------------------------------------------------------------
    // GAME 3: HANZI SCRAMBLE BUILDER (XẾP TỪ HÁN TỰ)
    // -------------------------------------------------------------------------
    function startScrambleGame() {
        clearGameTimers();
        state.activeGame = "scramble";
        const container = document.getElementById("games-container") || document.getElementById("match-container");
        if (!container) return;

        let words = getFilteredWords().filter(w => w.hz && w.hz.length >= 2);
        if (words.length < 3) {
            words = state.allWords.filter(w => w.hz && w.hz.length >= 2);
        }
        if (words.length < 3) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔤</div>
                    <div class="empty-title">Cần tối thiểu 3 từ vựng từ 2 chữ Hán trở lên để ghép từ</div>
                    <button class="btn-pill" id="btn-back-hub" style="margin-top:15px;">← Quay lại Khu Trò Chơi</button>
                </div>
            `;
            const bBtn = document.getElementById("btn-back-hub");
            if (bBtn) bBtn.addEventListener("click", renderGameHub);
            return;
        }

        const shuffledPool = [...words];
        shuffleArray(shuffledPool);

        const totalWords = Math.min(8, shuffledPool.length);
        let wordIdx = 0;
        let score = 0;
        let solvedWords = [];

        container.innerHTML = `
            <div class="game-wrapper">
                <div class="game-top-bar">
                    <button class="btn-back-hub" id="btn-game-back">← Khu trò chơi</button>
                    <div class="game-stats-group">
                        <div>Tiến độ: <strong id="scramble-prog">1 / ${totalWords}</strong> từ</div>
                        <div>Điểm: <strong id="scramble-score" style="color:#27ae60;">0</strong></div>
                    </div>
                    <button class="btn-pill" id="btn-scramble-restart">🔄 Chơi ván mới</button>
                </div>

                <div class="scramble-play-box" id="scramble-box">
                    <div class="scramble-prompt-box">
                        <div class="scramble-mean" id="scramble-mean">...</div>
                        <div class="scramble-py" id="scramble-py">...</div>
                        <button class="btn-mini-speak" id="btn-scramble-speak" style="margin-top: 10px; font-size: 14px; font-weight: 600; color: #27ae60; background: none; border: none; cursor: pointer;">
                            🔊 Nghe phát âm
                        </button>
                    </div>

                    <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
                        Nhấp chọn chữ Hán theo thứ tự đúng để lấp đầy các ô:
                    </div>

                    <div class="scramble-slots-area" id="scramble-slots"></div>

                    <div class="scramble-pool-area" id="scramble-chips"></div>

                    <div class="scramble-actions">
                        <button class="btn-pill" id="btn-scramble-hint">💡 Gợi ý chữ đầu</button>
                        <button class="btn-pill" id="btn-scramble-reset">🔄 Xóa làm lại</button>
                        <button class="btn-pill" id="btn-scramble-skip">Bỏ qua ▶</button>
                    </div>

                    <div id="scramble-feedback" style="min-height: 28px; font-size: 15px; font-weight: 700; margin-top: 16px;"></div>
                </div>
            </div>
        `;

        document.getElementById("btn-game-back").addEventListener("click", renderGameHub);
        document.getElementById("btn-scramble-restart").addEventListener("click", startScrambleGame);

        function loadWord() {
            if (wordIdx >= totalWords) {
                finishScramble();
                return;
            }

            const targetWord = shuffledPool[wordIdx];
            const targetChars = targetWord.hz.split("");
            const numSlots = targetChars.length;

            document.getElementById("scramble-prog").textContent = `${wordIdx + 1} / ${totalWords}`;
            document.getElementById("scramble-score").textContent = score;
            document.getElementById("scramble-mean").textContent = targetWord.mean;
            document.getElementById("scramble-py").textContent = targetWord.py;
            document.getElementById("scramble-feedback").textContent = "";

            const speakBtn = document.getElementById("btn-scramble-speak");
            if (speakBtn) {
                speakBtn.onclick = () => speakChinese(targetWord.hz);
            }

            // Generate chips: chars + 1 distractor if 2 chars
            const chips = targetChars.map((ch, idx) => ({ id: `c_${idx}`, char: ch, used: false }));
            if (numSlots === 2) {
                const otherChars = words
                    .filter(w => w.id !== targetWord.id)
                    .map(w => w.hz)
                    .join("")
                    .split("")
                    .filter(ch => !targetChars.includes(ch));
                if (otherChars.length > 0) {
                    const distractorChar = otherChars[Math.floor(Math.random() * otherChars.length)];
                    chips.push({ id: `c_dist`, char: distractorChar, used: false });
                }
            }
            shuffleArray(chips);

            let slots = new Array(numSlots).fill(null); // stores chip object or null

            function renderSlotsAndChips() {
                const slotsContainer = document.getElementById("scramble-slots");
                const chipsContainer = document.getElementById("scramble-chips");

                // Render slots
                slotsContainer.innerHTML = slots.map((sl, idx) => `
                    <div class="scramble-slot ${sl ? 'filled' : ''}" data-slot-idx="${idx}" title="${sl ? 'Nhấp để gỡ chữ này' : 'Ô trống'}">
                        ${sl ? escapeHtml(sl.char) : ''}
                    </div>
                `).join("");

                // Render chips
                chipsContainer.innerHTML = chips.map(chip => `
                    <div class="scramble-chip ${chip.used ? 'used' : ''}" data-chip-id="${chip.id}">
                        ${escapeHtml(chip.char)}
                    </div>
                `).join("");

                // Slot click -> unassign
                slotsContainer.querySelectorAll(".scramble-slot").forEach(elem => {
                    elem.addEventListener("click", () => {
                        const sIdx = parseInt(elem.dataset.slotIdx, 10);
                        if (slots[sIdx]) {
                            soundFX.tick();
                            slots[sIdx].used = false;
                            slots[sIdx] = null;
                            document.getElementById("scramble-feedback").textContent = "";
                            renderSlotsAndChips();
                        }
                    });
                });

                // Chip click -> assign to first empty slot
                chipsContainer.querySelectorAll(".scramble-chip").forEach(elem => {
                    elem.addEventListener("click", () => {
                        const chipId = elem.dataset.chipId;
                        const chip = chips.find(c => c.id === chipId);
                        if (!chip || chip.used) return;

                        const emptySlotIdx = slots.indexOf(null);
                        if (emptySlotIdx === -1) return; // all full

                        soundFX.tick();
                        chip.used = true;
                        slots[emptySlotIdx] = chip;
                        renderSlotsAndChips();

                        // Check if all slots full
                        if (!slots.includes(null)) {
                            validateAnswer(slots, targetWord);
                        }
                    });
                });
            }

            function validateAnswer(currentSlots, targetWord) {
                const assembled = currentSlots.map(s => s.char).join("");
                const feedbackElem = document.getElementById("scramble-feedback");
                const slotsArea = document.getElementById("scramble-slots");

                if (assembled === targetWord.hz) {
                    soundFX.correct();
                    score += 100;
                    solvedWords.push(targetWord);
                    document.getElementById("scramble-score").textContent = score;
                    if (feedbackElem) {
                        feedbackElem.style.color = "var(--success)";
                        feedbackElem.textContent = "🎉 Hoàn hảo! Bạn đã ghép từ chính xác!";
                    }
                    speakChinese(targetWord.hz);

                    const delayTimer = setTimeout(() => {
                        wordIdx++;
                        loadWord();
                    }, 1100);
                    addGameTimer(delayTimer);
                } else {
                    soundFX.wrong();
                    if (slotsArea) {
                        slotsArea.classList.add("wrong");
                        setTimeout(() => slotsArea.classList.remove("wrong"), 500);
                    }
                    if (feedbackElem) {
                        feedbackElem.style.color = "var(--danger)";
                        feedbackElem.textContent = "❌ Chưa đúng thứ tự! Hãy nhấp vào ô để gỡ và thử lại.";
                    }
                }
            }

            // Hint: Place 1st character into slot 0
            document.getElementById("btn-scramble-hint").onclick = () => {
                const firstChar = targetChars[0];
                const matchingChip = chips.find(c => c.char === firstChar && !c.used);
                if (matchingChip) {
                    soundFX.tick();
                    // Clear slot 0 if occupied
                    if (slots[0]) slots[0].used = false;
                    matchingChip.used = true;
                    slots[0] = matchingChip;
                    renderSlotsAndChips();
                    if (!slots.includes(null)) {
                        validateAnswer(slots, targetWord);
                    }
                }
            };

            // Reset slots
            document.getElementById("btn-scramble-reset").onclick = () => {
                soundFX.tick();
                slots.forEach(s => { if (s) s.used = false; });
                slots = new Array(numSlots).fill(null);
                document.getElementById("scramble-feedback").textContent = "";
                renderSlotsAndChips();
            };

            // Skip
            document.getElementById("btn-scramble-skip").onclick = () => {
                wordIdx++;
                loadWord();
            };

            renderSlotsAndChips();
        }

        function finishScramble() {
            const box = document.getElementById("scramble-box");
            if (!box) return;

            soundFX.fanfare();

            box.innerHTML = `
                <div style="text-align: center; padding: 20px 10px;">
                    <div style="font-size: 56px; margin-bottom: 12px;">🌟</div>
                    <h2 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                        Hoàn Thành Ván Xếp Từ Hán Tự!
                    </h2>
                    <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px;">
                        Bạn đã ghép đúng <strong>${solvedWords.length} / ${totalWords}</strong> từ vựng!
                    </p>

                    <div style="font-size: 32px; font-weight: 700; color: #27ae60; margin-bottom: 24px;">
                        ${score} Điểm
                    </div>

                    ${solvedWords.length > 0 ? `
                        <div style="text-align: left; max-height: 200px; overflow-y: auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 24px;">
                            ${solvedWords.map(w => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
                                    <div>
                                        <strong style="font-size: 17px;">${escapeHtml(w.hz)}</strong> 
                                        <span style="color: #e67e22; font-size: 13px;">${escapeHtml(w.py)}</span>: 
                                        <span style="color: #475569; font-size: 13px;">${escapeHtml(w.mean)}</span>
                                    </div>
                                    <button class="btn-speak scramble-item-speak" data-hz="${escapeHtml(w.hz)}">🔊</button>
                                </div>
                            `).join("")}
                        </div>
                    ` : ''}

                    <div style="display: flex; justify-content: center; gap: 14px;">
                        <button class="btn-pill" id="btn-scramble-again">🔄 Chơi Lại Ván Mới</button>
                        <button class="btn-pill" id="btn-scramble-to-hub">🏠 Về Khu Trò Chơi</button>
                    </div>
                </div>
            `;

            box.querySelectorAll(".scramble-item-speak").forEach(btn => {
                btn.addEventListener("click", () => speakChinese(btn.dataset.hz));
            });
            document.getElementById("btn-scramble-again").addEventListener("click", startScrambleGame);
            document.getElementById("btn-scramble-to-hub").addEventListener("click", renderGameHub);
        }

        loadWord();
    }

    // -------------------------------------------------------------------------
    // GAME 4: AUDIO WORD HUNTER (BẮT CHỮ THEO ÂM THANH)
    // -------------------------------------------------------------------------
    function startAudioHunterGame() {
        clearGameTimers();
        state.activeGame = "hunter";
        const container = document.getElementById("games-container") || document.getElementById("match-container");
        if (!container) return;

        let words = getFilteredWords();
        if (words.length < 6) words = state.allWords;
        if (words.length < 6) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎯</div>
                    <div class="empty-title">Cần tối thiểu 6 từ vựng để bắt đầu trò chơi Bắt Chữ Theo Âm</div>
                    <button class="btn-pill" id="btn-back-hub" style="margin-top:15px;">← Quay lại Khu Trò Chơi</button>
                </div>
            `;
            const bBtn = document.getElementById("btn-back-hub");
            if (bBtn) bBtn.addEventListener("click", renderGameHub);
            return;
        }

        const shuffledPool = [...words];
        shuffleArray(shuffledPool);

        const totalRounds = Math.min(10, shuffledPool.length);
        let roundIdx = 0;
        let score = 0;
        let correctCount = 0;
        let roundAnswered = false;

        container.innerHTML = `
            <div class="game-wrapper">
                <div class="game-top-bar">
                    <button class="btn-back-hub" id="btn-game-back">← Khu trò chơi</button>
                    <div class="game-stats-group">
                        <div>Vòng: <strong id="hunter-prog">1 / ${totalRounds}</strong></div>
                        <div>Điểm: <strong id="hunter-score" style="color:#8e44ad;">0</strong></div>
                    </div>
                    <button class="btn-pill" id="btn-hunter-restart">🔄 Chơi ván mới</button>
                </div>

                <div class="hunter-play-box" id="hunter-box">
                    <div class="hunter-audio-zone">
                        <button class="hunter-speaker-btn pulse" id="btn-hunter-listen" title="Nhấp để nghe lại phát âm">🔊</button>
                        <div style="margin-top: 12px; font-size: 14px; color: var(--text-muted); font-weight: 500;">
                            🎧 Lắng nghe phát âm và bấm chọn đúng Chữ Hán (Nhấp biểu tượng 🔊 để nghe lại)
                        </div>
                    </div>

                    <div class="hunter-grid" id="hunter-grid"></div>

                    <div id="hunter-feedback" style="min-height: 32px; font-size: 16px; font-weight: 700; margin-top: 16px;"></div>
                </div>
            </div>
        `;

        document.getElementById("btn-game-back").addEventListener("click", renderGameHub);
        document.getElementById("btn-hunter-restart").addEventListener("click", startAudioHunterGame);

        function loadRound() {
            if (roundIdx >= totalRounds) {
                finishHunter();
                return;
            }

            roundAnswered = false;
            document.getElementById("hunter-prog").textContent = `${roundIdx + 1} / ${totalRounds}`;
            document.getElementById("hunter-score").textContent = score;
            const feedbackElem = document.getElementById("hunter-feedback");
            if (feedbackElem) feedbackElem.textContent = "";

            const targetWord = shuffledPool[roundIdx];

            // 5 distractors
            const otherWords = words.filter(w => w.id !== targetWord.id);
            shuffleArray(otherWords);
            const candidates = [targetWord, ...otherWords.slice(0, 5)];
            shuffleArray(candidates);

            // Audio speaker button
            const spkBtn = document.getElementById("btn-hunter-listen");
            if (spkBtn) {
                spkBtn.onclick = () => {
                    spkBtn.classList.remove("pulse");
                    void spkBtn.offsetWidth;
                    spkBtn.classList.add("pulse");
                    speakChinese(targetWord.hz);
                };
            }

            // Auto pronounce
            speakChinese(targetWord.hz);

            // Render grid
            const grid = document.getElementById("hunter-grid");
            grid.innerHTML = candidates.map(w => `
                <div class="hunter-tile" data-id="${w.id}">
                    <div class="hunter-hz">${escapeHtml(w.hz)}</div>
                    <div class="hunter-py">${escapeHtml(w.py)}</div>
                </div>
            `).join("");

            grid.querySelectorAll(".hunter-tile").forEach(tile => {
                tile.addEventListener("click", () => {
                    if (roundAnswered) return;
                    const clickedId = tile.dataset.id;

                    if (clickedId === targetWord.id) {
                        roundAnswered = true;
                        soundFX.correct();
                        score += 100;
                        correctCount++;
                        tile.classList.add("correct");
                        document.getElementById("hunter-score").textContent = score;
                        if (feedbackElem) {
                            feedbackElem.style.color = "var(--success)";
                            feedbackElem.innerHTML = `🎉 Chính xác! <strong>${escapeHtml(targetWord.hz)}</strong> [${escapeHtml(targetWord.py)}]: ${escapeHtml(targetWord.mean)}`;
                        }

                        const delayTimer = setTimeout(() => {
                            roundIdx++;
                            loadRound();
                        }, 1200);
                        addGameTimer(delayTimer);
                    } else {
                        soundFX.wrong();
                        tile.classList.add("wrong");
                        setTimeout(() => tile.classList.remove("wrong"), 500);
                        if (feedbackElem) {
                            feedbackElem.style.color = "var(--danger)";
                            feedbackElem.textContent = "❌ Chưa chính xác! Hãy lắng nghe lại âm thanh.";
                        }
                    }
                });
            });
        }

        function finishHunter() {
            const box = document.getElementById("hunter-box");
            if (!box) return;

            soundFX.fanfare();
            const accuracy = Math.round((correctCount / totalRounds) * 100);

            box.innerHTML = `
                <div style="text-align: center; padding: 20px 10px;">
                    <div style="font-size: 56px; margin-bottom: 12px;">🎯</div>
                    <h2 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                        Hoàn Thành Vòng Bắt Chữ Theo Âm!
                    </h2>
                    <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px;">
                        Bạn có đôi tai tiếng Trung rất tuyệt vời! Độ chính xác: <strong>${accuracy}%</strong>
                    </p>

                    <div style="font-size: 36px; font-weight: 700; color: #8e44ad; margin-bottom: 28px;">
                        ${score} Điểm
                    </div>

                    <div style="display: flex; justify-content: center; gap: 14px;">
                        <button class="btn-pill" id="btn-hunter-again">🔄 Chơi Lại Ván Mới</button>
                        <button class="btn-pill" id="btn-hunter-to-hub">🏠 Về Khu Trò Chơi</button>
                    </div>
                </div>
            `;

            document.getElementById("btn-hunter-again").addEventListener("click", startAudioHunterGame);
            document.getElementById("btn-hunter-to-hub").addEventListener("click", renderGameHub);
        }

        loadRound();
    }

    // =========================================================================
    // DATASETS: COLLOCATIONS, SYNONYMS & SENTENCE SCRAMBLE
    // =========================================================================
    const BOYA_COLLOCATIONS_DATA = [
        { left: "珍惜", right: "时间", py: "zhēnxī shíjiān", mean: "trân trọng thời gian" },
        { left: "克服", right: "困难", py: "kèfú kùnnan", mean: "khắc phục khó khăn" },
        { left: "遵守", right: "规则", py: "zūnshǒu guīzé", mean: "tuân thủ quy tắc" },
        { left: "培养", right: "习惯", py: "péiyǎng xíguàn", mean: "nuôi dưỡng thói quen" },
        { left: "交流", right: "经验", py: "jiāoliú jīngyàn", mean: "trao đổi kinh nghiệm" },
        { left: "恢复", right: "健康", py: "huīfù jiànkāng", mean: "hồi phục sức khỏe" },
        { left: "保护", right: "环境", py: "bǎohù huánjìng", mean: "bảo vệ môi trường" },
        { left: "适应", right: "生活", py: "shìyìng shēnghuó", mean: "thích ứng cuộc sống" },
        { left: "办", right: "手续", py: "bàn shǒuxù", mean: "làm thủ tục" },
        { left: "设计", right: "服装", py: "shèjì fúzhuāng", mean: "thiết kế trang phục" },
        { left: "主持", right: "会议", py: "zhǔchí huìyì", mean: "chủ trì cuộc họp" },
        { left: "交换", right: "礼物", py: "jiāohuàn lǐwù", mean: "trao đổi quà tặng" },
        { left: "解决", right: "问题", py: "jiějué wèntí", mean: "giải quyết vấn đề" },
        { left: "积累", right: "经验", py: "jīlěi jīngyàn", mean: "tích lũy kinh nghiệm" },
        { left: "表达", right: "感情", py: "biǎodá gǎnqíng", mean: "bày tỏ tình cảm" },
        { left: "承担", right: "责任", py: "chéngdān zérèn", mean: "gánh vác trách nhiệm" },
        { left: "满足", right: "要求", py: "mǎnzú yāoqiú", mean: "thỏa mãn yêu cầu" },
        { left: "掌握", right: "技术", py: "zhǎngwò jìshù", mean: "nắm vững kỹ thuật" },
        { left: "深刻的", right: "印象", py: "shēnkè de yìnxiàng", mean: "ấn tượng sâu sắc" },
        { left: "严肃的", right: "表情", py: "yánsù de biǎoqíng", mean: "nét mặt nghiêm túc" },
        { left: "明亮的", right: "眼睛", py: "míngliàng de yǎnjing", mean: "đôi mắt sáng ngời" },
        { left: "雪白的", right: "皮肤", py: "xuěbái de pífū", mean: "làn da trắng tuyết" },
        { left: "准确的", right: "时间", py: "zhǔnquè de shíjiān", mean: "thời gian chính xác" },
        { left: "流利的", right: "汉语", py: "liúlì de Hànyǔ", mean: "tiếng Hán lưu loát" },
        { left: "激动的", right: "眼泪", py: "jīdòng de yǎnlèi", mean: "nước mắt xúc động" },
        { left: "宝贵的", right: "时间", py: "bǎoguì de shíjiān", mean: "thời gian quý báu" },
        { left: "丰富的", right: "想象力", py: "fēngfù de xiǎngxiànglì", mean: "trí tưởng tượng phong phú" },
        { left: "痛苦的", right: "经历", py: "tòngkǔ de jīnglì", mean: "trải nghiệm đau khổ" },
        { left: "热烈的", right: "欢迎", py: "rèliè de huānyíng", mean: "nhiệt liệt hoan nghênh" },
        { left: "巨大的", right: "变化", py: "jùdà de biànhuà", mean: "biến đổi to lớn" }
    ];

    const BOYA_SYNONYMS_DATA = [
        {
            id: "syn_1",
            pair: ["满足", "满意"],
            correct: "满意",
            sentence: "听了这个振奋人心的好消息，大家都感到十分【 ______ 】。",
            py: "Tīngle zhè ge zhènfèn rénxīn de hǎo xiāoxi, dàjiā dōu gǎndào shífēn mǎnyì.",
            mean: "Nghe được tin vui phấn khởi lòng người này, mọi người đều cảm thấy vô cùng hài lòng.",
            notes: [
                { hz: "满意", py: "mǎnyì", role: "Tính từ", hint: "Vừa lòng, thỏa nguyện (tâm trạng)" },
                { hz: "满足", py: "mǎnzú", role: "Động từ", hint: "Làm cho đầy đủ, thỏa mãn nhu cầu/điều kiện" }
            ],
            explain: "💡 【满意】là tính từ biểu thị tâm trạng vui vẻ, vừa lòng (thường dùng: 感到满意 / 对……很满意). Còn 【满足】thường là động từ mang ý nghĩa đáp ứng đầy đủ (thường dùng: 满足需要 / 满足愿望 / 满足条件)."
        },
        {
            id: "syn_2",
            pair: ["珍惜", "爱惜"],
            correct: "珍惜",
            sentence: "大学时光非常宝贵，我们一定要【 ______ 】每一天。",
            py: "Dàxué shíguāng fēicháng bǎoguì, wǒmen yídìng yào zhēnxī měi yì tiān.",
            mean: "Thời sinh viên đại học vô cùng quý giá, chúng ta nhất định phải trân trọng từng ngày.",
            notes: [
                { hz: "珍惜", py: "zhēnxī", role: "Động từ", hint: "Trân quý điều trừu tượng (thời gian, cơ hội, tình bạn)" },
                { hz: "爱惜", py: "àixī", role: "Động từ", hint: "Yêu quý giữ gìn đồ vật cụ thể, sức khỏe" }
            ],
            explain: "💡 【珍惜】thường kết hợp với các danh từ trừu tượng, quý giá như 'thời gian (时间)', 'cơ hội (机会)', 'tình cảm (感情)'. Còn 【爱惜】chuyên dùng cho đồ vật hữu hình hoặc thể xác (như: 爱惜粮食 - tiết kiệm lương thực, 爱惜身体 - giữ gìn thân thể)."
        },
        {
            id: "syn_3",
            pair: ["熟悉", "熟练"],
            correct: "熟练",
            sentence: "他在这家汽修厂工作了多年，修车的技术非常【 ______ 】。",
            py: "Tā zài zhè jiā qìxiū chǎng gōngzuòle duō nián, xiūchē de jìshù fēicháng shúliàn.",
            mean: "Anh ấy đã làm việc ở xưởng sửa xe này nhiều năm, kỹ thuật sửa xe rất thành thạo.",
            notes: [
                { hz: "熟练", py: "shúliàn", role: "Tính từ", hint: "Thành thạo, nhuần nhuyễn kỹ năng/tay nghề" },
                { hz: "熟悉", py: "shúxī", role: "Động từ/Tính từ", hint: "Quen thuộc con người, môi trường" }
            ],
            explain: "💡 【熟练】chỉ kỹ năng, thao tác điêu luyện thành thạo do làm đi làm lại nhiều lần (熟练的动作 / 熟练的技术). Còn 【熟悉】chỉ sự am hiểu, quen thuộc về người hoặc cảnh vật (熟悉这里的环境 / 熟悉彼此)."
        },
        {
            id: "syn_4",
            pair: ["偶然", "偶尔"],
            correct: "偶尔",
            sentence: "他平时工作太忙很少看电视，只有周末才【 ______ 】看一下。",
            py: "Tā píngshí gōngzuò tài máng hěn shǎo kàn diànshì, zhǐyǒu zhōumò cái ǒu'ěr kàn yíxià.",
            mean: "Bình thường anh ấy quá bận ít khi xem tivi, chỉ có cuối tuần mới thỉnh thoảng xem một chút.",
            notes: [
                { hz: "偶尔", py: "ǒu'ěr", role: "Phó từ", hint: "Thỉnh thoảng, đôi khi (tần suất thấp)" },
                { hz: "偶然", py: "ǒurán", role: "Tính từ/Phó từ", hint: "Tình cờ, ngẫu nhiên, bất ngờ" }
            ],
            explain: "💡 【偶尔】là phó từ chỉ tần suất ít ỏi (ngược nghĩa với 经常). Còn 【偶然】nhấn mạnh tính chất ngẫu nhiên bất ngờ, không báo trước (ngược nghĩa với 必然 - tất nhiên: 偶然的发现)."
        },
        {
            id: "syn_5",
            pair: ["合适", "适合"],
            correct: "合适",
            sentence: "这件羊毛大衣样式很好看，你穿在身上非常【 ______ 】。",
            py: "Zhè jiàn yángmáo dàyī yàngshì hěn hǎokàn, nǐ chuān zài shēnshang fēicháng héshì.",
            mean: "Chiếc áo dạ này kiểu dáng rất đẹp, bạn mặc trên người rất vừa vặn/phù hợp.",
            notes: [
                { hz: "合适", py: "héshì", role: "Tính từ", hint: "Vừa vặn, thích hợp (đứng sau phó từ 很/非常)" },
                { hz: "适合", py: "shìhé", role: "Động từ", hint: "Phù hợp với ai/cái gì (phía sau có tân ngữ)" }
            ],
            explain: "💡 【合适】là Tính từ, đứng một mình hoặc sau phó từ chỉ mức độ (很合适 / 非常合适). Còn 【适合】là Động từ, phía sau phải có tân ngữ (ví dụ: 这件衣服很适合你, 工作适合他)."
        },
        {
            id: "syn_6",
            pair: ["突然", "忽然"],
            correct: "突然",
            sentence: "这次调动的消息太【 ______ 】了，大家一时都没思想准备。",
            py: "Zhè cì diàodòng de xiāoxi tài tūrán le, dàjiā yìshí dōu méi sīxiǎng zhǔnbèi.",
            mean: "Tin tức điều động lần này đột ngột quá, mọi người nhất thời chưa có chuẩn bị tâm lý.",
            notes: [
                { hz: "突然", py: "tūrán", role: "Tính từ/Phó từ", hint: "Đột ngột, bất ngờ (làm vị ngữ: 太突然了)" },
                { hz: "忽然", py: "hūrán", role: "Phó từ", hint: "Chỉ làm phó từ đứng trước động từ" }
            ],
            explain: "💡 【突然】vừa là tính từ vừa là phó từ, có thể làm vị ngữ trong câu (很突然 / 太突然了). Còn 【忽然】chỉ có thể làm phó từ bổ nghĩa cho động từ (忽然下雨 / 忽然想起来), không thể nói '太忽然了'."
        },
        {
            id: "syn_7",
            pair: ["通过", "经过"],
            correct: "通过",
            sentence: "【 ______ 】朋友的热情介绍，我终于找到了一份满意的工作。",
            py: "Tōngguò péngyou de rèqíng jièshào, wǒ zhōngyú zhǎodàole yí fèn mǎnyì de gōngzuò.",
            mean: "Thông qua sự giới thiệu nhiệt tình của bạn bè, tôi cuối cùng đã tìm được công việc ưng ý.",
            notes: [
                { hz: "通过", py: "tōngguò", role: "Giới từ/Động từ", hint: "Nhờ người/phương tiện làm cầu nối (thông qua)" },
                { hz: "经过", py: "jīngguò", role: "Giới từ/Động từ", hint: "Trải qua quá trình thời gian/không gian" }
            ],
            explain: "💡 【通过】dùng khi muốn nhấn mạnh người giới thiệu, phương tiện hoặc cách thức đạt kết quả (通过朋友介绍 / 通过努力). Còn 【经过】nhấn mạnh trải qua quá trình thời gian/sự việc (经过两天的讨论 / 汽车经过桥梁)."
        },
        {
            id: "syn_8",
            pair: ["流利", "流畅"],
            correct: "流利",
            sentence: "他在北京留学了两年，能说一口非常【 ______ 】的普通话。",
            py: "Tā zài Běijīng liúxuéle liǎng nián, néng shuō yì kǒu fēicháng liúlì de pǔtōnghuà.",
            mean: "Cậu ấy đã du học ở Bắc Kinh hai năm, có thể nói một thứ tiếng phổ thông cực kỳ lưu loát.",
            notes: [
                { hz: "流利", py: "liúlì", role: "Tính từ", hint: "Lưu loát, trơn tru (dùng cho nói/đọc ngôn ngữ)" },
                { hz: "流畅", py: "liúchàng", role: "Tính từ", hint: "Trôi chảy, mạch lạc (dùng cho văn phong viết)" }
            ],
            explain: "💡 【流利】chuyên dùng cho kỹ năng nói hoặc đọc khẩu ngữ (汉语说得很流利). Còn 【流畅】chuyên dùng cho văn phong bài viết hoặc nét vẽ mượt mà (文笔流畅 / 线条流畅)."
        },
        {
            id: "syn_9",
            pair: ["严肃", "严厉"],
            correct: "严肃",
            sentence: "讨论这么重要的话题，大家的态度都应当非常【 ______ 】。",
            py: "Tǎolùn zhème zhòngyào de huàtí, dàjiā de tàidù dōu yīngdāng fēicháng yánsù.",
            mean: "Thảo luận một chủ đề quan trọng như vậy, thái độ của mọi người đều phải hết sức nghiêm túc.",
            notes: [
                { hz: "严肃", py: "yánsù", role: "Tính từ", hint: "Nghiêm túc, trang trọng (thái độ, không khí)" },
                { hz: "严厉", py: "yánlì", role: "Tính từ", hint: "Nghiêm khắc, trừng phạt khắt khe" }
            ],
            explain: "💡 【严肃】chỉ tác phong, thái độ hoặc nét mặt đứng đắn, không cợt nhả (严肃的态度 / 严肃的表情). Còn 【严厉】chỉ sự khắt khe khi phê bình hoặc trừng phạt lỗi lầm (严厉地批评 / 严厉的惩罚)."
        },
        {
            id: "syn_10",
            pair: ["解释", "说明"],
            correct: "解释",
            sentence: "老师，这个生词的用法我不太懂，请您再给我【 ______ 】一下。",
            py: "Lǎoshī, zhè ge shēngcí de yòngfǎ wǒ bú tài dǒng, qǐng nín zài gěi wǒ jiěshì yíxià.",
            mean: "Thưa cô, cách dùng của từ mới này em chưa hiểu lắm, xin cô giảng giải lại cho em một chút.",
            notes: [
                { hz: "解释", py: "jiěshì", role: "Động từ", hint: "Giải thích rõ ý nghĩa, nguyên nhân vì sao" },
                { hz: "说明", py: "shuōmíng", role: "Động từ/Danh từ", hint: "Thuyết minh, làm rõ sự thật/tình hình" }
            ],
            explain: "💡 【解释】thường là giải thích cặn kẽ ý nghĩa của từ, nguyên nhân hiểu lầm (解释词义 / 解释原因). Còn 【说明】là trình bày làm rõ tình hình hoặc bản thuyết minh hướng dẫn sử dụng (说明情况 / 产品说明书)."
        }
    ];

    const BOYA_SCRAMBLE_DATA = [
        {
            chunks: ["在大家的努力下，", "我们终于", "克服了", "各种困难。"],
            answer: "在大家的努力下，我们终于克服了各种困难。",
            mean: "Dưới sự nỗ lực của mọi người, cuối cùng chúng tôi đã khắc phục mọi khó khăn.",
            pinyin: "Zài dàjiā de nǔlì xià, wǒmen zhōngyú kèfúle gèzhǒng kùnnan."
        },
        {
            chunks: ["虽然我只会说", "“你好”“谢谢”，", "但是司机都说", "我的汉语非常好。"],
            answer: "虽然我只会说“你好”“谢谢”，但是司机都说我的汉语非常好。",
            mean: "Mặc dù tôi chỉ biết nói xin chào và cảm ơn, nhưng các bác tài xế đều khen tiếng Trung của tôi rất tốt.",
            pinyin: "Suīrán wǒ zhǐ huì shuō “nǐ hǎo”“xièxie”, dànshì sījī dōu shuō wǒ de Hànyǔ fēicháng hǎo."
        },
        {
            chunks: ["他和原来的老板", "吵架了，", "一生气就离开了", "那家公司。"],
            answer: "他和原来的老板吵架了，一生气就离开了那家公司。",
            mean: "Anh ấy cãi nhau với ông chủ cũ, vì tức giận liền rời bỏ công ty đó.",
            pinyin: "Tā hé yuánlái de lǎobǎn chǎojià le, yí shēngqì jiù líkāile nà jiā gōngsī."
        },
        {
            chunks: ["做鸡蛋炒饭其实", "非常简单，", "几分钟就能", "做好了。"],
            answer: "做鸡蛋炒饭其实非常简单，几分钟就能做好了。",
            mean: "Làm cơm rang trứng thực ra rất đơn giản, vài phút là có thể làm xong.",
            pinyin: "Zuò jīdàn chǎofàn qíshí fēicháng jiǎndān, jǐ fēnzhōng jiù néng zuòhǎole."
        },
        {
            chunks: ["在中国，", "想学好汉语", "需要有", "足够的时间。"],
            answer: "在中国，想学好汉语需要有足够的时间。",
            mean: "Ở Trung Quốc, muốn học tốt tiếng Hán cần phải có đủ thời gian.",
            pinyin: "Zài Zhōngguó, xiǎng xuéhǎo Hànyǔ xūyào yǒu zúgòu de shíjiān."
        },
        {
            chunks: ["听到这个好消息，", "同学们", "高兴得", "跳了起来。"],
            answer: "听到这个好消息，同学们高兴得跳了起来。",
            mean: "Nghe được tin tốt này, các bạn học vui mừng nhảy cẫng lên.",
            pinyin: "Tīngdào zhè ge hǎo xiāoxi, tóngxuémen gāoxìng de tiàole qǐlái."
        },
        {
            chunks: ["我们应该从小", "培养孩子", "良好的", "阅读习惯。"],
            answer: "我们应该从小培养孩子良好的阅读习惯。",
            mean: "Chúng ta nên bồi dưỡng cho trẻ thói quen đọc sách tốt ngay từ nhỏ.",
            pinyin: "Wǒmen yīnggāi cóngxiǎo péiyǎng háizi liánghǎo de yuèdú xíguàn."
        },
        {
            chunks: ["他天天吃素，", "身体", "却一直恢复得", "很好。"],
            answer: "他天天吃素，身体却一直恢复得很好。",
            mean: "Anh ấy ngày nào cũng ăn chay, nhưng sức khỏe vẫn luôn hồi phục rất tốt.",
            pinyin: "Tā tiāntiān chīsù, shēntǐ què yìzhí huīfù de hěn hǎo."
        },
        {
            chunks: ["只要坚持不懈，", "你一定能", "说一口", "流利的汉语。"],
            answer: "只要坚持不懈，你一定能说一口流利的汉语。",
            mean: "Chỉ cần kiên trì không nản, bạn nhất định có thể nói một thứ tiếng Hán lưu loát.",
            pinyin: "Zhǐyào jiānchí bú xiè, nǐ yídìng néng shuō yì kǒu liúlì de Hànyǔ."
        },
        {
            chunks: ["这件衣服我和老板", "砍了半天价，", "最后便宜了", "五十块钱。"],
            answer: "这件衣服我和老板砍了半天价，最后便宜了五十块钱。",
            mean: "Bộ quần áo này tôi mặc cả với ông chủ nửa ngày, cuối cùng rẻ được 50 tệ.",
            pinyin: "Zhè jiàn yīfu wǒ hé lǎobǎn kǎnle bàntiān jià, zuìhòu piányile wǔshí kuài qián."
        }
    ];

    // Helper tạo danh sách câu hỏi Cloze từ câu ví dụ bài học
    function getClozeQuestionPool() {
        const pool = [];
        const filtered = getFilteredWords();
        const candidateWords = filtered.length >= 8 ? filtered : state.allWords;

        candidateWords.forEach(w => {
            if (!w.examples || w.examples.length === 0) return;
            w.examples.forEach(ex => {
                let sentence = "";
                if (ex.includes("～")) {
                    sentence = ex.replace(/[①②③④⑤]/g, "").trim();
                } else if (ex.includes(w.hz)) {
                    sentence = ex.replace(/[①②③④⑤]/g, "").trim();
                    sentence = sentence.replace(new RegExp(w.hz, "g"), "～");
                }
                if (sentence && sentence.includes("～") && sentence.length >= 6 && sentence.length <= 65) {
                    const others = candidateWords.filter(o => o.id !== w.id && o.hz !== w.hz && o.hz.length === w.hz.length);
                    const poolOthers = others.length >= 3 ? others : candidateWords.filter(o => o.id !== w.id);
                    shuffleArray(poolOthers);
                    const options = [w, ...poolOthers.slice(0, 3)];
                    shuffleArray(options);
                    pool.push({
                        targetWord: w,
                        rawSentence: sentence,
                        displaySentence: sentence.replace("～", "【 ______ 】"),
                        options: options
                    });
                }
            });
        });

        // Nếu số câu trích được ít, bổ sung câu chuẩn
        if (pool.length < 5) {
            const fallbackCloze = [
                {
                    targetWord: { id: "fb_1", hz: "吃素", py: "chīsù", mean: "ăn chay", book_name: "Trung Cấp 1", lesson_title: "Bài 1" },
                    rawSentence: "他天天～，身体却一直很好。",
                    displaySentence: "他天天【 ______ 】，身体却一直很好。",
                    options: [
                        { id: "fb_1", hz: "吃素", py: "chīsù", mean: "ăn chay" },
                        { id: "fb_2", hz: "吵架", py: "chǎojià", mean: "cãi nhau" },
                        { id: "fb_3", hz: "毕业", py: "bìyè", mean: "tốt nghiệp" },
                        { id: "fb_4", hz: "锻炼", py: "duànliàn", mean: "rèn luyện" }
                    ]
                },
                {
                    targetWord: { id: "fb_5", hz: "克服", py: "kèfú", mean: "khắc phục", book_name: "Trung Cấp 2", lesson_title: "Bài 3" },
                    rawSentence: "在大家的努力下，我们终于～了困难。",
                    displaySentence: "在大家的努力下，我们终于【 ______ 】了困难。",
                    options: [
                        { id: "fb_5", hz: "克服", py: "kèfú", mean: "khắc phục" },
                        { id: "fb_6", hz: "适应", py: "shìyìng", mean: "thích ứng" },
                        { id: "fb_7", hz: "交流", py: "jiāoliú", mean: "giao lưu" },
                        { id: "fb_8", hz: "遵守", py: "zūnshǒu", mean: "tuân thủ" }
                    ]
                },
                {
                    targetWord: { id: "fb_9", hz: "珍惜", py: "zhēnxī", mean: "trân trọng", book_name: "Trung Cấp 1", lesson_title: "Bài 5" },
                    rawSentence: "时间非常宝贵，我们要～每一分钟。",
                    displaySentence: "时间非常宝贵，我们要【 ______ 】每一分钟。",
                    options: [
                        { id: "fb_9", hz: "珍惜", py: "zhēnxī", mean: "trân trọng" },
                        { id: "fb_10", hz: "爱惜", py: "àixī", mean: "yêu quý giữ gìn" },
                        { id: "fb_11", hz: "浪费", py: "làngfèi", mean: "lãng phí" },
                        { id: "fb_12", hz: "恢复", py: "huīfù", mean: "hồi phục" }
                    ]
                }
            ];
            pool.push(...fallbackCloze);
        }

        shuffleArray(pool);
        return pool;
    }

    // -------------------------------------------------------------------------
    // GAME 5: CLOZE TEST (ĐIỀN TỪ BÀI KHÓA)
    // -------------------------------------------------------------------------
    function startClozeTest() {
        clearGameTimers();
        state.activeGame = "cloze";
        const container = document.getElementById("games-container") || document.getElementById("match-container");
        if (!container) return;

        const questions = getClozeQuestionPool();
        if (questions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🧩</div>
                    <div class="empty-title">Chưa đủ dữ liệu câu ví dụ cho phạm vi này</div>
                    <button class="btn-pill" id="btn-back-hub" style="margin-top:15px;">← Quay lại Khu Trò Chơi</button>
                </div>
            `;
            const bBtn = document.getElementById("btn-back-hub");
            if (bBtn) bBtn.addEventListener("click", renderGameHub);
            return;
        }

        const totalQ = Math.min(10, questions.length);
        let currentIdx = 0;
        let score = 0;
        let streak = 0;
        let answered = false;

        container.innerHTML = `
            <div class="game-play-wrapper">
                <div class="game-nav-header">
                    <button class="btn-pill btn-back-hub" id="btn-game-back">← Khu Trò Chơi</button>
                    <div class="game-meta-group">
                        <span class="game-meta-badge">🧩 Điền Từ Bài Khóa</span>
                        <span class="game-meta-badge" id="cloze-prog">1 / ${totalQ}</span>
                        <span class="game-meta-badge score-badge">Điểm: <strong id="cloze-score">0</strong></span>
                        <span class="game-meta-badge streak-badge" id="cloze-streak" style="display:none;">🔥 Combo x0</span>
                    </div>
                    <button class="btn-pill" id="btn-cloze-restart">🔄 Chơi Lại</button>
                </div>

                <div id="cloze-box"></div>
            </div>
        `;

        document.getElementById("btn-game-back").addEventListener("click", renderGameHub);
        document.getElementById("btn-cloze-restart").addEventListener("click", startClozeTest);

        function loadQuestion() {
            if (currentIdx >= totalQ) {
                finishCloze();
                return;
            }

            answered = false;
            document.getElementById("cloze-prog").textContent = `${currentIdx + 1} / ${totalQ}`;
            document.getElementById("cloze-score").textContent = score;

            const q = questions[currentIdx];
            const box = document.getElementById("cloze-box");

            box.innerHTML = `
                <div class="cloze-card">
                    <div class="cloze-meta-badge">
                        📖 ${escapeHtml(q.targetWord.book_name || "Boya")} • ${escapeHtml(q.targetWord.lesson_title || "Bài học")}
                    </div>

                    <div class="cloze-sentence" id="cloze-sentence-display">
                        ${escapeHtml(q.displaySentence).replace(/【 ______ 】/g, `<span class="cloze-blank-box" id="cloze-blank-slot">【 ______ 】</span>`)}
                    </div>

                    <div class="cloze-options-grid" id="cloze-options-grid">
                        ${q.options.map(opt => `
                            <button class="cloze-opt-btn" data-id="${opt.id}">
                                <span class="cloze-opt-hz">${escapeHtml(opt.hz)}</span>
                                <span class="cloze-opt-py">${escapeHtml(opt.py)}</span>
                                <span class="cloze-opt-mean">${escapeHtml(opt.mean)}</span>
                            </button>
                        `).join("")}
                    </div>

                    <div id="cloze-feedback-zone"></div>
                </div>
            `;

            box.querySelectorAll(".cloze-opt-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    if (answered) return;
                    answered = true;
                    const chosenId = btn.dataset.id;
                    const isCorrect = chosenId === q.targetWord.id;
                    const blankSlot = document.getElementById("cloze-blank-slot");
                    const feedbackZone = document.getElementById("cloze-feedback-zone");

                    if (isCorrect) {
                        soundFX.correct();
                        score += 100;
                        streak++;
                        btn.classList.add("correct");
                        if (blankSlot) {
                            blankSlot.classList.add("solved");
                            blankSlot.textContent = `【 ${q.targetWord.hz} 】`;
                        }
                    } else {
                        soundFX.wrong();
                        streak = 0;
                        btn.classList.add("wrong");
                        if (blankSlot) {
                            blankSlot.classList.add("wrong");
                            blankSlot.textContent = `【 ${q.targetWord.hz} 】`;
                        }
                        box.querySelectorAll(".cloze-opt-btn").forEach(b => {
                            if (b.dataset.id === q.targetWord.id) b.classList.add("correct");
                        });
                    }

                    document.getElementById("cloze-score").textContent = score;
                    const streakBadge = document.getElementById("cloze-streak");
                    if (streak >= 2) {
                        streakBadge.style.display = "inline-flex";
                        streakBadge.textContent = `🔥 Combo x${streak}`;
                    } else {
                        streakBadge.style.display = "none";
                    }

                    const fullSentence = q.rawSentence.replace(/～/g, q.targetWord.hz);
                    speakChinese(fullSentence);

                    feedbackZone.innerHTML = `
                        <div class="cloze-feedback-box">
                            <div style="flex:1;">
                                <div style="font-weight:700; color: ${isCorrect ? '#059669' : '#dc2626'}; margin-bottom:4px;">
                                    ${isCorrect ? '🎉 Chính xác!' : '❌ Chưa đúng!'} Đáp án đúng là: <strong>${escapeHtml(q.targetWord.hz)}</strong> (${escapeHtml(q.targetWord.py)})
                                </div>
                                <div style="font-size:13.5px; color:#475569;">
                                    Ý nghĩa từ: <em>${escapeHtml(q.targetWord.mean)}</em>
                                </div>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button class="btn-pill" id="btn-cloze-speak-full" title="Nghe lại cả câu">🔊 Nghe câu</button>
                                <button class="btn-pill" id="btn-cloze-next" style="background:var(--primary); color:#ffffff; border-color:var(--primary);">Câu Tiếp ▶</button>
                            </div>
                        </div>
                    `;

                    document.getElementById("btn-cloze-speak-full").addEventListener("click", () => {
                        speakChinese(fullSentence);
                    });

                    document.getElementById("btn-cloze-next").addEventListener("click", () => {
                        currentIdx++;
                        loadQuestion();
                    });
                });
            });
        }

        function finishCloze() {
            const box = document.getElementById("cloze-box");
            if (!box) return;
            soundFX.fanfare();
            const accuracy = Math.round((score / (totalQ * 100)) * 100);

            box.innerHTML = `
                <div class="cloze-card" style="padding: 40px 20px;">
                    <div style="font-size: 56px; margin-bottom: 12px;">🎉</div>
                    <h2 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                        Hoàn Thành Thử Thách Điền Từ Bài Khóa!
                    </h2>
                    <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px;">
                        Độ chính xác ngữ cảnh của bạn: <strong>${accuracy}%</strong>
                    </p>
                    <div style="font-size: 38px; font-weight: 700; color: #2563eb; margin-bottom: 28px;">
                        ${score} Điểm
                    </div>
                    <div style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap;">
                        <button class="btn-pill" id="btn-cloze-again">🔄 Luyện Ván Mới</button>
                        <button class="btn-pill" id="btn-cloze-to-hub">🏠 Về Khu Trò Chơi</button>
                    </div>
                </div>
            `;

            document.getElementById("btn-cloze-again").addEventListener("click", startClozeTest);
            document.getElementById("btn-cloze-to-hub").addEventListener("click", renderGameHub);
        }

        loadQuestion();
    }

    // -------------------------------------------------------------------------
    // GAME 6: SENTENCE SCRAMBLE (SẮP XẾP TRẬT TỰ CÂU)
    // -------------------------------------------------------------------------
    function startSentenceScramble() {
        clearGameTimers();
        state.activeGame = "scramble_sentence";
        const container = document.getElementById("games-container") || document.getElementById("match-container");
        if (!container) return;

        const pool = [...BOYA_SCRAMBLE_DATA];
        shuffleArray(pool);
        const totalQ = Math.min(8, pool.length);
        let currentIdx = 0;
        let score = 0;

        container.innerHTML = `
            <div class="game-play-wrapper">
                <div class="game-nav-header">
                    <button class="btn-pill btn-back-hub" id="btn-game-back">← Khu Trò Chơi</button>
                    <div class="game-meta-group">
                        <span class="game-meta-badge">🔤 Sắp Xếp Trật Tự Câu</span>
                        <span class="game-meta-badge" id="scramble-prog">1 / ${totalQ}</span>
                        <span class="game-meta-badge score-badge">Điểm: <strong id="scramble-score">0</strong></span>
                    </div>
                    <button class="btn-pill" id="btn-scramble-restart">🔄 Chơi Lại</button>
                </div>

                <div id="scramble-box"></div>
            </div>
        `;

        document.getElementById("btn-game-back").addEventListener("click", renderGameHub);
        document.getElementById("btn-scramble-restart").addEventListener("click", startSentenceScramble);

        function loadQuestion() {
            if (currentIdx >= totalQ) {
                finishScramble();
                return;
            }

            document.getElementById("scramble-prog").textContent = `${currentIdx + 1} / ${totalQ}`;
            document.getElementById("scramble-score").textContent = score;

            const q = pool[currentIdx];
            const box = document.getElementById("scramble-box");

            // Danh sách các khối từ
            let availableChunks = q.chunks.map((text, idx) => ({ id: `chk_${idx}`, text: text, origIdx: idx }));
            shuffleArray(availableChunks);
            let placedChunks = [];

            function renderBoard() {
                box.innerHTML = `
                    <div class="scramble-card" style="background:#ffffff; border-radius:var(--radius); padding:28px 24px; border:1px solid var(--border-color); box-shadow:var(--shadow-sm); margin-bottom:20px;">
                        <p style="color:var(--text-muted); font-size:14px; margin-bottom:14px; text-align:center;">
                            💡 Nhấp vào các thẻ bên dưới để xếp vào khung câu theo đúng trật tự ngữ pháp tiếng Trung:
                        </p>

                        <!-- Khung câu đang xếp -->
                        <div class="scramble-slots-zone" id="scramble-slots">
                            ${placedChunks.length === 0 ? `<span style="color:#94a3b8; font-size:15px; margin:auto;">(Chạm vào các khối từ bên dưới để đưa lên đây)</span>` : ''}
                            ${placedChunks.map(c => `
                                <div class="scramble-chip in-slot" data-id="${c.id}" title="Nhấp để trả về khay">
                                    <span>${escapeHtml(c.text)}</span>
                                    <span style="font-size:12px; opacity:0.6;">✕</span>
                                </div>
                            `).join("")}
                        </div>

                        <!-- Khay các từ còn lại -->
                        <div class="scramble-bank-zone" id="scramble-bank">
                            ${availableChunks.map(c => `
                                <div class="scramble-chip" data-id="${c.id}" title="Nhấp để chọn">
                                    <span>${escapeHtml(c.text)}</span>
                                </div>
                            `).join("")}
                        </div>

                        <!-- Điều khiển -->
                        <div class="scramble-controls">
                            <button class="btn-pill" id="btn-scramble-reset" ${placedChunks.length === 0 ? 'disabled' : ''}>🔄 Đặt Lại</button>
                            <button class="btn-pill" id="btn-scramble-hint">💡 Gợi Ý 1 Khối</button>
                            <button class="btn-pill" id="btn-scramble-check" style="background:var(--primary); color:#ffffff; border-color:var(--primary);" ${placedChunks.length === 0 ? 'disabled' : ''}>✅ Kiểm Tra</button>
                        </div>

                        <div id="scramble-result-zone"></div>
                    </div>
                `;

                // Click từ trong khay -> đưa lên khung
                box.querySelectorAll("#scramble-bank .scramble-chip").forEach(chip => {
                    chip.addEventListener("click", () => {
                        const id = chip.dataset.id;
                        const idx = availableChunks.findIndex(c => c.id === id);
                        if (idx !== -1) {
                            const [item] = availableChunks.splice(idx, 1);
                            placedChunks.push(item);
                            soundFX.tick();
                            renderBoard();
                        }
                    });
                });

                // Click từ trong khung -> trả về khay
                box.querySelectorAll("#scramble-slots .scramble-chip").forEach(chip => {
                    chip.addEventListener("click", () => {
                        const id = chip.dataset.id;
                        const idx = placedChunks.findIndex(c => c.id === id);
                        if (idx !== -1) {
                            const [item] = placedChunks.splice(idx, 1);
                            availableChunks.push(item);
                            soundFX.tick();
                            renderBoard();
                        }
                    });
                });

                // Nút Đặt lại
                const resetBtn = document.getElementById("btn-scramble-reset");
                if (resetBtn) {
                    resetBtn.addEventListener("click", () => {
                        availableChunks.push(...placedChunks);
                        placedChunks = [];
                        renderBoard();
                    });
                }

                // Nút Gợi ý
                const hintBtn = document.getElementById("btn-scramble-hint");
                if (hintBtn) {
                    hintBtn.addEventListener("click", () => {
                        const nextTargetChunkText = q.chunks[placedChunks.length];
                        if (!nextTargetChunkText) return;
                        const bankIdx = availableChunks.findIndex(c => c.text === nextTargetChunkText);
                        if (bankIdx !== -1) {
                            const [item] = availableChunks.splice(bankIdx, 1);
                            placedChunks.push(item);
                            soundFX.tick();
                            renderBoard();
                        }
                    });
                }

                // Nút Kiểm tra
                const checkBtn = document.getElementById("btn-scramble-check");
                if (checkBtn) {
                    checkBtn.addEventListener("click", () => {
                        const currentBuilt = placedChunks.map(c => c.text).join("").replace(/[。！？\s]/g, "");
                        const targetAnswer = q.answer.replace(/[。！？\s]/g, "");
                        const isCorrect = currentBuilt === targetAnswer;
                        const slotsZone = document.getElementById("scramble-slots");
                        const resultZone = document.getElementById("scramble-result-zone");

                        if (isCorrect) {
                            soundFX.correct();
                            score += 100;
                            document.getElementById("scramble-score").textContent = score;
                            if (slotsZone) slotsZone.classList.add("is-complete");

                            speakChinese(q.answer);

                            resultZone.innerHTML = `
                                <div class="cloze-feedback-box" style="margin-top:20px; border-left-color:#10b981; background:#ecfdf5;">
                                    <div style="flex:1;">
                                        <div style="font-weight:700; color:#047857; margin-bottom:4px; font-size:16px;">
                                            🎉 Tuyệt vời! Bạn đã sắp xếp hoàn toàn chính xác!
                                        </div>
                                        <div style="font-size:14px; color:#1e293b; margin-bottom:2px;">
                                            ${escapeHtml(q.pinyin)}
                                        </div>
                                        <div style="font-size:13.5px; color:#475569;">
                                            Dịch nghĩa: <em>${escapeHtml(q.mean)}</em>
                                        </div>
                                    </div>
                                    <div style="display:flex; gap:8px;">
                                        <button class="btn-pill" id="btn-scramble-speak">🔊 Nghe câu</button>
                                        <button class="btn-pill" id="btn-scramble-next" style="background:#10b981; color:#ffffff; border-color:#10b981;">Câu Tiếp Theo ▶</button>
                                    </div>
                                </div>
                            `;

                            document.getElementById("btn-scramble-speak").addEventListener("click", () => speakChinese(q.answer));
                            document.getElementById("btn-scramble-next").addEventListener("click", () => {
                                currentIdx++;
                                loadQuestion();
                            });
                        } else {
                            soundFX.wrong();
                            if (slotsZone) {
                                slotsZone.classList.add("is-error");
                                setTimeout(() => slotsZone.classList.remove("is-error"), 600);
                            }
                            resultZone.innerHTML = `
                                <div style="margin-top:14px; text-align:center; color:#dc2626; font-weight:600; font-size:14px;">
                                    ❌ Trật tự câu chưa chính xác. Hãy nhấp thẻ để điều chỉnh lại hoặc bấm "💡 Gợi ý"!
                                </div>
                            `;
                        }
                    });
                }
            }

            renderBoard();
        }

        function finishScramble() {
            const box = document.getElementById("scramble-box");
            if (!box) return;
            soundFX.fanfare();
            const accuracy = Math.round((score / (totalQ * 100)) * 100);

            box.innerHTML = `
                <div class="cloze-card" style="padding: 40px 20px;">
                    <div style="font-size: 56px; margin-bottom: 12px;">🏆</div>
                    <h2 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                        Hoàn Thành Thử Thách Xếp Câu!
                    </h2>
                    <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px;">
                        Khả năng làm chủ cấu trúc câu tiếng Trung: <strong>${accuracy}%</strong>
                    </p>
                    <div style="font-size: 38px; font-weight: 700; color: #7c3aed; margin-bottom: 28px;">
                        ${score} Điểm
                    </div>
                    <div style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap;">
                        <button class="btn-pill" id="btn-scramble-again">🔄 Thử Thách Lại</button>
                        <button class="btn-pill" id="btn-scramble-to-hub">🏠 Về Khu Trò Chơi</button>
                    </div>
                </div>
            `;

            document.getElementById("btn-scramble-again").addEventListener("click", startSentenceScramble);
            document.getElementById("btn-scramble-to-hub").addEventListener("click", renderGameHub);
        }

        loadQuestion();
    }

    // -------------------------------------------------------------------------
    // GAME 7: COLLOCATION MATCHING (NỐI CỤM TỪ PHỐI HỢP)
    // -------------------------------------------------------------------------
    function startCollocationGame() {
        clearGameTimers();
        state.activeGame = "collocation";
        const container = document.getElementById("games-container") || document.getElementById("match-container");
        if (!container) return;

        const pool = [...BOYA_COLLOCATIONS_DATA];
        shuffleArray(pool);
        const pairsPerRound = 5;
        const totalRounds = 3;
        let roundIdx = 0;
        let score = 0;

        container.innerHTML = `
            <div class="game-play-wrapper">
                <div class="game-nav-header">
                    <button class="btn-pill btn-back-hub" id="btn-game-back">← Khu Trò Chơi</button>
                    <div class="game-meta-group">
                        <span class="game-meta-badge">🔗 Nối Cụm Từ Phối Hợp</span>
                        <span class="game-meta-badge" id="colloc-round">Hiệp: 1 / ${totalRounds}</span>
                        <span class="game-meta-badge score-badge">Điểm: <strong id="colloc-score">0</strong></span>
                    </div>
                    <button class="btn-pill" id="btn-colloc-restart">🔄 Chơi Lại</button>
                </div>

                <div id="colloc-box"></div>
            </div>
        `;

        document.getElementById("btn-game-back").addEventListener("click", renderGameHub);
        document.getElementById("btn-colloc-restart").addEventListener("click", startCollocationGame);

        function loadRound() {
            if (roundIdx >= totalRounds) {
                finishCollocation();
                return;
            }

            document.getElementById("colloc-round").textContent = `Hiệp: ${roundIdx + 1} / ${totalRounds}`;
            document.getElementById("colloc-score").textContent = score;

            const roundPairs = pool.slice(roundIdx * pairsPerRound, (roundIdx + 1) * pairsPerRound);
            if (roundPairs.length < pairsPerRound) {
                finishCollocation();
                return;
            }

            const leftItems = roundPairs.map(p => ({ text: p.left, pairId: p.left + "_" + p.right, py: p.py, mean: p.mean }));
            const rightItems = roundPairs.map(p => ({ text: p.right, pairId: p.left + "_" + p.right, mean: p.mean }));
            shuffleArray(leftItems);
            shuffleArray(rightItems);

            let selectedLeft = null;
            let matchedPairsCount = 0;

            const box = document.getElementById("colloc-box");
            box.innerHTML = `
                <div style="background:#ffffff; border-radius:var(--radius); padding:28px 24px; border:1px solid var(--border-color); box-shadow:var(--shadow-sm); margin-bottom:20px;">
                    <p style="color:var(--text-muted); font-size:14px; margin-bottom:18px; text-align:center;">
                        💡 Nhấp vào 1 từ ở cột trái, sau đó nhấp vào từ tương ứng ở cột phải để tạo thành cụm từ cố định:
                    </p>

                    <div class="colloc-wrapper">
                        <!-- Cột Trái -->
                        <div class="colloc-col" id="colloc-left-col">
                            ${leftItems.map(item => `
                                <div class="colloc-card" data-side="left" data-pair="${item.pairId}" data-text="${item.text}">
                                    <span class="colloc-hz">${escapeHtml(item.text)}</span>
                                    <span class="colloc-mean">${escapeHtml(item.mean.split('/')[0])}</span>
                                </div>
                            `).join("")}
                        </div>

                        <!-- Cột Phải -->
                        <div class="colloc-col" id="colloc-right-col">
                            ${rightItems.map(item => `
                                <div class="colloc-card" data-side="right" data-pair="${item.pairId}" data-text="${item.text}">
                                    <span class="colloc-hz">${escapeHtml(item.text)}</span>
                                </div>
                            `).join("")}
                        </div>
                    </div>

                    <div id="colloc-feedback" style="min-height:36px; text-align:center; font-weight:700; font-size:16px;"></div>
                </div>
            `;

            const leftCards = box.querySelectorAll('#colloc-left-col .colloc-card');
            const rightCards = box.querySelectorAll('#colloc-right-col .colloc-card');

            leftCards.forEach(card => {
                card.addEventListener("click", () => {
                    if (card.classList.contains("matched")) return;
                    leftCards.forEach(c => c.classList.remove("selected"));
                    card.classList.add("selected");
                    selectedLeft = card;
                    soundFX.tick();
                });
            });

            rightCards.forEach(card => {
                card.addEventListener("click", () => {
                    if (card.classList.contains("matched") || !selectedLeft) return;

                    const leftPair = selectedLeft.dataset.pair;
                    const rightPair = card.dataset.pair;
                    const feedback = document.getElementById("colloc-feedback");

                    if (leftPair === rightPair) {
                        // MATCH!
                        soundFX.correct();
                        score += 50;
                        matchedPairsCount++;
                        document.getElementById("colloc-score").textContent = score;

                        selectedLeft.classList.remove("selected");
                        selectedLeft.classList.add("matched");
                        selectedLeft.innerHTML += `<span style="font-size:16px; margin-left:8px;">✓</span>`;
                        card.classList.add("matched");
                        card.innerHTML += `<span style="font-size:16px; margin-left:8px;">✓</span>`;

                        const fullPhrase = selectedLeft.dataset.text + card.dataset.text;
                        speakChinese(fullPhrase);

                        if (feedback) {
                            feedback.style.color = "var(--success)";
                            feedback.innerHTML = `🎉 Ghép đúng cụm: <strong>${escapeHtml(fullPhrase)}</strong>`;
                        }
                        selectedLeft = null;

                        if (matchedPairsCount === pairsPerRound) {
                            soundFX.fanfare();
                            setTimeout(() => {
                                roundIdx++;
                                loadRound();
                            }, 1200);
                        }
                    } else {
                        // WRONG
                        soundFX.wrong();
                        card.classList.add("wrong");
                        selectedLeft.classList.add("wrong");
                        if (feedback) {
                            feedback.style.color = "var(--danger)";
                            feedback.textContent = "❌ Hai từ này không đi cùng nhau. Hãy thử lại!";
                        }
                        setTimeout(() => {
                            card.classList.remove("wrong");
                            if (selectedLeft) selectedLeft.classList.remove("wrong", "selected");
                            selectedLeft = null;
                        }, 500);
                    }
                });
            });
        }

        function finishCollocation() {
            const box = document.getElementById("colloc-box");
            if (!box) return;
            soundFX.fanfare();

            box.innerHTML = `
                <div class="cloze-card" style="padding: 40px 20px;">
                    <div style="font-size: 56px; margin-bottom: 12px;">🌟</div>
                    <h2 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                        Hoàn Thành Thử Thách Nối Cụm Từ!
                    </h2>
                    <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px;">
                        Bạn đã nắm rất vững các cụm từ phối hợp kinh điển của Boya Trung Cấp!
                    </p>
                    <div style="font-size: 38px; font-weight: 700; color: #059669; margin-bottom: 28px;">
                        ${score} Điểm
                    </div>
                    <div style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap;">
                        <button class="btn-pill" id="btn-colloc-again">🔄 Chơi Ván Mới</button>
                        <button class="btn-pill" id="btn-colloc-to-hub">🏠 Về Khu Trò Chơi</button>
                    </div>
                </div>
            `;

            document.getElementById("btn-colloc-again").addEventListener("click", startCollocationGame);
            document.getElementById("btn-colloc-to-hub").addEventListener("click", renderGameHub);
        }

        loadRound();
    }

    // -------------------------------------------------------------------------
    // GAME 8: SYNONYMS DRILL (PHÂN BIỆT TỪ GẦN NGHĨA)
    // -------------------------------------------------------------------------
    function startSynonymsDrill() {
        clearGameTimers();
        state.activeGame = "synonyms";
        const container = document.getElementById("games-container") || document.getElementById("match-container");
        if (!container) return;

        const pool = [...BOYA_SYNONYMS_DATA];
        shuffleArray(pool);
        const totalQ = pool.length;
        let currentIdx = 0;
        let score = 0;
        let answered = false;

        container.innerHTML = `
            <div class="game-play-wrapper">
                <div class="game-nav-header">
                    <button class="btn-pill btn-back-hub" id="btn-game-back">← Khu Trò Chơi</button>
                    <div class="game-meta-group">
                        <span class="game-meta-badge">⚖️ Phân Biệt Từ Gần Nghĩa</span>
                        <span class="game-meta-badge" id="syn-prog">1 / ${totalQ}</span>
                        <span class="game-meta-badge score-badge">Điểm: <strong id="syn-score">0</strong></span>
                    </div>
                    <button class="btn-pill" id="btn-syn-restart">🔄 Chơi Lại</button>
                </div>

                <div id="syn-box"></div>
            </div>
        `;

        document.getElementById("btn-game-back").addEventListener("click", renderGameHub);
        document.getElementById("btn-syn-restart").addEventListener("click", startSynonymsDrill);

        function loadQuestion() {
            if (currentIdx >= totalQ) {
                finishSynonyms();
                return;
            }

            answered = false;
            document.getElementById("syn-prog").textContent = `${currentIdx + 1} / ${totalQ}`;
            document.getElementById("syn-score").textContent = score;

            const q = pool[currentIdx];
            const box = document.getElementById("syn-box");

            box.innerHTML = `
                <div class="syn-card">
                    <p style="color:var(--text-muted); font-size:14px; margin-bottom:16px; text-align:center;">
                        💡 Hãy chọn từ thích hợp nhất để điền vào chỗ trống theo ngữ cảnh và ngữ pháp:
                    </p>

                    <div class="syn-sentence" id="syn-sentence-display">
                        ${escapeHtml(q.sentence).replace(/【 ______ 】/g, `<span class="cloze-blank-box" id="syn-blank-slot">【 ______ 】</span>`)}
                    </div>

                    <div class="syn-options-row" id="syn-options-row">
                        ${q.pair.map(word => {
                            const noteObj = q.notes.find(n => n.hz === word) || {};
                            return `
                                <div class="syn-choice-btn" data-word="${word}">
                                    <div class="syn-hz">${escapeHtml(word)}</div>
                                    <div class="syn-py">${escapeHtml(noteObj.py || '')}</div>
                                    <div style="font-size:12.5px; color:#64748b; margin-top:4px;">${escapeHtml(noteObj.role || '')}: ${escapeHtml(noteObj.hint || '')}</div>
                                </div>
                            `;
                        }).join("")}
                    </div>

                    <div id="syn-explanation-zone"></div>
                </div>
            `;

            box.querySelectorAll(".syn-choice-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    if (answered) return;
                    answered = true;
                    const chosenWord = btn.dataset.word;
                    const isCorrect = chosenWord === q.correct;
                    const blankSlot = document.getElementById("syn-blank-slot");
                    const explainZone = document.getElementById("syn-explanation-zone");

                    if (isCorrect) {
                        soundFX.correct();
                        score += 100;
                        btn.classList.add("correct");
                        if (blankSlot) {
                            blankSlot.classList.add("solved");
                            blankSlot.textContent = `【 ${q.correct} 】`;
                        }
                    } else {
                        soundFX.wrong();
                        btn.classList.add("wrong");
                        if (blankSlot) {
                            blankSlot.classList.add("wrong");
                            blankSlot.textContent = `【 ${q.correct} 】`;
                        }
                        box.querySelectorAll(".syn-choice-btn").forEach(b => {
                            if (b.dataset.word === q.correct) b.classList.add("correct");
                        });
                    }

                    document.getElementById("syn-score").textContent = score;

                    const fullSentence = q.sentence.replace(/【 ______ 】/g, q.correct);
                    speakChinese(fullSentence);

                    explainZone.innerHTML = `
                        <div class="syn-explain-card">
                            <div class="syn-explain-title">
                                <span>${isCorrect ? '🎉 Bạn chọn rất chuẩn xác!' : '❌ Chưa chính xác!'}</span>
                                <span style="font-size:13px; font-weight:normal; color:#78350f;">(Đáp án đúng: <strong>${escapeHtml(q.correct)}</strong>)</span>
                            </div>
                            <div class="syn-explain-text">
                                ${escapeHtml(q.explain)}
                            </div>
                            <div style="margin-top:10px; font-size:13.5px; color:#451a03; border-top:1px dashed #fde68a; padding-top:8px;">
                                🇻🇳 Bản dịch câu: <em>${escapeHtml(q.mean)}</em>
                            </div>
                            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
                                <button class="btn-pill" id="btn-syn-speak">🔊 Nghe câu</button>
                                <button class="btn-pill" id="btn-syn-next" style="background:#ea580c; color:#ffffff; border-color:#ea580c;">Câu Tiếp Theo ▶</button>
                            </div>
                        </div>
                    `;

                    document.getElementById("btn-syn-speak").addEventListener("click", () => speakChinese(fullSentence));
                    document.getElementById("btn-syn-next").addEventListener("click", () => {
                        currentIdx++;
                        loadQuestion();
                    });
                });
            });
        }

        function finishSynonyms() {
            const box = document.getElementById("syn-box");
            if (!box) return;
            soundFX.fanfare();
            const accuracy = Math.round((score / (totalQ * 100)) * 100);

            box.innerHTML = `
                <div class="cloze-card" style="padding: 40px 20px;">
                    <div style="font-size: 56px; margin-bottom: 12px;">⚖️</div>
                    <h2 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                        Hoàn Thành Thử Thách Phân Biệt Từ Gần Nghĩa!
                    </h2>
                    <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px;">
                        Khả năng phân biệt sắc thái từ vựng: <strong>${accuracy}%</strong>
                    </p>
                    <div style="font-size: 38px; font-weight: 700; color: #ea580c; margin-bottom: 28px;">
                        ${score} Điểm
                    </div>
                    <div style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap;">
                        <button class="btn-pill" id="btn-syn-again">🔄 Ôn Lại Lần Nữa</button>
                        <button class="btn-pill" id="btn-syn-to-hub">🏠 Về Khu Trò Chơi</button>
                    </div>
                </div>
            `;

            document.getElementById("btn-syn-again").addEventListener("click", startSynonymsDrill);
            document.getElementById("btn-syn-to-hub").addEventListener("click", renderGameHub);
        }

        loadQuestion();
    }

    // =========================================================================
    // GAME 9: RADICAL ALCHEMY (CHẾ TÁC CHỮ HÁN / 拆字合成)
    // =========================================================================
    const BOYA_RADICALS_DATA = [
        { target: "休", pinyin: "xiū", mean: "nghỉ ngơi", parts: ["亻", "木"], explain: "亻 (Người) + 木 (Cây) = 休 (Người tựa vào gốc cây để nghỉ ngơi)." },
        { target: "明", pinyin: "míng", mean: "sáng sủa, thông minh", parts: ["日", "月"], explain: "日 (Mặt trời) + 月 (Mặt trăng) = 明 (Hai nguồn ánh sáng vũ trụ hợp lại tạo thành sự sáng rõ)." },
        { target: "好", pinyin: "hǎo", mean: "tốt, đẹp, thích", parts: ["女", "子"], explain: "女 (Phụ nữ) + 子 (Con cái) = 好 (Mẹ và con tượng trưng cho sự sum vầy, tốt đẹp)." },
        { target: "鸣", pinyin: "míng", mean: "tiếng hót, kêu", parts: ["口", "鸟"], explain: "口 (Miệng) + 鸟 (Con chim) = 鸣 (Tiếng chim cất tiếng hót líu lo)." },
        { target: "林", pinyin: "lín", mean: "rừng cây nhỏ", parts: ["木", "木"], explain: "木 (Cây) + 木 (Cây) = 林 (Hai cây đứng cạnh nhau thành rừng cây)." },
        { target: "安", pinyin: "ān", mean: "yên bình, an toàn", parts: ["宀", "女"], explain: "宀 (Mái nhà) + 女 (Người phụ nữ) = 安 (Người phụ nữ ở yên dưới mái ấm đem lại sự bình an)." },
        { target: "看", pinyin: "kàn", mean: "nhìn, xem", parts: ["手", "目"], explain: "手 (Bàn tay) + 目 (Mắt) = 看 (Đưa tay lên trán che nắng để phóng tầm mắt nhìn xa)." },
        { target: "闷", pinyin: "mèn", mean: "ngột ngạt, buồn bực", parts: ["门", "心"], explain: "门 (Cánh cửa) + 心 (Trái tim) = 闷 (Trái tim bị giam hãm sau cánh cửa gây cảm giác ngột ngạt)." },
        { target: "泪", pinyin: "lèi", mean: "nước mắt, giọt lệ", parts: ["氵", "目"], explain: "氵 (Nước) + 目 (Mắt) = 泪 (Nước chảy ra từ khóe mắt là giọt nước mắt)." },
        { target: "问", pinyin: "wèn", mean: "hỏi", parts: ["门", "口"], explain: "门 (Cánh cửa) + 口 (Miệng) = 问 (Đến trước cửa cất lời hỏi thăm)." },
        { target: "闪", pinyin: "shǎn", mean: "lóe sáng, né tránh", parts: ["门", "人"], explain: "门 (Cánh cửa) + 人 (Người) = 闪 (Người thoắt ẩn thoắt hiện qua cánh cửa như ánh chớp)." },
        { target: "信", pinyin: "xìn", mean: "tin tưởng, thư tín", parts: ["亻", "言"], explain: "亻 (Người) + 言 (Lời nói) = 信 (Lời nói của con người phải giữ trọn chữ tín)." },
        { target: "尖", pinyin: "jiān", mean: "đầu nhọn, sắc bén", parts: ["小", "大"], explain: "小 (Nhỏ) ở trên + 大 (To) ở dưới = 尖 (Dưới to trên thu nhỏ lại thành chóp nhọn)." },
        { target: "灾", pinyin: "zāi", mean: "tai họa, hỏa hoạn", parts: ["宀", "火"], explain: "宀 (Mái nhà) + 火 (Lửa) = 灾 (Ngọn lửa bốc cháy trong nhà là tai họa khôn lường)." },
        { target: "尘", pinyin: "chén", mean: "bụi bặm", parts: ["小", "土"], explain: "小 (Nhỏ bé) + 土 (Đất cát) = 尘 (Những hạt đất cát li ti bay trong không khí là bụi bặm)." },
        { target: "卡", pinyin: "kǎ", mean: "thẻ, mắc kẹt", parts: ["上", "下"], explain: "上 (Trên) + 下 (Dưới) = 卡 (Lơ lửng không lên trên không xuống dưới tức là bị kẹt lại)." },
        { target: "意", pinyin: "yì", mean: "ý nghĩa, tâm ý", parts: ["音", "心"], explain: "音 (Âm thanh) + 心 (Trái tim) = 意 (Âm thanh phát ra từ đáy lòng là ý nghĩ, tâm ý)." },
        { target: "男", pinyin: "nán", mean: "nam giới, đàn ông", parts: ["田", "力"], explain: "田 (Ruộng đất) + 力 (Sức lực) = 男 (Người dùng sức mạnh canh tác trên ruộng đồng là nam giới)." },
        { target: "森", pinyin: "sēn", mean: "rừng rậm, sum sê", parts: ["木", "林"], explain: "木 (Cây) + 林 (Rừng cây) = 森 (Cây cối bạt ngàn tạo thành rừng rậm nguyên sinh)." }
    ];

    function startRadicalAlchemy() {
        clearGameTimers();
        state.activeGame = "alchemy";
        const container = document.getElementById("games-container") || document.getElementById("match-container");
        if (!container) return;

        const pool = [...BOYA_RADICALS_DATA];
        shuffleArray(pool);
        const totalQ = Math.min(10, pool.length);
        let currentIdx = 0;
        let score = 0;

        container.innerHTML = `
            <div class="game-play-wrapper">
                <div class="game-nav-header">
                    <button class="btn-pill btn-back-hub" id="btn-alchemy-back">← Khu Trò Chơi</button>
                    <div class="game-meta-group">
                        <span class="game-meta-badge">🧪 Chế Tác Chữ Hán</span>
                        <span class="game-meta-badge" id="alchemy-round-info">Câu: 1 / ${totalQ}</span>
                        <span class="game-meta-badge score-badge">Điểm: <strong id="alchemy-score">0</strong></span>
                    </div>
                    <button class="btn-pill" id="btn-alchemy-restart">🔄 Chơi Lại</button>
                </div>

                <div id="alchemy-box"></div>
            </div>
        `;

        document.getElementById("btn-alchemy-back").addEventListener("click", renderGameHub);
        document.getElementById("btn-alchemy-restart").addEventListener("click", startRadicalAlchemy);

        function loadQuestion() {
            if (currentIdx >= totalQ) {
                finishAlchemy();
                return;
            }

            const q = pool[currentIdx];
            document.getElementById("alchemy-round-info").textContent = `Câu: ${currentIdx + 1} / ${totalQ}`;
            document.getElementById("alchemy-score").textContent = score;

            const box = document.getElementById("alchemy-box");
            if (!box) return;

            // Slots state
            let slot0Part = null;
            let slot1Part = null;
            let slot0TileIndex = null;
            let slot1TileIndex = null;

            // Collect distractor parts from other items
            const allOtherParts = [];
            pool.forEach(item => {
                if (item.target !== q.target) {
                    allOtherParts.push(...item.parts);
                }
            });
            shuffleArray(allOtherParts);
            const uniqueDistractors = [...new Set(allOtherParts)].filter(p => !q.parts.includes(p)).slice(0, 6);
            
            // Combine target parts + distractors
            const trayParts = [...q.parts, ...uniqueDistractors];
            shuffleArray(trayParts);

            box.innerHTML = `
                <div class="alchemy-crucible-wrapper">
                    <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #cbd5e1; margin-bottom: 6px;">
                        Lò Luyện Hán Tự • Chế Tác Chữ Hán
                    </div>
                    <div style="font-size: 24px; font-weight: 700; color: #fef08a; margin-bottom: 4px;">
                        ${escapeHtml(q.mean)}
                    </div>
                    <div style="font-size: 16px; color: #c7d2fe; margin-bottom: 22px;">
                        Phiên âm: <strong>${escapeHtml(q.pinyin)}</strong>
                    </div>

                    <div class="alchemy-crucible" id="crucible-elem">
                        <div class="alchemy-slot" id="slot-0" title="Nhấp để gỡ bỏ">
                            <span class="slot-hz">?</span>
                            <span class="slot-hint">Thành phần 1</span>
                        </div>
                        <div class="alchemy-plus">+</div>
                        <div class="alchemy-slot" id="slot-1" title="Nhấp để gỡ bỏ">
                            <span class="slot-hz">?</span>
                            <span class="slot-hint">Thành phần 2</span>
                        </div>
                        <div class="alchemy-equals">=</div>
                        <div class="alchemy-result-slot" id="result-slot">
                            <span class="res-hz">?</span>
                        </div>
                    </div>

                    <div style="margin-top: 20px;">
                        <button class="alchemy-fuse-btn" id="btn-fuse">✨ Luyện Hóa (Ghép Chữ)</button>
                    </div>
                </div>

                <div style="font-size: 14px; font-weight: 600; color: var(--text-muted); margin-bottom: 10px; text-align: center;">
                    👇 Chọn 2 bộ thủ / thành phần phù hợp từ khay bên dưới:
                </div>
                <div class="alchemy-tray" id="alchemy-tray-tiles">
                    ${trayParts.map((part, idx) => `
                        <div class="alchemy-tile" data-idx="${idx}" data-part="${escapeHtml(part)}">${escapeHtml(part)}</div>
                    `).join("")}
                </div>

                <div id="alchemy-feedback-zone"></div>
            `;

            const slot0Elem = document.getElementById("slot-0");
            const slot1Elem = document.getElementById("slot-1");
            const resultSlotElem = document.getElementById("result-slot");
            const fuseBtn = document.getElementById("btn-fuse");
            const tiles = box.querySelectorAll(".alchemy-tile");
            const feedbackZone = document.getElementById("alchemy-feedback-zone");

            function updateSlotsUI() {
                if (slot0Part) {
                    slot0Elem.classList.add("filled");
                    slot0Elem.querySelector(".slot-hz").textContent = slot0Part;
                    slot0Elem.querySelector(".slot-hint").textContent = "Nhấp để gỡ";
                } else {
                    slot0Elem.classList.remove("filled");
                    slot0Elem.querySelector(".slot-hz").textContent = "?";
                    slot0Elem.querySelector(".slot-hint").textContent = "Thành phần 1";
                }

                if (slot1Part) {
                    slot1Elem.classList.add("filled");
                    slot1Elem.querySelector(".slot-hz").textContent = slot1Part;
                    slot1Elem.querySelector(".slot-hint").textContent = "Nhấp để gỡ";
                } else {
                    slot1Elem.classList.remove("filled");
                    slot1Elem.querySelector(".slot-hz").textContent = "?";
                    slot1Elem.querySelector(".slot-hint").textContent = "Thành phần 2";
                }
            }

            // Click tile in tray
            tiles.forEach(tile => {
                tile.addEventListener("click", () => {
                    if (tile.classList.contains("used")) return;
                    const part = tile.dataset.part;
                    const idx = tile.dataset.idx;

                    if (!slot0Part) {
                        slot0Part = part;
                        slot0TileIndex = idx;
                        tile.classList.add("used");
                        soundFX.tick();
                        updateSlotsUI();
                    } else if (!slot1Part) {
                        slot1Part = part;
                        slot1TileIndex = idx;
                        tile.classList.add("used");
                        soundFX.tick();
                        updateSlotsUI();
                    }
                });
            });

            // Click slot to remove
            slot0Elem.addEventListener("click", () => {
                if (slot0Part) {
                    if (slot0TileIndex !== null) {
                        const tile = box.querySelector(`.alchemy-tile[data-idx="${slot0TileIndex}"]`);
                        if (tile) tile.classList.remove("used");
                    }
                    slot0Part = null;
                    slot0TileIndex = null;
                    soundFX.tick();
                    updateSlotsUI();
                }
            });

            slot1Elem.addEventListener("click", () => {
                if (slot1Part) {
                    if (slot1TileIndex !== null) {
                        const tile = box.querySelector(`.alchemy-tile[data-idx="${slot1TileIndex}"]`);
                        if (tile) tile.classList.remove("used");
                    }
                    slot1Part = null;
                    slot1TileIndex = null;
                    soundFX.tick();
                    updateSlotsUI();
                }
            });

            // Fuse button
            fuseBtn.addEventListener("click", () => {
                if (!slot0Part || !slot1Part) {
                    feedbackZone.innerHTML = `
                        <div style="text-align: center; color: #ef4444; font-weight: 600; margin-top: 14px;">
                            ⚠️ Hãy chọn đủ 2 thành phần trước khi tiến hành luyện hóa!
                        </div>
                    `;
                    return;
                }

                // Check match
                const userParts = [slot0Part, slot1Part].sort();
                const expectedParts = [...q.parts].sort();
                const isCorrect = userParts[0] === expectedParts[0] && userParts[1] === expectedParts[1];

                if (isCorrect) {
                    soundFX.correct();
                    score += 100;
                    document.getElementById("alchemy-score").textContent = score;

                    resultSlotElem.querySelector(".res-hz").textContent = q.target;
                    resultSlotElem.style.boxShadow = "0 0 30px #eab308";
                    fuseBtn.disabled = true;
                    fuseBtn.style.opacity = "0.5";

                    speakChinese(q.target);

                    feedbackZone.innerHTML = `
                        <div class="cloze-feedback-box" style="margin-top: 24px; border-left-color: #10b981; background: #ecfdf5;">
                            <div style="flex: 1;">
                                <div style="font-weight: 700; color: #047857; margin-bottom: 6px; font-size: 16px;">
                                    🎉 Tuyệt vời! Chế tác thành công chữ: <strong style="font-size: 20px; font-family: KaiTi, serif;">${escapeHtml(q.target)}</strong> (${escapeHtml(q.pinyin)})
                                </div>
                                <div style="font-size: 14.5px; color: #1e293b; line-height: 1.5;">
                                    💡 <strong>Chiết tự ghi nhớ:</strong> ${escapeHtml(q.explain)}
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <button class="btn-pill" id="btn-alchemy-speak">🔊 Nghe đọc</button>
                                <button class="btn-pill" id="btn-alchemy-next" style="background: #10b981; color: #ffffff; border-color: #10b981;">Câu Tiếp Theo ▶</button>
                            </div>
                        </div>
                    `;

                    document.getElementById("btn-alchemy-speak").addEventListener("click", () => speakChinese(q.target));
                    document.getElementById("btn-alchemy-next").addEventListener("click", () => {
                        currentIdx++;
                        loadQuestion();
                    });
                } else {
                    soundFX.wrong();
                    const crucible = document.getElementById("crucible-elem");
                    if (crucible) {
                        crucible.classList.add("shake-elem");
                        setTimeout(() => crucible.classList.remove("shake-elem"), 500);
                    }
                    feedbackZone.innerHTML = `
                        <div style="text-align: center; color: #ef4444; font-weight: 600; margin-top: 14px;">
                            ❌ Hai thành phần này chưa tạo thành chữ <strong>${escapeHtml(q.mean)}</strong> (${escapeHtml(q.pinyin)}). Hãy nhấp vào ô để đổi thành phần khác!
                        </div>
                    `;
                }
            });
        }

        function finishAlchemy() {
            const box = document.getElementById("alchemy-box");
            if (!box) return;
            soundFX.fanfare();
            const accuracy = Math.round((score / (totalQ * 100)) * 100);

            box.innerHTML = `
                <div class="cloze-card" style="padding: 40px 20px;">
                    <div style="font-size: 56px; margin-bottom: 12px;">🧪</div>
                    <h2 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                        Hoàn Thành Thử Thách Chế Tác Chữ Hán!
                    </h2>
                    <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px;">
                        Mức độ làm chủ cấu trúc bộ thủ: <strong>${accuracy}%</strong>
                    </p>
                    <div style="font-size: 38px; font-weight: 700; color: #eab308; margin-bottom: 28px;">
                        ${score} Điểm
                    </div>
                    <div style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap;">
                        <button class="btn-pill" id="btn-alchemy-again">🔄 Chế Tác Lại</button>
                        <button class="btn-pill" id="btn-alchemy-to-hub">🏠 Về Khu Trò Chơi</button>
                    </div>
                </div>
            `;

            document.getElementById("btn-alchemy-again").addEventListener("click", startRadicalAlchemy);
            document.getElementById("btn-alchemy-to-hub").addEventListener("click", renderGameHub);
        }

        loadQuestion();
    }

    // =========================================================================
    // GAME 10: WORD CHAIN (NỐI TỪ TIẾP SỨC / 词语接龙)
    // =========================================================================
    const BOYA_WORD_CHAIN_DATA = [
        { hz: "珍惜", py: "zhēnxī", mean: "trân trọng" },
        { hz: "惜别", py: "xībié", mean: "lưu luyến chia tay" },
        { hz: "别人", py: "biérén", mean: "người khác" },
        { hz: "人生", py: "rénshēng", mean: "đời người, nhân sinh" },
        { hz: "生活", py: "shēnghuó", mean: "cuộc sống" },
        { hz: "活动", py: "huódòng", mean: "hoạt động" },
        { hz: "动物", py: "dòngwù", mean: "động vật" },
        { hz: "物理", py: "wùlǐ", mean: "vật lý" },
        { hz: "理想", py: "lǐxiǎng", mean: "lý tưởng" },
        { hz: "想法", py: "xiǎngfǎ", mean: "suy nghĩ, cách nghĩ" },
        { hz: "法律", py: "fǎlǜ", mean: "pháp luật" },
        { hz: "律师", py: "lǜshī", mean: "luật sư" },
        { hz: "老师", py: "lǎoshī", mean: "giáo viên" },
        { hz: "师生", py: "shīshēng", mean: "thầy trò" },
        { hz: "生产", py: "shēngchǎn", mean: "sản xuất" },
        { hz: "产品", py: "chǎnpǐn", mean: "sản phẩm" },
        { hz: "品质", py: "pǐnzhì", mean: "phẩm chất" },
        { hz: "质量", py: "zhìliàng", mean: "chất lượng" },
        { hz: "力量", py: "lìliàng", mean: "sức mạnh, năng lượng" },
        { hz: "量变", py: "liàngbiàn", mean: "biến đổi về lượng" },
        { hz: "变化", py: "biànhuà", mean: "biến hóa, thay đổi" },
        { hz: "化学", py: "huàxué", mean: "hóa học" },
        { hz: "学生", py: "xuéshēng", mean: "học sinh" },
        { hz: "生日", py: "shēngrì", mean: "ngày sinh nhật" },
        { hz: "日常", py: "rìcháng", mean: "thường ngày" },
        { hz: "常识", py: "chángshí", mean: "thường thức" },
        { hz: "识别", py: "shíbié", mean: "nhận biết, phân biệt" },
        { hz: "表达", py: "biǎodá", mean: "bày tỏ, diễn đạt" },
        { hz: "达到", py: "dádào", mean: "đạt tới" },
        { hz: "到达", py: "dàodá", mean: "đến nơi" },
        { hz: "道理", py: "dàolǐ", mean: "đạo lý, lý lẽ" },
        { hz: "理解", py: "lǐjiě", mean: "hiểu, thấu hiểu" },
        { hz: "解决", py: "jiějué", mean: "giải quyết" },
        { hz: "决心", py: "juéxīn", mean: "quyết tâm" },
        { hz: "心情", py: "xīnqíng", mean: "tâm trạng" },
        { hz: "情况", py: "qíngkuàng", mean: "tình hình" },
        { hz: "况且", py: "kuàngqiě", mean: "hơn nữa" },
        { hz: "并且", py: "bìngqiě", mean: "đồng thời, hơn nữa" }
    ];

    function startWordChain() {
        clearGameTimers();
        state.activeGame = "chain";
        const container = document.getElementById("games-container") || document.getElementById("match-container");
        if (!container) return;

        let words = getFilteredWords().filter(w => w.hz && w.hz.length >= 2);
        if (words.length < 10) words = state.allWords.filter(w => w.hz && w.hz.length >= 2);

        const TIME_LIMIT = 12000; // 12 seconds
        let timerInterval = null;
        let lives = 3;
        let score = 0;
        let combo = 0;
        let maxCombo = 0;
        let chainHistory = [];
        let totalAnswered = 0;
        const targetRounds = 10;

        // Choose starting word
        let currentWord = BOYA_WORD_CHAIN_DATA[0];
        chainHistory.push(currentWord);

        container.innerHTML = `
            <div class="game-play-wrapper">
                <div class="game-nav-header">
                    <button class="btn-pill btn-back-hub" id="btn-chain-back">← Khu Trò Chơi</button>
                    <div class="game-meta-group">
                        <span class="game-meta-badge">🐉 Nối Từ Tiếp Sức</span>
                        <span class="game-meta-badge" id="chain-lives-display">❤️❤️❤️</span>
                        <span class="game-meta-badge score-badge">Điểm: <strong id="chain-score">0</strong></span>
                        <span class="game-meta-badge" id="chain-combo-badge" style="display:none; color:#ea580c; font-weight:700;">🔥 Combo x0</span>
                    </div>
                    <button class="btn-pill" id="btn-chain-restart">🔄 Chơi Lại</button>
                </div>

                <div class="chain-wrapper" id="chain-box">
                    <div class="chain-timer-bar-wrap">
                        <div class="chain-timer-bar-fill" id="chain-timer-bar"></div>
                    </div>

                    <div style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;">
                        📜 Chuỗi Rồng Từ Vựng (Đã nối được <span id="chain-len">1</span> từ):
                    </div>
                    <div class="chain-track-box" id="chain-track">
                        <!-- Chain Nodes -->
                    </div>

                    <div class="chain-target-prompt">
                        <div style="font-size: 14.5px; color: var(--text-muted); margin-bottom: 4px;">
                            Tìm từ vựng bắt đầu bằng chữ Hán:
                        </div>
                        <div class="chain-target-char" id="chain-target-char">?</div>
                        <div style="font-size: 13px; color: #ea580c;" id="chain-target-hint">
                            Thời gian suy nghĩ: 12 giây!
                        </div>
                    </div>

                    <div class="chain-choices-grid" id="chain-choices">
                        <!-- 4 Choice buttons -->
                    </div>

                    <div id="chain-feedback" style="min-height: 24px; text-align: center; margin-top: 16px; font-weight: 600;"></div>
                </div>
            </div>
        `;

        document.getElementById("btn-chain-back").addEventListener("click", () => {
            clearGameTimers();
            renderGameHub();
        });
        document.getElementById("btn-chain-restart").addEventListener("click", startWordChain);

        function renderChainTrack() {
            const track = document.getElementById("chain-track");
            const chainLenElem = document.getElementById("chain-len");
            if (!track) return;
            if (chainLenElem) chainLenElem.textContent = chainHistory.length;

            track.innerHTML = chainHistory.map((item, idx) => `
                <div class="chain-node ${idx === chainHistory.length - 1 ? 'current' : ''}">
                    <span>${escapeHtml(item.hz)}</span>
                    <span style="font-size: 11px; opacity: 0.75;">(${escapeHtml(item.py)})</span>
                </div>
                ${idx < chainHistory.length - 1 ? '<span class="chain-node-arrow">➔</span>' : ''}
            `).join("");

            setTimeout(() => {
                track.scrollLeft = track.scrollWidth;
            }, 50);
        }

        function updateHUD() {
            const livesElem = document.getElementById("chain-lives-display");
            if (livesElem) {
                let h = "";
                for (let i = 0; i < 3; i++) h += (i < lives) ? "❤️" : "🖤";
                livesElem.textContent = h;
            }
            const scoreElem = document.getElementById("chain-score");
            if (scoreElem) scoreElem.textContent = score;

            const comboBadge = document.getElementById("chain-combo-badge");
            if (comboBadge) {
                if (combo >= 2) {
                    comboBadge.style.display = "inline-flex";
                    comboBadge.textContent = `🔥 Combo x${combo}`;
                } else {
                    comboBadge.style.display = "none";
                }
            }
        }

        function nextTurn() {
            if (lives <= 0 || totalAnswered >= targetRounds) {
                finishWordChain();
                return;
            }

            renderChainTrack();
            updateHUD();

            const lastWord = chainHistory[chainHistory.length - 1];
            const lastChar = lastWord.hz.slice(-1);

            const targetCharElem = document.getElementById("chain-target-char");
            if (targetCharElem) targetCharElem.textContent = lastChar;

            // Find valid continuation candidate
            let validNext = BOYA_WORD_CHAIN_DATA.find(w => w.hz.startsWith(lastChar) && !chainHistory.some(ch => ch.hz === w.hz));
            if (!validNext) {
                validNext = words.find(w => w.hz.startsWith(lastChar) && !chainHistory.some(ch => ch.hz === w.hz));
            }
            if (!validNext) {
                validNext = BOYA_WORD_CHAIN_DATA.find(w => w.hz.startsWith(lastChar));
            }
            if (!validNext) {
                validNext = BOYA_WORD_CHAIN_DATA[(chainHistory.length) % BOYA_WORD_CHAIN_DATA.length];
                if (targetCharElem) targetCharElem.textContent = validNext.hz[0];
            }

            // Distractors: 3 words not starting with lastChar
            const distractors = words.filter(w => !w.hz.startsWith(lastChar) && w.hz !== validNext.hz);
            shuffleArray(distractors);
            const choices = [validNext, ...distractors.slice(0, 3)];
            shuffleArray(choices);

            const choicesGrid = document.getElementById("chain-choices");
            const feedbackElem = document.getElementById("chain-feedback");
            const timerBar = document.getElementById("chain-timer-bar");
            if (feedbackElem) feedbackElem.textContent = "";

            if (choicesGrid) {
                choicesGrid.innerHTML = choices.map(c => `
                    <div class="chain-choice-btn" data-hz="${escapeHtml(c.hz)}" data-is-correct="${c.hz === validNext.hz}">
                        <div class="chain-choice-hz">${escapeHtml(c.hz)}</div>
                        <div class="chain-choice-py">${escapeHtml(c.py)}</div>
                        <div class="chain-choice-mean">${escapeHtml(c.mean)}</div>
                    </div>
                `).join("");
            }

            if (timerBar) {
                timerBar.style.width = "100%";
                timerBar.style.background = "#10b981";
            }

            let startTime = Date.now();
            clearInterval(timerInterval);
            let answered = false;

            timerInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, TIME_LIMIT - elapsed);
                const pct = (remaining / TIME_LIMIT) * 100;

                if (timerBar) {
                    timerBar.style.width = `${pct}%`;
                    if (pct < 30) timerBar.style.background = "#ef4444";
                    else if (pct < 60) timerBar.style.background = "#f59e0b";
                }

                if (remaining <= 0) {
                    clearInterval(timerInterval);
                    if (!answered) {
                        answered = true;
                        handleTimeout(validNext);
                    }
                }
            }, 50);
            addGameTimer(timerInterval);

            // Handle user click
            const btns = choicesGrid.querySelectorAll(".chain-choice-btn");
            btns.forEach(btn => {
                btn.addEventListener("click", () => {
                    if (answered) return;
                    answered = true;
                    clearInterval(timerInterval);

                    const isCorrect = btn.dataset.isCorrect === "true";
                    totalAnswered++;

                    if (isCorrect) {
                        soundFX.correct();
                        combo++;
                        if (combo > maxCombo) maxCombo = combo;
                        const elapsed = Date.now() - startTime;
                        const timeBonus = Math.max(0, Math.round((TIME_LIMIT - elapsed) / 100));
                        const pts = 100 + timeBonus + (combo * 15);
                        score += pts;

                        btn.style.borderColor = "#10b981";
                        btn.style.background = "#ecfdf5";
                        if (feedbackElem) {
                            feedbackElem.style.color = "#10b981";
                            feedbackElem.textContent = `🎉 Nối chuỗi thành công! (+${pts} điểm)`;
                        }

                        speakChinese(validNext.hz);
                        chainHistory.push(validNext);

                        setTimeout(nextTurn, 1000);
                    } else {
                        soundFX.wrong();
                        lives--;
                        combo = 0;
                        btn.style.borderColor = "#ef4444";
                        btn.style.background = "#fef2f2";

                        btns.forEach(b => {
                            if (b.dataset.isCorrect === "true") {
                                b.style.borderColor = "#10b981";
                                b.style.background = "#ecfdf5";
                            }
                        });

                        if (feedbackElem) {
                            feedbackElem.style.color = "#ef4444";
                            feedbackElem.textContent = `❌ Chưa chính xác! Chữ tiếp theo bắt đầu bằng "${lastChar}" là: ${validNext.hz}`;
                        }

                        speakChinese(validNext.hz);
                        updateHUD();
                        setTimeout(nextTurn, 1500);
                    }
                });
            });
        }

        function handleTimeout(validNext) {
            totalAnswered++;
            soundFX.wrong();
            lives--;
            combo = 0;
            updateHUD();

            const feedbackElem = document.getElementById("chain-feedback");
            if (feedbackElem) {
                feedbackElem.style.color = "#ef4444";
                feedbackElem.textContent = `⏰ Hết thời gian 12 giây! Từ cần nối là: ${validNext.hz} (${validNext.py})`;
            }

            const choicesGrid = document.getElementById("chain-choices");
            if (choicesGrid) {
                choicesGrid.querySelectorAll(".chain-choice-btn").forEach(b => {
                    if (b.dataset.isCorrect === "true") {
                        b.style.borderColor = "#10b981";
                        b.style.background = "#ecfdf5";
                    }
                });
            }

            speakChinese(validNext.hz);
            setTimeout(nextTurn, 1600);
        }

        function finishWordChain() {
            clearInterval(timerInterval);
            const box = document.getElementById("chain-box");
            if (!box) return;
            soundFX.fanfare();

            box.innerHTML = `
                <div class="cloze-card" style="padding: 40px 20px;">
                    <div style="font-size: 56px; margin-bottom: 12px;">🐉</div>
                    <h2 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">
                        ${lives > 0 ? "Tuyệt Đỉnh Nối Từ Tiếp Sức!" : "Kết Thúc Lượt Chơi!"}
                    </h2>
                    <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 14px;">
                        Bạn đã tạo nên chuỗi Rồng gồm <strong>${chainHistory.length} từ vựng</strong> liên tiếp!
                    </p>
                    <div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 24px;">
                        <div>Combo lớn nhất: <strong style="color: #ea580c;">x${maxCombo}</strong></div>
                        <div>Mạng còn lại: <strong>${lives}/3</strong></div>
                    </div>
                    <div style="font-size: 38px; font-weight: 700; color: #ea580c; margin-bottom: 28px;">
                        ${score} Điểm
                    </div>
                    <div style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap;">
                        <button class="btn-pill" id="btn-chain-again">🔄 Thử Thách Lại</button>
                        <button class="btn-pill" id="btn-chain-to-hub">🏠 Về Khu Trò Chơi</button>
                    </div>
                </div>
            `;

            document.getElementById("btn-chain-again").addEventListener("click", startWordChain);
            document.getElementById("btn-chain-to-hub").addEventListener("click", renderGameHub);
        }

        nextTurn();
    }

    // =========================================================================
    // GAME 11: HANZI WORDLE (WORDLE CHỮ HÁN / 猜词宝典)
    // =========================================================================
    function startHanziWordle() {
        clearGameTimers();
        state.activeGame = "wordle";
        const container = document.getElementById("games-container") || document.getElementById("match-container");
        if (!container) return;

        // Filter 2-character words
        let pool = getFilteredWords().filter(w => w.hz && w.hz.length === 2);
        if (pool.length < 8) {
            pool = state.allWords.filter(w => w.hz && w.hz.length === 2);
        }

        const targetWord = pool[Math.floor(Math.random() * pool.length)];
        const maxAttempts = 5;
        let currentAttempt = 0;
        let currentInput = [];
        let isGameOver = false;
        let showHint = false;

        // Generate virtual keypad characters
        const keypadCharSet = new Set([targetWord.hz[0], targetWord.hz[1]]);
        shuffleArray(pool);
        for (const w of pool) {
            if (keypadCharSet.size >= 14) break;
            if (w.hz[0]) keypadCharSet.add(w.hz[0]);
            if (w.hz[1] && keypadCharSet.size < 14) keypadCharSet.add(w.hz[1]);
        }
        const keypadChars = [...keypadCharSet];
        shuffleArray(keypadChars);

        container.innerHTML = `
            <div class="game-play-wrapper">
                <div class="game-nav-header">
                    <button class="btn-pill btn-back-hub" id="btn-wordle-back">← Khu Trò Chơi</button>
                    <div class="game-meta-group">
                        <span class="game-meta-badge">🟩 Hanzi Wordle</span>
                        <span class="game-meta-badge" id="wordle-attempt-badge">Lượt thử: 1 / ${maxAttempts}</span>
                    </div>
                    <button class="btn-pill" id="btn-wordle-restart">🔄 Từ Khác</button>
                </div>

                <div class="wordle-card" id="wordle-box">
                    <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 6px;">
                        ĐOÁN TỪ VỰNG 2 CHỮ HÁN TRONG 5 LƯỢT THỬ
                    </div>
                    <div style="font-size: 13.5px; color: #64748b; margin-bottom: 16px;">
                        🟩 <strong>Xanh lá</strong>: Đúng chữ & đúng vị trí &nbsp;|&nbsp; 🟨 <strong>Vàng</strong>: Có trong từ nhưng sai vị trí &nbsp;|&nbsp; ⬜ <strong>Xám</strong>: Không có trong từ
                    </div>

                    <!-- Nút Mở Gợi Ý -->
                    <div style="margin-bottom: 18px;">
                        <button class="btn-pill" id="btn-wordle-hint" style="font-size: 13px; padding: 6px 16px;">
                            💡 Mở Gợi Ý Nghĩa Tiếng Việt
                        </button>
                        <div id="wordle-hint-text" style="display:none; margin-top: 8px; font-size: 15px; font-weight: 600; color: #0284c7;">
                            Nghĩa từ: <em>${escapeHtml(targetWord.mean)}</em>
                        </div>
                    </div>

                    <!-- Bàn cờ 5 hàng x 2 ô -->
                    <div class="wordle-board" id="wordle-board">
                        ${Array.from({ length: maxAttempts }).map((_, rIdx) => `
                            <div class="wordle-row" id="wordle-row-${rIdx}">
                                <div class="wordle-tile" id="tile-${rIdx}-0"></div>
                                <div class="wordle-tile" id="tile-${rIdx}-1"></div>
                            </div>
                        `).join("")}
                    </div>

                    <!-- Thông báo trạng thái -->
                    <div id="wordle-message" style="min-height: 24px; font-size: 14.5px; font-weight: 600; margin-bottom: 12px;"></div>

                    <!-- Bàn phím ký tự ảo -->
                    <div class="wordle-keypad" id="wordle-keypad">
                        ${keypadChars.map(char => `
                            <button class="wordle-key" data-char="${escapeHtml(char)}">${escapeHtml(char)}</button>
                        `).join("")}
                    </div>

                    <!-- Phím chức năng -->
                    <div style="display: flex; justify-content: center; gap: 12px; margin-top: 10px;">
                        <button class="btn-pill" id="btn-wordle-delete" style="font-weight: 700;">⌫ Xóa</button>
                        <button class="btn-pill" id="btn-wordle-submit" style="background: #10b981; color: #ffffff; border-color: #10b981; font-weight: 700;">✓ Xác Nhận Đoán</button>
                    </div>

                    <div id="wordle-solution-card"></div>
                </div>
            </div>
        `;

        document.getElementById("btn-wordle-back").addEventListener("click", renderGameHub);
        document.getElementById("btn-wordle-restart").addEventListener("click", startHanziWordle);

        // Hint button
        const hintBtn = document.getElementById("btn-wordle-hint");
        const hintText = document.getElementById("wordle-hint-text");
        if (hintBtn) {
            hintBtn.addEventListener("click", () => {
                showHint = !showHint;
                hintText.style.display = showHint ? "block" : "none";
                hintBtn.textContent = showHint ? "🙈 Ẩn Gợi Ý" : "💡 Mở Gợi Ý Nghĩa Tiếng Việt";
            });
        }

        const messageElem = document.getElementById("wordle-message");
        const keypadElem = document.getElementById("wordle-keypad");

        function updateBoardInput() {
            const tile0 = document.getElementById(`tile-${currentAttempt}-0`);
            const tile1 = document.getElementById(`tile-${currentAttempt}-1`);
            if (tile0) {
                tile0.textContent = currentInput[0] || "";
                if (currentInput[0]) tile0.classList.add("active-input");
                else tile0.classList.remove("active-input");
            }
            if (tile1) {
                tile1.textContent = currentInput[1] || "";
                if (currentInput[1]) tile1.classList.add("active-input");
                else tile1.classList.remove("active-input");
            }
        }

        // Key click handlers
        keypadElem.querySelectorAll(".wordle-key").forEach(key => {
            key.addEventListener("click", () => {
                if (isGameOver) return;
                if (currentInput.length < 2) {
                    currentInput.push(key.dataset.char);
                    soundFX.tick();
                    updateBoardInput();
                }
            });
        });

        // Delete handler
        document.getElementById("btn-wordle-delete").addEventListener("click", () => {
            if (isGameOver) return;
            if (currentInput.length > 0) {
                currentInput.pop();
                soundFX.tick();
                updateBoardInput();
            }
        });

        // Submit handler
        document.getElementById("btn-wordle-submit").addEventListener("click", submitGuess);

        function submitGuess() {
            if (isGameOver) return;
            if (currentInput.length < 2) {
                if (messageElem) {
                    messageElem.style.color = "#ef4444";
                    messageElem.textContent = "⚠️ Hãy chọn đủ 2 chữ Hán trước khi xác nhận!";
                }
                return;
            }

            const guess = currentInput.join("");
            const tile0 = document.getElementById(`tile-${currentAttempt}-0`);
            const tile1 = document.getElementById(`tile-${currentAttempt}-1`);

            // Evaluate colors
            const target = targetWord.hz;
            const evalRes = [null, null];

            // First pass: exact matches
            if (guess[0] === target[0]) evalRes[0] = "correct";
            if (guess[1] === target[1]) evalRes[1] = "correct";

            // Second pass: present matches
            if (evalRes[0] === null) {
                evalRes[0] = (guess[0] === target[1] && evalRes[1] !== "correct") ? "present" : "absent";
            }
            if (evalRes[1] === null) {
                evalRes[1] = (guess[1] === target[0] && evalRes[0] !== "correct") ? "present" : "absent";
            }

            // Apply to board tiles
            if (tile0) tile0.classList.add(evalRes[0]);
            if (tile1) tile1.classList.add(evalRes[1]);

            // Update keypad keys
            currentInput.forEach((char, idx) => {
                const key = keypadElem.querySelector(`.wordle-key[data-char="${char}"]`);
                if (key) {
                    if (evalRes[idx] === "correct") {
                        key.className = "wordle-key key-correct";
                    } else if (evalRes[idx] === "absent" && !key.classList.contains("key-correct")) {
                        key.className = "wordle-key key-absent";
                    }
                }
            });

            // Check Win
            if (guess === target) {
                isGameOver = true;
                soundFX.correct();
                soundFX.fanfare();
                speakChinese(targetWord.hz);
                showWordleResult(true);
                return;
            }

            // Next attempt
            currentAttempt++;
            currentInput = [];
            document.getElementById("wordle-attempt-badge").textContent = `Lượt thử: ${Math.min(currentAttempt + 1, maxAttempts)} / ${maxAttempts}`;

            if (currentAttempt >= maxAttempts) {
                isGameOver = true;
                soundFX.wrong();
                speakChinese(targetWord.hz);
                showWordleResult(false);
            } else {
                soundFX.tick();
                if (messageElem) {
                    messageElem.style.color = "#d97706";
                    messageElem.textContent = `Lượt thử tiếp theo! Bạn còn ${maxAttempts - currentAttempt} lượt.`;
                }
            }
        }

        function showWordleResult(isWin) {
            const solutionCard = document.getElementById("wordle-solution-card");
            if (!solutionCard) return;

            solutionCard.innerHTML = `
                <div class="cloze-feedback-box" style="margin-top: 24px; border-left-color: ${isWin ? '#10b981' : '#ef4444'}; background: ${isWin ? '#ecfdf5' : '#fef2f2'};">
                    <div style="flex: 1;">
                        <div style="font-weight: 700; color: ${isWin ? '#047857' : '#b91c1c'}; margin-bottom: 6px; font-size: 16px;">
                            ${isWin ? '🎉 CHÚC MỪNG BẠN ĐÃ ĐOÁN ĐÚNG!' : '❌ HẾT LƯỢT THỬ! TỪ BÍ MẬT LÀ:'}
                        </div>
                        <div style="font-size: 26px; font-family: KaiTi, serif; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                            ${escapeHtml(targetWord.hz)} <span style="font-size: 16px; font-family: inherit; color: #ea580c; font-weight: 500;">(${escapeHtml(targetWord.py)})</span>
                        </div>
                        <div style="font-size: 14.5px; color: #334155;">
                            Ý nghĩa: <strong>${escapeHtml(targetWord.mean)}</strong>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <button class="btn-pill" id="btn-wordle-speak">🔊 Nghe đọc</button>
                        <button class="btn-pill" id="btn-wordle-next" style="background: #10b981; color: #ffffff; border-color: #10b981;">Đoán Từ Tiếp Theo ▶</button>
                    </div>
                </div>
            `;

            document.getElementById("btn-wordle-speak").addEventListener("click", () => speakChinese(targetWord.hz));
            document.getElementById("btn-wordle-next").addEventListener("click", startHanziWordle);
        }
    }

    // =========================================================================
    // GAME 12: VOCABULARY BOSS BATTLE (ĐẤU BOSS TỪ VỰNG / RPG BATTLE)
    // =========================================================================
    function startBossBattle() {
        clearGameTimers();
        state.activeGame = "boss";
        const container = document.getElementById("games-container") || document.getElementById("match-container");
        if (!container) return;

        let words = getFilteredWords();
        if (words.length < 8) words = state.allWords;

        const BOSS_MAX_HP = 1000;
        let bossHP = BOSS_MAX_HP;
        let playerHearts = 3;
        let score = 0;
        let combo = 0;
        let currentQIdx = 0;
        let qStartTime = 0;
        let answered = false;

        const shuffledPool = [...words];
        shuffleArray(shuffledPool);

        container.innerHTML = `
            <div class="game-play-wrapper">
                <div class="game-nav-header">
                    <button class="btn-pill btn-back-hub" id="btn-boss-back">← Khu Trò Chơi</button>
                    <div class="game-meta-group">
                        <span class="game-meta-badge">⚔️ Đấu Boss Từ Vựng</span>
                        <span class="game-meta-badge score-badge">Điểm: <strong id="boss-score">0</strong></span>
                    </div>
                    <button class="btn-pill" id="btn-boss-restart">🔄 Khiêu Chiến Lại</button>
                </div>

                <div class="boss-arena" id="boss-arena">
                    <div class="boss-top-hud">
                        <div class="player-hearts" id="boss-hearts">
                            ❤️❤️❤️
                        </div>
                        <div id="boss-combo-tag" style="font-weight: 700; color: #f59e0b; font-size: 15px;"></div>
                    </div>

                    <div class="boss-status-box">
                        <div class="boss-avatar-wrapper">
                            <div class="boss-avatar-icon" id="boss-icon">👹</div>
                        </div>
                        <div style="font-size: 16px; font-weight: 700; letter-spacing: 1px; color: #fca5a5;">
                            MA VƯƠNG QUÊN LÃNG (遗忘魔王)
                        </div>
                        <div class="boss-hp-track">
                            <div class="boss-hp-fill" id="boss-hp-bar" style="width: 100%;"></div>
                            <span class="boss-hp-text" id="boss-hp-text">1000 / 1000 HP</span>
                        </div>
                    </div>

                    <div class="boss-question-card" id="boss-q-card">
                        <div id="boss-q-header" style="font-size: 14px; color: #94a3b8; margin-bottom: 8px;">
                            CÂU HỎI TẤN CÔNG (Đáp nhanh dưới 3.5s để gây BẠO KÍCH!)
                        </div>
                        <div class="boss-q-prompt" id="boss-q-prompt">...</div>
                        <div class="boss-answers-grid" id="boss-answers">
                            <!-- 4 answer choices -->
                        </div>
                    </div>

                    <div id="boss-float-zone"></div>
                </div>
            </div>
        `;

        document.getElementById("btn-boss-back").addEventListener("click", () => {
            clearGameTimers();
            renderGameHub();
        });
        document.getElementById("btn-boss-restart").addEventListener("click", startBossBattle);

        function updateHUD() {
            const heartsElem = document.getElementById("boss-hearts");
            if (heartsElem) {
                let h = "";
                for (let i = 0; i < 3; i++) h += (i < playerHearts) ? "❤️" : "🖤";
                heartsElem.textContent = h;
            }
            const scoreElem = document.getElementById("boss-score");
            if (scoreElem) scoreElem.textContent = score;

            const comboElem = document.getElementById("boss-combo-tag");
            if (comboElem) {
                comboElem.textContent = combo >= 2 ? `🔥 Combo x${combo}` : "";
            }

            const hpBar = document.getElementById("boss-hp-bar");
            const hpText = document.getElementById("boss-hp-text");
            if (hpBar) {
                const pct = Math.max(0, (bossHP / BOSS_MAX_HP) * 100);
                hpBar.style.width = `${pct}%`;
            }
            if (hpText) {
                hpText.textContent = `${Math.max(0, bossHP)} / ${BOSS_MAX_HP} HP`;
            }
        }

        function triggerDamageFloat(amount, isCrit) {
            const arena = document.getElementById("boss-arena");
            if (!arena) return;
            const floatElem = document.createElement("div");
            floatElem.className = "boss-damage-float";
            floatElem.textContent = isCrit ? `-${amount} ⚡ BẠO KÍCH!` : `-${amount}`;
            if (isCrit) {
                floatElem.style.color = "#f59e0b";
                floatElem.style.fontSize = "38px";
            }
            arena.appendChild(floatElem);
            setTimeout(() => floatElem.remove(), 800);
        }

        function triggerBossShake() {
            const icon = document.getElementById("boss-icon");
            if (icon) {
                icon.classList.add("hit");
                setTimeout(() => icon.classList.remove("hit"), 400);
            }
        }

        function loadQuestion() {
            if (bossHP <= 0) {
                finishBossBattle(true);
                return;
            }
            if (playerHearts <= 0) {
                finishBossBattle(false);
                return;
            }

            answered = false;
            updateHUD();

            const targetWord = shuffledPool[currentQIdx % shuffledPool.length];
            currentQIdx++;

            // Question types: 0: Hz->Mean, 1: Py->Hz, 2: Mean->Hz, 3: Audio->Hz
            const qType = Math.floor(Math.random() * 4);

            const promptElem = document.getElementById("boss-q-prompt");
            const answersGrid = document.getElementById("boss-answers");
            const headerElem = document.getElementById("boss-q-header");

            // Pick 3 distractors
            const otherWords = words.filter(w => w.id !== targetWord.id);
            shuffleArray(otherWords);
            const distractors = otherWords.slice(0, 3);
            const choices = [targetWord, ...distractors];
            shuffleArray(choices);

            let promptHtml = "";
            let choiceFormatter = null;

            if (qType === 0) {
                headerElem.textContent = "⚔️ TẤN CÔNG: Chọn nghĩa tiếng Việt của chữ Hán sau:";
                promptHtml = `${escapeHtml(targetWord.hz)} <span style="font-size:20px; color:#f97316;">(${escapeHtml(targetWord.py)})</span>`;
                choiceFormatter = (w) => escapeHtml(w.mean);
            } else if (qType === 1) {
                headerElem.textContent = "⚔️ TẤN CÔNG: Chọn chữ Hán có phiên âm tương ứng:";
                promptHtml = `${escapeHtml(targetWord.py)}`;
                choiceFormatter = (w) => `${escapeHtml(w.hz)} <span style="font-size:12px; opacity:0.8;">(${escapeHtml(w.mean)})</span>`;
            } else if (qType === 2) {
                headerElem.textContent = "⚔️ TẤN CÔNG: Chọn chữ Hán có nghĩa tương ứng:";
                promptHtml = `"${escapeHtml(targetWord.mean)}"`;
                choiceFormatter = (w) => `${escapeHtml(w.hz)} <span style="font-size:12px; opacity:0.8;">(${escapeHtml(w.py)})</span>`;
            } else {
                headerElem.textContent = "⚔️ TẤN CÔNG: Lắng nghe và chọn chữ Hán đúng:";
                promptHtml = `<button class="btn-pill" id="btn-boss-audio" style="font-size:18px; padding:10px 24px;">🔊 Phát Âm</button>`;
                choiceFormatter = (w) => `${escapeHtml(w.hz)} <span style="font-size:12px; opacity:0.8;">(${escapeHtml(w.mean)})</span>`;
            }

            promptElem.innerHTML = promptHtml;

            if (qType === 3) {
                speakChinese(targetWord.hz);
                const audioBtn = document.getElementById("btn-boss-audio");
                if (audioBtn) audioBtn.addEventListener("click", () => speakChinese(targetWord.hz));
            }

            answersGrid.innerHTML = choices.map(w => `
                <button class="boss-ans-btn" data-id="${w.id}">
                    ${choiceFormatter(w)}
                </button>
            `).join("");

            qStartTime = Date.now();

            answersGrid.querySelectorAll(".boss-ans-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    if (answered) return;
                    answered = true;

                    const isCorrect = btn.dataset.id == targetWord.id;
                    const responseTime = (Date.now() - qStartTime) / 1000;

                    if (isCorrect) {
                        soundFX.correct();
                        combo++;
                        const isCrit = responseTime <= 3.5;
                        const damage = isCrit ? 200 : 100;
                        bossHP -= damage;
                        score += (isCrit ? 250 : 100) + (combo * 20);

                        btn.style.background = "#10b981";
                        btn.style.borderColor = "#10b981";

                        triggerBossShake();
                        triggerDamageFloat(damage, isCrit);
                        updateHUD();
                        speakChinese(targetWord.hz);

                        setTimeout(loadQuestion, 900);
                    } else {
                        soundFX.wrong();
                        playerHearts--;
                        combo = 0;

                        btn.style.background = "#ef4444";
                        btn.style.borderColor = "#ef4444";

                        // Highlight correct button
                        answersGrid.querySelectorAll(".boss-ans-btn").forEach(b => {
                            if (b.dataset.id == targetWord.id) {
                                b.style.background = "#10b981";
                                b.style.borderColor = "#10b981";
                            }
                        });

                        updateHUD();
                        speakChinese(targetWord.hz);

                        setTimeout(loadQuestion, 1200);
                    }
                });
            });
        }

        function finishBossBattle(isVictory) {
            const arena = document.getElementById("boss-arena");
            if (!arena) return;

            if (isVictory) soundFX.fanfare();
            else soundFX.wrong();

            arena.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 64px; margin-bottom: 14px;">
                        ${isVictory ? "🏆" : "💀"}
                    </div>
                    <h2 style="font-size: 26px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">
                        ${isVictory ? "CHIẾN THẮNG HUY HOÀNG!" : "BẠN ĐÃ BỊ MA VƯƠNG ĐÁNH BẠI!"}
                    </h2>
                    <p style="color: #cbd5e1; font-size: 15px; margin-bottom: 24px;">
                        ${isVictory 
                            ? "Bạn đã tiêu diệt hoàn toàn Ma Vương Quên Lãng và giải phóng kho tàng từ vựng!" 
                            : "Ma Vương Quên Lãng quá mạnh mẽ. Hãy rèn luyện thêm từ vựng để quay lại báo thù!"}
                    </p>

                    <div style="background: rgba(255,255,255,0.1); border-radius: 14px; padding: 18px; max-width: 400px; margin: 0 auto 28px auto;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Sát thương gây ra:</span>
                            <strong style="color: #fca5a5;">${BOSS_MAX_HP - Math.max(0, bossHP)} HP</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Mạng còn lại:</span>
                            <strong>${playerHearts} / 3</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Điểm chiến tích:</span>
                            <strong style="color: #fef08a; font-size: 18px;">${score} Điểm</strong>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap;">
                        <button class="btn-pill" id="btn-boss-retry" style="background: #f59e0b; color: #ffffff; border-color: #f59e0b;">
                            ${isVictory ? "⚔️ Tái Đấu Ma Vương" : "🔥 Hồi Sinh & Đấu Lại"}
                        </button>
                        <button class="btn-pill" id="btn-boss-to-hub">🏠 Về Khu Trò Chơi</button>
                    </div>
                </div>
            `;

            document.getElementById("btn-boss-retry").addEventListener("click", startBossBattle);
            document.getElementById("btn-boss-to-hub").addEventListener("click", renderGameHub);
        }

        loadQuestion();
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
