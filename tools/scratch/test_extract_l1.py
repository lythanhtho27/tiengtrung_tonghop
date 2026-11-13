import pymupdf
from rapidocr_onnxruntime import RapidOCR
import pypinyin
import re
import json

ocr = RapidOCR()
doc1 = pymupdf.open('boya_pdf/高级飞翔篇1.pdf')

def ocr_page(doc, pno):
    pix = doc[pno].get_pixmap(dpi=150)
    res, _ = ocr(pix.tobytes('png'))
    return [item[1] for item in res] if res else []

print("Extracting GC1 Lesson 1 pages (12 to 19)...")
all_lines = {}
for p in range(12, 20):
    lines = ocr_page(doc1, p)
    all_lines[p+1] = lines
    print(f"Page {p+1}: {len(lines)} lines")

# Let's save the raw OCR output to inspect
with open('scratch/gc1_l1_ocr.json', 'w', encoding='utf-8') as f:
    json.dump(all_lines, f, ensure_ascii=False, indent=2)

print("Saved scratch/gc1_l1_ocr.json")
