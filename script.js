/**
 * ==========================================================================
 * BOYA CHINESE - SCRIPT.JS (TC1, TC2, TC3, TC4)
 * Điều khiển: Trình phát audio, Menu chọn bài, Sub-tabs, Pinyin, TTS, Zoom chữ
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", function () {
    // 1. Tự động nhận diện Quyển và áp dụng Theme
    const bookInfo = initBookTheme();

    // 2. Tự động chèn Header điều hướng và Reader Toolbar (nếu chưa có)
    injectAppHeader(bookInfo);
    injectReaderToolbar();
    enhanceLessonNavigation();

    // 3. Tự động chèn các nút nghe Audio cho Bài Khóa, Từ Vựng, Đọc Thêm
    initLessonAudioButtons(bookInfo);

    // 4. Kích hoạt Trình phát Audio sticky đáy màn hình
    initGlobalAudioPlayer();

    // 5. Kích hoạt tính năng Text-to-Speech (TTS) cho bảng từ vựng
    initVocabTableTTS();

    // 6. Khởi tạo kích thước chữ đã lưu (nếu có)
    initSavedFontSize();
});

// ==========================================================================
// 1. THEME & BOOK DETECTION
// ==========================================================================
function initBookTheme() {
    let bookNumber = 1;
    let bookName = "Trung Cấp 1";
    let bookLessons = 16;
    let bookWords = "540 từ";
    let bookColor = "#2563eb";

    const currentFileName = window.location.pathname.split("/").pop().toLowerCase();

    if (currentFileName.includes("tc2")) {
        bookNumber = 2;
        bookName = "Trung Cấp 2";
        bookLessons = 16;
        bookWords = "762 từ";
        bookColor = "#ea580c";
    } else if (currentFileName.includes("tc3")) {
        bookNumber = 3;
        bookName = "Trung Cấp 3";
        bookLessons = 12;
        bookWords = "623 từ";
        bookColor = "#059669";
    } else if (currentFileName.includes("tc4")) {
        bookNumber = 4;
        bookName = "Trung Cấp 4";
        bookLessons = 10;
        bookWords = "640 từ";
        bookColor = "#7c3aed";
    }

    document.body.classList.add(`book-tc${bookNumber}`);

    return {
        number: bookNumber,
        name: bookName,
        lessons: bookLessons,
        words: bookWords,
        folder: `Trung cap ${bookNumber}`,
        color: bookColor
    };
}

// ==========================================================================
// 2. HEADER & TOOLBAR INJECTION
// ==========================================================================
function injectAppHeader(bookInfo) {
    if (document.querySelector(".app-header")) return;

    const header = document.createElement("header");
    header.className = "app-header";
    header.innerHTML = `
        <div class="header-inner">
            <a href="index.html" class="header-brand">
                <span class="brand-icon">🏮</span>
                <div class="brand-title">
                    <h1>Boya Chinese • ${bookInfo.name}</h1>
                    <span>${bookInfo.lessons} Bài học • ${bookInfo.words}</span>
                </div>
            </a>

            <nav class="book-pill-nav" aria-label="Chọn quyển">
                <a href="tc1.html" class="${bookInfo.number === 1 ? 'active' : ''}">📘 Quyển 1</a>
                <a href="tc2.html" class="${bookInfo.number === 2 ? 'active' : ''}">📙 Quyển 2</a>
                <a href="tc3.html" class="${bookInfo.number === 3 ? 'active' : ''}">📗 Quyển 3</a>
                <a href="tc4.html" class="${bookInfo.number === 4 ? 'active' : ''}">📔 Quyển 4</a>
            </nav>

            <div class="header-actions">
                <a href="tuvung.html" class="header-btn vocab-link" title="Đến trung tâm ôn tập từ vựng & chơi trò chơi">
                    🏮 Ôn Từ Vựng
                </a>
                <a href="index.html" class="header-btn" title="Về trang chọn quyển">
                    🏠 Trang Chủ
                </a>
            </div>
        </div>
    `;

    document.body.insertBefore(header, document.body.firstChild);
}

function injectReaderToolbar() {
    if (document.querySelector(".reader-toolbar")) return;

    const mainMenu = document.querySelector(".main-menu");
    if (!mainMenu) return;

    const toolbar = document.createElement("div");
    toolbar.className = "reader-toolbar";
    toolbar.innerHTML = `
        <div class="toolbar-left">
            <span class="toolbar-label">⚙️ Tiện ích:</span>
            <button class="tool-btn" id="btn-toggle-pinyin" onclick="togglePinyinGlobal()" title="Ẩn/Hiện phiên âm Pinyin để tự luyện đọc">
                👁️ Ẩn/Hiện Pinyin
            </button>
            <button class="tool-btn" id="btn-toggle-translation" onclick="toggleTranslationGlobal()" title="Ẩn/Hiện phần dịch nghĩa tiếng Việt">
                🇻🇳 Ẩn/Hiện Bản Dịch
            </button>
        </div>

        <div class="toolbar-right">
            <span class="toolbar-label">Cỡ chữ Hán:</span>
            <div class="zoom-group">
                <button class="zoom-btn" onclick="adjustFontSize(-2)" title="Giảm cỡ chữ">A-</button>
                <span class="zoom-display" id="zoom-val-display">24px</span>
                <button class="zoom-btn" onclick="adjustFontSize(2)" title="Tăng cỡ chữ">A+</button>
            </div>
        </div>
    `;

    mainMenu.parentNode.insertBefore(toolbar, mainMenu);
}

function enhanceLessonNavigation() {
    const mainMenu = document.querySelector(".main-menu");
    if (!mainMenu || mainMenu.closest(".lesson-nav-card")) return;

    // Check if parent is not already a lesson-nav-card
    const card = document.createElement("div");
    card.className = "lesson-nav-card";

    const header = document.createElement("div");
    header.className = "lesson-nav-header";
    const totalBtns = mainMenu.querySelectorAll(".main-btn").length;
    header.innerHTML = `
        <span class="lesson-nav-title">📖 Chọn Bài Học</span>
        <span class="lesson-nav-badge">${totalBtns} Bài</span>
    `;

    mainMenu.parentNode.insertBefore(card, mainMenu);
    card.appendChild(header);
    card.appendChild(mainMenu);
}

// ==========================================================================
// 3. LESSON AUDIO BUTTONS GENERATION
// ==========================================================================
function initLessonAudioButtons(bookInfo) {
    const mainContentBlocks = document.querySelectorAll(".main-content");

    mainContentBlocks.forEach(block => {
        const blockId = block.id;
        if (!blockId.startsWith("bai")) return;

        const lessonNumber = parseInt(blockId.replace("bai", ""), 10);
        if (isNaN(lessonNumber)) return;

        const paddedLesson = String(lessonNumber).padStart(2, "0");
        const bookFolder = bookInfo.folder;

        // Xử lý tiêu đề bài học nếu chưa có card wrapper
        const titleElem = block.querySelector(".lesson-title");
        if (titleElem && !titleElem.closest(".lesson-title-card")) {
            const card = document.createElement("div");
            card.className = "lesson-title-card";

            const info = document.createElement("div");
            info.className = "lesson-title-info";
            info.innerHTML = `
                <span class="lesson-meta-pill">BÀI HỌC • 第 ${lessonNumber} 课</span>
            `;

            titleElem.parentNode.insertBefore(card, titleElem);
            info.appendChild(titleElem);
            card.appendChild(info);
        }

        // Bài Khóa Audio Button
        const baiKhoaContainer = document.getElementById(`${blockId}-baikhoa`);
        if (baiKhoaContainer && !baiKhoaContainer.querySelector(".play-audio-btn")) {
            const audioPathKhoa = `audio/${bookFolder}/第${paddedLesson}课 Bai Khoa.mp3`;
            const btnKhoa = document.createElement("button");
            btnKhoa.className = "play-audio-btn";
            btnKhoa.setAttribute("data-audio", audioPathKhoa);
            btnKhoa.setAttribute("data-title", `Boya ${bookFolder} - Bài ${lessonNumber} (Bài Khóa)`);
            btnKhoa.innerHTML = "🔊 Nghe Bài Khóa";
            baiKhoaContainer.insertBefore(btnKhoa, baiKhoaContainer.firstChild);
        }

        // Từ Vựng Audio Button
        const tuVungContainer = document.getElementById(`${blockId}-tuvung`);
        if (tuVungContainer && !tuVungContainer.querySelector(".play-audio-btn")) {
            const audioPathVung = `audio/${bookFolder}/第${paddedLesson}课 Tu Vung.mp3`;
            const btnVung = document.createElement("button");
            btnVung.className = "play-audio-btn";
            btnVung.setAttribute("data-audio", audioPathVung);
            btnVung.setAttribute("data-title", `Boya ${bookFolder} - Bài ${lessonNumber} (Từ Vựng)`);
            btnVung.innerHTML = "🔊 Nghe Toàn Bộ Từ Vựng";
            tuVungContainer.insertBefore(btnVung, tuVungContainer.firstChild);
        }

        // Đọc Thêm Audio Button (Chỉ áp dụng Quyển 3 & Quyển 4)
        if (bookInfo.number === 3 || bookInfo.number === 4) {
            const docThemContainer = document.getElementById(`${blockId}-docthem`);
            if (docThemContainer && !docThemContainer.querySelector(".play-audio-btn")) {
                const audioPathDocThem = `audio/${bookFolder}/第${paddedLesson}课 Doc Them.mp3`;
                const btnDocThem = document.createElement("button");
                btnDocThem.className = "play-audio-btn";
                btnDocThem.setAttribute("data-audio", audioPathDocThem);
                btnDocThem.setAttribute("data-title", `Boya ${bookFolder} - Bài ${lessonNumber} (Đọc Thêm)`);
                btnDocThem.innerHTML = "🔊 Nghe Bài Đọc Thêm";
                docThemContainer.insertBefore(btnDocThem, docThemContainer.firstChild);
            }
        }
    });
}

// ==========================================================================
// 4. GLOBAL AUDIO PLAYER (STICKY BOTTOM)
// ==========================================================================
function initGlobalAudioPlayer() {
    const player = document.getElementById("sticky-audio-player");
    const globalAudio = document.getElementById("global-audio");
    const nowPlayingText = document.getElementById("player-now-playing");

    document.body.addEventListener("click", function (e) {
        const button = e.target.closest(".play-audio-btn");
        if (!button) return;

        const audioSrc = button.getAttribute("data-audio");
        const audioTitle = button.getAttribute("data-title") || "Bài học tiếng Trung";

        if (audioSrc && player && globalAudio) {
            if (nowPlayingText) nowPlayingText.textContent = "Đang phát: " + audioTitle;
            globalAudio.src = audioSrc;

            player.classList.add("show");
            document.body.classList.add("audio-playing");

            setTimeout(() => {
                const playerHeight = player.offsetHeight;
                document.body.style.paddingBottom = (playerHeight + 24) + "px";
            }, 60);

            globalAudio.play().catch(error => {
                console.log("Trình duyệt yêu cầu tương tác trước khi phát:", error);
            });
        }
    });
}

function closePlayer() {
    const player = document.getElementById("sticky-audio-player");
    const globalAudio = document.getElementById("global-audio");

    if (globalAudio) {
        globalAudio.pause();
        globalAudio.src = "";
    }
    if (player) {
        player.classList.remove("show");
    }
    document.body.classList.remove("audio-playing");
    document.body.style.paddingBottom = "30px";
}

function skipAudio(seconds) {
    const globalAudio = document.getElementById("global-audio");
    if (globalAudio && globalAudio.src) {
        let targetTime = globalAudio.currentTime + seconds;
        if (targetTime < 0) targetTime = 0;
        if (targetTime > globalAudio.duration) targetTime = globalAudio.duration;
        globalAudio.currentTime = targetTime;
    }
}

// ==========================================================================
// 5. NAVIGATION SWITCHERS (MAIN & SUB MENUS)
// ==========================================================================
function switchMainMenu(btn) {
    const mainBtns = document.getElementsByClassName("main-btn");
    for (let i = 0; i < mainBtns.length; i++) {
        mainBtns[i].classList.remove("active");
    }

    const mainContents = document.getElementsByClassName("main-content");
    for (let i = 0; i < mainContents.length; i++) {
        mainContents[i].classList.remove("active");
    }

    btn.classList.add("active");
    const targetMainId = btn.getAttribute("data-main");
    const targetElement = document.getElementById(targetMainId);
    if (targetElement) {
        targetElement.classList.add("active");

        // Cuộn mượt lên vị trí bài học
        const navCard = document.querySelector(".lesson-nav-card");
        if (navCard) {
            const yOffset = -80; // Offset cho sticky header
            const y = navCard.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
        }
    }
}

function switchSubMenu(btn, parentId) {
    const parentBlock = document.getElementById(parentId);
    if (!parentBlock) return;

    const subBtns = parentBlock.getElementsByClassName("sub-btn");
    for (let i = 0; i < subBtns.length; i++) {
        subBtns[i].classList.remove("active");
    }

    const subContents = parentBlock.getElementsByClassName("sub-content");
    for (let i = 0; i < subContents.length; i++) {
        subContents[i].classList.remove("active");
    }

    btn.classList.add("active");
    const targetSubId = btn.getAttribute("data-sub");
    const targetElement = document.getElementById(targetSubId);
    if (targetElement) {
        targetElement.classList.add("active");
    }
}

// ==========================================================================
// 6. READING TOOLS (PINYIN, FONT ZOOM, TRANSLATION TOGGLE, TTS)
// ==========================================================================

// Ẩn/Hiện Pinyin cho từng khung riêng lẻ
function togglePinyin(boxId) {
    const textBox = document.getElementById(boxId);
    if (textBox) {
        textBox.classList.toggle("hide-pinyin");
    }
}

// Ẩn/Hiện Pinyin toàn trang
function togglePinyinGlobal() {
    const activeMainContent = document.querySelector(".main-content.active");
    if (!activeMainContent) return;

    const textElements = activeMainContent.querySelectorAll(".chinese-text");
    let isCurrentlyHidden = false;

    textElements.forEach(box => {
        isCurrentlyHidden = box.classList.toggle("hide-pinyin");
    });

    const btn = document.getElementById("btn-toggle-pinyin");
    if (btn) {
        btn.classList.toggle("active", isCurrentlyHidden);
    }
}

// Ẩn/Hiện Bản Dịch Tiếng Việt
function toggleTranslationGlobal() {
    const activeMainContent = document.querySelector(".main-content.active");
    if (!activeMainContent) return;

    const transElements = activeMainContent.querySelectorAll(".translation-container");
    let isCollapsed = false;

    transElements.forEach(el => {
        isCollapsed = el.classList.toggle("collapsed");
    });

    const btn = document.getElementById("btn-toggle-translation");
    if (btn) {
        btn.classList.toggle("active", isCollapsed);
    }
}

// Tăng/Giảm Cỡ Chữ Hán (A- / A+)
let currentFontSize = 24;
function adjustFontSize(delta) {
    currentFontSize = Math.max(18, Math.min(34, currentFontSize + delta));
    document.documentElement.style.setProperty("--chinese-font-size", `${currentFontSize}px`);

    const display = document.getElementById("zoom-val-display");
    if (display) display.textContent = `${currentFontSize}px`;

    try {
        localStorage.setItem("boya_chinese_font_size", currentFontSize);
    } catch (e) {}
}

function initSavedFontSize() {
    try {
        const saved = localStorage.getItem("boya_chinese_font_size");
        if (saved) {
            const sz = parseInt(saved, 10);
            if (!isNaN(sz) && sz >= 18 && sz <= 34) {
                currentFontSize = sz;
                document.documentElement.style.setProperty("--chinese-font-size", `${currentFontSize}px`);
                const display = document.getElementById("zoom-val-display");
                if (display) display.textContent = `${currentFontSize}px`;
            }
        }
    } catch (e) {}
}

// Text-to-Speech (TTS) cho Chữ Hán
let zhVoice = null;
function initTTS() {
    if (!("speechSynthesis" in window)) return;
    function findVoice() {
        const voices = window.speechSynthesis.getVoices();
        zhVoice = voices.find(v => v.lang.startsWith("zh")) || null;
    }
    findVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = findVoice;
    }
}
initTTS();

function speakChinese(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*#]/g, "").trim();
    if (!clean) return;

    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = "zh-CN";
    if (zhVoice) utter.voice = zhVoice;
    utter.rate = 0.85;
    window.speechSynthesis.speak(utter);
}

function initVocabTableTTS() {
    const vocabTables = document.querySelectorAll(".vocab-table");

    vocabTables.forEach(table => {
        table.querySelectorAll("tbody tr").forEach(row => {
            const hzCell = row.querySelector(".vocab-hz");
            if (!hzCell) return;

            const hzText = hzCell.textContent.replace(/[*#]/g, "").trim();
            if (!hzText) return;

            hzCell.title = "Nhấp để nghe phát âm chuẩn";
            hzCell.addEventListener("click", () => speakChinese(hzText));

            // Thêm nút loa nhỏ nếu chưa có
            if (!hzCell.querySelector(".btn-cell-speak")) {
                const spkBtn = document.createElement("button");
                spkBtn.className = "btn-cell-speak";
                spkBtn.title = "Nghe phát âm";
                spkBtn.innerHTML = "🔊";
                spkBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    speakChinese(hzText);
                });
                hzCell.appendChild(spkBtn);
            }
        });
    });
}
