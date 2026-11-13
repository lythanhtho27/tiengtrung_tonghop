import pymupdf
import re
import os
import json

pdf_dir = r"d:\Tho\HSK\Chuan HSK\BOYA\old BOYA\Giáo trình boya\[tiengtrungthuonghai.vn]Giáo trình Boya"
pdf2_path = None
for f in os.listdir(pdf_dir):
    if "cao cấp 2" in f.lower():
        pdf2_path = os.path.join(pdf_dir, f)

doc2 = pymupdf.open(pdf2_path)

# 10 lessons page boundaries in doc2 (approximate start and end)
# Total pages: 291
# Lesson 1: 5 - 32
# Lesson 2: 33 - 62
# Lesson 3: 63 - 92
# Lesson 4: 93 - 116
# Lesson 5: 117 - 142
# Lesson 6: 143 - 168
# Lesson 7: 169 - 193
# Lesson 8: 194 - 220
# Lesson 9: 221 - 258
# Lesson 10: 259 - 291

lesson_bounds = [
    (1, "每天都冒一点险", "拾取逝去生命的碎片", 5, 32),
    (2, "那年那月那狗", "维他命M", 33, 62),
    (3, "人在风中", "简单的道理", 63, 92),
    (4, "现代化和蜗牛", "生活是可以这样拐弯的", 93, 116),
    (5, "上天自有安排", "难于传承的情感", 117, 142),
    (6, "球迷种种", "我也说了假话", 143, 168),
    (7, "面容", "林肯的以脸识人", 169, 193),
    (8, "辛亥革命与我", "沙漠玫瑰的开放", 194, 220),
    (9, "无为·逍遥·不设防", "亲疏随缘", 221, 258),
    (10, "音乐之伴", "从音乐聆听内在情感", 259, 291),
]

lessons_data = []

for l_num, title, r2_title, start_p, end_p in lesson_bounds:
    print(f"Processing GC2 Lesson {l_num}: {title} (pages {start_p+1} to {end_p+1})...")
    lesson_text = []
    for p in range(start_p, min(end_p, len(doc2))):
        lesson_text.append(doc2[p].get_text())
    
    full_lesson_str = "\n--- PAGE BREAK ---\n".join(lesson_text)
    
    # Save a checkpoint
    with open(f"scratch/gc2_l{l_num}_raw.txt", "w", encoding="utf-8") as f:
        f.write(full_lesson_str)
    
    print(f"  Lesson {l_num} raw text saved ({len(full_lesson_str)} chars)")

print("All GC2 raw lesson texts extracted!")
