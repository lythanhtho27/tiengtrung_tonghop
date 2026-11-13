import json
import re

with open('boya_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for b in data['books']:
    for l in b['lessons']:
        for r_idx, r in enumerate(l['readings']):
            html = r.get('chinese_html', '')
            # Look for <h2>Dịch nghĩa or <div class="translation-container"
            idx1 = html.find('<h2>Dịch nghĩa')
            idx2 = html.find('<div class="translation-container"')
            cut_idx = -1
            if idx1 != -1 and idx2 != -1:
                cut_idx = min(idx1, idx2)
            elif idx1 != -1:
                cut_idx = idx1
            elif idx2 != -1:
                cut_idx = idx2
            
            if cut_idx != -1:
                cut_part = html[cut_idx:]
                kept_part = html[:cut_idx]
                # Verify kept part has all Chinese
                # print sample
                if b['id'] == 'tc2' and l['lesson_num'] == 16:
                    print("tc2 L16 kept part ends with:")
                    print(kept_part[-200:])
                    print("Cut part starts with:")
                    print(cut_part[:100])
