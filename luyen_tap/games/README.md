# Trò chơi của trang Luyện tập

Mỗi trò là MỘT file `luyen_tap/games/<id>.js`, được nạp bằng `<script>` trong `luyen_tap.html` (trước `luyen_tap.js`) và tự đăng ký:

```js
(function () {
    "use strict";
    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: "match",                 // trùng tên file
        order: 1,                    // thứ tự hiển thị
        ic: "🃏",
        name: "Ghép thẻ",
        desc: "Ghép chữ Hán với nghĩa, càng nhanh càng nhiều điểm.",
        unit: " điểm",               // đơn vị điểm hiện ở kết quả/kỷ lục (vd " giây", " từ")
        minWords: 8,                 // số từ tối thiểu trong pool (bỏ qua nếu ownData)
        ownData: false,              // true nếu trò dùng dữ liệu viết sẵn ctx.data (không cần pool)
        start(ctx) { /* vẽ trò vào ctx.el, khi xong gọi ctx.finish({...}) */ }
    });
})();
```

## `ctx` (do luyen_tap.js truyền vào)
| Thuộc tính | Ý nghĩa |
|---|---|
| `el` | phần tử chứa trò (đã xóa trống). Chỉ vẽ bên trong `el`. |
| `words` | mảng từ ĐÃ HỌC của người dùng theo mục "Nguồn từ" (đã xáo trộn): `{ id, hz, py, mean, src, card }`. `hz` chữ Hán (đã bỏ chú thích ngoặc), `py` pinyin, `mean` nghĩa tiếng Việt (có thể dạng "HÁN VIỆT (nghĩa)" với từ Boya), `src` "hsk"/"boya"/"wl"/"my". |
| `sents()` | mảng câu ví dụ thuộc các từ đó: `{ zh, parts: [mảnh…], py, vi, word }` (gọi lười, có thể rỗng). |
| `data` | `window.LT_GAMES_DATA` = `{ collocations: [{left,right,py,mean}], synonyms: [{id,pair:[a,b],correct,sentence (có "【 ______ 】"),py,mean,explain…}], radicals: [{target,pinyin,mean,parts:[…],explain}], word_chain: [{hz,py,mean}], antonyms: [{word,py,mean,ant,antPy,antMean}] }` (file `lt_games_data.js`, xem cấu trúc thật bằng cách đọc file). |
| `speak(text, rate?)` | đọc tiếng Trung (TTS). |
| `shuffle(arr)` | xáo trộn tại chỗ, trả về arr. |
| `esc(s)` | escape HTML. **Luôn** dùng khi chèn chữ vào innerHTML. |
| `toast(msg)` | thông báo nhỏ. |
| `distractors(w, n, key="mean")` | n từ khác trong pool có giá trị `key` khác với `w` (làm đáp án nhiễu). |
| `pick(n, filter?)` | n từ ngẫu nhiên (lọc tùy chọn). |
| `setTimeout / setInterval` | như bản gốc nhưng TỰ HỦY khi thoát trò — luôn dùng 2 hàm này thay cho bản của window. |
| `onCleanup(fn)` | đăng ký hàm dọn dẹp (gỡ event listener trên document/window, requestAnimationFrame…). |
| `finish(res)` | kết thúc: `{ score, correct?, total?, wrong?: [{hz,py,mean}], note?, title?, unit? }` → hiện màn kết quả chuẩn (điểm, kỷ lục, danh sách từ sai có 🔊, nút Chơi lại / Trò khác). |
| `best()` | kỷ lục hiện tại của trò. |

## Quy ước
- JS thuần trong IIFE, comment/UI tiếng Việt. Không dùng thư viện ngoài.
- CSS: mỗi trò tự chèn một `<style id="g-<id>-css">` một lần (chỉ dùng biến `--ui-*` của shared/theme.css, ví dụ `var(--ui-primary)`, `var(--ui-surface-2)`, `var(--ui-success)`, `var(--ui-danger)`, `var(--ui-font-cn)`), tiền tố class `g-<id>-…` để không đụng nhau. Không dùng `opacity: 0` trong `@keyframes` cho phần tử hiện ra từ hidden.
- **Ưu tiên điện thoại** (≥ 360px): nút bấm ≥ 44px, chữ Hán to, không cần bàn phím vật lý (có thể thêm phím tắt cho máy tính). Gõ chữ Hán (nếu có) phải xử lý `isComposing`.
- Trò có giờ: hiện đồng hồ/thanh thời gian; có nút tạm dừng nếu hợp lý.
- Kết thúc luôn gọi `ctx.finish(...)` một lần, kèm `wrong` (từ trả lời sai) để người học xem lại.
- Trò không ghi vào thẻ SRS (chỉ để ôn vui).
