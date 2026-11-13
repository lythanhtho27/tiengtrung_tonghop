# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc với project này.

## Tổng quan

Bộ trang web học tiếng Trung (giáo trình **Boya** và từ vựng **HSK**) dành cho người Việt. Giao diện, comment code và commit message đều viết **bằng tiếng Việt**, khi trả lời người dùng cũng dùng tiếng Việt.

- Repo: `https://github.com/lythanhtho27/boya_web.git` (nhánh `main`)
- Phần lớn là **HTML/CSS/JS thuần, không có bước build**, mở trực tiếp file `.html` là chạy (cả qua `file://`).
- Một phần nhỏ dùng **PHP + MariaDB** (đăng nhập, lưu tiến độ cho trang Word Learning).
- Dữ liệu được sinh sẵn thành file `.js` (gán vào `window.*`) để chạy được qua `file://` mà không cần fetch.

## Các trang chính

| Trang | File | Dữ liệu | Ghi chú |
|---|---|---|---|
| Trang chủ | `index.html` (bản tĩnh), `index.php` (bản có đăng nhập) | — | Các banner dẫn tới từng trang |
| Boya Learning (bài khóa, audio, từ vựng 6 quyển) | `boya_learning.html/.css/.js` | `boya_data.js` (~3,7MB) | localStorage `boya_learning_*` |
| Ôn từ vựng Boya TC1–4 (flashcard, quiz, ghép thẻ) | `tuvung.html/.css/.js` | `vocab_data.js` | localStorage `boya_*` |
| Sách Boya Trung cấp 1–4 (bản đọc) | `tc1.html` … `tc4.html` + `script.js`, `style.css` | nhúng trong HTML | File rất lớn (0,6–1,2MB), là **nguồn** cho `extract_vocab.py` |
| Giáo trình HSK 3.0 (词汇速记速练手册) | `word_learning.html/.css/.js` | `hsk_book_data.js`, `json_data/quyen_*.js` | Đọc PDF trong `word_learning_book/` (**thư mục này không có trong repo**, phải copy tay) |
| Word Learning bản PHP/MySQL | `word_learning.php` + `word_learning_mysql.js` | MariaDB | Gọi `api/vocab.php`, `api/progress.php` |
| **Lộ trình từ vựng HSK 1–6** | `hsk_lotrinh.html/.css/.js` | `hsk_vocab_data.js` | localStorage `hsk_lotrinh_v1`. Xem mục riêng bên dưới |
| Đề / bài an toàn | `an3.html`, `an3_de.html`, `an3_lms.html` | nhúng trong HTML | Trang độc lập |

## Sinh lại dữ liệu

Không sửa tay các file dữ liệu sinh tự động. Sửa nguồn rồi chạy script tương ứng từ thư mục gốc project:

| File sinh ra | Nguồn | Lệnh |
|---|---|---|
| `hsk_vocab_data.js` | `word_list_data/HSK1-HSK6_full.xlsx` (sheet HSK1…HSK6, cột: STT, Từ mới, Phiên âm, Giải thích, Ví dụ, Phiên âm VD, Dịch) | `python extract_hsk_vocab.py` (cần `openpyxl`) |
| `vocab_data.js` / `vocab_data.json` | `tc1.html` … `tc4.html` | `python extract_vocab.py` |
| `boya_data.js` / `boya_data.json` | `scratch/gc1_book.json`, `scratch/gc2_book.json` | `python scratch/merge_all_books.py`, rồi `python scratch/super_enrich.py` (cần `pypinyin`) |

Trên Windows, khi in tiếng Việt / chữ Hán ra console thì đặt `PYTHONIOENCODING=utf-8` để tránh lỗi `UnicodeEncodeError` (cp1252).

`scratch/` chứa các script xử lý một lần (OCR, kiểm tra, sửa dữ liệu) và file trung gian. Chỉ dùng tham khảo, không phải code chạy chính.

## Lộ trình từ vựng HSK (`hsk_lotrinh.*`)

Ứng dụng 1 trang, toàn bộ logic nằm trong một IIFE ở `hsk_lotrinh.js`, không phụ thuộc thư viện ngoài.

- **Dữ liệu:** `window.HSK_VOCAB = [[level, hanzi, pinyin, nghĩa, ví dụ, pinyin VD, dịch VD, hán việt], …]`, có 5.002 từ (HSK1 149, HSK2 150, HSK3 295, HSK4 600, HSK5 1295, HSK6 2513). Hán Việt được tách từ phần `[...]` trong cột phiên âm (chỉ có ở vài từ HSK4).
- **ID từ** = `"<level>-<hanzi>"` (duy nhất trong từng cấp). Có 106 từ trùng giữa các cấp, chúng được coi là từ riêng ở mỗi cấp. `cleanHanzi()` bỏ chú thích trong ngoặc (`（杯）子` → `杯子`, `哪里 (哪儿)` → `哪里`) để phát âm, làm câu hỏi điền từ và chọn đáp án nhiễu.
- **Cấu trúc lộ trình:** Cấp → Chặng (5 bài + 1 bài kiểm tra chặng) → Bài. Số từ mỗi bài nằm trong `UNIT_SIZE` (HSK1–3: 10, HSK4: 15, HSK5–6: 20). Bài cuối quá ngắn được gộp vào bài trước.
- **Điều kiện mở khóa:** qua bài khi đạt ≥ 70% (`PASS_UNIT`), qua chặng khi đạt ≥ 80% (`PASS_STAGE`), xong cấp trước mới mở cấp sau. Có thể mở khóa cấp thủ công (`S.unlocked`) hoặc bật chế độ tự do (`settings.free`).
- **Luồng học một bài:** học thẻ → luyện tập 2 vòng (vòng 1: chọn nghĩa / chọn pinyin; vòng 2: chọn chữ Hán / nghe chọn từ / điền từ vào câu). Câu sai được chèn lại vào hàng đợi. Engine trắc nghiệm dùng chung là `runQuiz()`.
- **SRS:** SM-2 rút gọn trong `schedule(card, rating)`, với rating 1 Quên / 2 Khó / 3 Nhớ / 4 Dễ. Hạn ôn được làm tròn về đầu ngày. Trạng thái từ: `new` / `learning` / `familiar` (iv ≥ 7) / `mastered` (iv ≥ 21).
- **Đo tốc độ nhận diện:** `card.rt` (ms) là trung bình trượt (0,6 × cũ + 0,4 × mới), cập nhật khi ôn thẻ có mặt trước là chữ Hán và khi luyện Đọc nhanh. Từ có `rt ≥ SLOW_MS` (3000ms) thuộc nhóm "cần tăng tốc".
- **Đọc nhanh** (`startSpeed`): chọn 1 trong 2 nghĩa trong thời gian giới hạn. Đúng 3 câu liên tiếp thì giới hạn giảm 15%, sai thì tăng 15%, trong khoảng `SPEED_MIN`–`SPEED_MAX`. Kỷ lục lưu ở `S.speed.best` (chỉ tính khi độ chính xác ≥ 80%).
- **State (localStorage `hsk_lotrinh_v1`):** `{ settings, units, stages, unlocked, srs, days, speed, lastLevel }`. `days[yyyy-mm-dd] = { n: từ mới, r: lượt ôn, c/t: đúng/tổng câu, ms/mc: thời gian nhận diện, sp: số lượt đọc nhanh }`. Khi thêm trường mới vào state, nhớ thêm vào `DEFAULT_STATE`, vì `load()` gộp state đã lưu với một bản sao của nó. Người dùng chuyển tiến độ giữa các máy bằng nút Xuất/Nhập JSON trong Cài đặt.
- **Phát âm:** Web Speech API (`speechSynthesis`, ưu tiên giọng `zh-CN`). Không có file âm thanh cho từng từ.
- **Theme:** `html[data-theme="dark"|"light"]`, màu định nghĩa bằng biến CSS trong `:root`.
- **Lưu ý CSS:** không dùng `opacity: 0` trong `@keyframes` cho phần tử được hiện ra từ `hidden` / `display:none`. Từng có lỗi thẻ bị kẹt ở trạng thái trong suốt, vì vậy các animation `pop` và `fade` hiện chỉ dùng `transform`.

## Phần PHP / MariaDB

- **Stack:** WEMP (Windows + Nginx + MariaDB + PHP) hoặc XAMPP. Cấu hình Nginx mẫu nằm ở `nginx_wemp.conf` (chạy dưới subpath `/word_learning`, PHP-FPM ở `127.0.0.1:9000`). Đường dẫn `alias` trong file này là đường dẫn tuyệt đối của máy cũ (`D:/Tho/HSK/Chuan HSK/BOYA/boya_tonghop_html`), **phải sửa khi chuyển sang máy khác**.
- **Kết nối DB:** `config/database.php` đọc biến môi trường `DB_HOST`, `DB_PORT`, `DB_NAME` (mặc định `hsk_word_learning`), `DB_USER` (mặc định `root`), `DB_PASS`. Cổng mặc định là 3308 nếu có `D:/wemp/mariadb/data/my.ini`, nếu không thì 3306; khi lỗi sẽ thử lần lượt cả hai cổng.
- **Cài đặt:** mở `install.php` trên trình duyệt để tạo database và các bảng từ `database.sql` (`users`, `books`, `units`, `vocabularies`, `user_progress`, `user_stats`).
- **Code:** `includes/auth.php` (session, phân quyền), `includes/helpers.php` (`is_post`, `post`, `json_response`…), `admin/` (quản trị sách, từ vựng, người dùng, import), `api/` (JSON API).
- Các trang tĩnh (`boya_learning`, `tuvung`, `hsk_lotrinh`, `tc*`) **không cần** PHP hay DB.

## Chạy và kiểm tra

- **Trang tĩnh:** mở file `.html` trực tiếp, hoặc chạy `python -m http.server 8000` rồi vào `http://localhost:8000/hsk_lotrinh.html`.
- **Kiểm tra cú pháp JS:** `node --check hsk_lotrinh.js`.
- **Kiểm tra giao diện không cần mở trình duyệt:** dùng Chrome headless (`chrome.exe --headless=new --screenshot=… --window-size=… --virtual-time-budget=…`). Ghi chú:
  - Chrome headless có độ rộng tối thiểu 500px.
  - Để chạy thử luồng tự động, tạo bản sao HTML trong thư mục tạm, chèn thêm script test và lấy kết quả bằng `--dump-dom` (cần `--allow-file-access-from-files`).
- Dự án chưa có bộ test tự động hay linter.

## Quy ước

- Viết UI, comment và commit message bằng tiếng Việt. Commit message ngắn gọn, mô tả thay đổi (xem `git log`).
- Giữ phong cách: JS thuần trong IIFE, `"use strict"`, không thêm framework hay bước build. Font dùng Google Fonts (`Noto Serif SC` cho chữ Hán, `Work Sans` cho chữ Latin).
- Mỗi trang dùng **key localStorage riêng**, không dùng chung key giữa các trang.
- Font chữ Hán: dùng biến `--font-cn`. Pinyin hiển thị bằng màu `--py`.
- Khi thêm trang mới, thêm banner tương ứng vào `index.html` (và `index.php` nếu cần).

## Tài nguyên lớn / không có trong repo

- `audio/` (~613MB, có trong git): mp3 bài khóa theo quyển (`Trung cap 1` … `Cao cap 2`).
- `word_learning_book/*.pdf`: **không có trong repo**, phải copy riêng sang máy mới nếu dùng trang Word Learning.
- `word_list_data/HSK1-HSK6_full.xlsx`: nguồn của `hsk_vocab_data.js`. Nên commit file này để sinh lại được dữ liệu trên máy khác.
