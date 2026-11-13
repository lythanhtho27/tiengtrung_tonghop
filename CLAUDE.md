# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc với project này.

## Tổng quan

Bộ trang web học tiếng Trung (giáo trình **Boya** và từ vựng **HSK**) dành cho người Việt. Giao diện, comment code và commit message đều viết **bằng tiếng Việt**, khi trả lời người dùng cũng dùng tiếng Việt.

- Repo: `https://github.com/lythanhtho27/boya_web.git` (nhánh `main`)
- **Chỉ có HTML/CSS/JS thuần, không có backend, không có bước build.** Mở trực tiếp file `.html` là chạy (cả qua `file://`). Phần PHP/MariaDB cũ đã bị xóa (vẫn còn trong lịch sử git), đừng thêm lại.
- Dữ liệu được sinh sẵn thành file `.js` (gán vào `window.*`) để chạy được qua `file://`, vì `fetch` không hoạt động trên `file://`.
- Tiến độ học lưu trong `localStorage`. Mỗi trang dùng key riêng.

## Cấu trúc thư mục

```
index.html            Trang chủ: banner dẫn tới từng trang
audio/                MP3 bài khóa Boya (Trung cap 1–4, Cao cap 1–2), DÙNG CHUNG (~613MB)
boya_learning/        Boya Learning: bài khóa 6 quyển + audio + từ vựng
  boya_learning.html/.css/.js, boya_data.js (+ .json)
sach_boya/            Sách Boya Trung cấp 1–4 bản đọc
  tc1.html … tc4.html, script.js, style.css
tuvung/               Ôn từ vựng Boya TC1–4 (flashcard, quiz, ghép thẻ)
  tuvung.html/.css/.js, vocab_data.js (+ .json)
word_learning/        Giáo trình HSK 3.0 (词汇速记速练手册)
  word_learning.html/.css/.js, hsk_book_data.js, json_data/quyen_*.js(.json)
  word_learning_book/*.pdf   ← KHÔNG có trong repo, phải copy tay
hsk_lotrinh/          Lộ trình từ vựng HSK 1–6 (SRS, đọc nhanh)
  hsk_lotrinh.html/.css/.js, hsk_vocab_data.js
anh_ngu_3/            Bài luyện tiếng Anh HUTECH (an3*.html), trang độc lập, không liên quan tiếng Trung
shared/               Tài nguyên dùng chung giữa các trang (theme…)
tools/                Script sinh dữ liệu + dữ liệu nguồn
  extract_hsk_vocab.py, extract_vocab.py, word_list_data/HSK1-HSK6_full.xlsx
  scratch/            Script xử lý một lần (OCR, kiểm tra, sửa dữ liệu), chỉ để tham khảo
```

**Quy tắc đường dẫn:** mọi trang nằm trong thư mục con, nên link về trang chủ là `../index.html` và link sang trang khác là `../<thư mục>/<file>.html`. Dữ liệu audio lưu đường dẫn tính từ thư mục gốc (`"audio/Trung cap 1/第01课 Bai Khoa.mp3"`), code tự thêm `../` khi phát:
- `boya_learning.js`: trong `loadAudioTrack()`
- `tuvung.js`: chỗ `audioElem.src = "../" + lesson.audio`
- `sach_boya/script.js`: tự ghép `../audio/...`

## Dùng chung giữa các trang (`shared/`)

- **`theme.css`**: bảng màu chung, mọi biến có tiền tố `--ui-*`.
  - Gồm nền, chữ, viền, màu chính, trạng thái success/danger/warning, pinyin, thanh điệu `--ui-tone-1..4/0`.
  - Màu theo quyển Boya `--ui-book-tc1..tc4, gc1, gc2` và theo cấp `--ui-hsk-1..6`.
  - Sáng/tối điều khiển bằng `html[data-theme="light"|"dark"]`.
  - Trang **không** tự đặt màu cứng, mà ánh xạ biến riêng sang biến chung, ví dụ `--primary: var(--ui-primary)`.
  - Lưu ý: biến phái sinh từ một biến được đổi theo quyển (ví dụ `--primary-light` dựa trên `--primary`) phải định nghĩa trên cùng phần tử nơi `--primary` được đổi (thường là `body`), không đặt ở `:root`.
- **`theme.js`**: chế độ sáng/tối dùng chung, lưu ở key `hoc_theme`, chưa chọn thì theo hệ điều hành. Nạp **đồng bộ trong `<head>`** ngay sau `theme.css` để không bị chớp màu.
  - API: `HocTheme.get/set/toggle/onChange`.
  - Phần tử có `[data-ui-theme-toggle]` tự thành nút đổi theme. Class `.ui-theme-toggle` tự hiện 🌙/☀️.
  - Các tab tự đồng bộ theme với nhau. **Không tạo thêm theme riêng cho từng trang.**
- **`progress.js`**: `HocProgress.save(page, {...})` / `load(page)` / `all()`, key `hoc_summary_v1:<page>`. Mỗi trang ghi một bản tóm tắt tiến độ (`next`, `nextUrl` tính từ thư mục gốc, `due`, `learned`, `groups`), và trang chủ đọc các bản tóm tắt này để vẽ lộ trình. Định dạng chi tiết ở đầu file.

## Trang chủ (`index.html`): lộ trình 4 chặng

| Chặng | Nội dung | Nhóm (key trong `groups`) |
|---|---|---|
| 1. Nền tảng | Từ vựng HSK 1–3 | `hsk1..hsk3` (từ `hsk_lotrinh`) |
| 2. Trung cấp nền | Boya Chuẩn Trung cấp 1–2 + HSK 4 | `tc1, tc2, hsk4` |
| 3. Trung cấp nâng cao | Boya Trung cấp 1–2 + HSK 5 | `tc3, tc4, hsk5` |
| 4. Cao cấp | Boya Cao cấp 1–2 + HSK 6 | `gc1, gc2, hsk6` |

- Chặng hiện tại là chặng đầu tiên chưa hoàn thành.
- Khung "Ôn tập hôm nay" cộng `due` của mọi trang.
- `tuvung` và `word_learning` nằm ở mục "Công cụ bổ trợ".
- `sach_boya` không còn link từ trang chủ, vì nội dung trùng với `boya_learning`, nhưng file vẫn giữ.
- **Link vào trang con:** `hsk_lotrinh.html?level=N`, `boya_learning.html?book=<id>&lesson=N`.

Tên quyển thống nhất theo Boya Learning: `tc1/tc2` = Chuẩn Trung cấp 1/2, `tc3/tc4` = Trung cấp 1/2 (冲刺), `gc1/gc2` = Cao cấp 1/2.

## Sinh lại dữ liệu

Không sửa tay các file dữ liệu sinh tự động. Sửa nguồn rồi chạy script:

| File sinh ra | Nguồn | Lệnh |
|---|---|---|
| `hsk_lotrinh/hsk_vocab_data.js` | `tools/word_list_data/HSK1-HSK6_full.xlsx` (sheet HSK1…HSK6, cột: STT, Từ mới, Phiên âm, Giải thích, Ví dụ, Phiên âm VD, Dịch) | `python tools/extract_hsk_vocab.py` (cần `openpyxl`, chạy từ đâu cũng được) |
| `tuvung/vocab_data.js` / `.json` | `sach_boya/tc1.html` … `tc4.html` | `python tools/extract_vocab.py` ⚠️ Bản `vocab_data` hiện tại có vài chỗ đã được sửa tay (ví dụ câu ví dụ "精神～"). Chạy lại script sẽ mất các chỗ sửa đó, nên kiểm tra `git diff` trước khi giữ. |
| `boya_learning/boya_data.js` / `.json` | `tools/scratch/gc1_book.json`, `gc2_book.json` | Từ thư mục gốc: `python tools/scratch/merge_all_books.py`, rồi `python tools/scratch/super_enrich.py` (cần `pypinyin`) |

Trên Windows, khi in tiếng Việt / chữ Hán ra console thì đặt `PYTHONIOENCODING=utf-8` để tránh lỗi `UnicodeEncodeError` (cp1252). Các script khác trong `tools/scratch/` vẫn dùng đường dẫn cũ (trước khi chuyển thư mục), phải sửa trước khi chạy lại.

## Lộ trình từ vựng HSK (`hsk_lotrinh/`)

Ứng dụng 1 trang, toàn bộ logic nằm trong một IIFE ở `hsk_lotrinh.js`, không phụ thuộc thư viện ngoài.

- **Dữ liệu:** `window.HSK_VOCAB = [[level, hanzi, pinyin, nghĩa, ví dụ, pinyin VD, dịch VD, hán việt], …]`, có 5.002 từ (HSK1 149, HSK2 150, HSK3 295, HSK4 600, HSK5 1295, HSK6 2513). Hán Việt được tách từ phần `[...]` trong cột phiên âm (chỉ có ở vài từ HSK4).
- **ID từ** = `"<level>-<hanzi>"` (duy nhất trong từng cấp). Có 106 từ trùng giữa các cấp, chúng được coi là từ riêng ở mỗi cấp. `cleanHanzi()` bỏ chú thích trong ngoặc (`（杯）子` → `杯子`) để phát âm, làm câu hỏi điền từ và chọn đáp án nhiễu.
- **Cấu trúc lộ trình:** Cấp → Chặng (5 bài + 1 bài kiểm tra chặng) → Bài. Số từ mỗi bài nằm trong `UNIT_SIZE` (HSK1–3: 10, HSK4: 15, HSK5–6: 20).
- **Điều kiện mở khóa:** qua bài khi đạt ≥ 70% (`PASS_UNIT`), qua chặng khi đạt ≥ 80% (`PASS_STAGE`), xong cấp trước mới mở cấp sau. Có thể mở khóa cấp thủ công (`S.unlocked`) hoặc bật chế độ tự do (`settings.free`).
- **Luồng học một bài:** học thẻ → luyện tập 2 vòng (chọn nghĩa/pinyin → chọn chữ Hán/nghe chọn từ/điền từ vào câu). Engine trắc nghiệm dùng chung là `runQuiz()`.
- **SRS:** SM-2 rút gọn trong `schedule(card, rating)`, với rating 1 Quên / 2 Khó / 3 Nhớ / 4 Dễ. Hạn ôn được làm tròn về đầu ngày. Trạng thái: `new` / `learning` / `familiar` (iv ≥ 7) / `mastered` (iv ≥ 21).
- **Đo tốc độ nhận diện:** `card.rt` (ms) là trung bình trượt (0,6 × cũ + 0,4 × mới), cập nhật khi ôn thẻ có mặt trước là chữ Hán và khi luyện Đọc nhanh. Từ có `rt ≥ SLOW_MS` (3000ms) thuộc nhóm "cần tăng tốc".
- **Đọc nhanh** (`startSpeed`): chọn 1 trong 2 nghĩa trong thời gian giới hạn, tốc độ tự điều chỉnh ±15% trong khoảng `SPEED_MIN`–`SPEED_MAX`. Kỷ lục lưu ở `S.speed.best` (chỉ tính khi độ chính xác ≥ 80%).
- **State (localStorage `hsk_lotrinh_v1`):** `{ settings, units, stages, unlocked, srs, days, speed, lastLevel }`. `save()` đồng thời ghi tóm tắt cho trang chủ (`writeSummary()`). Sáng/tối dùng `HocTheme`, không còn `settings.theme`. Khi thêm trường mới, nhớ thêm vào `DEFAULT_STATE`. Người dùng chuyển tiến độ giữa các máy bằng nút Xuất/Nhập JSON.
- **Phát âm:** Web Speech API (`speechSynthesis`, giọng `zh-CN`).
- **Lưu ý CSS:** không dùng `opacity: 0` trong `@keyframes` cho phần tử được hiện ra từ `hidden` / `display:none`. Từng có lỗi thẻ bị kẹt ở trạng thái trong suốt, vì vậy các animation `pop` và `fade` chỉ dùng `transform`.

## Chạy và kiểm tra

- **Mở trang:** mở file `.html` trực tiếp, hoặc chạy `python -m http.server 8000` ở thư mục gốc rồi vào `http://localhost:8000/`.
- **Kiểm tra cú pháp JS:** `node --check <file>.js`.
- **Bắt lỗi JS khi tải trang (không cần mở trình duyệt):**
  `chrome.exe --headless=new --disable-gpu --enable-logging=stderr --v=0 --virtual-time-budget=4000 --dump-dom "file:///…/trang.html" 2>&1 >/dev/null | grep -i "Uncaught"`
- **Chụp màn hình:** `--screenshot=… --window-size=…`. Chrome headless có độ rộng tối thiểu 500px.
- **Chạy thử luồng tự động:** tạo bản sao HTML trong thư mục tạm, chèn script test, lấy kết quả qua `--dump-dom` (cần `--allow-file-access-from-files`).
- Dự án chưa có bộ test tự động hay linter.

## Quy ước

- Viết UI, comment và commit message bằng tiếng Việt. Commit message ngắn gọn, mô tả thay đổi (xem `git log`).
- Giữ phong cách: JS thuần trong IIFE, không thêm framework hay bước build. Font dùng Google Fonts (`Noto Serif SC` cho chữ Hán, `Work Sans` cho chữ Latin).
- Mỗi trang dùng **key localStorage riêng** cho tiến độ.
- Khi thêm trang mới: tạo thư mục riêng, thêm banner vào `index.html`, cập nhật mục "Cấu trúc thư mục" ở trên.
