import pymupdf
from rapidocr_onnxruntime import RapidOCR

ocr = RapidOCR()
doc1 = pymupdf.open('boya_pdf/高级飞翔篇1.pdf')

# End pages of each lesson in GC1 approx:
# L1: 29-32
# L2: 50-53
# L3: 71-74
# L4: 93-96
# L5: 113-116
# L6: 134-137
# L7: 155-158
# L8: 175-178
# L9: 199-202
# L10: 222-225

check_pages = [29, 30, 50, 51, 71, 72, 93, 94, 113, 114, 134, 135, 155, 156, 175, 176, 199, 200, 222, 223]

print("Scanning for GC1 Reading 2 titles...")
for p in check_pages:
    pix = doc1[p-1].get_pixmap(dpi=120)
    res, _ = ocr(pix.tobytes('png'))
    lines = [item[1] for item in res] if res else []
    for i, l in enumerate(lines):
        if "阅读与理解" in l or "阅读" in l:
            sub = lines[max(0, i-1):min(len(lines), i+3)]
            print(f"Page {p}: {sub}")
