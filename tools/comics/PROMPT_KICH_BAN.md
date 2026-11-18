# Prompt làm kịch bản truyện tranh có lời thoại

Quy trình cho một bộ truyện (ví dụ `s10`):

1. **Kịch bản** (dùng LLM: Qwen chat ở máy bạn, hoặc nhờ Claude): dán **Prompt A** + JSON một chương → nhận về danh sách khung tranh có `prompt` (lời tả ảnh) và `lines` (ai nói câu nào). Gộp các chương vào `tools/comics/panels_<series>.json` (xem mẫu `panels_s10.json`).
2. **Vẽ ảnh** (Qwen-Image): `python tools/comics/gen_comics.py s10 ...` (xem README.md).
3. **Gắn vào web**: `python tools/comics/build_comics.py s10`.

Vì sao **ảnh không có chữ**: lời thoại được hiển thị bằng chữ thật trong bong bóng (có pinyin, chạm để tra, nghe từng câu, lưu câu). AI vẽ chữ Hán vào ảnh thì không tra được, hay sai nét, và không khớp bản dịch.

Lấy JSON một chương để dán vào prompt:

```bash
PYTHONIOENCODING=utf-8 python tools/comics/chapter_json.py s10-03
```

---

## Prompt A — Chương truyện → kịch bản khung tranh (dán nguyên khối, thay phần cuối)

```
Bạn là biên kịch truyện tranh webtoon cho người Việt học tiếng Trung.
Tôi đưa một chương truyện dạng JSON: "paragraphs" (đoạn tiếng Trung, đánh số từ 0) và "translations" (bản dịch tiếng Việt từng đoạn).
Hãy chia chương thành 5–6 khung tranh và trả về DUY NHẤT một mảng JSON, không giải thích thêm.

QUY TẮC
1. Mỗi khung có:
   - "n": số thứ tự khung, bắt đầu từ 1.
   - "paras": mảng chỉ số đoạn văn khung này minh họa. Các khung phải phủ HẾT mọi đoạn, theo thứ tự, không trùng, mỗi khung 1–2 đoạn liền nhau.
   - "tag": nhãn tiếng Việt ngắn (2–6 chữ) mô tả khoảnh khắc chính.
   - "prompt": lời tả ảnh bằng TIẾNG ANH cho AI vẽ ảnh (1–2 câu): ai ở đâu, đang làm gì, biểu cảm, ánh sáng, góc máy. Chọn khoảnh khắc giàu cảm xúc nhất của các đoạn đó.
     + Gọi nhân vật bằng mã trong ngoặc nhọn: {yebai} {baishuang} {luming} {gezi} {ali} {cici} {shi} {xiongshen} {doudou} {achen} {yang}. KHÔNG tự tả ngoại hình nhân vật (đã có mô tả cố định).
     + Bối cảnh quen thuộc dùng mã: {@postoffice} {@hall} {@storeroom} {@flowershop} {@office} {@noodleshop} {@bridge}.
     + Nhân vật/bối cảnh chưa có mã thì tả ngắn gọn bằng tiếng Anh (loài vật, quần áo).
     + TUYỆT ĐỐI không đưa chữ, biển hiệu có chữ, bong bóng thoại vào ảnh. Biển hiệu thì ghi "blank sign".
     + Cảnh hồi tưởng/tưởng tượng thêm "flashback scene in soft sepia tones".
   - "lines": mảng mọi câu thoại trong các đoạn của khung, đúng thứ tự xuất hiện. Mỗi câu:
     {"p": chỉ số đoạn, "zh": nguyên văn phần BÊN TRONG dấu “ ” (chép y hệt, không sửa chữ nào), "who": tên tiếng Trung người nói, đúng như trong truyện (ví dụ 鹿鸣, 夜白, 白霜, 灰鸽爷爷, 阿栗, 刺刺, 石经理, 熊婶)}.
     + Chỉ lấy LỜI NÓI hoặc lời nghĩ. Bỏ qua chữ trong ngoặc kép chỉ là tên riêng, khẩu hiệu, chữ trên biển, từ được trích dẫn (ví dụ “时光邮筒” đứng giữa câu kể).
     + Xác định người nói theo ngữ cảnh: câu dẫn “X说/问/笑着说”, hoặc lượt đối đáp xen kẽ. Không chắc thì chọn người hợp lý nhất, không để trống.
     + Lời nghĩ trong đầu: "who" là tên nhân vật + "（心想）".
     + Chữ trong ngoặc kép KHÔNG phải lời nói (tên riêng, biển hiệu, chữ trên phong bì) mà vẫn đứng riêng như một câu: vẫn liệt kê nhưng để "who": "" (web sẽ hiện nó như lời kể, không làm bong bóng). Chữ viết của nhân vật (thư, sổ tay) thì ghi tên + "（信）" hoặc "（笔记）".
2. Khoảnh khắc trong "prompt" nên khớp với câu thoại quan trọng nhất của khung (người nói đứng nổi bật trong ảnh) để người học nhìn tranh là đoán được câu thoại.
3. Giữ tính trong sáng, không bạo lực.

MẪU KẾT QUẢ
[
  {"n": 1, "paras": [0, 1], "tag": "Bưu điện cũ 80 tuổi",
   "prompt": "{luming} stands in front of {@postoffice} on a bright festive morning, red lanterns along the old street, holding up her camera excitedly",
   "lines": [{"p": 0, "zh": "这次七夕，你去写一篇老邮局的报道。", "who": "牛主编"}]}
]

CHƯƠNG TRUYỆN:
<dán JSON chương ở đây>
```

## Prompt B — Chỉ bổ sung người nói cho kịch bản đã có

Dùng khi đã có `prompt` cho ảnh, chỉ cần thêm `lines`:

```
Dưới đây là một chương truyện (JSON) và danh sách khung tranh đã có (mỗi khung có "paras").
Với mỗi khung, thêm trường "lines" theo quy tắc: mọi câu thoại trong các đoạn của khung, đúng thứ tự;
mỗi câu {"p": chỉ số đoạn, "zh": nguyên văn bên trong “ ” (chép y hệt), "who": tên tiếng Trung người nói}.
Ngoặc kép chỉ là tên riêng/chữ trên biển: để "who": "". Lời nghĩ: tên + "（心想）"; chữ viết (thư, sổ): tên + "（信）"/"（笔记）".
Trả về DUY NHẤT mảng khung tranh đầy đủ (giữ nguyên các trường cũ) dạng JSON.

CHƯƠNG TRUYỆN:
<JSON chương>

KHUNG TRANH:
<mảng khung của chương>
```

## Mẹo cho Qwen-Image (vẽ ảnh)

- Kích thước 16:9: **1664×928** (đúng tỉ lệ khung trên web). Ảnh được thu về rộng 960px khi build nên không cần to hơn.
- Prompt ghép tự động = `style` + lời tả khung (đã thay mã nhân vật) + `suffix` trong `characters.json`. Negative prompt lấy từ `negative`.
- Nhân vật bị vẽ lệch giữa các khung: sửa mô tả trong `characters.json` cho cụ thể hơn (màu lông, quần áo, phụ kiện) rồi vẽ lại khung đó (xóa ảnh cũ trong `tools/comics/raw/<series>/`, chạy lại lệnh, ảnh có sẵn sẽ được bỏ qua). Nếu có Qwen-Image-Edit, có thể dùng một ảnh nhân vật đẹp làm ảnh tham chiếu.
- Ảnh hỏng thì đổi seed: `--seed 2` (mỗi khung tự cộng thêm số riêng nên vẫn khác nhau).
