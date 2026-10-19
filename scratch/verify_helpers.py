import json
import re
import os
import pypinyin

# Character to Han-Viet table extracted from existing words + common rules
HANVIET_MAP = {
    '一': 'NHẤT', '二': 'NHỊ', '三': 'TAM', '四': 'TỨ', '五': 'NGŨ', '六': 'LỤC', '七': 'THẤT', '八': 'BÁT', '九': 'CỬU', '十': 'THẬP',
    '天': 'THIÊN', '地': 'ĐỊA', '人': 'NHÂN', '生': 'SINH', '命': 'MỆNH', '险': 'HIỂM', '冒': 'MẠO', '每': 'MỖI', '日': 'NHẬT',
    '年': 'NIÊN', '月': 'NGUYỆT', '狗': 'CẨU', '风': 'PHONG', '中': 'TRUNG', '现': 'HIỆN', '代': 'ĐẠI', '化': 'HÓA', '蜗': 'OA',
    '牛': 'NGƯU', '上': 'THƯỢNG', '自': 'TỰ', '有': 'HỮU', '安': 'AN', '排': 'BÀI', '球': 'CẦU', '迷': 'MÊ', '种': 'CHỦNG',
    '面': 'DIỆN', '容': 'DUNG', '辛': 'TÂN', '亥': 'HỢI', '革': 'CÁCH', '我': 'NGÃ', '无': 'VÔ', '为': 'VI', '逍': 'TIÊU',
    '遥': 'DAO', '设': 'THIẾT', '防': 'PHÒNG', '音': 'ÂM', '乐': 'NHẠC', '伴': 'BẠN', '父': 'PHỤ', '亲': 'THÂN', '语': 'NGỮ',
    '请': 'THỈNH', '按': 'ÁN', '诺': 'NẶC', '千': 'THIÊN', '金': 'KIM', '沙': 'SA', '漠': 'MẠC', '里': 'LÝ', '奇': 'KỲ',
    '怪': 'QUÁI', '象': 'TƯỢNG', '内': 'NỘI', '部': 'BỘ', '招': 'CHIÊU', '标': 'TIÊU', '才': 'TÀI', '梦': 'MỘNG', '随': 'TÙY',
    '感': 'CẢM', '则': 'TẮC', '困': 'KHỐN', '境': 'CẢNH', '周': 'CHU', '旋': 'TOÀN', '反': 'PHẢN', '对': 'ĐỐI', '克': 'KHẮC',
    '隆': 'LONG', '憧': 'THUNG', '憬': 'CẢNH', '丸': 'HOÀN', '笑': 'TIẾU', '了': 'LIỄU', '之': 'CHI', '狠': 'HẲN', '毒': 'ĐỘC',
    '处': 'XỨ', '原': 'NGUYÊN', '始': 'THỦY', '茹': 'NHƯ', '毛': 'MAO', '饮': 'ẨM', '血': 'HUYẾT', '刀': 'ĐAO', '耕': 'CANH',
    '火': 'HỎA', '危': 'NGUY', '机': 'CƠ', '四': 'TỨ', '伏': 'PHỤC', '凶': 'HUNG', '残': 'TÀN', '坠': 'TRỤY', '躲': 'ĐỎA',
    '避': 'TỊ', '嗜': 'THỊ', '好': 'HẢO', '焦': 'TIÊU', '虑': 'LỰ', '明': 'MINH', '码': 'MÃ', '享': 'HƯỞNG', '用': 'DỤNG',
    '超': 'SIÊU', '绳': 'THẰNG', '索': 'TÁC', '熏': 'HUÂN', '燎': 'LIỆU', '恶': 'ÁC', '劣': 'LIỆT', '操': 'THAO', '作': 'TÁC',
    '赌': 'ĐỔ', '博': 'BÁC', '弹': 'ĐẠN', '范': 'PHẠM', '畴': 'TRÙ', '宜': 'NGHI', '潜': 'TIỀM', '在': 'TẠI', '损': 'TỔN',
    '利': 'LỢI', '己': 'KỶ', '夺': 'ĐOẠT', '涯': 'NHAI', '回': 'HỒI', '归': 'QUY', '由': 'DO', '主': 'CHỦ', '跃': 'DƯỢC',
    '欲': 'DỤC', '试': 'THÍ', '多': 'ĐA', '情': 'TÌNH', '蠢': 'CHUẨN', '动': 'ĐỘNG', '半': 'BÁN', '径': 'KÍNH', '围': 'VI',
    '指': 'CHỈ', '招': 'CHIÊU', '摇': 'DAO', '靡': 'MĨ', '费': 'PHÍ', '津': 'TÂN', '贴': 'THIẾP', '拐': 'QUẢI', '甚': 'THẬM',
    '喘': 'SUYỄN', '吁': 'HÚ', '当': 'ĐƯƠNG', '儿': 'NHI', '撞': 'CHÀNG', '紧': 'KHẨN', '迫': 'BÁCH', '颠': 'ĐIÊN', '跑': 'BÀO',
    '增': 'TĂNG', '速': 'TỐC', '合': 'HỢP', '客': 'KHÁCH', '芽': 'NHA', '柳': 'LIỄU', '树': 'THỤ', '叶': 'DIỆP', '脉': 'MẠCH',
    '如': 'NHƯ', '同': 'ĐỒNG', '碟': 'ĐIỆP', '杂': 'TẠP', '揉': 'NHU', '尚': 'THƯỢNG', '颇': 'PHẢ', '老': 'LÃO', '少': 'THIẾU',
    '咸': 'HÀM', '似': 'TỰ', '起': 'KHỞI', '锚': 'MIÊU', '水': 'THỦY', '兵': 'BINH', '症': 'CHỨNG', '结': 'KẾT', '活': 'HOẠT',
    '扣': 'KHẤU', '远': 'VIỄN', '航': 'HÀNG', '浑': 'HỖN', '身': 'THÂN', '揪': 'TIÊU', '气': 'KHÍ', '定': 'ĐỊNH', '神': 'THẦN',
    '闲': 'NHÀN', '喝': 'HÁT', '彩': 'THẢI', '裳': 'THƯỜNG', '检': 'KIỂM', '点': 'ĐIỂM', '束': 'THÚC', '缚': 'PHƯỢC', '微': 'VI',
    '足': 'TÚC', '道': 'ĐẠO', '茧': 'KIỂN', '鞘': 'XOANG', '裹': 'QUẢ', '胁': 'HIẾP', '突': 'ĐỘT', '破': 'PHÁ', '心': 'TÂM',
    '智': 'TRÍ', '拘': 'CÂU', '禁': 'CẤM', '惶': 'HOÀNG', '惑': 'HOẶC'
}

def get_hanviet(hz):
    chars = [HANVIET_MAP.get(c, '') for c in hz]
    if all(chars):
        return " ".join(chars)
    # Fallback to pypinyin style
    res = []
    for c in hz:
        if c in HANVIET_MAP:
            res.append(HANVIET_MAP[c])
        else:
            py = pypinyin.pinyin(c, style=pypinyin.Style.NORMAL)[0][0].upper()
            res.append(py)
    return " ".join(res)

def text_to_ruby(text):
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    html_blocks = []
    for para in paragraphs:
        out = []
        py_list = pypinyin.pinyin(para, style=pypinyin.Style.TONE)
        for i, char in enumerate(para):
            if '\u4e00' <= char <= '\u9fff':
                py = py_list[i][0]
                out.append(f"<ruby>{char}<rt>{py}</rt></ruby>")
            else:
                out.append(char)
        html_blocks.append(f'<span class="block">{"".join(out)}</span>')
    return "\n                ".join(html_blocks)

print("Helper functions compiled successfully.")
