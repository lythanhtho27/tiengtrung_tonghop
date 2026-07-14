document.addEventListener("DOMContentLoaded", function() {
    // 1. Cấu hình phân chia quyển dựa trên số bài học
    // Giả sử: Quyển Trung cấp 1 từ bài 1 -> bài 8, Quyển Trung cấp 2 từ bài 9 -> bài 16+
    const MAX_TRUNG_CAP_1 = 8; 

    // Tìm tất cả các phân vùng bài học chính đang có trên trang (ví dụ: id="bai1", id="bai15",...)
    const mainContentBlocks = document.querySelectorAll('.main-content');

    mainContentBlocks.forEach(block => {
        const blockId = block.id; // Lấy chuỗi định danh, ví dụ: "bai15"
        if (!blockId.startsWith('bai')) return; // Bỏ qua nếu không đúng định dạng id

        // Trích xuất số thứ tự bài từ ID (ví dụ: "bai15" -> 15)
        const lessonNumber = parseInt(blockId.replace('bai', ''), 10);
        if (isNaN(lessonNumber)) return;

        // Tự động tạo padding số 0 (ví dụ: 1 -> "01", 5 -> "05", 15 -> "15")
        const paddedLesson = String(lessonNumber).padStart(2, '0');

        // Xác định thư mục quyển học dựa trên số bài
        const bookFolder = (lessonNumber <= MAX_TRUNG_CAP_1) ? "Trung cap 1" : "Trung cap 2";

        // 2. Tự động xử lý phần BÀI KHÓA
        const baiKhoaContainer = document.getElementById(`${blockId}-baikhoa`);
        if (baiKhoaContainer) {
            const audioPathKhoa = `audio/${bookFolder}/第${paddedLesson}课 Bai Khoa.mp3`;
            
            // Tạo phần tử nút bấm cho bài khóa
            const btnKhoa = document.createElement('button');
            btnKhoa.className = 'play-audio-btn';
            btnKhoa.setAttribute('data-audio', audioPathKhoa);
            btnKhoa.setAttribute('data-title', `Boya ${bookFolder} - Bài ${lessonNumber} (Bài Khóa)`);
            btnKhoa.innerHTML = '🔊 Nghe Bài Khóa';

            // Chèn nút bấm này vào vị trí đầu tiên của phân vùng Bài Khóa
            baiKhoaContainer.insertBefore(btnKhoa, baiKhoaContainer.firstChild);
        }

        // 3. Tự động xử lý phần TỪ VỰNG
        const tuVungContainer = document.getElementById(`${blockId}-tuvung`);
        if (tuVungContainer) {
            const audioPathVung = `audio/${bookFolder}/第${paddedLesson}课 Tu Vung.mp3`;
            
            // Tạo phần tử nút bấm cho từ vựng
            const btnVung = document.createElement('button');
            btnVung.className = 'play-audio-btn';
            btnVung.setAttribute('data-audio', audioPathVung);
            btnVung.setAttribute('data-title', `Boya ${bookFolder} - Bài ${lessonNumber} (Từ Vựng)`);
            btnVung.innerHTML = '🔊 Nghe Từ Vựng';

            // Chèn nút bấm này vào vị trí đầu tiên của phân vùng Từ Vựng (trên bảng từ vựng)
            tuVungContainer.insertBefore(btnVung, tuVungContainer.firstChild);
        }
    });

    // 4. Kích hoạt sự kiện click chung cho các nút bấm vừa được tạo tự động
    // (Giữ nguyên logic của trình phát nhạc dính cố định từ yêu cầu trước)
    initGlobalAudioPlayer();
});

function initGlobalAudioPlayer() {
    const player = document.getElementById("sticky-audio-player");
    const globalAudio = document.getElementById("global-audio");
    const nowPlayingText = document.getElementById("player-now-playing");

    document.body.addEventListener("click", function(e) {
        const button = e.target.closest('.play-audio-btn');
        if (!button) return;

        const audioSrc = button.getAttribute("data-audio");
        const audioTitle = button.getAttribute("data-title") || "Bài học tiếng Trung";

        if (audioSrc) {
            nowPlayingText.textContent = "Đang phát: " + audioTitle;
            globalAudio.src = audioSrc;
            
            // Hiện trình phát nhạc dính sát đáy màn hình
            player.classList.add("show");
            // Thêm class vào thẻ body để đẩy nút Pinyin lên trên
            document.body.classList.add("audio-playing");
            
            globalAudio.play().catch(error => {
                console.log("Trình duyệt yêu cầu tương tác trước khi phát.", error);
            });
        }
    });
}

// Hàm xử lý tua nhanh hoặc lùi lại số giây (Ví dụ: -10, -5, 5, 10)
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
    // Xóa class ở body để nút Pinyin hạ xuống vị trí ban đầu
    document.body.classList.remove("audio-playing");
}

// Hàm xử lý tua thời gian (Giữ nguyên)
function skipAudio(seconds) {
    const globalAudio = document.getElementById("global-audio");
    if (globalAudio && globalAudio.src) {
        let targetTime = globalAudio.currentTime + seconds;
        if (targetTime < 0) targetTime = 0;
        if (targetTime > globalAudio.duration) targetTime = globalAudio.duration;
        globalAudio.currentTime = targetTime;
    }
}

// Hàm chuyển đổi Menu chính cấp 1 (Bài 1 / Bài 2)
        function switchMainMenu(btn) {
            // Loại bỏ trạng thái active ở menu chính
            var mainBtns = document.getElementsByClassName("main-btn");
            for (var i = 0; i < mainBtns.length; i++) {
                mainBtns[i].classList.remove("active");
            }
            // Ẩn tất cả các khối bài học lớn
            var mainContents = document.getElementsByClassName("main-content");
            for (var i = 0; i < mainContents.length; i++) {
                mainContents[i].classList.remove("active");
            }
            
            // Kích hoạt nút được bấm và hiện bài học tương ứng
            btn.classList.add("active");
            var targetMainId = btn.getAttribute("data-main");
            document.getElementById(targetMainId).classList.add("active");
        }

        // Hàm chuyển đổi Tab menu con cấp 2 (Các đoạn nhỏ bên trong bài)
        function switchSubMenu(btn, parentId) {
            var parentBlock = document.getElementById(parentId);
            
            // Loại bỏ active của các nút tab con thuộc bài học đó
            var subBtns = parentBlock.getElementsByClassName("sub-btn");
            for (var i = 0; i < subBtns.length; i++) {
                subBtns[i].classList.remove("active");
            }
            // Ẩn tất cả nội dung đoạn nhỏ của bài học đó
            var subContents = parentBlock.getElementsByClassName("sub-content");
            for (var i = 0; i < subContents.length; i++) {
                subContents[i].classList.remove("active");
            }

            // Kích hoạt tab con vừa nhấn và hiển thị nội dung
            btn.classList.add("active");
            var targetSubId = btn.getAttribute("data-sub");
            document.getElementById(targetSubId).classList.add("active");
        }

        // Hàm ẩn/hiện Pinyin độc lập cho từng khung chữ Hán
        function togglePinyin(boxId) {
            var textBox = document.getElementById(boxId);
            textBox.classList.toggle("hide-pinyin");
        }

// Hàm ẩn/hiện Pinyin toàn hệ thống - Tối ưu tương thích cho cả Quyển 1 và Quyển 2
function togglePinyinGlobal() {
    // 1. Tìm block bài học lớn đang hiển thị (có class 'active')
    var activeMainContent = document.querySelector(".main-content.active");
    if (!activeMainContent) return;

    // 2. Kiểm tra xem bài này có chứa Tab menu con cấp 2 hay không (Dành riêng cho Bài 1 - Quyển 1)
    var activeSubContent = activeMainContent.querySelector(".sub-content.active");
    
    if (activeSubContent) {
        // Nếu có Tab con đang active (Cấu trúc Bài 1 - Quyển 1), tìm khung chữ Hán bên trong Tab đó
        var chineseTextBox = activeSubContent.querySelector(".chinese-text");
        if (chineseTextBox) {
            chineseTextBox.classList.toggle("hide-pinyin");
        }
    } else {
        // Nếu là bài viết một mạch liên tục (Tất cả các bài còn lại & Toàn bộ Quyển 2)
        var chineseTextBox = activeMainContent.querySelector(".chinese-text");
        if (chineseTextBox) {
            chineseTextBox.classList.toggle("hide-pinyin");
        }
    }
    
}
