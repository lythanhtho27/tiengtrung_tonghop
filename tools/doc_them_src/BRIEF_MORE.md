# Viết thêm tài liệu cho trang "Đọc thêm" (đợt 2)

Đọc trước `BRIEF.md` (cùng thư mục): MỌI quy định chung ở đó vẫn áp dụng — sáng tác mới hoàn toàn, từ vựng theo cấp (`vocab_hskN.txt`), độ dài theo cấp, dấu câu tiếng Trung, `translations` khớp từng đoạn, câu hỏi trắc nghiệm 4 lựa chọn (`q`, `q_vi`, `options`, `answer` 0–3 phân bố đều, `explain_vi`), viết bằng Python ghi dần từng bài (đọc–nối–ghi), tự kiểm tra.
Người học hiện ở khoảng HSK 4, là người Việt. Văn phải tự nhiên, có ý tưởng, đa dạng, KHÔNG lặp lại đề tài/cốt truyện của các bài đã có (xem tiêu đề các bài cũ bằng: `python -c "import json,glob;[print(t['id'],t['title']) for f in glob.glob('tools/doc_them_src/*.json') for t in json.load(open(f,encoding='utf-8')) if isinstance(t,dict) and 'title' in t]"`).
Mỗi bài có thêm trường `"kind"` như dưới đây. `id` phải duy nhất toàn bộ (dùng đúng tiền tố được giao).

## 1. Bài đọc (`"kind": "article"`)
Như BRIEF.md. Đề tài gợi ý thêm: công sở, phỏng vấn xin việc, du lịch các vùng Trung Quốc, ẩm thực địa phương, mạng xã hội, sức khỏe, môi trường, giáo dục, công nghệ, thể thao, nghệ thuật, lịch sử – nhân vật (viết lại dạng phổ thông), tin tức kiểu báo, thư từ, nhật ký, truyện ngắn có kết bất ngờ, ngụ ngôn mới.

## 2. Truyện dài nhiều kỳ (`"kind": "series"`)
Thêm các trường: `"series": "s1"`, `"series_title": "…"` (tên truyện tiếng Trung), `"series_title_vi"`, `"chapter": 1..N`. Mỗi chương là một "bài" đầy đủ (title = tên chương, paragraphs, translations, 3 câu hỏi). Cốt truyện liền mạch, nhân vật xuyên suốt, mỗi chương có một nút thắt nhỏ khiến muốn đọc tiếp; chương đầu giới thiệu nhân vật, chương cuối có kết thúc trọn vẹn.

## 3. Hội thoại (`"kind": "dialogue"`)
Mỗi phần tử `paragraphs` là MỘT lượt lời dạng `"Tên：lời nói"` (tên tiếng Trung ngắn 1–3 chữ, dấu hai chấm toàn khoảng "："), có thể có đoạn dẫn ngắn đầu bài (không có "Tên："). Thêm trường `"speakers": ["王丽", "李明"]` và `"scene_vi": "…"` (mô tả tình huống). 2–3 người nói, 10–24 lượt lời, tự nhiên như đời thực (có từ đệm, phản ứng, câu hỏi lại). `translations` dịch từng lượt (giữ "Tên: …" theo phiên âm Hán Việt, ví dụ "Vương Lệ: …"). 3 câu hỏi.

## 4. Thành ngữ (`"kind": "chengyu"`)
Mỗi thành ngữ là một bài: `title` = thành ngữ, `title_vi` = nghĩa ngắn. Thêm trường
`"idiom": { "hz": "守株待兔", "py": "shǒu zhū dài tù", "hv": "THỦ CHU ĐÃI THỐ", "meaning": "nghĩa tiếng Việt", "usage": "cách dùng, sắc thái, thường dùng trong tình huống nào", "examples": [ {"zh": "câu ví dụ hiện đại", "vi": "…"}, {"zh": "…", "vi": "…"} ] }`.
`paragraphs` = câu chuyện / điển tích kể lại bằng tiếng Trung dễ hiểu (HSK 4–5, 200–400 chữ, tự kể lại bằng lời của bạn) + 1 đoạn cuối nói thành ngữ dùng thế nào ngày nay. 2 câu hỏi. Ưu tiên thành ngữ hay gặp trong HSK 5–6, sách, báo.

## 5. Đề luyện đọc kiểu HSK (file riêng, KHÔNG phải mảng bài)
File là mảng các đề:
```json
[{ "id": "e4-01", "level": 4, "title": "Đề luyện đọc HSK 4 · Số 1",
   "sections": [
     { "type": "xuanci", "title": "选词填空", "words": ["A 词1","B 词2","C 词3","D 词4","E 词5","F 词6"],
       "items": [ { "sentence": "câu có chỗ trống （  ）", "answer": "C", "vi": "dịch", "explain_vi": "…" } ] },
     { "type": "paixu", "title": "排列顺序",
       "items": [ { "parts": { "A": "…", "B": "…", "C": "…" }, "answer": "BAC", "vi": "dịch đoạn đúng", "explain_vi": "dấu hiệu nhận biết thứ tự" } ] },
     { "type": "yuedu", "title": "阅读理解",
       "items": [ { "passage": "đoạn văn 60–200 chữ", "question": "câu hỏi tiếng Trung", "options": ["…","…","…","…"], "answer": 1,
                    "passage_vi": "dịch đoạn văn", "explain_vi": "…" } ] }
   ] }]
```
Mỗi đề: `xuanci` 5 câu dùng 6 từ (1 từ thừa, đáp án không trùng nhau), `paixu` 5 câu (mỗi câu 3 mảnh A/B/C), `yuedu` 6 câu. HSK 5: câu/đoạn dài và khó hơn (đoạn đọc 150–300 chữ), từ vựng cấp 5. Đáp án phân bố đều, câu nhiễu hợp lý, mọi chữ phải đúng chuẩn đề thi (dùng （  ） cho chỗ trống).
