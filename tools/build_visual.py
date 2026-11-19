# -*- coding: utf-8 -*-
"""
Sinh shared/hanzi_parts.js — dữ liệu "tách bộ" chữ Hán cho khung Nét viết (shared/visual.js).

Nguồn: Make Me a Hanzi — dictionary.txt (https://github.com/skishore/makemeahanzi, giấy phép LGPL v3,
       dẫn xuất từ Unihan + CJKlib). Script tự tải về tools/hanzi_parts/dictionary.txt nếu chưa có.
       Âm Hán Việt của bộ phận: tools/hanviet/ ; tên bộ thủ dạng biến thể (扌, 氵…): bảng RADICALS dưới đây;
       dự phòng: tools/hanzi_parts/unihan_vi.tsv (trường kVietnamese của Unicode Unihan).
Chỉ giữ các chữ có trong shared/dict_vi.js (HOC_DICT) nên file nhỏ.

Kết quả: window.HOC_PARTS = {
    c: {chữ: [ "bộ phận nối liền", loại ("p" hình thanh | "i" hội ý | "g" tượng hình | ""), bộ nghĩa, bộ âm, gợi ý (tiếng Anh) ]},
    p: {bộ phận: [ HÁN VIỆT, nghĩa ngắn ]}
}
Chạy: python tools/build_visual.py   (cần pypinyin cho tools/hanviet)
"""
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, "hanviet"))
from hanviet import char_hv  # noqa: E402

SRC_URL = "https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt"
SRC = os.path.join(HERE, "hanzi_parts", "dictionary.txt")
OUT = os.path.join(ROOT, "shared", "hanzi_parts.js")

# Bộ thủ / bộ phận thường gặp: [HÁN VIỆT, nghĩa]. Dạng biến thể không có âm Hán Việt riêng thì ghi tên bộ.
RADICALS = {
    "扌": ["THỦ", "tay"], "氵": ["THỦY", "nước"], "亻": ["NHÂN", "người"], "艹": ["THẢO", "cỏ cây"],
    "讠": ["NGÔN", "lời nói"], "辶": ["SƯỚC", "đi, bước"], "纟": ["MỊCH", "sợi tơ"], "糸": ["MỊCH", "sợi tơ"],
    "⺼": ["NHỤC", "thịt, cơ thể"], "忄": ["TÂM", "lòng, tình cảm"], "钅": ["KIM", "kim loại"],
    "宀": ["MIÊN", "mái nhà"], "阝": ["PHỤ / ẤP", "gò đất (bên trái), thành ấp (bên phải)"],
    "⺮": ["TRÚC", "tre"], "刂": ["ĐAO", "dao"], "⺈": ["ĐAO", "dao"], "攵": ["PHỘC", "đánh, hành động"],
    "亠": ["ĐẦU", "nắp trên"], "丷": ["BÁT", "số tám (biến thể)"], "丿": ["PHIỆT", "nét phẩy"],
    "冖": ["MỊCH", "trùm, che"], "疒": ["NẠCH", "bệnh tật"], "丶": ["CHỦ", "nét chấm"],
    "犭": ["KHUYỂN", "chó, thú vật"], "丨": ["CỔN", "nét sổ"], "彳": ["XÍCH", "bước chân, đi"],
    "隹": ["CHUY", "chim đuôi ngắn"], "冂": ["QUYNH", "vùng biên"], "冫": ["BĂNG", "băng, lạnh"],
    "⺀": ["BĂNG", "băng, lạnh"], "饣": ["THỰC", "ăn uống"], "厶": ["KHƯ", "riêng tư"],
    "彐": ["KỆ", "đầu con nhím"], "囗": ["VI", "vây quanh"], "灬": ["HỎA", "lửa"], "衤": ["Y", "áo quần"],
    "乂": ["NGHỆ", "cắt cỏ"], "酉": ["DẬU", "bình rượu"], "匕": ["CHỦY", "cái thìa"],
    "礻": ["THỊ", "thần, cúng tế"], "乚": ["ẤT", "nét móc (biến thể 乙)"], "皿": ["MÃNH", "bát đĩa"],
    "艮": ["CẤN", "bền, cứng"], "罒": ["VÕNG", "lưới"], "殳": ["THÙ", "binh khí, đánh"],
    "夂": ["TRI", "đi chậm"], "勹": ["BAO", "bao bọc"], "廾": ["CỦNG", "chắp hai tay"],
    "彡": ["SAM", "lông, vằn"], "幺": ["YÊU", "nhỏ bé"], "丬": ["TƯỜNG", "tấm ván"], "卩": ["TIẾT", "đốt tre, người quỳ"],
    "㔾": ["TIẾT", "người quỳ"], "匚": ["PHƯƠNG", "cái hộp"], "凵": ["KHẢM", "há miệng, hố"], "疋": ["SƠ", "chân"],
    "虍": ["HÔ", "vằn hổ"], "亅": ["QUYẾT", "nét móc"], "爫": ["TRẢO", "móng vuốt, bàn tay"],
    "⺌": ["TIỂU", "nhỏ"], "⺍": ["TIỂU", "nhỏ"], "⺊": ["BỐC", "bói"], "覀": ["Á", "che đậy"],
    "耂": ["LÃO", "già"], "缶": ["PHẪU", "đồ sành"], "臼": ["CỮU", "cối giã"], "氺": ["THỦY", "nước"],
    "尢": ["UÔNG", "què"], "匸": ["HỆ", "che giấu"], "龶": ["SINH", "(biến thể)"], "龹": ["QUYỂN", "(biến thể)"],
    "⺧": ["NGƯU", "trâu bò"], "牜": ["NGƯU", "trâu bò"], "⺶": ["DƯƠNG", "dê"], "⺷": ["DƯƠNG", "dê"],
    "⻊": ["TÚC", "chân"], "𧾷": ["TÚC", "chân"], "⺻": ["DUẬT", "bút"], "⺹": ["LÃO", "già"],
    "⺆": ["QUYNH", "vùng biên"], "⺁": ["HÁN", "sườn núi"], "⺄": ["ẤT", "(biến thể 乙)"], "⺕": ["KỆ", "đầu con nhím"],
    "⺪": ["SƠ", "chân"], "⺳": ["VÕNG", "lưới"], "⺲": ["VÕNG", "lưới"], "⻗": ["VŨ", "mưa"],
    "⺗": ["TÂM", "lòng"], "⺝": ["NGUYỆT", "trăng"], "⺩": ["NGỌC", "ngọc"], "⺨": ["KHUYỂN", "chó"],
    "⺠": ["DÂN", "dân"], "⺤": ["TRẢO", "móng vuốt"], "⺫": ["VÕNG", "lưới"], "⻏": ["ẤP", "thành ấp"], "⻖": ["PHỤ", "gò đất"],
    # bộ thủ cũng là chữ thường gặp: nghĩa ngắn gọn (âm Hán Việt lấy từ tools/hanviet)
    "口": [None, "miệng"], "女": [None, "phụ nữ"], "木": [None, "cây, gỗ"], "火": [None, "lửa"], "土": [None, "đất"],
    "日": [None, "mặt trời, ngày"], "月": [None, "trăng (hoặc thịt)"], "心": [None, "tim, lòng"], "手": [None, "tay"],
    "水": [None, "nước"], "石": [None, "đá"], "目": [None, "mắt"], "足": [None, "chân"], "言": [None, "lời nói"],
    "金": [None, "vàng, kim loại"], "贝": [None, "vỏ sò, tiền của"], "页": [None, "đầu"], "马": [None, "ngựa"],
    "鸟": [None, "chim"], "鱼": [None, "cá"], "虫": [None, "sâu bọ"], "车": [None, "xe"], "米": [None, "gạo"],
    "王": [None, "vua, ngọc"], "力": [None, "sức lực"], "山": [None, "núi"], "门": [None, "cửa"], "雨": [None, "mưa"],
    "衣": [None, "áo"], "示": [None, "thần, bày ra"], "食": [None, "ăn"], "走": [None, "đi, chạy"], "见": [None, "thấy"],
    "田": [None, "ruộng"], "禾": [None, "lúa"], "竹": [None, "tre"], "巾": [None, "khăn"], "广": [None, "mái nhà rộng"],
    "尸": [None, "thân người"], "寸": [None, "tấc, bàn tay"], "弓": [None, "cây cung"], "大": [None, "to lớn"],
    "人": [None, "người"], "子": [None, "con"], "欠": [None, "há miệng, thiếu"], "皮": [None, "da"], "羊": [None, "dê"],
    "犬": [None, "chó"], "牛": [None, "trâu bò"], "刀": [None, "dao"], "又": [None, "bàn tay"], "歹": [None, "xương tàn, xấu"],
    "耳": [None, "tai"], "舌": [None, "lưỡi"], "角": [None, "sừng"], "方": [None, "vuông, phương"], "白": [None, "trắng"],
    "立": [None, "đứng"], "穴": [None, "hang"], "气": [None, "khí"], "风": [None, "gió"], "豆": [None, "hạt đậu"],
    "骨": [None, "xương"], "革": [None, "da thuộc"], "舟": [None, "thuyền"], "羽": [None, "lông vũ"], "斤": [None, "cái rìu"],
    "戈": [None, "ngọn giáo"], "矢": [None, "mũi tên"], "齿": [None, "răng"], "黑": [None, "đen"], "网": [None, "lưới"],
    "夕": [None, "buổi chiều tối"], "工": [None, "thợ, công việc"], "己": [None, "bản thân"], "文": [None, "văn, hoa văn"],
    "止": [None, "dừng, bàn chân"], "儿": [None, "người, con trẻ"], "八": [None, "số tám, chia ra"], "十": [None, "mười"],
    "厂": [None, "sườn núi, xưởng"], "几": [None, "cái bàn nhỏ"], "小": [None, "nhỏ"], "一": [None, "một"],
    "二": [None, "hai"], "干": [None, "khô, cái khiên"], "士": [None, "kẻ sĩ"], "夫": [None, "đàn ông"],
    "老": [None, "già"], "生": [None, "sinh ra, sống"], "用": [None, "dùng"], "长": [None, "dài"], "身": [None, "thân mình"],
    "自": [None, "tự mình (vốn là cái mũi)"], "鼻": [None, "mũi"], "面": [None, "mặt"], "首": [None, "đầu"],
    "香": [None, "thơm"], "高": [None, "cao"], "非": [None, "không phải"], "青": [None, "xanh"], "辛": [None, "cay, khổ"],
    "瓜": [None, "dưa"], "鬼": [None, "ma quỷ"], "麦": [None, "lúa mì"], "肉": [None, "thịt"], "血": [None, "máu"],
    "爪": [None, "móng vuốt"], "父": [None, "cha"], "支": [None, "cành, chi"], "甘": [None, "ngọt"], "鹿": [None, "hươu"],
    "龙": [None, "rồng"], "龟": [None, "rùa"], "鼠": [None, "chuột"], "毛": [None, "lông"], "氏": [None, "họ"],
    "片": [None, "mảnh"], "牙": [None, "răng"], "玉": [None, "ngọc"], "瓦": [None, "ngói"], "里": [None, "làng, dặm"],
    "西": [None, "phía tây"], "臣": [None, "bề tôi"], "至": [None, "đến"], "色": [None, "màu sắc"], "音": [None, "âm thanh"],
    "韦": [None, "da thuộc"], "飞": [None, "bay"], "鬥": [None, "đánh nhau"], "隶": [None, "kịp, nô lệ"], "豕": [None, "con heo"],
    "豸": [None, "thú có vuốt"], "聿": [None, "cây bút"], "巛": [None, "sông"], "川": [None, "sông"], "厂": [None, "sườn núi"],
}

HAN = re.compile(r"[㐀-鿿⺀-⿕𠀀-𪛟]")
IDS = re.compile(r"[⿰-⿻？]")


def short(s):
    """Rút gọn nghĩa tiếng Việt: lấy cụm đầu."""
    s = re.sub(r"\([^)]*\)|（[^）]*）|\[[^\]]*\]", "", s or "")
    s = re.split(r"[;；,，/·]", s)[0].strip()
    return s[:28]


def main():
    if not os.path.exists(SRC):
        os.makedirs(os.path.dirname(SRC), exist_ok=True)
        print("Tải", SRC_URL)
        urllib.request.urlretrieve(SRC_URL, SRC)
    s = open(os.path.join(ROOT, "shared", "dict_vi.js"), encoding="utf-8").read()
    D = json.loads(s[s.index("{"):s.rindex("}") + 1])
    chars = set(D["c"])
    for w in D["w"]:
        chars |= {c for c in w if "一" <= c <= "鿿"}
    mm = {}
    for line in open(SRC, encoding="utf-8"):
        o = json.loads(line)
        mm[o["character"]] = o
    uni = {}
    for line in open(os.path.join(HERE, "hanzi_parts", "unihan_vi.tsv"), encoding="utf-8"):
        if "\t" in line and not line.startswith("#"):
            c, r = line.rstrip("\n").split("\t", 1)
            uni[c] = r.upper()
    # chỉ nhận âm Unihan nếu là một âm Hán Việt đã gặp trong tools/hanviet (loại âm Nôm như "lỏn")
    known = set()
    for f in os.listdir(os.path.join(HERE, "hanviet")):
        if f.endswith(".tsv"):
            for line in open(os.path.join(HERE, "hanviet", f), encoding="utf-8"):
                if "\t" in line:
                    known.add(line.rstrip("\n").split("\t", 1)[1].strip().upper())
    uni = {c: r for c, r in uni.items() if r in known}
    out_c, parts = {}, {}
    for ch in sorted(chars):
        o = mm.get(ch)
        if not o:
            continue
        comps = [x for x in o.get("decomposition", "") if not IDS.match(x)]
        if not comps or (len(comps) == 1 and comps[0] == ch):
            comps = []
        et = o.get("etymology") or {}
        t = {"pictophonetic": "p", "ideographic": "i", "pictographic": "g"}.get(et.get("type"), "")
        sem, pho = et.get("semantic", ""), et.get("phonetic", "")
        hint = et.get("hint", "") if t in ("i", "g") else ""
        if not comps and not t:
            continue
        out_c[ch] = ["".join(comps), t, sem, pho, hint]
        for x in comps + [sem, pho]:
            if x:
                parts[x] = None
    for x in list(parts):
        hv, mean = None, ""
        if x in RADICALS:
            hv, mean = RADICALS[x]
        if not hv:
            hv = char_hv(x) or (D["c"].get(x) or ["", ""])[1] or uni.get(x, "")
        if not mean:
            w = D["w"].get(x)
            mean = short(w[2]) if w else ""
        if not hv and not mean:
            del parts[x]
            continue
        parts[x] = [hv or "", mean]
    data = {"c": out_c, "p": parts}
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("/* SINH TỰ ĐỘNG bởi tools/build_visual.py — đừng sửa tay.\n"
                "   Tách bộ chữ Hán: Make Me a Hanzi (dictionary.txt, LGPL v3, https://github.com/skishore/makemeahanzi). */\n")
        f.write("window.HOC_PARTS=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("chữ:", len(out_c), "bộ phận:", len(parts), "→", OUT, os.path.getsize(OUT) // 1024, "KB")


if __name__ == "__main__":
    main()
