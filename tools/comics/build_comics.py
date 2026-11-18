"""Gắn ảnh truyện tranh vào trang Đọc thêm.

    python tools/comics/build_comics.py s10

- Ảnh gốc ở tools/comics/raw/<series>/<id>_p<n>.(png|jpg|webp) → thu nhỏ còn rộng 960px, đổi sang WebP
  (~100–150KB/ảnh) vào doc_them/comics/<series>/.
- Ghi doc_them/comic_data.js (window.HOC_COMIC_DATA): ảnh của từng đoạn văn (đoạn thứ 2+ trong cùng khung
  dùng lại ảnh với góc cắt khác) + tên người nói của từng câu thoại (trường "lines" trong panels_<series>.json).
  Dữ liệu của các bộ khác trong file được giữ nguyên.
"""
import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chapter_json import find_text  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
WEB = os.path.join(ROOT, "doc_them")
DATA_JS = os.path.join(WEB, "comic_data.js")
PREFIX = "window.HOC_COMIC_DATA = "
WIDTH = 960
# Góc cắt cho đoạn thứ 1, 2, 3… dùng chung một ảnh
CROPS = [("50% 50%", 1.0), ("30% 45%", 1.15), ("70% 45%", 1.15), ("50% 35%", 1.2)]


def load_data():
    if os.path.exists(DATA_JS):
        txt = open(DATA_JS, encoding="utf-8").read()
        i = txt.find(PREFIX)
        if i >= 0:
            body = txt[i + len(PREFIX):].strip().rstrip(";")
            try:
                return json.loads(body)
            except ValueError:
                pass
    return {"series": {}}


def save_data(data):
    with open(DATA_JS, "w", encoding="utf-8", newline="\n") as f:
        f.write("/* SINH TỰ ĐỘNG bởi tools/comics/build_comics.py — không sửa tay. */\n")
        f.write(PREFIX + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")


def convert(src, dst):
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return False
    im = Image.open(src).convert("RGB")
    if im.width > WIDTH:
        im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
    im.save(dst, "WEBP", quality=80, method=6)
    return True


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    series = sys.argv[1]
    panels = json.load(open(os.path.join(HERE, "panels_%s.json" % series), encoding="utf-8"))
    raw = os.path.join(HERE, "raw", series)
    out = os.path.join(WEB, "comics", series)
    os.makedirs(out, exist_ok=True)

    frames, speakers, first = {}, {}, None
    n_img = n_new = n_lines = 0
    for doc_id, lst in panels["chapters"].items():
        for pn in lst:
            name = "%s_p%d" % (doc_id, pn["n"])
            for ln in pn.get("lines", []):
                speakers.setdefault(doc_id, {}).setdefault(str(ln["p"]), []).append([ln["zh"], ln["who"]])
                n_lines += 1
            src = next((os.path.join(raw, name + e) for e in (".png", ".jpg", ".jpeg", ".webp")
                        if os.path.exists(os.path.join(raw, name + e))), None)
            if not src:
                continue
            if convert(src, os.path.join(out, name + ".webp")):
                n_new += 1
            n_img += 1
            rel = "comics/%s/%s.webp" % (series, name)
            first = first or (doc_id, rel)
            for k, p in enumerate(pn["paras"]):
                pos, zoom = CROPS[min(k, len(CROPS) - 1)]
                frames.setdefault(doc_id, {})[str(p)] = {"src": rel, "pos": pos, "zoom": zoom, "tag": pn["tag"]}

    story = None
    if first:
        t = find_text(first[0]) or {}
        title = panels.get("title", "")
        story = {"id": first[0], "title": title.split(" · ")[0], "title_vi": title.split(" · ")[-1],
                 "level": t.get("level", 4), "kind": "series", "thumb": first[1], "tag": panels.get("tag", "")}

    data = load_data()
    data["series"][series] = {"story": story, "panels": frames, "speakers": speakers}
    save_data(data)
    size = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)) / 1048576
    print("%s: %d ảnh (%d mới đổi), %d câu thoại có tên người nói, thư mục ảnh %.1f MB"
          % (series, n_img, n_new, n_lines, size))


if __name__ == "__main__":
    main()
