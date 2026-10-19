import pymupdf
import os

pdf_dir = r"d:\Tho\HSK\Chuan HSK\BOYA\old BOYA\Giáo trình boya\[tiengtrungthuonghai.vn]Giáo trình Boya"
for f in os.listdir(pdf_dir):
    if "cao cấp 2" in f.lower():
        pdf2_path = os.path.join(pdf_dir, f)

doc2 = pymupdf.open(pdf2_path)
print("Searching for appendix in GC2...")
for p in range(len(doc2)-20, len(doc2)):
    t = doc2[p].get_text()
    for kw in ["附录", "语言点", "词语辨析", "每天都冒一点险", "生词总表"]:
        if kw in t:
            print(f"Page {p+1}: contains '{kw}', preview: {t[:120].strip()}")
            break
