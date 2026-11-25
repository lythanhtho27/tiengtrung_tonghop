#!/usr/bin/env python3
"""
tools/fetch_vocab_img.py — Tự động gom ảnh thật từ nguồn mở (Wikipedia tiếng Trung / Wikimedia Commons)
cho các thẻ từ vựng, nén WebP nhỏ vào shared/vocab_img/ và sinh shared/vocab_img_map.js.

Cách dùng:
  python tools/fetch_vocab_img.py                        # Tải HSK 1–3 (mặc định)
  python tools/fetch_vocab_img.py --levels 1,2,3,4       # Tải các cấp HSK chỉ định
  python tools/fetch_vocab_img.py --levels all           # Tải HSK 1–6
  python tools/fetch_vocab_img.py --source boya          # Tải từ vựng Boya (boya_data.json)
  python tools/fetch_vocab_img.py --words 苹果,火锅,长城  # Tải riêng vài từ
  python tools/fetch_vocab_img.py --limit 100            # Giới hạn số ảnh mới tải trong 1 lần chạy
  python tools/fetch_vocab_img.py --rebuild              # Chỉ dựng lại vocab_img_map.js + trang duyệt ảnh
  python tools/fetch_vocab_img.py --block 苹果,雪        # Xóa ảnh + thêm vào danh sách bỏ qua để không tải lại
"""
import argparse
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "shared" / "vocab_img"
MAP_JS = ROOT / "shared" / "vocab_img_map.js"
META_JSON = ROOT / "tools" / "vocab_img_meta.json"
BLOCKLIST_TXT = ROOT / "tools" / "vocab_img_blocklist.txt"
REVIEW_HTML = ROOT / "tools" / "scratch" / "review_vocab_img.html"

USER_AGENT = "BoyaWebVocabImg/1.0 (https://github.com/lythanhtho27/boya_web; personal Chinese study tool)"
WIKI_API = "https://zh.wikipedia.org/w/api.php"
ENWIKI_API = "https://en.wikipedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"

# Các lớp Wikidata (P31: instance of) không phải khái niệm/sự vật trực quan cho từ vựng
BAD_WD_P31 = {
    "Q5",         # human / người cụ thể
    "Q4167410",   # Wikimedia disambiguation page
    "Q101352",    # family name / họ
    "Q202444",    # given name
    "Q11424",     # film
    "Q5398426",   # television series
    "Q21191270",  # television series episode
    "Q482994",    # album
    "Q7366",      # song
    "Q134556",    # single
    "Q215380",    # musical group
    "Q13442814",  # scholarly article
    "Q7889",      # video game
    "Q7725634",   # literary work
    "Q47461344",  # written work
    "Q8274",      # manga
    "Q4830453",   # business
    "Q783794",    # company
    "Q891723",    # public company
    "Q167270",    # trademark
    "Q431289",    # brand
    "Q11032",     # newspaper
    "Q41298",     # magazine
    "Q35127",     # website
    "Q7397",      # software
    "Q3957",      # town
    "Q532",       # village
    "Q515",       # city
    "Q486972",    # human settlement
    "Q15284",     # municipality
    "Q2989457",   # Chinese character
    "Q3241972",   # Unicode character
}

BAD_WD_DESC = (
    "character", "disambiguation", "family name", "surname", "given name",
    "scholarly article", "scientific article", "film", "movie", "album", "song",
    "television", "tv series", "novel", "manga", "anime", "video game", "episode",
    "band", "singer", "actor", "actress", "politician", "writer", "director",
    "company", "brand", "trademark", "township", "subdistrict", "village",
    "municipality", "county in", "district in", "asteroid", "newspaper",
    "magazine", "journal", "radio station", "website", "software", "operatic",
)

# Các từ hư từ, đại từ, số đếm, phó từ, giới từ, từ trừu tượng cơ bản không nên lấy ảnh Wikipedia
SKIP_WORDS = {
    "我", "你", "您", "他", "她", "它", "我们", "你们", "他们", "她们", "自己", "大家", "别人",
    "的", "了", "吗", "呢", "吧", "啊", "呀", "嘛", "啦", "哇", "嗯", "哦", "哎", "喂",
    "不", "没", "没有", "别", "很", "太", "真", "非常", "极", "更", "最", "挺", "比较",
    "也", "都", "就", "才", "再", "又", "还", "已经", "正在", "刚", "刚刚", "马上", "立刻",
    "是", "有", "在", "和", "跟", "与", "或", "或者", "还是", "把", "被", "比", "从", "到",
    "对", "给", "让", "向", "往", "为", "为了", "关于", "除了", "按照", "通过", "根据",
    "这", "那", "哪", "这里", "那里", "哪里", "这儿", "那儿", "哪儿", "这么", "那么", "怎么", "怎么样",
    "谁", "什么", "为什么", "多少", "几", "每", "各", "某", "其他", "另外", "一切", "所有",
    "因为", "所以", "虽然", "但是", "可是", "不过", "如果", "要是", "只要", "只有", "即使", "无论", "不管",
    "不但", "而且", "并且", "于是", "因此", "然而", "否则", "既然", "一边", "一方面",
    "一", "二", "两", "三", "四", "五", "六", "七", "八", "九", "十", "百", "千", "万", "亿", "零", "半", "第",
    "个", "位", "名", "只", "条", "张", "本", "支", "件", "双", "对", "套", "辆", "架", "艘", "座",
    "块", "元", "角", "分", "毛", "斤", "公斤", "米", "厘米", "公里", "次", "遍", "趟", "下", "顿", "场", "种", "类", "些",
    "大", "小", "多", "少", "高", "矮", "长", "短", "好", "坏", "新", "旧", "快", "慢", "早", "晚",
    "远", "近", "冷", "热", "暖", "凉", "重", "轻", "难", "容易", "简单", "复杂", "贵", "便宜",
    "上", "下", "左", "右", "前", "后", "里", "外", "中", "内", "旁", "旁边", "中间", "对面", "附近",
    "东", "西", "南", "北", "上面", "下面", "前面", "后面", "里面", "外面",
    "今天", "明天", "昨天", "前天", "后天", "今年", "明年", "去年", "现在", "刚才", "以前", "以后", "时候", "时间",
    "年", "月", "日", "号", "点", "分钟", "小时", "秒", "星期", "周", "周末", "早上", "上午", "中午", "下午", "晚上",
    "可以", "能", "能够", "会", "要", "想", "愿意", "敢", "应该", "应当", "必须", "得", "着", "过",
    "请", "谢谢", "不客气", "对不起", "没关系", "再见", "你好", "您好", "好的", "可以", "行", "对", "错",
    "做", "去", "来", "回", "走", "跑", "站", "坐", "看", "听", "说", "读", "写", "问", "答", "叫", "让",
    "买", "卖", "找", "拿", "放", "开", "关", "用", "帮", "帮忙", "知道", "认识", "觉得", "认为", "以为",
    "希望", "喜欢", "爱", "恨", "怕", "担心", "高兴", "开心", "快乐", "难过", "伤心", "生气", "累", "忙",
    "东西", "事情", "问题", "意思", "办法", "方法", "原因", "结果", "情况", "条件", "机会", "经验", "水平",
    "关系", "作用", "影响", "变化", "发展", "进步", "提高", "增加", "减少", "开始", "结束", "完成", "继续",
    "一定", "可能", "大概", "也许", "肯定", "当然", "其实", "原来", "本来", "一直", "总是", "经常", "常常",
    "有时", "有时候", "偶尔", "很少", "从来", "终于", "突然", "忽然", "几乎", "差不多", "左右", "大约",
}

# Từ khóa trong câu định nghĩa đầu tiên của bài Wikipedia cho thấy bài không phải sự vật trực quan
BAD_EXTRACT_PATTERNS = [
    "姓氏", "漢字", "汉字", "部首", "假名", "字母", "标点", "標點",
    "消歧义", "消歧義",
    "电影", "電影", "电视剧", "電視劇", "连续剧", "連續劇", "剧集", "劇集",
    "专辑", "專輯", "歌曲", "单曲", "單曲", "乐队", "樂隊",
    "小说", "小說", "漫画", "漫畫", "动画", "動畫", "电子游戏", "電子遊戲", "网络游戏", "網絡遊戲",
    "歌手", "演员", "演員", "主持人", "政治人物", "作家", "导演", "導演",
    "品牌", "商标", "商標", "政党", "政黨",
    "年号", "年號", "朝代", "行政区", "行政區",
    "语法", "語法", "词性", "詞性", "助词", "助詞", "介词", "介詞", "连词", "連詞", "副词", "副詞",
    "量词", "量詞", "代词", "代詞", "叹词", "嘆詞", "语气词", "語氣詞",
]

# Tên file ảnh trên Wikimedia không phải ảnh chụp thực tế / dễ gây nhiễu
BAD_FILENAME_SUBSTR = [
    ".svg", ".gif", ".tif", ".tiff", ".ogg", ".ogv", ".webm", ".pdf", ".djvu",
    "flag_of", "flag-", "_flag", "locator", "location_map", "_map", "map_of", "map.",
    "diagram", "logo", "coat_of_arms", "seal_of", "emblem", "symbol", "icon",
    "chart", "graph", "distribution", "range_map", "blank_", "commons-logo",
    "wikipedia-logo", "question_book", "disambig", "ambox", "signature", "autograph",
    "calligraphy", "stroke", "order", "oracle", "bronze", "seal_script", "kaishu",
    "red_cross", "globe", "world_", "banner", "button", "arrow", "portrait_placeholder",
    "no_image", "stub", "crystal_clear", "nuvola", "tango", "gtk-", "gnome-",
    "tropical_cyclone", "tracks", "administrative", "subdivisions", "provinces",
]

HAN_RE = re.compile(r"[\u3400-\u9fff]")


def clean_hz(s: str) -> str:
    s = re.sub(r"[（(]([^）)]*)[）)](?=[\u4e00-\u9fff])", r"\1", str(s or ""))
    s = re.sub(r"\s*[（(][^）)]*[）)]\s*", "", s)
    s = re.sub(r"[\s～~…]+", "", s)
    return s.strip()


def split_variants(raw: str) -> list[str]:
    """Tách các dạng như '儿子/ 女儿' thành ['儿子', '女儿']."""
    parts = re.split(r"[/|｜、,，]+", str(raw or ""))
    out = []
    for p in parts:
        w = clean_hz(p)
        if w and HAN_RE.search(w) and w not in out:
            out.append(w)
    return out


def make_filename(word: str) -> str:
    """Tên file ASCII ổn định, tránh lỗi mã hóa URL trên file:// và GitHub Pages."""
    h = hashlib.md5(word.encode("utf-8")).hexdigest()[:8]
    codes = "_".join(f"{ord(c):x}" for c in word[:4])
    return f"v_{codes}_{h}.webp"


def load_blocklist() -> set[str]:
    if not BLOCKLIST_TXT.exists():
        return set()
    return {line.strip() for line in BLOCKLIST_TXT.read_text("utf-8").splitlines() if line.strip() and not line.startswith("#")}


def save_blocklist(items: set[str]) -> None:
    BLOCKLIST_TXT.parent.mkdir(parents=True, exist_ok=True)
    lines = ["# Danh sách từ bỏ qua không tải ảnh tự động (mỗi dòng 1 từ Hán)"] + sorted(items)
    BLOCKLIST_TXT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def load_meta() -> dict:
    if META_JSON.exists():
        try:
            return json.loads(META_JSON.read_text("utf-8"))
        except Exception:
            pass
    return {}


def save_meta(meta: dict) -> None:
    META_JSON.parent.mkdir(parents=True, exist_ok=True)
    META_JSON.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def load_hsk_words(levels: set[int]) -> list[dict]:
    path = ROOT / "hsk_lotrinh" / "hsk_vocab_data.js"
    text = path.read_text("utf-8")
    m = re.search(r"window\.HSK_VOCAB\s*=\s*(\[.*\]);?\s*$", text, re.S)
    if not m:
        raise RuntimeError(f"Không đọc được HSK_VOCAB từ {path}")
    raw_json = re.sub(r",\s*\]", "]", m.group(1))
    arr = json.loads(raw_json)
    out = []
    seen = set()
    for row in arr:
        lvl = int(row[0])
        if lvl not in levels:
            continue
        for w in split_variants(row[1]):
            if w in seen:
                continue
            seen.add(w)
            out.append({"hz": w, "py": row[2], "vi": row[3], "src": f"HSK {lvl}"})
    return out


def load_boya_words(books_filter: set[str] | None = None) -> list[dict]:
    path = ROOT / "boya_learning" / "boya_data.json"
    data = json.loads(path.read_text("utf-8"))
    out = []
    seen = set()
    books = data.get("books", data) if isinstance(data, dict) else data
    if isinstance(books, dict):
        items = books.items()
    else:
        items = [(b.get("id") or str(i), b) for i, b in enumerate(books)]
    for bkey, book in items:
        if books_filter and bkey not in books_filter:
            continue
        for lesson in book.get("lessons", []):
            words_list = lesson.get("words") or lesson.get("vocab") or []
            for v in words_list:
                raw = v.get("hz") or v.get("hanzi") or v.get("word") or ""
                for w in split_variants(raw):
                    if w in seen:
                        continue
                    seen.add(w)
                    mean = (v.get("mean") or v.get("vi") or "").strip(" /")
                    out.append({
                        "hz": w,
                        "py": v.get("py") or v.get("pinyin") or "",
                        "vi": mean,
                        "src": f"Boya {bkey}",
                    })
    return out


def http_get(url: str, timeout: int = 20, retries: int = 3) -> bytes:
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (429, 500, 502, 503, 504):
                wait = 2.0 * (attempt + 1)
                time.sleep(wait)
                continue
            raise
        except Exception as e:
            last_err = e
            time.sleep(1.5 * (attempt + 1))
    raise last_err


def query_enwiki_images(en_titles: list[str]) -> dict[str, str]:
    """Truy vấn ảnh đại diện từ Wikipedia tiếng Anh cho các bài zhwiki chưa có ảnh thật."""
    if not en_titles:
        return {}
    params = {
        "action": "query",
        "titles": "|".join(en_titles),
        "prop": "pageimages",
        "pithumbsize": 480,
        "pilicense": "free",
        "pilimit": "max",
        "redirects": 1,
        "format": "json",
        "formatversion": 2,
    }
    url = ENWIKI_API + "?" + urllib.parse.urlencode(params)
    data = json.loads(http_get(url).decode("utf-8"))
    q = data.get("query", {})
    norm_map = {n["from"]: n["to"] for n in q.get("normalized", [])}
    redir_map = {r["from"]: r["to"] for r in q.get("redirects", [])}

    def resolve(t: str) -> str:
        cur = norm_map.get(t, t)
        for _ in range(5):
            nxt = redir_map.get(cur)
            if not nxt or nxt == cur:
                break
            cur = nxt
        return cur

    pages_by_title = {p.get("title", ""): p for p in q.get("pages", [])}
    out = {}
    for t in en_titles:
        rt = resolve(t)
        p = pages_by_title.get(rt)
        if not p or p.get("missing"):
            continue
        img_url = p.get("thumbnail", {}).get("source", "")
        if img_url and not is_bad_image_url(img_url):
            out[t] = img_url
    return out


def query_zhwiki_batch(words: list[str]) -> dict[str, dict]:
    """Truy vấn tối đa 20 từ một lần từ Wikipedia tiếng Trung (có fallback sang enwiki qua langlinks)."""
    params = {
        "action": "query",
        "titles": "|".join(words),
        "prop": "pageimages|pageprops|extracts|langlinks",
        "pithumbsize": 480,
        "pilicense": "free",
        "pilimit": "max",
        "exlimit": "max",
        "lllang": "en",
        "lllimit": "max",
        "redirects": 1,
        "exintro": 1,
        "explaintext": 1,
        "exchars": 140,
        "format": "json",
        "formatversion": 2,
    }
    url = WIKI_API + "?" + urllib.parse.urlencode(params)
    data = json.loads(http_get(url).decode("utf-8"))
    q = data.get("query", {})

    # Truy vết chuỗi normalized -> redirects -> final title
    norm_map = {n["from"]: n["to"] for n in q.get("normalized", [])}
    redir_map = {r["from"]: r["to"] for r in q.get("redirects", [])}

    def resolve(w: str) -> str:
        cur = norm_map.get(w, w)
        for _ in range(5):
            nxt = redir_map.get(cur)
            if not nxt or nxt == cur:
                break
            cur = nxt
        return cur

    pages_by_title = {p.get("title", ""): p for p in q.get("pages", [])}
    results = {}
    need_en = {}  # word -> (title, en_title, extract)

    for w in words:
        title = resolve(w)
        p = pages_by_title.get(title)
        if not p or p.get("missing"):
            continue
        if "disambiguation" in p.get("pageprops", {}):
            continue
        extract = (p.get("extract") or "").strip()
        if is_bad_topic(w, title, extract):
            continue
        thumb = p.get("thumbnail", {})
        img_url = thumb.get("source", "")
        if img_url and not is_bad_image_url(img_url):
            results[w] = {
                "title": title,
                "url": img_url,
                "extract": extract[:100],
                "page": f"https://zh.wikipedia.org/wiki/{urllib.parse.quote(title)}",
            }
        else:
            lls = p.get("langlinks") or []
            if lls and lls[0].get("title"):
                need_en[w] = (title, lls[0]["title"], extract)

    # Fallback sang Wikipedia tiếng Anh cho những bài zhwiki không có ảnh hoặc chỉ có SVG/cờ/bản đồ
    if need_en:
        try:
            en_imgs = query_enwiki_images([v[1] for v in need_en.values()])
            for w, (title, en_title, extract) in need_en.items():
                if en_title in en_imgs:
                    results[w] = {
                        "title": f"{title} ({en_title})",
                        "url": en_imgs[en_title],
                        "extract": extract[:100],
                        "page": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(en_title)}",
                    }
        except Exception:
            pass

    return results


def search_wikidata_one(word: str) -> tuple[str, str, str] | None:
    """Tìm thực thể Wikidata khớp chính xác nhãn/bí danh tiếng Trung cho từ 2+ chữ."""
    if len(word) < 2:
        return None
    params = {
        "action": "wbsearchentities",
        "search": word,
        "language": "zh",
        "uselang": "en",
        "limit": 5,
        "format": "json",
    }
    url = WIKIDATA_API + "?" + urllib.parse.urlencode(params)
    try:
        data = json.loads(http_get(url, timeout=15).decode("utf-8"))
    except Exception:
        return None
    for x in data.get("search", []):
        mt = x.get("match", {}).get("text", "")
        if mt != word:
            continue
        desc = (x.get("description") or "").lower()
        if any(b in desc for b in BAD_WD_DESC):
            continue
        return (x["id"], x.get("label", ""), desc[:80])
    return None


def query_wikidata_batch(words: list[str]) -> dict[str, dict]:
    """Tra Wikidata (P18 + enwiki fallback) cho lô từ chưa có ảnh ở zhwiki."""
    found_qids = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        for w, res in zip(words, ex.map(search_wikidata_one, words)):
            if res:
                found_qids[w] = res

    if not found_qids:
        return {}

    ids = "|".join(dict.fromkeys(v[0] for v in found_qids.values()))
    params = {
        "action": "wbgetentities",
        "ids": ids,
        "props": "claims|sitelinks",
        "sitefilter": "enwiki|zhwiki",
        "format": "json",
    }
    url = WIKIDATA_API + "?" + urllib.parse.urlencode(params)
    ents = json.loads(http_get(url, timeout=20).decode("utf-8")).get("entities", {})

    results = {}
    need_en = {}
    for w, (qid, lbl, desc) in found_qids.items():
        e = ents.get(qid, {})
        claims = e.get("claims", {})
        # Kiểm tra P31 (instance of) để loại người, phim, bài hát, công ty, địa danh nhỏ...
        p31_ids = {
            c.get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id", "")
            for c in claims.get("P31", [])
        }
        if p31_ids & BAD_WD_P31:
            continue

        # Ưu tiên P18 (ảnh Commons trực tiếp)
        p18_val = ""
        for c in claims.get("P18", []):
            v = c.get("mainsnak", {}).get("datavalue", {}).get("value", "")
            if v and not is_bad_image_url(v):
                p18_val = v
                break
        if p18_val:
            commons_url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(p18_val) + "?width=480"
            results[w] = {
                "title": f"{lbl} ({qid})",
                "url": commons_url,
                "extract": desc,
                "page": f"https://www.wikidata.org/wiki/{qid}",
            }
            continue

        # Nếu không có P18 thì lấy từ enwiki sitelink
        en_title = e.get("sitelinks", {}).get("enwiki", {}).get("title", "")
        if en_title:
            need_en[w] = (qid, lbl, en_title, desc)

    if need_en:
        try:
            en_imgs = query_enwiki_images([v[2] for v in need_en.values()])
            for w, (qid, lbl, en_title, desc) in need_en.items():
                if en_title in en_imgs:
                    results[w] = {
                        "title": f"{en_title} ({qid})",
                        "url": en_imgs[en_title],
                        "extract": desc,
                        "page": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(en_title)}",
                    }
        except Exception:
            pass

    return results


def is_bad_image_url(img_url: str) -> bool:
    # Chỉ kiểm tra tên file (không kiểm tra domain wikimedia.org/wikipedia)
    path_part = urllib.parse.unquote(urllib.parse.urlparse(img_url).path).lower()
    fname = "/".join(path_part.split("/")[-2:])
    for bad in BAD_FILENAME_SUBSTR:
        if bad in fname:
            return True
    return False


def is_bad_topic(word: str, title: str, extract: str) -> bool:
    # Chỉ kiểm tra câu đầu tiên của bài để tránh lọc nhầm khi từ khóa chỉ được nhắc thoáng qua
    first_sent = extract.split("。")[0][:90]
    head = title + " " + first_sent
    for pat in BAD_EXTRACT_PATTERNS:
        if pat in word:
            continue
        if pat in head:
            return True
    if re.search(r"[（(](电影|電影|歌曲|专辑|專輯|电视剧|電視劇|小说|小說|漫画|漫畫|游戏|遊戲|姓氏|汉字|漢字|品牌|公司|人物|歌手)[）)]", title):
        return True
    return False


def is_bad_article(word: str, title: str, extract: str, img_url: str) -> bool:
    return is_bad_image_url(img_url) or is_bad_topic(word, title, extract)


def download_and_compress(url: str, dest: Path, max_w: int = 360, max_h: int = 270) -> tuple[bool, str]:
    raw = http_get(url, timeout=20)
    im = Image.open(io.BytesIO(raw))
    w, h = im.size
    if w < 120 or h < 90:
        return False, f"quá nhỏ ({w}x{h})"
    ratio = w / float(h)
    if ratio > 2.4 or ratio < 0.42:
        return False, f"tỉ lệ lệch ({w}x{h})"

    # Chuyển sang RGB (xử lý PNG nền trong suốt bằng nền trắng sạch)
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        im_rgba = im.convert("RGBA")
        bg.paste(im_rgba, mask=im_rgba.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")

    im.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=78, method=4)
    return True, f"{im.size[0]}x{im.size[1]}, {dest.stat().st_size // 1024}KB"


def rebuild_outputs(meta: dict) -> int:
    """Dựng lại shared/vocab_img_map.js và trang duyệt ảnh tools/scratch/review_vocab_img.html
    dựa trên các file .webp thực sự đang tồn tại trong shared/vocab_img/."""
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    existing_files = {p.name for p in IMG_DIR.glob("*.webp")}

    mapping = {}
    cleaned_meta = {}
    for w, info in sorted(meta.items()):
        fn = info.get("file", "")
        if fn in existing_files:
            mapping[w] = fn
            cleaned_meta[w] = info

    save_meta(cleaned_meta)

    js_lines = [
        "/* ==========================================================================",
        "   SHARED/VOCAB_IMG_MAP.JS — bảng ánh xạ từ Hán → ảnh thật (shared/vocab_img/*.webp)",
        "   - Tự động sinh bởi tools/fetch_vocab_img.py (nguồn: Wikimedia Commons / Wikipedia).",
        "   - Dùng bởi shared/visual.js (HocVisual.photo).",
        "   ========================================================================== */",
        "window.HOC_IMG = " + json.dumps(mapping, ensure_ascii=False, separators=(",", ":")) + ";",
        "",
    ]
    MAP_JS.write_text("\n".join(js_lines), encoding="utf-8")

    # Sinh trang HTML duyệt nhanh ảnh (đánh dấu ảnh xấu → copy 1 lệnh để xóa & block)
    REVIEW_HTML.parent.mkdir(parents=True, exist_ok=True)
    cards = []
    for w, info in sorted(cleaned_meta.items(), key=lambda kv: (kv[1].get("src", ""), kv[0])):
        fn = info["file"]
        py = info.get("py", "")
        vi = info.get("vi", "")
        src = info.get("src", "")
        title = info.get("title", "")
        cards.append(
            f'<div class="card" data-w="{w}">'
            f'<img src="../../shared/vocab_img/{fn}" loading="lazy" alt="{w}">'
            f'<div class="hz">{w}</div>'
            f'<div class="py">{py}</div>'
            f'<div class="vi">{vi}</div>'
            f'<div class="meta">{src} · {title}</div>'
            f'</div>'
        )
    html = f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Duyệt ảnh từ vựng ({len(cleaned_meta)} ảnh)</title>
<style>
body{{font:14px/1.4 system-ui,sans-serif;margin:0;padding:16px;background:#f8fafc;color:#0f172a}}
.top{{position:sticky;top:0;background:#fff;padding:12px 16px;border:1px solid #cbd5e1;border-radius:12px;margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;z-index:10}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:12px}}
.card{{background:#fff;border:2px solid #e2e8f0;border-radius:12px;padding:8px;cursor:pointer;transition:.15s}}
.card:hover{{border-color:#6366f1}}
.card.bad{{border-color:#ef4444;background:#fef2f2;opacity:.7}}
.card img{{width:100%;height:120px;object-fit:cover;border-radius:8px;background:#e2e8f0;display:block}}
.hz{{font-size:20px;font-weight:700;margin-top:6px}}
.py{{font-size:12px;color:#0369a1}}
.vi{{font-size:12.5px;color:#334155}}
.meta{{font-size:11px;color:#64748b;margin-top:4px}}
button{{padding:6px 12px;border-radius:8px;border:1px solid #cbd5e1;background:#4f46e5;color:#fff;font-weight:600;cursor:pointer}}
code{{background:#f1f5f9;padding:4px 8px;border-radius:6px;font-size:12px;max-width:520px;overflow:auto;white-space:nowrap}}
</style></head><body>
<div class="top">
  <b>Duyệt ảnh từ vựng ({len(cleaned_meta)} ảnh)</b>
  <span>Chạm vào ảnh sai nghĩa để đánh dấu xóa (<b id="cnt">0</b>)</span>
  <button id="copy">📋 Copy lệnh xóa ảnh đã chọn</button>
  <code id="cmd"></code>
</div>
<div class="grid">{''.join(cards)}</div>
<script>
const bad = new Set();
function upd() {{
  document.getElementById('cnt').textContent = bad.size;
  const list = Array.from(bad).join(',');
  document.getElementById('cmd').textContent = list ? 'python tools/fetch_vocab_img.py --block ' + list : '';
}}
document.querySelectorAll('.card').forEach(c => c.onclick = () => {{
  const w = c.dataset.w;
  if (bad.has(w)) {{ bad.delete(w); c.classList.remove('bad'); }}
  else {{ bad.add(w); c.classList.add('bad'); }}
  upd();
}});
document.getElementById('copy').onclick = () => {{
  const t = document.getElementById('cmd').textContent;
  if (t) navigator.clipboard.writeText(t).then(() => alert('Đã copy lệnh! Dán vào terminal để xóa.'));
}};
</script></body></html>"""
    REVIEW_HTML.write_text(html, encoding="utf-8")
    return len(mapping)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description="Tự động gom ảnh thật từ nguồn mở cho thẻ từ vựng")
    ap.add_argument("--source", choices=["hsk", "boya"], default="hsk", help="Nguồn từ vựng (mặc định: hsk)")
    ap.add_argument("--levels", default="1,2,3", help="Các cấp HSK, ví dụ 1,2,3 hoặc all (mặc định: 1,2,3)")
    ap.add_argument("--books", default="", help="Lọc quyển Boya, ví dụ tc1,tc2")
    ap.add_argument("--words", default="", help="Tải riêng các từ cách nhau bằng dấu phẩy")
    ap.add_argument("--limit", type=int, default=0, help="Giới hạn số ảnh mới tải trong 1 lần chạy (0 = không giới hạn)")
    ap.add_argument("--deep", action="store_true", help="Tìm sâu thêm qua Wikidata (P18 + enwiki) cho các từ chưa có ảnh ở zhwiki")
    ap.add_argument("--rebuild", action="store_true", help="Chỉ dựng lại vocab_img_map.js và trang duyệt ảnh")
    ap.add_argument("--block", default="", help="Xóa ảnh và thêm các từ vào blocklist (cách nhau bằng dấu phẩy)")
    args = ap.parse_args()

    meta = load_meta()
    blocklist = load_blocklist()

    if args.block:
        to_block = [clean_hz(x) for x in args.block.split(",") if clean_hz(x)]
        removed = 0
        for w in to_block:
            blocklist.add(w)
            info = meta.pop(w, None)
            if info:
                p = IMG_DIR / info.get("file", "")
                if p.exists():
                    p.unlink()
                    removed += 1
        save_blocklist(blocklist)
        total = rebuild_outputs(meta)
        print(f"Đã xóa {removed} ảnh và chặn {len(to_block)} từ. Còn lại {total} ảnh trong vocab_img_map.js.")
        return

    if args.rebuild:
        total = rebuild_outputs(meta)
        print(f"Đã dựng lại shared/vocab_img_map.js ({total} ảnh) và {REVIEW_HTML.relative_to(ROOT)}.")
        return

    # Chuẩn bị danh sách từ cần tìm ảnh
    if args.words:
        vocab = [{"hz": clean_hz(w), "py": "", "vi": "", "src": "manual"} for w in args.words.split(",") if clean_hz(w)]
    elif args.source == "hsk":
        lvls = {1, 2, 3, 4, 5, 6} if args.levels.strip().lower() == "all" else {int(x) for x in args.levels.split(",") if x.strip().isdigit()}
        vocab = load_hsk_words(lvls)
    else:
        bf = {x.strip() for x in args.books.split(",") if x.strip()} or None
        vocab = load_boya_words(bf)

    # Lọc các từ chưa có ảnh, không thuộc SKIP_WORDS / blocklist
    todo = []
    for item in vocab:
        w = item["hz"]
        if not w or w in blocklist or (not args.words and w in SKIP_WORDS):
            continue
        if w in meta and (IMG_DIR / meta[w].get("file", "")).exists():
            continue
        todo.append(item)

    print(f"Tổng từ nguồn: {len(vocab)} | Cần tra ảnh: {len(todo)} | Đã có sẵn: {len(meta)}")
    if not todo:
        rebuild_outputs(meta)
        return

    added = 0
    skipped = 0
    batch_size = 30 if args.deep else 20
    for i in range(0, len(todo), batch_size):
        if args.limit and added >= args.limit:
            break
        batch = todo[i : i + batch_size]
        words = [x["hz"] for x in batch]
        by_word = {x["hz"]: x for x in batch}
        try:
            hits = query_wikidata_batch(words) if args.deep else query_zhwiki_batch(words)
        except Exception as e:
            print(f"  [!] Lỗi truy vấn batch {i}: {e}")
            continue

        for w, hit in hits.items():
            if args.limit and added >= args.limit:
                break
            fn = make_filename(w)
            dest = IMG_DIR / fn
            try:
                ok, info_str = download_and_compress(hit["url"], dest)
                if ok:
                    item = by_word[w]
                    meta[w] = {
                        "file": fn,
                        "title": hit["title"],
                        "page": hit["page"],
                        "py": item["py"],
                        "vi": item["vi"],
                        "src": item["src"],
                    }
                    added += 1
                    print(f"  [+] {w} ({item['vi'][:28]}) -> {fn} [{info_str}]")
                else:
                    skipped += 1
            except Exception as e:
                skipped += 1
                print(f"  [x] {w}: lỗi tải ({e})")
            time.sleep(0.12)

        # Lưu tiến độ sau mỗi batch để lỡ ngắt giữa chừng không mất công
        save_meta(meta)

    total = rebuild_outputs(meta)
    print(f"\nHoàn tất! Tải mới: {added} ảnh | Bỏ qua: {skipped} | Tổng hiện có: {total} ảnh.")
    print(f"File bản đồ: {MAP_JS.relative_to(ROOT)}")
    print(f"Trang duyệt ảnh: {REVIEW_HTML.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
