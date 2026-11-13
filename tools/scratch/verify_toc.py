import pymupdf
from rapidocr_onnxruntime import RapidOCR

ocr = RapidOCR()

doc1 = pymupdf.open('boya_pdf/高级飞翔篇1.pdf')
doc2 = pymupdf.open('boya_pdf/高级飞翔篇2.pdf')

def scan_page(doc, pno):
    pix = doc[pno].get_pixmap(dpi=130)
    res, _ = ocr(pix.tobytes('png'))
    lines = [item[1] for item in res] if res else []
    return lines

print("=== CHECKING GC1 (高级飞翔篇 1) TOC ===")
lines = scan_page(doc1, 11) # Page 12
for l in lines:
    print("  ", l)

print("\n=== CHECKING GC2 (高级飞翔篇 2) TOC ===")
lines = scan_page(doc2, 8) # Page 9
for l in lines:
    print("  ", l)
