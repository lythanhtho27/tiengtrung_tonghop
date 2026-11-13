import json
import re

print("=== VERIFYING BOYA_DATA.JSON ===")
with open('boya_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

# 1. Check readings in boya_data.json
spurious_in_readings = 0
legitimate_in_readings = 0

for b in d['books']:
    for l in b['lessons']:
        for r in l['readings']:
            html = r.get('chinese_html', '')
            for m in re.finditer(r'精神', html):
                sub = html[max(0, m.start()-20):min(len(html), m.end()+20)].replace('\n', ' ')
                # Is it legitimate?
                if '<ruby>' in sub and ('jīngshén' in sub or 'jīng' in sub):
                    legitimate_in_readings += 1
                else:
                    spurious_in_readings += 1
                    print(f"SPURIOUS in {b['id']} L{l['lesson_num']}: {sub}")

print(f"Boya_data.json: legitimate={legitimate_in_readings}, spurious={spurious_in_readings}")

# 2. Check tc2 Lesson 16 in boya_data.json
l16 = d['books'][1]['lessons'][15]
print("\n=== VERIFYING TC2 LESSON 16 ===")
print("Lesson title:", l16['title'])
r16 = l16['readings'][0]
print(f"Translation count: {len(r16['translations'])}")
for i, t in enumerate(r16['translations']):
    print(f"  [{i+1}] {t[:70]}...")

# Check paragraphs in chinese_html
for d_num in range(1, 10):
    marker = f"【{d_num}】"
    print(f"Has {marker}: {marker in r16['chinese_html']}")

# 3. Check HTML files
print("\n=== VERIFYING HTML FILES ===")
for fn in ['tc1.html', 'tc2.html', 'tc3.html', 'tc4.html']:
    with open(fn, 'r', encoding='utf-8') as f:
        c = f.read()
    total_js = len(re.findall(r'精神', c))
    legit_ruby = len(re.findall(r'<ruby>[^<]*精神[^<]*<rt>[^<]*jīngshén[^<]*</rt></ruby>', c))
    print(f"{fn}: total 精神={total_js}, legit ruby={legit_ruby}")

# 4. Check boya_data.js matches boya_data.json
print("\n=== VERIFYING BOYA_DATA.JS ===")
with open('boya_data.js', 'r', encoding='utf-8') as f:
    js_text = f.read()

prefix = 'window.BOYA_DATA = '
suffix = ';'
if js_text.startswith(prefix) and js_text.endswith(suffix):
    parsed = json.loads(js_text[len(prefix):-len(suffix)])
    tc2_l16_trans = parsed['books'][1]['lessons'][15]['readings'][0]['translations']
    print(f"boya_data.js parsed successfully! tc2 l16 translations count: {len(tc2_l16_trans)}")
    assert len(tc2_l16_trans) == 9, "Expected 9 translations"
else:
    print("boya_data.js structure mismatch!")
