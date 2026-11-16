/* ==========================================================================
   DOC_THEM.JS — Trang "Đọc thêm"
   - Tab Thư viện: tài liệu theo loại (doc_data.js, window.DOC_LIBRARY.texts, trường "kind"; thiếu = article):
       📄 article (bài đọc) · 📚 series (truyện dài: series, series_title(_vi), chapter — gom thành bộ truyện)
       💬 dialogue (hội thoại: speakers, scene_vi, mỗi đoạn "Tên：lời") · 🏮 chengyu (thành ngữ: idiom {hz, py, hv, meaning, usage, examples})
     lọc theo loại + cấp HSK + ô tìm kiếm (tiêu đề TQ/Việt, chủ đề)
   - Tab Luyện thi HSK: đề đọc kiểu HSK (DOC_LIBRARY.exams: sections xuanci / paixu / yuedu), bấm giờ, chấm điểm, xem lại
   - Tab Bài của tôi: người học tự dán bài, pinyin sinh bằng HocLookup.pinyinOf
   - Tab Bài khóa đã học: bài khóa Boya của các bài đã mở (nạp lười ../boya_learning/boya_data.js)
   - Trình đọc chung: pinyin, cỡ chữ, tô từ chưa học, bản dịch, chạm để tra (shared/lookup.js),
     nghe/nhại (speechSynthesis zh-CN), đọc tính giờ (chữ/phút), câu hỏi đọc hiểu.
   Key localStorage "doc_them_v1" = {
     settings: { tab, kind, level, examLv, examPy, py, size, hl, tr: "off"|"para"|"all", lookup, rate, autoHide },
     mine: [{ id, title, text, added }],
     read: { "<id>": { done, at, quiz: { c, n }, cpm: [{ at, v }] } }
       id: bài thư viện "h3-02" · bài của tôi "m<số>" · bài khóa Boya "boya:<lesson_id>:<chỉ số bài đọc>"
     exams: { "<id đề>": { best, last, at, tries } }      best/last = % điểm
   }
   URL: ?id=<bài thư viện mọi loại> · ?mine=<id> · ?boya=<lesson_id>&r=<n> · ?exam=e4-01
   Tóm tắt cho trang chủ: HocProgress.save("doc_them", { next, nextUrl, today: { n }, learned })
   ========================================================================== */
(function () {
    "use strict";

    var KEY = "doc_them_v1";
    var DICT_URL = "../shared/dict_vi.js";
    var BOYA_URL = "../boya_learning/boya_data.js";
    var LT_URL = "../luyen_tap/lt_data.js";
    var CPM_WORDS = 150;                       // tốc độ ước tính để tính phút đọc
    var HAN = /[㐀-鿿]/;
    var HAN_G = /[㐀-鿿]/g;
    var LIB = (window.DOC_LIBRARY && window.DOC_LIBRARY.texts) || [];
    var EXAMS = (window.DOC_LIBRARY && window.DOC_LIBRARY.exams) || [];
    var BOOK_NAMES = { tc1: "Chuẩn Trung cấp 1", tc2: "Chuẩn Trung cấp 2", tc3: "Trung cấp 1", tc4: "Trung cấp 2", gc1: "Cao cấp 1", gc2: "Cao cấp 2" };
    var BOOK_ORDER = ["tc1", "tc2", "tc3", "tc4", "gc1", "gc2"];

    var $ = function (id) { return document.getElementById(id); };
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function readJSON(k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
    function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.warn("Không lưu được " + k, e); return false; } }
    function startOfDay(t) { var d = new Date(t === undefined ? Date.now() : t); d.setHours(0, 0, 0, 0); return d.getTime(); }
    function hanCount(s) { return (String(s || "").match(HAN_G) || []).length; }
    function minutesOf(n) { return Math.max(1, Math.round(n / CPM_WORDS)); }
    // Bỏ chú thích trong ngoặc: "（杯）子" -> "杯子", "打（电话）" -> "打" (giống luyen_tap.js)
    function cleanHz(s) {
        var t = String(s || "").replace(/[（(]([^）)]*)[）)](?=[一-鿿])/g, "$1");
        t = t.replace(/\s*[（(][^）)]*[）)]\s*/g, "");
        return t.replace(/\s+/g, "").trim() || String(s || "");
    }
    function loadScript(url) {
        return new Promise(function (resolve) {
            var s = document.createElement("script");
            s.src = url;
            s.onload = function () { resolve(true); };
            s.onerror = function () { resolve(false); };
            document.head.appendChild(s);
        });
    }
    var toastTimer;
    function toast(msg) {
        var t = $("toast");
        t.textContent = msg; t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
    }

    // ====================================================================== Trạng thái
    var DEFAULT_SETTINGS = { tab: "lib", kind: "all", level: 0, examLv: 0, examPy: false, py: true, size: 22, hl: false, tr: "para", lookup: true, rate: 0.9, autoHide: true };
    var S = (function () {
        var v = readJSON(KEY, null) || {};
        return {
            settings: Object.assign({}, DEFAULT_SETTINGS, v.settings || {}),
            mine: Array.isArray(v.mine) ? v.mine : [],
            read: v.read && typeof v.read === "object" ? v.read : {},
            exams: v.exams && typeof v.exams === "object" ? v.exams : {}
        };
    })();
    function save() {
        writeJSON(KEY, S);
        writeSummary();
    }
    function rec(id) { return S.read[id] || (S.read[id] = { done: false, at: 0 }); }

    function writeSummary() {
        if (!window.HocProgress) return;
        var today = startOfDay(), n = 0, learned = 0;
        Object.keys(S.read).forEach(function (id) {
            var r = S.read[id];
            if (!r || !r.done) return;
            learned++;
            if (r.at >= today) n++;
        });
        // bài nên đọc tiếp: bài thư viện chưa đọc đầu tiên ở cấp thấp nhất còn bài chưa đọc
        var next = null;
        for (var i = 0; i < LIB.length; i++) { if (!(S.read[LIB[i].id] && S.read[LIB[i].id].done)) { next = LIB[i]; break; } }
        HocProgress.save("doc_them", {
            next: next ? "Đọc thêm · HSK " + next.level + " · " + next.title : "Đã đọc hết thư viện",
            nextUrl: "doc_them/doc_them.html" + (next ? "?id=" + encodeURIComponent(next.id) : ""),
            today: { n: n },
            learned: learned
        });
    }

    // ====================================================================== Từ đã học (tập chữ Hán)
    var known = null;        // Set các từ đã học
    var knownChars = null;   // Set các chữ xuất hiện trong từ đã học
    var knownVer = 0;        // tăng mỗi lần dựng lại, để bỏ bộ nhớ đệm % biết
    function addKnown(set, raw) {
        String(raw || "").split(/[\/、,，;；|\s]+/).forEach(function (p) {
            var w = cleanHz(p).replace(/[^㐀-鿿]/g, "");
            if (w) set.add(w);
        });
    }
    function boyaIds() {
        var ids = [];
        var bp = readJSON("boya_learning_progress_v2", {}) || {};
        Object.keys(bp.srs || {}).forEach(function (id) { ids.push(id); });
        Object.keys(readJSON("boya_tv_srs", {}) || {}).forEach(function (id) { ids.push(id); });
        return ids;
    }
    function buildKnown() {
        var set = new Set();
        var hs = readJSON("hsk_lotrinh_v1", {}) || {};
        Object.keys(hs.srs || {}).forEach(function (id) { addKnown(set, id.slice(id.indexOf("-") + 1)); });
        var wl = readJSON("hsk_wl_srs_v3", {}) || {};
        Object.keys(wl).forEach(function (id) { if (wl[id] && wl[id].hz) addKnown(set, wl[id].hz); });
        if (window.HocMyWords) HocMyWords.all().forEach(function (e) { addKnown(set, e.hz); });
        var LT = window.LT_DATA;
        if (LT && LT.words) boyaIds().forEach(function (id) { var w = LT.words[id]; if (w) addKnown(set, w[0]); });
        var chars = new Set();
        set.forEach(function (w) { for (var i = 0; i < w.length; i++) chars.add(w[i]); });
        known = set; knownChars = chars; knownVer++;
        knownCache = {};
    }
    // Nạp lt_data.js khi có thẻ Boya (để đổi id thẻ -> chữ Hán), rồi dựng tập từ đã học
    var knownReady = null;
    function ensureKnown() {
        if (knownReady) return knownReady;
        var need = !window.LT_DATA && boyaIds().length > 0;
        knownReady = (need ? loadScript(LT_URL) : Promise.resolve(true)).then(function () { buildKnown(); return true; });
        return knownReady;
    }
    function isKnownTok(t) {
        if (!known) return false;
        if (known.has(t)) return true;
        return t.length === 1 && knownChars.has(t);
    }
    // % chữ Hán thuộc từ đã biết (tách từ bằng từ điển)
    var knownCache = {};
    function knownPct(key, paras) {
        if (!known || !HocLookup.ready()) return null;
        if (knownCache[key] != null) return knownCache[key];
        var tot = 0, ok = 0;
        paras.forEach(function (p) {
            HocLookup.segment(p).forEach(function (s) {
                if (!HAN.test(s.t)) return;
                var n = hanCount(s.t);
                tot += n;
                if (isKnownTok(s.t)) ok += n;
            });
        });
        return (knownCache[key] = tot ? Math.round(ok * 100 / tot) : 0);
    }
    function knownHTML(pct) {
        if (pct == null) return '<div class="known"><div class="known-bar"><i></i></div><div class="known-txt">Đang tính % từ đã biết…</div></div>';
        return '<div class="known"><div class="known-bar"><i style="width:' + pct + '%"></i></div><div class="known-txt">Biết ' + pct + "% từ" +
            (pct >= 90 ? " · vừa sức" : pct >= 75 ? " · hơi khó" : " · khó") + "</div></div>";
    }

    // ====================================================================== Tab
    var TABS = ["lib", "mine", "boya", "exam"];
    function setTab(tab) {
        if (TABS.indexOf(tab) < 0) tab = "lib";
        S.settings.tab = tab; save();
        document.querySelectorAll(".tab").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === tab); b.setAttribute("aria-selected", b.dataset.tab === tab); });
        TABS.forEach(function (t) { $("tab-" + t).hidden = t !== tab; });
        if (tab === "lib") renderLib();
        else if (tab === "mine") renderMine();
        else if (tab === "exam") renderExamList();
        else renderBoya();
    }

    function readBadge(id) {
        var r = S.read[id];
        return r && r.done ? '<span class="tc-done">✓ Đã đọc</span>' : "";
    }
    function metaBits(id, chars) {
        var r = S.read[id] || {}, bits = [];
        bits.push(chars.toLocaleString("vi-VN") + " chữ");
        bits.push("~" + minutesOf(chars) + " phút");
        if (r.quiz && r.quiz.n) bits.push("📝 " + r.quiz.c + "/" + r.quiz.n);
        if (r.cpm && r.cpm.length) bits.push("⏱ " + r.cpm[r.cpm.length - 1].v + " chữ/phút");
        return bits.map(function (b) { return "<span>" + esc(b) + "</span>"; }).join("");
    }

    // ---------------------------------------------------------------------- Loại tài liệu + bộ truyện
    var KINDS = [
        { k: "all", ico: "", label: "Tất cả" },
        { k: "article", ico: "📄", label: "Bài đọc" },
        { k: "series", ico: "📚", label: "Truyện dài" },
        { k: "dialogue", ico: "💬", label: "Hội thoại" },
        { k: "chengyu", ico: "🏮", label: "Thành ngữ" }
    ];
    var KIND_MAP = {};
    KINDS.forEach(function (k) { KIND_MAP[k.k] = k; });
    function kindOf(t) { var k = t && t.kind; return KIND_MAP[k] && k !== "all" ? k : "article"; }
    // chuẩn hóa để tìm kiếm: chữ thường, bỏ dấu tiếng Việt
    function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d"); }
    function searchText(t) {
        if (t._q == null) {
            var I = t.idiom || {};
            t._q = norm([t.title, t.title_vi, t.topic, t.series_title, t.series_title_vi, t.scene_vi, (t.speakers || []).join(" "),
                I.hz, I.py, I.hv, I.meaning].join(" "));
        }
        return t._q;
    }
    function seriesKey(t) { return String(t.series || "_"); }
    // Bộ truyện: { id, title, title_vi, level, chapters: [bài…] (theo thứ tự chương) }
    var SERIES = (function () {
        var map = {}, list = [];
        LIB.forEach(function (t) {
            if (kindOf(t) !== "series") return;
            var sid = seriesKey(t), s = map[sid];
            if (!s) { s = map[sid] = { id: sid, title: t.series_title || "Truyện dài", title_vi: t.series_title_vi || "", level: t.level, chapters: [] }; list.push(s); }
            s.chapters.push(t);
            s.level = Math.min(s.level, t.level);
        });
        list.forEach(function (s) { s.chapters.sort(function (a, b) { return (a.chapter || 0) - (b.chapter || 0); }); });
        return { map: map, list: list };
    })();
    function seriesOf(t) { return t && kindOf(t) === "series" ? SERIES.map[seriesKey(t)] || null : null; }
    function isDone(id) { return !!(S.read[id] && S.read[id].done); }
    function seriesDoneN(s) { return s.chapters.filter(function (c) { return isDone(c.id); }).length; }
    function seriesNext(s) { for (var i = 0; i < s.chapters.length; i++) if (!isDone(s.chapters[i].id)) return s.chapters[i]; return null; }
    function chapterNo(t) { var s = seriesOf(t); return t.chapter || (s ? s.chapters.indexOf(t) + 1 : 1); }
    // Đơn vị hiển thị trong thư viện: mỗi bài một thẻ, riêng truyện dài gom một thẻ cho cả bộ
    var UNITS = (function () {
        var out = [], seen = {};
        LIB.forEach(function (t) {
            if (kindOf(t) === "series") {
                var s = seriesOf(t);
                if (!seen[s.id]) { seen[s.id] = 1; out.push({ kind: "series", s: s, level: s.level }); }
            } else out.push({ kind: kindOf(t), t: t, level: t.level });
        });
        return out;
    })();
    function unitMatch(u, lv, q) {
        if (u.kind === "series") {
            if (lv && !u.s.chapters.some(function (c) { return c.level === lv; })) return false;
            return !q || norm(u.s.title + " " + u.s.title_vi).indexOf(q) >= 0 || u.s.chapters.some(function (c) { return searchText(c).indexOf(q) >= 0; });
        }
        return (!lv || u.t.level === lv) && (!q || searchText(u.t).indexOf(q) >= 0);
    }

    // ---------------------------------------------------------------------- Thư viện
    var libQuery = "";     // ô tìm kiếm (không lưu)
    var libSeries = null;  // id bộ truyện đang mở danh sách chương
    function curKind() { var k = S.settings.kind; return KIND_MAP[k] ? k : "all"; }
    function kindBadge(k) { var K = KIND_MAP[k]; return k !== "article" && K ? '<span class="kd kd-' + k + '">' + K.ico + " " + esc(K.label) + "</span>" : ""; }
    function renderLib() {
        var kind = curKind(), lv = S.settings.level || 0, q = norm(libQuery.trim());
        var doneN = 0;
        LIB.forEach(function (t) { if (isDone(t.id)) doneN++; });
        // chọn loại (kèm số lượng; truyện dài tính theo bộ)
        var kc = { all: UNITS.length };
        UNITS.forEach(function (u) { kc[u.kind] = (kc[u.kind] || 0) + 1; });
        $("lib-kinds").innerHTML = KINDS.filter(function (K) { return K.k === "all" || kc[K.k] || K.k === kind; }).map(function (K) {
            return '<button class="chip kchip' + (kind === K.k ? " on" : "") + '" data-kind="' + K.k + '">' + (K.ico ? K.ico + " " : "") + esc(K.label) + "<small>" + (kc[K.k] || 0) + "</small></button>";
        }).join("");
        // lọc cấp (đếm trong loại đang chọn)
        var ofKind = UNITS.filter(function (u) { return kind === "all" || u.kind === kind; });
        var counts = {};
        ofKind.forEach(function (u) { counts[u.level] = (counts[u.level] || 0) + 1; });
        var chips = '<button class="chip' + (lv ? "" : " on") + '" data-lv="0">Mọi cấp<small>' + ofKind.length + "</small></button>";
        for (var l = 1; l <= 6; l++) if (counts[l] || lv === l) chips += '<button class="chip' + (lv === l ? " on" : "") + '" data-lv="' + l + '">HSK ' + l + "<small>" + (counts[l] || 0) + "</small></button>";
        $("lib-levels").innerHTML = chips;
        if ($("lib-search").value !== libQuery) $("lib-search").value = libQuery;

        var todayN = 0, today = startOfDay(), lastCpm = null;
        Object.keys(S.read).forEach(function (id) {
            var r = S.read[id];
            if (r.done && r.at >= today) todayN++;
            (r.cpm || []).forEach(function (c) { if (!lastCpm || c.at > lastCpm.at) lastCpm = c; });
        });
        $("lib-summary").innerHTML =
            '<div class="stat"><b>' + doneN + "/" + LIB.length + "</b><span>bài thư viện đã đọc</span></div>" +
            '<div class="stat"><b>' + todayN + "</b><span>bài đọc hôm nay</span></div>" +
            '<div class="stat"><b>' + (lastCpm ? lastCpm.v : "—") + "</b><span>chữ/phút lần gần nhất</span></div>";

        // đang mở một bộ truyện: danh sách chương
        var ser = libSeries && SERIES.map[libSeries];
        if (ser && (kind === "all" || kind === "series")) { renderSeriesDetail(ser, q); return; }
        libSeries = null;

        var list = ofKind.filter(function (u) { return unitMatch(u, lv, q); });
        if (!list.length) {
            $("lib-list").innerHTML = '<div class="empty">' + (q ? "Không tìm thấy bài phù hợp với “" + esc(libQuery.trim()) + "”." : "Chưa có bài ở mục này.") + "</div>";
            return;
        }
        $("lib-list").innerHTML = list.map(function (u) { return u.kind === "series" ? seriesCard(u.s) : textCard(u.t); }).join("");
    }
    function textCard(t, inSeries) {
        var k = kindOf(t), r = S.read[t.id] || {}, I = t.idiom || {}, body;
        if (k === "chengyu" && I.hz) {
            body = '<div class="tc-idiom">' + esc(I.hz) + "</div>" +
                (I.hv ? '<div class="tc-hv">' + esc(I.hv) + "</div>" : "") +
                '<div class="tc-vi">' + esc(I.meaning || t.title_vi || "") + "</div>";
        } else {
            body = '<div class="tc-title">' + (inSeries ? '<span class="tc-ch">Chương ' + chapterNo(t) + "</span>" : "") + esc(t.title) + "</div>" +
                '<div class="tc-vi">' + esc(t.title_vi || "") + "</div>";
            if (k === "dialogue") {
                if (t.scene_vi) body += '<div class="tc-scene">🎬 ' + esc(t.scene_vi) + "</div>";
                if (t.speakers && t.speakers.length) body += '<div class="tc-spk">' + t.speakers.map(function (n, i) { return '<span class="spk-' + (i % 4) + '">' + esc(n) + "</span>"; }).join("") + "</div>";
            }
        }
        return '<button class="tcard tc-' + k + (r.done ? " done" : "") + '" data-id="' + esc(t.id) + '">' +
            '<div class="tc-top"><span class="lv lv-' + t.level + '">HSK ' + t.level + "</span>" + (inSeries ? "" : kindBadge(k)) +
            (t.topic ? '<span class="topic">' + esc(t.topic) + "</span>" : "") + readBadge(t.id) + "</div>" + body +
            '<div class="tc-meta">' + metaBits(t.id, t.chars || hanCount(t.paragraphs.join(""))) + "</div>" +
            '<div data-known="' + esc(t.id) + '">' + knownHTML(knownPct("lib:" + t.id, t.paragraphs)) + "</div>" +
            "</button>";
    }
    function seriesBar(s) {
        var N = s.chapters.length, d = seriesDoneN(s);
        return '<div class="known"><div class="known-bar"><i style="width:' + Math.round(d * 100 / N) + '%"></i></div><div class="known-txt">' + d + "/" + N + " chương đã đọc</div></div>";
    }
    function seriesGoBtn(s) {
        var nx = seriesNext(s), first = s.chapters[0];
        if (nx) return '<button class="btn btn-primary btn-sm" data-id="' + esc(nx.id) + '">▶ ' + (seriesDoneN(s) ? "Đọc tiếp chương " : "Đọc chương ") + chapterNo(nx) + "</button>";
        return '<button class="btn btn-sm" data-id="' + esc(first.id) + '">🔁 Đọc lại từ chương 1</button>';
    }
    function seriesCard(s) {
        var N = s.chapters.length, d = seriesDoneN(s), chars = s.chapters.reduce(function (a, c) { return a + (c.chars || hanCount(c.paragraphs.join(""))); }, 0);
        return '<div class="tcard tc-series' + (d === N ? " done" : "") + '" data-series="' + esc(s.id) + '" role="button" tabindex="0">' +
            '<div class="tc-top"><span class="lv lv-' + s.level + '">HSK ' + s.level + "</span>" + kindBadge("series") + (d === N ? '<span class="tc-done">✓ Đã đọc hết</span>' : "") + "</div>" +
            '<div class="tc-title">' + esc(s.title) + "</div>" +
            '<div class="tc-vi">' + esc(s.title_vi) + "</div>" +
            '<div class="tc-meta"><span>' + N + " chương</span><span>" + chars.toLocaleString("vi-VN") + " chữ</span><span>~" + minutesOf(chars) + " phút</span></div>" +
            seriesBar(s) +
            '<div class="tc-actions">' + seriesGoBtn(s) + '<button class="btn btn-sm" data-series="' + esc(s.id) + '">☰ Các chương</button></div>' +
            "</div>";
    }
    function renderSeriesDetail(s, q) {
        var chs = s.chapters.filter(function (c) { return !q || searchText(c).indexOf(q) >= 0 || norm(s.title + " " + s.title_vi).indexOf(q) >= 0; });
        $("lib-list").innerHTML = '<div class="card series-head">' +
            '<button class="btn btn-sm" data-act="series-back">← Tất cả</button>' +
            '<div class="eyebrow" style="margin-top:10px">📚 Truyện dài · HSK ' + s.level + " · " + s.chapters.length + " chương</div>" +
            '<h2 class="cn">' + esc(s.title) + "</h2>" + (s.title_vi ? '<div class="muted">' + esc(s.title_vi) + "</div>" : "") +
            seriesBar(s) + '<div class="tc-actions">' + seriesGoBtn(s) + "</div></div>" +
            (chs.length ? chs.map(function (c) { return textCard(c, true); }).join("") : '<div class="empty">Không có chương phù hợp.</div>');
    }
    // Sau khi có từ điển + tập từ đã học: điền % biết vào các thẻ đang hiện
    function fillKnown() {
        document.querySelectorAll("[data-known]").forEach(function (el) {
            var id = el.getAttribute("data-known"), isMine = !!mineById(id), paras = null;
            if (isMine) paras = splitParas(mineById(id).text);
            else { var t = libById(id); paras = t ? t.paragraphs : null; }
            if (paras) el.innerHTML = knownHTML(knownPct((isMine ? "mine:" : "lib:") + id, paras));
        });
    }
    function libById(id) { for (var i = 0; i < LIB.length; i++) if (LIB[i].id === id) return LIB[i]; return null; }

    // ---------------------------------------------------------------------- Bài của tôi
    var editingId = null;
    function mineById(id) { for (var i = 0; i < S.mine.length; i++) if (S.mine[i].id === id) return S.mine[i]; return null; }
    function splitParas(text) { return String(text || "").split(/\r?\n+/).map(function (s) { return s.trim(); }).filter(Boolean); }
    function renderMine() {
        $("mine-form-title").textContent = editingId ? "Sửa bài" : "Dán bài mới";
        $("mine-cancel").hidden = !editingId;
        $("mine-save").textContent = editingId ? "💾 Lưu thay đổi" : "💾 Lưu bài";
        updateMineCount();
        if (!S.mine.length) {
            $("mine-list").innerHTML = '<div class="empty">Chưa có bài nào. Dán một bài báo, truyện ngắn hay đoạn hội thoại tiếng Trung vào ô trên để đọc với pinyin và tra từ.</div>';
            return;
        }
        var list = S.mine.slice().sort(function (a, b) { return (b.added || 0) - (a.added || 0); });
        $("mine-list").innerHTML = list.map(function (m) {
            var paras = splitParas(m.text), n = hanCount(m.text), r = S.read[m.id] || {};
            return '<div class="tcard' + (r.done ? " done" : "") + '" data-mine="' + esc(m.id) + '" role="button" tabindex="0">' +
                '<div class="tc-top"><span class="topic">' + esc(new Date(m.added || Date.now()).toLocaleDateString("vi-VN")) + " · " + paras.length + " đoạn</span>" + readBadge(m.id) + "</div>" +
                '<div class="tc-title">' + esc(m.title || "Bài không tên") + "</div>" +
                '<div class="tc-meta">' + metaBits(m.id, n) + "</div>" +
                '<div data-known="' + esc(m.id) + '">' + knownHTML(knownPct("mine:" + m.id, paras)) + "</div>" +
                '<div class="tc-actions"><button class="btn btn-sm" data-edit="' + esc(m.id) + '">✏️ Sửa</button>' +
                '<button class="btn btn-sm" data-del="' + esc(m.id) + '">🗑 Xóa</button></div>' +
                "</div>";
        }).join("");
    }
    function updateMineCount() {
        var n = hanCount($("mine-text").value);
        $("mine-count").textContent = n ? n.toLocaleString("vi-VN") + " chữ Hán · ~" + minutesOf(n) + " phút đọc" : "";
    }
    function saveMine(e) {
        e.preventDefault();
        var title = $("mine-title").value.trim(), text = $("mine-text").value.replace(/\r/g, "").trim();
        if (!hanCount(text)) { toast("Nội dung chưa có chữ Hán nào."); $("mine-text").focus(); return; }
        if (!title) title = splitParas(text)[0].replace(/[^㐀-鿿]/g, "").slice(0, 16) || "Bài không tên";
        if (editingId) {
            var m = mineById(editingId);
            if (m) { m.title = title; m.text = text; }
            delete knownCache["mine:" + editingId];
            toast("Đã lưu thay đổi.");
        } else {
            S.mine.push({ id: "m" + Date.now().toString(36), title: title, text: text, added: Date.now() });
            toast("Đã lưu bài.");
        }
        editingId = null;
        $("mine-title").value = ""; $("mine-text").value = "";
        save(); renderMine();
    }
    function editMine(id) {
        var m = mineById(id); if (!m) return;
        editingId = id;
        $("mine-title").value = m.title || ""; $("mine-text").value = m.text || "";
        renderMine();
        $("mine-form").scrollIntoView({ behavior: "smooth", block: "start" });
        $("mine-text").focus();
    }
    function delMine(id) {
        var m = mineById(id); if (!m) return;
        if (!confirm("Xóa bài “" + (m.title || "") + "”?")) return;
        S.mine = S.mine.filter(function (x) { return x.id !== id; });
        delete S.read[id];
        if (editingId === id) { editingId = null; $("mine-title").value = ""; $("mine-text").value = ""; }
        save(); renderMine();
    }

    // ---------------------------------------------------------------------- Bài khóa Boya đã học
    var boyaLoading = null;
    function ensureBoya() {
        if (window.BOYA_DATA) return Promise.resolve(true);
        if (!boyaLoading) boyaLoading = loadScript(BOYA_URL).then(function (ok) { if (!ok) boyaLoading = null; return ok && !!window.BOYA_DATA; });
        return boyaLoading;
    }
    function boyaLessons() { return (readJSON("boya_learning_progress_v2", {}) || {}).lessons || {}; }
    function findBoyaLesson(lid) {
        var D = window.BOYA_DATA; if (!D) return null;
        for (var i = 0; i < D.books.length; i++) {
            var b = D.books[i];
            for (var j = 0; j < b.lessons.length; j++) if (b.lessons[j].lesson_id === lid) return { book: b, lesson: b.lessons[j] };
        }
        return null;
    }
    function renderBoya() {
        var P = boyaLessons(), ids = Object.keys(P);
        var box = $("boya-list");
        if (!ids.length) {
            box.innerHTML = '<div class="card empty">Bạn chưa mở bài nào trong <b>Boya Learning</b>.<br>Học một bài ở đó, bài khóa sẽ hiện ở đây để đọc lại với pinyin, tra từ và đọc tính giờ.' +
                '<div style="margin-top:12px"><a class="btn btn-primary" href="../boya_learning/boya_learning.html">📖 Mở Boya Learning</a></div></div>';
            return;
        }
        if (!window.BOYA_DATA) {
            box.innerHTML = '<div class="card empty">Đang tải dữ liệu bài khóa Boya…</div>';
            ensureBoya().then(function (ok) {
                if (ok) { if (S.settings.tab === "boya") renderBoya(); }
                else box.innerHTML = '<div class="card empty">Không tải được dữ liệu bài khóa (../boya_learning/boya_data.js).</div>';
            });
            return;
        }
        var groups = {};
        ids.forEach(function (lid) {
            var f = findBoyaLesson(lid);
            if (f && f.lesson.readings && f.lesson.readings.length) (groups[f.book.id] = groups[f.book.id] || []).push(f.lesson);
        });
        var html = "";
        BOOK_ORDER.forEach(function (bid) {
            var ls = groups[bid]; if (!ls) return;
            ls.sort(function (a, b) { return a.lesson_num - b.lesson_num; });
            html += '<div class="bk-book"><h3><span class="bk-dot" style="background:var(--ui-book-' + bid + ')"></span>' + esc(BOOK_NAMES[bid] || bid) + "</h3>";
            ls.forEach(function (l) {
                var st = P[l.lesson_id] || {};
                html += '<div class="bk-lesson"><div class="bk-lesson-head"><span class="muted small">Bài ' + l.lesson_num + "</span><b>" + esc(l.title) + "</b>" +
                    (st.done ? '<span class="tc-done">✓ Đã học xong</span>' : '<span class="muted small">đang học</span>') + "</div>" +
                    '<div class="bk-readings">' + l.readings.map(function (r, i) {
                        var id = "boya:" + l.lesson_id + ":" + i, rr = S.read[id] || {};
                        var last = rr.cpm && rr.cpm.length ? " · " + rr.cpm[rr.cpm.length - 1].v + " chữ/phút" : "";
                        return '<button class="bk-r' + (rr.done ? " done" : "") + '" data-boya="' + esc(l.lesson_id) + '" data-r="' + i + '">' + (rr.done ? "✓ " : "") +
                            esc(r.title || "Bài đọc " + (i + 1)) + '<span class="muted">' + esc(last) + "</span></button>";
                    }).join("") + "</div></div>";
            });
            html += "</div>";
        });
        box.innerHTML = html || '<div class="card empty">Các bài đã mở chưa có bài khóa.</div>';
    }

    // Tách bài khóa Boya: mỗi <span class="block"> là một đoạn; ruby -> chữ + pinyin
    function parseBoyaReading(r) {
        var doc = new DOMParser().parseFromString("<div>" + (r.chinese_html || "") + "</div>", "text/html");
        var blocks = doc.querySelectorAll("span.block");
        var paras = [];
        blocks.forEach(function (b, bi) {
            var text = "", pys = [];
            (function walk(node) {
                node.childNodes.forEach(function (n) {
                    if (n.nodeType === 3) { text += n.nodeValue; return; }
                    if (n.nodeType !== 1) return;
                    var tag = n.tagName.toLowerCase();
                    if (tag === "rt" || tag === "rp") return;
                    if (tag === "ruby") {
                        var base = "", rt = "";
                        n.childNodes.forEach(function (c) {
                            if (c.nodeType === 3) base += c.nodeValue;
                            else if (c.nodeType === 1 && c.tagName.toLowerCase() === "rt") rt += c.textContent;
                            else if (c.nodeType === 1 && c.tagName.toLowerCase() !== "rp") base += c.textContent;
                        });
                        var hans = base.split("").filter(function (c) { return HAN.test(c); });
                        var sp = hans.length > 1 ? (HocLookup.splitPinyin(rt, hans.length) || rt.trim().split(/\s+/)) : [rt.trim()];
                        hans.forEach(function (c, k) { pys.push(sp[k] || ""); });
                        text += base;
                        return;
                    }
                    walk(n);
                });
            })(b);
            text = text.replace(/\s+/g, " ").trim();
            if (!text) return;
            var style = (b.getAttribute("style") || "") + " " + Array.prototype.map.call(b.querySelectorAll("[style]"), function (x) { return x.getAttribute("style"); }).join(" ");
            var kind = "p";
            if (/text-align:\s*center/.test(style) || /font-size:\s*2[46]px/.test(style) || (bi === 0 && /font-weight:\s*bold/.test(style))) kind = "title";
            else if (/text-align:\s*right/.test(style) || /^[（(](根据|选自)/.test(text)) kind = "attr";
            // pinyin chữ Hán ngoài ruby (nếu có) để trống, rubyHTML sẽ hiện rỗng
            var nHan = hanCount(text);
            while (pys.length < nHan) pys.push("");
            paras.push({ text: text, pys: pys.slice(0, nHan), kind: kind, tr: null });
        });
        alignTranslations(paras, r.translations || []);
        return paras;
    }
    // Ghép bản dịch vào đoạn: ưu tiên số 【N】; nếu số đoạn khớp số bản dịch thì ghép lần lượt;
    // nếu lệch thì chia theo tỷ lệ độ dài (quy hoạch động, giữ thứ tự) để bản dịch nằm dưới đúng nhóm đoạn.
    function alignTranslations(paras, trs) {
        trs = trs.map(function (t) { return String(t || "").trim(); }).filter(Boolean);
        if (!trs.length) return;
        var body = paras.filter(function (p) { return p.kind === "p"; });
        if (!body.length) return;
        var strip = function (t) { return t.replace(/^\s*【\d+】\s*/, ""); };
        var numMap = {}, hasNum = false;
        trs.forEach(function (t) { var m = t.match(/^\s*【(\d+)】/); if (m) { numMap[+m[1]] = strip(t); hasNum = true; } });
        if (hasNum) {
            var used = 0, seq = [];
            body.forEach(function (p) { var m = p.text.match(/【(\d+)】/); if (m && numMap[+m[1]]) { p.tr = numMap[+m[1]]; used++; } else seq.push(p); });
            var rest = trs.filter(function (t) { return !/^\s*【\d+】/.test(t); });
            if (seq.length && rest.length) assignSeq(seq, rest);
            return;
        }
        assignSeq(body, trs.map(strip));
    }
    function assignSeq(body, trs) {
        var n = body.length, m = trs.length;
        if (n === m) { body.forEach(function (p, i) { p.tr = trs[i]; }); return; }
        var a = body.map(function (p) { return Math.max(1, hanCount(p.text)); }), b = trs.map(function (t) { return Math.max(1, t.length); });
        if (n > m) {
            // gom các đoạn chữ Hán thành m nhóm; bản dịch đặt ở đoạn cuối của nhóm
            var g = groupDP(a, b);
            g.forEach(function (end, k) { body[end].tr = trs[k]; });
        } else {
            // gom các bản dịch thành n nhóm, mỗi đoạn nhận một nhóm
            var g2 = groupDP(b, a), start = 0;
            g2.forEach(function (end, k) { body[k].tr = trs.slice(start, end + 1).join(" "); start = end + 1; });
        }
    }
    // Chia dãy x (độ dài từng phần tử) thành y.length nhóm liên tiếp, không rỗng, sao cho tỷ lệ tích lũy
    // của x tại cuối mỗi nhóm gần nhất với tỷ lệ tích lũy của dãy đích y. Trả về chỉ số phần tử cuối của từng nhóm.
    function groupDP(x, y) {
        var k = y.length;
        var tot = x.reduce(function (s, v) { return s + v; }, 0), cum = [0];
        x.forEach(function (v, i) { cum[i + 1] = cum[i] + v / tot; });
        var ty = y.reduce(function (s, v) { return s + v; }, 0), tc = [0];
        y.forEach(function (v, i) { tc[i + 1] = tc[i] + v / ty; });
        var n = x.length, INF = 1e9, dp = [], from = [];
        for (var j = 0; j <= k; j++) { dp.push(new Array(n + 1).fill(INF)); from.push(new Array(n + 1).fill(-1)); }
        dp[0][0] = 0;
        for (var g = 1; g <= k; g++) {
            for (var e = g; e <= n - (k - g); e++) {
                for (var s = g - 1; s < e; s++) {
                    if (dp[g - 1][s] >= INF) continue;
                    var d = cum[e] - tc[g], c = dp[g - 1][s] + d * d;
                    if (c < dp[g][e]) { dp[g][e] = c; from[g][e] = s; }
                }
            }
        }
        var ends = [], pos = n;
        for (var gg = k; gg >= 1; gg--) { ends.unshift(pos - 1); pos = from[gg][pos]; }
        return ends;
    }

    // ====================================================================== Trình đọc
    // doc = { id, kind: "lib"|"mine"|"boya", title, sub, eyebrow, src, paras: [{ text, pys|null, tr, kind }], beyond, questions, url }
    var doc = null;

    // Lượt lời kịch bản hội thoại "Tên：lời nói" (giống HocTTS.dialogueSegments)
    var TURN = /^\s*([㐀-鿿A-Za-z]{1,6})\s*[：:]\s*(.+)$/;
    function docFromLib(t) {
        var k = kindOf(t), s = seriesOf(t), eyebrow = "HSK " + t.level + (t.topic ? " · " + t.topic : "");
        if (s) eyebrow = "📚 " + s.title + " · Chương " + chapterNo(t) + "/" + s.chapters.length;
        else if (k === "dialogue") eyebrow = "💬 Hội thoại · HSK " + t.level;
        else if (k === "chengyu") eyebrow = "🏮 Thành ngữ · HSK " + t.level;
        var names = [];
        var paras = t.paragraphs.map(function (p, i) {
            var pys = t.pinyin && t.pinyin[i] ? t.pinyin[i].split(" ") : null;
            var o = { text: p, pys: pys, tr: (t.translations || [])[i] || null, kind: "p" };
            if (k === "dialogue") {
                var m = TURN.exec(p);
                if (m && HAN.test(m[2])) {
                    o.name = m[1]; o.text = m[2];
                    if (pys) o.pys = pys.slice(hanCount(m[1]));
                    if (names.indexOf(m[1]) < 0) names.push(m[1]);
                }
            }
            return o;
        });
        return {
            id: t.id, kind: "lib", lkind: k, title: t.title, sub: t.title_vi || "", eyebrow: eyebrow,
            src: "Đọc thêm · " + (k === "chengyu" && t.idiom ? t.idiom.hz : t.title), url: "?id=" + encodeURIComponent(t.id),
            paras: paras, beyond: t.beyond || [], questions: t.questions || [],
            series: s, names: names, scene: t.scene_vi || "", idiom: k === "chengyu" ? t.idiom || null : null
        };
    }
    function docFromMine(m) {
        return {
            id: m.id, kind: "mine", title: m.title || "Bài của tôi", sub: "", eyebrow: "Bài của tôi",
            src: "Đọc thêm · " + (m.title || "Bài của tôi"), url: "?mine=" + encodeURIComponent(m.id),
            paras: splitParas(m.text).map(function (p) { return { text: p, pys: null, tr: null, kind: "p" }; }),
            beyond: [], questions: []
        };
    }
    function docFromBoya(book, lesson, ri) {
        var r = lesson.readings[ri];
        return {
            id: "boya:" + lesson.lesson_id + ":" + ri, kind: "boya", title: lesson.title, sub: r.title || "", eyebrow: (BOOK_NAMES[book.id] || book.id) + " · Bài " + lesson.lesson_num,
            src: "Boya · " + (BOOK_NAMES[book.id] || book.id) + " · Bài " + lesson.lesson_num, url: "?boya=" + encodeURIComponent(lesson.lesson_id) + "&r=" + ri,
            paras: parseBoyaReading(r), beyond: [], questions: []
        };
    }

    function openDoc(d, push) {
        stopAll();
        closeExamView();
        doc = d;
        myRole = "";
        $("list-view").hidden = true;
        $("reader-view").hidden = false;
        $("brand-title").textContent = d.title;
        $("brand-sub").textContent = d.eyebrow;
        if (push !== false) { try { history.pushState({ reader: 1 }, "", d.url); } catch (e) {} }
        renderDoc();
        window.scrollTo(0, 0);
    }
    function closeDoc(fromPop) {
        stopAll();
        HocLookup.close();
        doc = null;
        closeExamView();
        if (fromPop) pushed = false;
        $("reader-view").hidden = true;
        $("list-view").hidden = false;
        $("brand-title").textContent = "Đọc thêm";
        $("brand-sub").textContent = "Bài đọc · Truyện · Hội thoại · Thành ngữ · Luyện thi";
        if (!fromPop) { try { history.pushState({}, "", location.pathname); } catch (e) {} }
        setTab(S.settings.tab);
    }

    function renderDoc() {
        var d = doc;
        $("doc-eyebrow").textContent = d.eyebrow;
        $("doc-title").textContent = d.title;
        $("doc-sub").textContent = d.sub;
        $("doc-sub").hidden = !d.sub;
        var total = d.paras.reduce(function (s, p) { return s + hanCount(p.text); }, 0);
        d.total = total;
        var r = S.read[d.id] || {};
        var meta = ["📄 " + total.toLocaleString("vi-VN") + " chữ", "⏱ ~" + minutesOf(total) + " phút"];
        if (r.done) meta.push("✓ Đã đọc");
        if (r.cpm && r.cpm.length) meta.push("Lần trước: " + r.cpm[r.cpm.length - 1].v + " chữ/phút");
        $("doc-meta").innerHTML = meta.map(function (m) { return "<span>" + esc(m) + "</span>"; }).join("") + '<span id="doc-known"></span>';
        $("doc-result").innerHTML = "";
        $("doc-sernav").innerHTML = seriesNavHTML();
        $("doc-sernav").hidden = !d.series;
        renderDlgBar();
        renderIdiom();
        renderBeyond();
        renderBody();
        renderQuiz();
        renderEnd();
        applySettings();
        $("tb-tr").hidden = !d.paras.some(function (p) { return p.tr; });
        $("tb-role").title = d.lkind === "dialogue" ? "Đọc nhập vai: mỗi người nói một giọng" : "Đọc nhập vai: lời dẫn một giọng, lời thoại trong ngoặc kép hai giọng luân phiên";
    }

    // ---------------------------------------------------------------------- Truyện dài: chuyển chương
    function seriesSibling(dir) {
        if (!doc || !doc.series) return null;
        var chs = doc.series.chapters;
        for (var i = 0; i < chs.length; i++) if (chs[i].id === doc.id) return chs[i + dir] || null;
        return null;
    }
    function seriesNavHTML() {
        if (!doc || !doc.series) return "";
        var pv = seriesSibling(-1), nx = seriesSibling(1), t = libById(doc.id);
        return '<button class="btn btn-sm" data-goto="' + (pv ? esc(pv.id) : "") + '"' + (pv ? "" : " disabled") + ">◀ Chương trước</button>" +
            '<span class="muted small">Chương ' + chapterNo(t) + "/" + doc.series.chapters.length + "</span>" +
            '<button class="btn btn-sm" data-goto="' + (nx ? esc(nx.id) : "") + '"' + (nx ? "" : " disabled") + ">Chương sau ▶</button>";
    }
    function gotoLib(id) {
        var t = libById(id); if (!t) return;
        openDoc(docFromLib(t), false);
        try { history.replaceState({ reader: 1 }, "", doc.url); } catch (er) {}
    }

    // ---------------------------------------------------------------------- Hội thoại: bảng vai + "Tôi đóng vai"
    var myRole = "";   // tên người nói mà người học tự đóng ("" = nghe cả bài)
    var SPK_N = 4;
    function spkIdx(name) { var i = doc && doc.names ? doc.names.indexOf(name) : -1; return i < 0 ? 0 : i % SPK_N; }
    function renderDlgBar() {
        var box = $("doc-dlg"), d = doc;
        if (d.lkind !== "dialogue" || !d.names.length) { box.hidden = true; box.innerHTML = ""; return; }
        box.hidden = false;
        box.innerHTML = (d.scene ? '<div class="dlg-scene">🎬 ' + esc(d.scene) + "</div>" : "") +
            '<div class="dlg-row"><span class="tc-spk">' + d.names.map(function (n, i) { return '<span class="spk-' + (i % SPK_N) + '">' + esc(n) + "</span>"; }).join("") + "</span>" +
            '<label class="dlg-me">🎤 Tôi đóng vai <select id="dlg-me"><option value="">— không, nghe cả bài —</option>' +
            d.names.map(function (n) { return '<option value="' + esc(n) + '"' + (myRole === n ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("") + "</select></label></div>" +
            '<div class="muted small dlg-hint"' + (myRole ? "" : " hidden") + ">Bấm 🎭 Nhập vai: lượt của <b>" + esc(myRole) + "</b> được che, máy dừng vài giây để bạn tự nói rồi mới hiện lời.</div>";
    }

    // ---------------------------------------------------------------------- Thành ngữ: khối đầu bài
    function renderIdiom() {
        var box = $("doc-idiom"), I = doc.idiom;
        if (!I || !I.hz) { box.hidden = true; box.innerHTML = ""; return; }
        box.hidden = false;
        var zz = !!window.HocZizu;
        var chars = String(I.hz).split("").map(function (c) {
            return HAN.test(c) ? '<span class="id-c"' + (zz ? ' data-zizu="' + esc(c) + '" title="Họ chữ: mọi từ có chữ ' + esc(c) + '"' : "") + ">" + esc(c) + "</span>" : esc(c);
        }).join("");
        var inB = window.HocMyWords && HocMyWords.has(I.hz), ready = HocLookup.ready();
        box.innerHTML = '<div class="id-top"><div class="id-hz">' + chars + '</div><button class="pt id-say" title="Nghe thành ngữ">🔊</button></div>' +
            (I.py ? '<div class="id-py">' + esc(I.py) + "</div>" : "") +
            (I.hv ? '<div class="id-hv">' + esc(I.hv) + "</div>" : "") +
            (I.meaning ? '<div class="id-mean">' + esc(I.meaning) + "</div>" : "") +
            (I.usage ? '<div class="id-usage"><b>Cách dùng:</b> ' + esc(I.usage) + "</div>" : "") +
            ((I.examples || []).length ? '<div class="id-exs"><div class="id-lbl">Ví dụ</div>' + I.examples.map(function (x, i) {
                return '<div class="id-ex"><div class="id-ex-zh"><span class="id-ex-t" data-lk-text="' + esc(x.zh) + '">' + (ready ? HocLookup.rubyHTML(x.zh) : esc(x.zh)) + "</span>" +
                    '<button class="pt id-ex-say" data-ex="' + i + '" title="Nghe câu ví dụ">🔊</button></div>' +
                    (x.vi ? '<div class="id-ex-vi">' + esc(x.vi) + "</div>" : "") + "</div>";
            }).join("") + "</div>" : "") +
            '<div class="id-act">' + (window.HocMyWords ? '<button class="btn btn-sm id-add' + (inB ? " btn-ok" : "") + '">' + (inB ? "✓ Đã trong Từ của tôi" : "＋ Từ của tôi") + "</button>" : "") +
            (zz ? '<span class="muted small">👆 Chạm từng chữ để xem họ chữ</span>' : "") + "</div>";
    }
    function toggleIdiomWord() {
        var I = doc && doc.idiom; if (!I || !window.HocMyWords) return;
        if (HocMyWords.has(I.hz)) { HocMyWords.remove(I.hz); toast("Đã bỏ “" + I.hz + "” khỏi Từ của tôi."); }
        else {
            var ex = (I.examples || [])[0] || {};
            HocMyWords.add({ hz: I.hz, py: I.py || "", hv: I.hv || "", vi: I.meaning || "", ex: ex.zh || "", exvi: ex.vi || "", src: doc.src });
            toast("Đã thêm “" + I.hz + "” vào Từ của tôi.");
        }
        renderIdiom();
        if (known) { buildKnown(); markNew(); }
    }

    function renderBody() {
        var d = doc;
        // cần từ điển khi đoạn chưa có pinyin, hoặc có chữ thiếu pinyin (vài bài khóa Boya có chữ nằm ngoài <ruby>)
        var needDict = d.paras.some(function (p) { return !p.pys || p.pys.some(function (x) { return !x; }); });
        if (needDict && !HocLookup.ready()) {
            $("doc-body").innerHTML = '<p class="muted" style="font-family:var(--ui-font-sans);font-size:15px">Đang tải từ điển để sinh pinyin…</p>';
            HocLookup.loadDict(DICT_URL).then(function () { if (doc === d) { renderBody(); markNew(); } });
            return;
        }
        if (d.idiom && HocLookup.ready()) renderIdiom();
        $("doc-body").innerHTML = d.paras.map(function (p, i) {
            var pys = p.pys;
            if (!pys) pys = HocLookup.pinyinOf(p.text);
            else if (pys.some(function (x) { return !x; })) {
                var auto = HocLookup.pinyinOf(p.text);
                pys = pys.map(function (x, k) { return x || auto[k] || ""; });
            }
            var tools = p.kind === "p" || p.kind === "title"
                ? '<div class="ptools"><button class="pt pt-say" data-k="' + i + '" title="Nghe đoạn này">🔊</button>' +
                  '<button class="pt pt-shadow" data-k="' + i + '" title="Nghe từng câu rồi đọc theo">🗣 Nhại</button>' +
                  (p.tr ? '<button class="pt pt-tr" data-k="' + i + '">Dịch</button>' : "") + "</div>"
                : "";
            var spk = p.name ? '<span class="spk-name spk-' + spkIdx(p.name) + '">' + esc(p.name) + "</span>" : "";
            return '<div class="para ' + p.kind + (p.name ? " dlg spk-" + spkIdx(p.name) : "") + '" data-k="' + i + '"' + (p.name ? ' data-name="' + esc(p.name) + '"' : "") + ">" +
                '<div class="ptext" data-lk-text="' + esc(p.text) + '">' + spk + HocLookup.rubyHTML(p.text, pys) + "</div>" +
                tools + (p.tr ? '<div class="ptr">' + esc(p.tr) + "</div>" : "") + "</div>";
        }).join("");
        markNew();
    }
    // Tô các chữ thuộc từ chưa học + tính % biết của bài đang mở
    function markNew() {
        if (!doc || !known || !HocLookup.ready()) return;
        var tot = 0, ok = 0;
        document.querySelectorAll("#doc-body .ptext").forEach(function (el) {
            var text = el.getAttribute("data-lk-text") || "", pos = 0;
            HocLookup.segment(text).forEach(function (s) {
                var len = s.t.length;
                if (HAN.test(s.t)) {
                    var kn = isKnownTok(s.t), n = hanCount(s.t);
                    tot += n; if (kn) ok += n;
                    if (!kn) for (var i = pos; i < pos + len; i++) { var c = el.querySelector('.lk-c[data-i="' + i + '"]'); if (c) c.classList.add("nw"); }
                }
                pos += len;
            });
        });
        var k = $("doc-known");
        if (k) k.textContent = tot ? "🧠 Biết " + Math.round(ok * 100 / tot) + "% từ" : "";
    }

    function renderBeyond() {
        var box = $("doc-beyond"), list = doc.beyond || [];
        if (!list.length) { box.hidden = true; box.innerHTML = ""; return; }
        box.hidden = false;
        box.open = list.length <= (window.innerWidth < 640 ? 6 : 15);
        var inN = list.filter(function (w) { return window.HocMyWords && HocMyWords.has(w[0]); }).length;
        box.innerHTML = '<summary><span>📌 Từ ngoài cấp <small>(' + list.length + " từ · nên xem trước khi đọc" + (inN ? " · " + inN + " đã trong sổ" : "") + ")</small></span></summary>" +
            '<div class="bw-list">' + list.map(function (w, i) {
                var inB = window.HocMyWords && HocMyWords.has(w[0]);
                return '<div class="bw"><div class="bw-main"><span class="bw-hz">' + esc(w[0]) + '</span><span class="bw-py">' + esc(w[1]) + "</span>" +
                    '<div class="bw-vi">' + (w[2] ? '<span class="bw-hv">' + esc(w[2]) + "</span>" : "") + esc(w[3]) + "</div></div>" +
                    '<button class="bw-add' + (inB ? " in" : "") + '" data-bw="' + i + '" title="' + (inB ? "Bỏ khỏi Từ của tôi" : "Thêm vào Từ của tôi") + '">' + (inB ? "✓" : "＋") + "</button></div>";
            }).join("") + "</div>";
    }
    function toggleBeyond(i) {
        var w = doc.beyond[i]; if (!w || !window.HocMyWords) return;
        if (HocMyWords.has(w[0])) { HocMyWords.remove(w[0]); toast("Đã bỏ “" + w[0] + "” khỏi Từ của tôi."); }
        else {
            var ex = "";
            for (var k = 0; k < doc.paras.length && !ex; k++) {
                var t = doc.paras[k].text, at = t.indexOf(w[0]);
                if (at >= 0) ex = HocLookup.sentenceAround(t, at, at + w[0].length);
            }
            HocMyWords.add({ hz: w[0], py: w[1], hv: w[2], vi: w[3], ex: ex, src: doc.src });
            toast("Đã thêm “" + w[0] + "” vào Từ của tôi.");
        }
        var open = $("doc-beyond").open;
        renderBeyond();
        $("doc-beyond").open = open;
        buildKnown(); markNew();
    }

    // ---------------------------------------------------------------------- Câu hỏi đọc hiểu
    var quizAns = {};
    function renderQuiz() {
        var box = $("doc-quiz"), qs = doc.questions || [];
        quizAns = {};
        if (!qs.length) { box.hidden = true; box.innerHTML = ""; return; }
        box.hidden = false;
        var r = S.read[doc.id] || {};
        box.innerHTML = "<h2>📝 Câu hỏi đọc hiểu</h2>" +
            (r.quiz && r.quiz.n ? '<p class="muted small">Lần làm tốt nhất: ' + r.quiz.c + "/" + r.quiz.n + "</p>" : "") +
            '<div id="q-score"></div>' +
            qs.map(function (q, i) {
                return '<div class="q" data-q="' + i + '"><div class="q-text">' + (i + 1) + ". " + esc(q.q) + "</div>" +
                    '<div class="q-vi" hidden>' + esc(q.q_vi || "") + "</div>" +
                    '<button class="pt q-vi-btn" data-q="' + i + '">Xem nghĩa câu hỏi</button>' +
                    '<div class="q-opts">' + q.options.map(function (o, j) {
                        return '<button class="q-opt" data-q="' + i + '" data-o="' + j + '"><b>' + "ABCD".charAt(j) + "</b><span>" + esc(o) + "</span></button>";
                    }).join("") + "</div><div class=\"q-exp-box\"></div></div>";
            }).join("");
    }
    function answerQuiz(qi, oi) {
        if (quizAns[qi] != null) return;
        var q = doc.questions[qi], right = oi === q.answer;
        quizAns[qi] = right;
        var el = document.querySelector('.q[data-q="' + qi + '"]');
        el.querySelectorAll(".q-opt").forEach(function (b) {
            b.disabled = true;
            var j = +b.dataset.o;
            if (j === q.answer) b.classList.add("right");
            else if (j === oi) b.classList.add("wrong");
        });
        el.querySelector(".q-exp-box").innerHTML = '<div class="q-exp ' + (right ? "ok" : "bad") + '"><b>' + (right ? "✓ Đúng." : "✗ Chưa đúng. Đáp án: " + "ABCD".charAt(q.answer) + ".") + "</b> " + esc(q.explain_vi || "") + "</div>";
        var n = doc.questions.length, done = Object.keys(quizAns).length;
        if (done === n) {
            var c = Object.keys(quizAns).filter(function (k) { return quizAns[k]; }).length;
            var r = rec(doc.id);
            if (!r.quiz || c > r.quiz.c || r.quiz.n !== n) r.quiz = { c: c, n: n };
            save();
            $("q-score").innerHTML = '<div class="q-score">Kết quả: ' + c + "/" + n + " câu đúng (" + Math.round(c * 100 / n) + "%)" +
                (c === n ? " 🎉" : "") + "</div>";
            $("q-score").scrollIntoView({ behavior: "smooth", block: "center" });
            if (!r.done) toast("Làm xong câu hỏi. Nhớ bấm “Đánh dấu đã đọc” nhé!");
        }
    }

    // ---------------------------------------------------------------------- Đánh dấu đã đọc
    function renderEnd() {
        var r = S.read[doc.id] || {};
        $("doc-end").innerHTML = (r.done
            ? '<button class="btn btn-ok" id="btn-unread">✓ Đã đọc · bỏ đánh dấu</button>'
            : '<button class="btn btn-primary" id="btn-read">✓ Đánh dấu đã đọc</button>') +
            '<button class="btn" id="btn-end-back">← Danh sách bài</button>' +
            (doc.series ? '<div class="ser-nav ser-nav-end">' + seriesNavHTML() + "</div>"
                : nextDoc() ? '<button class="btn" id="btn-next">Bài tiếp →</button>' : "");
    }
    function setRead(on) {
        var r = rec(doc.id);
        r.done = !!on;
        if (on) r.at = Date.now();
        save(); renderEnd();
        toast(on ? (doc.series && seriesSibling(1) ? "Đã đánh dấu đã đọc. Đọc tiếp chương sau nhé!" : "Đã đánh dấu đã đọc.") : "Đã bỏ đánh dấu.");
    }
    function nextDoc() {
        if (!doc || doc.kind !== "lib") return null;
        if (doc.series) return seriesSibling(1);
        // bài tiếp cùng loại (bỏ qua truyện dài, vốn có nút chuyển chương riêng)
        for (var i = 0; i < LIB.length; i++) if (LIB[i].id === doc.id) {
            for (var j = i + 1; j < LIB.length; j++) if (kindOf(LIB[j]) === doc.lkind) return LIB[j];
            return null;
        }
        return null;
    }

    // ---------------------------------------------------------------------- Cài đặt hiển thị
    var TR_LABEL = { off: "Dịch: tắt", para: "Dịch: đoạn", all: "Dịch: tất cả" };
    function applySettings() {
        var st = S.settings, rd = $("reader");
        var hidePy = !st.py || (timer && st.autoHide);
        rd.classList.toggle("no-py", hidePy);
        rd.classList.toggle("hl-new", !!st.hl);
        rd.classList.toggle("no-lookup", !st.lookup);
        rd.classList.remove("tr-off", "tr-para", "tr-all");
        rd.classList.add("tr-" + st.tr);
        rd.style.setProperty("--rd-size", st.size + "px");
        $("tb-py").classList.toggle("on", !!st.py);
        $("tb-new").classList.toggle("on", !!st.hl);
        $("tb-lookup").classList.toggle("on", !!st.lookup);
        $("tb-tr").classList.toggle("on", st.tr !== "off");
        $("tb-tr-label").textContent = TR_LABEL[st.tr] || "Dịch";
        $("tb-rate").value = String(st.rate);
        if ($("tb-rate").value !== String(st.rate)) $("tb-rate").value = "0.9";
        $("opt-autohide").checked = !!st.autoHide;
    }
    function setSetting(k, v) { S.settings[k] = v; save(); applySettings(); }

    // ---------------------------------------------------------------------- Phát âm (speechSynthesis)
    var playToken = 0;
    function zhVoice() {
        if (!("speechSynthesis" in window)) return null;
        return speechSynthesis.getVoices().filter(function (x) { return /zh[-_]CN/i.test(x.lang); })[0] ||
            speechSynthesis.getVoices().filter(function (x) { return /^zh/i.test(x.lang); })[0] || null;
    }
    function speakOne(text, rate) {
        return new Promise(function (resolve) {
            if (!("speechSynthesis" in window)) { resolve(false); return; }
            var u = new SpeechSynthesisUtterance(text);
            u.lang = "zh-CN"; u.rate = rate || S.settings.rate || 0.9;
            var v = zhVoice(); if (v) u.voice = v;
            var done = false, fin = function () { if (!done) { done = true; clearTimeout(guard); resolve(true); } };
            // phòng khi trình duyệt không phát sự kiện end
            var guard = setTimeout(fin, 1500 + text.length * 400 / (u.rate || 1));
            u.onend = fin; u.onerror = fin;
            speechSynthesis.speak(u);
        });
    }
    function speakWord(t) { stopRole(); if ("speechSynthesis" in window) speechSynthesis.cancel(); speakOne(t, Math.min(1, S.settings.rate)); }
    function wait(ms, token) { return new Promise(function (res) { setTimeout(function () { res(token === playToken); }, ms); }); }
    function stopPlay() {
        playToken++;
        stopRole();
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        $("play-bar").hidden = true;
        $("tb-listen").classList.remove("on");
        document.querySelectorAll(".para.playing").forEach(function (p) { p.classList.remove("playing"); });
        document.querySelectorAll(".lk-c.sent-hl").forEach(function (c) { c.classList.remove("sent-hl"); });
    }
    function stopAll() { stopPlay(); if (timer) cancelTimer(); }
    function showPlay(msg) { $("play-bar").hidden = false; $("play-text").textContent = msg; }
    function sentencesOf(text) {
        var out = [], re = /[^。！？!?；;…]+[。！？!?；;…]*[”’」』）)]*/g, m;
        while ((m = re.exec(text))) { if (hanCount(m[0])) out.push({ s: m.index, e: m.index + m[0].length, t: m[0] }); }
        return out.length ? out : [{ s: 0, e: text.length, t: text }];
    }
    function hlRange(k, s, e) {
        document.querySelectorAll(".lk-c.sent-hl").forEach(function (c) { c.classList.remove("sent-hl"); });
        var el = document.querySelector('.para[data-k="' + k + '"] .ptext'); if (!el) return;
        for (var i = s; i < e; i++) { var c = el.querySelector('.lk-c[data-i="' + i + '"]'); if (c) c.classList.add("sent-hl"); }
    }
    // Đọc lần lượt các đoạn từ..đến (nghe cả bài hoặc một đoạn)
    function playParas(from, to) {
        stopPlay();
        if (!("speechSynthesis" in window)) { toast("Trình duyệt không hỗ trợ đọc văn bản."); return; }
        var token = playToken, k = from;
        if (to > from) $("tb-listen").classList.add("on");
        (function next() {
            if (token !== playToken) return;
            document.querySelectorAll(".para.playing").forEach(function (p) { p.classList.remove("playing"); });
            if (k > to) { stopPlay(); return; }
            var p = doc.paras[k], el = document.querySelector('.para[data-k="' + k + '"]');
            if (!p || !hanCount(p.text)) { k++; next(); return; }
            if (el) { el.classList.add("playing"); if (to > from) el.scrollIntoView({ behavior: "smooth", block: "center" }); }
            showPlay(to > from ? "🔊 Đang đọc đoạn " + (k + 1) + "/" + doc.paras.length : "🔊 Đang đọc đoạn " + (k + 1));
            speakOne(p.text).then(function () { k++; if (token === playToken) setTimeout(next, 250); });
        })();
    }
    // Đọc nhập vai (HocTTS.readDialogue): lời dẫn = giọng người dẫn, lời trong “…”/「…」 = Vai 1/Vai 2 luân phiên
    var role = null;       // { h: handle của HocTTS, k: đoạn đang đọc }
    var ROLE_LABEL = { narrator: "Dẫn", a: "Vai 1", b: "Vai 2" };
    function unmarkRole(el) { el.classList.remove("rp-on", "playing"); el.removeAttribute("data-rp"); el.removeAttribute("data-rp-label"); }
    function stopRole() {
        var r = role;
        if (!r) return;
        role = null;
        try { if (r.h) r.h.stop(); } catch (e) {}
        $("tb-role").classList.remove("on");
        $("tb-role-ico").textContent = "🎭"; $("tb-role-label").textContent = "Nhập vai";
        document.querySelectorAll(".para.rp-on").forEach(unmarkRole);
        document.querySelectorAll(".para.mask, .para.my-turn").forEach(function (p) { p.classList.remove("mask", "my-turn"); });
    }
    function roleLabel(seg) { return seg.name || ROLE_LABEL[seg.role] || ""; }
    function markSeg(r, seg, k) {
        var moved = k !== r.k;
        r.k = k;
        document.querySelectorAll(".para.rp-on").forEach(function (p) { if (+p.dataset.k !== k) unmarkRole(p); });
        var el = document.querySelector('.para[data-k="' + k + '"]');
        if (el) {
            el.classList.add("rp-on", "playing");
            el.setAttribute("data-rp", seg.role);
            el.setAttribute("data-rp-label", roleLabel(seg));
            if (moved) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return el;
    }
    function startRole() {
        stopPlay();
        if (!doc) return;
        if (!window.HocTTS || !HocTTS.readDialogue || !("speechSynthesis" in window)) { toast("Trình duyệt không hỗ trợ đọc văn bản."); return; }
        // chỉ đọc đoạn có chữ Hán, bỏ dòng nguồn (căn phải); lượt hội thoại đưa lại dạng "Tên：lời" để mỗi tên giữ một giọng
        var ks = [];
        doc.paras.forEach(function (p, k) { if (p.kind !== "attr" && hanCount(p.text)) ks.push(k); });
        if (!ks.length) return;
        var texts = ks.map(function (k) { var p = doc.paras[k]; return p.name ? p.name + "：" + p.text : p.text; });
        var r = role = { h: null, k: -1 };
        $("tb-role").classList.add("on");
        $("tb-role-ico").textContent = "⏹"; $("tb-role-label").textContent = "Dừng";
        if (myRole && doc.lkind === "dialogue") { r.h = rolePlayMe(r, ks, texts, myRole); return; }
        r.h = HocTTS.readDialogue(texts, {
            rate: S.settings.rate || 0.9,
            onSeg: function (seg) {
                if (role !== r) return;
                markSeg(r, seg, ks[seg.p]);
                showPlay("🎭 Đoạn " + (seg.p + 1) + "/" + ks.length + " · " + (seg.name || { narrator: "Người dẫn", a: "Vai 1", b: "Vai 2" }[seg.role] || ""));
            },
            onEnd: function () { if (role !== r) return; stopPlay(); toast("Đã đọc hết bài."); }
        });
    }
    // Giọng theo vai — chép cách chọn của HocTTS (roleVoice nội bộ) để tự điều khiển lượt đọc khi người học đóng một vai
    function roleVoiceOf(rl) {
        if (HocTTS.roleVoice) return HocTTS.roleVoice(rl);   // dùng chung cách chọn của tts.js (hỗ trợ 4 vai)
        var st = HocTTS.settings() || {}, vs = HocTTS.voices() || [];
        var by = function (n) { return n ? vs.filter(function (v) { return v.name === n; })[0] || null : null; };
        var v = by(st.roles && st.roles[rl]);
        if (v) return v;
        if (!vs.length) return null;
        var g = HocTTS.gender || function () { return ""; };
        var f = vs.filter(function (x) { return g(x) === "f"; }), m = vs.filter(function (x) { return g(x) === "m"; });
        var nar = by(st.voice) || vs[0];
        if (rl === "narrator") return nar;
        if (rl === "a") return m.filter(function (x) { return x !== nar; })[0] || m[0] || vs.filter(function (x) { return x !== nar; })[0] || nar;
        var a = roleVoiceOf("a");
        return f.filter(function (x) { return x !== nar && x !== a; })[0] || f.filter(function (x) { return x !== a; })[0] ||
            vs.filter(function (x) { return x !== a && x !== nar; })[0] || vs.filter(function (x) { return x !== a; })[0] || nar;
    }
    // Người học đóng vai `me`: lượt của họ bị che, máy không đọc mà dừng một lúc để họ tự nói, rồi hiện lời và đọc tiếp
    function rolePlayMe(r, ks, texts, me) {
        var segs = HocTTS.dialogueSegments(texts), i = 0, stopped = false, timers = [];
        var rate = S.settings.rate || 0.9;
        ks.forEach(function (k) { if (doc.paras[k].name === me) { var el = document.querySelector('.para[data-k="' + k + '"]'); if (el) el.classList.add("mask"); } });
        function later(fn, ms) { timers.push(setTimeout(function () { if (!stopped && role === r) fn(); }, ms)); }
        function next() {
            if (stopped || role !== r) return;
            if (i >= segs.length) { stopPlay(); toast("Hết hội thoại. Bạn đóng vai " + me + " rất tốt!"); return; }
            var seg = segs[i++], k = ks[seg.p], el = markSeg(r, seg, k);
            if (seg.name === me) {
                var ms = Math.max(2500, hanCount(seg.text) * 520 / Math.max(0.5, rate)) + 800;
                if (el) el.classList.add("my-turn");
                showPlay("🎤 Lượt của bạn (" + me + "): hãy nói câu này…");
                later(function () {
                    if (el) el.classList.remove("mask", "my-turn");
                    showPlay("🎤 Lời của " + me + " (đã hiện)");
                    later(next, 1300);
                }, ms);
                return;
            }
            showPlay("🎭 Lượt " + (seg.p + 1) + "/" + ks.length + " · " + roleLabel(seg));
            var chunks = seg.text.match(/[^。！？；!?;]+[。！？；!?;]*[”’」』]?/g) || [seg.text], c = 0;
            (function say() {
                if (stopped || role !== r) return;
                if (c >= chunks.length) { later(next, 250); return; }
                var text = chunks[c++], done = false;
                var fin = function () { if (done) return; done = true; clearTimeout(guard); say(); };
                var guard = setTimeout(fin, Math.max(4000, text.length * 420 / rate) + 2500);
                var u = HocTTS.speak(text, { voice: roleVoiceOf(seg.role), rate: rate, onend: fin });
                if (!u) fin();
            })();
        }
        next();
        return { stop: function () { stopped = true; timers.forEach(clearTimeout); try { HocTTS.stop(); } catch (e) {} }, segments: segs };
    }
    // Nhại: đọc từng câu, dừng một khoảng để người học đọc theo
    function shadowPara(k, startSent) {
        stopPlay();
        if (!("speechSynthesis" in window)) { toast("Trình duyệt không hỗ trợ đọc văn bản."); return; }
        var token = playToken, p = doc.paras[k], sents = sentencesOf(p.text), i = startSent || 0;
        var el = document.querySelector('.para[data-k="' + k + '"]');
        if (el) el.classList.add("playing");
        (function next() {
            if (token !== playToken) return;
            if (i >= sents.length) { stopPlay(); toast("Xong đoạn " + (k + 1) + "."); return; }
            var s = sents[i];
            hlRange(k, s.s, s.e);
            showPlay("🗣 Câu " + (i + 1) + "/" + sents.length + " · nghe…");
            var t0 = Date.now();
            speakOne(s.t).then(function () {
                if (token !== playToken) return;
                var dur = Date.now() - t0;
                showPlay("🗣 Câu " + (i + 1) + "/" + sents.length + " · đến lượt bạn đọc theo…");
                wait(Math.max(1500, dur * 1.2 / Math.max(0.6, S.settings.rate)), token).then(function (ok) { if (ok) { i++; next(); } });
            });
        })();
    }
    // Đọc một câu chứa vị trí i của đoạn k (bấm giữ vào chữ)
    function speakSentenceAt(k, idx) {
        var p = doc.paras[k]; if (!p) return;
        var s = sentencesOf(p.text).filter(function (x) { return idx >= x.s && idx < x.e; })[0];
        if (!s) return;
        stopPlay();
        var token = playToken;
        hlRange(k, s.s, s.e);
        showPlay("🔊 Câu đang chọn");
        speakOne(s.t).then(function () { if (token === playToken) stopPlay(); });
    }

    // ---------------------------------------------------------------------- Đọc tính giờ
    var timer = null;      // { t0, iv }
    function fmtClock(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
    function startTimer() {
        stopPlay();
        HocLookup.close();
        timer = { t0: Date.now(), iv: setInterval(function () { $("timer-clock").textContent = fmtClock(Date.now() - timer.t0); }, 500) };
        $("timer-clock").textContent = "0:00";
        $("timer-bar").hidden = false;
        $("tb-timer").classList.add("running");
        $("tb-timer-label").textContent = "Đọc xong";
        $("doc-result").innerHTML = "";
        applySettings();
        var first = document.querySelector("#doc-body .para");
        if (first) window.scrollTo({ top: Math.max(0, first.getBoundingClientRect().top + window.scrollY - 160), behavior: "smooth" });
    }
    function cancelTimer() {
        if (!timer) return;
        clearInterval(timer.iv); timer = null;
        $("timer-bar").hidden = true;
        $("tb-timer").classList.remove("running");
        $("tb-timer-label").textContent = "Tính giờ";
        applySettings();
    }
    function finishTimer() {
        if (!timer) return;
        var ms = Date.now() - timer.t0;
        cancelTimer();
        if (ms < 5000) { toast("Thời gian quá ngắn, chưa lưu."); return; }
        var cpm = Math.round(doc.total / (ms / 60000));
        var r = rec(doc.id), prev = r.cpm && r.cpm.length ? r.cpm[r.cpm.length - 1].v : null;
        r.cpm = (r.cpm || []).concat([{ at: Date.now(), v: cpm }]).slice(-20);
        save();
        var cmp = prev == null ? "Lần đầu đọc tính giờ bài này." :
            cpm > prev ? "Nhanh hơn lần trước " + (cpm - prev) + " chữ/phút (" + prev + " → " + cpm + ")." :
            cpm < prev ? "Chậm hơn lần trước " + (prev - cpm) + " chữ/phút (" + prev + " → " + cpm + ")." : "Bằng lần trước.";
        var max = Math.max.apply(null, r.cpm.map(function (c) { return c.v; }));
        $("doc-result").innerHTML = '<div class="card result"><h3>⏱ ' + cpm + " chữ/phút</h3><p>" + esc(doc.total + " chữ trong " + fmtClock(ms) + ". " + cmp) + "</p>" +
            (r.cpm.length > 1 ? '<div class="cpm-hist" title="Lịch sử tốc độ đọc bài này">' + r.cpm.map(function (c, i) {
                return '<i class="' + (i === r.cpm.length - 1 ? "last" : "") + '" style="height:' + Math.max(8, Math.round(c.v * 100 / max)) + '%" title="' + c.v + ' chữ/phút"></i>';
            }).join("") + "</div>" : "") +
            '<p class="muted small" style="margin-top:8px">Tham khảo: 150–250 chữ/phút là tốc độ đọc hiểu thoải mái ở trình độ trung cấp.</p></div>';
        $("doc-result").scrollIntoView({ behavior: "smooth", block: "start" });
        if (!r.done) setRead(true);
    }

    // ====================================================================== Luyện thi HSK
    // Đề: { id, level, title, sections: [{ type: "xuanci"|"paixu"|"yuedu", title, words?, items }] } (xem tools/doc_them_src/BRIEF_MORE.md)
    var SEC_VI = { xuanci: "Chọn từ điền vào chỗ trống", paixu: "Sắp xếp thứ tự", yuedu: "Đọc hiểu" };
    var MIN_PER_Q = 1;     // gợi ý bấm giờ: ~1 phút/câu (phần đọc HSK 4–5)
    var BLANK = /[（(]\s*[）)]/;
    function examById(id) { for (var i = 0; i < EXAMS.length; i++) if (EXAMS[i].id === id) return EXAMS[i]; return null; }
    function examCount(e) { return (e.sections || []).reduce(function (s, x) { return s + (x.items || []).length; }, 0); }
    function renderExamList() {
        var lv = S.settings.examLv || 0, counts = {};
        EXAMS.forEach(function (e) { counts[e.level] = (counts[e.level] || 0) + 1; });
        var chips = '<button class="chip' + (lv ? "" : " on") + '" data-elv="0">Tất cả<small>' + EXAMS.length + "</small></button>";
        Object.keys(counts).sort().forEach(function (l) { chips += '<button class="chip' + (lv === +l ? " on" : "") + '" data-elv="' + l + '">HSK ' + l + "<small>" + counts[l] + "</small></button>"; });
        $("exam-levels").innerHTML = chips;
        var list = EXAMS.filter(function (e) { return !lv || e.level === lv; });
        var doneN = EXAMS.filter(function (e) { return S.exams[e.id]; }).length;
        $("exam-summary").innerHTML = EXAMS.length ? '<div class="stat"><b>' + doneN + "/" + EXAMS.length + "</b><span>đề đã làm</span></div>" +
            '<div class="stat"><b>' + (doneN ? Math.round(EXAMS.reduce(function (s, e) { return s + ((S.exams[e.id] || {}).best || 0); }, 0) / doneN) + "%" : "—") + "</b><span>điểm tốt nhất trung bình</span></div>" : "";
        $("exam-summary").hidden = !EXAMS.length;
        if (!list.length) { $("exam-list").innerHTML = '<div class="empty">Chưa có đề luyện thi' + (lv ? " HSK " + lv : "") + ".</div>"; return; }
        $("exam-list").innerHTML = list.map(function (e) {
            var r = S.exams[e.id], n = examCount(e);
            return '<button class="tcard ex-card' + (r ? " done" : "") + '" data-exam="' + esc(e.id) + '">' +
                '<div class="tc-top"><span class="lv lv-' + e.level + '">HSK ' + e.level + "</span>" +
                (r ? '<span class="tc-done">🏆 ' + r.best + "%</span>" : '<span class="topic">Chưa làm</span>') + "</div>" +
                '<div class="ex-card-title">' + esc(e.title || e.id) + "</div>" +
                '<div class="tc-meta"><span>' + n + " câu</span><span>~" + Math.round(n * MIN_PER_Q) + " phút</span>" +
                (r ? "<span>" + r.tries + " lần · gần nhất " + r.last + "%</span>" : "") + "</div>" +
                '<div class="tc-meta">' + (e.sections || []).map(function (s) { return "<span>" + esc(s.title || s.type) + " " + (s.items || []).length + "</span>"; }).join("") + "</div>" +
                "</button>";
        }).join("");
    }

    var ex = null;   // { e, ans: { "si-ii": giá trị }, done, res, t0, tm: { end, iv, over }, wrongOnly }
    function openExam(e, push) {
        stopAll();
        HocLookup.close();
        doc = null;
        closeExamView();
        ex = { e: e, ans: {}, done: false, res: null, t0: Date.now(), tm: null, wrongOnly: false };
        $("list-view").hidden = true;
        $("reader-view").hidden = true;
        $("exam-view").hidden = false;
        $("brand-title").textContent = e.title || "Luyện thi HSK";
        $("brand-sub").textContent = "📝 Luyện thi HSK " + e.level;
        if (push !== false) { try { history.pushState({ reader: 1 }, "", "?exam=" + encodeURIComponent(e.id)); } catch (er) {} }
        renderExam();
        window.scrollTo(0, 0);
        if (!HocLookup.ready()) HocLookup.loadDict(DICT_URL).then(function () { if (ex && ex.e === e) renderExam(); });
    }
    function closeExamView() {
        if (ex && ex.tm) clearInterval(ex.tm.iv);
        ex = null;
        $("exam-view").hidden = true;
    }
    function wordsOf(sec) {
        return (sec.words || []).map(function (w, i) {
            var m = /^\s*([A-Z])\s*[\.、．:：]?\s*(.*)$/.exec(String(w));
            return m ? { L: m[1], w: m[2] } : { L: "ABCDEF".charAt(i), w: String(w) };
        });
    }
    function wordFor(sec, L) { var ws = wordsOf(sec); for (var i = 0; i < ws.length; i++) if (ws[i].L === L) return ws[i].w; return ""; }
    function partKeys(it) { return Object.keys(it.parts || {}).sort(); }
    function normOrder(s) { return String(s || "").toUpperCase().replace(/[^A-Z]/g, ""); }
    function answered(sec, it, a) {
        if (a == null || a === "") return false;
        return sec.type !== "paixu" || a.length === partKeys(it).length;
    }
    function isRight(sec, it, a) {
        if (!answered(sec, it, a)) return false;
        if (sec.type === "yuedu") return +a === +it.answer;
        if (sec.type === "paixu") return a === normOrder(it.answer);
        return String(a).toUpperCase() === String(it.answer || "").trim().toUpperCase();
    }
    function ansLabel(sec, it) {
        if (sec.type === "yuedu") return "ABCD".charAt(+it.answer) + ". " + ((it.options || [])[+it.answer] || "");
        if (sec.type === "paixu") return normOrder(it.answer).split("").join(" → ");
        var L = String(it.answer || "").trim().toUpperCase();
        return L + " " + wordFor(sec, L);
    }
    // văn bản chạm-để-tra (pinyin ẩn theo cài đặt)
    function lk(text) {
        text = String(text || "");
        return '<span class="lk-t" data-lk-text="' + esc(text) + '">' + HocLookup.rubyHTML(text, HocLookup.ready() ? null : []) + "</span>";
    }
    function examTotal() {
        var n = 0, a = 0;
        ex.e.sections.forEach(function (sec, si) { (sec.items || []).forEach(function (it, ii) { n++; if (answered(sec, it, ex.ans[si + "-" + ii])) a++; }); });
        return { n: n, a: a };
    }
    function itemHTML(sec, it, si, ii, no) {
        var key = si + "-" + ii, a = ex.ans[key], done = ex.done, right = done && isRight(sec, it, a);
        var h = "", L;
        if (sec.type === "xuanci") {
            var pieces = String(it.sentence || "").split(BLANK);
            var slot = '<span class="ex-slot' + (a ? " filled" : "") + (done ? (right ? " right" : " wrong") : "") + '">' + (a ? esc(a + " " + wordFor(sec, a)) : "&nbsp;") + "</span>";
            h += '<div class="ex-q"><span class="ex-n">' + no + ".</span> " + (pieces.length > 1 ? pieces.map(lk).join(slot) : lk(pieces[0]) + " " + slot) + "</div>";
            h += '<div class="ex-letters">' + wordsOf(sec).map(function (w) {
                var cls = a === w.L ? " on" : "";
                if (done) cls += w.L === String(it.answer).trim().toUpperCase() ? " right" : a === w.L ? " wrong" : "";
                return '<button class="ex-l' + cls + '" data-key="' + key + '" data-v="' + w.L + '"' + (done ? " disabled" : "") + ' title="' + esc(w.w) + '">' + w.L + "</button>";
            }).join("") + "</div>";
        } else if (sec.type === "paixu") {
            var ord = a || "", ks = partKeys(it);
            h += '<div class="ex-q"><span class="ex-n">' + no + '.</span> <span class="muted small">Chạm các câu theo đúng thứ tự</span></div>';
            h += '<div class="ex-parts">' + ks.map(function (k) {
                var pos = ord.indexOf(k);
                return '<button class="ex-part' + (pos >= 0 ? " on" : "") + '" data-key="' + key + '" data-v="' + k + '"' + (done ? " disabled" : "") + ">" +
                    '<i class="ex-ord">' + (pos >= 0 ? pos + 1 : "") + "</i><b>" + k + '</b><span class="cn">' + esc(it.parts[k]) + "</span></button>";
            }).join("") + "</div>";
            h += '<div class="ex-ordline">Thứ tự của bạn: <b>' + (ord ? ord.split("").join(" → ") : "—") + "</b>" +
                (ord && !done ? ' <button class="pt" data-clear="' + key + '">↺ Xếp lại</button>' : "") + "</div>";
        } else {
            h += '<div class="ex-passage">' + lk(it.passage) + "</div>";
            h += '<div class="ex-q"><span class="ex-n">' + no + ".</span> " + lk(it.question) + "</div>";
            h += '<div class="q-opts">' + (it.options || []).map(function (o, j) {
                var cls = a != null && +a === j ? " on" : "";
                if (done) cls += j === +it.answer ? " right" : a != null && +a === j ? " wrong" : "";
                return '<button class="q-opt ex-o' + cls + '" data-key="' + key + '" data-v="' + j + '"' + (done ? " disabled" : "") + "><b>" + "ABCD".charAt(j) + "</b><span>" + esc(o) + "</span></button>";
            }).join("") + "</div>";
        }
        if (done) {
            L = answered(sec, it, a);
            h += '<div class="q-exp ' + (right ? "ok" : "bad") + '"><b>' + (right ? "✓ Đúng" : (L ? "✗ Sai" : "✗ Chưa làm") + " · Đáp án: " + esc(ansLabel(sec, it))) + "</b>";
            if (sec.type === "paixu") h += '<div class="ex-right cn">' + lk(normOrder(it.answer).split("").map(function (k) { return String((it.parts || {})[k] || "").trim(); })
                .reduce(function (acc, x) { return acc + (acc && !/[，。！？；：、,.!?;:…”」]$/.test(acc) ? "，" : "") + x; }, "")) + "</div>";
            if (it.vi) h += '<div class="ex-vi">🇻🇳 ' + esc(it.vi) + "</div>";
            if (it.passage_vi) h += '<details class="ex-pvi"><summary>🇻🇳 Dịch đoạn văn</summary><div>' + esc(it.passage_vi) + "</div></details>";
            if (it.explain_vi) h += '<div class="ex-why">💡 ' + esc(it.explain_vi) + "</div>";
            h += "</div>";
        }
        var hide = done && ex.wrongOnly && right;
        return '<div class="ex-item' + (done ? (right ? " ok" : " bad") : "") + '" id="exi-' + key + '"' + (hide ? " hidden" : "") + ">" + h + "</div>";
    }
    function bankHTML(sec, si) {
        var used = {};
        (sec.items || []).forEach(function (it, ii) { var a = ex.ans[si + "-" + ii]; if (a) used[a] = 1; });
        return wordsOf(sec).map(function (w) { return '<span class="ex-w' + (used[w.L] ? " used" : "") + '"><b>' + w.L + '</b><span class="cn">' + esc(w.w) + "</span></span>"; }).join("");
    }
    function fmtSec(ms) { return fmtClock(Math.max(0, ms)); }
    function renderExam() {
        if (!ex) return;
        var E = ex.e, no = 0, html = "";
        var tot = examTotal(), r = S.exams[E.id];
        html += '<header class="doc-head"><div class="eyebrow">📝 Luyện thi HSK ' + E.level + "</div>" +
            '<h1 class="doc-title ex-title">' + esc(E.title || E.id) + "</h1>" +
            '<div class="doc-meta"><span>' + tot.n + " câu</span><span>⏱ gợi ý ~" + Math.round(tot.n * MIN_PER_Q) + " phút</span>" +
            (r ? "<span>🏆 Tốt nhất " + r.best + "% · " + r.tries + " lần</span>" : "") + "</div></header>";
        if (ex.done && ex.res) {
            var R = ex.res, pct = Math.round(R.c * 100 / Math.max(1, R.n));
            html += '<div class="card result ex-res"><h3>' + (pct >= 80 ? "🎉 " : pct >= 60 ? "👍 " : "💪 ") + "Điểm: " + R.c + "/" + R.n + " (" + pct + "%)</h3>" +
                "<p>Thời gian làm bài: " + fmtClock(R.ms) + (r ? " · Lần tốt nhất: " + r.best + "%" : "") + "</p>" +
                '<div class="ex-secs">' + R.secs.map(function (s) { return '<span class="ex-sc"><b>' + esc(s.title) + "</b> " + s.c + "/" + s.n + "</span>"; }).join("") + "</div>" +
                '<div class="ex-res-act"><label class="check small"><input type="checkbox" id="ex-wrong"' + (ex.wrongOnly ? " checked" : "") + "> Chỉ xem câu sai</label>" +
                '<button class="btn btn-sm" id="ex-redo">🔁 Làm lại</button><button class="btn btn-sm" id="ex-back2">← Danh sách đề</button></div></div>';
        } else if (!ex.tm) {
            html += '<div class="card ex-intro"><b>Cách làm:</b> 选词填空 chọn chữ cái của từ đúng · 排列顺序 chạm 3 câu A/B/C theo thứ tự · 阅读理解 đọc đoạn văn rồi chọn đáp án. ' +
                "Chạm chữ trong câu/đoạn văn để tra từ. Bấm <b>⏱ Bấm giờ</b> nếu muốn luyện như thi thật.</div>";
        }
        E.sections.forEach(function (sec, si) {
            html += '<section class="ex-sec"><h2>Phần ' + (si + 1) + " · " + esc(sec.title || sec.type) + " <small>" + esc(SEC_VI[sec.type] || "") + "</small></h2>";
            if (sec.type === "xuanci") html += '<div class="ex-bank" id="exb-' + si + '">' + bankHTML(sec, si) + "</div>";
            (sec.items || []).forEach(function (it, ii) { no++; html += itemHTML(sec, it, si, ii, no); });
            html += "</section>";
        });
        html += '<div class="doc-end">' + (ex.done
            ? '<button class="btn btn-primary" id="ex-redo2">🔁 Làm lại đề này</button><button class="btn" id="ex-back3">← Danh sách đề</button>'
            : '<button class="btn btn-primary" id="ex-submit2">📤 Nộp bài</button>') + "</div>";
        $("exam-body").innerHTML = html;
        $("exam-view").classList.toggle("no-py", !S.settings.examPy);
        renderExamBar();
    }
    function renderExamBar() {
        if (!ex) return;
        var tot = examTotal();
        $("ex-prog").textContent = ex.done ? "Điểm " + ex.res.c + "/" + ex.res.n : "Đã làm " + tot.a + "/" + tot.n;
        $("ex-submit").hidden = ex.done;
        $("ex-py").classList.toggle("on", !!S.settings.examPy);
        $("ex-lk").classList.toggle("on", !!S.settings.lookup);
        var t = $("ex-timer");
        t.classList.remove("running", "over");
        if (ex.tm) {
            var left = ex.tm.end - Date.now();
            t.classList.add(left < 0 ? "over" : "running");
            $("ex-timer-label").textContent = left < 0 ? "Hết giờ +" + fmtSec(-left) : fmtSec(left);
        } else $("ex-timer-label").textContent = ex.done ? fmtClock(ex.res.ms) : "Bấm giờ";
    }
    function toggleExamTimer() {
        if (!ex || ex.done) return;
        if (ex.tm) {
            if (!confirm("Tắt bấm giờ?")) return;
            clearInterval(ex.tm.iv); ex.tm = null; renderExamBar(); return;
        }
        var n = examTotal().n, tm = ex.tm = { end: Date.now() + n * MIN_PER_Q * 60000, over: false, iv: 0 };
        ex.t0 = Date.now();
        tm.iv = setInterval(function () {
            if (!ex || ex.tm !== tm) { clearInterval(tm.iv); return; }
            if (!tm.over && Date.now() > tm.end) { tm.over = true; toast("⏰ Hết giờ gợi ý! Bạn vẫn có thể làm tiếp rồi nộp bài."); }
            renderExamBar();
        }, 1000);
        var intro = document.querySelector("#exam-body .ex-intro"); if (intro) intro.remove();
        toast("Bắt đầu bấm giờ: " + Math.round(n * MIN_PER_Q) + " phút cho " + n + " câu.");
        renderExamBar();
    }
    function setExamAns(key, v) {
        if (!ex || ex.done) return;
        var p = key.split("-"), si = +p[0], ii = +p[1], sec = ex.e.sections[si], it = sec.items[ii];
        if (v == null) ex.ans[key] = "";
        else if (sec.type === "paixu") {
            var cur = ex.ans[key] || "";
            if (cur.indexOf(v) >= 0) cur = cur.replace(v, "");
            else if (cur.length < partKeys(it).length) cur += v;
            ex.ans[key] = cur;
        } else if (sec.type === "yuedu") ex.ans[key] = +v;
        else ex.ans[key] = ex.ans[key] === v ? "" : v;   // chạm lại chữ cái đang chọn để bỏ chọn
        var el = $("exi-" + key), no = el ? el.querySelector(".ex-n") : null;
        if (el) el.outerHTML = itemHTML(sec, it, si, ii, no ? parseInt(no.textContent, 10) : 0);
        if (sec.type === "xuanci" && $("exb-" + si)) $("exb-" + si).innerHTML = bankHTML(sec, si);
        renderExamBar();
    }
    function submitExam() {
        if (!ex || ex.done) return;
        var tot = examTotal();
        if (tot.a < tot.n && !confirm("Còn " + (tot.n - tot.a) + " câu chưa làm. Vẫn nộp bài?")) return;
        HocLookup.close();
        var c = 0, n = 0, secs = [];
        ex.e.sections.forEach(function (sec, si) {
            var sc = 0, sn = 0;
            (sec.items || []).forEach(function (it, ii) { sn++; if (isRight(sec, it, ex.ans[si + "-" + ii])) sc++; });
            secs.push({ title: sec.title || sec.type, c: sc, n: sn });
            c += sc; n += sn;
        });
        var ms = Date.now() - ex.t0;
        if (ex.tm) { clearInterval(ex.tm.iv); ex.tm = null; }
        ex.done = true;
        ex.res = { c: c, n: n, secs: secs, ms: ms };
        var pct = Math.round(c * 100 / Math.max(1, n));
        var r = S.exams[ex.e.id] || { best: 0, last: 0, at: 0, tries: 0 };
        S.exams[ex.e.id] = { best: Math.max(r.best || 0, pct), last: pct, at: Date.now(), tries: (r.tries || 0) + 1 };
        save();
        renderExam();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function redoExam() { if (ex) openExam(ex.e, false); }

    // ====================================================================== Điều hướng theo URL
    var pushed = false;
    function route(push) {
        var q = new URLSearchParams(location.search);
        var id = q.get("id"), mine = q.get("mine"), boya = q.get("boya"), exam = q.get("exam");
        if (exam) {
            var e = examById(exam);
            if (e) { openExam(e, push); return; }
            toast("Không tìm thấy đề “" + exam + "”.");
        } else if (id) {
            var t = libById(id);
            if (t) { openDoc(docFromLib(t), push); return; }
            toast("Không tìm thấy bài “" + id + "”.");
        } else if (mine) {
            var m = mineById(mine);
            if (m) { openDoc(docFromMine(m), push); return; }
        } else if (boya) {
            var ri = +q.get("r") || 0;
            $("list-view").hidden = true;
            ensureBoya().then(function (ok) {
                var f = ok && findBoyaLesson(boya);
                if (f && f.lesson.readings && f.lesson.readings[ri]) openDoc(docFromBoya(f.book, f.lesson, ri), push);
                else { toast("Không mở được bài khóa."); closeDoc(true); }
            });
            return;
        }
        if (doc || ex || !$("reader-view").hidden || !$("exam-view").hidden) closeDoc(true);
        else setTab(S.settings.tab);
    }
    function open(d) { pushed = true; openDoc(d, true); }

    // ====================================================================== Gắn sự kiện
    function bind() {
        document.querySelectorAll(".tab").forEach(function (b) { b.onclick = function () { setTab(b.dataset.tab); }; });
        $("lib-kinds").addEventListener("click", function (e) {
            var b = e.target.closest(".chip"); if (!b) return;
            S.settings.kind = b.dataset.kind; libSeries = null; save(); renderLib();
        });
        $("lib-levels").addEventListener("click", function (e) {
            var b = e.target.closest(".chip"); if (!b) return;
            S.settings.level = +b.dataset.lv; save(); renderLib();
        });
        var searchT;
        $("lib-search").addEventListener("input", function () {
            clearTimeout(searchT);
            searchT = setTimeout(function () { libQuery = $("lib-search").value; renderLib(); }, 150);
        });
        function libClick(e) {
            if (e.target.closest("[data-act='series-back']")) { libSeries = null; renderLib(); window.scrollTo(0, 0); return; }
            var c = e.target.closest("[data-id]");
            if (c) { var t = libById(c.dataset.id); if (t) open(docFromLib(t)); return; }
            var sr = e.target.closest("[data-series]");
            if (sr) { libSeries = sr.dataset.series; renderLib(); window.scrollTo(0, Math.max(0, $("lib-list").getBoundingClientRect().top + window.scrollY - 76)); }
        }
        $("lib-list").addEventListener("click", libClick);
        $("lib-list").addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.matches("[data-series]")) libClick(e); });

        // Luyện thi
        $("exam-levels").addEventListener("click", function (e) {
            var b = e.target.closest(".chip"); if (!b) return;
            S.settings.examLv = +b.dataset.elv; save(); renderExamList();
        });
        $("exam-list").addEventListener("click", function (e) {
            var c = e.target.closest("[data-exam]"); if (!c) return;
            var x = examById(c.dataset.exam); if (x) { pushed = true; openExam(x, true); }
        });
        $("ex-submit").onclick = submitExam;
        $("ex-timer").onclick = toggleExamTimer;
        $("ex-py").onclick = function () { S.settings.examPy = !S.settings.examPy; save(); $("exam-view").classList.toggle("no-py", !S.settings.examPy); renderExamBar(); };
        $("ex-lk").onclick = function () { setSetting("lookup", !S.settings.lookup); if (!S.settings.lookup) HocLookup.close(); renderExamBar(); toast(S.settings.lookup ? "Chạm vào chữ để tra từ." : "Đã tắt chạm để tra."); };
        $("exam-body").addEventListener("click", function (e) {
            var b = e.target.closest("[data-key][data-v]");
            if (b && !b.disabled) { setExamAns(b.dataset.key, b.dataset.v); return; }
            var cl = e.target.closest("[data-clear]");
            if (cl) { setExamAns(cl.dataset.clear, null); return; }
            var t = e.target.closest("button"); if (!t) return;
            if (t.id === "ex-submit2") submitExam();
            else if (t.id === "ex-redo" || t.id === "ex-redo2") redoExam();
            else if (t.id === "ex-back2" || t.id === "ex-back3") backToList();
        });
        $("exam-body").addEventListener("change", function (e) {
            if (e.target.id === "ex-wrong" && ex) { ex.wrongOnly = e.target.checked; renderExam(); }
        });
        HocLookup.attach($("exam-body"), {
            dictUrl: DICT_URL,
            getSrc: function () { return ex ? "Luyện thi · " + (ex.e.title || ex.e.id) : "Đọc thêm"; },
            enabled: function () { return !!S.settings.lookup; },
            speak: speakWord
        });
        $("mine-form").addEventListener("submit", saveMine);
        $("mine-text").addEventListener("input", updateMineCount);
        $("mine-cancel").onclick = function () { editingId = null; $("mine-title").value = ""; $("mine-text").value = ""; renderMine(); };
        $("mine-list").addEventListener("click", function (e) {
            var ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
            if (ed) { e.stopPropagation(); editMine(ed.dataset.edit); return; }
            if (del) { e.stopPropagation(); delMine(del.dataset.del); return; }
            var c = e.target.closest("[data-mine]"); if (!c) return;
            var m = mineById(c.dataset.mine); if (m) open(docFromMine(m));
        });
        $("mine-list").addEventListener("keydown", function (e) {
            if (e.key !== "Enter" || !e.target.matches("[data-mine]")) return;
            var m = mineById(e.target.dataset.mine); if (m) open(docFromMine(m));
        });
        $("boya-list").addEventListener("click", function (e) {
            var b = e.target.closest("[data-boya]"); if (!b) return;
            var f = findBoyaLesson(b.dataset.boya); if (f) open(docFromBoya(f.book, f.lesson, +b.dataset.r));
        });

        // Nút ← : trong trình đọc thì quay về danh sách
        $("btn-back").addEventListener("click", function (e) {
            if ($("reader-view").hidden && $("exam-view").hidden) return;
            e.preventDefault();
            backToList();
        });
        window.addEventListener("popstate", function () { route(false); });
        window.addEventListener("pagehide", stopAll);

        // Thanh công cụ
        $("tb-py").onclick = function () { setSetting("py", !S.settings.py); };
        $("tb-smaller").onclick = function () { setSetting("size", Math.max(16, S.settings.size - 2)); };
        $("tb-bigger").onclick = function () { setSetting("size", Math.min(36, S.settings.size + 2)); };
        $("tb-new").onclick = function () {
            setSetting("hl", !S.settings.hl);
            if (S.settings.hl && (!known || !HocLookup.ready())) toast("Đang tải từ điển…");
            if (S.settings.hl && known && !known.size) toast("Bạn chưa học từ nào ở các trang khác, nên mọi từ đều được tô.");
        };
        $("tb-tr").onclick = function () { var o = ["off", "para", "all"]; setSetting("tr", o[(o.indexOf(S.settings.tr) + 1) % 3]); };
        $("tb-lookup").onclick = function () { setSetting("lookup", !S.settings.lookup); if (!S.settings.lookup) HocLookup.close(); toast(S.settings.lookup ? "Chạm vào chữ để tra từ." : "Đã tắt chạm để tra."); };
        $("tb-listen").onclick = function () {
            if ($("tb-listen").classList.contains("on")) { stopPlay(); return; }
            playParas(0, doc.paras.length - 1);
        };
        $("tb-role").onclick = function () { if (role) stopPlay(); else startRole(); };
        $("tb-rate").onchange = function () { setSetting("rate", parseFloat($("tb-rate").value) || 0.9); };
        $("tb-timer").onclick = function () { if (timer) finishTimer(); else startTimer(); };
        $("btn-timer-done").onclick = finishTimer;
        $("btn-timer-cancel").onclick = function () { cancelTimer(); toast("Đã hủy tính giờ."); };
        $("opt-autohide").onchange = function () { setSetting("autoHide", $("opt-autohide").checked); };
        $("btn-play-stop").onclick = stopPlay;

        // Văn bản: nút ở từng đoạn
        var body = $("doc-body");
        body.addEventListener("click", function (e) {
            var b = e.target.closest(".pt"); if (!b) return;
            var k = +b.dataset.k;
            if (b.classList.contains("pt-say")) playParas(k, k);
            else if (b.classList.contains("pt-shadow")) shadowPara(k, 0);
            else if (b.classList.contains("pt-tr")) b.closest(".para").classList.toggle("open");
        });
        // Bấm giữ vào chữ: nghe câu chứa chữ đó (không mở khung tra)
        var lp = null, lpFired = false;
        body.addEventListener("pointerdown", function (e) {
            var c = e.target.closest(".lk-c"); if (!c) return;
            lpFired = false;
            var para = c.closest(".para"), x = e.clientX, y = e.clientY;
            clearTimeout(lp && lp.t);
            lp = { x: x, y: y, t: setTimeout(function () {
                lpFired = true;
                HocLookup.close();
                speakSentenceAt(+para.dataset.k, +c.getAttribute("data-i"));
            }, 550) };
        });
        function cancelLp(e) {
            if (!lp) return;
            if (e && e.type === "pointermove" && Math.abs(e.clientX - lp.x) + Math.abs(e.clientY - lp.y) < 10) return;
            clearTimeout(lp.t); lp = null;
        }
        body.addEventListener("pointermove", cancelLp);
        body.addEventListener("pointerup", function () { cancelLp(); });
        body.addEventListener("pointercancel", function () { cancelLp(); });
        body.addEventListener("contextmenu", function (e) { if (lpFired) e.preventDefault(); });
        body.addEventListener("click", function (e) { if (lpFired) { lpFired = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
        HocLookup.attach(body, {
            dictUrl: DICT_URL,
            getSrc: function () { return doc ? doc.src : "Đọc thêm"; },
            enabled: function () { return !!S.settings.lookup; },
            speak: speakWord,
            onAdd: function () { buildKnown(); markNew(); }
        });

        $("doc-beyond").addEventListener("click", function (e) { var b = e.target.closest("[data-bw]"); if (b) toggleBeyond(+b.dataset.bw); });
        // Truyện dài: chuyển chương (thanh trên + cuối bài)
        $("reader").addEventListener("click", function (e) {
            var g = e.target.closest("[data-goto]");
            if (g && g.dataset.goto && !g.disabled) gotoLib(g.dataset.goto);
        });
        // Hội thoại: chọn vai người học
        $("doc-dlg").addEventListener("change", function (e) {
            if (e.target.id !== "dlg-me") return;
            if (role) stopPlay();
            myRole = e.target.value;
            renderDlgBar();
            if (myRole) toast("Bấm 🎭 Nhập vai để bắt đầu: bạn nói lời của " + myRole + ".");
        });
        // Thành ngữ
        var idBox = $("doc-idiom");
        idBox.addEventListener("click", function (e) {
            if (e.target.closest(".id-say")) { speakWord(doc.idiom.hz); return; }
            var s = e.target.closest(".id-ex-say");
            if (s) { var x = doc.idiom.examples[+s.dataset.ex]; if (x) { stopPlay(); speakOne(x.zh); } return; }
            if (e.target.closest(".id-add")) toggleIdiomWord();
        });
        HocLookup.attach(idBox, {
            dictUrl: DICT_URL,
            getSrc: function () { return doc ? doc.src : "Đọc thêm"; },
            enabled: function () { return !!S.settings.lookup; },
            speak: speakWord,
            onAdd: function () { buildKnown(); markNew(); }
        });
        $("doc-quiz").addEventListener("click", function (e) {
            var o = e.target.closest(".q-opt");
            if (o) { answerQuiz(+o.dataset.q, +o.dataset.o); return; }
            var v = e.target.closest(".q-vi-btn");
            if (v) { var el = document.querySelector('.q[data-q="' + v.dataset.q + '"] .q-vi'); el.hidden = !el.hidden; v.textContent = el.hidden ? "Xem nghĩa câu hỏi" : "Ẩn nghĩa"; }
        });
        $("doc-end").addEventListener("click", function (e) {
            var b = e.target.closest("button"); if (!b) return;
            if (b.id === "btn-read") setRead(true);
            else if (b.id === "btn-unread") setRead(false);
            else if (b.id === "btn-end-back") backToList();
            else if (b.id === "btn-next") {
                var n = nextDoc();
                if (n) { openDoc(docFromLib(n), false); try { history.replaceState({ reader: 1 }, "", doc.url); } catch (er) {} }
            }
        });

        if (window.HocMyWords && HocMyWords.onChange) HocMyWords.onChange(function () { if (known) { buildKnown(); markNew(); } });
        if ("speechSynthesis" in window) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = function () {}; }
    }
    function backToList() {
        if (pushed) { pushed = false; history.back(); }
        else closeDoc(false);
    }

    // ====================================================================== Khởi động
    bind();
    writeSummary();
    route(false);
    Promise.all([HocLookup.loadDict(DICT_URL), ensureKnown()]).then(function () {
        fillKnown();
        markNew();
        if (doc && doc.idiom) renderIdiom();
    });

    // Lộ ra cho test tự động
    window.__DT = {
        state: S, openLib: function (id) { open(docFromLib(libById(id))); }, doc: function () { return doc; },
        openExam: function (id) { pushed = true; openExam(examById(id), true); }, exam: function () { return ex; },
        setExamAns: setExamAns, submitExam: submitExam, series: SERIES, units: UNITS, setMyRole: function (n) { myRole = n; },
        knownPct: knownPct, buildKnown: buildKnown, ensureKnown: ensureKnown, parseBoyaReading: parseBoyaReading, alignTranslations: alignTranslations
    };
})();
