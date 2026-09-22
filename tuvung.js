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
                    <h2>🎮 Khu Trò Chơi Ôn Tập Từ Vựng</h2>
                    <p>Kho từ hiện tại: <strong>${wordCount} từ</strong> (theo phạm vi bộ lọc đang chọn). Hãy chọn trò chơi yêu thích để bắt đầu!</p>
                </div>

                <div class="game-hub-grid">
                    <div class="game-card-item game-card-1" data-game="match">
                        <div class="game-card-top">
                            <span class="game-card-icon">🧩</span>
                            <span class="game-card-badge">Trí Nhớ & Ghép Đôi</span>
                        </div>
                        <div class="game-card-title">1. Ghép Cặp Thẻ (Card Matching)</div>
                        <div class="game-card-desc">Lật và ghép các cặp Chữ Hán với Nghĩa Tiếng Việt tương ứng nhanh nhất có thể.</div>
                        <button class="game-card-btn">Chơi Ngay ▶</button>
                    </div>

                    <div class="game-card-item game-card-2" data-game="tf">
                        <div class="game-card-top">
                            <span class="game-card-icon">⚡</span>
                            <span class="game-card-badge">Phản Xạ Cực Nhanh</span>
                        </div>
                        <div class="game-card-title">2. Đúng Hay Sai? (Speed Rush)</div>
                        <div class="game-card-desc">Chữ Hán và Nghĩa có khớp nhau không? Phản xạ 5 giây, bảo vệ 3 mạng sống và tích chuỗi combo!</div>
                        <button class="game-card-btn">Chơi Ngay ▶</button>
                    </div>

                    <div class="game-card-item game-card-3" data-game="scramble">
                        <div class="game-card-top">
                            <span class="game-card-icon">🔤</span>
                            <span class="game-card-badge">Tái Tạo Chữ Hán</span>
                        </div>
                        <div class="game-card-title">3. Xếp Từ Hán Tự (Scramble Builder)</div>
                        <div class="game-card-desc">Sắp xếp các ký tự Hán tự bị xáo trộn vào đúng vị trí để tạo thành từ vựng hoàn chỉnh.</div>
                        <button class="game-card-btn">Chơi Ngay ▶</button>
                    </div>

                    <div class="game-card-item game-card-4" data-game="hunter">
                        <div class="game-card-top">
                            <span class="game-card-icon">🎯</span>
                            <span class="game-card-badge">Luyện Nghe Phản Xạ</span>
                        </div>
                        <div class="game-card-title">4. Bắt Chữ Theo Âm (Audio Hunter)</div>
                        <div class="game-card-desc">Lắng nghe phát âm chuẩn và nhanh tay chọn trúng Chữ Hán chính xác trong 6 mục tiêu!</div>
                        <button class="game-card-btn">Chơi Ngay ▶</button>
                    </div>
                </div>
            </div>
        `;

        container.querySelectorAll(".game-card-item").forEach(card => {
            card.addEventListener("click", () => {
                const gameType = card.dataset.game;
                if (gameType === "match") startMatchingGame();
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
