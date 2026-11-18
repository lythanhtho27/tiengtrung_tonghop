"""In JSON một chương (paragraphs + translations, có đánh số đoạn) để dán vào prompt làm kịch bản.

    python tools/comics/chapter_json.py s10-03
"""
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "tools", "doc_them_src")


def find_text(doc_id):
    for f in glob.glob(os.path.join(SRC, "*.json")):
        try:
            data = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        items = data if isinstance(data, list) else data.get("texts", [])
        for t in items:
            if isinstance(t, dict) and t.get("id") == doc_id:
                return t
    return None


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    t = find_text(sys.argv[1])
    if not t:
        sys.exit("Không tìm thấy bài " + sys.argv[1])
    out = {
        "id": t["id"],
        "title": t.get("title"),
        "paragraphs": {i: p for i, p in enumerate(t["paragraphs"])},
        "translations": {i: p for i, p in enumerate(t.get("translations", []))},
    }
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
