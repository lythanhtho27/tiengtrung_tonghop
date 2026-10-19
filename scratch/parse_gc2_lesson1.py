import os
import pymupdf
import re

pdf_dir = r"d:\Tho\HSK\Chuan HSK\BOYA\old BOYA\Giáo trình boya\[tiengtrungthuonghai.vn]Giáo trình Boya"
for f in os.listdir(pdf_dir):
    if "cao cấp 2" in f.lower():
        pdf_path = os.path.join(pdf_dir, f)

doc = pymupdf.open(pdf_path)

# Let's inspect pages 6 to 30
pages_text = {}
for p in range(6, 32):
    pages_text[p+1] = doc[p].get_text()

print("Page 7 start:", repr(pages_text[7][:200]))
print("Page 8 start:", repr(pages_text[8][:200]))
print("Page 13 start:", repr(pages_text[13][:200]))
print("Page 14 start:", repr(pages_text[14][:200]))
print("Page 15 start:", repr(pages_text[15][:200]))
print("Page 16 start:", repr(pages_text[16][:200]))
print("Page 17 start:", repr(pages_text[17][:200]))
print("Page 18 start:", repr(pages_text[18][:200]))
print("Page 19 start:", repr(pages_text[19][:200]))
print("Page 20 start:", repr(pages_text[20][:200]))
print("Page 28 start:", repr(pages_text[28][:200]))
print("Page 29 start:", repr(pages_text[29][:200]))
