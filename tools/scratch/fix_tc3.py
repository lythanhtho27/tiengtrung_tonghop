with open('tc3.html', 'r', encoding='utf-8') as f:
    c = f.read()

target = '<ruby>的<rt>de</rt></ruby>精神。“'
replacement = '<ruby>的<rt>de</rt></ruby>。“'

if target in c:
    c = c.replace(target, replacement)
    with open('tc3.html', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Fixed tc3.html spurious 精神")
else:
    print("Target not found in tc3.html")
