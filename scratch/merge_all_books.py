# -*- coding: utf-8 -*-
"""
Merge GC1 and GC2 into boya_data.json and boya_data.js
Ensures tc1, tc2, tc3, tc4 remain completely untouched.
"""

import json
import os

with open("boya_data.json", "r", encoding="utf-8") as f:
    master = json.load(f)

with open("scratch/gc1_book.json", "r", encoding="utf-8") as f:
    gc1_book = json.load(f)

with open("scratch/gc2_book.json", "r", encoding="utf-8") as f:
    gc2_book = json.load(f)

# Filter out existing gc1 or gc2 if any
existing_books = [b for b in master["books"] if b["id"] not in ("gc1", "gc2")]

print(f"Existing original books preserved: {[b['id'] for b in existing_books]}")
for b in existing_books:
    print(f"  - {b['id']} ({b['name']}): {len(b['lessons'])} lessons, {b['total_vocab']} vocab")

# Append gc1 and gc2
new_books = existing_books + [gc1_book, gc2_book]

total_lessons = sum(len(b["lessons"]) for b in new_books)
total_vocab = sum(sum(len(l.get("words", [])) for l in b["lessons"]) for b in new_books)
total_readings = sum(sum(len(l.get("readings", [])) for l in b["lessons"]) for b in new_books)

master["total_books"] = len(new_books)
master["total_lessons"] = total_lessons
master["total_vocab"] = total_vocab
master["total_readings"] = total_readings
master["updated_at"] = "2026-10-19"
master["books"] = new_books

# Write to boya_data.json
with open("boya_data.json", "w", encoding="utf-8") as f:
    json.dump(master, f, ensure_ascii=False, indent=2)
print("Updated boya_data.json successfully!")

# Write to boya_data.js
with open("boya_data.js", "w", encoding="utf-8") as f:
    f.write("window.BOYA_DATA = ")
    json.dump(master, f, ensure_ascii=False)
    f.write(";\n")
print("Updated boya_data.js successfully!")

print("\n=== SUMMARY OF ALL 6 BOOKS ===")
print(f"Total Books: {master['total_books']}")
print(f"Total Lessons: {master['total_lessons']}")
print(f"Total Vocabulary: {master['total_vocab']}")
print(f"Total Readings: {master['total_readings']}")
for b in master["books"]:
    print(f"  [{b['id']}] {b['title']}: {len(b['lessons'])} bài, {b['total_vocab']} từ vựng, PDF: {b['pdf']}")
