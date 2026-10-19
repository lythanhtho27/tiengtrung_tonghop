import pymupdf
from rapidocr_onnxruntime import RapidOCR

ocr = RapidOCR()
doc = pymupdf.open('boya_pdf/高级飞翔篇2.pdf')

for pno in range(8, 14):
    pix = doc[pno].get_pixmap(dpi=150)
    res, _ = ocr(pix.tobytes('png'))
    lines = [item[1] for item in res] if res else []
    print(f"=== Page {pno+1} ({len(lines)} lines) ===")
    for l in lines[:8]:
        print("  ", l)
