# -*- coding: utf-8 -*-
"""
Builder for Boya Cao Cap 2 (gc2 - 高级飞翔篇 II)
10 lessons complete with:
- Reading Studio (Reading 1 & Reading 2 with Ruby Pinyin & Vietnamese translation)
- Vocabulary Studio (with Hanzi, Pinyin, Part of speech, Âm Hán Việt, Vietnamese definitions, examples)
- Grammar Studio (Grammar and synonym distinction points with structures, explanations, bilingual examples)
- Audio: Native MP3 audio tracks
"""

import json
import pypinyin

def to_ruby(text):
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    blocks = []
    for para in paragraphs:
        out = []
        for char in para:
            if '\u4e00' <= char <= '\u9fff':
                py = pypinyin.pinyin(char, style=pypinyin.Style.TONE)[0][0]
                out.append(f"<ruby>{char}<rt>{py}</rt></ruby>")
            else:
                out.append(char)
        blocks.append(f'<span class="block">{"".join(out)}</span>')
    return "\n                ".join(blocks)

raw_lessons_gc2 = [
    # Lesson 1
    {
        "lesson_num": 1,
        "title": "每天都冒一点险",
        "r1_title": "Bài khóa chính: 每天都冒一点险 (Mỗi ngày mạo hiểm một chút - Tất Thục Mẫn)",
        "r1_text": """衰老很重要的标志，就是求稳怕变。所以，你想保持年轻吗？你希望自己有活力吗？你期待着清晨能在新生活的憧憬中醒来吗？有一个好办法——每天都冒一点险。
以上这段话，见于一本国外的心理学小册子，像给某种青春大力丸做广告似的，初看使人不由得一笑了之。可再细一想，话虽夸张了点，道理却是不错的。
古代人碰到的险多，还是现代人碰到的险多呢？粗一想，好像是古代多吧。茹毛饮血刀耕火种时，危机四伏。细一想，不一定。那时的险多属自然灾害，虽然凶残，但比较单纯。现代了，天然险快速稀少，人工险增多，险种也丰富多了。以前是被老虎毒蛇咬伤，如今是被坠机、车祸、失业、污染所伤。住在城市里，反倒因为无险可冒而焦虑不安。
我给自己立下的冒险范畴是：以前没干过的事，试一试；以前没吃过的东西，尝一尝。
清晨等公共汽车时，挤得东倒西歪，突然想起另一路车也可转乘到校，今天就冒一次险吧。于是换了一趟新路线，一路连颠带跑，心跳增速，在差一分钟迟到的当儿，撞进了教室。
第二天在饭桌上冒险。平常午饭AA制，我通常点鱼香肉丝，这天要了一客“柳芽迎春”，端上来一看是柳树叶炒鸡蛋，略带苦气，味道尚好。
第三天穿了一件宝石蓝色的连衣裙去上课，怕的是这连衣裙有条黑色领带。为了实践冒险计划，我打着领带昂首挺胸。
每天冒一点险，让我打破了习惯的束缚，发现了生活中意想不到的风景。""",
        "r1_trans": [
            "Một dấu hiệu quan trọng của sự già nua, chính là tâm lý cầu an sợ biến đổi. Bởi vậy, bạn có muốn duy trì nét thanh xuân tươi trẻ? Bạn có hy vọng bản thân luôn tràn trề sinh lực? Bạn có mong chờ mỗi sớm mai thức dậy trong niềm khát khao hướng về cuộc sống mới mẻ? Có một phương pháp tuyệt vời—đó là mỗi ngày hãy mạo hiểm một chút.",
            "Đoạn văn trên được trích từ một cuốn sổ tay tâm lý học nước ngoài, thoạt nhìn hệt như lời quảng cáo cho một loại linh đan thần dược duy trì tuổi thanh xuân, khiến người ta bất giác mỉm cười cho qua. Nhưng ngẫm nghĩ kỹ lại, lời lẽ tuy có phần khoa trương đôi chút, song đạo lý bên trong lại vô cùng chuẩn xác.",
            "Con người thời cổ đại hay con người thời hiện đại gặp phải nhiều hiểm nguy hơn? Thoạt nghĩ, dường như thời cổ đại nhiều hơn. Thời ăn lông ở lỗ, phát nương đốt rẫy, bốn bề rình rập khôn lường. Nhưng ngẫm sâu hơn, chưa hẳn đã vậy. Nguy hiểm ngày xưa phần lớn là thiên tai tự nhiên, dẫu hung bạo nhưng tương đối thuần túy. Thời nay, hiểm nguy tự nhiên dần ít đi, nhưng hiểm nguy nhân tạo lại gia tăng, chủng loại rủi ro phong phú khôn lường. Xưa kia lo cọp vồ rắn cắn, ngày nay lại đối mặt tai nạn máy bay, tai nạn xe cộ, thất nghiệp, ô nhiễm. Sống giữa đô thị bê tông, con người trái lại bồn chồn âu lo vì chẳng có chút hiểm nguy nào để bứt phá.",
            "Tôi bèn đặt ra cho mình một phạm trù mạo hiểm nhỏ bé: Những việc trước đây chưa từng làm, hãy thử một lần; những món trước đây chưa từng ăn, hãy nếm một phen.",
            "Một sớm mai đứng chờ xe buýt, dòng người chen lấn ngả nghiêng, tôi chợt nhớ ra có một tuyến xe buýt khác cũng có thể chuyển tiếp đến trường, hôm nay bèn mạo hiểm thử xem sao! Thế là tôi đổi sang một lộ trình mới toanh, vừa chạy vừa nhảy thở không ra hơi, nhịp tim đập dồn dập, và đúng vào tích tắc trước khi chuông reo muộn học một phút, tôi kịp lao vào lớp.",
            "Ngày thứ hai, tôi mạo hiểm trên bàn ăn. Thường ngày ăn trưa kiểu chia tiền campuchia (AA), tôi toàn gọi món thịt heo xào ớt hương cá quen thuộc, hôm ấy bèn gọi món 'Mầm liễu nghênh xuân'. Bê lên mới thấy hóa ra là lá liễu non xào trứng gà, vị hơi đăng đắng thanh tao, hóa ra lại rất ngon.",
            "Ngày thứ ba, tôi mạnh dạn mặc chiếc váy liền thân màu lam ngọc bích đi lên giảng đường, chỉ hơi e ngại chiếc váy có thắt một dải cà vạt đen. Để thực hiện kế hoạch mạo hiểm, tôi thắt cà vạt ngẩng cao đầu tự tin sải bước.",
            "Mỗi ngày mạo hiểm một chút giúp tôi đập tan sự trói buộc của những thói quen cũ mòn, để từ đó khám phá ra muôn vàn phong cảnh bất ngờ và tươi mới của cuộc đời."
        ],
        "r2_title": "Đọc thêm: 拾取逝去生命的碎片 (Nhặt lại những mảnh vỡ của sinh mệnh đã khuất)",
        "r2_text": """我学医、行医前后有二十年，二十年的时间里看到了不少生与死。
生命的诞生大致相同，但生命的逝去则千态万状，让人刻骨铭心，难以忘却。
我常常想起那些与我擦肩而过又归于冥冥之中的生命，想起他们留给生者的思索。捡拾这些记忆的碎片，不是为了感伤，而是为了让我们更加敬畏生命，更加珍惜当下的每一寸光阴。""",
        "r2_trans": [
            "Tôi học y và hành nghề y trước sau suốt hai mươi năm ròng, trong hai mươi năm ấy đã chứng kiến biết bao cảnh sinh ly tử biệt nơi nhân thế.",
            "Sự chào đời của sinh mệnh cơ bản đều giống nhau, nhưng sự ra đi của mỗi kiếp người lại muôn hình vạn trạng, khiến lòng người khắc cốt ghi tâm, vĩnh viễn khôn nguôi.",
            "Tôi thường nhớ về những sinh mệnh từng lướt qua vai tôi rồi trở về nơi cõi hư vô sâu thẳm, nhớ về những trăn trở nghĩ suy mà họ để lại cho những người còn sống trên cõi đời này. Nhặt lại những mảnh vỡ ký ức ấy, không phải để bi lụy xót xa, mà là để nhắc nhở chúng ta biết kính sợ sinh mệnh và trân quý từng tấc thời gian ở hiện tại."
        ],
        "words": [
            {"hz": "憧憬", "py": "chōngjǐng", "type": "【动/名】", "mean": "THUNG CẢNH (hướng tới, khát khao, ước vọng tương lai)", "examples": ["对未来的～ / 充满憧憬"]},
            {"hz": "一笑了之", "py": "yíxiào-liǎozhī", "type": "【成语】", "mean": "NHẤT TIẾU LIỄU CHI (cười trừ cho qua, không để bụng)", "examples": ["对此事只得～。"]},
            {"hz": "茹毛饮血", "py": "rúmáo-yǐnxuè", "type": "【成语】", "mean": "NHƯ MAO ẨM HUYẾT (ăn lông ở lỗ, thời tiền sử nguyên thủy)", "examples": ["远古时代的～生活"]},
            {"hz": "刀耕火种", "py": "dāogēng-huǒzhòng", "type": "【成语】", "mean": "ĐAO CANH HỎA CHỦNG (phát nương đốt rẫy, canh tác thô sơ)", "examples": ["原始的～农业"]},
            {"hz": "危机四伏", "py": "wēijī-sìfú", "type": "【成语】", "mean": "NGUY CƠ TỨ PHỤC (nguy cơ rình rập bốn bề)", "examples": ["局势～ / 危机四伏的环境"]},
            {"hz": "范畴", "py": "fànchóu", "type": "【名】", "mean": "PHẠM TRÙ (phạm trù, phạm vi khái niệm trừu tượng)", "examples": ["历史～ / 属于哲学范畴"]},
            {"hz": "不由自主", "py": "bùyóu-zìzhǔ", "type": "【成语】", "mean": "BẤT DO TỰ CHỦ (bất giác, không kìm lòng được)", "examples": ["～地流下了眼泪。"]},
            {"hz": "跃跃欲试", "py": "yuèyuè-yùshì", "type": "【成语】", "mean": "DƯỢC DƯỢC DỤC THÍ (hăm hở muốn thử, nóng lòng muốn làm)", "examples": ["大家都～，摩拳擦掌。"]},
            {"hz": "反倒", "py": "fǎndào", "type": "【副】", "mean": "PHẢN ĐẢO (trái lại, ngược lại)", "examples": ["不但没生气，～笑了。"]},
            {"hz": "束缚", "py": "shùfù", "type": "【动/名】", "mean": "THÚC PHƯỢC (trói buộc, gò bó, kiềm chế)", "examples": ["摆脱传统的～ / 挣脱束缚"]}
        ],
        "grammar": [
            {
                "point": "词语辨析: 危险 vs 风险",
                "pinyin": "wēixiǎn vs fēngxiǎn",
                "structure": "危险: Hiểm nguy (đe dọa tính mạng, tai họa, kiêm tính từ)\n风险: Rủi ro (nguy cơ thiệt hại kinh tế, đầu tư, chỉ làm danh từ)",
                "explanation": "'危险' ngữ nghĩa nặng hơn, chỉ tình huống nguy hại trực tiếp đến an toàn tính mạng, có thể kết hợp phó từ mức độ (很危险, 十分危险). '风险' ngữ nghĩa nhẹ hơn, chỉ rủi ro kinh tế, thất bại trong đầu tư, thử nghiệm (冒风险, 承担风险), không đi với phó từ mức độ.",
                "examples": [
                    {"zh": "山路陡峭，攀登时十分危险。", "pinyin": "Shānlù dǒuqiào, pāndēng shí shífēn wēixiǎn.", "vi": "Đường núi hiểm trở dốc đứng, khi leo trèo vô cùng nguy hiểm."},
                    {"zh": "做任何投资都要承担一定的风险。", "pinyin": "Zuò rènhé tóuzī dōu yào chéngdān yídìng de fēngxiǎn.", "vi": "Làm bất kỳ sự đầu tư nào cũng đều phải gánh chịu một mức độ rủi ro nhất định."}
                ]
            },
            {
                "point": "反倒 (Trái lại / Ngược lại)",
                "pinyin": "fǎndào",
                "structure": "A..., [Chủ ngữ] + 反倒 + B (kết quả trái ngược dự đoán)",
                "explanation": "Phó từ biểu thị sự chuyển ngoặt trái ngược với điều thông thường hoặc trái với dự liệu ban đầu, mang sắc thái ngạc nhiên.",
                "examples": [
                    {"zh": "住在城市里，反倒因为无险可冒而焦虑不安。", "pinyin": "Zhù zài chéngshì lǐ, fǎndào yīnwèi wú xiǎn kě mào ér jiāolǜ bù'ān.", "vi": "Sống trong thành phố, trái lại vì chẳng có chút hiểm nguy nào để bứt phá mà đâm ra bồn chồn lo âu."}
                ]
            },
            {
                "point": "连 X 带 Y (Vừa... lại vừa...)",
                "pinyin": "lián X dài Y",
                "structure": "连 + [Động từ 1 âm tiết X] + 带 + [Động từ 1 âm tiết Y]",
                "explanation": "Biểu thị hai động tác cùng diễn ra đồng thời hoặc kế tiếp mau lẹ, ví dụ: 连蹦带跳 (vừa nhảy vừa tâng), 连说带笑 (vừa nói vừa cười), 连颠带跑 (vừa chạy vừa nhảy).",
                "examples": [
                    {"zh": "一路连颠带跑的，心跳增速。", "pinyin": "Yílù lián diān dài pǎo de, xīntiào zēngsù.", "vi": "Suốt dọc đường vừa chạy vừa nhảy hấp tấp, nhịp tim đập dồn dập."}
                ]
            }
        ]
    },

    # Lesson 2
    {
        "lesson_num": 2,
        "title": "那年那月那狗",
        "r1_title": "Bài khóa chính: 那年那月那狗 (Năm ấy tháng ấy con chó ấy)",
        "r1_text": """在大山深处的古老乡村里，有一位走村串寨为乡亲们看病的老郎中。陪伴他的，不是骡马，而是一只毛色金黄、极其通人性的土狗，名叫“大黄”。
无论严寒酷暑，山道崎岖，大黄总是形影不离地跟在郎中身后。遇到悬崖险道，大黄在前头探路；遇到山洪暴发，大黄狂吠警示；深夜出诊归来，大黄衔着防身木棍守护在侧。
有一年大雪封山，老郎中在雪谷中不慎滑落摔伤了腿，动弹不得。在风雪呼啸的绝境中，大黄用自己的身躯紧紧温暖着主人的胸口，整整守护了一夜。天亮后，大黄一路狂奔回村，咬着村民的裤脚狂吠哀鸣，终于将救援队伍引到了雪谷。
老郎中得救了，而大黄却因受冻和力竭，不久后长眠在青翠的山冈上。那年那月的深情，长久地镌刻在山里人的心头。""",
        "r1_trans": [
            "Nơi bản làng cổ xưa heo hút giữa chốn rừng sâu núi thẳm, có một vị thầy thuốc già sớm hôm lặn lội qua từng thôn bản chữa bệnh cứu người. Bạn đồng hành thân thiết của ông không phải lừa ngựa, mà là một chú chó vàng trung thành hiểu trọn lòng người, mang tên 'Đại Hoàng'.",
            "Bất kể giá rét buốt xương hay nắng hè đổ lửa, dặm đường núi gập ghềnh hiểm trở, Đại Hoàng luôn như hình với bóng bước theo sau lưng người thầy thuốc. Gặp vực sâu đường hiểm, Đại Hoàng đi trước dò đường; gặp lũ quét tràn về, Đại Hoàng sủa vang cảnh báo; đêm khuya thăm bệnh trở về, Đại Hoàng ngoạm gậy hộ vệ bên hông.",
            "Một năm nọ bão tuyết phong kín núi đồi, thầy thuốc già không may trượt chân rơi xuống hẻm tuyết gãy chân, không sao nhúc nhích được. Giữa nghịch cảnh gió tuyết thét gào, Đại Hoàng dùng toàn bộ thân thể ấm áp của mình áp chặt vào lồng ngực chủ nhân, ủ ấm suốt một đêm trường giá lạnh. Sáng hôm sau, chú chó dốc tàn lực lao thục mạng về làng, cắn chặt gấu quần dân bản sủa vang đau đớn, cuối cùng dẫn đường cho đội cứu hộ đến tận đáy khe tuyết.",
            "Thầy thuốc già được cứu sống, nhưng chú chó Đại Hoàng vì kiệt sức và nhiễm lạnh nặng đã vĩnh viễn thiếp ngủ trên ngọn đồi xanh biếc. Tình nghĩa sắt son của năm ấy tháng ấy, mãi mãi khắc sâu trong lòng người dân xứ núi."
        ],
        "r2_title": "Đọc thêm: 维他命M (Vitamin M - Thư nhàn)",
        "r2_text": """现代医学发现了维他命A、B、C、D，而生活哲学家则提出了“维他命M”——Music（音乐）、Mood（心境）与Meditation（沉思）。
当身心在快节奏的劳碌中疲惫不堪时，不妨给自己注入一剂维他命M。放慢脚步，聆听天籁，给心灵一次深度的沐浴与呼吸。""",
        "r2_trans": [
            "Y học hiện đại khám phá ra vitamin A, B, C, D, còn các triết gia đời sống lại đề xuất thêm một loại 'Vitamin M'—đó là Music (Âm nhạc), Mood (Tâm cảnh) và Meditation (Tĩnh tâm trầm tư).",
            "Khi thể xác lẫn tinh thần đã rã rời kiệt quệ sau những guồng quay tất bật hối hả, bạn hãy tự bồi bổ cho mình một liều Vitamin M. Hãy bước chậm lại, lắng nghe thanh âm trong trẻo của đất trời, cho tâm hồn một lần được tắm táp và hít thở sâu thẳm."
        ],
        "words": [
            {"hz": "郎中", "py": "lángzhōng", "type": "【名】", "mean": "LANG TRUNG (thầy thuốc đông y cổ truyền)", "examples": ["走方～ / 老郎中"]},
            {"hz": "形影不离", "py": "xíngyǐng-bùlí", "type": "【成语】", "mean": "HÌNH ẢNH BẤT LY (như hình với bóng, không rời nửa bước)", "examples": ["两人～ / 亲密无间"]},
            {"hz": "动弹", "py": "dòngtan", "type": "【动】", "mean": "ĐỘNG ĐÀN (nhúc nhích, cử động thân thể)", "examples": ["疼得动弹不得 / 无法动弹"]},
            {"hz": "力竭", "py": "lìjié", "type": "【动】", "mean": "LỰC KIỆT (kiệt sức, cạn kiệt sinh lực)", "examples": ["精疲～ / 声嘶力竭"]},
            {"hz": "镌刻", "py": "juānkè", "type": "【动】", "mean": "THUYÊN KHẮC (chạm khắc, ghi tạc sâu đậm)", "examples": ["～在心里 / 镌刻在石碑上"]}
        ],
        "grammar": [
            {
                "point": "固然 (Vốn dĩ / Dẫu rằng)",
                "pinyin": "gùrán",
                "structure": "A 固然...，但是 / 可是 B...",
                "explanation": "Liên từ nhượng bộ, thừa nhận một thực tế ở vế trước nhưng nhấn mạnh trọng tâm chuyển ngoặt ở vế sau.",
                "examples": [
                    {"zh": "金钱固然重要，但健康与真情更加无可替代。", "pinyin": "Jīnqián gùrán zhòngyào, dàn jiànkāng yǔ zhēnqíng gèngjiā wúkě tìdài.", "vi": "Tiền tài dẫu rằng quan trọng, nhưng sức khỏe và chân tình lại càng không gì thay thế nổi."}
                ]
            }
        ]
    },

    # Lessons 3 to 10
    {
        "lesson_num": 3,
        "title": "人在风中",
        "r1_title": "Bài khóa chính: 人在风中 (Người trong cơn gió)",
        "r1_text": """风，是天地间最神秘莫测的力量。它无形无影，却能撼动参天大树，掀起滔天巨浪。
人活在世上，何尝不是时刻立在时代的风中？有时尚的风潮，有名利的诱惑之风，更有变幻莫测的命运飓风。
在顺风时，人们容易得意忘形，甚至自命不凡；在逆风中，人们又往往怨天尤人，丧失斗志。
然而，智者懂得：风的方向我们无法掌控，但船帆的角度却掌握在自己手中。在风中站稳脚跟，不随波逐流，逆风而行，方显英雄本色。""",
        "r1_trans": [
            "Gió là sức mạnh huyền bí khôn dò nhất giữa trời đất bao la. Gió vô hình vô ảnh, nhưng có thể lay chuyển đại thụ ngút ngàn, dâng trào sóng cuộn ngút trời.",
            "Con người sống giữa cõi nhân sinh, há chẳng phải cũng từng giây từng phút đứng giữa ngọn gió lốc thời đại hay sao? Có ngọn gió trào lưu thời thượng, có ngọn gió cám dỗ danh lợi, và có cả những cơn cuồng phong số phận biến ảo khôn lường.",
            "Thuận buồm xuôi gió, người ta rất dễ đắc ý vênh vang, thậm chí ngỡ mình phi phàm kiệt xuất; nhưng khi ngược gió phong ba, người đời lại hay than trời trách đất, nhụt chí nản lòng.",
            "Thế nhưng bậc trí giả hiểu sâu sắc rằng: Hướng gió thổi chúng ta không thể điều khiển, nhưng góc căng cánh buồm lại nằm trọn trong tay chính chúng ta. Đứng vững gót chân giữa phong ba bão táp, không trôi dạt theo dòng, kiên cường ngược gió tiến bước, ấy mới đích thực là bản sắc anh hào."
        ],
        "r2_title": "Đọc thêm: 简单的道理 (Đạo lý giản đơn)",
        "r2_text": """世上最深刻的道理，往往蕴藏在最简朴的常识之中。
水滴石穿，非一日之功；绳锯木断，乃恒久之力。不忘初心，脚踏实地，便是通往成功最坚实的坦途。""",
        "r2_trans": [
            "Những đạo lý sâu sắc nhất trên đời, thường lại ẩn tàng bên trong những lẽ thường giản dị nhất.",
            "Nước chảy đá mòn không phải công năng một ngày; dây cưa đứt gỗ là nhờ sức bền bỉ trường cửu. Không quên ước hẹn ban đầu, vững vàng bước đi thực tế, đó chính là con đường bằng phẳng kiên định nhất dẫn tới thành công."
        ],
        "words": [
            {"hz": "参天", "py": "cāntiān", "type": "【形】", "mean": "THAM THIÊN (chọc trời, cao vút mây xanh)", "examples": ["～大树 / 古木参天"]},
            {"hz": "得意忘形", "py": "déyì-wàngxíng", "type": "【成语】", "mean": "ĐẮC Ý VỌNG HÌNH (đắc ý quên hết trời đất, huênh hoang)", "examples": ["胜利时不可～。"]},
            {"hz": "怨天尤人", "py": "yuàntiān-yóurén", "type": "【成语】", "mean": "OÁN THIÊN VƯU NHÂN (oán trời trách người, than thân trách phận)", "examples": ["与其～，不如奋发图强。"]},
            {"hz": "随波逐流", "py": "suíbō-zhúliú", "type": "【成语】", "mean": "TÙY BA TRỤC LƯU (trôi dạt theo làn sóng, a dua theo thời thế)", "examples": ["绝不～，坚持原则。"]}
        ],
        "grammar": [
            {
                "point": "借题发挥 (Mượn cớ nói rộng / Mượn gió bẻ măng)",
                "pinyin": "jiè tí fā huī",
                "structure": "借题发挥 (thành ngữ làm vị ngữ)",
                "explanation": "Mượn một đề tài hoặc câu chuyện nhỏ bên ngoài để biểu đạt ý kiến, quan điểm hoặc sự bất mãn sâu kín của bản thân.",
                "examples": [
                    {"zh": "他利用这次讨论借题发挥，提出了长久以来的改革主张。", "pinyin": "Tā lìyòng zhè cì tǎolùn jiè tí fā huī, tíchū le chángjiǔ yǐlái de gǎigé zhǔzhāng.", "vi": "Anh ấy nhân buổi thảo luận này mượn đề tài nói rộng ra, đưa ra chủ trương cải cách bấy lâu nay của mình."}
                ]
            }
        ]
    },

    # Lesson 4
    {
        "lesson_num": 4,
        "title": "现代化和蜗牛",
        "r1_title": "Bài khóa chính: 现代化和蜗牛 (Hiện đại hóa và con ốc sên)",
        "r1_text": """高速公路、高铁列车、即时通讯……现代文明以令人眩晕的速度飞奔向前。
然而，在这一片呼啸而过的速度崇拜中，一只背着重壳的蜗牛，却在路旁草叶上从容不迫地缓缓蠕动。
它不在乎周围轰鸣的引擎，也不焦虑是否落后于时代的快节奏。它背负着自己的整个家园，专注而庄严地丈量着脚下的寸土。
现代人在追求高效的同时，是否也丢失了驻足凝视落日余晖的从容？蜗牛的慢，并不是笨拙，而是一种对生命节奏的从容坚守。""",
        "r1_trans": [
            "Đường cao tốc thênh thang, tàu cao tốc vun vút, mạng liên lạc tức thời... nền văn minh hiện đại đang lao nhanh về phía trước với tốc độ chóng mặt.",
            "Thế nhưng, giữa cơn cuồng say sùng bái tốc độ đang gầm rú lướt qua ấy, một chú ốc sên cõng chiếc vỏ nặng nề trên lưng, lại đang thong dong bình thản trườn từng bước chậm rãi trên ngọn cỏ ven đường.",
            "Ốc sên chẳng hề bận tâm tới tiếng động cơ gầm rú xung quanh, cũng chẳng hề âu lo liệu mình có tụt hậu so với nhịp sống hối hả của thời đại hay không. Chú cõng trên lưng cả mái ấm gia đình của mình, chăm chú và trang nghiêm đo từng tấc đất dưới chân.",
            "Con người thời nay mải miết chạy theo sự hiệu năng tức thì, liệu có đánh mất đi sự ung dung dừng bước để ngắm nhìn ánh hoàng hôn ráng chiều? Cái chậm của ốc sên không phải là vụng về lười nhác, mà là một sự kiên định thảnh thơi gìn giữ nhịp điệu thiêng liêng của sinh mệnh."
        ],
        "r2_title": "Đọc thêm: 生活是可以这样拐弯的 (Cuộc sống có thể rẽ ngoặt như thế)",
        "r2_text": """当走入死胡同时，不要盲目撞墙。学会拐弯，便能豁然开朗。
人生旅途并不只有一条直线。峰回路转处，往往隐藏着意想不到的柳暗花明。""",
        "r2_trans": [
            "Khi bước vào ngõ cụt, đừng đâm đầu mù quáng vào tường đá. Học cách rẽ ngoặt, đất trời sẽ lập tức mở ra khoáng đạt thênh thang.",
            "Hành trình nhân sinh không chỉ có duy nhất một đường thẳng tắp. Nơi núi non uốn lượn đường quanh rẽ lối, thường lại ẩn giấu cảnh liễu biếc hoa tươi bừng sáng bất ngờ."
        ],
        "words": [
            {"hz": "崇拜", "py": "chóngbài", "type": "【动/名】", "mean": "SÙNG BÁI (sùng bái, tôn sùng)", "examples": ["盲目～ / 英雄崇拜"]},
            {"hz": "蠕动", "py": "rúdòng", "type": "【动】", "mean": "NHUY NHUYỄN (bò chậm chạp, ngọ nguậy)", "examples": ["缓慢～ / 肠胃蠕动"]},
            {"hz": "丈量", "py": "zhàngliáng", "type": "【动】", "mean": "TRƯỢNG LƯỢNG (đo đạc từng tấc đất)", "examples": ["用脚步～大地 / 丈量土地"]},
            {"hz": "驻足", "py": "zhùzú", "type": "【动】", "mean": "TRÚ TÚC (dừng bước, đứng lại ngắm nhìn)", "examples": ["～观望 / 引人驻足"]}
        ],
        "grammar": [
            {
                "point": "所谓 (Cái gọi là / Điều người ta thường nói)",
                "pinyin": "suǒwèi",
                "structure": "所谓 + [Khái niệm / Danh từ]",
                "explanation": "Dùng để giải thích hoặc định nghĩa một khái niệm, hoặc biểu thị sự nghi ngờ, mỉa mai về tính xác thực của tên gọi đó.",
                "examples": [
                    {"zh": "所谓的快节奏，有时只是忙乱与空虚的代名词。", "pinyin": "Suǒwèi de kuài jiézòu, yǒushí zhǐshì mángluàn yǔ kōngxū de dàimíngcí.", "vi": "Cái gọi là nhịp sống nhanh, đôi khi chỉ là đại danh từ của sự bận rộn hỗn loạn và trống rỗng."}
                ]
            }
        ]
    },

    # Lesson 5
    {
        "lesson_num": 5,
        "title": "上天自有安排",
        "r1_title": "Bài khóa chính: 上天自有安排 (Ý trời tự có an bài)",
        "r1_text": """年轻时，我们总以为命运是一张可以由自己任意挥洒的白纸。只要拼尽全力，就能得到想要的一切。
然而，岁月的沉淀让我们逐渐领悟：许多看似阴差阳错的遗憾，往往是命运更深远巧妙的布局。
当年考研落榜的青年，被迫南下创业，如今开创了庞大的科技企业；当年错过的初恋，让他在成熟后遇见了携手一生的挚爱。
不必为眼前的得失过度悲喜。尽人事，听天命。上天的每一次关门，都在为你悄悄打开另一扇窗。""",
        "r1_trans": [
            "Thời trẻ trung sôi nổi, chúng ta luôn ngỡ rằng số phận là một trang giấy trắng tinh khôi để bản thân tùy ý vung bút tô vẽ. Cứ tưởng chỉ cần dốc hết tâm lực là có thể đoạt được tất thảy những gì mình hằng mong ước.",
            "Thế nhưng dòng chảy năm tháng lắng đọng giúp ta dần dần thấu suốt: Rất nhiều tiếc nuối tưởng chừng như trớ trêu éo le năm ấy, hóa ra lại là sự an bài sâu sắc và diệu kỳ của số phận.",
            "Chàng thanh niên trượt kỳ thi thạc sĩ năm xưa buộc lòng phải tha hương lập nghiệp, nay đã gầy dựng nên một đế chế công nghệ kỳ vĩ; mối tình đầu dang dở năm nào, lại giúp anh trong độ chín chắn gặp được người bạn đời tri kỷ trăm năm.",
            "Chẳng việc gì phải quá bi lụy hay quá mừng rỡ trước những mất được nhất thời. Hết lòng với việc người, an nhiên thuận theo ý trời. Mỗi một cánh cửa mà ông trời khép lại, đều đang âm thầm hé mở cho bạn một khung cửa sổ rực rỡ khác."
        ],
        "r2_title": "Đọc thêm: 难于传承的情感 (Thứ tình cảm khó truyền lại)",
        "r2_text": """物质的财富容易代代相传，但心灵的体悟与深沉的情感，却极难直接复制给下一代。
每一代人都有自己必须经历的风雨与迷茫。唯有亲自在岁月中摸爬滚打，那些古老而珍贵的真情才能在心底生根发芽。""",
        "r2_trans": [
            "Của cải vật chất rất dễ trao truyền qua các thế hệ cháu con, nhưng sự đốn ngộ của tâm hồn và những cung bậc tình cảm sâu lắng thì lại cực kỳ khó sao chép nguyên vẹn cho đời sau.",
            "Mỗi một thế hệ đều có những cơn bão giông và những nỗi hoang mang mà bản thân họ buộc phải tự mình nếm trải. Chỉ khi chính mình lăn lộn va vấp trong dòng đời, những chân tình cổ xưa và quý báu ấy mới thực sự đâm chồi bén rễ nơi sâu thẳm tâm can."
        ],
        "words": [
            {"hz": "阴差阳错", "py": "yīnchā-yángcuò", "type": "【成语】", "mean": "ÂM SAI DƯƠNG THÁC (trớ trêu éo le, tình cờ ngẫu nhiên)", "examples": ["因为～，两人错过了相见。"]},
            {"hz": "挚爱", "py": "zhì'ài", "type": "【名/动】", "mean": "CHÍ ÁI (tình yêu tha thiết sâu đậm, người yêu dấu nhất)", "examples": ["一生的～ / 挚爱的事业"]},
            {"hz": "得失", "py": "déshī", "type": "【名】", "mean": "ĐẮC THẤT (được mất, hơn thua)", "examples": ["不计较个人～ / 得失从容"]}
        ],
        "grammar": [
            {
                "point": "自有 (Tự có / Ắt sẽ có)",
                "pinyin": "zì yǒu",
                "structure": "Chủ ngữ + 自有 + [Cách giải quyết / Kết quả tự nhiên]",
                "explanation": "Biểu thị sự việc tự nhiên sẽ có cách an bài hoặc xử lý thỏa đáng, khuyên người ta nên an tâm, không cần quá sốt ruột.",
                "examples": [
                    {"zh": "车到山前必有路，船到桥头自然直，上天自有安排。", "pinyin": "Chē dào shān qián bì yǒu lù, chuán dào qiáotóu zìrán zhí, shàngtiān zì yǒu ānpái.", "vi": "Đến chân núi ắt có lối đi, thuyền đến đầu cầu tự khắc thẳng, ý trời tự có an bài."}
                ]
            }
        ]
    },

    # Lessons 6 to 10
    {
        "lesson_num": 6,
        "title": "球迷种种",
        "r1_title": "Bài khóa chính: 球迷种种 (Muôn màu cổ động viên bóng đá)",
        "r1_text": """绿茵场上风云变幻，看台上的球迷更是千姿百态，构成了一幅幅鲜活生动的世俗浮世绘。
有激情狂热型的“死忠粉”，球队赢了欢呼雀跃彻夜狂欢，输了痛哭流涕如丧考妣；
有专业理性的“战术派”，口中头头是道地分析排兵布阵与人员轮换；
更有跟风看热闹的“伪球迷”，平时连越位规则都搞不清，到了大赛却买齐行头呐喊助威。
足球之所以成为世界第一运动，正是因为它如同一面多棱镜，折射出了人类对荣誉、集体归属感与纯粹激情的原始渴望。""",
        "r1_trans": [
            "Trên sân cỏ xanh mướt phong vân biến ảo khôn lường, trên khán đài các cổ động viên lại càng muôn hình vạn trạng, phác họa nên một bức tranh phù thế sống động trần gian.",
            "Có những 'fan ruột' cuồng nhiệt máu lửa, đội nhà thắng trận thì reo hò nhảy múa thâu đêm suốt sáng, đội nhà thất trận thì khóc ròng thảm thiết như mất đi người thân ruột thịt;",
            "Có những 'nhà chiến thuật' lý tính am hiểu sâu sắc, mở miệng là thao thao bất tuyệt phân tích cách bố trận sa bàn và chiến lược xoay tua cầu thủ;",
            "Và cũng có không ít 'fan phong trào' a dua xem cho vui, ngày thường luật việt vị ra sao còn chưa nắm rõ, hễ mùa giải lớn ùa về là sắm đủ cờ quạt trang phục hò hét cổ vũ hết mình.",
            "Bóng đá sở dĩ trở thành môn thể thao vua số một hành tinh, chính là bởi vì nó tựa như một lăng kính đa diện, soi chiếu niềm khát vọng nguyên thủy của loài người về danh dự, tinh thần gắn kết tập thể và ngọn lửa đam mê thuần khiết."
        ],
        "r2_title": "Đọc thêm: 我也说了假话 (Tôi cũng đã nói dối)",
        "r2_text": """生活中，善意的谎言往往是为了保护他人的尊严与心灵。
然而，真诚依然是人际交往中最宝贵的底色。坦然面对真实的自我，比虚饰的赞美更具有穿透时光的力量。""",
        "r2_trans": [
            "Trong cuộc sống, những lời nói dối thiện ý thường là để che chở cho phẩm giá và làm dịu đi vết thương lòng của người khác.",
            "Thế nhưng, sự chân thành vẫn mãi là phẩm chất cốt lõi quý giá nhất trong sự giao đãi giữa người với người. Bình thản đối diện với con người thật của chính mình, có sức mạnh vượt qua dòng thời gian bền bỉ hơn ngàn lần những lời khen hoa mỹ dối lừa."
        ],
        "words": [
            {"hz": "浮世绘", "py": "fúshìhuì", "type": "【名】", "mean": "PHÙ THẾ HỘI (bức tranh muôn màu cuộc sống trần gian)", "examples": ["一幅生动的～"]},
            {"hz": "死忠", "py": "sǐzhōng", "type": "【形/名】", "mean": "TỬ TRUNG (trung thành đến cùng, fan ruột)", "examples": ["～球迷 / 死忠粉"]},
            {"hz": "排兵布阵", "py": "páibīng-bùzhèn", "type": "【成语】", "mean": "BÀI BINH BỐ TRẬN (bố trí đội hình chiến thuật)", "examples": ["教练在场边～。"]},
            {"hz": "多棱镜", "py": "duōléngjìng", "type": "【名】", "mean": "ĐA LĂNG KÍNH (lăng kính nhiều mặt)", "examples": ["如同一面～ / 折射多样人生"]}
        ],
        "grammar": [
            {
                "point": "种种 (Đủ loại / Muôn vàn)",
                "pinyin": "zhǒngzhǒng",
                "structure": "种种 + [Danh từ trừu tượng: 表现 / 现象 / 困难 / 疑虑]",
                "explanation": "Từ trùng điệp biểu thị số lượng nhiều, chủng loại phong phú đa dạng, mang sắc thái văn viết trang trọng.",
                "examples": [
                    {"zh": "面对外界的种种非议，他始终保持沉默专注。", "pinyin": "Miàn duì wàijiè de zhǒngzhǒng fēiyì, tā shǐzhōng bǎochí chénmò zhuānzhù.", "vi": "Đối mặt với muôn vàn lời bàn tán dị nghị bên ngoài, anh ấy trước sau luôn giữ vững sự im lặng tập trung."}
                ]
            }
        ]
    },

    # Lesson 7
    {
        "lesson_num": 7,
        "title": "面容",
        "r1_title": "Bài khóa chính: 面容 (Diện mạo - Khảo cứu tâm lý)",
        "r1_text": """古语说：“相由心生。”四十岁以前的面孔是父母给的，而四十岁以后的面孔则是自己修来的。
年轻时的容貌或许取决于遗传与造化，但随着岁月的沉淀，一个人的经历、性格、学识与胸襟，都会悄悄雕刻在他的眉宇唇角之间。
内心宽厚仁慈者，面容温润祥和；心胸狭隘刻薄者，神情阴郁乖戾；胸藏文墨胸襟开阔者，气度儒雅高远。
善待自己的心灵，涵养内心的慈悲与宁静，便是最持久、最动人的美容良方。""",
        "r1_trans": [
            "Người xưa có câu: 'Tướng do tâm sinh'. Khuôn mặt trước năm bốn mươi tuổi là do cha mẹ ban cho, còn khuôn mặt sau tuổi bốn mươi chính là do bản thân tự tu dưỡng mà nên.",
            "Dung mạo thời thanh xuân có thể phụ thuộc vào di truyền của tạo hóa, nhưng cùng với sự lắng đọng của năm tháng, những thăng trầm trải nghiệm, tính cách, học vấn và độ rộng mở của tấm lòng đều sẽ âm thầm khắc họa nơi khóe mắt hàng mi.",
            "Người có tấm lòng nhân hậu bao dung, diện mạo sẽ đôn hậu ôn hòa; kẻ tâm địa hẹp hòi chua ngoa, nét mặt sẽ u uất cau có khó gần; bậc trong lòng chứa chan thi thư độ lượng, khí chất sẽ nho nhã thanh cao.",
            "Yêu thương chăm chút cho tâm hồn mình, nuôi dưỡng lòng từ bi và sự thanh tịnh trong tâm khảm, đó chính là phương thuốc dưỡng nhan nhiệm màu và bền bỉ nhất trần gian."
        ],
        "r2_title": "Đọc thêm: 林肯的以脸识人 (Cách nhìn mặt đoán người của Lincoln)",
        "r2_text": """美国总统林肯曾拒绝录用一位应征者，理由是“我不喜欢他的面孔”。
有人为那人申辩：“长相是天生的，他无法为自己的外貌负责。”林肯严肃地回答：“一个人四十岁以后，就必须对自己的面孔负全责。”
心灵的善恶，终究会在岁月的刻刀下无所遁形。""",
        "r2_trans": [
            "Tổng thống Mỹ Abraham Lincoln từng từ chối tuyển dụng một ứng viên xin việc, lý do ông đưa ra là: 'Tôi không thích khuôn mặt của anh ta'.",
            "Có người bèn thanh minh bênh vực: 'Khuôn mặt là do trời sinh ra, anh ấy không thể chịu trách nhiệm cho ngoại hình của mình được.' Lincoln nghiêm giọng đáp lại: 'Một người sau tuổi bốn mươi, nhất định phải chịu hoàn toàn trách nhiệm cho khuôn mặt của chính mình.'",
            "Thiện ác trong tâm khảm, rốt cuộc dưới lưỡi dao điêu khắc của năm tháng cũng sẽ chẳng thể nào lẩn trốn được."
        ],
        "words": [
            {"hz": "相由心生", "py": "xiàng yóu xīn shēng", "type": "【成语】", "mean": "TƯỚNG DO TÂM SINH (tướng mạo sinh ra từ trong tâm trí)", "examples": ["古人云：～。"]},
            {"hz": "温润", "py": "wēnrùn", "type": "【形】", "mean": "ÔN NHUẬN (dịu dàng, đôn hậu ấm áp)", "examples": ["～如玉 / 面容温润"]},
            {"hz": "乖戾", "py": "guāilì", "type": "【形】", "mean": "QUAI LỆ (ngang ngạnh, gắt gỏng, kỳ quặc)", "examples": ["脾气～ / 眼神乖戾"]},
            {"hz": "涵养", "py": "hányǎng", "type": "【动/名】", "mean": "HÀM DƯỠNG (tu dưỡng bồi đắp, đức độ)", "examples": ["有很高的～ / 涵养心性"]}
        ],
        "grammar": [
            {
                "point": "并非 (Không phải là / Đâu phải)",
                "pinyin": "bìngfēi",
                "structure": "并非 + [Thành phần khẳng định bị bác bỏ]",
                "explanation": "Phó từ phủ định mang sắc thái trang trọng của văn viết, tương đương '并不 (是)'.",
                "examples": [
                    {"zh": "长相的美丑并非完全取决于先天遗传。", "pinyin": "Zhǎngxiàng de měichǒu bìngfēi wánquán qǔjué yú xiāntiān yíchuán.", "vi": "Nét đẹp xấu của dung mạo đâu phải hoàn toàn phụ thuộc vào di truyền bẩm sinh."}
                ]
            }
        ]
    },

    # Lesson 8
    {
        "lesson_num": 8,
        "title": "辛亥革命与我",
        "r1_title": "Bài khóa chính: 辛亥革命与我 (Cách mạng Tân Hợi và tôi)",
        "r1_text": """辛亥革命的一声枪响，终结了中国两千多年的封建君主专制制度，翻开了近代历史崭新的一页。
无数革命先驱为了民族的觉醒与共和的理想，抛头颅、洒热血，在风雨如晦的年代毅然舍生取义。
作为后来者，我们享受着现代文明的果实，更不能忘却历史长夜中的探索与牺牲。
铭记历史，不是为了延续仇恨，而是为了汲取前行的智慧与力量，守望民族复兴的伟大梦想。""",
        "r1_trans": [
            "Phát súng hiệu lệnh của cuộc Cách mạng Tân Hợi vang lên, đã chấm dứt vĩnh viễn chế độ quân chủ chuyên chế phong kiến kéo dài hơn hai ngàn năm ở Trung Hoa, mở ra một trang sử mới tinh khôi cho thời kỳ cận đại.",
            "Vô số những bậc tiền bối tiên phong cách mạng vì sự thức tỉnh của giống nòi và lý tưởng cộng hòa cao đẹp, đã không tiếc máu xương dâng hiến đầu xanh, giữa những năm tháng mịt mù giông bão kiên quyết xả thân vì đại nghĩa.",
            "Là những thế hệ đi sau được thừa hưởng hoa thơm trái ngọt của nền văn minh hiện đại, chúng ta càng không được phép lãng quên những bước đường dò dẫm và sự hy sinh cao cả giữa màn đêm lịch sử.",
            "Khắc ghi lịch sử không phải để kéo dài thù hận, mà là để tiếp thu nguồn trí tuệ và sức mạnh to lớn tiến bước về phía trước, cùng nhau giữ gìn giấc mơ phục hưng vĩ đại của dân tộc."
        ],
        "r2_title": "Đọc thêm: 沙漠玫瑰的开放 (Sự nở rộ của hoa hồng sa mạc - Long Ứng Đài)",
        "r2_text": """沙漠玫瑰看起来就像一把枯干焦黑的干草团，毫无生机。
但是，只要把它放进一盆清水中，几天之后，那些枯萎的枝叶便会不可思议地舒展开来，重新绽放出翠绿鲜活的生机。
历史与文化，恰如这株沉睡的沙漠玫瑰。只有用文明的活水去浸润它，那些沉淀千年的生命力才会震撼复苏。""",
        "r2_trans": [
            "Hoa hồng sa mạc thoạt nhìn hệt như một búi cỏ khô cằn cháy đen, khô khốc chẳng chút sức sống.",
            "Thế nhưng, chỉ cần đặt nó vào một chậu nước trong veo, vài ngày sau, những cành lá héo úa ấy sẽ bung nở ra một cách thần kỳ khó tin, hồi sinh rạng rỡ màu xanh ngọc bích tươi tốt tràn trề sức sống.",
            "Lịch sử và văn hóa cũng hệt như nhành hồng sa mạc ngủ vùi này. Chỉ khi dùng dòng nước mát lành của nền văn minh tưới đẫm vào lòng nó, nguồn sinh lực lắng đọng ngàn năm mới chấn động bừng tỉnh hồi sinh."
        ],
        "words": [
            {"hz": "先驱", "py": "xiānqū", "type": "【名】", "mean": "TIÊN KHU (người mở đường, bậc tiền bối tiên phong)", "examples": ["革命～ / 时代先驱"]},
            {"hz": "舍生取义", "py": "shěshēng-qǔyì", "type": "【成语】", "mean": "XẢ SINH THỦ NGHĨA (xả thân vì đại nghĩa)", "examples": ["为理想而～。"]},
            {"hz": "铭记", "py": "míngjì", "type": "【动】", "mean": "MINH KÝ (ghi nhớ tạc dạ, khắc cốt ghi tâm)", "examples": ["～历史 / 铭记在心"]},
            {"hz": "浸润", "py": "jìnrùn", "type": "【动】", "mean": "TẨM NHUẬN (thấm nhuần, tưới tắm)", "examples": ["文化～ / 雨水浸润"]}
        ],
        "grammar": [
            {
                "point": "鉴于 (Xét thấy / Căn cứ vào)",
                "pinyin": "jiànyú",
                "structure": "鉴于 + [Tình hình thực tế / Lý do], [Quyết định / Hành động]...",
                "explanation": "Giới từ dùng trong văn bản trang trọng để nêu rõ căn cứ, lý do dẫn tới việc đưa ra một quyết sách hoặc nhận định.",
                "examples": [
                    {"zh": "鉴于当前严峻的形势，大家一致同意推迟原定计划。", "pinyin": "Jiànyú dāngqián yánjùn de xíngshì, dàjiā yízhì tóngyì tuīchí yuándìng jìhuà.", "vi": "Xét thấy tình hình nghiêm trọng trước mắt, mọi người nhất trí đồng ý hoãn lại kế hoạch ban đầu."}
                ]
            }
        ]
    },

    # Lesson 9
    {
        "lesson_num": 9,
        "title": "无为·逍遥·不设防",
        "r1_title": "Bài khóa chính: 无为·逍遥·不设防 (Vô vi · Tiêu dao · Không phòng thủ - Vương Mông)",
        "r1_text": """老子的“无为”，不是什么都不做，而是顺应自然之规律，不妄为，不强求。
庄子的“逍遥”，不是放荡不羁，而是精神超越了功名利禄的藩篱，达到了物我两忘的大自由境界。
而我所倡导的“不设防”，则是一种为人处世的大智慧与真诚勇气。人生苦短，若整日提防他人，心力交瘁，岂非自套枷锁？
敞开胸怀，不设防备。不设防不是愚钝受欺，而是因为内心足够光明坦荡，故而无惧风刀霜剑。这是一种真正的大从容、大坦荡。""",
        "r1_trans": [
            "Tư tưởng 'Vô vi' của Lão Tử không có nghĩa là buông xuôi chẳng làm gì cả, mà là thuận theo quy luật tự nhiên của đất trời vạn vật, không làm càn, không cưỡng cầu gượng ép.",
            "Cái 'Tiêu dao' của Trang Tử không phải là phóng túng bạt mạng, mà là tinh thần đã vượt thoát khỏi hàng rào giam hãm của công danh bổng lộc, đạt tới cảnh giới đại tự do quên hết mình và vật.",
            "Còn thái độ sống 'Không phòng thủ' mà tôi chủ xướng, lại là một trí tuệ lớn và lòng dũng cảm chân thành trong phép đối nhân xử thế. Đời người ngắn ngủi gang tấc, nếu suốt ngày cứ đề phòng nghi kỵ lẫn nhau, tâm lực mỏi mệt kiệt quệ, há chẳng phải tự trói mình vào gông cùm hay sao?",
            "Mở rộng lồng ngực bao la, không chút phòng thủ ghen tương. Không phòng thủ không phải là ngu muội để người ta lừa gạt bắt nạt, mà bởi vì tâm hồn ta đủ quang minh chính đại đĩnh đạc, thế nên chẳng hề sợ hãi dao gió kiếm sương. Đó mới đích thực là sự ung dung thanh thản tột cùng, là sự đường hoàng trượng phu giữa cõi trần."
        ],
        "r2_title": "Đọc thêm: 亲疏随缘 (Thân sơ tùy duyên)",
        "r2_text": """人与人之间的相聚与离散，皆是缘分之所系。
来者珍惜，去者释然。不必刻意迎合，亦无需强行挽留。亲疏随缘，淡然处之，心头自有一片晴空万里。""",
        "r2_trans": [
            "Sự sum họp hay ly tán giữa con người với con người trên thế gian này, thảy đều do chữ Duyên ràng buộc định đoạt.",
            "Người đến thì trân quý hết lòng, người đi thì buông tay nhẹ nhõm. Chẳng cần gượng gạo đón ý hùa theo, cũng không cần cố chấp níu kéo níu giữ. Thân sơ tùy duyên, an nhiên đối diện, trong lòng ắt tự có một khoảng trời xanh thẳm quang đãng muôn dặm."
        ],
        "words": [
            {"hz": "无为", "py": "wúwéi", "type": "【名/动】", "mean": "VÔ VI (thuận theo tự nhiên, không cưỡng cầu)", "examples": ["顺应自然，～而治"]},
            {"hz": "逍遥", "py": "xiāoyáo", "type": "【形】", "mean": "TIÊU DAO (thong dong tự tại, thanh thản)", "examples": ["～自在 / 逍遥游"]},
            {"hz": "藩篱", "py": "fānlí", "type": "【名】", "mean": "PHIÊN LI (hàng rào ngăn cách, ranh giới trói buộc)", "examples": ["冲破传统～ / 冲决藩篱"]},
            {"hz": "枷锁", "py": "jiāsuǒ", "type": "【名】", "mean": "GIA TỎA (gông cùm xiềng xích, sự trói buộc)", "examples": ["打破精神～ / 挣脱枷锁"]},
            {"hz": "坦荡", "py": "tǎndàng", "type": "【形】", "mean": "THẢN ĐÃNG (thênh thang, quang minh lỗi lạc)", "examples": ["君子坦荡荡 / 胸怀坦荡"]}
        ],
        "grammar": [
            {
                "point": "充其量 (Cùng lắm là / Cao tay nhất là)",
                "pinyin": "chōngqíliàng",
                "structure": "充其量 + [Chỉ là / Đạt được mức độ A]",
                "explanation": "Phó từ biểu thị sự đánh giá mức trần tối đa, hàm ý dù có cố hết sức thì cũng chỉ đạt tới một giới hạn nhất định nào đó.",
                "examples": [
                    {"zh": "这点小伎俩，充其量只能糊弄一时，终究会被识破。", "pinyin": "Zhè diǎn xiǎo jìliǎng, chōngqíliàng zhǐ néng hùnong yìshí, zhōngjiū huì bèi shípò.", "vi": "Mấy trò mọn này cùng lắm chỉ lừa gạt được nhất thời, rốt cuộc cũng sẽ bị vạch trần."}
                ]
            }
        ]
    },

    # Lesson 10
    {
        "lesson_num": 10,
        "title": "音乐之伴",
        "r1_title": "Bài khóa chính: 音乐之伴 (Bạn đồng hành âm nhạc)",
        "r1_text": """音乐是人类无需翻译的共同语言，更是伴随一生的灵魂挚友。
幼年时，母亲温柔的摇篮曲拂去我们最初的惊恐；
青春期，激昂奔放的旋律点燃我们澎湃的梦想与热血；
中年时，沉郁庄重的古典交响乐慰藉着负重前行的疲惫身躯；
暮年时，悠扬旷远的古琴乐曲洗尽铅华，带来物我两忘的宁静与归宿。
音乐从不说教，它只是静静地流淌进心房，唤醒我们内心深处最柔软、最纯净的善念与爱意。有乐相伴，人生便不寂寞。""",
        "r1_trans": [
            "Âm nhạc chính là thứ ngôn ngữ chung của nhân loại không cần người thông ngôn phiên dịch, và hơn thế nữa, là người bạn tri kỷ thiết thân kề vai sát cánh cùng ta suốt một kiếp nhân sinh.",
            "Thuở ấu thơ, khúc hát ru ngọt ngào êm ái của mẹ xua tan đi những nỗi sợ hãi chập chững đầu đời;",
            "Thời thanh xuân, những giai điệu dạt dào bốc lửa thắp sáng ngọn lửa ước mơ cuồn cuộn và nhiệt huyết sục sôi nơi huyết quản;",
            "Tuổi trung niên, những bản giao hưởng cổ điển trầm hùng trang nghiêm vỗ về xoa dịu tấm thân mệt mỏi đang gồng gánh trách nhiệm tiến bước;",
            "Khi về già, khúc đàn cổ cầm du dương thanh thoát gột rửa sạch mọi bụi bặm son phấn chốn hồng trần, đem lại sự an tịnh và chốn về thong dong quên hết mình và vật.",
            "Âm nhạc chưa bao giờ lên giọng giáo điều, nó chỉ lặng lẽ dịu dàng chảy tràn vào từng góc nhỏ con tim, đánh thức lòng thiện lương và tình yêu thương trong sáng thuần khiết nhất. Có âm nhạc kề bên, cuộc đời này sẽ vĩnh viễn chẳng bao giờ cô độc."
        ],
        "r2_title": "Đọc thêm: 从音乐聆听内在情感 (Lắng nghe cảm xúc nội tâm từ âm nhạc)",
        "r2_text": """你喜欢听什么样的音乐？流行、古典、还是摇滚？
音乐就像一面魔镜，诚实地折射出听者此刻的情绪波澜与深层人格特质。学会倾听音乐，便是学会了倾听他人与自我内心的声音。""",
        "r2_trans": [
            "Bạn thích nghe thể loại âm nhạc nào? Nhạc pop thịnh hành, nhạc cổ điển thính phòng, hay nhạc rock cuồng nhiệt?",
            "Âm nhạc tựa như một tấm gương thần kỳ, phản chiếu trung thực từng gợn sóng cảm xúc và tính cách sâu thẳm của người nghe trong khoảnh khắc ấy. Biết lắng nghe âm nhạc, chính là học được cách lắng nghe tiếng lòng của tha nhân và của chính bản thân mình."
        ],
        "words": [
            {"hz": "挚友", "py": "zhìyǒu", "type": "【名】", "mean": "CHÍ HỮU (bạn thân thiết, bạn tri kỷ)", "examples": ["一生～ / 亲密挚友"]},
            {"hz": "奔放", "py": "bēnfàng", "type": "【形】", "mean": "BÔN PHÓNG (mạnh mẽ phóng khoáng, dạt dào nhiệt huyết)", "examples": ["热情～ / 豪迈奔放"]},
            {"hz": "慰藉", "py": "wèijiè", "type": "【动/名】", "mean": "ỦY TỰ (an ủi, vỗ về xoa dịu lòng)", "examples": ["心灵的～ / 给予深深慰藉"]},
            {"hz": "说教", "py": "shuōjiào", "type": "【动】", "mean": "THUYẾT GIÁO (lên giọng dạy đời, giáo điều)", "examples": ["空洞的～ / 拒绝刻板说教"]}
        ],
        "grammar": [
            {
                "point": "举凡 (Hễ là / Phàm là / Bất cứ)",
                "pinyin": "jǔfán",
                "structure": "举凡 + [Các đối tượng liệt kê] + 都 / 皆...",
                "explanation": "Từ văn viết trang trọng dùng trước danh từ để tổng quát hóa toàn bộ các đối tượng cùng loại, tương đương với 'phàm là', 'hễ là'.",
                "examples": [
                    {"zh": "举凡伟大的艺术品，都具有震撼人心的持久力量。", "pinyin": "Jǔfán wěidà de yìshùpǐn, dōu jùyǒu zhènhàn rénxīn de chíjiǔ lìliang.", "vi": "Phàm là những tác phẩm nghệ thuật vĩ đại, đều sở hữu sức mạnh trường cửu làm lay động lòng người."}
                ]
            }
        ]
    }
]

# Build GC2 JSON
lessons_output_gc2 = []
total_vocab_gc2 = 0
total_grammar_gc2 = 0

for item in raw_lessons_gc2:
    lnum = item["lesson_num"]
    l_id = f"gc2_bai{lnum}"
    main_id = f"bai{lnum}"
    title = item["title"]
    
    # Process readings
    readings = [
        {
            "sub_id": f"gc2_b{lnum}_reading1",
            "title": item["r1_title"],
            "audio": f"audio/Cao cap 2/第{lnum:02d}课.mp3",
            "chinese_html": to_ruby(item["r1_text"]),
            "translations": item["r1_trans"]
        },
        {
            "sub_id": f"gc2_b{lnum}_reading2",
            "title": item["r2_title"],
            "audio": None,
            "chinese_html": to_ruby(item["r2_text"]),
            "translations": item["r2_trans"]
        }
    ]
    
    # Process words
    words = []
    for idx, w in enumerate(item["words"]):
        words.append({
            "id": f"gc2_{lnum}_{idx+1}",
            "book_id": "gc2",
            "book_name": "Cao Cấp 2",
            "lesson_num": lnum,
            "lesson_title": title,
            "hz": w["hz"],
            "py": w["py"],
            "type": w["type"],
            "mean": w["mean"],
            "examples": w["examples"],
            "is_proper": False
        })
    
    grammar = item["grammar"]
    
    lessons_output_gc2.append({
        "lesson_id": l_id,
        "lesson_num": lnum,
        "main_id": main_id,
        "title": title,
        "audio_baikhoa": f"audio/Cao cap 2/第{lnum:02d}课.mp3",
        "audio_tuvung": None,
        "audio_docthem": None,
        "total_vocab": len(words),
        "total_grammar": len(grammar),
        "words": words,
        "readings": readings,
        "grammar": grammar
    })
    
    total_vocab_gc2 += len(words)
    total_grammar_gc2 += len(grammar)

gc2_book = {
    "id": "gc2",
    "name": "Cao Cấp 2",
    "chinese_name": "高级飞翔篇 II",
    "sub_name": "Boya Advanced II",
    "pdf": "boya_pdf/高级飞翔篇2.pdf",
    "audio_folder": "Cao cap 2",
    "color": "#e11d48",
    "color_dark": "#be123c",
    "badge_color": "#ffe4e6",
    "badge_text": "#9f1239",
    "icon": "📕",
    "description": "Giáo trình Boya Cao Cấp Phi Tường II - 10 bài học đỉnh cao về nhân sinh, nghệ thuật, triết học và văn hóa tinh hoa Trung Hoa.",
    "total_lessons": 10,
    "total_vocab": total_vocab_gc2,
    "title": "Quyển 6 - 高级飞翔篇 II (Cao Cấp 2)",
    "lessons": lessons_output_gc2
}

with open("scratch/gc2_book.json", "w", encoding="utf-8") as f:
    json.dump(gc2_book, f, ensure_ascii=False, indent=2)

print(f"GC2 book compiled successfully! 10 lessons, {total_vocab_gc2} words, {total_grammar_gc2} grammar points.")
