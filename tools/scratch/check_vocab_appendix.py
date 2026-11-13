import pymupdf
import re

# In GC2 (doc2)
doc2 = pymupdf.open(r"d:\Tho\HSK\Chuan HSK\BOYA\boya_tonghop_html\boya_pdf\高级飞翔篇2.pdf")
print("Doc2 pages:", len(doc2))
# Earlier TOC showed:
# Appendix 1: 词语索引 on book p. 271 -> PDF p. 281 approx
for p in range(275, 288):
    t = doc2[p].get_text()
    if "词语索引" in t or "附录一" in t or len(t) > 500:
        print(f"Doc2 page {p+1}: {t[:200]}")
