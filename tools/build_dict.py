# -*- coding: utf-8 -*-
"""
Sinh từ điển tra nhanh Trung → Việt dùng chung: shared/dict_vi.js
  window.HOC_DICT = { m: <độ dài từ dài nhất>, w: { "学习": [pinyin, HÁN VIỆT, nghĩa], … }, c: { "学": [pinyin, HÁN VIỆT], … } }
Nguồn (gộp, bỏ trùng): hsk_lotrinh/hsk_vocab_data.js, boya_learning/boya_data.json, word_learning/json_data/quyen_*.json
Hán Việt: lấy sẵn trong dữ liệu nếu có, không thì sinh từ tools/hanviet/.
Trang dùng: boya_learning (bấm vào chữ trong bài khóa để tra). Chạy lại sau khi đổi dữ liệu các trang.

Chạy (từ đâu cũng được, cần pypinyin):  python tools/build_dict.py
"""
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, "hanviet"))
from hanviet import word_hv, char_table, clean_hz  # noqa: E402

HAN = re.compile(r"[㐀-鿿]")


def load_js_assign(path):
    s = open(path, encoding="utf-8").read()
    s = s[s.index("=") + 1:].strip().rstrip(";")
    s = re.sub(r",\s*([\]}])", r"\1", s)
    return json.loads(s)


def short(s, n=90):
    s = re.sub(r"\s+", " ", str(s or "")).strip().rstrip("/").strip()
    return s if len(s) <= n else s[:n - 1].rstrip(" ,;") + "…"


def main():
    words = {}   # hz -> [py, hv, [nghĩa…]]

    def add(hz, py, hv, vi):
        hz = clean_hz(hz)
        if not hz or not HAN.search(hz) or len(hz) > 12:
            return
        vi = short(vi)
        e = words.get(hz)
        if not e:
            words[hz] = e = [py or "", (hv or "").upper(), []]
        if not e[0] and py:
            e[0] = py
        if not e[1] and hv:
            e[1] = hv.upper()
        if vi and vi.lower() not in [x.lower() for x in e[2]] and len(e[2]) < 2:
            e[2].append(vi)

    # HSK 1–6 (nghĩa ngắn gọn -> ưu tiên đứng đầu)
    for r in load_js_assign(os.path.join(ROOT, "hsk_lotrinh", "hsk_vocab_data.js")):
        add(r[1], r[2], r[7] if len(r) > 7 else "", r[3])
    # Boya: mean dạng "HÁN VIỆT (nghĩa) /"
    boya = json.load(open(os.path.join(ROOT, "boya_learning", "boya_data.json"), encoding="utf-8"))
    for b in boya["books"]:
        for l in b["lessons"]:
            for w in l.get("words", []):
                m = re.sub(r"\s*/\s*$", "", w.get("mean", "")).strip()
                mm = re.match(r"^([A-ZÀ-ỸĐ][A-ZÀ-ỸĐ\s\-]+?)\s*\((.*)\)$", m)
                hv, vi = (mm.group(1).strip(), mm.group(2).strip()) if mm else ("", m)
                add(w["hz"], w.get("py", ""), hv, vi)
    # HSK 3.0
    for p in sorted(glob.glob(os.path.join(ROOT, "word_learning", "json_data", "quyen_*.json"))):
        for u in json.load(open(p, encoding="utf-8")).get("units", []):
            for w in u.get("target_words", []):
                add(w.get("word", ""), w.get("pinyin", ""), w.get("han_viet", ""), w.get("meaning_vi") or w.get("meaning_primary", ""))

    out_w = {}
    for hz, (py, hv, vis) in words.items():
        out_w[hz] = [py, hv or word_hv(hz), " · ".join(vis)]
    data = {"m": max(len(k) for k in out_w), "w": out_w, "c": char_table()}
    dst = os.path.join(ROOT, "shared", "dict_vi.js")
    with open(dst, "w", encoding="utf-8") as f:
        f.write("/* Sinh tự động bởi tools/build_dict.py — không sửa tay */\nwindow.HOC_DICT = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    no_hv = sum(1 for v in out_w.values() if not v[1])
    print(f"{dst}: {len(out_w)} từ ({no_hv} thiếu Hán Việt), {len(data['c'])} chữ, dài nhất {data['m']}")


if __name__ == "__main__":
    main()
