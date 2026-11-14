# -*- coding: utf-8 -*-
"""
Điền âm Hán Việt (trường han_viet) cho mọi từ của Giáo trình HSK 3.0 (word_learning/json_data/quyen_*.json)
rồi ghi lại cả bản .json (indent=2) và .js (window.HSK_BOOK_JSON[...] = ...;) giữ đúng định dạng cũ.
Từ nào đã có han_viet thì giữ nguyên (thêm --force để ghi đè).

Chạy (từ đâu cũng được, cần pypinyin):  python tools/add_hanviet_wl.py [--force]
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, "hanviet"))
from hanviet import word_hv  # noqa: E402


def main():
    force = "--force" in sys.argv
    total = filled = missing = 0
    for jp in sorted(glob.glob(os.path.join(ROOT, "word_learning", "json_data", "quyen_*.json"))):
        d = json.load(open(jp, encoding="utf-8"))
        for u in d.get("units", []):
            for w in u.get("target_words", []):
                total += 1
                if w.get("han_viet") and not force:
                    continue
                hv = word_hv(w.get("word", ""))
                if hv:
                    w["han_viet"] = hv
                    filled += 1
                else:
                    missing += 1
        with open(jp, "w", encoding="utf-8") as f:
            f.write(json.dumps(d, ensure_ascii=False, indent=2))
        js = jp[:-5] + ".js"
        with open(js, "w", encoding="utf-8") as f:
            f.write("window.HSK_BOOK_JSON = window.HSK_BOOK_JSON || {};\n")
            f.write(f"window.HSK_BOOK_JSON['{d['id']}'] = " + json.dumps(d, ensure_ascii=False) + ";\n")
    print(f"{total} từ: điền {filled}, chưa có âm {missing}")


if __name__ == "__main__":
    main()
