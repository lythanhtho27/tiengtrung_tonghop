# Viết bài đọc phân cấp cho trang "Đọc thêm"

Người học: người Việt học tiếng Trung, đang theo lộ trình HSK 1–6 và giáo trình Boya. Mục tiêu: có bài đọc VỪA SỨC để luyện đọc rộng (biết ~95% từ) và đọc sâu.

## Yêu cầu nội dung
- Bài **tự sáng tác hoàn toàn mới** (không chép, không phỏng theo sát sách/báo/truyện có bản quyền). Văn tự nhiên, đúng ngữ pháp, giọng như người bản xứ viết cho người học; có cốt truyện hoặc ý tưởng thú vị (không khô như bài mẫu). Đa dạng đề tài: đời sống, học tập, công việc, du lịch, ẩm thực, gia đình, văn hóa – phong tục Trung Quốc, xã hội hiện đại, khoa học thường thức, truyện ngắn có kết bất ngờ, ngụ ngôn mới, thư từ, nhật ký…
- **Từ vựng theo cấp**: dùng chủ yếu từ trong `vocab_hskN.txt` của cấp đó và các cấp thấp hơn (cùng thư mục). Từ ngoài phạm vi ≤ 3–5% số từ; tên riêng đơn giản. Ngữ pháp tương ứng trình độ.
- **Độ dài (số chữ Hán, không tính dấu câu)**:
  HSK1: 120–200 · HSK2: 200–320 · HSK3: 320–480 · HSK4: 500–800 · HSK5: 800–1200 · HSK6: 1200–1800.
  Chia đoạn hợp lý (HSK1–2: 3–6 đoạn; HSK3–4: 5–9 đoạn; HSK5–6: 7–14 đoạn). Hội thoại: mỗi lượt lời có thể là một đoạn.
- Dùng dấu câu tiếng Trung đầy đủ (，。！？：；“”、……——《》). Không chèn pinyin, không chú thích trong văn bản.
- `translations`: bản dịch tiếng Việt tự nhiên, MỖI đoạn một phần tử, cùng số lượng & thứ tự với `paragraphs`.
- `questions`: 3 câu (HSK1–2) đến 5 câu (HSK5–6) đọc hiểu trắc nghiệm 4 lựa chọn, hỏi bằng tiếng Trung đúng trình độ (kèm `q_vi` dịch câu hỏi), có câu hỏi ý chính/suy luận chứ không chỉ chi tiết; `answer` là chỉ số 0–3 của đáp án đúng (phân bố đáp án đúng không trùng một vị trí); `explain_vi` giải thích ngắn bằng tiếng Việt.

## Định dạng file (JSON hợp lệ, UTF-8): một mảng các bài
```json
[
  {
    "id": "h3-02",
    "level": 3,
    "title": "迟到的生日礼物",
    "title_vi": "Món quà sinh nhật đến muộn",
    "topic": "gia đình",
    "paragraphs": ["……", "……"],
    "translations": ["……", "……"],
    "questions": [
      { "q": "……？", "q_vi": "……?", "options": ["……", "……", "……", "……"], "answer": 2, "explain_vi": "……" }
    ]
  }
]
```
`id` dạng `h<cấp>-<số 2 chữ số>`, `topic` tiếng Việt ngắn.

## Cách làm
Viết bằng Python (`json.dump(..., ensure_ascii=False, indent=1)`), ghi file dần theo từng bài (đọc–nối–ghi) để không mất công nếu bị gián đoạn. Sau mỗi bài tự kiểm tra: số chữ Hán trong khoảng, `len(paragraphs) == len(translations)`, số câu hỏi đúng, `answer` hợp lệ. Có thể kiểm tra tỉ lệ từ ngoài cấp bằng `jieba` (đã cài) so với các file vocab.
Không sửa file nào khác trong project.
