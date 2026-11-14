# -*- coding: utf-8 -*-
"""Trích xuất word_list_data/HSK1-HSK6_full.xlsx -> hsk_vocab_data.js
(Hán Việt: lấy phần [..] trong cột phiên âm nếu có, không thì sinh từ tools/hanviet/)

Chạy (từ bất kỳ đâu):  python tools/extract_hsk_vocab.py
Mỗi từ: [level, hanzi, pinyin, nghĩa, ví dụ (Hán), ví dụ (pinyin), ví dụ (dịch), hán việt]
"""
import json
import os
import re
import sys
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "word_list_data", "HSK1-HSK6_full.xlsx")
OUT = os.path.join(ROOT, "hsk_lotrinh", "hsk_vocab_data.js")
sys.path.insert(0, os.path.join(HERE, "hanviet"))
from hanviet import word_hv  # noqa: E402  (âm Hán Việt cho từ không ghi sẵn [..] trong file Excel)


def clean(v):
    if v is None:
        return ""
    return re.sub(r"\s+", " ", str(v)).strip()


def main():
    wb = openpyxl.load_workbook(SRC, read_only=True)
    words = []
    counts = {}
    for ws in wb.worksheets:
        m = re.search(r"(\d)", ws.title)
        if not m:
            continue
        level = int(m.group(1))
        n = 0
        for row in ws.iter_rows(min_row=2, values_only=True):
            hanzi = clean(row[1])
            if not hanzi:
                continue
            pinyin = clean(row[2])
            hanviet = ""
            hv = re.search(r"\[(.+?)\]", pinyin)
            if hv:
                hanviet = hv.group(1).strip()
                pinyin = re.sub(r"\s*\[.+?\]\s*", " ", pinyin).strip()
            if not hanviet:
                hanviet = word_hv(hanzi)
            words.append([
                level, hanzi, pinyin, clean(row[3]),
                clean(row[4]), clean(row[5]), clean(row[6]), hanviet,
            ])
            n += 1
        counts[level] = n

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// Tự động sinh bởi extract_hsk_vocab.py từ " + SRC + " — không sửa tay\n")
        f.write("// [level, hanzi, pinyin, nghĩa, ví dụ, pinyin ví dụ, dịch ví dụ, hán việt]\n")
        f.write("window.HSK_VOCAB = [\n")
        for w in words:
            f.write(json.dumps(w, ensure_ascii=False, separators=(",", ":")) + ",\n")
        f.write("];\n")
    print("Đã ghi", OUT, counts, "tổng", len(words))


if __name__ == "__main__":
    main()
