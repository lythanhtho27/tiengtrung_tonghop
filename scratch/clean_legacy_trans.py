import json

with open('boya_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

cleaned_count = 0
for b in data['books']:
    for l in b['lessons']:
        for r in l.get('readings', []):
            html = r.get('chinese_html', '')
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
                r['chinese_html'] = html[:cut_idx].rstrip()
                cleaned_count += 1

print(f"Cleaned legacy translation containers from {cleaned_count} readings in boya_data.json")

with open('boya_data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

with open('boya_data.js', 'w', encoding='utf-8') as f:
    f.write('window.BOYA_DATA = ' + json.dumps(data, ensure_ascii=False) + ';')

print("Updated boya_data.json and boya_data.js")
