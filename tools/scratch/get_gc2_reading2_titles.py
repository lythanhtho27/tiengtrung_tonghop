import pymupdf
import os
import re

# In GC2, let's find all Reading 2 titles from doc2
pdf_dir = r"d:\Tho\HSK\Chuan HSK\BOYA\old BOYA\Giáo trình boya\[tiengtrungthuonghai.vn]Giáo trình Boya"
pdf2_path = None
for f in os.listdir(pdf_dir):
    if "cao cấp 2" in f.lower():
        pdf2_path = os.path.join(pdf_dir, f)

doc2 = pymupdf.open(pdf2_path)
print("=== GC2 Lessons and Reading 2 Titles ===")
for p in range(len(doc2)):
    t = doc2[p].get_text()
    if "阅读与理解" in t:
        lines = [l.strip() for l in t.splitlines() if l.strip()]
        for i, l in enumerate(lines):
            if "阅读与理解" in l and i + 1 < len(lines):
                next_line = lines[i+1]
                if len(next_line) > 1 and "根据" not in next_line and "选择" not in next_line:
                    print(f"Page {p+1}: {next_line}")
