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
