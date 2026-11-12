import json
import re

with open('boya_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for book in data.get('books', []):
    b_id = book.get('id')
    for l_idx in [0, 3, 7, 10]:
        if l_idx < len(book.get('lessons', [])):
            lesson = book['lessons'][l_idx]
            for r_idx, r in enumerate(lesson.get('readings', [])):
                html = r.get('chinese_html', '')
                trans = r.get('translations', [])
                blocks = re.findall(r'【(\d+)】', html)
                spans = re.findall(r'<span class="block"[^>]*>', html)
                print(f"{b_id} L{lesson.get('lesson_num')} R{r_idx}: blocks={len(blocks)}, spans={len(spans)}, trans_count={len(trans)}")
                if len(blocks) > 0 and len(trans) > 0:
                    print(f"   sample trans 0: {trans[0][:50]}...")
