import pymupdf
import os
import re

pdf_dir = r"d:\Tho\HSK\Chuan HSK\BOYA\old BOYA\Giáo trình boya\[tiengtrungthuonghai.vn]Giáo trình Boya"
for f in os.listdir(pdf_dir):
    if "cao cấp 2" in f.lower():
        pdf_path = os.path.join(pdf_dir, f)

doc = pymupdf.open(pdf_path)

# Let's inspect where each lesson's 课文 is located in doc
lessons_info = [
    (1, "每天都冒一点险", 6),
    (2, "那年那月那狗", 33),
    (3, "人在风中", 63),
    (4, "现代化和蜗牛", 93),
    (5, "上天自有安排", 117),
    (6, "球迷种种", 143),
    (7, "面容", 169),
    (8, "辛亥革命与我", 193),
    (9, "无为·逍遥·不设防", 221),
    (10, "音乐之伴", 259),
]

for num, title, approx_p in lessons_info:
    # search +/- 3 pages
    found = False
    for p in range(max(0, approx_p - 3), min(len(doc), approx_p + 4)):
        t = doc[p].get_text()
        if title in t and ("第一部分" in t or "课文" in t or len(t) > 200):
            print(f"Lesson {num}: '{title}' found on PDF page {p+1}")
            lines = [l.strip() for l in t.splitlines() if l.strip()]
            print("  First 3 lines:", lines[:3])
            found = True
            break
    if not found:
        print(f"Lesson {num}: '{title}' NOT found near page {approx_p}")
