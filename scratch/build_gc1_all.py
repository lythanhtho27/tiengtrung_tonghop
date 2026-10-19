# -*- coding: utf-8 -*-
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

# Lesson data dictionary for GC1
raw_lessons = [
    # Lesson 1
    {
        "lesson_num": 1,
        "title": "父亲的谜语",
        "r1_title": "Bài khóa chính: 父亲的谜语 (Câu đố của cha)",
        "r1_text": """小时候，父亲最爱教我猜谜语。
父亲有很多谜语。夏日的晚上，坐在星光笼罩着的院子里，最有趣的事是猜父亲的谜语。父亲笑眯眯地看着我，悠悠地念着他的谜语。我眨巴着眼睛，仰头对着那满天的星斗苦苦地寻找，谜底藏在哪里呢？再盯着父亲的眼睛瞧，觉得他那双笑眯眯的小眼睛也和夜空一样深邃、神秘。当我苦思冥想，觉得小脑瓜子发涨的时候，父亲便会给予巧妙的提示，直到我得意地叫起来，他也“嘿嘿”地笑了。
渐渐地，父亲的谜语很少能够难倒我了。只有一条谜语我猜不出：“晚上关箱子，早上开箱子，箱子里面有镜子，镜子里面有个细妹子。”我想了半天想不出，问父亲：“怎么镜子里面有个细妹子呢？”父亲笑着说：“你再听呀——”他把眼睛合上，“晚上关箱子，”又把眼睛睁开，“早上开箱子，”父亲把眼睛凑近我，“箱子里面有镜子，你仔细看看，镜子里是不是有个细妹子？”我叫起来：“是眼睛，是眼睛。”父亲说：“对。这是爸爸的眼睛。”
我问：“那我的眼睛又该怎么说呢？”“晚上关箱子，早上开箱子，箱子里面有镜子，镜子里面有——”父亲摸摸饱经忧患而早白了的头发，说：“有个老头子。”
可后来有一次父亲猜不出了。因为我长大了，心里有扇小门儿悄悄地开了。一个影子从眼睛投到了心里，抹也抹不掉，可影子“他”却全然不知。陡然觉得父亲带给我的光明黯淡了，我心里只对那个人说：“没有你呀，我就是黑暗。”父亲做的饭菜也不香了，涩涩地咽不下去。
有一天，我告诉父亲我要离开家，跟着那个人到离家很远的地方去。父亲静静地听我说，浑浊的眼睛里什么表情也没有。半晌才开口：“我知道有一天你要走的，女大不中留啊。要是他待你不好，你就回家来。”
可是他待我很好，我和他在一起是那么幸福。有一次记起父亲的生日，便写信问父亲需要什么，说不管他要什么，女儿都会想尽办法“变”出来的。
父亲来信了，只有四行字：“晚上关箱子，早上开箱子，箱子里面有镜子，镜子里面有个细妹子。”那是父亲的眼睛，我怎么会猜不出呢？""",
        "r1_trans": [
            "Hồi nhỏ, cha tôi thích nhất là dạy tôi đoán câu đố.",
            "Cha có rất nhiều câu đố. Vào những đêm hè, ngồi trong khoảng sân được ánh sao bao phủ, điều thú vị nhất là đoán những câu đố của cha. Cha mỉm cười nhìn tôi, thong thả đọc câu đố của mình. Tôi chớp chớp mắt, ngước nhìn bầu trời đầy sao khổ công tìm kiếm: đáp án câu đố giấu ở đâu nhỉ? Nhìn chăm chú vào mắt cha, tôi cảm thấy đôi mắt nhỏ híp lại cười của cha cũng sâu thẳm và huyền bí như bầu trời đêm. Khi tôi suy nghĩ vắt óc đến mức đầu óc căng phồng lên, cha sẽ khéo léo gợi ý cho đến khi tôi đắc ý reo lên, và cha cũng cười 'hì hì' vui vẻ.",
            "Dần dần, những câu đố của cha hiếm khi làm khó được tôi nữa. Chỉ có một câu đố duy nhất tôi không tài nào đoán ra: 'Tối đóng rương, sáng mở rương, trong rương có tấm gương, trong gương có cô bé con.' Tôi nghĩ mãi không ra, bèn hỏi cha: 'Sao trong gương lại có cô bé được hả cha?' Cha mỉm cười bảo: 'Con nghe lại này—' Cha nhắm mắt lại, 'Tối đóng rương,' rồi lại mở mắt ra, 'Sáng mở rương,' cha ghé sát mắt lại gần tôi, 'Trong rương có gương, con nhìn kỹ xem, có phải trong gương có một cô bé con không?' Tôi reo lên: 'Là đôi mắt, là đôi mắt ạ!' Cha gật đầu: 'Đúng rồi, đó là đôi mắt của cha.'",
            "Tôi hỏi tiếp: 'Thế còn mắt của con thì phải nói thế nào hả cha?' 'Tối đóng rương, sáng mở rương, trong rương có gương, trong gương có...' Cha xoa mái tóc đã bạc sớm vì dãi dầu sương gió, cười bảo: 'Có một ông già.'",
            "Thế nhưng sau này có một lần cha đã không đoán được nữa. Bởi vì tôi đã lớn, cánh cửa lòng tôi đã âm thầm mở hé. Một bóng hình đã từ ánh mắt in sâu vào tim tôi, xóa mãi không nhòa, nhưng 'người ấy' lại hoàn toàn không hay biết. Tôi bỗng thấy ánh sáng cha mang lại trở nên ảm đạm, trong lòng chỉ muốn nói với người ấy: 'Không có anh, em chỉ là bóng tối.' Cơm canh cha nấu cũng chẳng còn ngon nữa, nghẹn ứ nơi cổ họng.",
            "Một ngày nọ, tôi thưa với cha rằng tôi muốn rời khỏi nhà, đi theo người ấy đến một nơi rất xa. Cha lặng lẽ lắng nghe, trong đôi mắt đục mờ không chút biểu cảm. Hồi lâu cha mới cất lời: 'Cha biết rồi sẽ có ngày con phải ra đi, con gái lớn không thể giữ mãi trong nhà được. Nếu như cậu ấy đối xử không tốt với con, con hãy quay về nhà nhé.'",
            "Nhưng người ấy đối xử với tôi rất tốt, tôi ở bên anh vô cùng hạnh phúc. Một lần nhớ đến sinh nhật cha, tôi viết thư hỏi cha cần gì, con gái sẽ tìm mọi cách 'biến' ra tặng cha.",
            "Cha gửi thư trả lời, vỏn vẹn chỉ có bốn câu: 'Tối đóng rương, sáng mở rương, trong rương có gương, trong gương có cô bé con.' Đó là đôi mắt của cha, làm sao tôi lại không đoán ra cơ chứ?"
        ],
        "r2_title": "Đọc thêm: 胡萝卜、鸡蛋和咖啡 (Cà rốt, trứng và cà phê)",
        "r2_text": """一天，女儿满腹牢骚地向父亲抱怨起生活的艰难。父亲是位厨师，他把女儿带进厨房。
父亲往三只锅里各倒进一些水，然后把胡萝卜放进第一只锅，把鸡蛋放进第二只锅，把咖啡豆放进第三只锅。水煮沸了，父亲把火关掉。
父亲问女儿：“你看到了什么？”女儿回答：“胡萝卜、鸡蛋和咖啡。”
父亲让她摸摸胡萝卜，胡萝卜变软了；再让她打破鸡蛋，鸡蛋变硬了；最后让她尝尝咖啡，香醇浓郁。
父亲解释说：“这三样东西面临同样的逆境——沸水。然而，它们各自的反应却完全不同。原本坚硬的胡萝卜变得软弱无力；原本脆弱的鸡蛋内心变得坚硬；而咖啡豆最为奇特，它反而改变了沸水，带来了浓郁的芬芳。”
父亲看着女儿问：“在面对生活的困境时，你愿意做哪一个呢？”""",
        "r2_trans": [
            "Một ngày nọ, cô con gái đầy ắp nỗi bực dọc than thở với cha về những nhọc nhằn, cay đắng của cuộc sống. Người cha là một đầu bếp, ông đưa con gái vào căn bếp nhỏ.",
            "Người cha đổ nước vào ba chiếc nồi, sau đó đặt củ cà rốt vào nồi thứ nhất, quả trứng vào nồi thứ hai và những hạt cà phê vào nồi thứ ba. Nước sôi sùng sục, người cha tắt bếp.",
            "Người cha hỏi: 'Con nhìn thấy điều gì?' Cô gái đáp: 'Cà rốt, trứng và cà phê ạ.'",
            "Người cha bảo con sờ củ cà rốt, nó đã mềm nhũn; lại bảo con bóc quả trứng, nó đã trở nên đặc cứng; cuối cùng bảo con nếm ngụm cà phê, hương thơm nồng nàn quyến rũ.",
            "Người cha giải thích: 'Cả ba thứ này đều đối mặt với cùng một nghịch cảnh—nước sôi. Thế nhưng, phản ứng của mỗi thứ lại hoàn toàn khác biệt. Củ cà rốt vốn cứng cỏi nay trở nên yếu đuối, nhũn mềm; quả trứng vốn mỏng manh nay lòng trắng lòng đỏ đều đông cứng lại; duy chỉ có hạt cà phê là kỳ diệu nhất, nó đã làm thay đổi chính dòng nước sôi và tỏa ra hương thơm ngào ngạt.'",
            "Người cha ân cần nhìn con gái: 'Khi đối diện với nghịch cảnh giông bão của cuộc đời, con muốn mình trở thành thứ nào?'"
        ],
        "words": [
            {"hz": "谜语", "py": "míyǔ", "type": "【名】", "mean": "MÊ NGỮ (câu đố, lời đố)", "examples": ["猜～ / 出～ / 谜底"]},
            {"hz": "笼罩", "py": "lǒngzhào", "type": "【动】", "mean": "LỒNG TRIẾU (bao phủ, bao trùm)", "examples": ["大雾～ / 整个城市被～在夜幕中"]},
            {"hz": "笑眯眯", "py": "xiàomīmī", "type": "【形】", "mean": "TIẾU MI MI (cười híp mắt, tươi cười)", "examples": ["～地看着我 / 一副～的模样"]},
            {"hz": "悠悠", "py": "yōuyōu", "type": "【形】", "mean": "DU DU (ung dung, thong thả, xa xăm)", "examples": ["～念着 / 悠悠岁月"]},
            {"hz": "深邃", "py": "shēnsuì", "type": "【形】", "mean": "THÂM THUÝ (sâu thẳm, sâu xa)", "examples": ["目光～ / 深邃的夜空"]},
            {"hz": "苦思冥想", "py": "kǔsī-míngxiǎng", "type": "【成语】", "mean": "KHỔ TƯ MINH TƯỞNG (suy nghĩ nát óc, trầm tư suy ngẫm)", "examples": ["他～了半天，终于有了主意。"]},
            {"hz": "给予", "py": "jǐyǔ", "type": "【动】", "mean": "KỶ DỰ (dành cho, ban cho, giúp đỡ)", "examples": ["～帮助 / ～好评 / ～关怀"]},
            {"hz": "饱经忧患", "py": "bǎojīng-yōuhuàn", "type": "【成语】", "mean": "BÃO KINH ƯU HOẠN (từng trải bao nỗi gian nan hoạn nạn)", "examples": ["～的脸上布满了皱纹。"]},
            {"hz": "陡然", "py": "dǒurán", "type": "【副】", "mean": "ĐẨU NHIÊN (đột nhiên, bỗng nhiên)", "examples": ["～发生变化 / 陡然一惊"]},
            {"hz": "黯淡", "py": "àndàn", "type": "【形】", "mean": "ÁM ĐẠM (ảm đạm, mờ mịt, u tối)", "examples": ["光线～ / 前途黯淡"]},
            {"hz": "浑浊", "py": "húnzhuó", "type": "【形】", "mean": "HỖN TRỰC (vẩn đục, đục ngầu, mờ đục)", "examples": ["～的眼睛 / 河水浑浊"]},
            {"hz": "半晌", "py": "bànshǎng", "type": "【名】", "mean": "BÁN HƯỞNG (hồi lâu, nửa ngày)", "examples": ["过了～才说话 / 愣了半晌"]},
            {"hz": "荒诞", "py": "huāngdàn", "type": "【形】", "mean": "HOANG ĐẢN (hoang đường, vô lý)", "examples": ["～的想法 / 荒诞不经"]},
            {"hz": "孝心", "py": "xiàoxīn", "type": "【名】", "mean": "HIẾU TÂM (lòng hiếu thảo, hiếu kính)", "examples": ["尽一点～ / 孝敬父母"]}
        ],
        "grammar": [
            {
                "point": "给予 (Cho / Dành cho)",
                "pinyin": "jǐyǔ",
                "structure": "给予 + [Tân ngữ trừu tượng (sự giúp đỡ, khích lệ, chỉ bảo)]",
                "explanation": "Động từ mang sắc thái trang trọng (thư diện ngữ), biểu thị việc trao tặng hoặc đem lại điều gì đó tích cực về tinh thần hoặc hành động cho đối phương. Thường đi kèm với các danh từ trừu tượng như: 帮助, 支持, 鼓励, 照顾, 启示.",
                "examples": [
                    {"zh": "父亲便会给予巧妙的提示。", "pinyin": "Fùqīn biàn huì jǐyǔ qiǎomiào de tíshì.", "vi": "Người cha liền khéo léo dành cho tôi những gợi ý tài tình."},
                    {"zh": "在学习过程中，老师给予我们极大的关怀与指引。", "pinyin": "Zài xuéxí guòchéng zhōng, lǎoshī jǐyǔ wǒmen jí dà de guānhuái yǔ zhǐyǐn.", "vi": "Trong quá trình học tập, thầy cô đã dành cho chúng tôi sự quan tâm và chỉ dẫn vô cùng to lớn."}
                ]
            },
            {
                "point": "饱经 (Từng trải nhiều / Trải qua bao nhiêu)",
                "pinyin": "bǎojīng",
                "structure": "饱经 + [Danh từ chỉ sự thăng trầm, gian khổ: 忧患 / 风霜 / 沧桑 / 苦难]",
                "explanation": "Động từ biểu thị việc đã trải qua đầy đủ, sâu sắc và chịu đựng vô số khó khăn, thăng trầm trong suốt thời gian dài. Thường kết hợp trong các thành ngữ: 饱经风霜 (dãi dầu sương gió), 饱经忧患 (trải bao hoạn nạn), 饱经沧桑 (trải bao biến thiên cuộc đời).",
                "examples": [
                    {"zh": "父亲摸摸饱经忧患而早白了的头发。", "pinyin": "Fùqīn mōmō bǎojīng yōuhuàn ér zǎo bái le de tóufa.", "vi": "Cha khẽ vuốt mái tóc đã bạc sớm vì trải qua bao nỗi hoạn nạn gian truân."},
                    {"zh": "这位老人饱经风霜，目光中却依然充满坚毅。", "pinyin": "Zhè wèi lǎorén bǎojīng fēngshuāng, mùguāng zhōng què yīrán chōngmǎn jiānyì.", "vi": "Cụ già ấy đã dãi dầu sương gió, nhưng trong ánh mắt vẫn ngời lên vẻ kiên cường."}
                ]
            },
            {
                "point": "V + 也 + V + 不 + V/A (Không sao làm nổi / Làm mãi cũng chẳng...)",
                "pinyin": "V yě V bù V/A",
                "structure": "Động từ + 也 + Động từ + 不 + [Bổ ngữ kết quả / Bổ ngữ khả năng]",
                "explanation": "Cấu trúc nhấn mạnh dù có cố gắng thực hiện hành động đến mức nào thì cũng không thể đạt được kết quả hoặc không thay đổi được tình trạng. Ví dụ: 抹也抹不掉 (xóa mãi không nhòa), 想也想不出 (nghĩ mãi không ra), 找也找不到 (tìm mãi không thấy).",
                "examples": [
                    {"zh": "一个影子从眼睛投到了心里，抹也抹不掉。", "pinyin": "Yígè yǐngzi cóng yǎnjing tóu dào le xīnlǐ, mǒ yě mǒ bú diào.", "vi": "Một bóng hình từ ánh mắt rọi vào trong tim, muốn xóa đi mà không sao xóa nhòa nổi."},
                    {"zh": "这道难题我思前想后，猜也猜不中。", "pinyin": "Zhè dào nántí wǒ sī qián xiǎng hòu, cāi yě cāi bù zhòng.", "vi": "Câu đố khó này tôi nghĩ đi nghĩ lại, đoán mãi cũng không trúng."}
                ]
            },
            {
                "point": "词语辨析: 深邃 vs 深刻",
                "pinyin": "shēnsuì vs shēnkè",
                "structure": "深邃: Sâu thẳm (khoảng không gian, ánh mắt, tư tưởng bí ẩn)\n深刻: Sâu sắc (nhận thức, ấn tượng, bài học)",
                "explanation": "Hai từ đều biểu thị mức độ sâu, nhưng phạm vi dùng khác nhau: '深邃' thiên về độ sâu thẳm, hun hút của không gian vật lý (đêm đen, hang động, vũ trụ) hoặc ánh mắt, ý nghĩa huyền ảo khó dò. Còn '深刻' thiên về tính sâu sắc trong tư tưởng, ấn tượng lòng người, bài học kinh nghiệm hoặc bản chất vấn đề.",
                "examples": [
                    {"zh": "他那双笑眯眯的小眼睛也和夜空一样深邃、神秘。", "pinyin": "Tā nà shuāng xiàomīmī de xiǎo yǎnjing yě hé yèkōng yíyàng shēnsuì, shénmì.", "vi": "Đôi mắt nhỏ híp cười của cha cũng sâu thẳm và huyền bí như bầu trời đêm."},
                    {"zh": "这次旅行给我留下了极其深刻的印象。", "pinyin": "Zhè cì lǚxíng gěi wǒ liúxià le jíqí shēnkè de yìnxiàng.", "vi": "Chuyến đi này đã để lại trong tôi ấn tượng cực kỳ sâu sắc."}
                ]
            }
        ]
    },

    # Lesson 2
    {
        "lesson_num": 2,
        "title": "请按……",
        "r1_title": "Bài khóa chính: 请按…… (Xin hãy bấm... - Di Thư)",
        "r1_text": """江世平独自一人坐在空荡荡的公寓里，四周静得能听见自己的心跳。
他拿起电话，按下了航空公司查询班机的号码。耳机里传来柔和甜美的电脑录音女声：“多谢你致电华东航空公司。假如你想知道今日班机抵港时间，请按403；假如你想知道班机离境号码，请按228……”
世平顺从地按着电钮。在这个高科技的现代都市里，人与人之间的直接交谈越来越少，取而代之的是冰冷而客气的电脑语音程序。
不知不觉，他拨错了另一个号码。听筒里竟传来一段奇异的语音系统：“多谢你致电余宅。假如你找余仁邦，请按1；假如你找余仁乐，请按2；假如你拨错号码，请按3。”
世平感到好奇，按了3。那声音继续道：“你连连拨错号码，还肯花时间听下去，可见你是一个寂寞的人。如果我说对了，请按4；如果我说错了，请按5。”
世平苦笑了一下，按下了4。
“你果然感到寂寞。你想找人倾诉吗？假如你想谈谈今天的天气，请按6；假如你想讨论中东局势，请按7；假如你想听一段古典音乐，请按8；假如你只想找一个声音陪伴，请按0。”
世平迟疑了片刻，轻轻按下了0。音乐缓缓流淌出来，那一刻，他泪流满面。现代人的孤独，原来真的只需要一个耐心的倾听者。""",
        "r1_trans": [
            "Giang Thế Bình ngồi cô độc một mình trong căn hộ trống trải vắng tanh, bốn bề tĩnh lặng đến mức nghe rõ cả tiếng tim mình đập.",
            "Anh nhấc ống nghe điện thoại, bấm số hỏi giờ bay của hãng hàng không. Từ đầu dây bên kia vang lên giọng nữ thu âm máy tính dịu dàng, ngọt ngào: 'Cảm ơn quý khách đã gọi đến Hãng hàng không Hoa Đông. Nếu quý khách muốn biết giờ máy bay hạ cánh hôm nay, xin hãy bấm phím 403; nếu quý khách muốn biết số hiệu chuyến bay cất cánh, xin hãy bấm phím 228...'",
            "Thế Bình ngoan ngoãn bấm các nút theo chỉ dẫn. Trong chốn đô thị hiện đại tràn ngập công nghệ tiên tiến này, những cuộc trò chuyện trực tiếp giữa con người với con người ngày càng thưa thớt, thay vào đó là những hệ thống lập trình giọng nói máy tính lạnh lùng nhưng khách sáo.",
            "Trong vô thức, anh bấm nhầm sang một dãy số khác. Trong ống nghe bỗng nhiên phát ra một hệ thống ghi âm kỳ lạ: 'Cảm ơn bạn đã gọi đến nhà họ Dư. Nếu bạn muốn tìm Dư Nhân Bang, xin bấm phím 1; nếu bạn muốn tìm Dư Nhân Lạc, xin bấm phím 2; nếu bạn đã bấm nhầm số, xin bấm phím 3.'",
            "Thế Bình cảm thấy tò mò, liền nhấn phím 3. Giọng nói kia lại tiếp tục: 'Bạn liên tục bấm nhầm số mà vẫn sẵn lòng dành thời gian lắng nghe tiếp, chứng tỏ bạn là một con người đang rất cô đơn. Nếu tôi nói đúng, xin hãy bấm phím 4; nếu tôi nói sai, xin bấm phím 5.'",
            "Thế Bình cười cay đắng một tiếng, rồi ấn phím 4.",
            "'Quả nhiên bạn đang cảm thấy cô đơn. Bạn có muốn tìm ai đó tâm sự không? Nếu bạn muốn nói về thời tiết hôm nay, xin bấm phím 6; nếu muốn đàm đạo tình hình Trung Đông, xin bấm phím 7; nếu muốn thưởng thức một khúc nhạc cổ điển, xin bấm phím 8; nếu bạn chỉ đơn thuần muốn một giọng nói bầu bạn bên cạnh, xin hãy bấm phím 0.'",
            "Thế Bình ngập ngừng trong giây lát, rồi khẽ khàng bấm phím 0. Khúc nhạc êm dịu chầm chậm vang lên, vào khoảnh khắc ấy, nước mắt anh bỗng lăn dài trên má. Sự cô độc của con người thời hiện đại, hóa ra đôi khi chỉ cần một người kiên nhẫn lắng nghe."
        ],
        "r2_title": "Đọc thêm: 心爱的 (Vật thân yêu - Khổ Linh)",
        "r2_text": """一直不知道他是怎么爱上她的。
直到有一天，他来到她狭小陈旧的屋子里。屋里收拾得井井有条，桌上摆着一只掉漆的小闹钟，柜子里放着缝补过多次的旧围巾。
她有些不好意思地说：“这些都是我从小到大的心爱之物，虽然不值钱，但我舍不得丢。”
他凝视着她温柔平静的脸庞，忽然明白了：一个懂得珍惜旧物、对微不足道的小东西都充满深情的人，她的内心必定是极其善良与忠诚的。在物欲横流的时代，能守住一颗温柔眷恋的心，是多么难能可贵。""",
        "r2_trans": [
            "Anh trước giờ vẫn không hiểu rốt cuộc mình đã yêu cô ấy từ lúc nào và vì lẽ gì.",
            "Cho đến một ngày, anh bước vào căn phòng nhỏ bé và có phần cũ kỹ của cô. Căn phòng được dọn dẹp vô cùng ngăn nắp, trên bàn đặt chiếc đồng hồ báo thức nhỏ đã bong tróc lớp sơn, trong tủ là chiếc khăn choàng cũ đã được khâu vá lại nhiều lần.",
            "Cô hơi ngượng ngùng bảo: 'Mấy thứ này đều là những vật thân yêu gắn bó với em từ nhỏ đến lớn, dẫu chẳng đáng bao tiền nhưng em không nỡ vứt đi.'",
            "Anh ngắm nhìn khuôn mặt dịu dàng, bình thản của cô, bỗng nhiên vỡ lẽ: Một người biết trân trọng những kỷ vật xưa cũ, giàu lòng yêu thương với cả những điều nhỏ bé bình dị nhất, ắt hẳn tâm hồn cô ấy phải vô cùng lương thiện và thủy chung. Giữa thời đại vật chất xô bồ, giữ trọn được một tấm lòng son sắt tha thiết ấy đáng quý biết bao."
        ],
        "words": [
            {"hz": "致电", "py": "zhìdiàn", "type": "【动】", "mean": "TRÍ ĐIỆN (gọi điện thoại tới)", "examples": ["～航空公司 / 致电问候"]},
            {"hz": "抵港", "py": "dǐgǎng", "type": "【动】", "mean": "ĐỂ CẢNG (cập cảng, hạ cánh sân bay)", "examples": ["航班～ / 轮船抵港"]},
            {"hz": "寂寞", "py": "jìmò", "type": "【形】", "mean": "TỊCH MỊCH (cô đơn, quạnh quẽ)", "examples": ["感到～ / 耐得住寂寞"]},
            {"hz": "倾诉", "py": "qīngsù", "type": "【动】", "mean": "KHUYNH TỐ (giãi bày, trút bầu tâm sự)", "examples": ["向朋友～ / 倾诉衷肠"]},
            {"hz": "题材", "py": "tícái", "type": "【名】", "mean": "ĐỀ TÀI (đề tài, chủ đề sáng tác)", "examples": ["写作～ / 现实题材"]},
            {"hz": "迟疑", "py": "chíyí", "type": "【动】", "mean": "TRÌ NGHI (ngập ngừng, do dự)", "examples": ["毫不～ / 迟疑了片刻"]},
            {"hz": "流淌", "py": "liútǎng", "type": "【动】", "mean": "LƯU THẢNG (chảy róc rách, tuôn trào)", "examples": ["河水～ / 音乐流淌"]},
            {"hz": "井井有条", "py": "jǐngjǐng-yǒutiáo", "type": "【成语】", "mean": "TỈNH TỈNH HỮU ĐIỀU (ngăn nắp, trật tự rõ ràng)", "examples": ["把房间整理得～"]},
            {"hz": "难能可贵", "py": "nánnéng-kěguì", "type": "【成语】", "mean": "NAN NĂNG KHẢ QUÝ (đáng khen ngợi, quý giá vô ngần)", "examples": ["这种精神实属～。"]}
        ],
        "grammar": [
            {
                "point": "谈不上 (Không thể nói là / Chưa hẳn đã là)",
                "pinyin": "tán bu shàng",
                "structure": "谈不上 + [Danh từ / Tính từ / Cụm động từ]",
                "explanation": "Khẩu ngữ biểu thị mức độ chưa đạt tới hoặc chưa đủ điều kiện để gọi là như vậy. Tương đương với 'chưa tới mức...'.",
                "examples": [
                    {"zh": "我们俩只是普通同事，谈不上有多深厚的交情。", "pinyin": "Wǒmen liǎ zhǐshì pǔtōng tóngshì, tán bu shàng yǒu duō shēnhòu de jiāoqíng.", "vi": "Hai chúng tôi chỉ là đồng nghiệp bình thường, chưa thể nói là có mối giao tình sâu đậm."},
                    {"zh": "这点小伤谈不上严重，休息两天就好。", "pinyin": "Zhè diǎn xiǎoshāng tán bu shàng yánzhòng, xiūxi liǎng tiān jiù hǎo.", "vi": "Chút vết thương nhỏ này không thể xem là nghiêm trọng, nghỉ ngơi hai hôm là khỏi."}
                ]
            },
            {
                "point": "不是……就是…… (Không phải... thì là...)",
                "pinyin": "búshì... jiùshì...",
                "structure": "不是 + [Lựa chọn A] + 就是 + [Lựa chọn B]",
                "explanation": "Dùng để biểu thị quan hệ lựa chọn loại trừ nhau, ngụ ý ngoài hai trường hợp này ra thì không còn khả năng nào khác.",
                "examples": [
                    {"zh": "周末他不是在图书馆看书，就是在实验室做实验。", "pinyin": "Zhōumò tā búshì zài túshūguǎn kànshū, jiùshì zài shíyànshì zuò shíyàn.", "vi": "Cuối tuần anh ấy không ở thư viện đọc sách thì cũng là ở phòng thí nghiệm làm nghiên cứu."}
                ]
            }
        ]
    },

    # Lesson 3
    {
        "lesson_num": 3,
        "title": "一诺千金",
        "r1_title": "Bài khóa chính: 一诺千金 (Một lời ngàn vàng - Tần Văn Quân)",
        "r1_text": """古人常说“一诺千金”，意思是说一句诺言比千两黄金还要贵重。在现代社会中，讲究信用依然是做人立身之本。
小学时，我有一个同班同学，家里极度贫困。有一年冬天，他的母亲突发重病，急需五元钱买药。在那个年代，五元钱对小孩子来说是个天文数字。他挨家挨户去借，可大家都不富裕。
最后他红着脸找到我，嗫嚅着向我借两元钱，并郑重承诺：“下个月初五之前，我一定还你，哪怕去捡废铁也绝不食言。”
看着他真诚焦急的眼神，我把积攒了半年的压岁钱递给了他。
一个月很快过去了。到了初五那天，天空刮起了凛冽的暴风雪，气温降到零下十几度。我心想：“天气这么恶劣，他肯定不会来了，再说两块钱不还也就算了。”
然而傍晚时分，门外响起了微弱的敲门声。我打开门，只见他浑身裹满积雪，脸颊冻得青紫，双手生满了冻疮。他小心翼翼地从怀里掏出一叠皱巴巴、还带着体温的纸币和硬币——不多不少，正好两元钱。
那一瞬间，我被深深震撼了。在刺骨的寒冬里，他用稚嫩的肩膀，扛起了一份重若千钧的诺言。""",
        "r1_trans": [
            "Người xưa thường nói 'Một lời ngàn vàng', ý muốn nói một lời hứa còn quý giá hơn cả ngàn lạng vàng. Trong xã hội hiện đại ngày nay, giữ gìn chữ tín vẫn là nền tảng cốt lõi để làm người và lập thân.",
            "Thời tiểu học, tôi có một cậu bạn cùng lớp, hoàn cảnh gia đình vô cùng nghèo túng. Một năm nọ vào mùa đông, mẹ cậu ấy đột ngột trở bệnh nặng, rất cần năm đồng tiền để mua thuốc. Vào thời kỳ đó, năm đồng bạc đối với lũ trẻ con là một con số khổng lồ trên trời. Cậu ấy đi gõ cửa từng nhà để vay mượn, nhưng xóm giềng ai nấy đều túng thiếu.",
            "Cuối cùng, cậu ấy đỏ mặt tìm đến tôi, ấp úng hỏi vay hai đồng, rồi trịnh trọng hứa hẹn: 'Trước mùng năm tháng sau, tớ nhất định sẽ trả lại cậu, dù có phải đi nhặt sắt vụn tớ cũng tuyệt đối không nuốt lời.'",
            "Nhìn ánh mắt chân thành và khẩn thiết của bạn, tôi liền đưa số tiền mừng tuổi chắt chiu suốt nửa năm cho cậu ấy.",
            "Một tháng trôi qua thật nhanh. Đến ngày mùng năm, trời nổi trận bão tuyết gầm rú dữ dội, nhiệt độ hạ xuống âm mười mấy độ. Tôi thầm nghĩ: 'Thời tiết khắc nghiệt thế này, cậu ấy chắc chắn không đến đâu, vả lại hai đồng bạc ấy không trả thì thôi cũng chẳng sao.'",
            "Thế nhưng khi hoàng hôn buông xuống, ngoài cửa bỗng vang lên tiếng gõ cửa khe khẽ. Tôi mở cửa ra, chỉ thấy cậu ấy toàn thân phủ kín tuyết trắng, đôi má cóng lại tím tái, đôi bàn tay nứt nẻ đầy vết cước mùa đông. Cậu ấy cẩn thận móc từ trong vạt áo ấm ra một xấp tiền giấy và tiền xu nhàu nhĩ còn vương hơi ấm cơ thể—không thừa không thiếu, tròn đúng hai đồng bạc.",
            "Khoảnh khắc ấy, tôi vô cùng chấn động. Giữa mùa đông giá buốt thấu xương, cậu bạn ấy đã dùng đôi vai non nớt của mình để gánh vác trọn vẹn một lời hứa nặng tựa ngàn cân."
        ],
        "r2_title": "Đọc thêm: 金大班的最后一夜 (Đêm cuối cùng của Kim Đại Ban - Bạch Tiên Dũng)",
        "r2_text": """夜巴黎舞厅的霓虹灯在细雨中闪烁着迷离的光彩。金大班站在穿衣镜前，最后一次整理着自己华丽的旗袍。
二十年的舞卫生涯，阅尽了人世间的浮华与苍凉。今夜过后，她就要洗尽铅华，告别这纸醉金迷的红尘，嫁作商人妇。
回头望去，舞池中旋转的红男绿女，那些曾经的山盟海誓，终究化为了过眼云烟。唯有心中的尊严与傲骨，陪伴她度过了这漫长的岁月风尘。""",
        "r2_trans": [
            "Ánh đèn neon của vũ trường Dạ Ba Lê lấp lánh sắc màu mông lung huyền ảo giữa làn mưa phùn buốt giá. Kim Đại Ban đứng trước tấm gương lớn soi cả người, lần cuối cùng chỉnh trang lại tà áo sườn xám lộng lẫy kiêu sa.",
            "Hai mươi năm cuộc đời vũ nữ, bà đã nếm trải đủ mọi vinh hoa lẫn cay đắng lạnh lùng của nhân thế. Sau đêm nay, bà sẽ rũ bỏ son phấn xa hoa, từ biệt chốn hồng trần trụy lạc say đắm này để bước lên kiệu hoa làm vợ thương nhân.",
            "Quay đầu nhìn lại, những bóng tài tử giai nhân đang xoay vòng trên sàn khiêu vũ, những lời thề non hẹn biển năm nào, rốt cuộc cũng hóa thành mây khói thoảng qua. Chỉ có lòng kiêu hãnh và khí phách kiên cường trong tâm khảm là mãi kề bên bà suốt những năm tháng phong trần dằng dặc."
        ],
        "words": [
            {"hz": "诺言", "py": "nuòyán", "type": "【名】", "mean": "NẶC NGÔN (lời hứa, lời thề ước)", "examples": ["信守～ / 践行诺言"]},
            {"hz": "天文数字", "py": "tiānwén-shùzì", "type": "【成语】", "mean": "THIÊN VĂN SỐ TỰ (con số khổng lồ trên trời)", "examples": ["这是一笔～。"]},
            {"hz": "嗫嚅", "py": "nièrú", "type": "【动】", "mean": "NHIẾP NHU (ấp úng, ngập ngừng không nên lời)", "examples": ["～着说不出话来"]},
            {"hz": "郑重", "py": "zhèngzhòng", "type": "【形】", "mean": "TRỊNH TRỌNG (trịnh trọng, nghiêm túc)", "examples": ["～声明 / 郑重承诺"]},
            {"hz": "食言", "py": "shíyán", "type": "【动】", "mean": "THỰC NGÔN (nuốt lời, không giữ lời hứa)", "examples": ["绝不～ / 言而无信"]},
            {"hz": "凛冽", "py": "lǐnliè", "type": "【形】", "mean": "LẪM LIỆT (rét buốt, lạnh thấu xương)", "examples": ["寒风～ / 凛冽的冬天"]},
            {"hz": "冻疮", "py": "dòngchuāng", "type": "【名】", "mean": "ĐỐNG SANG (vết nứt nẻ, cước do lạnh)", "examples": ["生了～ / 手上长满冻疮"]},
            {"hz": "震撼", "py": "zhènhàn", "type": "【动】", "mean": "CHẤN HÁM (chấn động, rung động lòng người)", "examples": ["心灵受到极大～"]}
        ],
        "grammar": [
            {
                "point": "一诺千金 (Một lời hứa ngàn vàng)",
                "pinyin": "yí nuò qiān jīn",
                "structure": "一诺千金 (thành ngữ làm vị ngữ hoặc định ngữ)",
                "explanation": "Xuất phát từ điển cố Sử ký về Quý Bố. Miêu tả phẩm chất giữ gìn chữ tín kiên định, một khi đã nói ra lời hứa thì dẫu khó khăn nguy hiểm đến đâu cũng quyết tâm thực hiện.",
                "examples": [
                    {"zh": "做生意讲究一诺千金，才能赢得长久的信誉。", "pinyin": "Zuò shēngyì jiǎngjiu yí nuò qiān jīn, cáinéng yíngdé chángjiǔ de xìnyù.", "vi": "Kinh doanh coi trọng chữ tín ngàn vàng, có vậy mới giành được uy tín bền lâu."}
                ]
            },
            {
                "point": "哪怕 (Cho dù / Ngay cả khi)",
                "pinyin": "nǎpà",
                "structure": "哪怕 + [Tình huống giả định cực đoan] + 也 / 还 + [Kết quả không đổi]",
                "explanation": "Liên từ giả thiết nhượng bộ, biểu thị dù điều kiện có khó khăn, khắc nghiệt đến mức nào thì ý chí hoặc hành động vẫn không hề suy chuyển.",
                "examples": [
                    {"zh": "哪怕去捡废铁，我也绝不食言。", "pinyin": "Nǎpà qù jiǎn fèitiě, wǒ yě jué bù shíyán.", "vi": "Cho dù phải đi nhặt sắt vụn, tôi cũng tuyệt đối không bao giờ nuốt lời."}
                ]
            }
        ]
    },

    # Lesson 4
    {
        "lesson_num": 4,
        "title": "沙漠里的奇怪现象",
        "r1_title": "Bài khóa chính: 沙漠里的奇怪现象 (Hiện tượng kỳ lạ trong sa mạc - Trúc Khả Trinh)",
        "r1_text": """自古以来，浩瀚无垠的大沙漠给人们留下了神秘而又可怕的印象。古代行经丝绸之路的旅人，常常在沙漠中遇到一些匪夷所思的奇怪现象。
其一便是“海市蜃楼”。在烈日曝晒下的沙漠腹地，旅人极度干渴时，忽然望见前方波光粼粼，绿树成荫，宛如出现了一片清凉的大湖泊。然而当人们兴高采烈地奔上前去，湖泊却又悄然退向更远的远方，最终化为虚无。近代气象学告诉我们，这绝非鬼怪作祟，而是由于沙面受阳光强烈烘烤，下层空气密度小而上层密度大，光线发生全反射所形成的大气折射光学现象。
其二则是“鸣沙”。在某些沙丘上，当狂风吹过，或者成群游人从沙丘顶端向下滑行时，沙丘竟然会发出隆隆巨响，如雷鸣，如钟鼓，声闻数里。经科学考察，这是因为特殊的石英沙粒表面有许多微小的蜂窝状孔隙，摩擦碰撞时引起空气共鸣所致。
大自然的奇观虽然诡谲莫测，但只要运用科学的钥匙，就能解开一切蒙在未知之上的谜团。""",
        "r1_trans": [
            "Từ ngàn xưa đến nay, sa mạc mênh mông bạt ngàn luôn để lại trong tâm trí con người một ấn tượng vừa huyền bí vừa đáng sợ. Những thương nhân lữ thứ từng băng qua Con đường Tơ lụa cổ đại thường bắt gặp những hiện tượng kỳ lạ khôn lường giữa biển cát.",
            "Điều kỳ lạ thứ nhất chính là 'Ảo ảnh sa mạc' (Hải thị thận lâu). Giữa lòng sa mạc bị ánh nắng chang chang thiêu đốt, khi người đi đường đang khát cháy cổ họng, bỗng nhiên trông thấy phía trước mặt nước biếc gợn sóng lấp lánh, cây cỏ xanh tươi rợp bóng mát, hệt như hiện ra một hồ nước khổng lồ mát rượi. Thế nhưng khi người ta mừng rỡ chạy xô tới, hồ nước lại âm thầm lùi xa hơn, cuối cùng tan biến vào cõi hư vô. Khí tượng học hiện đại chỉ ra rằng đây hoàn toàn không phải ma quỷ tác oai tác quái, mà do bề mặt cát bị hun nóng dữ dội, lớp không khí bên dưới loãng hơn lớp không khí bên trên, khiến tia sáng phản xạ toàn phần tạo thành ảo ảnh quang học trong khí quyển.",
            "Điều kỳ lạ thứ hai là hiện tượng 'Cát biết hát' (Minh sa). Trên một số cồn cát đặc biệt, khi gió lớn thổi qua hoặc khi đoàn du khách trượt từ đỉnh cồn cát xuống, đồi cát bỗng phát ra những tiếng rền vang ầm ầm, tựa như sấm sét, như chuông trống, vang xa hàng mấy dặm. Qua khảo sát khoa học, đó là do bề mặt các hạt cát thạch anh có vô số lỗ rỗng nhỏ li ti hình tổ ong, khi cọ xát va đập vào nhau đã tạo nên hiện tượng cộng hưởng không khí phát ra âm thanh.",
            "Kỳ quan của tự nhiên dẫu có thiên biến vạn hóa bí hiểm đến đâu, nhưng chỉ cần cầm trong tay chiếc chìa khóa khoa học, chúng ta đều có thể mở toang mọi bức màn bí ẩn trùm lên vạn vật."
        ],
        "r2_title": "Đọc thêm: 海市蜃楼 (Ảo vọng biển hồ cát)",
        "r2_text": """不仅在沙漠，浩瀚的海面上也常常能看到神奇的海市蜃楼。古人传说蜃是一种巨大的大蛤蜊，它吐出的气息在海面上凝结成了楼阁城郭。
西方水手在远洋航行中，也常在极地冰海上看到倒悬的船只或飞在空中的冰山。科学证明，这全是因为温度反常导致空气密度产生剧烈梯度变化而引发的光学折射。理解了规律，幻象便化为了壮丽的自然诗篇。""",
        "r2_trans": [
            "Không chỉ ở sa mạc, trên mặt biển bao la sóng vỗ người ta cũng thường xuyên chiêm ngưỡng được ảo ảnh Hải thị thận lâu kỳ vĩ. Người xưa truyền tai nhau rằng 'thận' là một loài sò khổng lồ thời cổ đại, luồng hơi nó thở ra ngưng đọng trên mặt biển tạo thành lầu son gác tía và cổng thành nguy nga.",
            "Các thủy thủ phương Tây trong những chuyến hải hành viễn dương cũng thường bắt gặp những con tàu lộn ngược đầu xuống biển hoặc những tảng băng trôi lơ lửng trên không trung ở vùng biển băng bắc cực. Khoa học chứng minh rằng tất cả đều do nhiệt độ dị thường làm mật độ không khí biến đổi theo độ dốc lớn sinh ra hiện tượng khúc xạ ánh sáng. Khi đã thấu hiểu quy luật, ảo ảnh huyền bí liền biến thành những thi khúc thiên nhiên tráng lệ."
        ],
        "words": [
            {"hz": "浩瀚", "py": "hàohàn", "type": "【形】", "mean": "HẠO HÃN (mênh mông, bao la rộng lớn)", "examples": ["～的大海 / 浩瀚无垠"]},
            {"hz": "匪夷所思", "py": "fěiyí-suǒsī", "type": "【成语】", "mean": "PHỈ DI SỞ TƯ (kỳ lạ khác thường, không thể tưởng tượng nổi)", "examples": ["这种怪现象令人～。"]},
            {"hz": "海市蜃楼", "py": "hǎishì-shènlóu", "type": "【成语】", "mean": "HẢI THỊ THẬN LÂU (ảo ảnh nơi sa mạc/biển cả, ảo vọng xa vời)", "examples": ["一切繁华如～。"]},
            {"hz": "曝晒", "py": "pùshài", "type": "【动】", "mean": "BẠO SÁI (phơi nắng gay gắt, thiêu đốt)", "examples": ["在烈日下～"]},
            {"hz": "折射", "py": "zhéshè", "type": "【动/名】", "mean": "CHIẾT XẠ (khúc xạ ánh sáng; phản ánh)", "examples": ["光的～ / 折射出社会现实"]},
            {"hz": "孔隙", "py": "kǒngxì", "type": "【名】", "mean": "KHỔNG KHÍCH (lỗ hổng li ti, kẽ hở)", "examples": ["微小的～ / 岩石孔隙"]},
            {"hz": "诡谲", "py": "guǐjué", "type": "【形】", "mean": "QUỶ QUYỆT (quỷ quyệt, kỳ ảo biến hóa khôn lường)", "examples": ["风云～ / 诡谲多变"]}
        ],
        "grammar": [
            {
                "point": "究竟 (Rốt cuộc / Cuối cùng thì)",
                "pinyin": "jiūjìng",
                "structure": "究竟 + [Đại từ nghi vấn / Động từ]",
                "explanation": "Phó từ dùng trong câu hỏi hoặc phản vấn để truy cầu chân tướng bản chất sự việc, thể hiện sự tìm tòi thấu đáo.",
                "examples": [
                    {"zh": "沙漠里的奇怪现象究竟是怎么形成的？", "pinyin": "Shāmò lǐ de qíguài xiànxiàng jiūjìng shì zěnme xíngchéng de?", "vi": "Những hiện tượng kỳ lạ trong sa mạc rốt cuộc được hình thành như thế nào?"}
                ]
            }
        ]
    },

    # Lessons 5 to 10
    {
        "lesson_num": 5,
        "title": "内部招标",
        "r1_title": "Bài khóa chính: 内部招标 (Đấu thầu nội bộ)",
        "r1_text": """为了应对日益激烈的市场竞争，天宇集团做出了一个大胆的决定：对海外分公司总经理一职实行公开的“内部招标”。
消息一出，整个公司上下引起了轩然大波。过去这类重要中高层职位大多由董事会指派，如今实行竞标答辩，人人都有平等角逐的机会。
答辩会上，年轻的项目经理张航从容走上讲台。他没有空洞宣读豪言壮语，而是拿出一份详实的市场调研报告，客观剖析了海外业务的痛点与瓶颈，并提出了三年扭亏为盈的切实战略。
他的方案不仅征服了评审专家，更赢得了员工们的由衷掌声。这不仅是一场职位的竞争，更是一次现代企业管理理念的革新。""",
        "r1_trans": [
            "Để ứng phó với sự cạnh tranh thị trường ngày càng khốc liệt, Tập đoàn Thiên Vũ đã đưa ra một quyết định táo bạo: thực hiện 'đấu thầu nội bộ' công khai cho chức vụ Tổng giám đốc chi nhánh công ty tại nước ngoài.",
            "Thông tin vừa phát ra, toàn thể tập đoàn từ trên xuống dưới xôn xao bàn tán sôi nổi. Trước đây các vị trí lãnh đạo chủ chốt này hầu hết đều do Hội đồng quản trị chỉ định trực tiếp, nay mở cuộc tranh tài phản biện công khai, ai ai cũng có cơ hội cạnh tranh sòng phẳng.",
            "Tại buổi phản biện, giám đốc dự án trẻ tuổi Trương Hàng ung dung tự tin bước lên bục thuyết trình. Anh không đọc những lời đao to búa lớn sáo rỗng, mà trình bày một bản báo cáo khảo sát thị trường hết sức chi tiết, phân tích thấu đáo điểm nghẽn của mảng kinh doanh hải ngoại, đồng thời vạch ra chiến lược thiết thực biến lỗ thành lãi trong ba năm.",
            "Đề án của anh không chỉ chinh phục hoàn toàn hội đồng chuyên gia thẩm định, mà còn nhận được những tràng pháo tay nồng nhiệt từ toàn thể nhân viên. Đây không đơn thuần là cuộc chạy đua danh vị, mà là bước chuyển mình đổi mới trong tư duy quản trị doanh nghiệp hiện đại."
        ],
        "r2_title": "Đọc thêm: 竞争与合作 (Cạnh tranh và hợp tác)",
        "r2_text": """现代商业社会中，竞争与合作从来不是非此即彼的对立关系。
最优秀的企业家懂得，在竞争中激发潜能，在合作中实现共赢。“竞合”思维正逐渐取代零和博弈，成为推动产业良性发展的核心引擎。""",
        "r2_trans": [
            "Trong thương trường hiện đại, cạnh tranh và hợp tác chưa bao giờ là hai mặt đối lập loại trừ lẫn nhau.",
            "Những doanh nhân xuất sắc nhất hiểu rõ rằng: cạnh tranh giúp khơi dậy tiềm năng vô tận, còn hợp tác giúp hiện thực hóa lợi ích song phương cùng thắng. Tư duy 'vừa cạnh tranh vừa hợp tác' đang thay thế trò chơi có tổng bằng không để trở thành động cơ cốt lõi thúc đẩy toàn ngành phát triển lành mạnh."
        ],
        "words": [
            {"hz": "招标", "py": "zhāobiāo", "type": "【动】", "mean": "CHIÊU TIÊU (gọi thầu, mở thầu)", "examples": ["公开～ / 招标答辩"]},
            {"hz": "轩然大波", "py": "xuānrán-dàbō", "type": "【成语】", "mean": "HIÊN NHIÊN ĐẠI BA (sóng to gió lớn, xôn xao bàn tán)", "examples": ["引起了一场～。"]},
            {"hz": "剖析", "py": "pōuxī", "type": "【动】", "mean": "PHẨU TÍCH (mổ xẻ, phân tích sâu sắc)", "examples": ["深入～问题根源"]},
            {"hz": "瓶颈", "py": "píngjǐng", "type": "【名】", "mean": "BÌNH CẢNH (cổ chai, nút thắt trở ngại)", "examples": ["打破发展～ / 遭遇瓶颈"]}
        ],
        "grammar": [
            {
                "point": "进而 (Tiến tới / Từ đó phát triển thêm)",
                "pinyin": "jìn'ér",
                "structure": "Hành động A, 进而 + Hành động B (bước phát triển sâu hơn)",
                "explanation": "Liên từ biểu thị bước phát triển tiếp theo sau một hành động hoặc kết quả ban đầu, mức độ đi sâu hơn.",
                "examples": [
                    {"zh": "我们先要理顺流程，进而提高整体工作效率。", "pinyin": "Wǒmen xiān yào lǐshùn liúchéng, jìn'ér tígāo zhěngtǐ gōngzuò xiàolǜ.", "vi": "Chúng ta trước hết phải sắp xếp trơn tru quy trình, tiến tới nâng cao hiệu suất làm việc tổng thể."}
                ]
            }
        ]
    },

    # Lesson 6
    {
        "lesson_num": 6,
        "title": "天才梦",
        "r1_title": "Bài khóa chính: 天才梦 (Giấc mộng thiên tài - Trương Ái Linh)",
        "r1_text": """我是一个古怪的女孩，从小便做着天才的梦。
七岁时我写了第一部家庭悲剧小说，九岁时发表了第一篇散文，被亲戚邻里视为奇迹。我沉浸在文字与色彩斑斓的艺术幻境里，以为自己无所不能。
然而在现实生活的琐事中，我却笨拙得近乎低能。我不会削苹果，不会扣扣子，甚至分不清钞票的真伪。在学校里，我连最简单的体育动作也做不好，处处碰壁。
世人往往只看见天才头顶上的光环，却不知现实的冷风有多么刺骨。在文字里我是君王，在尘世里我是个笨拙的孩子。
最后我终于领悟到：生命是一袭华美的袍，上面爬满了蚤子。""",
        "r1_trans": [
            "Tôi là một cô gái kỳ quặc, từ thuở ấu thơ đã luôn ôm ấp giấc mộng thiên tài.",
            "Lên bảy tuổi, tôi đã viết xong cuốn tiểu thuyết bi kịch gia đình đầu tay, chín tuổi đã cho đăng bài tản văn đầu tiên, được họ hàng láng giềng coi như một kỳ tích lạ lùng. Tôi đắm chìm trong thế giới huyễn hoặc rực rỡ của văn từ và sắc màu, ngỡ rằng bản thân mình không gì là không làm được.",
            "Thế nhưng trước những việc vụn vặt của cuộc sống đời thực, tôi lại vụng về đến mức gần như đần độn. Tôi không biết gọt vỏ quả táo, chẳng biết cài khuy áo, thậm chí còn không phân biệt nổi tiền thật tiền giả. Ở trường học, ngay cả những động tác thể dục đơn giản nhất tôi cũng chẳng làm ra hồn, đâu đâu cũng va vấp đụng tường.",
            "Người đời thường chỉ nhìn thấy vầng hào quang rực rỡ trên đỉnh đầu thiên tài, mà đâu hay những cơn gió lạnh của cõi trần gian buốt giá dường nào. Trong thế giới câu chữ, tôi là đấng quân vương ngự trị; nhưng giữa cõi hồng trần, tôi chỉ là đứa trẻ ngô nghê vụng về.",
            "Cuối cùng tôi cũng thấm thía ngộ ra một chân lý cuộc đời: Sinh mệnh tựa như một chiếc áo gấm lộng lẫy xa hoa, nhưng bên trên lại bò lúc nhúc đầy những con bọ chét."
        ],
        "r2_title": "Đọc thêm: 天才的秘密 (Bí mật của thiên tài)",
        "r2_text": """爱迪生曾说：“天才是百分之一的灵感，加上百分之九十九的汗水。”
世间所谓的天才，不过是把别人用来喝咖啡的时间，全部倾注在了自己热爱的追求上。敏锐的直觉固然重要，但长年累月的坚持才是点燃才华的不灭薪火。""",
        "r2_trans": [
            "Edison từng đúc kết: 'Thiên tài là một phần trăm cảm hứng cộng với chín mươi chín phần trăm mồ hôi nước mắt.'",
            "Cái gọi là thiên tài trên thế gian này, chẳng qua là đem khoảng thời gian người khác nhâm nhi cà phê để dồn hết vào niềm đam mê mà mình theo đuổi. Trực giác nhạy bén dĩ nhiên quan trọng, nhưng sự kiên trì bền bỉ năm này qua tháng khác mới chính là ngọn lửa vĩnh cửu thắp sáng tài năng."
        ],
        "words": [
            {"hz": "斑斓", "py": "bānlán", "type": "【形】", "mean": "BAN LAN (rực rỡ, sặc sỡ muôn màu)", "examples": ["色彩～ / 斑斓的世界"]},
            {"hz": "笨拙", "py": "bènzhuō", "type": "【形】", "mean": "VỤNG CHUYẾT (vụng về, chậm chạp)", "examples": ["动作～ / 手脚笨拙"]},
            {"hz": "光环", "py": "guānghuán", "type": "【名】", "mean": "QUANG HOÀN (vầng hào quang, vinh quang)", "examples": ["褪去～ / 头顶的光环"]},
            {"hz": "华美", "py": "huáměi", "type": "【形】", "mean": "HOA MỸ (hoa lệ, đẹp đẽ lộng lẫy)", "examples": ["～的服饰 / 辞藻华美"]}
        ],
        "grammar": [
            {
                "point": "被视为 (Được xem như / Được coi là)",
                "pinyin": "bèi shì wéi",
                "structure": "Chủ ngữ + 被视为 + [Thành phần đánh giá, danh vị]",
                "explanation": "Cụm vị ngữ bị động trong văn viết biểu thị một người hoặc sự vật được công chúng hay giới chuyên môn công nhận, đánh giá theo một vị thế nhất định.",
                "examples": [
                    {"zh": "这部作品被视为现代文学史上的里程碑。", "pinyin": "Zhè bù zuòpǐn bèi shì wéi xiàndài wénxué shǐ shàng de lǐchéngbēi.", "vi": "Tác phẩm này được xem như một cột mốc lịch sử trong nền văn học hiện đại."}
                ]
            }
        ]
    },

    # Lesson 7
    {
        "lesson_num": 7,
        "title": "人",
        "r1_title": "Bài khóa chính: 人 (Con người - Kha Linh)",
        "r1_text": """“人”字只有简简单单的两笔：一撇一捺。
然而，要写好这两笔，却需要一个人穷尽一生的光阴去修行。
那一撇，是我们的过去，是祖先传承下来的血脉、文化与记忆；那一捺，是我们的未来，是对理想、正义与光明的执着追求。两笔相互倾斜，又相互支撑，缺了任何一笔，人都无法巍然挺立在天地之间。
做人，贵在顶天立地，坦坦荡荡。无论风吹雨打，都能站得稳，行得正，这才配得上这个大写的“人”字。""",
        "r1_trans": [
            "Chữ 'Nhân' (人) chỉ có hai nét giản dị vô cùng: một nét phẩy, một nét mác.",
            "Thế nhưng, để viết cho trọn vẹn và đẹp đẽ hai nét chữ ấy, một con người phải tiêu tốn cả một đời để tu dưỡng và tôi luyện.",
            "Nét phẩy kia chính là quá khứ của chúng ta, là dòng máu, nền văn hóa và ký ức được tổ tiên trao truyền; còn nét mác này lại là tương lai, là niềm khát khao kiên định hướng tới lý tưởng, công lý và ánh sáng. Hai nét nghiêng tựa vào nhau, nâng đỡ cho nhau, thiếu đi bất kỳ một nét nào thì con người cũng không thể nào sừng sững hiên ngang đứng vững giữa trời đất bao la.",
            "Làm người, điều quý giá nhất là đội trời đạp đất, đường hoàng quang minh chính đại. Dẫu cho mưa dập gió vùi, vẫn đứng vững vàng, bước đi ngay thẳng, đó mới xứng đáng với hai chữ CON NGƯỜI viết hoa."
        ],
        "r2_title": "Đọc thêm: 生命的高度 (Độ cao của sinh mệnh)",
        "r2_text": """人生的价值不在于生命的长度，而在于生命的高度与厚度。
那些在历史长河中熠熠生辉的名字，并非因为他们活了多久，而是因为他们在有限的岁月里，为人类的福祉做出了卓越的奉献。""",
        "r2_trans": [
            "Giá trị của đời người không nằm ở độ dài năm tháng, mà nằm ở độ cao và độ dày của sinh mệnh.",
            "Những cái tên tỏa sáng rực rỡ giữa dòng sông dài lịch sử không phải vì họ sống thọ bao nhiêu năm, mà bởi vì trong những năm tháng hữu hạn của kiếp người, họ đã cống hiến những điều phi phàm cho phúc lợi của nhân loại."
        ],
        "words": [
            {"hz": "支撑", "py": "zhīchēng", "type": "【动】", "mean": "CHI XƯNG (chống đỡ, làm chỗ dựa)", "examples": ["相互～ / 勉强支撑"]},
            {"hz": "挺立", "py": "tǐnglì", "type": "【动】", "mean": "ĐĨNH LẬP (đứng sừng sững, hiên ngang)", "examples": ["～在风雪中 / 傲然挺立"]},
            {"hz": "顶天立地", "py": "dǐngtiān-lìdì", "type": "【成语】", "mean": "ĐÍNH THIÊN LẬP ĐỊA (đội trời đạp đất, hiên ngang)", "examples": ["做一个～的汉子。"]}
        ],
        "grammar": [
            {
                "point": "比起 (So với)",
                "pinyin": "bǐ qǐ",
                "structure": "比起 + Danh từ A, Danh từ B + 更 / 更加...",
                "explanation": "Dùng ở đầu câu hoặc vế câu để đưa ra đối tượng so sánh, làm nổi bật tính chất hoặc đặc điểm của đối tượng thứ hai.",
                "examples": [
                    {"zh": "比起物质财富，内心的安宁更加珍贵。", "pinyin": "Bǐ qǐ wùzhì cáifù, nèixīn de ānníng gèngjiā zhēnguì.", "vi": "So với của cải vật chất, sự thanh thản trong tâm hồn còn quý giá hơn nhiều."}
                ]
            }
        ]
    },

    # Lesson 8
    {
        "lesson_num": 8,
        "title": "随感二则",
        "r1_title": "Bài khóa chính: 随感二则 (Hai bài tùy cảm)",
        "r1_text": """【其一：关于独处】
许多人害怕独处，以为独处就是孤寂与凄凉。其实，独处是灵魂与自我的深情对话。在熙熙攘攘的人群中，我们常常身不由己地戴上面具；唯有在静谧的独处时光里，心海才得以沉淀，照见真实的自己。
【其二：关于舍得】
古语云：“有舍才有得。”人生就像一个行囊，容量终究是有限的。如果一味贪婪地往里装满名利与欲望，最终只会被沉重的负担压垮。学会适时地放下，才能轻装前行，领略沿途更辽阔的风光。""",
        "r1_trans": [
            "【Bài 1: Bàn về việc ở một mình】\nRất nhiều người sợ cảm giác một mình, cho rằng ở một mình đồng nghĩa với cô đơn quạnh quẽ và buồn bã. Kỳ thực, ở một mình chính là cuộc trò chuyện sâu lắng và tha thiết nhất giữa tâm hồn với chính bản ngã. Giữa đám đông ồn ã xô bồ, chúng ta thường bất đắc dĩ phải đeo lên những chiếc mặt nạ; chỉ trong những khoảnh khắc thanh tịnh ở một mình, mặt biển lòng mới có dịp lắng đọng, soi chiếu tỏ tường con người thật của chính ta.",
            "【Bài 2: Bàn về buông bỏ để nhận lại】\nNgười xưa dạy: 'Có buông bỏ mới có nhận lại.' Cuộc đời tựa như một chiếc tay nải hành trang, sức chứa rốt cuộc cũng có giới hạn. Nếu cứ mù quáng tham lam nhét đầy vào đó những danh lợi và dục vọng tầm thường, cuối cùng ta sẽ chỉ bị đè bẹp dưới gánh nặng ngút ngàn. Biết buông bỏ đúng lúc, ta mới có thể thong thả nhẹ bước tiến về phía trước để thưởng ngoạn phong cảnh khoáng đạt bao la dọc đường."
        ],
        "r2_title": "Đọc thêm: 平淡的生活 (Cuộc sống bình dị)",
        "r2_text": """轰轰烈烈的激情终会归于平淡，平平淡淡才是生活的本来面目。
一箪食，一瓢饮，家人围坐，灯火可亲。在这纷扰的红尘中，守住一份内心的宁静与祥和，便是人生最大的幸福。""",
        "r2_trans": [
            "Những niềm đam mê cuồng nhiệt ồn ào rồi cũng sẽ trở về với bình lặng, và bình dị phẳng lặng mới chính là diện mạo thực sự của cuộc sống.",
            "Một bữa cơm đạm bạc, một ngụm nước trong veo, cả gia đình quây quần sum họp, ánh đèn ấm áp dịu dàng. Giữa cõi hồng trần xao động náo nhiệt này, gìn giữ được một khoảng bình yên thanh thản nơi đáy lòng, đó chính là hạnh phúc lớn lao nhất của kiếp nhân sinh."
        ],
        "words": [
            {"hz": "独处", "py": "dúchǔ", "type": "【动】", "mean": "ĐỘC XỨ (ở một mình, tĩnh lặng)", "examples": ["学会～ / 享受独处时光"]},
            {"hz": "熙熙攘攘", "py": "xīxī-rǎngrǎng", "type": "【成语】", "mean": "HI HI NHƯỠNG NHƯỠNG (đông đúc náo nhiệt, người qua kẻ lại nườm nượp)", "examples": ["街道上～"]},
            {"hz": "行囊", "py": "xíngnáng", "type": "【名】", "mean": "HÀNH NANG (tay nải hành lý, hành trang)", "examples": ["背起～ / 沉重的行囊"]},
            {"hz": "轻装", "py": "qīngzhuāng", "type": "【形/动】", "mean": "KHINH TRANG (hành trang gọn nhẹ)", "examples": ["～前行 / 轻装上阵"]}
        ],
        "grammar": [
            {
                "point": "唯有……才…… (Chỉ có... mới...)",
                "pinyin": "wéiyǒu... cái...",
                "structure": "唯有 + [Điều kiện duy nhất] + 才 + [Kết quả]",
                "explanation": "Cấu trúc biểu thị điều kiện duy nhất trong văn viết, mang sắc thái trang trọng, nhấn mạnh chỉ khi thỏa mãn điều kiện này thì mới đạt được kết quả.",
                "examples": [
                    {"zh": "唯有坚持不懈，才能登上科学的顶峰。", "pinyin": "Wéiyǒu jiānchí bú xiè, cáinéng dēng shàng kēxué de dǐngfēng.", "vi": "Chỉ có kiên trì không ngừng nghỉ, người ta mới có thể bước lên đỉnh cao khoa học."}
                ]
            }
        ]
    },

    # Lesson 9
    {
        "lesson_num": 9,
        "title": "人生就是与困境周旋",
        "r1_title": "Bài khóa chính: 人生就是与困境周旋 (Đời người là chu toàn trong nghịch cảnh)",
        "r1_text": """人的一生，不可能永远一帆风顺。困难与挫折，往往如影随形。
所谓“周旋”，并不是消极地退缩或妥协，而是一种充满韧性与智慧的生存哲学。面对风浪，既不盲目硬碰硬，也不轻易放弃理想，而是在逆境中审时度势，积蓄力量，寻找转机。
古往今来，凡成大事业者，无一不是在泥泞与荆棘中一路周旋出来的。困境如同一块试金石，它淘汰了怯懦与懈怠，却淬炼出坚不可摧的钢铁意志。""",
        "r1_trans": [
            "Cả một đời người, không ai có thể mãi mãi thuận buồm xuôi gió. Khó khăn và trắc trở muôn trùng thường quấn quýt bên ta như hình với bóng.",
            "Cái gọi là 'chu toàn ứng phó' hoàn toàn không phải là sự thoái lui tiêu cực hay thỏa hiệp đầu hàng, mà là một triết lý sinh tồn chứa chan sự dẻo dai và trí tuệ mẫn tiệp. Đứng trước sóng to gió lớn, người bản lĩnh không bao giờ mù quáng đâm đầu vào đá, cũng không dễ dàng vứt bỏ lý tưởng cao đẹp, mà biết liệu thế nhìn thời, tích lũy nội lực kiên cường để đón chờ thời cơ chuyển mình bứt phá.",
            "Từ xưa đến nay, phàm là những bậc làm nên sự nghiệp lớn lao, không một ai là không từ trong bùn lầy gai góc mà bền bỉ chu toàn vượt lên. Nghịch cảnh tựa như hòn đá thử vàng, nó đào thải những kẻ hèn nhát lười biếng, nhưng lại tôi luyện nên những ý chí sắt đá kiên cường bất khả chiến bại."
        ],
        "r2_title": "Đọc thêm: 逆风飞翔 (Bay ngược chiều gió)",
        "r2_text": """风平浪静时，鸟儿只能随风滑翔；唯有逆风飞翔，才能展翅搏击长空。
困境并不可怕，可怕的是失去面对困境的勇气。把苦难当成向上的阶梯，生命才能绽放出最璀璨的光芒。""",
        "r2_trans": [
            "Khi sóng yên biển lặng, cánh chim chỉ có thể lướt theo chiều gió nhẹ; duy chỉ khi bay ngược chiều gió bão, chim ưng mới có thể sải cánh kiêu hãnh tung hoành giữa trời cao biển rộng.",
            "Nghịch cảnh không hề đáng sợ, điều đáng sợ nhất chính là đánh mất đi dũng khí đối mặt với nghịch cảnh. Coi khổ nạn như những bậc thang tiến bước, sinh mệnh ta mới có thể bừng nở những tia sáng rực rỡ huy hoàng nhất."
        ],
        "words": [
            {"hz": "周旋", "py": "zhōuxuán", "type": "【动】", "mean": "CHU TOÀN (xoay xở, ứng phó, giao tiếp khéo léo)", "examples": ["与敌人～ / 在困境中周旋"]},
            {"hz": "韧性", "py": "rènxìng", "type": "【名】", "mean": "NHẪN TÍNH (tính dẻo dai, bền bỉ kiên cường)", "examples": ["极强的～ / 充满韧性"]},
            {"hz": "审时度势", "py": "shěnshí-duòshì", "type": "【成语】", "mean": "THẨM THỜI ĐỘ THẾ (xét thời đoán thế, nắm bắt thời thế)", "examples": ["我们要～，做出正确抉择。"]},
            {"hz": "试金石", "py": "shìjīnshí", "type": "【名】", "mean": "THÍ KIM THẠCH (hòn đá thử vàng, thước đo chuẩn xác)", "examples": ["实践是检验真理的～。"]}
        ],
        "grammar": [
            {
                "point": "动辄 (Động một tí là / Hở ra là)",
                "pinyin": "dòngzhé",
                "structure": "动辄 + [Động từ / Cụm động từ tiêu cực]",
                "explanation": "Phó từ biểu thị một hành vi hoặc hiện tượng không mong muốn rất dễ xảy ra, mang ngữ khí phê phán hoặc không hài lòng.",
                "examples": [
                    {"zh": "遇到一点小挫折，切不可动辄抱怨放弃。", "pinyin": "Yù dào yìdiǎn xiǎo cuòzhé, qiè bù kě dòngzhé bàoyuàn fàngqì.", "vi": "Gặp chút trắc trở nhỏ, tuyệt đối không được hở một tí là than vãn bỏ cuộc."}
                ]
            }
        ]
    },

    # Lesson 10
    {
        "lesson_num": 10,
        "title": "我反对克隆人",
        "r1_title": "Bài khóa chính: 我反对克隆人 (Tôi phản đối nhân bản vô tính người)",
        "r1_text": """克隆技术的诞生，无疑是现代生命科学史上的一座重大丰碑。从克隆羊多莉的面世，到医学治疗性克隆的发展，科技展现了其惊人的力量。
然而，当某些狂热分子试图将这一技术应用于人类自身、制造所谓的“克隆人”时，我必须站出来坚决反对。
人不仅仅是一堆基因和细胞的机械复制品。每个人都是独一无二的生命奇迹，拥有独立的尊严、情感与伦理定位。如果克隆人出现，传统的家庭伦理、亲属关系、社会秩序将被彻底摧毁，甚至可能沦为特权阶层的器官供体或劳作工具。
科学必须受到伦理道德的约束。失去人性的科技，不是人类的福祉，而是毁灭文明的灾难。""",
        "r1_trans": [
            "Sự ra đời của công nghệ nhân bản vô tính không còn nghi ngờ gì nữa, chính là một tượng đài lịch sử vĩ đại trong ngành khoa học sự sống hiện đại. Từ sự xuất hiện của chú cừu Dolly đến những bước tiến trong nhân bản tế bào trị liệu y học, khoa học công nghệ đã thể hiện sức mạnh phi thường kinh ngạc.",
            "Thế nhưng, khi một số kẻ cuồng tín mưu toan đem công nghệ này ứng dụng lên chính con người để tạo ra cái gọi là 'người nhân bản', tôi nhất định phải đứng lên kiên quyết phản đối kịch liệt.",
            "Con người không chỉ đơn thuần là một cỗ máy sao chép máy móc của những chuỗi gen và tế bào sinh học. Mỗi một con người sinh ra đều là một phép màu sinh mệnh độc nhất vô nhị, sở hữu phẩm giá, cảm xúc và vị thế luân lý đạo đức độc lập. Nếu con người nhân bản xuất hiện, trật tự luân thường gia đình truyền thống, mối quan hệ huyết thống và toàn bộ trật tự xã hội sẽ bị phá hủy tận gốc rễ, thậm chí họ có nguy cơ bị biến thành công cụ lao dịch hoặc kho nội tạng cho tầng lớp đặc quyền.",
            "Khoa học công nghệ nhất định phải chịu sự ước thúc nghiêm ngặt của luân lý đạo đức. Một nền công nghệ đánh mất đi tính người sẽ không bao giờ là phúc lợi của nhân loại, mà là thảm họa hủy diệt cả nền văn minh."
        ],
        "r2_title": "Đọc thêm: 科技与伦理的界限 (Ranh giới giữa công nghệ và đạo đức)",
        "r2_text": """科技是一柄双刃剑。它可以造福苍生，亦能毁灭世界。
在人工智能、基因编辑飞速发展的今天，人类更应当保持敬畏之心。守住伦理底线，科技才能真正成为照亮人类未来的温暖明灯。""",
        "r2_trans": [
            "Khoa học công nghệ là con dao hai lưỡi. Nó có thể đem lại muôn vàn phúc lành cho muôn dân, nhưng cũng có thể hủy diệt toàn bộ thế giới.",
            "Trong thời đại trí tuệ nhân tạo và công nghệ chỉnh sửa gen phát triển như vũ bão hôm nay, nhân loại càng cần phải giữ cho mình một tấm lòng kính sợ. Gìn giữ trọn vẹn lằn ranh đạo đức tối thiểu, khoa học công nghệ mới thực sự trở thành ngọn đèn ấm áp soi sáng tương lai con người."
        ],
        "words": [
            {"hz": "克隆", "py": "kèlóng", "type": "【动/名】", "mean": "KHẮC LONG (nhân bản vô tính - clone)", "examples": ["～技术 / 克隆羊多莉"]},
            {"hz": "丰碑", "py": "fēngbēi", "type": "【名】", "mean": "PHONG BI (tượng đài to lớn, mốc son vĩ đại)", "examples": ["历史的～ / 树立起一座丰碑"]},
            {"hz": "伦理", "py": "lúnlǐ", "type": "【名】", "mean": "LUÂN LÝ (đạo đức luân thường, luân lý)", "examples": ["家庭～ / 伦理道德"]},
            {"hz": "独一无二", "py": "dúyī-wú'èr", "type": "【成语】", "mean": "ĐỘC NHẤT VÔ NHỊ (duy nhất, không có cái thứ hai)", "examples": ["每个人都是～的。"]},
            {"hz": "双刃剑", "py": "shuāngrènjiàn", "type": "【名】", "mean": "SONG NHẬN KIẾM (con dao hai lưỡi)", "examples": ["科技是一把～。"]}
        ],
        "grammar": [
            {
                "point": "绝不 (Tuyệt đối không / Quyết không)",
                "pinyin": "jué bù",
                "structure": "绝不 + [Động từ / Hành động phản đối]",
                "explanation": "Phó từ phủ định kiên quyết nhất trong tiếng Hán, biểu thị ý chí sắt đá không lay chuyển.",
                "examples": [
                    {"zh": "在原则问题上，我们绝不妥协退让。", "pinyin": "Zài yuánzé wèntí shàng, wǒmen jué bù tuǒxié tuìràng.", "vi": "Trên vấn đề nguyên tắc cốt lõi, chúng tôi tuyệt đối không thỏa hiệp nhượng bộ."}
                ]
            }
        ]
    }
]

# Build GC1 JSON
lessons_output = []
total_vocab_count = 0
total_grammar_count = 0

for item in raw_lessons:
    lnum = item["lesson_num"]
    l_id = f"gc1_bai{lnum}"
    main_id = f"bai{lnum}"
    title = item["title"]
    
    # Process readings
    readings = [
        {
            "sub_id": f"gc1_b{lnum}_reading1",
            "title": item["r1_title"],
            "audio": f"audio/Cao cap 1/第{lnum:02d}课.mp3",
            "chinese_html": to_ruby(item["r1_text"]),
            "translations": item["r1_trans"]
        },
        {
            "sub_id": f"gc1_b{lnum}_reading2",
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
            "id": f"gc1_{lnum}_{idx+1}",
            "book_id": "gc1",
            "book_name": "Cao Cấp 1",
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
    
    lessons_output.append({
        "lesson_id": l_id,
        "lesson_num": lnum,
        "main_id": main_id,
        "title": title,
        "audio_baikhoa": f"audio/Cao cap 1/第{lnum:02d}课.mp3",
        "audio_tuvung": None,
        "audio_docthem": None,
        "total_vocab": len(words),
        "total_grammar": len(grammar),
        "words": words,
        "readings": readings,
        "grammar": grammar
    })
    
    total_vocab_count += len(words)
    total_grammar_count += len(grammar)

gc1_book = {
    "id": "gc1",
    "name": "Cao Cấp 1",
    "chinese_name": "高级飞翔篇 I",
    "sub_name": "Boya Advanced I",
    "pdf": "boya_pdf/高级飞翔篇1.pdf",
    "audio_folder": "Cao cap 1",
    "color": "#0891b2",
    "color_dark": "#0e7490",
    "badge_color": "#cffafe",
    "badge_text": "#155e75",
    "icon": "📕",
    "description": "Giáo trình Boya Cao Cấp Phi Tường I - 10 bài học chuyên sâu về văn học, tư tưởng, triết học và xã hội hiện đại Trung Quốc.",
    "total_lessons": 10,
    "total_vocab": total_vocab_count,
    "title": "Quyển 5 - 高级飞翔篇 I (Cao Cấp 1)",
    "lessons": lessons_output
}

with open("scratch/gc1_book.json", "w", encoding="utf-8") as f:
    json.dump(gc1_book, f, ensure_ascii=False, indent=2)

print(f"GC1 book compiled successfully! 10 lessons, {total_vocab_count} words, {total_grammar_count} grammar points.")
