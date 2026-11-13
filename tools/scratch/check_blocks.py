import json
import re

with open('boya_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for b in data['books']:
    print(f"\n=================== BOOK {b['id']} ===================")
    for l in b['lessons'][:3]:
        for r_idx, r in enumerate(l['readings']):
            html = r.get('chinese_html', '')
            trans = r.get('translations', [])
            # Let's count how many paragraphs/blocks there are
            # Split by class="block"
            parts = re.split(r'<span class="block"[^>]*>', html)
            # first part is before first block
            block_contents = parts[1:] if len(parts) > 1 else []
            print(f"{b['id']} L{l['lesson_num']} R{r_idx} ({l['title']}): blocks={len(block_contents)}, translations={len(trans)}")
