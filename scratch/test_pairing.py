import json
import re

with open('boya_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def clean_tag(t):
    return re.sub(r'<[^>]+>', '', t).strip()

def pair_reading(html, translations):
    # Split html by <span class="block"
    starts = [m.start() for m in re.finditer(r'<span class="block"[^>]*>', html)]
    if not starts:
        return []
    
    blocks = []
    for i, s in enumerate(starts):
        end = starts[i+1] if i + 1 < len(starts) else len(html)
        blocks.append(html[s:end].strip())
    
    # Map translations by 【N】
    trans_by_num = {}
    for t_idx, t in enumerate(translations):
        m = re.match(r'^\s*【(\d+)】', t)
        if m:
            trans_by_num[int(m.group(1))] = t
    
    paired = []
    plain_trans_idx = 0
    
    for b_idx, b in enumerate(blocks):
        b_clean = clean_tag(b)
        is_title = 'text-align: center' in b or 'font-size: 26px' in b or 'font-size: 24px' in b
        is_attr = 'text-align: right' in b or '改写' in b or '选自' in b
        
        # Check 【N】 in block
        m_b = re.search(r'【(\d+)】', b_clean)
        assigned_trans = None
        
        if m_b and int(m_b.group(1)) in trans_by_num:
            assigned_trans = trans_by_num[int(m_b.group(1))]
        elif not is_title and not is_attr:
            # Use sequential translation
            if plain_trans_idx < len(translations):
                assigned_trans = translations[plain_trans_idx]
                plain_trans_idx += 1
        
        paired.append({
            'block': b,
            'is_title': is_title,
            'is_attr': is_attr,
            'trans': assigned_trans
        })
    
    return paired

# Test on tc2 L16
tc2_l16 = data['books'][1]['lessons'][15]['readings'][0]
pairs = pair_reading(tc2_l16['chinese_html'], tc2_l16['translations'])
print(f"tc2 L16 total paired blocks: {len(pairs)}")
for idx, p in enumerate(pairs):
    b_txt = clean_tag(p['block'])[:40].replace('\n', ' ')
    t_txt = (p['trans'][:50] if p['trans'] else 'NONE').replace('\n', ' ')
    print(f"Block {idx} (title={p['is_title']}, attr={p['is_attr']}): {b_txt} ---> Trans: {t_txt}")
