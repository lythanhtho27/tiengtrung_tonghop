# -*- coding: utf-8 -*-
"""
Bảng âm Hán Việt theo (chữ, pinyin) cho mọi chữ trong từ vựng HSK 1–6, HSK 3.0 và Boya.

Nguồn: tools/hanviet/hv_1.tsv … hv_3.tsv  (dòng: "chữ|pinyin<TAB>ÂM")
       tools/hanviet/overrides.tsv       (tùy chọn, cùng định dạng, ưu tiên cao nhất — sửa tay ở đây)
Dùng:  from hanviet import word_hv, char_hv
       word_hv("学习") -> "HỌC TẬP"
"""
import glob
import os
import re
from collections import Counter

from pypinyin import pinyin, Style

HERE = os.path.dirname(os.path.abspath(__file__))
HAN = re.compile(r"[㐀-鿿]")

_MAP = None      # "chữ|pinyin" -> ÂM
_CHAR = None     # "chữ" -> ÂM thông dụng nhất (âm đọc mặc định của pypinyin, không có thì âm gặp nhiều nhất)


def _load():
    global _MAP, _CHAR
    if _MAP is not None:
        return
    _MAP = {}
    files = sorted(glob.glob(os.path.join(HERE, "hv_*.tsv")))
    ov = os.path.join(HERE, "overrides.tsv")
    if os.path.exists(ov):
        files.append(ov)
    for f in files:
        for line in open(f, encoding="utf-8"):
            line = line.rstrip("\n\r")
            if not line or line.startswith("#") or "\t" not in line:
                continue
            k, v = line.split("\t", 1)
            v = v.strip().upper()
            if v and v != "?":
                _MAP[k.strip()] = v
    by_char = {}
    for k, v in _MAP.items():
        c, p = k.split("|", 1)
        by_char.setdefault(c, []).append((p, v))
    _CHAR = {}
    for c, lst in by_char.items():
        default_py = pinyin(c, style=Style.TONE)[0][0]
        hit = [v for p, v in lst if p == default_py]
        _CHAR[c] = hit[0] if hit else Counter(v for _, v in lst).most_common(1)[0][0]


def clean_hz(s):
    t = re.sub(r"[（(]([^）)]*)[）)](?=[一-鿿])", r"\1", str(s or ""))
    t = re.sub(r"\s*[（(][^）)]*[）)]\s*", "", t)
    return re.sub(r"\s+", "", t)


def char_hv(c, py=None):
    _load()
    if py and (c + "|" + py) in _MAP:
        return _MAP[c + "|" + py]
    return _CHAR.get(c, "")


def word_hv(hz):
    """Âm Hán Việt của cả từ (đọc theo ngữ cảnh cụm từ của pypinyin). Thiếu âm của chữ nào thì trả ""."""
    _load()
    hans = "".join(HAN.findall(clean_hz(hz)))
    if not hans:
        return ""
    pys = [x[0] for x in pinyin(hans, style=Style.TONE)]
    out = []
    for c, p in zip(hans, pys):
        v = char_hv(c, p)
        if not v:
            return ""
        out.append(v)
    return " ".join(out)


def char_table():
    """{chữ: [pinyin mặc định, ÂM]} cho từ điển tra nhanh."""
    _load()
    return {c: [pinyin(c, style=Style.TONE)[0][0], v] for c, v in _CHAR.items()}
