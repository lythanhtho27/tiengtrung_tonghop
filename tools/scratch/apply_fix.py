import json
import re
import os
import shutil

os.makedirs('scratch/backup', exist_ok=True)

# 1. Back up files
files_to_backup = ['boya_data.json', 'boya_data.js', 'tc1.html', 'tc2.html', 'tc3.html', 'tc4.html', 'boya_learning.css']
for f in files_to_backup:
    if os.path.exists(f):
        shutil.copy2(f, os.path.join('scratch/backup', f))
print("Backed up files to scratch/backup")

# 2. Correct Lesson 16 Chinese HTML
bai16_doan7 = """                <!-- Đoạn 7 -->
                <span class="block"><span class="indent"></span>【7】<ruby>那天的<rt>Nàtiān de</rt></ruby><ruby>话题<rt>huàtí</rt></ruby><ruby>在<rt>zài</rt></ruby><ruby>我的<rt>wǒde</rt></ruby><ruby>心里<rt>xīnlǐ</rt></ruby><ruby>搁了<rt>gēle</rt></ruby><ruby>好些<rt>hǎoxiē</rt></ruby><ruby>日子<rt>rìzi</rt></ruby>，<ruby>我的<rt>wǒde</rt></ruby><ruby>心情<rt>xīnqíng</rt></ruby><ruby>一直<rt>yìzhí</rt></ruby><ruby>无法<rt>wúfǎ</rt></ruby><ruby>平静<rt>píngjìng</rt></ruby><ruby>下来<rt>xiàlái</rt></ruby>。<ruby>几天<rt>Jǐtiān</rt></ruby><ruby>以后<rt>yǐhòu</rt></ruby>，<ruby>我<rt>wǒ</rt></ruby><ruby>遇到<rt>yùdào</rt></ruby><ruby>另一位<rt>lìng yíwèi</rt></ruby><ruby>住在<rt>zhùzài</rt></ruby><ruby>本市<rt>běnshì</rt></ruby><ruby>的<rt>de</rt></ruby><ruby>朋友<rt>péngyou</rt></ruby>，<ruby>他<rt>tā</rt></ruby><ruby>是<rt>shì</rt></ruby><ruby>搞<rt>gǎo</rt></ruby><ruby>美术<rt>měishù</rt></ruby><ruby>的<rt>de</rt></ruby>，<ruby>是<rt>shì</rt></ruby><ruby>一个<rt>yígè</rt></ruby><ruby>聪明<rt>cōngmíng</rt></ruby>、<ruby>喜欢<rt>xǐhuan</rt></ruby><ruby>开玩笑<rt>kāi wánxiào</rt></ruby><ruby>的<rt>de</rt></ruby><ruby>人<rt>rén</rt></ruby>。<ruby>我<rt>Wǒ</rt></ruby><ruby>跟<rt>gēn</rt></ruby><ruby>他<rt>tā</rt></ruby><ruby>说了<rt>shuōle</rt></ruby><ruby>这<rt>zhè</rt></ruby><ruby>件<rt>jiàn</rt></ruby><ruby>事<rt>shì</rt></ruby>，<ruby>没<rt>méi</rt></ruby><ruby>想到<rt>xiǎngdào</rt></ruby><ruby>他<rt>tā</rt></ruby><ruby>这样<rt>zhèyàng</rt></ruby><ruby>回答<rt>huídá</rt></ruby><ruby>我<rt>wǒ</rt></ruby>：</span>"""

bai16_doan8 = """                <!-- Đoạn 8 -->
                <span class="block"><span class="indent"></span>【8】“<ruby>是<rt>Shì</rt></ruby>，<ruby>本来<rt>běnlái</rt></ruby><ruby>地球<rt>dìqiú</rt></ruby><ruby>上<rt>shang</rt></ruby><ruby>动物<rt>dòngwù</rt></ruby><ruby>的<rt>de</rt></ruby><ruby>数量<rt>shùliàng</rt></ruby><ruby>是<rt>shì</rt></ruby><ruby>平衡<rt>pínghéng</rt></ruby><ruby>的<rt>de</rt></ruby>，<ruby>人<rt>rén</rt></ruby><ruby>和<rt>hé</rt></ruby><ruby>其它<rt>qítā</rt></ruby><ruby>动物<rt>dòngwù</rt></ruby><ruby>一直<rt>yìzhí</rt></ruby><ruby>和谐<rt>héxié</rt></ruby><ruby>相处<rt>xiāngchǔ</rt></ruby>。<ruby>可<rt>Kě</rt></ruby><ruby>哪<rt>nǎ</rt></ruby><ruby>知道<rt>zhīdào</rt></ruby><ruby>人类<rt>rénlèi</rt></ruby><ruby>渐渐<rt>jiànjiàn</rt></ruby><ruby>有了<rt>yǒule</rt></ruby><ruby>爱<rt>ài</rt></ruby><ruby>骄傲<rt>jiāo'ào</rt></ruby><ruby>的<rt>de</rt></ruby><ruby>毛病<rt>máobìng</rt></ruby>，<ruby>越来越<rt>yuèláiyuè</rt></ruby><ruby>以<rt>yǐ</rt></ruby><ruby>自己<rt>zìjǐ</rt></ruby><ruby>为<rt>wéi</rt></ruby><ruby>中心<rt>zhōngxīn</rt></ruby>，<ruby>猎杀<rt>lièshā</rt></ruby><ruby>了<rt>le</rt></ruby><ruby>太多<rt>tài duō</rt></ruby><ruby>的<rt>de</rt></ruby><ruby>动物<rt>dòngwù</rt></ruby>，<ruby>这些<rt>zhèxiē</rt></ruby><ruby>原来<rt>yuánlái</rt></ruby><ruby>由<rt>yóu</rt></ruby><ruby>动物<rt>dòngwù</rt></ruby><ruby>占着<rt>zhànzhe</rt></ruby><ruby>的<rt>de</rt></ruby><ruby>名额<rt>míng'é</rt></ruby><ruby>就<rt>jiù</rt></ruby><ruby>让给<rt>rànggěi</rt></ruby><ruby>了<rt>le</rt></ruby><ruby>人类<rt>rénlèi</rt></ruby>。<ruby>这<rt>Zhè</rt></ruby><ruby>就是<rt>jiùshì</rt></ruby><ruby>为什么<rt>wèishénme</rt></ruby><ruby>地球<rt>dìqiú</rt></ruby><ruby>上<rt>shang</rt></ruby><ruby>的<rt>de</rt></ruby><ruby>动物<rt>dòngwù</rt></ruby><ruby>越来越<rt>yuèláiyuè</rt></ruby><ruby>少<rt>shǎo</rt></ruby>，<ruby>而<rt>ér</rt></ruby><ruby>人<rt>rén</rt></ruby><ruby>却<rt>què</rt></ruby><ruby>越来越<rt>yuèláiyuè</rt></ruby><ruby>多<rt>duō</rt></ruby><ruby>的<rt>de</rt></ruby><ruby>原因<rt>yuányīn</rt></ruby>。<ruby>你<rt>Nǐ</rt></ruby><ruby>可以<rt>kěyǐ</rt></ruby><ruby>这样<rt>zhèyàng</rt></ruby><ruby>想象<rt>xiǎngxiàng</rt></ruby>：<ruby>我们<rt>wǒmen</rt></ruby><ruby>周围<rt>zhōuwéi</rt></ruby><ruby>的<rt>de</rt></ruby><ruby>许多<rt>xǔduō</rt></ruby><ruby>人<rt>rén</rt></ruby>，<ruby>他们<rt>tāmen</rt></ruby><ruby>本来<rt>běnlái</rt></ruby><ruby>应该<rt>yīnggāi</rt></ruby><ruby>是<rt>shì</rt></ruby><ruby>豺狼虎豹<rt>cháiláng hǔbào</rt></ruby>。”</span>"""

bai16_doan9 = """                <!-- Đoạn 9 -->
                <span class="block"><span class="indent"></span>【9】<ruby>听了<rt>Tīngle</rt></ruby><ruby>朋友<rt>péngyou</rt></ruby><ruby>的<rt>de</rt></ruby><ruby>话<rt>huà</rt></ruby><ruby>后<rt>hòu</rt></ruby>，<ruby>我<rt>wǒ</rt></ruby><ruby>不禁<rt>bùjīn</rt></ruby><ruby>问<rt>wèn</rt></ruby><ruby>自己<rt>zìjǐ</rt></ruby>：<ruby>当<rt>dāng</rt></ruby>“<ruby>豺狼虎豹<rt>cháiláng hǔbào</rt></ruby>”<ruby>的<rt>de</rt></ruby><ruby>贪婪<rt>tānlán</rt></ruby><ruby>和<rt>hé</rt></ruby><ruby>现代<rt>xiàndài</rt></ruby><ruby>科技<rt>kējì</rt></ruby><ruby>结合<rt>jiéhé</rt></ruby><ruby>以后<rt>yǐhòu</rt></ruby>，<ruby>地球<rt>dìqiú</rt></ruby><ruby>还能<rt>hái néng</rt></ruby><ruby>不<rt>bù</rt></ruby><ruby>遭到<rt>zāodào</rt></ruby><ruby>毁灭<rt>huǐmiè</rt></ruby><ruby>吗<rt>ma</rt></ruby>？</span>
                <span class="block" style="text-align: right; font-style: italic; color: #888; font-size: 0.9em;">（根据吴亮《画家的责任》改写）</span>"""

bai16_translations = [
    "【1】 Tôi có khá nhiều người bạn là họa sĩ, họ sống ở khắp nơi trên thế giới. Còn đối với riêng tôi, sống ở thành phố ngày càng đông đúc này hay sống ở một quốc gia khác cũng chẳng có quá nhiều khác biệt. Giữa chúng tôi có khoảng cách địa lý khá xa xôi, chỉ khi nhìn trên bản đồ mới thấy gần gũi, cơ hội đến thăm nhau cũng ngày càng hiếm hoi.",
    "【2】 Một đêm muộn nọ, tôi bất ngờ nhận được cuộc điện thoại từ một người bạn họa sĩ gọi từ Bắc Kinh. Anh nói có việc hệ trọng cần phải gặp nói chuyện ngay với tôi. Khi ấy tôi đang chuẩn bị đi Nam Kinh (cũng là để tìm gặp vài người họa sĩ), nên tôi bảo cứ đợi tôi trở về Thượng Hải rồi hãy liên lạc.",
    "【3】 Một tuần sau, tôi từ Nam Kinh trở về Thượng Hải. Ngay trong đêm đó, anh lại gọi điện tới. Qua điện thoại, anh bảo mấy ngày qua đã liên lạc với tôi nhiều lần và hỏi tại sao tôi lại ở Nam Kinh lâu đến thế. Thấy anh sốt ruột như vậy, tôi nghĩ chắc chắn là có chuyện vô cùng quan trọng, thế nên đã hẹn anh ngày hôm sau đến chỗ ở của tôi.",
    "【4】 Ngày hôm sau khi gặp mặt, chúng tôi chào hỏi vài câu xã giao rồi bắt đầu nói về \"việc hệ trọng\" mà anh đã đề cập.",
    "【5】 Anh nói, sự tàn phá môi trường của con người đã đến mức vô cùng khủng khiếp: không khí suy thoái nghiêm trọng, sông ngòi và đại dương bị ô nhiễm, diện tích rừng và thảo nguyên không ngừng thu hẹp, nhiều loài động vật đã biến mất hoàn toàn khỏi thế giới, tài nguyên trên Trái Đất gần như đã bị tiêu hao cạn kiệt. Anh nói, lượng ô tô ngày một gia tăng không ngừng xả khí thải vào không khí; nước thải từ các nhà máy lớn nhỏ liên tục đổ vào sông ngòi, đại dương; các khách sạn, nhà hàng xây dựng ngày một cao lớn đã tiêu tốn một lượng gỗ khổng lồ; mỗi một khách hàng vứt đi một đôi đũa dùng một lần đồng nghĩa với việc Trái Đất lại mất đi một mảng rừng. Mỗi chiếc áo khoác lông thú trên người phụ nữ đều đồng nghĩa với việc trên thế giới lại có thêm động vật bị săn bắn giết hại; mỗi chiếc đồng hồ nạm kim cương trên tay người đàn ông đều đồng nghĩa với việc ở một nơi nào đó trên Trái Đất lại bị đào xới thành một cái hố. Anh nói sự phát triển mù quáng của đô thị đang xóa sổ các ký ức lịch sử, những công trình kiến trúc cổ quý giá bị san phẳng không thương tiếc, thay thế cho chúng là những tòa nhà cao tầng được gắn mác hiện đại. Anh nói ai cũng muốn có một cuộc sống tốt đẹp hơn, nhưng lại đang tự tay phá hủy những điều kiện sinh tồn cơ bản nhất. Anh nói các nước phát triển đang chuyển dịch cuộc khủng hoảng môi trường sang các nước kém phát triển, cứ tiếp diễn như vậy thì một ngày nào đó các nước kém phát triển cũng sẽ tác động ngược lại các nước phát triển, và sau đó toàn bộ Trái Đất không thể tránh khỏi việc bước tới bờ vực sụp đổ. Anh bảo anh phải làm một điều gì đó, nếu không thì không tài nào yên tâm làm nghệ thuật được.",
    "【6】 Anh cứ thao thao bất tuyệt trong phòng của tôi, còn tôi nhất thời lại không biết phải nói gì. Tôi bảo tôi cũng từng suy nghĩ về những vấn đề này, nhưng điều đó chỉ khiến tôi thêm bi quan, thất vọng.",
    "【7】 Đề tài của ngày hôm ấy cứ đọng mãi trong lòng tôi suốt nhiều ngày, tâm trạng của tôi mãi chẳng thể nào bình lặng lại được. Mấy ngày sau, tôi gặp một người bạn khác sống cùng thành phố, anh ấy là người làm nghệ thuật, là một người thông minh và thích nói đùa. Tôi kể với anh ấy về chuyện này, không ngờ anh ấy lại trả lời tôi thế này:",
    "【8】 “Đúng vậy, vốn dĩ số lượng động vật trên Trái Đất là cân bằng, con người và các loài động vật khác xưa nay vẫn chung sống hòa hợp. Nhưng ai mà ngờ con người dần dần sinh ra cái thói kiêu ngạo, ngày càng lấy bản thân làm trung tâm, săn giết quá nhiều động vật, những suất sinh tồn vốn do động vật chiếm giữ này liền nhường lại cho con người. Đó chính là lý do vì sao động vật trên Trái Đất ngày càng ít đi, mà con người lại ngày một đông thêm. Cậu có thể tưởng tượng như thế này: rất nhiều người ở xung quanh chúng ta, bản thân họ vốn dĩ nên là sài lang hổ báo.”",
    "【9】 Nghe xong lời của người bạn, tôi bất giác tự hỏi mình: Khi sự tham lam của “sài lang hổ báo” kết hợp với khoa học công nghệ hiện đại, liệu Trái Đất có thể không bị hủy diệt hay sao?"
]

bai16_trans_html = '\n                <div class="translation-line">' + '</div>\n                <div class="translation-line">'.join(bai16_translations) + '</div>'

# Cleaning helper
def clean_spurious_jingshen(html):
    # 1. Remove empty rt ruby: <ruby>精神<rt></rt></ruby>
    h = html.replace('<ruby>精神<rt></rt></ruby>', '')
    # 2. Protect legitimate ruby with pinyin: <ruby>精神<rt>jīngshén...</rt></ruby> or <ruby>精神病<rt>jīngshénbìng</rt></ruby>
    sentinel = "___REAL_JINGSHEN___"
    def protect(m):
        return m.group(0).replace('精神', sentinel)
    h = re.sub(r'<ruby>[^<]*精神[^<]*<rt>[^<]*jīngshén[^<]*</rt></ruby>', protect, h)
    # 3. Remove all remaining bare '精神'
    h = re.sub(r'精神+', '', h)
    # 4. Restore sentinel
    h = h.replace(sentinel, '精神')
    return h

# 3. Process boya_data.json
with open('boya_data.json', 'r', encoding='utf-8') as f:
    boya_data = json.load(f)

for book in boya_data.get('books', []):
    b_id = book.get('id')
    for lesson in book.get('lessons', []):
        l_num = lesson.get('lesson_num')
        for r_idx, r in enumerate(lesson.get('readings', [])):
            if b_id == 'tc2' and l_num == 16:
                # Fix Lesson 16
                r['translations'] = bai16_translations
                orig_html = r.get('chinese_html', '')
                # Keep up to end of Đoạn 6
                idx_d7 = orig_html.find('<!-- Đoạn 7 -->')
                if idx_d7 != -1:
                    header_and_d1_6 = orig_html[:idx_d7]
                else:
                    header_and_d1_6 = orig_html
                # Clean spurious 精神 from paragraphs 1-6
                header_and_d1_6 = clean_spurious_jingshen(header_and_d1_6)
                
                # Combine with correct paragraphs 7-9 and correct translation-container
                new_html = (
                    header_and_d1_6.rstrip() + "\n\n" +
                    bai16_doan7 + "\n\n" +
                    bai16_doan8 + "\n\n" +
                    bai16_doan9 + "\n\n" +
                    '            <h2>Dịch nghĩa Tiếng Việt:</h2>\n' +
                    '            <div class="translation-container">\n' +
                    bai16_trans_html + '\n' +
                    '            </div>'
                )
                r['chinese_html'] = new_html
            else:
                # Other lessons: clean spurious 精神
                if 'chinese_html' in r:
                    r['chinese_html'] = clean_spurious_jingshen(r['chinese_html'])

# Write updated boya_data.json
with open('boya_data.json', 'w', encoding='utf-8') as f:
    json.dump(boya_data, f, ensure_ascii=False, indent=2)
print("Updated boya_data.json")

# Write updated boya_data.js
with open('boya_data.js', 'w', encoding='utf-8') as f:
    f.write('window.BOYA_DATA = ' + json.dumps(boya_data, ensure_ascii=False) + ';')
print("Updated boya_data.js")

# 4. Process tc2.html
with open('tc2.html', 'r', encoding='utf-8') as f:
    tc2_content = f.read()

# Fix tc2.html Lesson 16 section
idx_start = tc2_content.find('id="bai16-baikhoa"')
idx_end = tc2_content.find('id="bai16-tuvung"', idx_start)

if idx_start != -1 and idx_end != -1:
    before_bai16 = tc2_content[:idx_start]
    after_bai16 = tc2_content[idx_end:]
    bai16_chunk = tc2_content[idx_start:idx_end]
    
    # In bai16_chunk: keep up to end of Đoạn 6
    idx_d7 = bai16_chunk.find('<!-- Đoạn 7 -->')
    if idx_d7 != -1:
        part1 = bai16_chunk[:idx_d7]
        part1 = clean_spurious_jingshen(part1)
        fixed_bai16_chunk = (
            part1.rstrip() + "\n\n" +
            bai16_doan7 + "\n\n" +
            bai16_doan8 + "\n\n" +
            bai16_doan9 + "\n" +
            '            </div>\n\n' +
            '            <h2>Dịch nghĩa Tiếng Việt:</h2>\n' +
            '            <div class="translation-container">\n' +
            bai16_trans_html + '\n' +
            '            </div>\n' +
            '        </div>\n\n        <!-- KHỐI TAB TỪ VỰNG BÀI 16 -->\n        <div '
        )
        tc2_content = before_bai16 + fixed_bai16_chunk + after_bai16[len('        <div '):]
    else:
        print("Warning: could not find Đoạn 7 in tc2.html")

# Clean all spurious 精神 in tc2_content
tc2_content = clean_spurious_jingshen(tc2_content)
with open('tc2.html', 'w', encoding='utf-8') as f:
    f.write(tc2_content)
print("Updated tc2.html")

# 5. Process tc1.html, tc3.html, tc4.html
for fn in ['tc1.html', 'tc3.html', 'tc4.html']:
    with open(fn, 'r', encoding='utf-8') as f:
        c = f.read()
    
    # In tc3.html, protect vocabulary table examples before cleaning!
    if fn == 'tc3.html':
        # tc3 spurious was only in reading: '水泥是灰白色的精神。“青青的瓦”'
        c = c.replace('水泥是灰白色的精神。“青青的瓦”', '水泥是灰白色的。“青青的瓦”')
    else:
        c = clean_spurious_jingshen(c)
    
    with open(fn, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f"Updated {fn}")

# 6. Update boya_learning.css to hide legacy translation container inside chinese text content
with open('boya_learning.css', 'r', encoding='utf-8') as f:
    css = f.read()

rule = """
/* Hide nested legacy translation container inside reading content, since it is rendered in #translationSection */
.chinese-text-content .translation-container,
.chinese-text-content h2 {
    display: none !important;
}
"""

if '.chinese-text-content .translation-container' not in css:
    css = css + "\n" + rule
    with open('boya_learning.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print("Updated boya_learning.css")
else:
    print("boya_learning.css already has rule")
