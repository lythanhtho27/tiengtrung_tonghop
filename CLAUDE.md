# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc với project này.

## Tổng quan

Bộ trang web học tiếng Trung (giáo trình **Boya** và từ vựng **HSK**) dành cho người Việt. Giao diện, comment code và commit message đều viết **bằng tiếng Việt**, khi trả lời người dùng cũng dùng tiếng Việt.

- Repo: `https://github.com/lythanhtho27/boya_web.git` (nhánh `main`)
- **Chỉ có HTML/CSS/JS thuần, không có backend, không có bước build.** Mở trực tiếp file `.html` là chạy (cả qua `file://`). Phần PHP/MariaDB cũ đã bị xóa (vẫn còn trong lịch sử git), đừng thêm lại.
- Dữ liệu được sinh sẵn thành file `.js` (gán vào `window.*`) để chạy được qua `file://`, vì `fetch` không hoạt động trên `file://`.
- Tiến độ học lưu trong `localStorage`. Mỗi trang dùng key riêng. Khi người dùng đăng nhập, `shared/sync.js` đồng bộ các key này lên Supabase (xem mục "Tài khoản & đồng bộ"). Đây là dịch vụ ngoài, không phải backend tự dựng.

## Cấu trúc thư mục

```
index.html            Trang chủ: banner "Buổi học hôm nay" + lộ trình 4 chặng + công cụ
hom_nay/              Buổi học hôm nay: ôn mọi thẻ đến hạn (gộp trùng) → bài mới → luyện tập
  hom_nay.html/.css/.js
audio/                MP3 bài khóa Boya (Trung cap 1–4, Cao cap 1–2), DÙNG CHUNG (~613MB)
boya_learning/        Boya Learning: bài khóa 6 quyển + audio + từ vựng
  boya_learning.html/.css/.js, boya_data.js (+ .json)
sach_boya/            [ĐÃ ẨN] Sách Boya TC1–4 bản đọc tĩnh (trùng boya_learning), có dải thông báo chuyển trang
  tc1.html … tc4.html, script.js, style.css
tuvung/               [ĐÃ ẨN] Ôn từ vựng Boya TC1–4 — đã gộp vào hom_nay (ôn thẻ) + luyen_tap (trò chơi); có dải thông báo, vẫn mở được
  tuvung.html/.css/.js, vocab_data.js (+ .json)
word_learning/        Giáo trình HSK 3.0 (词汇速记速练手册)
  word_learning.html/.css/.js, hsk_book_data.js, json_data/quyen_*.js(.json)
hsk_lotrinh/          Lộ trình từ vựng HSK 1–6 (SRS, đọc nhanh)
  hsk_lotrinh.html/.css/.js, hsk_vocab_data.js
doc_them/             Đọc thêm: 299 bài (truyện dài, bài đọc, hội thoại, thành ngữ) + 14 đề luyện đọc HSK, bài tự dán, đọc lại bài khóa Boya
  doc_them.html/.css/.js, doc_data.js (sinh tự động)
  comic_art.js (chế độ Truyện tranh: khung tranh + bong bóng thoại), comic_data.js (sinh tự động), comics/<series>/*.webp
thong_ke/             Thống kê & dự báo (chỉ đọc localStorage của mọi trang): tổng quan, dự báo ôn 7/30 ngày, theo tuần, theo cấp, heatmap, tốc độ, từ hay quên
  thong_ke.html/.css/.js
luyen_tap/            Luyện tập: sắp xếp câu (Việt→Trung), nghe – viết từ/câu, 14 trò chơi; lấy từ đã học ở mọi trang
  luyen_tap.html/.css/.js, lt_data.js, lt_data_wl.js (sinh tự động), lt_games_data.js (dữ liệu trò chơi viết sẵn)
  games/<id>.js       Mỗi trò chơi một file, tự đăng ký vào window.LT_GAMES (API: games/README.md)
anh_ngu_3/            Bài luyện tiếng Anh HUTECH (an3*.html), trang độc lập, không liên quan tiếng Trung
shared/               Tài nguyên dùng chung: theme, progress, sync, mywords (sổ Từ của tôi), lookup (tách từ/pinyin/tra từ), dict_vi.js (từ điển, sinh tự động)
tools/                Script sinh dữ liệu + dữ liệu nguồn
  extract_hsk_vocab.py, extract_vocab.py, word_list_data/HSK1-HSK6_full.xlsx
  hanviet/            Bảng âm Hán Việt theo (chữ, pinyin): hv_1..3.tsv, overrides.tsv (sửa tay), hanviet.py
  add_hanviet_wl.py, build_dict.py, build_luyen_tap.py, build_doc_them.py
  doc_them_src/       Nguồn tài liệu đọc (sáng tác mới): hsk*.json, more_hsk*.json, series_s1..s5.json, series_s6_a/b/c.json, series_s7_a/b/c.json, series_s8_a/b/c.json, series_s9_a/b/c.json, series_s10_a/b/c.json, dialogues.json, chengyu_a/b.json, exam_hsk4/5.json
                      + BRIEF.md, BRIEF_MORE.md (quy cách viết từng loại), BRIEF_S6.md … BRIEF_S10.md (dàn ý bộ truyện s6–s10) + vocab_hskN.txt
  comics/             Truyện tranh: characters.json, panels_<series>.json (kịch bản + người nói), gen_comics.py (Qwen-Image qua ComfyUI/diffusers), build_comics.py → doc_them/comic_data.js; xem README.md
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
- **`sync.js`**: tài khoản và đồng bộ tiến độ (xem mục dưới). Nạp đồng bộ trong `<head>` ngay sau `theme.js`, trước script của trang. Đã gắn vào: `index`, `hom_nay`, `hsk_lotrinh`, `boya_learning`, `tuvung`, `word_learning`, `luyen_tap`.
- **`tts.js`** (`HocTTS`): giọng đọc dùng chung. Nạp đồng bộ trong `<head>` ngay sau `sync.js`, đã gắn vào mọi trang.
  - Bọc `speechSynthesis.speak()`: mọi câu tiếng Trung các trang đọc đều tự dùng giọng đã chọn (hoặc luân phiên nhiều giọng) và nhân thêm tốc độ/cao độ chung, nên trang **không cần** tự chọn giọng.
  - Cài đặt lưu theo từng thiết bị ở `hoc_tts_v1`, **không đồng bộ** (cố ý, vì bộ giọng mỗi máy khác nhau).
  - Nút `[data-hoc-voice]` (class `.ui-voice-btn` trong theme.css) mở hộp chọn giọng: nghe thử, tốc độ, cao độ, luân phiên giọng (chọn nhóm giọng), giọng cho Người dẫn / Vai 1 / Vai 2.
  - API: `voices/settings/set/speak/stop/open/gender`, `dialogueSegments(paragraphs)` và `readDialogue(paragraphs, {onPara, onEnd})`. Hàm đọc nhập vai cho lời dẫn đọc bằng giọng người dẫn; lời trong “…”/「…」 đọc bằng Vai 1/Vai 2, đổi người nói theo từng đoạn có lời thoại.
  - Utterance tạo bởi chính `HocTTS.speak` có cờ `__hocManaged` để wrapper không ghi đè.
  - **Lật thẻ từ vựng:** `HocTTS.speakWord(word, example, {rate})` đọc từ, nghỉ khoảng 0,45 giây rồi đọc câu ví dụ (`word` rỗng thì chỉ đọc câu). Tùy chọn "Đọc từ xong thì đọc luôn câu ví dụ" trong hộp chọn giọng (`settings.withExample`, mặc định bật). Câu ví dụ đang chờ bị hủy khi trang gọi `speechSynthesis.cancel()` hoặc tự đọc câu khác. Đang dùng ở: mặt sau thẻ `hom_nay`, thẻ học từ mới và mặt sau thẻ ôn của `hsk_lotrinh`, flashcard và Ôn hôm nay của `boya_learning` (`speechExample()` bỏ qua cụm kết hợp, chỉ lấy câu thật), flashcard `word_learning`.
- **`mywords.js`**: sổ "Từ của tôi" (key `hoc_mywords_v1`), chứa các từ người học tự thêm khi tra trong bài khóa. Mỗi từ có thẻ SM-2 riêng (`schedule()` giống `hsk_lotrinh`). API: `HocMyWords.all/get/has/add/remove/update/due/schedule/ivLabel`. Thẻ được ôn ở `hom_nay`, và trang `luyen_tap` cũng dùng các từ này.
- **`lookup.js`** (`HocLookup`): tách từ khớp dài nhất theo `HOC_DICT`; `pinyinOf(text)` sinh pinyin cho văn bản bất kỳ (tách âm tiết pinyin theo quy tắc thanh mẫu + vận mẫu); `rubyHTML()`; `attach(container, opts)` bật chạm-để-tra (khung tra + thêm vào Từ của tôi). Mỗi đoạn cần có `data-lk-text`, mỗi chữ là `.lk-c[data-i]`. Hiện `doc_them` dùng module này; `boya_learning` vẫn dùng bản tra từ riêng.
- **`notes.js`** (`HocNotes.get/set/all`): ghi chú gợi nhớ theo chữ Hán, key `hoc_notes_v1` (được đồng bộ). Ghi chú hiện ở thẻ ôn của `hom_nay`, khung tra từ (`lookup.js`) và bảng Họ chữ.
- **`zizu.js`** (`HocZizu.open(ch)`): bảng "Họ chữ" (字族) liệt kê mọi từ chứa một chữ.
  - Phần tử có `data-zizu="字"` tự thành nút mở bảng (bắt sự kiện ở pha capture). Các trang đang có nút này: khung tra từ của `doc_them` và `boya_learning`, mặt sau thẻ và danh sách từ cứng đầu ở `hom_nay`.
  - Bảng chia hai phần: Đã học (có thẻ SRS ở bất kỳ trang nào hoặc trong Từ của tôi) và Chưa học (sắp theo cấp HSK, có nút ＋ thêm vào Từ của tôi).
  - Tự nạp lười `shared/dict_vi.js` và `luyen_tap/lt_data.js` (dùng để biết cấp HSK và đổi id thẻ Boya sang chữ Hán), với đường dẫn tính theo vị trí file `zizu.js`.
- **`sentences.js`** (`HocSentences`): "Câu của tôi" (sentence mining), key `hoc_sentences_v1` (được đồng bộ).
  - Mỗi mục: `{id, zh, target (từ bị che), py, hv, vi, ctx_vi (bản dịch đoạn), src, url (tính từ thư mục gốc), card SM-2}`.
  - Câu được lưu bằng nút "✂️ Lưu câu" trong khung tra từ (`lookup.js`, nhận thêm `opts.getContextVi/getUrl/onSentence`) và trong khung tra của `boya_learning` (`toggleSentence`).
  - Câu được ôn dạng điền từ (`cloze()`) ở bước 1 của `hom_nay`.
- **`dict_vi.js`** (khoảng 0,9MB, sinh bởi `tools/build_dict.py`): `HOC_DICT = {m, w: {từ: [pinyin, HÁN VIỆT, nghĩa]}, c: {chữ: [pinyin, HÁN VIỆT]}}`, gộp khoảng 13.000 từ của HSK, Boya và HSK 3.0. Các trang nạp lười file này (`boya_learning` nạp khi mở Bài khóa).

## Tài khoản & đồng bộ (`shared/sync.js`, Supabase)

- **Project:** `https://tlixkdkdfowlokgendgp.supabase.co`. Khóa `anon` công khai nằm trong `sync.js`; được phép để công khai vì quyền truy cập do RLS quyết định. **Không bao giờ** đưa khóa `service_role`/`secret` vào mã.
- **Cách hoạt động:** gọi REST bằng XHR, không dùng thư viện ngoài, chạy được qua `file://`.
  - `localStorage` vẫn là bộ nhớ chính.
  - `sync.js` bọc `Storage.prototype.setItem/removeItem`. Khi ghi một key trong `SYNC_KEYS` (hoặc có tiền tố `hoc_summary_v1:`), key đó được đánh dấu bẩn (`hoc_sync_meta`) và đẩy lên sau 3 giây. Chưa đẩy được thì lần mở trang sau đẩy tiếp.
  - Khi tải trang mà đã đăng nhập, file **tải về bằng XHR đồng bộ** trước khi trang khởi tạo, nên trang luôn đọc dữ liệu mới nhất. Lần tải trước cách dưới 10 giây thì bỏ qua.
  - Quay lại tab sau hơn 1 phút: nếu máy khác có tiến độ mới thì hiện banner "Tải lại". Không tự ghi đè, vì trang đang giữ trạng thái trong bộ nhớ.
- **Khi hai máy cùng sửa một key:** dùng `mergeValues()`.
  - Hợp các khóa.
  - Bản ghi con có mốc thời gian (thẻ SRS…) lấy bản mới hơn.
  - Số lấy giá trị lớn hơn, boolean lấy OR, mảng giá trị đơn lấy hợp.
- **Khi thêm key tiến độ mới ở một trang:** thêm key đó vào `SYNC_KEYS`. Không đồng bộ các tùy chọn giao diện vặt.
- **Phiên đăng nhập** lưu ở `hoc_sync_session` (tự làm mới token). Phần tử có `[data-hoc-account]` tự thành nút tài khoản; trang chủ có nút này trên topbar.
- **SQL tạo bảng** (chạy một lần trong Supabase → SQL Editor):
  ```sql
  create table if not exists public.progress (
    user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
    key        text not null,
    value      text not null,
    updated_at timestamptz not null default now(),
    primary key (user_id, key)
  );
  alter table public.progress enable row level security;
  create policy "Xem tiến độ của mình"  on public.progress for select using (auth.uid() = user_id);
  create policy "Thêm tiến độ của mình" on public.progress for insert with check (auth.uid() = user_id);
  create policy "Sửa tiến độ của mình"  on public.progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy "Xóa tiến độ của mình"  on public.progress for delete using (auth.uid() = user_id);
  -- updated_at do máy chủ đặt mỗi lần ghi (không tin đồng hồ của từng máy)
  create or replace function public.progress_touch() returns trigger language plpgsql as $$
  begin new.updated_at := now(); return new; end $$;
  drop trigger if exists progress_touch on public.progress;
  create trigger progress_touch before insert or update on public.progress
    for each row execute function public.progress_touch();
  ```
- **Supabase → Authentication → Email:** tắt "Confirm email", vì link xác nhận trỏ về `localhost`, không dùng được khi mở trang bằng file.

## Trang chủ (`index.html`): lộ trình 4 chặng

| Chặng | Nội dung | Nhóm (key trong `groups`) |
|---|---|---|
| 1. Nền tảng | Từ vựng HSK 1–3 | `hsk1..hsk3` (từ `hsk_lotrinh`) |
| 2. Trung cấp nền | Boya Chuẩn Trung cấp 1–2 + HSK 4 | `tc1, tc2, hsk4` |
| 3. Trung cấp nâng cao | Boya Trung cấp 1–2 + HSK 5 | `tc3, tc4, hsk5` |
| 4. Cao cấp | Boya Cao cấp 1–2 + HSK 6 | `gc1, gc2, hsk6` |

- Chặng hiện tại là chặng đầu tiên chưa hoàn thành.
- Khung "Ôn tập hôm nay" cộng `due` của mọi trang.
- Mục "Công cụ bổ trợ": `doc_them`, `luyen_tap`, `thong_ke`, `word_learning`.
- `tuvung` và `sach_boya` đã ẩn khỏi trang chủ: nội dung trùng với `boya_learning`, file vẫn giữ và có dải thông báo chuyển trang. Thẻ SRS cũ của `tuvung` (`boya_tv_srs`) vẫn được ôn ở `hom_nay`; dòng "tuvung" trong khung "Ôn tập hôm nay" trỏ tới `hom_nay`.
- **Link vào trang con:** `hsk_lotrinh.html?level=N`, `boya_learning.html?book=<id>&lesson=N`.

Tên quyển thống nhất theo Boya Learning: `tc1/tc2` = Chuẩn Trung cấp 1/2, `tc3/tc4` = Trung cấp 1/2 (冲刺), `gc1/gc2` = Cao cấp 1/2.

## Sinh lại dữ liệu

Không sửa tay các file dữ liệu sinh tự động. Sửa nguồn rồi chạy script:

| File sinh ra | Nguồn | Lệnh |
|---|---|---|
| `hsk_lotrinh/hsk_vocab_data.js` | `tools/word_list_data/HSK1-HSK6_full.xlsx` (sheet HSK1…HSK6, cột: STT, Từ mới, Phiên âm, Giải thích, Ví dụ, Phiên âm VD, Dịch) | `python tools/extract_hsk_vocab.py` (cần `openpyxl`, chạy từ đâu cũng được) |
| `tuvung/vocab_data.js` / `.json` | `sach_boya/tc1.html` … `tc4.html` | `python tools/extract_vocab.py` ⚠️ Bản `vocab_data` hiện tại có vài chỗ đã được sửa tay (ví dụ câu ví dụ "精神～"). Chạy lại script sẽ mất các chỗ sửa đó, nên kiểm tra `git diff` trước khi giữ. |
| Âm Hán Việt: cột 8 của `hsk_vocab_data.js`, trường `han_viet` của `word_learning/json_data/quyen_*` | `tools/hanviet/hv_*.tsv` + `overrides.tsv` (sửa âm sai ở `overrides.tsv`) | `extract_hsk_vocab.py` tự điền khi Excel không có `[..]`. Với HSK 3.0 chạy `python tools/add_hanviet_wl.py` (ghi cả `.json` lẫn `.js`, giữ định dạng; dùng `--force` để ghi đè). |
| `shared/dict_vi.js` | dữ liệu 3 trang + `tools/hanviet/` | `python tools/build_dict.py` (chạy sau khi đổi dữ liệu hoặc âm Hán Việt) |
| `doc_them/doc_data.js` (~3MB) và `doc_them/doc_index.js` (~340KB: mục lục, mỗi bài có danh sách từ `w`, `hom_nay` dùng để gợi ý bài vừa sức) | mọi `tools/doc_them_src/*.json` (`exam*.json` là đề luyện thi) | `python tools/build_doc_them.py` (cần `pypinyin`, `jieba`). Script tự tính pinyin từng chữ và danh sách "từ ngoài cấp" (so với HSK 2.0 cộng HSK 3.0 cùng cấp; cụm tách nhầm cho vào `SPLIT_ARTIFACTS`). |
| `luyen_tap/lt_data.js`, `lt_data_wl.js` | `hsk_lotrinh/hsk_vocab_data.js` (câu ví dụ), `boya_learning/boya_data.json` (từ + câu ví dụ ngữ pháp), `word_learning/json_data/quyen_*.json` (câu ví dụ) | `python tools/build_luyen_tap.py` (cần `pypinyin`, `jieba`). Chạy lại sau khi đổi dữ liệu ở các trang kia. |
| `boya_learning/boya_data.js` / `.json` (phần Cao cấp gc1/gc2) | `tools/scratch/gc_rebuild/gc1_L01.json` … `gc2_L10.json`: chép từ PDF `pdf/高级飞翔篇1.pdf`, `2.pdf`, mỗi bài một file (có thể tách `_part_*.json`) gồm từ vựng, bài đọc + bản dịch và ngữ pháp | Từ thư mục gốc: `python tools/scratch/gc_rebuild/build_gc_books.py` (sinh `tools/scratch/gc1_book.json`, `gc2_book.json`, tự thêm ruby pinyin và câu ví dụ, cần `pypinyin`), rồi `python tools/scratch/merge_all_books.py`. **Không chạy `super_enrich.py`** vì script này thêm từ bịa vào Cao cấp. Quy cách chép nằm trong `gc_rebuild/BRIEF.md`. |

Trên Windows, khi in tiếng Việt / chữ Hán ra console thì đặt `PYTHONIOENCODING=utf-8` để tránh lỗi `UnicodeEncodeError` (cp1252). Các script khác trong `tools/scratch/` vẫn dùng đường dẫn cũ (trước khi chuyển thư mục), phải sửa trước khi chạy lại.

## Buổi học hôm nay (`hom_nay/`)

- Trang chủ có banner dẫn vào, kèm số thẻ đến hạn đếm thô và trạng thái 3 bước.
- **Bước 1 · Ôn tập:** gom thẻ đến hạn từ 5 nguồn rồi ôn kiểu flashcard (phím 1–4; trên điện thoại nút chấm điểm cố định ở đáy). Các nguồn:
  - `hsk_lotrinh_v1.srs`
  - `boya_learning_progress_v2.srs`
  - `boya_tv_srs`
  - `hsk_wl_srs_v3`
  - `hoc_mywords_v1`
- **Gộp trùng theo `cleanHz`:** mỗi chữ chỉ hỏi một lần, điểm chấm áp dụng cho mọi thẻ đến hạn của chữ đó.
- **Ghi ngược đúng key của từng trang:**
  - Mỗi nguồn dùng bản chép công thức `schedule` của chính trang đó, và cập nhật `rt`, bộ đếm ngày (`days`, `boya_tv_days`, `daily`) cùng streak Boya.
  - Mỗi lần chấm, trang đọc lại key rồi mới ghi.
  - Trang cũng sửa `due` trong tóm tắt `hoc_summary_v1:*`.
  - **Khi đổi logic SRS ở một trang học, phải sửa bản chép tương ứng trong `hom_nay.js`.**
- **Dữ liệu hiển thị:** `luyen_tap/lt_data.js` (id → chữ, nghĩa, câu ví dụ) và `shared/dict_vi.js` (Hán Việt). Thẻ Boya chỉ được lấy khi id có trong `LT_DATA.words`, nên phải chạy lại `build_luyen_tap.py` khi đổi dữ liệu Boya.
- **Bước 2 · Học bài mới:** gợi ý bài tiếp theo của chặng hiện tại (logic chặng chép từ `index.html`). Xong khi hôm nay có học từ mới.
- **Bước 3 · Luyện tập:** xong khi làm ≥ 10 câu ở `luyen_tap`.
- **Bước 4 · Đọc 1 bài:** nạp lười `doc_them/doc_index.js`, gợi ý ba loại bài:
  - Đọc tiếp: chương kế của bộ truyện đang đọc dở;
  - Đọc lại: bài đến hạn theo quy tắc `rr` (xem mục Đọc thêm);
  - Vừa sức: biết 90–95% số từ trong `w`.
  - Xong khi hôm nay có bài đọc xong (`steps.read`). Banner trang chủ hiện 4 bước.
- **Thẻ "✂️ Câu của tôi"** (`HocSentences.due()`):
  - Rải xen trong hàng đợi bước 1, không gộp với thẻ từ, chiếm tối đa khoảng 30% khi có giới hạn số thẻ.
  - Mặt trước là câu đã che từ, có ô gõ thử. Mặt sau là câu đầy đủ kèm `ctx_vi` và link mở lại bài.
  - Trang có khối quản lý "✂️ Câu của tôi (N)".
- **Key lưu:** `hom_nay_v1` = `{settings{limit, speak}, days{date:{r, ok, steps}}, streak}`. Streak tăng khi ôn ≥ 10 lượt hoặc xong bước 2/3. Tóm tắt ghi qua `HocProgress("hom_nay")`.
- **Ba kiểu thẻ** (`settings.cardMode`):
  - Kiểu thẻ: Chữ → nghĩa, Nghĩa → chữ (mặt trước đã bỏ phần Hán Việt viết hoa của nghĩa Boya để không lộ đáp án; nút Gợi ý hiện ghi chú hoặc chữ cái đầu của pinyin), và Nghe → nghĩa.
  - Chế độ Trộn chia 50/30/20; thẻ có `reps ≤ 1` luôn hỏi Chữ → nghĩa. `rt` chỉ đo ở kiểu Chữ → nghĩa.
- **Mặt sau thẻ:** mỗi chữ có `data-zizu`, kèm khung ghi chú gợi nhớ (`HocNotes`).
- **Từ cứng đầu:** từ có `max(lapses, wrong) ≥ 4` (lấy giá trị lớn nhất giữa các nguồn, gộp theo chữ Hán) vào khối "🧠 Từ cứng đầu".
  - Nút "Luyện riêng" mở phiên luyện thêm, **không ghi** vào SRS hay bộ đếm ngày.
  - Thẻ ôn thường của từ cứng đầu có nhãn 🧠.
- **Giới hạn:** XP/streak của HSK 3.0 (`hsk_wl_gamify_data_v2`) không được cộng khi ôn ở đây. Nếu tab trang gốc đang mở cùng lúc thì tab đó có thể ghi đè lên.

## Tra từ trong bài khóa (`boya_learning`)

- **Thao tác:** ở chế độ Bài khóa, bấm vào chữ Hán để mở khung tra (công tắc "🔍 Chạm để tra", lưu trong `boya_learning_settings_v1`; khi tắt thì bấm chữ để nghe như cũ).
- **Cách tìm từ:** lấy từ dài nhất trong `HOC_DICT.w` hoặc trong bảng từ của bài có chứa chữ được bấm. Cùng độ dài thì ưu tiên từ của bài. Có mục "Cách tách khác" để chuyển, và phân tích từng chữ.
- **Thêm vào ôn tập:** nút "＋ Thêm vào Từ của tôi" (`HocMyWords.add`, `ex` = câu chứa từ). Nút này có trong khung tra; giao diện là khung nổi trên máy tính, bottom sheet trên điện thoại.
- **Phối hợp với tính năng cũ:** chữ đang bị "Che từ vựng" thì chỉ mở ô che, không tra. Đang đọc tính giờ vẫn tra được.

## Đọc thêm (`doc_them/`)

- **Nội dung** (sáng tác mới; quy cách trong `BRIEF.md` và `BRIEF_MORE.md`): 299 bài, khoảng 212.000 chữ Hán.
  - 95 bài đọc (`kind:"article"`): HSK 1–2 mỗi cấp 5 bài, HSK 3: 15, HSK 4: 30, HSK 5: 25, HSK 6: 15. Phần lớn là truyện ngắn, vì người dùng thích truyện.
  - 10 bộ truyện dài, 124 chương (`kind:"series"`, có các trường `series`, `series_title(_vi)`, `chapter`):
    - s1 一碗汤的距离 (HSK 4, 12 chương);
    - s2 十一点的钟声, trinh thám (HSK 5, 15 chương);
    - s3 等一盏灯, tình cảm đô thị (HSK 4→5, 15 chương);
    - s4 隔着一千三百年, xuyên không thời Đường (HSK 4, 12 chương);
    - s5 街角的小咖啡馆 (HSK 3, 10 chương);
    - s6 失物招领处的狐狸, truyện furry (thế giới động vật nhân hóa), ấm áp + bí ẩn (HSK 4, 12 chương, dàn ý ở `BRIEF_S6.md`);
    - s7 寻找月亮湖, furry phiêu lưu sa mạc, cùng thế giới với s6 (HSK 4, 12 chương, `BRIEF_S7.md`);
    - s8 星之泪失窃案, furry trinh thám (không án mạng, manh mối cài sẵn theo bảng trong `BRIEF_S8.md`), cùng thế giới (HSK 4, 12 chương);
    - s9 消失的夜莺, vụ án thứ hai của thám tử 夜白 (HSK 5, 12 chương, `BRIEF_S9.md`);
    - s10 十年后的情书, vụ án thứ ba của 夜白, trinh thám + tình cảm (夜白×白霜, 阿栗×刺刺) (HSK 4, 12 chương, `BRIEF_S10.md`).
  - Người dùng thích nhất truyện furry trinh thám + tình cảm: viết thêm thì ưu tiên thể loại này. Bộ truyện được sắp theo số (`s10` sau `s9`) trong `build_doc_them.py`.
  - 30 hội thoại (`kind:"dialogue"`): mỗi đoạn có dạng "Tên：lời", kèm `speakers`, `scene_vi`.
  - 50 thành ngữ (`kind:"chengyu"`, có `idiom{hz,py,hv,meaning,usage,examples}`).
  - 14 đề luyện đọc (`exams`): 8 đề HSK 4, 6 đề HSK 5. Mỗi đề gồm 选词填空 5 câu, 排列顺序 5 câu, 阅读理解 6 câu.
- **4 tab:**
  - **Thư viện:** lọc theo loại (Bài đọc / Truyện dài / Hội thoại / Thành ngữ), theo cấp và theo ô tìm kiếm.
    - Truyện dài hiện thành thẻ từng bộ, có tiến độ, nút "Đọc tiếp chương k" và nút chuyển chương trước/sau.
    - Hội thoại hiện tên người nói tô màu theo vai; có chế độ "🎤 Tôi đóng vai" (che lượt của người học, chờ người học tự nói).
    - Thành ngữ có khối đầu bài, mỗi chữ có `data-zizu`.
  - **📝 Luyện thi HSK:** làm đề, bấm giờ tùy chọn, chấm điểm từng phần, xem lời giải; kết quả lưu ở `doc_them_v1.exams[id]`. URL `?exam=e4-01`.
  - **Bài của tôi:** dán văn bản bất kỳ; pinyin sinh bằng `HocLookup.pinyinOf`.
  - **Bài khóa đã học:** các bài trong `boya_learning_progress_v2.lessons`. `boya_data.js` chỉ nạp khi mở tab; chữ và pinyin lấy từ `chinese_html` bằng DOMParser. Bài nào số đoạn khác số bản dịch thì bản dịch được chia theo tỉ lệ độ dài.
- **Trình đọc chung:**
  - Pinyin bật/tắt, cỡ chữ, tô từ chưa học, dịch (tắt / từng đoạn / tất cả), chạm để tra (`HocLookup.attach`).
  - Nghe cả bài hoặc từng đoạn, "Nhại" từng câu.
  - Đọc tính giờ, đếm chữ/phút chỉ tính chữ Hán.
- **Lịch đọc lại** (quy tắc chung, `hom_nay` dùng y hệt):
  - `read[id].rr` là mảng mốc mỗi lần đọc xong, tối đa 1 mốc/ngày, lọc trùng ngày khi đọc. Mốc được ghi khi đánh dấu đã đọc, khi bấm "🔁 Đã đọc lại xong" hoặc khi xong một lượt đọc tính giờ. Bài cũ chưa có `rr` thì coi như `[at]`.
  - Hạn đọc lại: đọc 1 lần → +3 ngày; 2 lần → +7 ngày; từ lần 3 không nhắc nữa. Chỉ nhắc khi bài đang `done`.
- **Khối "✨ Dành cho bạn"** ở đầu Thư viện gồm: Đọc tiếp, Đọc lại hôm nay, Vừa sức (3 bài chưa đọc biết 90–95% từ, ưu tiên truyện).
- **"% từ đã biết":** so với chữ Hán của mọi thẻ SRS và "Từ của tôi". Thẻ Boya được đổi id sang chữ Hán qua `luyen_tap/lt_data.js`.
- **URL:** `?id=h3-02`, `?mine=<id>`, `?boya=tc1_bai1&r=0`.
- **Key lưu:** `doc_them_v1` = `{settings, mine[], read{id:{done, at, quiz, cpm[]}}}`, được đồng bộ. Tóm tắt ghi qua `HocProgress("doc_them")`. Hàm cho test để lộ ở `window.__DT`.
- **Thêm bài mới:** viết theo `tools/doc_them_src/BRIEF.md` vào `hskN.json`, rồi chạy `build_doc_them.py`.

## Luyện tập (`luyen_tap/`)

- **Hai dạng bài** (theo yêu cầu người dùng: luyện nhớ bằng cách tự viết ra, không chỉ chọn đáp án):
  - **Sắp xếp câu:** đọc nghĩa tiếng Việt, bấm các mảnh để ghép thành câu tiếng Trung. Có tùy chọn thêm 2 mảnh gây nhiễu.
  - **Nghe – viết từ / câu:** nghe TTS rồi gõ chữ Hán bằng bộ gõ của máy. Enter đang soạn chữ (`isComposing`) không bị tính là nộp bài.
- **Nguồn từ:** chỉ lấy từ đã học, bằng cách đọc thẻ SRS của các trang khác (không ghi vào đó):
  - `hsk_lotrinh_v1.srs` (id `cấp-chữ`);
  - `boya_learning_progress_v2.srs` và `boya_tv_srs` (id `tc1_3_5`);
  - `hsk_wl_srs_v3` (id `L1-0001`, thẻ tự chứa hz/py/vi).
  - Câu ví dụ ngữ pháp Boya thuộc về bài (`L:tc1_3`) và được dùng khi đã học ít nhất 1 từ của bài.
  - Chưa học gì thì dùng chế độ "Luyện tự do" theo cấp HSK.
- **Dữ liệu câu:** mỗi câu là `[chủ, "mảnh|mảnh", pinyin, nghĩa]`. Mảnh được tách sẵn: theo ranh giới từ của pinyin nếu pinyin viết theo từ, không thì dùng jieba. Dấu câu đóng dính vào mảnh trước.
  - `lt_data_wl.js` (khoảng 1,8MB) chỉ nạp khi có thẻ HSK 3.0.
- **Chọn câu:** ưu tiên từ đến hạn ôn, hay quên (`lapses`/`wrong`), nhận diện chậm (`rt`) và câu từng sai ở trang này.
- **Trong phiên:** câu sai được hỏi lại một lần ở cuối phiên; điểm tính theo lần đầu. Dùng gợi ý thì không tính là đúng. Nút "Tôi đúng" dùng khi người học xếp hoặc viết theo cách khác cũng đúng.
- **Key lưu:** `luyen_tap_v1` = `{settings, items{key:{w,c,t}}, types, days, games}`, được đồng bộ qua `sync.js`. Tóm tắt ghi qua `HocProgress("luyen_tap")`. Trang chủ có link trong mục "Công cụ bổ trợ".
- **Trò chơi (14 trò, chuyển từ `tuvung`, viết lại theo API mới):** mỗi trò là một file `luyen_tap/games/<id>.js`, tự đăng ký vào `window.LT_GAMES`. Khung (`openGame`/`finishGame` trong `luyen_tap.js`) truyền vào `ctx` gồm: từ đã học theo "Nguồn từ", câu ví dụ, `ctx.data` = `lt_games_data.js`, TTS, các hàm hẹn giờ tự hủy, `finish()`. Khung hiện màn kết quả chuẩn, lưu kỷ lục ở `S.games[id] = {plays, best, last}`. Đặc tả nằm trong `games/README.md`.
  - Trò dùng từ đã học: match, tf, scramble, hunter, falling, cloze, boss, wordle, wordsearch, chain (chain thêm `word_chain` khi cần).
  - Trò dùng dữ liệu Boya viết sẵn (`ownData`): synonyms, antonyms, collocation, radicals.
  - **`synonyms` = "Phân biệt từ dễ nhầm":** dùng `LT_GAMES_DATA.confusables`, gồm 68 nhóm từ dễ nhầm HSK 4–6 (cặp hoặc bộ ba), tự viết.
    - Cấu trúc mỗi nhóm: `{id, level, words:[{hz,py,hv,mean}], explain, items:[{sentence có "＿＿", answer, py, vi, why}]}`.
    - Trò có chọn cấp và số câu; câu sai được hỏi lại; có nút "📖 Xem phân biệt" và chế độ "📚 Xem danh sách" (tìm theo chữ, pinyin hoặc Hán Việt).
    - Muốn thêm nhóm thì sửa thẳng `lt_games_data.js`; file này viết tay, không sinh tự động.
  - Trò chơi không ghi vào SRS. Thêm trò mới: tạo file theo README rồi thêm thẻ `<script>` vào `luyen_tap.html`.
- **Test:** `window.__LT` để lộ `buildPool`, `sentencesFor`, `buildItems`, `startSession`, `openGame`, `gameList`, `state`, `session`.

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
- **Kiểm tra xếp lớp** (`?placement=1`, thẻ lối vào ở đầu tab Lộ trình; trang chủ có link khi còn ở Chặng 1):
  - Mỗi bài hỏi 3 từ (bài 20 từ hỏi 4): chọn nghĩa, 8 giây/câu, có nút "Không biết". Phạm vi chọn được: HSK 1–3, 1–4 hoặc 1–5. Cấp nào đúng dưới 60% thì dừng.
  - Bài đạt khi đúng hết (bài 4 từ được sai 1) và trung bình câu đúng ≤ 4 giây.
  - Áp dụng kết quả:
    - bài đạt có `done:true, placed:true`; chặng đủ bài thì xong; mở khóa các cấp đã kiểm tra;
    - từ của bài đạt vào SRS với `iv` 20–45 ngày (rải hạn ôn);
    - từ sai thì đến hạn ngay;
    - không bao giờ hạ cấp dữ liệu đã có.
  - Lưu `S.placement = {at, range, result}`.
- **Đặt lại tiến độ:**
  - Có nút ↺ ở ba mức: từng bài (trong hộp xem trước bài), từng chặng (đầu chặng), cả cấp (đầu bảng cấp). Thẻ Kiểm tra xếp lớp có thêm nút "↺ Hoàn tác".
  - Ba chế độ đặt lại:
    - `mark`: chỉ bỏ đánh dấu xong;
    - `placed`: bỏ đánh dấu và xóa thẻ do kiểm tra xếp lớp tạo mà chưa ôn lần nào (`placed:true` và `last <= first`);
    - `all`: xóa mọi thẻ ôn của các từ.
  - Bài/chặng không bị xóa khỏi `S.units`/`S.stages` mà được ghi đè bằng `{done:false, best:0, at:now, reset:true}`. Nhờ có mốc thời gian mới, khi `sync.js` gộp dữ liệu sẽ chọn bản đã đặt lại và không khôi phục bản cũ.
  - Hàm: `resetProgress`, `confirmReset`, `undoPlacement`.
- **Phát âm:** Web Speech API (`speechSynthesis`, giọng `zh-CN`).
- **Lưu ý CSS:** không dùng `opacity: 0` trong `@keyframes` cho phần tử được hiện ra từ `hidden` / `display:none`. Từng có lỗi thẻ bị kẹt ở trạng thái trong suốt, vì vậy các animation `pop` và `fade` chỉ dùng `transform`.

## Các trang học (sau đợt nâng cấp 11/2026)

Ba trang dưới đây theo cùng một mô hình với `hsk_lotrinh`:
- học theo bài, có ngưỡng điểm để qua bài;
- ôn tập SM-2: `schedule()` và `ivLabel()` được chép từ `hsk_lotrinh.js`, mỗi trang giữ một bản riêng (không import);
- đo tốc độ nhận diện `rt`;
- ghi tóm tắt tiến độ qua `HocProgress`.

Khi sửa logic SRS ở một trang, cân nhắc sửa đồng bộ ở các trang còn lại.

### `boya_learning/` (6 quyển, 74 bài, 4.472 từ)
- **Mỗi bài có 4 bước:** Từ vựng (lật hết flashcard) → Bài khóa (cuộn hết từng phần hoặc đọc xong một lượt tính giờ) → Ngữ pháp (xem hết các thẻ) → Kiểm tra.
- **Hoàn thành bài:** chỉ khi bài kiểm tra đạt ≥ 80%. Bài kiểm tra có tối đa 12 câu từ vựng và 3 câu ngữ pháp; câu sai được hỏi lại; điểm tính theo lần trả lời đầu.
- **Ôn tập:** "Ôn hôm nay" gom từ đến hạn của mọi quyển.
- **Đọc bài khóa:** đọc tính giờ (chữ/phút, chỉ đếm chữ Hán), có nút nhại theo TTS, có chế độ "Che từ vựng".
- **Streak:** chỉ tăng khi trong ngày làm ≥ 10 câu hoặc ôn ≥ 10 thẻ.
- **URL:** `?book=<id>&lesson=<n>`, chấp nhận cả bí danh cc1/cc2.
- **Key lưu:** `boya_learning_progress_v2` = `{v, lessons{fc,rd,gr,best,tries,done,doneAt,legacy}, srs, days, streak, reading}` và `boya_learning_settings_v1`. Key `v1` cũ chỉ đọc một lần để chuyển dữ liệu.
- **Màu theo quyển:** JS đặt `--book: var(--ui-book-<id>)`, các màu `--primary-*` suy ra từ biến này.
- **Ghi chú:** Chrome headless không phát sự kiện cuộn, nên test phải tự phát `scroll`.

### `tuvung/` (Boya TC1–4, 54 bài, 2.565 từ) — ĐÃ ẨN, không phát triển thêm
- **Tab:** Học tiếp (mặc định) / Flashcard & SRS / Quiz / Từ vựng / Thêm trò chơi.
- **Hoàn thành bài:** khi quiz Tiêu chuẩn của bài đạt ≥ 85% (tối thiểu 10 câu) và mọi từ của bài đã có thẻ SRS.
- **Giới hạn từ mới mỗi ngày:** 10–30 từ.
- **Chỉ quiz Tiêu chuẩn và chấm flashcard được ghi vào SRS.** Các trò chơi và kiểu quiz khác không ghi.
- **Trả lời sai:** chỉ hạ một bậc (`iv ≈ iv/ef`), không về 0.
- **Trạng thái từ:** suy ra hoàn toàn từ SRS. "Sổ lỗi" là trường `wrong` của thẻ.
- **Key lưu:**
  - `boya_tv_srs`, `boya_tv_progress`, `boya_tv_settings`, `boya_tv_days`, `boya_tv_best`, `boya_starred_words`.
  - Dữ liệu cũ được sao lưu vào `boya_tv_legacy_backup` rồi xóa: `boya_srs_data`, `boya_mastered_words`, `boya_unmastered_words`, `boya_wrong_words`, `boya_quiz_high_score`, `boya_theme`.
- **URL:** `?lesson=tc1_3`.

### `word_learning/` (HSK 3.0, 8 quyển, 368 bài, 11.092 từ, 20 từ/bài)
- **Tab:** Học từ → Luyện tập (Kiểm tra từ vựng + Bài tập SGK) → Ôn tập → Trò chơi · Luyện nói.
- **Hoàn thành bài:** khi Kiểm tra bài hoặc Bài tập SGK đạt ≥ 80%. Khi đó cả 20 từ của bài vào SRS. "Điền đáp án mẫu" không được tính.
- **Học theo thứ tự:** `settings.sequential`, mặc định bật.
- **Ôn tập:** "Ôn hôm nay" gộp mọi quyển.
  - Mỗi thẻ SRS tự lưu chữ Hán, pinyin, nghĩa, quyển và bài, vì dữ liệu quyển được nạp lười (`json_data/quyen_*.js`).
  - Khi ôn, trang nạp các quyển cần thiết để hiện câu ví dụ.
- **Key lưu:** `hsk_wl_srs_v3` (thẻ SM-2) và `hsk_wl_json_progress_v2`. Key `hsk_wl_srs_data_v2` (Leitner cũ) chỉ đọc một lần để chuyển dữ liệu.
- **URL:** `?book=q1&unit=3`.
- **Ghi chú:** phần PDF đã bị gỡ hẳn, thư mục `word_learning_book/` không còn được dùng.

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
