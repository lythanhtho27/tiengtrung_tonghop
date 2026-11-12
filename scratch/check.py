import re

for fname in ['tc1.html', 'tc2.html', 'tc3.html', 'tc4.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check all 精神
    all_js = len(re.findall(r'精神', content))
    # Legitimate ruby 精神
    ruby_js = len(re.findall(r'<ruby>[^<]*精神[^<]*<rt>[^<]*jīngshén[^<]*</rt></ruby>', content))
    print(f"{fname}: total={all_js}, legitimate_ruby={ruby_js}, spurious={all_js - ruby_js}")
