import pymupdf
import re

pdf_path = r'd:\Tho\HSK\Chuan HSK\BOYA\old BOYA\Giáo trình boya\[tiengtrungthuonghai.vn]Giáo trình Boya\[tiengtrungthuonghai.vn]Giáo trình Boya cao cấp 2.pdf'
doc = pymupdf.open(pdf_path)

print("Examining Lesson 1 (pages 6 to 32)...")
for pno in range(6, 26):
    text = doc[pno].get_text()
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    header = lines[0] if lines else "EMPTY"
    has_ciyu = any('生词' in l or '语言点' in l or '词语辨析' in l or '阅读与理解' in l for l in lines)
    print(f"Page {pno+1}: {len(lines)} lines | Header: {header[:30]} | Markers: {[l for l in lines if any(k in l for k in ['生词', '语言点', '词语辨析', '阅读与理解'])]}")
