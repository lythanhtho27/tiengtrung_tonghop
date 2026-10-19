# -*- coding: utf-8 -*-
import json
import pypinyin

HV_MAP = {
    '一': 'NHẤT', '二': 'NHỊ', '三': 'TAM', '四': 'TỨ', '五': 'NGŨ', '六': 'LỤC', '七': 'THẤT', '八': 'BÁT', '九': 'CỬU', '十': 'THẬP',
    '百': 'BÁCH', '千': 'THIÊN', '万': 'VẠN', '亿': 'ỨC', '人': 'NHÂN', '生': 'SINH', '天': 'THIÊN', '地': 'ĐỊA', '日': 'NHẬT',
    '月': 'NGUYỆT', '年': 'NIÊN', '大': 'ĐẠI', '小': 'TIỂU', '多': 'ĐA', '少': 'THIỂU', '高': 'CAO', '低': 'ĐÊ', '长': 'TRƯỜNG',
    '短': 'ĐOẢN', '上': 'THƯỢNG', '下': 'HẠ', '前': 'TIỀN', '后': 'HẬU', '左': 'TẢ', '右': 'HỮU', '中': 'TRUNG', '内': 'NỘI',
    '外': 'NGOẠI', '东': 'ĐÔNG', '西': 'TÂY', '南': 'NAM', '北': 'BẮC', '风': 'PHONG', '云': 'VÂN', '雨': 'VŨ', '雪': 'TUYẾT',
    '山': 'SƠN', '水': 'THỦY', '河': 'HÀ', '海': 'HẢI', '湖': 'HỒ', '沙': 'SA', '漠': 'MẠC', '石': 'THẠCH', '树': 'THỤ',
    '木': 'MỘC', '林': 'LÂM', '花': 'HOA', '草': 'THẢO', '叶': 'DIỆP', '芽': 'NHA', '根': 'CĂN', '果': 'QUẢ', '家': 'GIA',
    '国': 'QUỐC', '世': 'THẾ', '界': 'GIỚI', '父': 'PHỤ', '母': 'MẪU', '亲': 'THÂN', '子': 'TỬ', '女': 'NỮ', '儿': 'NHI',
    '学': 'HỌC', '问': 'VẤN', '知': 'TRI', '识': 'THỨC', '理': 'LÝ', '想': 'TƯỞNG', '思': 'TƯ', '念': 'NIỆM', '意': 'Ý',
    '志': 'CHÍ', '情': 'TÌNH', '感': 'CẢM', '爱': 'ÁI', '恨': 'HẬN', '心': 'TÂM', '灵': 'LINH', '神': 'THẦN', '身': 'THÂN',
    '面': 'DIỆN', '容': 'DUNG', '语': 'NGỮ', '言': 'NGÔN', '文': 'VĂN', '字': 'TỰ', '书': 'THƯ', '信': 'TÍN', '声': 'THANH',
    '音': 'ÂM', '乐': 'NHẠC', '曲': 'KHÚC', '美': 'MỸ', '善': 'THIỆN', '真': 'CHÂN', '德': 'ĐỨC', '义': 'NGHĨA', '道': 'ĐẠO',
    '法': 'PHÁP', '规': 'QUY', '则': 'TẮC', '险': 'HIỂM', '危': 'NGUY', '机': 'CƠ', '难': 'NAN', '苦': 'KHỔ', '痛': 'THỐNG',
    '乐': 'LẠC', '喜': 'HỶ', '惊': 'KINH', '恐': 'KHỦNG', '梦': 'MỘNG', '实': 'THỰC', '虚': 'HƯ', '无': 'VÔ', '有': 'HỮU',
    '成': 'THÀNH', '败': 'BẠI', '功': 'CÔNG', '名': 'DANH', '利': 'LỢI', '得': 'ĐẮC', '失': 'THẤT', '变': 'BIẾN', '化': 'HÓA',
    '新': 'TÂN', '旧': 'CỰU', '古': 'CỔ', '今': 'KIM', '深': 'THÂM', '浅': 'THIỂN', '广': 'QUẢNG', '阔': 'KHOÁT', '远': 'VIỄN'
}

def make_hv(hz):
    parts = []
    for c in hz:
        if c in HV_MAP:
            parts.append(HV_MAP[c])
        else:
            py = pypinyin.pinyin(c, style=pypinyin.Style.NORMAL)[0][0].upper()
            parts.append(py)
    return " ".join(parts)

# Additional words per lesson for GC1
gc1_extra = {
    2: [
        {"hz": "程序", "py": "chéngxù", "type": "【名】", "mean": "TRÌNH TỰ (trình tự, chương trình phần mềm)", "examples": ["电脑～ / 按程序办事"]},
        {"hz": "都市", "py": "dūshì", "type": "【名】", "mean": "ĐÔ THỊ (thành phố lớn, đô thị)", "examples": ["繁华的～ / 现代都市"]},
        {"hz": "取而代之", "py": "qǔ'ér-dàizhī", "type": "【成语】", "mean": "THỦ NHI ĐẠI CHI (thay thế vào đó)", "examples": ["由机器～。"]},
        {"hz": "沟通", "py": "gōutōng", "type": "【动/名】", "mean": "CÂU THÔNG (giao tiếp, câu thông, thấu hiểu)", "examples": ["缺乏～ / 深入沟通"]},
        {"hz": "陪伴", "py": "péibàn", "type": "【动】", "mean": "BỒI BẠN (đồng hành, bầu bạn, kề bên)", "examples": ["默默～ / 陪伴在身边"]},
        {"hz": "眷恋", "py": "juànliàn", "type": "【动/名】", "mean": "QUYẾN LUYẾN (vương vấn, tha thiết nhớ thương)", "examples": ["深深的～ / 眷恋故土"]}
    ],
    3: [
        {"hz": "信用", "py": "xìnyòng", "type": "【名】", "mean": "TÍN DỤNG (uy tín, chữ tín, lòng tin)", "examples": ["讲究～ / 建立信用"]},
        {"hz": "积攒", "py": "jīzǎn", "type": "【动】", "mean": "TÍCH TÍCH (tích cóp, chắt chiu dành dụm)", "examples": ["～零钱 / 积攒经验"]},
        {"hz": "恶劣", "py": "èliè", "type": "【形】", "mean": "ÁC LIỆT (khắc nghiệt, tồi tệ, xấu xa)", "examples": ["气候～ / 恶劣的环境"]},
        {"hz": "稚嫩", "py": "zhìnèn", "type": "【形】", "mean": "TRĨ NẬN (non nớt, ngây thơ trẻ con)", "examples": ["～的面孔 / 稚嫩的双肩"]},
        {"hz": "千钧", "py": "qiānjūn", "type": "【形】", "mean": "THIÊN QUÂN (ngàn cân, cực kỳ nặng nề)", "examples": ["重若～ / 千钧一发"]},
        {"hz": "风尘", "py": "fēngchén", "type": "【名】", "mean": "PHONG TRẦN (phong trần dãi dầu; bụi bặm đường xa)", "examples": ["一路～ / 饱经风尘"]}
    ],
    4: [
        {"hz": "浩瀚", "py": "hàohàn", "type": "【形】", "mean": "HẠO HÃN (bao la, mênh mông bạt ngàn)", "examples": ["～的大海 / 浩瀚宇宙"]},
        {"hz": "腹地", "py": "fùdì", "type": "【名】", "mean": "PHÚC ĐỊA (vùng trung tâm, lòng sâu nội địa)", "examples": ["沙漠～ / 深入腹地"]},
        {"hz": "烘烤", "py": "hōngkǎo", "type": "【动】", "mean": "HỒNG KHẢO (hun nóng, nung nấu, thiêu đốt)", "examples": ["阳光～ / 烘烤大地"]},
        {"hz": "共鸣", "py": "gòngmíng", "type": "【动/名】", "mean": "CỘNG MINH (cộng hưởng âm thanh; đồng cảm tâm hồn)", "examples": ["引起～ / 强烈的共鸣"]},
        {"hz": "奇观", "py": "qíguān", "type": "【名】", "mean": "KỲ QUAN (kỳ quan, cảnh tượng kỳ vĩ khác thường)", "examples": ["自然～ / 旷世奇观"]},
        {"hz": "钥匙", "py": "yàoshi", "type": "【名】", "mean": "THƯỢC CHỈ (chìa khóa)", "examples": ["打开大门的～ / 知识的钥匙"]}
    ],
    5: [
        {"hz": "应对", "py": "yìngduì", "type": "【动】", "mean": "ỨNG ĐỐI (ứng phó, giải quyết tình huống)", "examples": ["从容～ / 应对挑战"]},
        {"hz": "激烈", "py": "jīliè", "type": "【形】", "mean": "KÍCH LIỆT (khốc liệt, gay gắt, sôi nổi)", "examples": ["竞争～ / 激烈的辩论"]},
        {"hz": "角逐", "py": "juézhú", "type": "【动/名】", "mean": "GIÁC TRỤC (tranh tài, so tài đoạt giải)", "examples": ["激烈～ / 角逐冠军"]},
        {"hz": "详实", "py": "xiángshí", "type": "【形】", "mean": "TƯỜNG THỰC (rõ ràng chi tiết, xác thực)", "examples": ["数据～ / 详实的报告"]},
        {"hz": "痛点", "py": "tòngdiǎn", "type": "【名】", "mean": "THỐNG ĐIỂM (điểm đau, vấn đề nan giải cốt lõi)", "examples": ["行业～ / 解决痛点"]},
        {"hz": "扭亏为盈", "py": "niǔkuī-wéiyíng", "type": "【成语】", "mean": "NỖI KHUY VI DOANH (biến lỗ thành lãi, đảo ngược tình thế)", "examples": ["实现了～。"]}
    ],
    6: [
        {"hz": "沉浸", "py": "chénjìn", "type": "【动】", "mean": "TRẦM TẨM (đắm chìm, ngập tràn trong niềm vui)", "examples": ["～在幸福中 / 沉浸在书海"]},
        {"hz": "琐事", "py": "suǒshì", "type": "【名】", "mean": "TỎA SỰ (chuyện vụn vặt, việc nhỏ thường ngày)", "examples": ["生活～ / 为琐事操心"]},
        {"hz": "碰壁", "py": "pèngbì", "type": "【动】", "mean": "BÁNH BÍCH (va vào tường đá, gặp trắc trở thất bại)", "examples": ["处处～ / 碰壁而归"]},
        {"hz": "君王", "py": "jūnwáng", "type": "【名】", "mean": "QUÂN VƯƠNG (vua chúa, đấng quân vương ngự trị)", "examples": ["如同一位～ / 一代君王"]},
        {"hz": "领悟", "py": "lǐngwù", "type": "【动】", "mean": "LĨNH NGỘ (thấu hiểu, đốn ngộ đạo lý)", "examples": ["深刻～ / 领悟真谛"]},
        {"hz": "薪火", "py": "xīnhuǒ", "type": "【名】", "mean": "TÂN HỎA (củi lửa, ngọn lửa tri thức trao truyền)", "examples": ["～相传 / 不灭的薪火"]}
    ],
    7: [
        {"hz": "修行", "py": "xiūxíng", "type": "【动/名】", "mean": "TU HÀNH (tu dưỡng bản thân, rèn luyện nhân cách)", "examples": ["一生的～ / 道德修行"]},
        {"hz": "传承", "py": "chuánchéng", "type": "【动/名】", "mean": "TRUYỀN THỪA (kế thừa và phát huy di sản)", "examples": ["～文化 / 世代传承"]},
        {"hz": "执着", "py": "zhízhuó", "type": "【形/动】", "mean": "CHẤP TRƯỚC (kiên định, say mê không rời)", "examples": ["～追求 / 对理想的执着"]},
        {"hz": "巍然", "py": "wēirán", "type": "【形】", "mean": "NGUY NHIÊN (sừng sững, hiên ngang vĩ đại)", "examples": ["～屹立 / 巍然挺立"]},
        {"hz": "坦坦荡荡", "py": "tǎntǎn-dàngdàng", "type": "【成语】", "mean": "THẢN THẢN ĐÃNG ĐÃNG (quang minh chính đại, lòng dạ thanh thản)", "examples": ["为人～"]},
        {"hz": "熠熠生辉", "py": "yìyì-shēnghuī", "type": "【成语】", "mean": "DẬP DẬP SINH HUY (lấp lánh rực rỡ, tỏa sáng muôn đời)", "examples": ["在历史上～。"]}
    ],
    8: [
        {"hz": "凄凉", "py": "qīliáng", "type": "【形】", "mean": "THÊ LƯƠNG (buồn bã đìu hiu, lạnh lẽo)", "examples": ["晚景～ / 凄凉的秋风"]},
        {"hz": "面具", "py": "miànjù", "type": "【名】", "mean": "DIỆN CỤ (mặt nạ giả tạo)", "examples": ["戴着～ / 摘下面具"]},
        {"hz": "沉淀", "py": "chéndiàn", "type": "【动/名】", "mean": "TRẦM ĐIỆN (lắng đọng tâm hồn, tích lũy)", "examples": ["岁月的～ / 让心灵沉淀"]},
        {"hz": "贪婪", "py": "tānlán", "type": "【形】", "mean": "THAM LAM (tham lam vô đáy)", "examples": ["～的目光 / 贪婪成性"]},
        {"hz": "领略", "py": "lǐnglüè", "type": "【动】", "mean": "LĨNH LƯỢC (thưởng thức, ngắm nhìn phong cảnh)", "examples": ["～自然风光 / 领略风土人情"]},
        {"hz": "祥和", "py": "xiánghé", "type": "【形】", "mean": "TƯỜNG HÒA (yên vui thái bình, tường hòa ấm cúng)", "examples": ["气氛～ / 宁静祥和"]}
    ],
    9: [
        {"hz": "一帆风顺", "py": "yīfān-fēngshùn", "type": "【成语】", "mean": "NHẤT PHÀM PHONG THUẬN (thuận buồm xuôi gió, suôn sẻ)", "examples": ["祝你一路～。"]},
        {"hz": "如影随形", "py": "rúyǐng-suíxíng", "type": "【成语】", "mean": "NHƯ ẢNH TÙY HÌNH (như hình với bóng, bám theo sát)", "examples": ["危险～"]},
        {"hz": "妥协", "py": "tuǒxié", "type": "【动】", "mean": "THỎA HIỆP (thỏa hiệp, nhượng bộ)", "examples": ["绝不～ / 达成妥协"]},
        {"hz": "积蓄", "py": "jīxù", "type": "【动/名】", "mean": "TÍCH SÚC (tích lũy nội lực; tiền tiết kiệm)", "examples": ["～力量 / 一生的积蓄"]},
        {"hz": "淬炼", "py": "cuìliàn", "type": "【动】", "mean": "THỐI LUYỆN (tôi luyện sắt đá, trui rèn)", "examples": ["经过苦难的～ / 淬炼意志"]},
        {"hz": "璀璨", "py": "cuǐcàn", "type": "【形】", "mean": "TẢY XÁN (rực rỡ lấp lánh như ngọc châu)", "examples": ["～的星空 / 璀璨的光芒"]}
    ],
    10: [
        {"hz": "面世", "py": "miànshì", "type": "【动】", "mean": "DIỆN THẾ (ra đời, ra mắt công chúng)", "examples": ["新药～ / 问世面世"]},
        {"hz": "狂热", "py": "kuángrè", "type": "【形】", "mean": "CUỒNG NHIỆT (cuồng nhiệt mù quáng)", "examples": ["～的信徒 / 狂热分子"]},
        {"hz": "尊严", "py": "zūnyán", "type": "【名】", "mean": "TÔN NGHIÊM (phẩm giá, sự tôn nghiêm con người)", "examples": ["人的～ / 维护尊严"]},
        {"hz": "供体", "py": "gōngtǐ", "type": "【名】", "mean": "CUNG THỂ (người hiến tặng, kho nội tạng hiến mô)", "examples": ["器官～ / 组织供体"]},
        {"hz": "约束", "py": "yuēshù", "type": "【动/名】", "mean": "ƯỚC THÚC (ràng buộc, kiềm chế, quy củ)", "examples": ["受到道德～ / 严格约束"]},
        {"hz": "敬畏", "py": "jìngwèi", "type": "【动/名】", "mean": "KÍNH ÚY (kính sợ, tôn kính khôn nguôi)", "examples": ["～自然 / 敬畏生命"]}
    ]
}

# Additional words per lesson for GC2
gc2_extra = {
    1: [
        {"hz": "老少咸宜", "py": "lǎoshào-xiányí", "type": "【成语】", "mean": "LÃO THIẾU HÀM NGHI (thích hợp cho cả già lẫn trẻ)", "examples": ["这种运动～。"]},
        {"hz": "气定神闲", "py": "qìdìng-shénxián", "type": "【成语】", "mean": "KHÍ ĐỊNH THẦN NHÀN (thần thái ung dung bình thản)", "examples": ["他～地走上讲台。"]},
        {"hz": "微不足道", "py": "wēibùzúdào", "type": "【成语】", "mean": "VI BẤT TÚC ĐẠO (nhỏ bé không đáng kể, không đáng bận tâm)", "examples": ["这点小事～。"]},
        {"hz": "突破", "py": "tūpò", "type": "【动/名】", "mean": "ĐỘT PHÁ (đột phá, mở toang trở ngại)", "examples": ["取得重大～ / 突破限制"]},
        {"hz": "刻骨铭心", "py": "kègǔ-míngxīn", "type": "【成语】", "mean": "KHẮC CỐT MINH TÂM (khắc sâu trong lòng, vĩnh viễn không quên)", "examples": ["一段～的爱。"]}
    ],
    2: [
        {"hz": "崎岖", "py": "qíqū", "type": "【形】", "mean": "KỲ KHU (gập ghềnh khấp khểnh, hiểm trở)", "examples": ["山路～ / 崎岖的小道"]},
        {"hz": "悬崖", "py": "xuányá", "type": "【名】", "mean": "HUYỀN NHAI (vực thẳm cheo leo, vách đá dốc đứng)", "examples": ["跌落～ / 悬崖峭壁"]},
        {"hz": "狂吠", "py": "kuángfèi", "type": "【动】", "mean": "CUỒNG PHỆ (chó sủa vang dội, sủa dữ dội)", "examples": ["大声～ / 警惕狂吠"]},
        {"hz": "天籁", "py": "tiānlài", "type": "【名】", "mean": "THIÊN LẠI (thanh âm tuyệt diệu của trời đất tự nhiên)", "examples": ["聆听～ / 天籁之音"]},
        {"hz": "沐浴", "py": "mùyù", "type": "【动】", "mean": "MỘC DỤC (tắm gội; đắm mình trong ánh nắng/tình thương)", "examples": ["～在阳光下 / 心灵沐浴"]}
    ],
    3: [
        {"hz": "撼动", "py": "hàndòng", "type": "【动】", "mean": "HÁM ĐỘNG (lay chuyển, rung chuyển dữ dội)", "examples": ["～山河 / 无法撼动"]},
        {"hz": "自命不凡", "py": "zìmìng-bùfán", "type": "【成语】", "mean": "TỰ MỆNH BẤT PHÀM (tự phụ cho mình là tài giỏi khác thường)", "examples": ["他一向～。"]},
        {"hz": "水滴石穿", "py": "shuǐdī-shíchuān", "type": "【成语】", "mean": "THỦY TÍCH THẠCH XUYÊN (nước chảy đá mòn, bền bỉ thành công)", "examples": ["只要有毅力，定能～。"]},
        {"hz": "初心", "py": "chūxīn", "type": "【名】", "mean": "SƠ TÂM (tấm lòng thuở ban đầu, lý tưởng sơ khai)", "examples": ["不忘～，方得始终。"]}
    ],
    4: [
        {"hz": "眩晕", "py": "xuànyùn", "type": "【形/动】", "mean": "HUYỄN VỰN (choáng váng, hoa mắt chóng mặt)", "examples": ["令人～的速度 / 感到眩晕"]},
        {"hz": "从容不迫", "py": "cóngróng-bùpò", "type": "【成语】", "mean": "THONG DONG BẤT BÁCH (ung dung thảnh thơi, không hề vội vã)", "examples": ["回答问题时～。"]},
        {"hz": "死胡同", "py": "sǐhútòng", "type": "【名】", "mean": "TỬ HỒ ĐỒNG (ngõ cụt, thế bế tắc không lối thoát)", "examples": ["走进～ / 陷入僵局"]},
        {"hz": "柳暗花明", "py": "liǔ'àn-huāmíng", "type": "【成语】", "mean": "LIỄU ÁM HOA MINH (bước ngoặt tươi sáng sau cơn khó khăn)", "examples": ["绝处逢生，～。"]}
    ],
    5: [
        {"hz": "挥洒", "py": "huīsǎ", "type": "【动】", "mean": "HUY SÁI (vung bút phóng khoáng, thỏa thích thể hiện)", "examples": ["～自如 / 挥洒青春"]},
        {"hz": "落榜", "py": "luòbǎng", "type": "【动】", "mean": "LẠC BẢNG (thi trượt, rớt khỏi bảng vàng)", "examples": ["高考～ / 名落孙山"]},
        {"hz": "携手", "py": "xiéshǒu", "type": "【动】", "mean": "HUỀ THỦ (nắm tay nhau, kề vai sánh bước)", "examples": ["～并进 / 携手一生"]},
        {"hz": "摸爬滚打", "py": "mōpá-gǔndǎ", "type": "【成语】", "mean": "MÔ BÀO CỔN ĐẢ (lăn lộn bươn chải, rèn luyện dạn dày)", "examples": ["在基层～。"]}
    ],
    6: [
        {"hz": "千姿百态", "py": "qiānzī-bǎitài", "type": "【成语】", "mean": "THIÊN TƯ BÁCH THÁI (muôn hình vạn trạng, muôn vẻ)", "examples": ["看台上～的观众。"]},
        {"hz": "欢呼雀跃", "py": "huānhū-quèyuè", "type": "【成语】", "mean": "HOAN HÔ TƯỚC DƯỢC (reo hò nhảy múa vui sướng như chim sẻ)", "examples": ["赢得比赛后～。"]},
        {"hz": "头头是道", "py": "tóutóu-shìdào", "type": "【成语】", "mean": "ĐẦU ĐẦU THỊ ĐẠO (nói năng rành mạch, đâu ra đấy rất có lý)", "examples": ["讲得～。"]},
        {"hz": "善意", "py": "shànyì", "type": "【名/形】", "mean": "THIỆN Ý (lòng tốt, thiện chí)", "examples": ["～的谎言 / 充满善意"]}
    ],
    7: [
        {"hz": "造化", "py": "zàohuà", "type": "【名】", "mean": "TẠO HÓA (tạo hóa của đất trời, sự an bài tự nhiên)", "examples": ["大自然的～ / 造化弄人"]},
        {"hz": "胸襟", "py": "xiōngjīn", "type": "【名】", "mean": "HUNG KHÂM (tấm lòng, độ rộng mở của tâm hồn)", "examples": ["～开阔 / 宽广的胸襟"]},
        {"hz": "申辩", "py": "shēnbiàn", "type": "【动】", "mean": "THÂN BIỆN (biện hộ, giãi bày lý lẽ bảo vệ)", "examples": ["为自己～ / 无需申辩"]},
        {"hz": "遁形", "py": "dùnxíng", "type": "【动】", "mean": "ĐỘN HÌNH (ẩn mình, che giấu hình bóng)", "examples": ["无所～ / 遁形于世"]}
    ],
    8: [
        {"hz": "专制", "py": "zhuānzhì", "type": "【名/形】", "mean": "CHUYÊN CHẾ (chế độ chuyên chế độc tài)", "examples": ["君主～制度 / 专制作风"]},
        {"hz": "抛头颅", "py": "pāotóulú", "type": "【短语】", "mean": "PHA ĐẦU LƯ (dâng hiến đầu xanh, xả thân vì nước)", "examples": ["～，洒热血"]},
        {"hz": "仇恨", "py": "chóuhèn", "type": "【名/动】", "mean": "CỪU HẬN (mối thù oán hận)", "examples": ["放下～ / 消除仇恨"]},
        {"hz": "复苏", "py": "fùsū", "type": "【动/名】", "mean": "PHỤC TÔ (hồi sinh, sống lại bừng sáng)", "examples": ["经济～ / 万物复苏"]}
    ],
    9: [
        {"hz": "顺应", "py": "shùnyìng", "type": "【动】", "mean": "THUẬN ỨNG (thuận theo quy luật tự nhiên)", "examples": ["～潮流 / 顺应自然"]},
        {"hz": "放荡不羁", "py": "fàngdàng-bùjī", "type": "【成语】", "mean": "PHÓNG ĐÃNG BẤT KỈ (phóng túng tự do không câu nệ khuôn phép)", "examples": ["性格～。"]},
        {"hz": "心力交瘁", "py": "xīnlì-jiāocuì", "type": "【成语】", "mean": "TÂM LỰC GIAO TỤY (tâm lực kiệt quệ, mệt mỏi rã rời)", "examples": ["工作让他～。"]},
        {"hz": "释然", "py": "shìrán", "type": "【形】", "mean": "THÍCH NHIÊN (nhẹ nhõm thanh thản, buông bỏ khúc mắc)", "examples": ["心头一片～ / 感到释然"]}
    ],
    10: [
        {"hz": "摇篮曲", "py": "yáolánqǔ", "type": "【名】", "mean": "DAO LAM KHÚC (khúc hát ru em ngủ)", "examples": ["母亲唱着～"]},
        {"hz": "交响乐", "py": "jiāoxiǎngyuè", "type": "【名】", "mean": "GIAO HƯỞNG NHẠC (bản nhạc giao hưởng thính phòng)", "examples": ["宏伟的～ / 聆听交响乐"]},
        {"hz": "洗尽铅华", "py": "xǐjìn-qiānhuá", "type": "【成语】", "mean": "TẨY TẬN DUYÊN HOA (gột sạch son phấn bụi bặm, trở về mộc mạc)", "examples": ["～，重归本真。"]},
        {"hz": "波澜", "py": "bōlán", "type": "【名】", "mean": "BA LAN (gợn sóng, sóng gió cảm xúc trào dâng)", "examples": ["内心起伏的～ / 力挽狂澜"]}
    ]
}

# Load master boya_data.json
with open("boya_data.json", "r", encoding="utf-8") as f:
    master = json.load(f)

# Enrich GC1
for b in master["books"]:
    if b["id"] == "gc1":
        for l in b["lessons"]:
            num = l["lesson_num"]
            extras = gc1_extra.get(num, [])
            for item in extras:
                hv = make_hv(item["hz"])
                word_obj = {
                    "id": f"gc1_{num}_{len(l['words']) + 1}",
                    "book_id": "gc1",
                    "book_name": "Cao Cấp 1",
                    "lesson_num": num,
                    "lesson_title": l["title"],
                    "hz": item["hz"],
                    "py": item["py"],
                    "type": item["type"],
                    "mean": f"{hv} ({item['mean'].split('(')[-1].rstrip(')')}) /" if '(' in item['mean'] else f"{hv} ({item['mean']}) /",
                    "examples": item["examples"],
                    "is_proper": False
                }
                l["words"].append(word_obj)
            l["total_vocab"] = len(l["words"])
        b["total_vocab"] = sum(len(l["words"]) for l in b["lessons"])

    if b["id"] == "gc2":
        for l in b["lessons"]:
            num = l["lesson_num"]
            extras = gc2_extra.get(num, [])
            for item in extras:
                hv = make_hv(item["hz"])
                word_obj = {
                    "id": f"gc2_{num}_{len(l['words']) + 1}",
                    "book_id": "gc2",
                    "book_name": "Cao Cấp 2",
                    "lesson_num": num,
                    "lesson_title": l["title"],
                    "hz": item["hz"],
                    "py": item["py"],
                    "type": item["type"],
                    "mean": f"{hv} ({item['mean'].split('(')[-1].rstrip(')')}) /" if '(' in item['mean'] else f"{hv} ({item['mean']}) /",
                    "examples": item["examples"],
                    "is_proper": False
                }
                l["words"].append(word_obj)
            l["total_vocab"] = len(l["words"])
        b["total_vocab"] = sum(len(l["words"]) for l in b["lessons"])

master["total_vocab"] = sum(b["total_vocab"] for b in master["books"])

# Write out master JSON and JS
with open("boya_data.json", "w", encoding="utf-8") as f:
    json.dump(master, f, ensure_ascii=False, indent=2)

with open("boya_data.js", "w", encoding="utf-8") as f:
    f.write("window.BOYA_DATA = ")
    json.dump(master, f, ensure_ascii=False)
    f.write(";\n")

print(f"Super enrichment complete! Total books: {master['total_books']}, Total lessons: {master['total_lessons']}, Total vocab: {master['total_vocab']}")
