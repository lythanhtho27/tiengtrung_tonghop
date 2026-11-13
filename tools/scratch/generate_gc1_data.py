# -*- coding: utf-8 -*-
"""
Builder for Boya Cao Cap 1 (gc1 - 高级飞翔篇 I)
10 lessons complete with:
- Reading Studio (Reading 1 & Reading 2 with Ruby Pinyin & Vietnamese translation)
- Vocabulary Studio (35-45 rich words per lesson with Hanzi, Pinyin, Part of speech, Âm Hán Việt, Vietnamese definitions, examples)
- Grammar Studio (4-5 grammar and synonym distinction points per lesson with structures, explanations, bilingual examples)
- Audio: Native MP3 audio tracks
"""

import json
import pypinyin

def to_ruby(text):
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    blocks = []
    for para in paragraphs:
        out = []
        py_list = pypinyin.pinyin(para, style=pypinyin.Style.TONE)
        for i, char in enumerate(para):
            if '\u4e00' <= char <= '\u9fff':
                py = py_list[i][0]
                out.append(f"<ruby>{char}<rt>{py}</rt></ruby>")
            else:
                out.append(char)
        blocks.append(f'<span class="block">{"".join(out)}</span>')
    return "\n                ".join(blocks)

# We define all 10 lessons for GC1
lessons = [
    {
        "lesson_id": "gc1_bai1",
        "lesson_num": 1,
        "main_id": "bai1",
        "title": "父亲的谜语",
        "audio_baikhoa": "audio/Cao cap 1/第01课.mp3",
        "audio_tuvung": None,
        "audio_docthem": None,
        "readings": [
            {
                "sub_id": "gc1_b1_reading1",
                "title": "Bài khóa chính: 父亲的谜语 (Câu đố của cha)",
                "audio": "audio/Cao cap 1/第01课.mp3",
                "chinese_text": """小时候，父亲最爱教我猜谜语。
父亲有很多谜语。夏日的晚上，坐在星光笼罩着的院子里，最有趣的事是猜父亲的谜语。父亲笑眯眯地看着我，悠悠地念着他的谜语。我眨巴着眼睛，仰头对着那满天的星斗苦苦地寻找，谜底藏在哪里呢？再盯着父亲的眼睛瞧，觉得他那双笑眯眯的小眼睛也和夜空一样深邃、神秘。当我苦思冥想，觉得小脑瓜子发涨的时候，父亲便会给予巧妙的提示，直到我得意地叫起来，他也“嘿嘿”地笑了。
渐渐地，父亲的谜语很少能够难倒我了。只有一条谜语我猜不出：“晚上关箱子，早上开箱子，箱子里面有镜子，镜子里面有个细妹子。”
我想了半天想不出，问父亲：“怎么镜子里面有个细妹子呢？”
父亲笑着说：“你再听呀——”他把眼睛合上，“晚上关箱子，”又把眼睛睁开，“早上开箱子，”父亲把眼睛凑近我，“箱子里面有镜子，你仔细看看，镜子里是不是有个细妹子？”
我叫起来：“是眼睛，是眼睛。”父亲说：“对。这是爸爸的眼睛。”
我问：“那我的眼睛又该怎么说呢？”
“晚上关箱子，早上开箱子，箱子里面有镜子，镜子里面有——”父亲摸摸饱经忧患而早白了的头发，说：“有个老头子。”
可后来有一次父亲猜不出了。因为我长大了，心里有扇小门儿悄悄地开了。一个影子从眼睛投到了心里，抹也抹不掉，可影子“他”却全然不知。陡然觉得父亲带给我的光明黯淡了，我心里只对那个人说：“没有你呀，我就是黑暗。”父亲做的饭菜也不香了，涩涩地咽不下去。
有一天，我告诉父亲我要离开家，跟着那个人到离家很远的地方去。父亲静静地听我说，浑浊的眼睛里什么表情也没有。半晌才开口：“我知道有一天你要走的，女大不中留啊。要是他待你不好，你就回家来。”
可是他待我很好，我和他在一起是那么幸福。有一次记起父亲的生日，便写信问父亲需要什么，说不管他要什么，女儿都会想尽办法“变”出来的。
父亲来信了，只有四行字：“晚上关箱子，早上开箱子，箱子里面有镜子，镜子里面有个细妹子。”那是父亲的眼睛，我怎么会猜不出呢？""",
                "translations": [
                    "Hồi nhỏ, cha tôi thích nhất là dạy tôi đoán câu đố.",
                    "Cha có rất nhiều câu đố. Vào những đêm hè, ngồi trong khoảng sân được ánh sao bao phủ, điều thú vị nhất là đoán những câu đố của cha. Cha mỉm cười nhìn tôi, thong thả đọc câu đố của mình. Tôi chớp chớp mắt, ngước nhìn bầu trời đầy sao khổ công tìm kiếm: đáp án câu đố giấu ở đâu nhỉ? Nhìn chăm chú vào mắt cha, tôi cảm thấy đôi mắt nhỏ híp lại cười của cha cũng sâu thẳm và huyền bí như bầu trời đêm. Khi tôi suy nghĩ vắt óc đến mức đầu óc căng phồng lên, cha sẽ khéo léo gợi ý cho đến khi tôi đắc ý reo lên, và cha cũng cười 'hì hì' vui vẻ.",
                    "Dần dần, những câu đố của cha hiếm khi làm khó được tôi nữa. Chỉ có một câu đố duy nhất tôi không tài nào đoán ra: 'Tối đóng rương, sáng mở rương, trong rương có tấm gương, trong gương có cô bé con.'",
                    "Tôi nghĩ mãi không ra, bèn hỏi cha: 'Sao trong gương lại có cô bé được hả cha?'",
                    "Cha mỉm cười bảo: 'Con nghe lại này—' Cha nhắm mắt lại, 'Tối đóng rương,' rồi lại mở mắt ra, 'Sáng mở rương,' cha ghé sát mắt lại gần tôi, 'Trong rương có gương, con nhìn kỹ xem, có phải trong gương có một cô bé con không?'",
                    "Tôi reo lên: 'Là đôi mắt, là đôi mắt ạ!' Cha gật đầu: 'Đúng rồi, đó là đôi mắt của cha.'",
                    "Tôi hỏi tiếp: 'Thế còn mắt của con thì phải nói thế nào hả cha?'",
                    "'Tối đóng rương, sáng mở rương, trong rương có gương, trong gương có...' Cha xoa mái tóc đã bạc sớm vì dãi dầu sương gió, cười bảo: 'Có một ông già.'",
                    "Thế nhưng sau này có một lần cha đã không đoán được nữa. Bởi vì tôi đã lớn, cánh cửa lòng tôi đã âm thầm mở hé. Một bóng hình đã từ ánh mắt in sâu vào tim tôi, xóa mãi không nhòa, nhưng 'người ấy' lại hoàn toàn không hay biết. Tôi bỗng thấy ánh sáng cha mang lại trở nên ảm đạm, trong lòng chỉ muốn nói với người ấy: 'Không có anh, em chỉ là bóng tối.' Cơm canh cha nấu cũng chẳng còn ngon nữa, nghẹn ứ nơi cổ họng.",
                    "Một ngày nọ, tôi thưa với cha rằng tôi muốn rời khỏi nhà, đi theo người ấy đến một nơi rất xa. Cha lặng lẽ lắng nghe, trong đôi mắt đục mờ không chút biểu cảm. Hồi lâu cha mới cất lời: 'Cha biết rồi sẽ có ngày con phải ra đi, con gái lớn không thể giữ mãi trong nhà được. Nếu như cậu ấy đối xử không tốt với con, con hãy quay về nhà nhé.'",
                    "Nhưng người ấy đối xử với tôi rất tốt, tôi ở bên anh vô cùng hạnh phúc. Một lần nhớ đến sinh nhật cha, tôi viết thư hỏi cha cần gì, con gái sẽ tìm mọi cách 'biến' ra tặng cha.",
                    "Cha gửi thư trả lời, vỏn vẹn chỉ có bốn câu: 'Tối đóng rương, sáng mở rương, trong rương có gương, trong gương có cô bé con.' Đó là đôi mắt của cha, làm sao tôi lại không đoán ra cơ chứ?"
                ]
            },
            {
                "sub_id": "gc1_b1_reading2",
                "title": "Đọc thêm: 胡萝卜、鸡蛋和咖啡 (Cà rốt, trứng và cà phê)",
                "audio": None,
                "chinese_text": """一天，女儿满腹牢骚地向父亲抱怨起生活的艰难。父亲是位厨师，他把女儿带进厨房。
父亲往三只锅里各倒进一些水，然后把胡萝卜放进第一只锅，把鸡蛋放进第二只锅，把咖啡豆放进第三只锅。水煮沸了，父亲把火关掉。
父亲问女儿：“你看到了什么？”女儿回答：“胡萝卜、鸡蛋和咖啡。”
父亲让她摸摸胡萝卜，胡萝卜变软了；再让她打破鸡蛋，鸡蛋变硬了；最后让她尝尝咖啡，香醇浓郁。
父亲解释说：“这三样东西面临同样的逆境——沸水。然而，它们各自的反应却完全不同。原本坚硬的胡萝卜变得软弱无力；原本脆弱的鸡蛋内心变得坚硬；而咖啡豆最为奇特，它反而改变了沸水，带来了浓郁的芬芳。”
父亲看着女儿问：“在面对生活的困境时，你愿意做哪一个呢？”""",
                "translations": [
                    "Một ngày nọ, cô con gái đầy ắp nỗi bực dọc than thở với cha về những nhọc nhằn, cay đắng của cuộc sống. Người cha là một đầu bếp, ông đưa con gái vào căn bếp nhỏ.",
                    "Người cha đổ nước vào ba chiếc nồi, sau đó đặt củ cà rốt vào nồi thứ nhất, quả trứng vào nồi thứ hai và những hạt cà phê vào nồi thứ ba. Nước sôi sùng sục, người cha tắt bếp.",
                    "Người cha hỏi: 'Con nhìn thấy điều gì?' Cô gái đáp: 'Cà rốt, trứng và cà phê ạ.'",
                    "Người cha bảo con sờ củ cà rốt, nó đã mềm nhũn; lại bảo con bóc quả trứng, nó đã trở nên đặc cứng; cuối cùng bảo con nếm ngụm cà phê, hương thơm nồng nàn quyến rũ.",
                    "Người cha giải thích: 'Cả ba thứ này đều đối mặt với cùng một nghịch cảnh—nước sôi. Thế nhưng, phản ứng của mỗi thứ lại hoàn toàn khác biệt. Củ cà rốt vốn cứng cỏi nay trở nên yếu đuối, nhũn mềm; quả trứng vốn mỏng manh nay lòng trắng lòng đỏ đều đông cứng lại; duy chỉ có hạt cà phê là kỳ diệu nhất, nó đã làm thay đổi chính dòng nước sôi và tỏa ra hương thơm ngào ngạt.'",
                    "Người cha ân cần nhìn con gái: 'Khi đối diện với nghịch cảnh giông bão của cuộc đời, con muốn mình trở thành thứ nào?'"
                ]
            }
        ],
        "words": [
            {"id": "gc1_1_1", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "谜语", "py": "míyǔ", "type": "【名】", "mean": "MÊ NGỮ (câu đố, lời đố)", "examples": ["猜～ / 出～ / 谜底", "这道～很难猜。"], "is_proper": False},
            {"id": "gc1_1_2", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "夏日", "py": "xiàrì", "type": "【名】", "mean": "HẠ NHẬT (ngày hè, mùa hè)", "examples": ["～炎炎 / ～的夜晚"], "is_proper": False},
            {"id": "gc1_1_3", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "笼罩", "py": "lǒngzhào", "type": "【动】", "mean": "LỒNG TRIẾU (bao phủ, bao trùm)", "examples": ["大雾～ / 整个城市被～在夜幕中"], "is_proper": False},
            {"id": "gc1_1_4", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "笑眯眯", "py": "xiàomīmī", "type": "【形】", "mean": "TIẾU MI MI (cười híp mắt, tươi cười)", "examples": ["～地看着我 / 一副～的模样"], "is_proper": False},
            {"id": "gc1_1_5", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "悠悠", "py": "yōuyōu", "type": "【形】", "mean": "DU DU (ung dung, thong thả, dài dằng dặc)", "examples": ["～念着 / 白云～ / 悠悠岁月"], "is_proper": False},
            {"id": "gc1_1_6", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "眨巴", "py": "zhǎba", "type": "【动】", "mean": "TRÁP BA (chớp chớp mắt)", "examples": ["～着眼睛 / 眨巴眨巴"], "is_proper": False},
            {"id": "gc1_1_7", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "星斗", "py": "xīngdǒu", "type": "【名】", "mean": "TINH ĐẨU (ngôi sao, các vì sao trên trời)", "examples": ["满天～ / 星斗璀璨"], "is_proper": False},
            {"id": "gc1_1_8", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "苦苦", "py": "kǔkǔ", "type": "【副】", "mean": "KHỔ KHỔ (khổ công, hết sức, tha thiết)", "examples": ["～哀求 / ～思索 / ～寻找"], "is_proper": False},
            {"id": "gc1_1_9", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "谜底", "py": "mídǐ", "type": "【名】", "mean": "MÊ ĐỂ (đáp án câu đố, chân tướng)", "examples": ["揭开～ / 寻找～"], "is_proper": False},
            {"id": "gc1_1_10", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "盯", "py": "dīng", "type": "【动】", "mean": "ĐINH (nhìn chằm chằm, dán mắt vào)", "examples": ["～着他的眼睛 / 目不转睛地盯"], "is_proper": False},
            {"id": "gc1_1_11", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "深邃", "py": "shēnsuì", "type": "【形】", "mean": "THÂM THUÝ (sâu thẳm, sâu xa)", "examples": ["目光～ / 深邃的夜空"], "is_proper": False},
            {"id": "gc1_1_12", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "苦思冥想", "py": "kǔsī-míngxiǎng", "type": "【成语】", "mean": "KHỔ TƯ MINH TƯỞNG (suy nghĩ nát óc, trầm tư suy ngẫm)", "examples": ["他～了半天，终于有了主意。"], "is_proper": False},
            {"id": "gc1_1_13", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "给予", "py": "jǐyǔ", "type": "【动】", "mean": "KỶ DỰ (dành cho, ban cho, giúp đỡ)", "examples": ["～帮助 / ～好评 / ～关怀"], "is_proper": False},
            {"id": "gc1_1_14", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "提示", "py": "tíshì", "type": "【动/名】", "mean": "ĐỀ THỊ (gợi ý, nhắc nhở)", "examples": ["巧妙的～ / 友情提示"], "is_proper": False},
            {"id": "gc1_1_15", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "得意", "py": "déyì", "type": "【形】", "mean": "ĐẮC Ý (đắc ý, vừa lòng hả dạ)", "examples": ["～洋洋 / 得意忘形"], "is_proper": False},
            {"id": "gc1_1_16", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "凑近", "py": "còujìn", "type": "【动】", "mean": "TẤU CẬN (ghé sát lại gần)", "examples": ["把脸～过来 / 凑近耳边"], "is_proper": False},
            {"id": "gc1_1_17", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "饱经忧患", "py": "bǎojīng-yōuhuàn", "type": "【成语】", "mean": "BÃO KINH ƯU HOẠN (từng trải bao nỗi gian nan hoạn nạn)", "examples": ["～的脸上布满了皱纹。"], "is_proper": False},
            {"id": "gc1_1_18", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "全然", "py": "quánrán", "type": "【副】", "mean": "TOÀN NHIÊN (hoàn toàn, trọn vẹn)", "examples": ["～不知 / 全然不顾"], "is_proper": False},
            {"id": "gc1_1_19", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "陡然", "py": "dǒurán", "type": "【副】", "mean": "ĐẨU NHIÊN (đột nhiên, bỗng nhiên)", "examples": ["～发生变化 / 陡然一惊"], "is_proper": False},
            {"id": "gc1_1_20", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "黯淡", "py": "àndàn", "type": "【形】", "mean": "ÁM ĐẠM (ảm đạm, mờ mịt, u tối)", "examples": ["光线～ / 前途黯淡"], "is_proper": False},
            {"id": "gc1_1_21", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "浑浊", "py": "húnzhuó", "type": "【形】", "mean": "HỖN TRỰC (vẩn đục, đục ngầu, mờ đục)", "examples": ["～的眼睛 / 河水浑浊"], "is_proper": False},
            {"id": "gc1_1_22", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "半晌", "py": "bànshǎng", "type": "【名】", "mean": "BÁN HƯỞNG (hồi lâu, nửa ngày)", "examples": ["过了～才说话 / 愣了半晌"], "is_proper": False},
            {"id": "gc1_1_23", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "女大不中留", "py": "nǚ dà bù zhōng liú", "type": "【俗语】", "mean": "NỮ ĐẠI BẤT TRUNG LƯU (con gái lớn gả chồng, không giữ mãi được)", "examples": ["常言道，～。"], "is_proper": False},
            {"id": "gc1_1_24", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "荒诞", "py": "huāngdàn", "type": "【形】", "mean": "HOANG ĐẢN (hoang đường, vô lý)", "examples": ["～的想法 / 荒诞不经"], "is_proper": False},
            {"id": "gc1_1_25", "book_id": "gc1", "book_name": "Cao Cấp 1", "lesson_num": 1, "lesson_title": "父亲的谜语", "hz": "孝心", "py": "xiàoxīn", "type": "【名】", "mean": "HIẾU TÂM (lòng hiếu thảo, hiếu kính)", "examples": ["尽一点～ / 孝敬父母"], "is_proper": False}
        ],
        "grammar": [
            {
                "point": "给予 (Cho / Dành cho)",
                "pinyin": "jǐyǔ",
                "structure": "给予 + [Tân ngữ trừu tượng (sự giúp đỡ, khích lệ, chỉ bảo)]",
                "explanation": "Động từ mang sắc thái trang trọng (thư diện ngữ), biểu thị việc trao tặng hoặc đem lại điều gì đó tích cực về tinh thần hoặc hành động cho đối phương. Thường đi kèm với các danh từ trừu tượng như: 帮助, 支持, 鼓励, 照顾, 启示.",
                "examples": [
                    {"zh": "父亲便会给予巧妙的提示。", "pinyin": "Fùqīn biàn huì jǐyǔ qiǎomiào de tíshì.", "vi": "Người cha liền khéo léo dành cho tôi những gợi ý tài tình."},
                    {"zh": "在学习过程中，老师给予我们极大的关怀与指引。", "pinyin": "Zài xuéxí guòchéng zhōng, lǎoshī jǐyǔ wǒmen jí dà de guānhuái yǔ zhǐyǐn.", "vi": "Trong quá trình học tập, thầy cô đã dành cho chúng tôi sự quan tâm và chỉ dẫn vô cùng to lớn."},
                    {"zh": "这项公益项目给予贫困地区的孩子们无限的希望。", "pinyin": "Zhè xiàng gōngyì xiàngmù jǐyǔ pínkùn dìqū de háizimen wúxiàn de xīwàng.", "vi": "Dự án thiện nguyện này đem lại niềm hy vọng vô bờ cho trẻ em vùng khó khăn."}
                ]
            },
            {
                "point": "饱经 (Từng trải nhiều / Trải qua bao nhiêu)",
                "pinyin": "bǎojīng",
                "structure": "饱经 + [Danh từ chỉ sự thăng trầm, gian khổ: 忧患 / 风霜 / 沧桑 / 苦难]",
                "explanation": "Động từ biểu thị việc đã trải qua đầy đủ, sâu sắc và chịu đựng vô số khó khăn, thăng trầm trong suốt thời gian dài. Thường kết hợp trong các thành ngữ: 饱经风霜 (dãi dầu sương gió), 饱经忧患 (trải bao hoạn nạn), 饱经沧桑 (trải bao biến thiên cuộc đời).",
                "examples": [
                    {"zh": "父亲摸摸饱经忧患而早白了的头发。", "pinyin": "Fùqīn mōmō bǎojīng yōuhuàn ér zǎo bái le de tóufa.", "vi": "Cha khẽ vuốt mái tóc đã bạc sớm vì trải qua bao nỗi hoạn nạn gian truân."},
                    {"zh": "这位老人饱经风霜，目光中却依然充满坚毅。", "pinyin": "Zhè wèi lǎorén bǎojīng fēngshuāng, mùguāng zhōng què yīrán chōngmǎn jiānyì.", "vi": "Cụ già ấy đã dãi dầu sương gió, nhưng trong ánh mắt vẫn ngời lên vẻ kiên cường."},
                    {"zh": "古老的城墙饱经沧桑，见证了千年岁月的流转。", "pinyin": "Gǔlǎo de chéngqiáng bǎojīng cāngsāng, jiànzhèng le qiān nián suìyuè de liúzhuǎn.", "vi": "Bức tường thành cổ kính trải bao biến thiên dâu bể, làm chứng nhân cho dòng thời gian ngàn năm trôi qua."}
                ]
            },
            {
                "point": "V + 也 + V + 不 + V/A (Không sao làm nổi / Làm mãi cũng chẳng...)",
                "pinyin": "V yě V bù V/A",
                "structure": "Động từ + 也 + Động từ + 不 + [Bổ ngữ kết quả / Bổ ngữ khả năng]",
                "explanation": "Cấu trúc nhấn mạnh dù có cố gắng thực hiện hành động đến mức nào thì cũng không thể đạt được kết quả hoặc không thay đổi được tình trạng. Ví dụ: 抹也抹不掉 (xóa mãi không nhòa), 想也想不出 (nghĩ mãi không ra), 找也找不到 (tìm mãi không thấy).",
                "examples": [
                    {"zh": "一个影子从眼睛投到了心里，抹也抹不掉。", "pinyin": "Yígè yǐngzi cóng yǎnjing tóu dào le xīnlǐ, mǒ yě mǒ bú diào.", "vi": "Một bóng hình từ ánh mắt rọi vào trong tim, muốn xóa đi mà không sao xóa nhòa nổi."},
                    {"zh": "这道难题我思前想后，猜也猜不中。", "pinyin": "Zhè dào nántí wǒ sī qián xiǎng hòu, cāi yě cāi bù zhòng.", "vi": "Câu đố khó này tôi nghĩ đi nghĩ lại, đoán mãi cũng không trúng."},
                    {"zh": "往事如烟，可有些记忆忘也忘不了。", "pinyin": "Wǎngshì rú yān, kě yǒuxiē jìyì wàng yě wàng bù liǎo.", "vi": "Chuyện cũ như khói mây, nhưng có những ký ức muốn quên cũng chẳng thể nào quên được."}
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
    }
]

# We will populate remaining lessons 2 to 10 in full detail
print("Sample GC1 Lesson 1 prepared.")
