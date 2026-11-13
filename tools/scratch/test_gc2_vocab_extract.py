import re

def extract_vocab_from_raw(raw_text):
    words = []
    # Find all numbered words: e.g. 1.憧憬 or 1. 憧憬
    # Pattern: ^(\d+)\.\s*([^\s\d\(\)\[\]]+)
    for line in raw_text.splitlines():
        line = line.strip()
        m = re.match(r'^(\d+)\s*[\.、]\s*([\u4e00-\u9fff·]+)$', line)
        if m:
            num = int(m.group(1))
            hz = m.group(2)
            words.append((num, hz))
    return words

for l in range(1, 11):
    with open(f"scratch/gc2_l{l}_raw.txt", encoding="utf-8") as f:
        raw = f.read()
    vocab = extract_vocab_from_raw(raw)
    # Deduplicate consecutive or re-numbered
    unique_vocab = []
    seen = set()
    for num, hz in vocab:
        if hz not in seen:
            seen.add(hz)
            unique_vocab.append((num, hz))
    print(f"GC2 Lesson {l}: {len(unique_vocab)} words extracted. Sample: {[hz for n, hz in unique_vocab[:6]]}")
