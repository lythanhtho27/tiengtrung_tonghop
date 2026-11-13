import os
import pymupdf

pdf_dir = r"d:\Tho\HSK\Chuan HSK\BOYA\old BOYA\Giáo trình boya\[tiengtrungthuonghai.vn]Giáo trình Boya"
for f in os.listdir(pdf_dir):
    if "cao cấp 2" in f.lower():
        pdf_path = os.path.join(pdf_dir, f)
        print("Found:", pdf_path)
        doc = pymupdf.open(pdf_path)
        print("Total pages:", len(doc))
        print("=== Page 6 ===")
        print(doc[5].get_text()[:600])
        print("=== Page 7 ===")
        print(doc[6].get_text()[:600])
        print("=== Page 8 ===")
        print(doc[7].get_text()[:600])
        print("=== Page 12 ===")
        print(doc[11].get_text()[:600])
        print("=== Page 13 ===")
        print(doc[12].get_text()[:600])
        print("=== Page 14 ===")
        print(doc[13].get_text()[:600])
        print("=== Page 26 ===")
        print(doc[25].get_text()[:600])
        print("=== Page 27 ===")
        print(doc[26].get_text()[:600])
