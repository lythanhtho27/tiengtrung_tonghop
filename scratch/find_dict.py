import os
import glob
import sqlite3
import json

print("Searching for databases and dictionaries...")
for root, dirs, files in os.walk(r"d:\Tho\HSK"):
    for f in files:
        if f.endswith('.db') or f.endswith('.sqlite') or 'dict' in f.lower() or 'hanviet' in f.lower():
            p = os.path.join(root, f)
            print(f"File: {p} ({os.path.getsize(p)} bytes)")
            if f.endswith('.db') or f.endswith('.sqlite'):
                try:
                    conn = sqlite3.connect(p)
                    cur = conn.cursor()
                    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
                    tables = cur.fetchall()
                    print(f"  -> Tables: {tables}")
                    conn.close()
                except Exception as e:
                    print(f"  -> DB Error: {e}")
