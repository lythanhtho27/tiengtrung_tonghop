# Dựng lại dữ liệu Boya Cao cấp (高级飞翔篇 I, II) từ PDF

Mục tiêu: chép CHÍNH XÁC nội dung sách (bản scan) cho từng bài, rồi dịch sang tiếng Việt.
Kết quả mỗi bài là 1 file JSON trong `tools/scratch/gc_rebuild/` (tên `gc1_L01.json`, `gc2_L07.json`…).
Dữ liệu cũ trong `tools/scratch/gc1_book.json` / `gc2_book.json` phần lớn là BỊA (từ vựng thiếu, Hán Việt sai, bài khóa chép sai) — KHÔNG dùng làm nguồn.

## Nguồn
- Ảnh trang (nguồn chuẩn, 120dpi xám): `SCRATCH/pages/gc1/p013.png` … (số = số trang PDF, 3 chữ số). Xem bằng tool Read.
- OCR nháp (NHIỀU LỖI: 父→交, 眨→乾, mất dấu câu, mất chữ 一…), chỉ để định vị trang / chép nhanh rồi SỬA theo ảnh:
  `python SCRATCH/ocr_text.py gc1 13 20` (in các trang 13–20; trang nào "chưa OCR" thì xem ảnh).
  SCRATCH = `C:/Users/admin/AppData/Local/Temp/claude/a2a500904f833dea/c61fd647-3f6c-4b60-bc71-3b980576d00d/scratchpad`
- Trang PDF = trang sách + 12 (quyển 1), + 10 (quyển 2).

Mục lục (trang PDF bắt đầu → trang cuối):
- gc1: 1 父亲的谜语 13–32 · 2 请按…… 33–53 · 3 一诺千金 54–74 · 4 沙漠里的奇怪现象 75–96 · 5 内部招标 97–116 · 6 天才梦 117–137 · 7 人 138–158 · 8 随感二则 159–178 · 9 人生就是与困境周旋 179–202 · 10 我反对克隆人 203–221
- gc2: 1 每天都冒一点险 11–36 · 2 那年那月那狗 37–64 · 3 人在风中 65–92 · 4 现代化和蜗牛 93–117 · 5 上天自有安排 118–142 · 6 球迷种种 143–167 · 7 面容 168–190 · 8 辛亥革命与我 191–214 · 9 无为·逍遥·不设防 215–248 · 10 音乐之伴 249–280

Bố cục một bài: trang đầu 课前思考 → 课文 (chia 第一部分/第二部分…; bảng 生词 nằm trên các trang xen kẽ, dạng: số · chữ Hán · pinyin · (từ loại) · giải nghĩa tiếng Trung [+ tiếng Anh]) → 注释 → 词语辨析 → 语言点 → 综合练习 → 阅读与理解 (bài đọc thêm, cuối bài).
Mẹo: lướt OCR nháp của cả khoảng trang trước để biết trang nào là gì, rồi chỉ mở ảnh các trang cần (课文, 生词, 语言点, 阅读与理解). Bỏ qua 课前思考, 注释, 词语辨析, 综合练习.

## Cần lấy
1. **words**: TOÀN BỘ bảng 生词 của bài, đúng thứ tự số, không bỏ, không thêm.
   - `hz` chữ Hán đúng như sách; `py` pinyin có dấu đúng như sách (thành ngữ giữ cách viết sách, ví dụ "kǔ sī míng xiǎng");
   - `pos` từ loại trong ngoặc như sách: "名","动","形","副","量","连","介","代","助","叹","拟声"… (không có thì "");
   - `zh` giải nghĩa tiếng Trung của sách (giữ cả phần "(深邃——深刻)" nếu có); `en` phần tiếng Anh nếu có, không có thì "";
   - `hv` âm Hán Việt VIẾT HOA (ví dụ "MÊ NGỮ"); phải ĐÚNG (积攒 = TÍCH TOÀN, 钥匙 = THƯỢC THI…). Từ thuần khẩu ngữ/không có HV hợp lý vẫn ghi âm HV từng chữ;
   - `vi` nghĩa tiếng Việt ngắn gọn, tự nhiên, ĐÚNG NGHĨA TRONG BÀI (dựa vào `zh`), vd "câu đố"; "chớp (mắt)".
   - `proper`: true nếu là tên riêng (người, địa danh, tác phẩm).
2. **readings**: 
   - Bài khóa chính (`kind: "main"`, `title` = tên bài): toàn bộ văn bản các phần, mỗi đoạn văn trong sách = 1 phần tử của `paragraphs`. Dòng "第一部分/第二部分" ghi thành một đoạn riêng đúng chữ đó. Tác giả/nguồn (如 "（作者：…）"/"（选自…）") nếu có ghi thành đoạn cuối.
   - Bài 阅读与理解 (`kind: "extra"`, `title` = tiêu đề bài đọc): chỉ văn bản bài đọc, KHÔNG lấy câu hỏi/bài tập.
   - Chép đúng từng chữ + dấu câu tiếng Trung đầy đủ (，。“”？！：；、……——《》). Bỏ số chú thích ①②, bỏ ký hiệu/ chữ "www.aibochinese.com", bỏ tiêu đề trang.
   - `translations`: bản dịch tiếng Việt, MỖI đoạn 1 phần tử, cùng số lượng & thứ tự với `paragraphs` (đoạn "第一部分" dịch "Phần một"). Dịch văn chương, mượt, trung thành.
3. **grammar**: các mục trong 语言点 của bài (đúng số lượng, thứ tự).
   - `point`: mục đúng như sách (vd "…不了…" / "以至"), kèm nghĩa ngắn tiếng Việt trong ngoặc: "以至 (đến nỗi, thậm chí)";
   - `structure`: công thức/cách dùng ngắn (tiếng Trung + ký hiệu), vd "A，以至B";
   - `explanation`: giải thích TIẾNG VIỆT, dịch/diễn giải sát phần giải thích của sách (kể cả phần "链接" nếu có, gói gọn);
   - `examples`: các câu ví dụ đánh số trong sách cho mục đó (tối đa 5, lấy câu trích từ bài khóa nếu có), mỗi câu `{ "zh": "...", "vi": "..." }`. Không lấy bài tập điền.

## Định dạng file (UTF-8, JSON hợp lệ, `ensure_ascii=False`)
```json
{
  "book": "gc1", "lesson_num": 1, "title": "父亲的谜语", "pages": [13, 32],
  "words": [ { "n": 1, "hz": "谜语", "py": "míyǔ", "pos": "名", "zh": "供人猜测某个事物或文字的语句。", "en": "riddle", "hv": "MÊ NGỮ", "vi": "câu đố", "proper": false } ],
  "readings": [ { "kind": "main", "title": "父亲的谜语", "paragraphs": ["第一部分", "小时候，父亲最爱教我猜谜语。"], "translations": ["Phần một", "Hồi nhỏ, cha tôi thích nhất là dạy tôi giải câu đố."] },
                { "kind": "extra", "title": "…", "paragraphs": [], "translations": [] } ],
  "grammar": [ { "point": "…", "structure": "…", "explanation": "…", "examples": [ { "zh": "…", "vi": "…" } ] } ]
}
```
Viết file bằng Python (`json.dump(..., ensure_ascii=False, indent=1)`) hoặc tool Write; sau đó tự kiểm tra: `python -c "import json;d=json.load(open('FILE',encoding='utf-8'));print(len(d['words']),[ (r['kind'],len(r['paragraphs']),len(r['translations'])) for r in d['readings']],len(d['grammar']))"` — số đoạn và số dịch phải bằng nhau; số từ phải bằng số cuối trong bảng 生词.
Không sửa file nào khác trong project.
