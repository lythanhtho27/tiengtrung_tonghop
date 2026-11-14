# -*- coding: utf-8 -*-
"""
Gom bài đọc phân cấp (tools/doc_them_src/hsk1.json … hsk6.json) thành doc_them/doc_data.js:
  window.DOC_LIBRARY = { texts: [ {
      id, level, title, title_vi, topic, chars,            # chars: số chữ Hán
      paragraphs: [zh…], pinyin: ["xiǎo shí hou …" …],     # pinyin: mỗi đoạn một chuỗi, đúng THỨ TỰ các chữ Hán trong đoạn, cách nhau 1 dấu cách
      translations: [vi…], questions: [{q, q_vi, options, answer, explain_vi}],
      beyond: [[từ, pinyin, HÁN VIỆT, nghĩa], …]           # từ ngoài phạm vi HSK ≤ cấp bài (để học trước)
  } … ] }
Chạy (cần pypinyin, jieba):  python tools/build_doc_them.py
"""
import json
import os
import re
import sys

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

    texts = []
    for lv in range(1, 7):
        p = os.path.join(SRC, f"hsk{lv}.json")
        if not os.path.exists(p):
            continue
        for t in json.load(open(p, encoding="utf-8")):
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
            texts.append({
                "id": t["id"], "level": t["level"], "title": t["title"], "title_vi": t.get("title_vi", ""),
                "topic": t.get("topic", ""), "chars": sum(len(HAN.findall(x)) for x in paras),
                "paragraphs": paras, "pinyin": [han_pinyin(x) for x in paras], "translations": trans,
                "questions": t.get("questions", []), "beyond": beyond,
            })
    out = os.path.join(ROOT, "doc_them", "doc_data.js")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write("/* Sinh tự động bởi tools/build_doc_them.py từ tools/doc_them_src/ — không sửa tay */\nwindow.DOC_LIBRARY = ")
        json.dump({"texts": texts}, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    for t in texts:
        print(f"{t['id']} HSK{t['level']} {t['chars']:5d} chữ  {len(t['paragraphs']):2d} đoạn  {len(t['questions'])} câu hỏi  ngoài cấp {len(t['beyond'])}  {t['title']}")
    print(f"-> {out}: {len(texts)} bài")


if __name__ == "__main__":
    main()
