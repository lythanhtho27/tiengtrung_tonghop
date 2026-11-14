/* ==========================================================================
   DOC_THEM.JS — Trang "Đọc thêm"
   - Tab Thư viện: bài đọc theo cấp HSK (doc_data.js, window.DOC_LIBRARY)
   - Tab Bài của tôi: người học tự dán bài, pinyin sinh bằng HocLookup.pinyinOf
   - Tab Bài khóa đã học: bài khóa Boya của các bài đã mở (nạp lười ../boya_learning/boya_data.js)
   - Trình đọc chung: pinyin, cỡ chữ, tô từ chưa học, bản dịch, chạm để tra (shared/lookup.js),
     nghe/nhại (speechSynthesis zh-CN), đọc tính giờ (chữ/phút), câu hỏi đọc hiểu.
   Key localStorage "doc_them_v1" = {
     settings: { tab, level, py, size, hl, tr: "off"|"para"|"all", lookup, rate, autoHide },
     mine: [{ id, title, text, added }],
     read: { "<id>": { done, at, quiz: { c, n }, cpm: [{ at, v }] } }
       id: bài thư viện "h3-02" · bài của tôi "m<số>" · bài khóa Boya "boya:<lesson_id>:<chỉ số bài đọc>"
   }
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
    var DEFAULT_SETTINGS = { tab: "lib", level: 0, py: true, size: 22, hl: false, tr: "para", lookup: true, rate: 0.9, autoHide: true };
    var S = (function () {
        var v = readJSON(KEY, null) || {};
        return {
            settings: Object.assign({}, DEFAULT_SETTINGS, v.settings || {}),
            mine: Array.isArray(v.mine) ? v.mine : [],
            read: v.read && typeof v.read === "object" ? v.read : {}
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
    function setTab(tab) {
        S.settings.tab = tab; save();
        document.querySelectorAll(".tab").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === tab); b.setAttribute("aria-selected", b.dataset.tab === tab); });
        ["lib", "mine", "boya"].forEach(function (t) { $("tab-" + t).hidden = t !== tab; });
        if (tab === "lib") renderLib();
        else if (tab === "mine") renderMine();
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

    // ---------------------------------------------------------------------- Thư viện
    function renderLib() {
        var lv = S.settings.level || 0;
        var counts = {}, doneN = 0;
        LIB.forEach(function (t) { counts[t.level] = (counts[t.level] || 0) + 1; if (S.read[t.id] && S.read[t.id].done) doneN++; });
        var chips = '<button class="chip' + (lv ? "" : " on") + '" data-lv="0">Tất cả<small>' + LIB.length + "</small></button>";
        for (var l = 1; l <= 6; l++) if (counts[l]) chips += '<button class="chip' + (lv === l ? " on" : "") + '" data-lv="' + l + '">HSK ' + l + "<small>" + counts[l] + "</small></button>";
        $("lib-levels").innerHTML = chips;

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

        var list = LIB.filter(function (t) { return !lv || t.level === lv; });
        if (!list.length) { $("lib-list").innerHTML = '<div class="empty">Chưa có bài ở cấp này.</div>'; return; }
        $("lib-list").innerHTML = list.map(function (t) {
            var r = S.read[t.id] || {};
            return '<button class="tcard' + (r.done ? " done" : "") + '" data-id="' + esc(t.id) + '">' +
                '<div class="tc-top"><span class="lv lv-' + t.level + '">HSK ' + t.level + '</span><span class="topic">' + esc(t.topic || "") + "</span>" + readBadge(t.id) + "</div>" +
                '<div class="tc-title">' + esc(t.title) + "</div>" +
                '<div class="tc-vi">' + esc(t.title_vi || "") + "</div>" +
                '<div class="tc-meta">' + metaBits(t.id, t.chars || hanCount(t.paragraphs.join(""))) + "</div>" +
                '<div data-known="' + esc(t.id) + '">' + knownHTML(knownPct("lib:" + t.id, t.paragraphs)) + "</div>" +
                "</button>";
        }).join("");
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

    function docFromLib(t) {
        return {
            id: t.id, kind: "lib", title: t.title, sub: t.title_vi || "", eyebrow: "HSK " + t.level + (t.topic ? " · " + t.topic : ""),
            src: "Đọc thêm · " + t.title, url: "?id=" + encodeURIComponent(t.id),
            paras: t.paragraphs.map(function (p, i) { return { text: p, pys: t.pinyin && t.pinyin[i] ? t.pinyin[i].split(" ") : null, tr: (t.translations || [])[i] || null, kind: "p" }; }),
            beyond: t.beyond || [], questions: t.questions || []
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
        doc = d;
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
        if (fromPop) pushed = false;
        $("reader-view").hidden = true;
        $("list-view").hidden = false;
        $("brand-title").textContent = "Đọc thêm";
        $("brand-sub").textContent = "Bài đọc theo cấp · Bài của tôi · Bài khóa";
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
        renderBeyond();
        renderBody();
        renderQuiz();
        renderEnd();
        applySettings();
        $("tb-tr").hidden = !d.paras.some(function (p) { return p.tr; });
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
            return '<div class="para ' + p.kind + '" data-k="' + i + '">' +
                '<div class="ptext" data-lk-text="' + esc(p.text) + '">' + HocLookup.rubyHTML(p.text, pys) + "</div>" +
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
            (nextDoc() ? '<button class="btn" id="btn-next">Bài tiếp →</button>' : "");
    }
    function setRead(on) {
        var r = rec(doc.id);
        r.done = !!on;
        if (on) r.at = Date.now();
        save(); renderEnd();
        toast(on ? "Đã đánh dấu đã đọc." : "Đã bỏ đánh dấu.");
    }
    function nextDoc() {
        if (!doc || doc.kind !== "lib") return null;
        for (var i = 0; i < LIB.length; i++) if (LIB[i].id === doc.id) return LIB[i + 1] || null;
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
    function speakWord(t) { if ("speechSynthesis" in window) speechSynthesis.cancel(); speakOne(t, Math.min(1, S.settings.rate)); }
    function wait(ms, token) { return new Promise(function (res) { setTimeout(function () { res(token === playToken); }, ms); }); }
    function stopPlay() {
        playToken++;
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

    // ====================================================================== Điều hướng theo URL
    var pushed = false;
    function route(push) {
        var q = new URLSearchParams(location.search);
        var id = q.get("id"), mine = q.get("mine"), boya = q.get("boya");
        if (id) {
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
        if (doc || !$("reader-view").hidden) closeDoc(true);
        else setTab(S.settings.tab);
    }
    function open(d) { pushed = true; openDoc(d, true); }

    // ====================================================================== Gắn sự kiện
    function bind() {
        document.querySelectorAll(".tab").forEach(function (b) { b.onclick = function () { setTab(b.dataset.tab); }; });
        $("lib-levels").addEventListener("click", function (e) {
            var b = e.target.closest(".chip"); if (!b) return;
            S.settings.level = +b.dataset.lv; save(); renderLib();
        });
        $("lib-list").addEventListener("click", function (e) {
            var c = e.target.closest(".tcard"); if (!c) return;
            var t = libById(c.dataset.id); if (t) open(docFromLib(t));
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
            if ($("reader-view").hidden) return;
            e.preventDefault();
            backToList();
        });
        window.addEventListener("popstate", function () { route(false); });

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
    });

    // Lộ ra cho test tự động
    window.__DT = {
        state: S, openLib: function (id) { open(docFromLib(libById(id))); }, doc: function () { return doc; },
        knownPct: knownPct, buildKnown: buildKnown, ensureKnown: ensureKnown, parseBoyaReading: parseBoyaReading, alignTranslations: alignTranslations
    };
})();
