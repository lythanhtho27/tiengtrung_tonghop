import json
import re

with open('boya_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def transform_chinese_html(html, translations):
    # 1. Clean legacy translation container from html if present
    for marker in ['<h2>Dịch nghĩa', '<div class="translation-container"']:
        idx = html.find(marker)
        if idx != -1:
            html = html[:idx]
    
    # 2. Extract span.block elements
    # In boya data, blocks are: <span class="block"[^>]*>([\s\S]*?)</span> (taking into account nested spans)
    # Better: split by '<span class="block"'
    starts = [m.start() for m in re.finditer(r'<span class="block"', html)]
    if not starts:
        return html
    
    # Split translations by 【N】
    trans_map = {}
    for t in translations:
        m = re.match(r'^\s*【(\d+)】', t)
        if m:
            trans_map[int(m.group(1))] = t
    
    # Identify blocks
    raw_blocks = []
    for i, s in enumerate(starts):
        end = starts[i+1] if i + 1 < len(starts) else len(html)
        raw_blocks.append(html[s:end].strip())
    
    output_cards = []
    seq_trans_idx = 0
    
    for b_idx, b_html in enumerate(raw_blocks):
        clean_text = re.sub(r'<[^>]+>', '', b_html).strip()
        if not clean_text:
            continue
        
        is_title = 'text-align: center' in b_html or ('font-weight: bold' in b_html and b_idx == 0)
        is_attr = 'text-align: right' in b_html or clean_text.startswith('（根据') or clean_text.startswith('（选自')
        
        matched_trans = None
        para_label = ""
        
        # Check 【N】 in block
        m_num = re.search(r'【(\d+)】', clean_text)
        if m_num:
            num = int(m_num.group(1))
            para_label = f"Đoạn {num}"
            if num in trans_map:
                matched_trans = trans_map[num]
        
        if not matched_trans and not is_title and not is_attr:
            if seq_trans_idx < len(translations):
                matched_trans = translations[seq_trans_idx]
                seq_trans_idx += 1
                para_label = f"Đoạn {seq_trans_idx}"
        
        # Clean 【N】 prefix from translation text for display if desired, or keep it
        clean_trans = matched_trans
        if clean_trans and clean_trans.startswith(f"【{m_num.group(1)}】" if m_num else "###"):
            clean_trans = re.sub(r'^\s*【\d+】\s*', '', clean_trans)
        
        output_cards.append({
            'is_title': is_title,
            'is_attr': is_attr,
            'b_html': b_html,
            'trans': clean_trans,
            'label': para_label
        })
    
    return output_cards

# Test on 5 different lessons
test_lessons = [
    ('tc2', 16),
    ('tc1', 1),
    ('tc2', 1),
    ('tc3', 1),
    ('tc4', 1)
]

for b_id, l_num in test_lessons:
    for b in data['books']:
        if b['id'] == b_id:
            for l in b['lessons']:
                if l['lesson_num'] == l_num:
                    r = l['readings'][0]
                    res = transform_chinese_html(r['chinese_html'], r['translations'])
                    print(f"\n=== {b_id} L{l_num} ({l['title']}) ===")
                    print(f"Total cards: {len(res)}, Translations: {len(r['translations'])}")
                    has_trans = sum(1 for c in res if c['trans'])
                    print(f"Cards with translation: {has_trans}")
                    for c in res[:3]:
                        print("  Card title?", c['is_title'], "attr?", c['is_attr'], "label:", c['label'])
                        print("   Trans sample:", c['trans'][:50] if c['trans'] else 'NONE')
