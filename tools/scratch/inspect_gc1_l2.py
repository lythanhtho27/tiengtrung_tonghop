import pymupdf
from rapidocr_onnxruntime import RapidOCR

ocr = RapidOCR()
doc1 = pymupdf.open('boya_pdf/高级飞翔篇1.pdf')

print("Checking GC1 Lesson 2 pages (33 to 45)...")
for p in range(32, 45):
    pix = doc1[p].get_pixmap(dpi=130)
    res, _ = ocr(pix.tobytes('png'))
    lines = [item[1] for item in res] if res else []
    first_line = lines[0] if lines else "EMPTY"
    keywords = [l for l in lines if any(k in l for k in ['课文', '生词', '语言点', '词语辨析', '阅读与理解', '请按'])]
    print(f"Page {p+1}: {len(lines)} lines | First: {first_line[:30]} | Keywords: {keywords[:3]}")
