# -*- coding: utf-8 -*-
"""
Gom tài liệu đọc (mọi tools/doc_them_src/*.json; exam*.json là đề luyện thi) thành doc_them/doc_data.js:
  window.DOC_LIBRARY.exams = [đề luyện thi, xem BRIEF_MORE.md]; mỗi bài có thêm "kind" (article/series/dialogue/chengyu)
  và các trường riêng của loại đó (series, series_title, chapter, speakers, scene_vi, idiom).
  window.DOC_LIBRARY = { texts: [ {
      id, level, title, title_vi, topic, chars,            # chars: số chữ Hán
      paragraphs: [zh…], pinyin: ["xiǎo shí hou …" …],     # pinyin: mỗi đoạn một chuỗi, đúng THỨ TỰ các chữ Hán trong đoạn, cách nhau 1 dấu cách
      translations: [vi…], questions: [{q, q_vi, options, answer, explain_vi}],
      beyond: [[từ, pinyin, HÁN VIỆT, nghĩa], …]           # từ ngoài phạm vi HSK ≤ cấp bài (để học trước)
  } … ] }
Chạy (cần pypinyin, jieba):  python tools/build_doc_them.py
"""
import glob
import json
import os
import re
import sys
from collections import Counter

import jieba
from pypinyin import pinyin, Style, load_phrases_dict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "doc_them_src")
sys.path.insert(0, os.path.join(HERE, "hanviet"))
from hanviet import word_hv, clean_hz  # noqa: E402

jieba.setLogLevel(60)
HAN = re.compile(r"[㐀-鿿]")
# Cụm do tách nhầm (都会去 = đều sẽ đi, 二十分钟 …), không đưa vào "từ ngoài cấp"
SPLIT_ARTIFACTS = {"都会", "十分", "正当", "王", "李", "张", "陈", "刘", "小明", "一会", "会儿", "从来不", "看得出", "低下"}

# thanh nhẹ hay gặp (giống tools/scratch/gc_rebuild/build_gc_books.py)
NEUTRAL = ("时候 shí hou|部分 bù fen|眼睛 yǎn jing|东西 dōng xi|意思 yì si|知道 zhī dao|告诉 gào su|先生 xiān sheng|"
           "朋友 péng you|衣服 yī fu|事情 shì qing|认识 rèn shi|喜欢 xǐ huan|漂亮 piào liang|舒服 shū fu|清楚 qīng chu|"
           "明白 míng bai|关系 guān xi|地方 dì fang|姑娘 gū niang|头发 tóu fa|耳朵 ěr duo|麻烦 má fan|热闹 rè nao|"
           "消息 xiāo xi|打扮 dǎ ban|商量 shāng liang|收拾 shōu shi|窗户 chuāng hu|暖和 nuǎn huo|凉快 liáng kuai|"
           "聪明 cōng ming|便宜 pián yi|妹妹 mèi mei|姐姐 jiě jie|哥哥 gē ge|弟弟 dì di|爸爸 bà ba|妈妈 mā ma|"
           "爷爷 yé ye|奶奶 nǎi nai|太太 tài tai|丈夫 zhàng fu|月亮 yuè liang|名字 míng zi|孩子 hái zi|桌子 zhuō zi|"
           "儿子 ér zi|妻子 qī zi|椅子 yǐ zi|杯子 bēi zi|房子 fáng zi|日子 rì zi|样子 yàng zi|一下 yí xià|一个 yí gè|"
           "我们 wǒ men|你们 nǐ men|他们 tā men|她们 tā men|咱们 zán men|什么 shén me|怎么 zěn me|这么 zhè me|那么 nà me|"
           "多么 duō me|为什么 wèi shén me|觉得 jué de|记得 jì de|晚上 wǎn shang|早上 zǎo shang|地上 dì shang|学生 xué sheng")
load_phrases_dict({w: [[p] for p in ps.split()] for w, ps in (x.split(" ", 1) for x in NEUTRAL.split("|"))})


def load_js_assign(path):
    s = open(path, encoding="utf-8").read()
    s = s[s.index("=") + 1:].strip().rstrip(";")
    s = re.sub(r",\s*([\]}])", r"\1", s)
    return json.loads(s)


def han_pinyin(text):
    """pinyin từng chữ Hán theo cụm từ jieba; sửa trợ từ 的/地/得 đứng riêng thành 'de'."""
    out = []
    prev = ""
    for tok in jieba.cut(text):
        hz = "".join(HAN.findall(tok))
        if not hz:
            prev = tok if tok.strip() else prev
            continue
        ps = [p[0] for p in pinyin(hz, style=Style.TONE)]
        if hz in ("的", "地", "得") and HAN.search(prev or ""):
            ps = ["de"]
        out.extend(ps)
        prev = tok
    if len(out) != len(HAN.findall(text)):
        out = [p[0] for p in pinyin(text, style=Style.TONE, errors="ignore")]
    return " ".join(out)


SENT_MAX = 14        # mỗi từ giữ tối đa 14 câu (mỗi bài tối đa 2 câu)


def split_zh(text):
    """Tách câu tiếng Trung; dấu đóng ngoặc/ngoặc kép đi theo câu trước."""
    out, cur, i = [], "", 0
    while i < len(text):
        cur += text[i]
        if text[i] in "。！？!?" or (text[i] == "…" and i + 1 < len(text) and text[i + 1] != "…"):
            while i + 1 < len(text) and text[i + 1] in "。！？!?…”’」』）)":
                i += 1
                cur += text[i]
            out.append(cur.strip())
            cur = ""
        i += 1
    if cur.strip():
        out.append(cur.strip())
    return [x for x in out if HAN.search(x)]


def split_vi(text):
    return [x.strip() for x in re.findall(r".+?(?:[.!?…]+[”’\"')\]]*(?=\s|$)|$)", text.strip(), re.S) if re.search(r"\w", x)]


def fix_quotes(s, pairs):
    """Bỏ dấu ngoặc kép lẻ do câu bị cắt giữa lời thoại."""
    for a, b in pairs:
        while s.count(a) > s.count(b) and s.startswith(a):
            s = s[1:]
        while s.count(b) > s.count(a) and s.endswith(b):
            s = s[:-1]
        if s.count(a) != s.count(b):
            s = s.replace(a, "").replace(b, "")
    return s.strip()


def build_sents(texts, segment_words):
    """doc_them/doc_sents.js: câu ví dụ lấy từ bài đọc cho từng từ (trang Hôm nay dùng khi ôn)."""
    pairs_zh = (("“", "”"), ("「", "」"), ("‘", "’"))
    tlist, sents, by_word, aligned = [], [], {}, 0
    for t in texts:
        ti = len(tlist)
        title = t["title"]
        if t["kind"] == "series":
            title = f"{t['series_title']} · {t['chapter']}. {t['title']}"
        tlist.append([t["id"], title, 1 if t["kind"] == "series" else 0])
        # chữ trong tên riêng bị tách lẻ (鹿鸣): cặp chữ lẻ lặp lại ≥ 3 lần trong bài
        pair = Counter()
        for para in t["paragraphs"]:
            pos, prev = 0, ""
            for m in re.finditer(r"[㐀-鿿]+", para):
                prev = ""
                for w in segment_words(m.group()):
                    if prev and len(w) == 1:
                        pair[prev + w] += 1
                    prev = w if len(w) == 1 else ""
        names = {k for k, v in pair.items() if v >= 3}
        for para, tr in zip(t["paragraphs"], t["translations"]):
            if t["kind"] == "dialogue":
                para = re.sub(r"^\s*[㐀-鿿A-Za-z]{1,6}\s*[：:]", "", para)
                tr = re.sub(r"^\s*[^:：]{1,24}[:：]\s*", "", tr)
            zs, vs = split_zh(para), split_vi(tr)
            ok = len(zs) == len(vs)
            for i, z in enumerate(zs):
                n = len(HAN.findall(z))
                if n < 6 or n > 42:
                    continue
                vi = fix_quotes(vs[i], (("“", "”"),)) if ok else (tr if len(zs) == 1 else "")
                zc = fix_quotes(z, pairs_zh)
                si = len(sents)
                sents.append([zc, vi, ti])
                aligned += 1 if vi else 0
                seen = set()
                for m in re.finditer(r"[㐀-鿿]+", zc):
                    ws = segment_words(m.group())
                    for k, w in enumerate(ws):
                        if w in seen:
                            continue
                        if len(w) == 1 and ((k and ws[k - 1] + w in names) or (k + 1 < len(ws) and w + ws[k + 1] in names)):
                            continue
                        seen.add(w)
                        by_word.setdefault(w, []).append(si)
    # chọn câu cho mỗi từ: có bản dịch, dài vừa phải, rải nhiều bài
    used, words = set(), {}
    for w, lst in by_word.items():
        if len(w) == 1 and len(lst) > 400:
            continue                      # hư từ quá phổ biến (的, 了, 我…): không cần câu ví dụ riêng
        lst = sorted(lst, key=lambda i: (0 if sents[i][1] else 1, abs(len(HAN.findall(sents[i][0])) - 16)))
        per, pick = Counter(), []
        for i in lst:
            if per[sents[i][2]] >= 2:
                continue
            per[sents[i][2]] += 1
            pick.append(i)
            if len(pick) >= SENT_MAX:
                break
        words[w] = pick
        used.update(pick)
    remap = {old: k for k, old in enumerate(sorted(used))}
    data = {"t": tlist, "s": [sents[i] for i in sorted(used)], "w": {w: [remap[i] for i in v] for w, v in sorted(words.items())}}
    out = os.path.join(ROOT, "doc_them", "doc_sents.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("/* Sinh tự động bởi tools/build_doc_them.py — câu ví dụ theo từ, lấy từ bài đọc: t [id, tên, là truyện dài], s [câu, dịch, chỉ số t], w {từ: [chỉ số s]} */\nwindow.DOC_SENTS = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print(f"-> {out}: {len(data['s'])} câu ({sum(1 for x in data['s'] if x[1])} có dịch), {len(words)} từ, {os.path.getsize(out) // 1024}KB")


def main():
    rows = load_js_assign(os.path.join(ROOT, "hsk_lotrinh", "hsk_vocab_data.js"))
    level_of = {}
    for r in rows:
        k = clean_hz(r[1])
        level_of[k] = min(level_of.get(k, 9), r[0])
    # Bổ sung cấp từ của HSK 3.0 (danh sách HSK 2.0 thiếu nhiều từ cơ bản như 有, 说, 没有): quyển cấp N tính như HSK N
    import glob
    for jp in glob.glob(os.path.join(ROOT, "word_learning", "json_data", "quyen_*.json")):
        book = json.load(open(jp, encoding="utf-8"))
        lv = min(int(book.get("level") or 7), 7)
        for u in book.get("units", []):
            for w in u.get("target_words", []):
                k = clean_hz(w.get("word", ""))
                if k:
                    level_of[k] = min(level_of.get(k, 9), lv)
    dic = load_js_assign(os.path.join(ROOT, "shared", "dict_vi.js"))["w"]
    for w in level_of:
        jieba.add_word(w)
    # chữ đã gặp trong các từ ≤ cấp N (để bỏ qua chữ lẻ quen thuộc)
    known_chars_by_level = {L: set(c for w, lv in level_of.items() if lv <= L for c in w) for L in range(1, 7)}

    texts, exams, seen_ids = [], [], set()
    # Mọi file *.json trong doc_them_src: file tên exam*.json là đề luyện thi, còn lại là mảng bài (kind: article/series/dialogue/chengyu)
    files = sorted(glob.glob(os.path.join(SRC, "*.json")))
    for p in files:
        data = json.load(open(p, encoding="utf-8"))
        if os.path.basename(p).startswith("exam"):
            for e in data:
                assert e["id"] not in seen_ids, ("trùng id", e["id"])
                seen_ids.add(e["id"])
                exams.append(e)
            continue
        for t in data:
            assert t["id"] not in seen_ids, ("trùng id", t["id"], p)
            seen_ids.add(t["id"])
            paras = [x.strip() for x in t["paragraphs"]]
            trans = [x.strip() for x in t.get("translations", [])]
            assert len(paras) == len(trans), (t["id"], len(paras), len(trans))
            L = t["level"]
            known_chars = known_chars_by_level[L]
            beyond, seen = [], set()

            def pieces(tok):
                """Tách cụm jieba thành các từ có trong danh sách cấp/từ điển (khớp dài nhất)."""
                out, i = [], 0
                while i < len(tok):
                    for ln in range(min(8, len(tok) - i), 0, -1):
                        w = tok[i:i + ln]
                        if ln == 1 or w in level_of or w in dic:
                            out.append(w); i += ln; break
                return out

            for para in paras:
                for tok in jieba.cut(para):
                    tok = tok.strip()
                    if not HAN.search(tok) or level_of.get(tok, 9) <= L:
                        continue
                    for w in (pieces(tok) if tok not in dic or len(tok) > 4 else [tok]):
                        if w in seen or w in SPLIT_ARTIFACTS or level_of.get(w, 9) <= L:
                            continue
                        seen.add(w)
                        if len(w) == 1 and (w in known_chars or w not in dic):
                            continue   # chữ lẻ đã gặp trong từ đã biết, hoặc tên riêng / chữ không có trong từ điển
                        if len(w) > 1 and w not in dic:
                            continue   # cụm/tên riêng không có trong từ điển
                        info = dic[w]
                        beyond.append([w, info[0], info[1] or word_hv(w), info[2]])
            item = {
                "id": t["id"], "kind": t.get("kind", "article"), "level": t["level"], "title": t["title"], "title_vi": t.get("title_vi", ""),
                "topic": t.get("topic", ""), "chars": sum(len(HAN.findall(x)) for x in paras),
                "paragraphs": paras, "pinyin": [han_pinyin(x) for x in paras], "translations": trans,
                "questions": t.get("questions", []), "beyond": beyond,
            }
            for k in ("series", "series_title", "series_title_vi", "chapter", "speakers", "scene_vi", "idiom"):
                if k in t:
                    item[k] = t[k]
            texts.append(item)
    KIND_ORDER = {"article": 0, "series": 1, "dialogue": 2, "chengyu": 3}
    texts.sort(key=lambda t: (KIND_ORDER.get(t["kind"], 9), int(re.sub(r"\D", "", t.get("series", "")) or 0),  # s10 sau s9
                t["level"] if t["kind"] != "series" else 0, t.get("chapter", 0), t["id"]))
    exams.sort(key=lambda e: (e.get("level", 0), e["id"]))
    out = os.path.join(ROOT, "doc_them", "doc_data.js")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write("/* Sinh tự động bởi tools/build_doc_them.py từ tools/doc_them_src/ — không sửa tay */\nwindow.DOC_LIBRARY = ")
        json.dump({"texts": texts, "exams": exams}, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    # Mục lục nhẹ cho trang khác (hom_nay) gợi ý bài vừa sức mà không phải nạp doc_data.js (~3MB):
    # w = các từ khác nhau trong bài, tách khớp dài nhất theo từ điển giống HocLookup.segment (để tính "% từ đã biết")
    maxlen = max(len(k) for k in dic)
    def segment_words(text):
        out, i = [], 0
        while i < len(text):
            if not HAN.match(text[i]):
                i += 1
                continue
            hit = text[i]
            for ln in range(min(maxlen, len(text) - i), 1, -1):
                cand = text[i:i + ln]
                if cand in dic and not re.search(r"[^㐀-鿿]", cand):
                    hit = cand
                    break
            out.append(hit)
            i += len(hit)
        return out
    index = []
    for t in texts:
        ws = []
        for para in t["paragraphs"]:
            if t["kind"] == "dialogue":
                para = re.sub(r"^\s*[㐀-鿿A-Za-z]{1,6}\s*[：:]", "", para)
            for w in segment_words(para):
                if w not in ws:
                    ws.append(w)
        e = {"id": t["id"], "kind": t["kind"], "level": t["level"], "title": t["title"], "title_vi": t["title_vi"], "chars": t["chars"], "w": " ".join(ws)}
        for k in ("series", "series_title", "series_title_vi", "chapter"):
            if k in t:
                e[k] = t[k]
        index.append(e)
    idx_out = os.path.join(ROOT, "doc_them", "doc_index.js")
    with open(idx_out, "w", encoding="utf-8") as f:
        f.write("/* Sinh tự động bởi tools/build_doc_them.py — mục lục nhẹ của doc_data.js (gợi ý bài ở trang Hôm nay) */\nwindow.DOC_INDEX = ")
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    build_sents(texts, segment_words)
    for t in texts:
        print(f"{t['id']:8s} {t['kind']:8s} HSK{t['level']} {t['chars']:5d} chữ  {len(t['paragraphs']):2d} đoạn  {len(t['questions'])} câu hỏi  ngoài cấp {len(t['beyond'])}  {t['title']}")
    from collections import Counter
    print(f"-> {out}: {len(texts)} bài {dict(Counter(t['kind'] for t in texts))}, {len(exams)} đề luyện thi")


if __name__ == "__main__":
    main()
