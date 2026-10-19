import re
import json

with open("scratch/gc2_l1_raw.txt", "r", encoding="utf-8") as f:
    raw = f.read()

# Let's see how pages are demarcated
pages = raw.split("--- PAGE BREAK ---")
print(f"Total pages in raw: {len(pages)}")

# In each page, let's see lines
for i, page in enumerate(pages[:8]):
    lines = [l.strip() for l in page.splitlines() if l.strip()]
    print(f"=== Page {i+1} ({len(lines)} lines) ===")
    print("  First line:", lines[0] if lines else "")
    for l in lines:
        if any(k in l for k in ["生词", "词语", "语言点", "阅读与理解", "课文"]):
            print("  Marker:", l)
