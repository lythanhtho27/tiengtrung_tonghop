# -*- coding: utf-8 -*-
"""
Sinh dữ liệu cho trang Luyện tập (luyen_tap/):
  luyen_tap/lt_data.js     window.LT_DATA = { words: {...}, sents: [...] }   (HSK + Boya)
  luyen_tap/lt_data_wl.js  window.LT_DATA_WL = { sents: [...] }              (Word Learning, nạp khi cần)

Mỗi câu: [chủ, "mảnh|mảnh|…", pinyin, tiếng Việt]
  chủ = id từ (HSK "3-帮忙", Word Learning "L1-0001") hoặc "L:<bài Boya>" (vd "L:tc1_3": câu ví dụ ngữ pháp của bài 3 quyển tc1).
  Mảnh = cụm từ đã tách sẵn (pypinyin mmseg), dấu câu dính vào mảnh trước.
Mỗi từ (để nghe – viết): words[id] = [chữ Hán, pinyin, nghĩa]  (HSK + Boya; từ Word Learning lấy từ thẻ SRS).

Chạy (từ đâu cũng được, cần pypinyin và jieba: pip install pypinyin jieba):  python tools/build_luyen_tap.py
"""
import glob, json, os, re, unicodedata
from pypinyin import pinyin, Style
import jieba
jieba.setLogLevel(60)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "luyen_tap")

HAN = re.compile(r"[㐀-鿿]")
PUNCT = "，。！？；：、“”‘’（）《》…—·,.!?;:\"'()「」『』 "


def load_js_assign(path):
    s = open(path, encoding="utf-8").read()
    s = s[s.index("=") + 1:].strip().rstrip(";")
    s = re.sub(r",\s*([\]}])", r"\1", s)
    return json.loads(s)


def clean_hz(s):
    t = re.sub(r"[（(]([^）)]*)[）)](?=[一-鿿])", r"\1", s)
    t = re.sub(r"\s*[（(][^）)]*[）)]\s*", "", t)
    return re.sub(r"\s+", "", t).strip() or s


def _plain(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("ü", "v").replace("u:", "v")


def _cands(ch):
    c = {_plain(p) for p in pinyin(ch, style=Style.NORMAL, heteronym=True)[0]}
    c |= {x.replace("v", "u") for x in c}
    if ch == "儿":
        c.add("r")
    if ch == "一":
        c.add("yi")
    if ch == "不":
        c.add("bu")
    return c


def align_by_pinyin(zh, py):
    """Tách zh theo ranh giới từ của pinyin (pinyin trong dữ liệu đã viết liền theo từ). Trả None nếu không khớp."""
    words = [w for w in re.split(r"[\s\-]+", _plain(re.sub(r"[^\w\s\-ü:āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ']", " ", py))) if w]
    words = [w.replace("'", "") for w in words]
    hans = [(i, ch) for i, ch in enumerate(zh) if HAN.match(ch)]
    if not words or not hans:
        return None
    cands = [_cands(ch) for _, ch in hans]
    bounds, k = [], 0          # bounds: chỉ số chữ Hán kết thúc mỗi từ
    for w in words:
        if re.fullmatch(r"\d+", w):
            continue
        # tìm số chữ n sao cho ghép pinyin của n chữ bằng w
        def match(pos, rest):
            if rest == "":
                return pos
            if pos >= len(hans):
                return None
            for c in sorted(cands[pos], key=len, reverse=True):
                if c and rest.startswith(c):
                    r = match(pos + 1, rest[len(c):])
                    if r is not None:
                        return r
            return None
        end = match(k, w)
        if end is None:
            return None
        bounds.append(end)
        k = end
    if k != len(hans):
        return None
    # dựng các mảnh theo vị trí trong chuỗi gốc (giữ dấu câu, số, chữ Latin)
    toks, start = [], 0
    for b in bounds:
        last_char_idx = hans[b - 1][0]
        toks.append(zh[start:last_char_idx + 1])
        start = last_char_idx + 1
    if start < len(zh):
        toks[-1] += zh[start:]
    return toks


CLOSING = "，。！？；：、”’）》…,.!?;:)"


def chunks(zh, py="", max_chunks=8):
    """Tách câu thành các mảnh: theo ranh giới từ của pinyin nếu pinyin viết theo từ, không thì dùng jieba.
    Dấu câu đóng dính vào mảnh trước; quá max_chunks mảnh thì gộp cặp kề nhau ngắn nhất."""
    aligned = align_by_pinyin(zh, py) if py else None
    # pinyin viết rời từng âm tiết (Word Learning) -> căn theo pinyin chỉ ra từng chữ, không dùng được
    if aligned and len(HAN.findall(zh)) / max(1, len(aligned)) < 1.3:
        aligned = None
    raw = aligned if aligned else list(jieba.cut(zh))
    toks = []
    for t in raw:
        t = t.strip()
        if not t:
            continue
        # chuyển dấu câu đóng ở đầu mảnh về cuối mảnh trước
        while toks and t and t[0] in CLOSING:
            toks[-1] += t[0]
            t = t[1:]
        if not t:
            continue
        if toks and (all(c in PUNCT for c in t) and not t.startswith(("“", "‘", "《", "（", "("))):
            toks[-1] += t
        elif toks and toks[-1] and toks[-1][-1] in "“‘《（(":
            toks[-1] += t          # dấu mở đứng riêng -> dính vào từ sau nó
        else:
            toks.append(t)
    # dấu mở bị tách riêng ở cuối mảnh trước -> chuyển sang đầu mảnh sau
    for i in range(len(toks) - 1):
        while toks[i] and toks[i][-1] in "“‘《（(" and len(toks[i]) > 1:
            toks[i + 1] = toks[i][-1] + toks[i + 1]
            toks[i] = toks[i][:-1]
    while len(toks) > max_chunks:
        best, bi = None, 0
        for i in range(len(toks) - 1):
            n = len(HAN.findall(toks[i])) + len(HAN.findall(toks[i + 1]))
            if best is None or n < best:
                best, bi = n, i
        toks[bi:bi + 2] = [toks[bi] + toks[bi + 1]]
    return toks


def usable(zh):
    n = len(HAN.findall(zh))
    return 3 <= n <= 40 and not re.search(r"造句|造一个句子|这个词|用.{0,3}“", zh) and "～" not in zh and "/" not in zh and "／" not in zh and "（" not in zh and "(" not in zh


def main():
    words, sents = {}, []

    # --- HSK (hsk_lotrinh) ---
    for r in load_js_assign(os.path.join(ROOT, "hsk_lotrinh", "hsk_vocab_data.js")):
        lv, hz, py, vi, ex, expy, exvi = r[0], r[1], r[2], r[3], r[4], r[5], r[6]
        wid = f"{lv}-{hz}"
        words[wid] = [clean_hz(hz), py, vi]
        if ex and exvi and usable(ex):
            sents.append([wid, "|".join(chunks(ex, expy or "")), expy or "", exvi])

    # --- Boya (boya_learning, dùng chung id với tuvung) ---
    boya = json.load(open(os.path.join(ROOT, "boya_learning", "boya_data.json"), encoding="utf-8"))
    for b in boya["books"]:
        for l in b["lessons"]:
            for w in l.get("words", []):
                mean = re.sub(r"\s*/\s*$", "", w.get("mean", "")).strip()
                words[w["id"]] = [clean_hz(w["hz"]), w.get("py", ""), mean]
            owner = f"L:{b['id']}_{l['lesson_num']}"
            for g in l.get("grammar", []):
                for e in g.get("examples", []):
                    zh, vi = (e.get("zh") or "").strip(), (e.get("vi") or "").strip()
                    if zh and vi and usable(zh):
                        sents.append([owner, "|".join(chunks(zh, e.get("pinyin") or "")), (e.get("pinyin") or "").strip(), vi])

    data = {"words": words, "sents": sents}
    with open(os.path.join(OUT, "lt_data.js"), "w", encoding="utf-8") as f:
        f.write("/* Sinh tự động bởi tools/build_luyen_tap.py — không sửa tay */\nwindow.LT_DATA = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    # --- Word Learning (HSK 3.0) ---
    wl = []
    for p in sorted(glob.glob(os.path.join(ROOT, "word_learning", "json_data", "quyen_*.json"))):
        book = json.load(open(p, encoding="utf-8"))
        for u in book.get("units", []):
            for w in u.get("target_words", []):
                for e in (w.get("examples") or [])[:2]:
                    zh, vi = (e.get("hz") or "").strip(), (e.get("vn") or "").strip()
                    if zh and vi and usable(zh):
                        wl.append([w["id"], "|".join(chunks(zh, e.get("py") or "")), (e.get("py") or "").strip(), vi])
    with open(os.path.join(OUT, "lt_data_wl.js"), "w", encoding="utf-8") as f:
        f.write("/* Sinh tự động bởi tools/build_luyen_tap.py — không sửa tay */\nwindow.LT_DATA_WL = ")
        json.dump({"sents": wl}, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    print(f"lt_data.js: {len(words)} từ, {len(sents)} câu  |  lt_data_wl.js: {len(wl)} câu")


if __name__ == "__main__":
    main()
