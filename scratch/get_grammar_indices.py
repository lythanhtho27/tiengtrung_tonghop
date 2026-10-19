import pymupdf
import os
import re

# Check gc2 grammar index (pages 298-302)
pdf2_path = None
pdf_dir = r"d:\Tho\HSK\Chuan HSK\BOYA\old BOYA\Giáo trình boya\[tiengtrungthuonghai.vn]Giáo trình Boya"
for f in os.listdir(pdf_dir):
    if "cao cấp 2" in f.lower():
        pdf2_path = os.path.join(pdf_dir, f)

if pdf2_path:
    doc2 = pymupdf.open(pdf2_path)
    print("=== GC2 Appendix / Grammar Index ===")
    for p in range(len(doc2) - 8, len(doc2)):
        t = doc2[p].get_text()
        if "附录" in t or "语言点" in t or "词语辨析" in t:
            print(f"--- Page {p+1} ---")
            print(t[:600])

# Check gc1 grammar index in boya_pdf/高级飞翔篇1.pdf (pages 224-229)
from rapidocr_onnxruntime import RapidOCR
ocr = RapidOCR()
doc1 = pymupdf.open("boya_pdf/高级飞翔篇1.pdf")
print("\n=== GC1 Grammar Index OCR (pages 226-229) ===")
for p in range(225, min(229, len(doc1))):
    pix = doc1[p].get_pixmap(dpi=150)
    res, _ = ocr(pix.tobytes('png'))
    lines = [item[1] for item in res] if res else []
    print(f"--- Page {p+1} ({len(lines)} lines) ---")
    for l in lines[:15]:
        print("  ", l)
