# Truyện tranh cho Đọc thêm

Ảnh vẽ bằng Qwen-Image (chạy ở máy nhà); lời thoại hiện bằng chữ thật trong bong bóng (pinyin, chạm để tra, 🔊 nghe từng câu), tên người nói lấy từ kịch bản.

| File | Vai trò |
|---|---|
| `characters.json` | Phong cách chung, mô tả cố định nhân vật (`{yebai}`…) và bối cảnh (`{@postoffice}`…) |
| `panels_<series>.json` | Kịch bản: mỗi chương 5–6 khung `{n, paras, tag, prompt, lines[{p, zh, who}]}` |
| `PROMPT_KICH_BAN.md` | Prompt cho LLM để viết kịch bản bộ mới / bổ sung người nói |
| `chapter_json.py` | In JSON một chương để dán vào prompt |
| `gen_comics.py` | Vẽ ảnh: `--comfy workflow_api.json` (ComfyUI), `--diffusers`, hoặc `--export` (xuất prompt) |
| `build_comics.py` | Đổi ảnh `raw/<series>/` → WebP 960px vào `doc_them/comics/<series>/`, ghi `doc_them/comic_data.js` |
| `raw/` | Ảnh gốc (không commit, đã có trong `.gitignore`) |

## Ở nhà (ComfyUI)

1. Mở workflow Qwen-Image, gõ `PROMPT` vào ô prompt dương (và `NEGATIVE` vào ô âm nếu có), Workflow → **Export (API)** → lưu `qwen_api.json`.
2. Vẽ thử 1 chương: `python tools/comics/gen_comics.py s10 --comfy qwen_api.json --only s10-01`
3. Xem ảnh trong `tools/comics/raw/s10/`, ảnh nào xấu thì xóa rồi chạy lại với `--seed 2`. Ổn thì bỏ `--only` để vẽ cả bộ.
4. `python tools/comics/build_comics.py s10` → mở `doc_them/doc_them.html?id=s10-01&comic=1`.
