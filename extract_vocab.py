import os
import sys
import re
import json

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

BOOKS = [
    {
        "file": "tc1.html",
        "id": "tc1",
        "name": "Trung Cấp 1",
        "title": "Boya Chinese Trung Cấp 1",
        "level": 1,
        "color": "#2980b9",
        "audio_folder": "Trung cap 1"
    },
    {
        "file": "tc2.html",
        "id": "tc2",
        "name": "Trung Cấp 2",
        "title": "Boya Chinese Trung Cấp 2",
        "level": 2,
        "color": "#d35400",
        "audio_folder": "Trung cap 2"
    },
    {
        "file": "tc3.html",
        "id": "tc3",
        "name": "Trung Cấp 3",
        "title": "Boya Chinese Trung Cấp 3",
        "level": 3,
        "color": "#27ae60",
        "audio_folder": "Trung cap 3"
    },
    {
        "file": "tc4.html",
        "id": "tc4",
        "name": "Trung Cấp 4",
        "title": "Boya Chinese Trung Cấp 4",
        "level": 4,
        "color": "#8e44ad",
        "audio_folder": "Trung cap 4"
    }
]

def clean_text(text):
    if not text:
        return ""
    # remove html tags
    clean = re.sub(r'<[^>]+>', '', text)
    # unescape common entities
    clean = clean.replace('&nbsp;', ' ').replace('&quot;', '"').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    return clean.strip()

def extract_all():
    dataset = {
        "books": [],
        "total_words": 0,
        "total_lessons": 0
    }
    
    global_word_count = 0
    global_lesson_count = 0

    for book_info in BOOKS:
        fpath = os.path.join(BASE_DIR, book_info["file"])
        if not os.path.exists(fpath):
            print(f"Error: {fpath} not found!")
            continue

        with open(fpath, 'r', encoding='utf-8') as f:
            html = f.read()

        btn_matches = re.findall(r'<div class="main-btn[^"]*"\s+data-main="([^"]+)"[^>]*>([\s\S]*?)</div>', html)
        
        book_data = {
            "id": book_info["id"],
            "name": book_info["name"],
            "title": book_info["title"],
            "level": book_info["level"],
            "color": book_info["color"],
            "total_vocab": 0,
            "lessons": []
        }

        for i, (main_id, btn_text) in enumerate(btn_matches):
            global_lesson_count += 1
            next_id = btn_matches[i+1][0] if i + 1 < len(btn_matches) else None
            if next_id:
                pattern = rf'<div id="{main_id}" class="main-content[^"]*">([\s\S]*?)(?=<div id="{next_id}" class="main-content)'
            else:
                pattern = rf'<div id="{main_id}" class="main-content[^"]*">([\s\S]*?)(?=(?:<script|</body>|$))'
            
            m_block = re.search(pattern, html)
            if not m_block:
                continue
            block = m_block.group(1)

            # Title
            tm = re.search(r'<h1[^>]*class="lesson-title"[^>]*>([\s\S]*?)</h1>', block)
            title = ""
            if tm:
                title = clean_text(tm.group(1))
            else:
                tm_ruby = re.search(r'<!--\s*Tiêu đề bài học\s*-->\s*<span[^>]*>([\s\S]*?)</span>', block)
                if tm_ruby:
                    clean_t = re.sub(r'<rt>[\s\S]*?</rt>', '', tm_ruby.group(1))
                    title = clean_text(clean_t)
                else:
                    tm_h1 = re.search(r'<h1[^>]*>([\s\S]*?)</h1>', block)
                    if tm_h1:
                        clean_t = re.sub(r'<rt>[\s\S]*?</rt>', '', tm_h1.group(1))
                        title = clean_text(clean_t)

            lesson_num = i + 1
            # Check audio file
            audio_filename = f"第{lesson_num:02d}课 Tu Vung.mp3"
            audio_rel_path = f"audio/{book_info['audio_folder']}/{audio_filename}"
            audio_full_path = os.path.join(BASE_DIR, "audio", book_info["audio_folder"], audio_filename)
            has_audio = os.path.exists(audio_full_path)

            lesson_data = {
                "id": f"{book_info['id']}_{main_id}",
                "main_id": main_id,
                "lesson_num": lesson_num,
                "lesson_name": f"Bài {lesson_num}",
                "title": title,
                "audio": audio_rel_path if has_audio else None,
                "total_vocab": 0,
                "words": []
            }

            # Find all vocab tables
            for tbl_match in re.finditer(r'<table class="vocab-table">([\s\S]*?)</table>', block):
                tbl_pos = tbl_match.start()
                prev_chunk = block[max(0, tbl_pos - 350):tbl_pos]
                is_proper = ("Tên riêng" in prev_chunk) or ("专名" in prev_chunk)

                tbl_html = tbl_match.group(1)
                rows = re.findall(r'<tr>([\s\S]*?)</tr>', tbl_html)
                for row in rows:
                    hz_m = re.search(r'<td class="vocab-hz">([\s\S]*?)</td>', row)
                    if not hz_m:
                        continue
                    py_m = re.search(r'<td class="vocab-py">([\s\S]*?)</td>', row)
                    type_m = re.search(r'<td class="vocab-type">([\s\S]*?)</td>', row)
                    mean_m = re.search(r'<td class="vocab-mean">([\s\S]*?)</td>', row)

                    raw_hz = clean_text(hz_m.group(1))
                    raw_py = clean_text(py_m.group(1)) if py_m else ""
                    raw_type = clean_text(type_m.group(1)) if type_m else ("【专名】" if is_proper else "")

                    mean_html = mean_m.group(1) if mean_m else ""
                    # extract examples
                    examples = []
                    ex_matches = re.findall(r'<span class="vocab-example">([\s\S]*?)</span>', mean_html)
                    for ex in ex_matches:
                        ex_clean = clean_text(ex)
                        if ex_clean:
                            # remove leading ◎ if any
                            ex_clean = re.sub(r'^[◎\s]+', '', ex_clean).strip()
                            if ex_clean:
                                examples.append(ex_clean)

                    pure_mean_html = re.sub(r'<span class="vocab-example">[\s\S]*?</span>', '', mean_html)
                    pure_mean_html = re.sub(r'<br\s*/?>', ' / ', pure_mean_html)
                    pure_mean = clean_text(pure_mean_html)
                    pure_mean = re.sub(r'\s+', ' ', pure_mean).strip()

                    global_word_count += 1
                    word_item = {
                        "id": f"{book_info['id']}_{lesson_num}_{len(lesson_data['words']) + 1}",
                        "book_id": book_info["id"],
                        "book_name": book_info["name"],
                        "lesson_num": lesson_num,
                        "lesson_title": title,
                        "hz": raw_hz,
                        "py": raw_py,
                        "type": raw_type,
                        "mean": pure_mean,
                        "examples": examples,
                        "is_proper": is_proper
                    }
                    lesson_data["words"].append(word_item)

            lesson_data["total_vocab"] = len(lesson_data["words"])
            book_data["lessons"].append(lesson_data)
            book_data["total_vocab"] += lesson_data["total_vocab"]

        dataset["books"].append(book_data)

    dataset["total_words"] = global_word_count
    dataset["total_lessons"] = global_lesson_count

    # Write vocab_data.json
    json_path = os.path.join(BASE_DIR, "vocab_data.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)
    print(f"Saved: {json_path}")

    # Write vocab_data.js for fast direct loading without CORS
    js_path = os.path.join(BASE_DIR, "vocab_data.js")
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write("/**\n * Boya Chinese Vocabulary Dataset\n * Generated automatically from tc1.html, tc2.html, tc3.html, tc4.html\n")
        f.write(f" * Total books: {len(dataset['books'])}, Total lessons: {dataset['total_lessons']}, Total words: {dataset['total_words']}\n */\n")
        f.write("window.BOYA_VOCAB_DATA = ")
        json.dump(dataset, f, ensure_ascii=False)
        f.write(";\n")
    print(f"Saved: {js_path}")

    print("\nSUMMARY:")
    print(f"Total Books: {len(dataset['books'])}")
    print(f"Total Lessons: {dataset['total_lessons']}")
    print(f"Total Words: {dataset['total_words']}")
    for b in dataset["books"]:
        print(f"  - {b['name']}: {len(b['lessons'])} bài, {b['total_vocab']} từ vựng")

if __name__ == "__main__":
    extract_all()
