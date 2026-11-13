import json

d = json.load(open('boya_data.json', encoding='utf-8'))
print(f"Total Books: {len(d['books'])}")
print(f"Total Lessons: {d['total_lessons']}")
print(f"Total Vocab: {d['total_vocab']}")
print(f"Total Readings: {d['total_readings']}")

for b in d['books']:
    print(f"\n[{b['id']}] {b['title']}")
    print(f"  - Lessons count: {len(b['lessons'])}")
    print(f"  - PDF: {b['pdf']}")
    print(f"  - Audio Folder: {b['audio_folder']}")
    l1 = b['lessons'][0]
    print(f"  - L1: {l1['title']} ({len(l1['words'])} words, {len(l1['readings'])} readings, {len(l1['grammar'])} grammar)")
    l_last = b['lessons'][-1]
    print(f"  - Last Lesson: {l_last['title']} ({len(l_last['words'])} words, {len(l_last['readings'])} readings, {len(l_last['grammar'])} grammar)")
