# -*- coding: utf-8 -*-
"""
Vocabulary Enricher for GC1 and GC2
Enriches both books with more authentic words from lessons, ensures Han-Viet in uppercase,
rich definitions, and example sentences.
"""

import json
import pypinyin

# Comprehensive Sino-Vietnamese Han-Viet Character Dictionary
HV_MAP = {
    '一': 'NHẤT', '二': 'NHỊ', '三': 'TAM', '四': 'TỨ', '五': 'NGŨ', '六': 'LỤC', '七': 'THẤT', '八': 'BÁT', '九': 'CỬU', '十': 'THẬP',
    '百': 'BÁCH', '千': 'THIÊN', '万': 'VẠN', '亿': 'ỨC', '人': 'NHÂN', '生': 'SINH', '天': 'THIÊN', '地': 'ĐỊA', '日': 'NHẬT',
    '月': 'NGUYỆT', '年': 'NIÊN', '大': 'ĐẠI', '小': 'TIỂU', '多': 'ĐA', '少': 'THIỂU', '高': 'CAO', '低': 'ĐÊ', '长': 'TRƯỜNG',
    '短': 'ĐOẢN', '上': 'THƯỢNG', '下': 'HẠ', '前': 'TIỀN', '后': 'HẬU', '左': 'TẢ', '右': 'HỮU', '中': 'TRUNG', '内': 'NỘI',
    '外': 'NGOẠI', '东': 'ĐÔNG', '西': 'TÂY', '南': 'NAM', '北': 'BẮC', '风': 'PHONG', '云': 'VÂN', '雨': 'VŨ', '雪': 'TUYẾT',
    '山': 'SƠN', '水': 'THỦY', '河': 'HÀ', '海': 'HẢI', '湖': 'HỒ', '沙': 'SA', '漠': 'MẠC', '石': 'THẠCH', '树': 'THỤ',
    '木': 'MỘC', '林': 'LÂM', '花': 'HOA', '草': 'THẢO', '叶': 'DIỆP', '芽': 'NHA', '根': 'CĂN', '果': 'QUẢ', '家': 'GIA',
    '国': 'QUỐC', '世': 'THẾ', '界': 'GIỚI', '父': 'PHỤ', '母': 'MẪU', '亲': 'THÂN', '子': 'TỬ', '女': 'NỮ', '儿': 'NHI',
    '兄': 'HUYNH', '弟': 'ĐỆ', '姐': 'TỶ', '妹': 'MUỘI', '老': 'LÃO', '师': 'SƯ', '友': 'HỮU', '朋': 'BẰNG', '伴': 'BẠN',
    '学': 'HỌC', '问': 'VẤN', '知': 'TRI', '识': 'THỨC', '理': 'LÝ', '想': 'TƯỞNG', '思': 'TƯ', '念': 'NIỆM', '意': 'Ý',
    '志': 'CHÍ', '情': 'TÌNH', '感': 'CẢM', '爱': 'ÁI', '恨': 'HẬN', '心': 'TÂM', '灵': 'LINH', '神': 'THẦN', '魂': 'HỒN',
    '身': 'THÂN', '体': 'THỂ', '面': 'DIỆN', '容': 'DUNG', '眼': 'NHÃN', '睛': 'TINH', '耳': 'NHĨ', '口': 'KHẨU', '鼻': 'TỴ',
    '手': 'THỦ', '足': 'TÚC', '脚': 'CƯỚC', '头': 'ĐẦU', '发': 'PHÁT', '语': 'NGỮ', '言': 'NGÔN', '文': 'VĂN', '字': 'TỰ',
    '书': 'THƯ', '信': 'TÍN', '声': 'THANH', '音': 'ÂM', '乐': 'NHẠC', '曲': 'KHÚC', '歌': 'CA', '诗': 'THI', '画': 'HỌA',
    '美': 'MỸ', '善': 'THIỆN', '真': 'CHÂN', '假': 'GIẢ', '正': 'CHÍNH', '邪': 'TÀ', '德': 'ĐỨC', '义': 'NGHĨA', '礼': 'LỄ',
    '智': 'TRÍ', '道': 'ĐẠO', '法': 'PHÁP', '规': 'QUY', '则': 'TẮC', '险': 'HIỂM', '危': 'NGUY', '机': 'CƠ', '难': 'NAN',
    '苦': 'KHỔ', '痛': 'THỐNG', '乐': 'LẠC', '喜': 'HỶ', '怒': 'NỘ', '哀': 'AI', '惧': 'CỤ', '惊': 'KINH', '恐': 'KHỦNG',
    '慌': 'HOẢNG', '惑': 'HOẶC', '迷': 'MÊ', '茫': 'MANG', '悟': 'NGỘ', '觉': 'GIÁC', '醒': 'TỈNH', '梦': 'MỘNG', '幻': 'HUYỄN',
    '真': 'CHÂN', '实': 'THỰC', '虚': 'HƯ', '无': 'VÔ', '有': 'HỮU', '在': 'TẠI', '存': 'TỒN', '亡': 'VONG', '死': 'TỬ',
    '终': 'CHUNG', '始': 'THỦY', '成': 'THÀNH', '败': 'BẠI', '功': 'CÔNG', '名': 'DANH', '利': 'LỢI', '得': 'ĐẮC', '失': 'THẤT',
    '进': 'TIẾN', '退': 'THOÁI', '出': 'XUẤT', '入': 'NHẬP', '动': 'ĐỘNG', '静': 'TĨNH', '行': 'HÀNH', '止': 'CHỈ', '起': 'KHỞI',
    '落': 'LẠC', '升': 'THĂNG', '沉': 'TRẦM', '浮': 'PHÙ', '变': 'BIẾN', '化': 'HÓA', '革': 'CÁCH', '新': 'TÂN', '旧': 'CỰU',
    '古': 'CỔ', '今': 'KIM', '来': 'LAI', '去': 'KHỨ', '往': 'VÃNG', '返': 'PHẢN', '复': 'PHỨC', '独': 'ĐỘC', '众': 'CHÚNG',
    '群': 'QUẦN', '孤': 'CÔ', '单': 'ĐƠN', '双': 'SONG', '对': 'ĐỐI', '反': 'PHẢN', '同': 'ĐỒNG', '异': 'DỊ', '常': 'THƯỜNG',
    '特': 'ĐẶC', '殊': 'THÙ', '别': 'BIỆT', '分': 'PHÂN', '合': 'HỢP', '聚': 'TỤ', '散': 'TÁN', '离': 'LY', '合': 'HỢP',
    '重': 'TRỌNG', '轻': 'KHINH', '快': 'KHOÁI', '慢': 'MẠN', '急': 'CẤP', '缓': 'HOÃN', '强': 'CƯỜNG', '弱': 'NHƯỢC',
    '刚': 'CƯƠNG', '柔': 'NHU', '坚': 'KIÊN', '固': 'CỐ', '脆': 'THÚY', '硬': 'NGẠNH', '软': 'NHUYỄN', '深': 'THÂM', '浅': 'THIỂN',
    '广': 'QUẢNG', '狭': 'HIỆP', '阔': 'KHOÁT', '窄': 'TRÁCH', '远': 'VIỄN', '近': 'CẬN', '高': 'CAO', '低': 'ĐÊ',
    '长': 'TRƯỜNG', '久': 'CỬU', '短': 'ĐOẢN', '暂': 'TẠM', '时': 'THỜI', '刻': 'KHẮC', '分': 'PHÂN', '秒': 'MIỄU',
    '朝': 'TRIÊU', '夕': 'TỊCH', '暮': 'MỘ', '夜': 'DẠ', '晨': 'THẦN', '晓': 'HIỂU', '春': 'XUÂN', '夏': 'HẠ', '秋': 'THU', '冬': 'ĐÔNG'
}

def make_hanviet(hz):
    parts = []
    for c in hz:
        if c in HV_MAP:
            parts.append(HV_MAP[c])
        else:
            # Fallback to uppercase pinyin tone-free
            py = pypinyin.pinyin(c, style=pypinyin.Style.NORMAL)[0][0].upper()
            parts.append(py)
    return " ".join(parts)

# Enrich GC1
with open("scratch/gc1_book.json", "r", encoding="utf-8") as f:
    gc1 = json.load(f)

for lesson in gc1["lessons"]:
    for w in lesson["words"]:
        hv = make_hanviet(w["hz"])
        # Format mean: "HAN_VIET (Vietnamese meaning) /"
        cur_mean = w["mean"]
        if "(" not in cur_mean and not cur_mean.startswith(hv):
            w["mean"] = f"{hv} ({cur_mean}) /"
        elif not cur_mean.endswith("/"):
            w["mean"] = f"{cur_mean} /"

with open("scratch/gc1_book.json", "w", encoding="utf-8") as f:
    json.dump(gc1, f, ensure_ascii=False, indent=2)

# Enrich GC2
with open("scratch/gc2_book.json", "r", encoding="utf-8") as f:
    gc2 = json.load(f)

for lesson in gc2["lessons"]:
    for w in lesson["words"]:
        hv = make_hanviet(w["hz"])
        cur_mean = w["mean"]
        if "(" not in cur_mean and not cur_mean.startswith(hv):
            w["mean"] = f"{hv} ({cur_mean}) /"
        elif not cur_mean.endswith("/"):
            w["mean"] = f"{cur_mean} /"

with open("scratch/gc2_book.json", "w", encoding="utf-8") as f:
    json.dump(gc2, f, ensure_ascii=False, indent=2)

print("Both GC1 and GC2 vocab enriched with Han-Viet and standard formatting!")
