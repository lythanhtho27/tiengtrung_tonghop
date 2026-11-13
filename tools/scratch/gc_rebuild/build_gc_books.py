# -*- coding: utf-8 -*-
"""
Dựng tools/scratch/gc1_book.json và gc2_book.json từ các file bài đã chép từ PDF
(tools/scratch/gc_rebuild/gc1_L01.json …). Chạy từ đâu cũng được (cần pypinyin):
    python tools/scratch/gc_rebuild/build_gc_books.py
rồi gộp vào boya_data:  python tools/scratch/merge_all_books.py   (chạy từ thư mục gốc)
KHÔNG chạy super_enrich.py sau bước này (script đó thêm từ bịa vào Cao cấp).
"""
import json, os, re, glob, html
from pypinyin import pinyin, Style, load_phrases_dict
from pypinyin.seg.mmseg import seg

HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = os.path.dirname(HERE)

BOOKS = {
    "gc1": dict(name="Cao Cấp 1", chinese_name="高级飞翔篇 I", sub_name="Boya Advanced I", pdf="pdf/高级飞翔篇1.pdf",
                audio_folder="Cao cap 1", color="#0891b2", color_dark="#0e7490", badge_color="#cffafe", badge_text="#155e75",
                icon="📕", title="Quyển 5 - 高级飞翔篇 I (Cao Cấp 1)",
                description="Giáo trình Boya Cao Cấp (Phi Tường) I – 10 bài, văn bản nguyên tác về gia đình, xã hội, tư tưởng và văn hóa Trung Quốc."),
    "gc2": dict(name="Cao Cấp 2", chinese_name="高级飞翔篇 II", sub_name="Boya Advanced II", pdf="pdf/高级飞翔篇2.pdf",
                audio_folder="Cao cap 2", color="#e11d48", color_dark="#be123c", badge_color="#ffe4e6", badge_text="#9f1239",
                icon="📕", title="Quyển 6 - 高级飞翔篇 II (Cao Cấp 2)",
                description="Giáo trình Boya Cao Cấp (Phi Tường) II – 10 bài, tản văn và nghị luận nguyên tác của các tác giả Trung Quốc hiện đại."),
}

HAN = re.compile(r"[㐀-鿿]")

# Từ hai âm tiết có thanh nhẹ mà pypinyin hay đọc thành thanh đầy đủ
NEUTRAL = ("时候 shí hou|部分 bù fen|眼睛 yǎn jing|东西 dōng xi|意思 yì si|知道 zhī dao|告诉 gào su|先生 xiān sheng|"
           "朋友 péng you|衣服 yī fu|事情 shì qing|认识 rèn shi|喜欢 xǐ huan|漂亮 piào liang|舒服 shū fu|清楚 qīng chu|"
           "明白 míng bai|关系 guān xi|地方 dì fang|姑娘 gū niang|头发 tóu fa|耳朵 ěr duo|脑袋 nǎo dai|麻烦 má fan|"
           "热闹 rè nao|消息 xiāo xi|打扮 dǎ ban|商量 shāng liang|收拾 shōu shi|窗户 chuāng hu|结实 jiē shi|暖和 nuǎn huo|"
           "凉快 liáng kuai|糊涂 hú tu|聪明 cōng ming|力气 lì qi|规矩 guī ju|便宜 pián yi|妹妹 mèi mei|姐姐 jiě jie|"
           "哥哥 gē ge|弟弟 dì di|爸爸 bà ba|妈妈 mā ma|爷爷 yé ye|奶奶 nǎi nai|太太 tài tai|丈夫 zhàng fu|月亮 yuè liang|"
           "名字 míng zi|对付 duì fu|嘴巴 zuǐ ba|尾巴 wěi ba|眉毛 méi mao|胳膊 gē bo|骨头 gǔ tou|石头 shí tou|木头 mù tou|"
           "舌头 shé tou|指头 zhǐ tou|念头 niàn tou|苗头 miáo tou|老头 lǎo tou|萝卜 luó bo|葡萄 pú tao|玻璃 bō li|"
           "琢磨 zhuó mo|折腾 zhē teng|嘀咕 dí gu|咳嗽 ké sou|吩咐 fēn fu|招呼 zhāo hu|应付 yìng fu|佩服 pèi fu|"
           "伙计 huǒ ji|学问 xué wen|笑话 xiào hua|干部 gàn bù|含糊 hán hu|马虎 mǎ hu|别扭 biè niu|似的 shì de")
load_phrases_dict({w: [[p] for p in ps.split()] for w, ps in (x.split(" ", 1) for x in NEUTRAL.split("|"))})
SECTION = re.compile(r"^第[一二三四五六七八九十]+部分$")


def han_pinyins(text):
    """pinyin cho từng chữ Hán trong text, theo cụm từ; sửa trợ từ 地/得 đứng riêng sau từ khác thành 'de'."""
    out, prev = [], ""
    for tok in seg.cut(text):
        hz = "".join(HAN.findall(tok))
        if not hz:
            prev = tok if tok.strip() else prev
            continue
        ps = [p[0] for p in pinyin(hz, style=Style.TONE)]
        if hz in ("地", "得") and HAN.search(prev or "") and prev[-1] not in "在于到满遍落土大天的":
            ps = ["de"]
        out.extend(ps)
        prev = tok
    hans = HAN.findall(text)
    if len(out) != len(hans):
        out = [p[0] for p in pinyin(text, style=Style.TONE, errors="ignore")]
    return out


def ruby_html(text):
    """Mỗi chữ Hán bọc <ruby> kèm pinyin (pypinyin xét ngữ cảnh cụm từ)."""
    pys = han_pinyins(text)
    out, k = [], 0
    for ch in text:
        if HAN.match(ch):
            out.append(f"<ruby>{ch}<rt>{pys[k]}</rt></ruby>")
            k += 1
        else:
            out.append(html.escape(ch, quote=False))
    return "".join(out)


def sentence_pinyin(text):
    words, pys = [], iter(han_pinyins(text))
    for w in seg.cut(text):
        if HAN.search(w):
            words.append("".join(next(pys) for _ in HAN.findall(w)))
        else:
            words.append(w.strip())
    s = " ".join(x for x in words if x)
    s = re.sub(r"\s+([，。！？；：、”’）》…])", r"\1", s)
    s = s.replace("，", ", ").replace("。", ". ").replace("！", "! ").replace("？", "? ").replace("；", "; ").replace("：", ": ").replace("、", ", ")
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"([.!?]\s+[“\"]?)(\w)", lambda m: m.group(1) + m.group(2).upper(), s)
    return s[:1].upper() + s[1:]


def reading_html(paragraphs):
    blocks = []
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if SECTION.match(p):
            blocks.append(f'<span class="block" style="text-align: center; font-weight: bold;">{ruby_html(p)}</span>')
        elif re.match(r"^[（(](选自|根据|作者|节选)", p):
            blocks.append(f'<span class="block" style="text-align: right;">{ruby_html(p)}</span>')
        else:
            blocks.append(f'<span class="block"><span class="indent"></span>{ruby_html(p)}</span>')
    return "\n".join(blocks)


def translations_for(paragraphs, translations):
    """Bỏ bản dịch của dòng tiêu đề phần / dòng nguồn (trang không ghép dịch cho các khối đó)."""
    out = []
    for p, t in zip(paragraphs, translations):
        p = p.strip()
        if not p or SECTION.match(p) or re.match(r"^[（(](选自|根据|作者|节选)", p):
            continue
        out.append(t)
    return out


def sentences(paragraphs):
    out = []
    for p in paragraphs:
        for s in re.findall(r"[^。！？]+[。！？]?[”’」]?", p):
            s = s.strip()
            if HAN.search(s):
                out.append(s)
    return out


def word_examples(hz, sents):
    core = re.sub(r"[（(].*?[）)]", "", hz).strip()
    if not core:
        return []
    found = [s for s in sents if core in s]
    found.sort(key=lambda s: abs(len(s) - 28))
    ex = []
    for s in found[:2]:
        if len(s) > 40:  # câu dài: chỉ giữ vế (giữa các dấu phẩy) có chứa từ, nới thêm vế bên cạnh nếu quá ngắn
            parts = re.split(r"(?<=[，；：])", s)
            i = next(k for k, p in enumerate(parts) if core in p)
            a = z = i
            while len("".join(parts[a:z + 1])) < 12 and (a > 0 or z < len(parts) - 1):
                if z < len(parts) - 1: z += 1
                else: a -= 1
            s = "".join(parts[a:z + 1]).strip().rstrip("，；：")
            if core not in s:
                continue
        ex.append(s.replace(core, "～"))
    return ex


def build(book_id):
    meta = BOOKS[book_id]
    # Mỗi bài là gcX_LNN.json, hoặc ghép từ nhiều phần gcX_LNN_part_*.json (words/grammar/readings tách riêng)
    merged = {}
    for f in sorted(glob.glob(os.path.join(HERE, f"{book_id}_L*.json"))):
        m = re.match(rf"{book_id}_L(\d+)(_part_\w+)?\.json$", os.path.basename(f))
        if not m:
            continue
        part = json.load(open(f, encoding="utf-8"))
        cur = merged.setdefault(int(m.group(1)), {"words": [], "readings": [], "grammar": []})
        for k, v in part.items():
            if k in ("words", "readings", "grammar"):
                cur[k] = cur[k] + v
            else:
                cur.setdefault(k, v)
    lessons = []
    for _, d in sorted(merged.items()):
        n = int(d["lesson_num"])
        title = d["title"]
        audio = f"audio/{meta['audio_folder']}/第{n:02d}课.mp3"
        all_par = [p for r in d["readings"] for p in r["paragraphs"]]
        main_par = [p for r in d["readings"] if r["kind"] == "main" for p in r["paragraphs"]]
        sents_main, sents_all = sentences(main_par), sentences(all_par)

        words = []
        for i, w in enumerate(d["words"], 1):
            pos = (w.get("pos") or "").strip("（）() ")
            vi = (w.get("vi") or "").strip()
            hv = (w.get("hv") or "").strip()
            mean = f"{hv} ({vi})" if hv and not w.get("proper") else vi
            ex = word_examples(w["hz"], sents_main) or word_examples(w["hz"], sents_all)
            words.append({
                "id": f"{book_id}_{n}_{i}", "book_id": book_id, "book_name": meta["name"],
                "lesson_num": n, "lesson_title": title,
                "hz": w["hz"].strip(), "py": w["py"].strip(), "type": f"【{pos}】" if pos else "",
                "mean": mean, "zh_def": (w.get("zh") or "").strip(), "en": (w.get("en") or "").strip(),
                "examples": ex, "is_proper": bool(w.get("proper")),
            })

        readings = []
        for k, r in enumerate(d["readings"], 1):
            if not r["paragraphs"]:
                continue
            is_main = r["kind"] == "main"
            readings.append({
                "sub_id": f"{book_id}_b{n}_reading{k}",
                "title": ("Bài khóa: " if is_main else "Đọc thêm: ") + r["title"],
                "audio": audio if is_main else None,
                "chinese_html": reading_html(r["paragraphs"]),
                "translations": translations_for(r["paragraphs"], r["translations"]),
            })

        grammar = []
        for g in d.get("grammar", []):
            point = g["point"].strip()
            head = re.split(r"\s*[（(]", point)[0]
            grammar.append({
                "point": point,
                "pinyin": sentence_pinyin(head) if HAN.search(head) else "",
                "structure": (g.get("structure") or "").strip(),
                "explanation": (g.get("explanation") or "").strip(),
                "examples": [{"zh": e["zh"].strip(), "pinyin": sentence_pinyin(e["zh"].strip()), "vi": e["vi"].strip()}
                             for e in g.get("examples", []) if e.get("zh")],
            })

        lessons.append({
            "lesson_id": f"{book_id}_bai{n}", "lesson_num": n, "main_id": f"bai{n}", "title": title,
            "audio_baikhoa": audio, "audio_tuvung": None, "audio_docthem": None,
            "total_vocab": len(words), "total_grammar": len(grammar),
            "words": words, "readings": readings, "grammar": grammar,
        })
    lessons.sort(key=lambda l: l["lesson_num"])
    book = {"id": book_id, **{k: meta[k] for k in ("name", "chinese_name", "sub_name", "pdf", "audio_folder", "color",
            "color_dark", "badge_color", "badge_text", "icon", "description")},
            "total_lessons": len(lessons), "total_vocab": sum(len(l["words"]) for l in lessons), "title": meta["title"],
            "lessons": lessons}
    out = os.path.join(SCRATCH, f"{book_id}_book.json")
    json.dump(book, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"{book_id}: {len(lessons)} bài, {book['total_vocab']} từ, "
          f"{sum(len(l['readings']) for l in lessons)} bài đọc, {sum(len(l['grammar']) for l in lessons)} ngữ pháp -> {out}")


if __name__ == "__main__":
    for b in ("gc1", "gc2"):
        build(b)
