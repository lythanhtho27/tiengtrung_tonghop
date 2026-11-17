/* ==========================================================================
   SHARED/SENTENCES.JS — "Câu của tôi" (sentence mining): câu hay người học lưu khi đọc, ôn dạng điền từ
   - Key localStorage "hoc_sentences_v1" = { v: 1, items: { "<id>": entry } }   (được sync.js đồng bộ)
   - entry = { id, zh: câu đầy đủ, target: từ được che (phải nằm trong zh), py: pinyin của từ, hv, vi: nghĩa của từ,
               ctx_vi: bản dịch đoạn chứa câu (nếu có), src: nguồn ("Đọc thêm · <tiêu đề>"), url: link mở lại bài (tính từ thư mục gốc),
               added, card: { ef, iv, reps, lapses, due, last } }
   - Ôn ở trang Hôm nay (bước 1, nguồn "Câu của tôi"): hiện câu với từ bị che → nhớ lại từ → lật xem → chấm 1–4 (SM-2 như hsk_lotrinh).
   - API: HocSentences.all() / get(id) / has(zh, target) / add({...}) -> entry / remove(id) / update(id, patch)
          HocSentences.due(now) / schedule(card, rating) / ivLabel(card, rating) / cloze(entry) -> "câu với ＿＿" / onChange(fn)
   ========================================================================== */
(function () {
    "use strict";
    var KEY = "hoc_sentences_v1";
    var DAY = 86400000;
    var listeners = [];

    function startOfDay(t) { var d = new Date(t === undefined ? Date.now() : t); d.setHours(0, 0, 0, 0); return d.getTime(); }
    function load() {
        try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v && v.items) return v; } catch (e) {}
        return { v: 1, items: {} };
    }
    function save(data) {
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
        listeners.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
    }
    function norm(s) { return String(s || "").replace(/\s+/g, "").trim(); }
    function makeId(zh, target) {
        var s = norm(zh) + "|" + norm(target), h = 5381;
        for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
        return "s" + h.toString(36);
    }
    // SM-2 rút gọn giống hsk_lotrinh.js / shared/mywords.js
    function schedule(c, rating) {
        var n = Object.assign({ ef: 2.5, iv: 0, reps: 0, lapses: 0 }, c);
        n.last = Date.now();
        if (rating === 1) {
            n.reps = 0; n.lapses = (n.lapses || 0) + 1; n.ef = Math.max(1.3, n.ef - 0.2);
            n.iv = 0; n.due = Date.now() + 10 * 60000;
            return n;
        }
        var iv, civ = n.iv || 0;
        if (rating === 2) { iv = Math.max(1, Math.round(civ * 1.2)); n.ef = Math.max(1.3, n.ef - 0.15); }
        else if (rating === 3) { iv = civ < 1 ? 1 : (n.reps <= 1 ? Math.max(3, civ + 1) : Math.round(civ * n.ef)); }
        else { iv = civ < 1 ? 3 : Math.round(Math.max(4, civ * n.ef * 1.3)); n.ef = n.ef + 0.15; }
        n.iv = Math.min(iv, 365); n.reps = (n.reps || 0) + 1;
        n.due = startOfDay() + n.iv * DAY;
        return n;
    }
    function ivLabel(c, rating) {
        var n = schedule(c, rating);
        if (n.iv === 0) return "10 phút";
        if (n.iv < 30) return n.iv + " ngày";
        if (n.iv < 365) return Math.round(n.iv / 30) + " tháng";
        return "1 năm";
    }
    function cloze(e) {
        if (!e) return "";
        var zh = String(e.zh || ""), t = String(e.target || "");
        var i = t ? zh.indexOf(t) : -1;
        return i < 0 ? zh : zh.slice(0, i) + "＿".repeat(Math.max(2, t.length)) + zh.slice(i + t.length);
    }

    window.HocSentences = {
        KEY: KEY,
        all: function () { var it = load().items; return Object.keys(it).map(function (k) { return it[k]; }).sort(function (a, b) { return (b.added || 0) - (a.added || 0); }); },
        get: function (id) { return load().items[id] || null; },
        has: function (zh, target) { return !!load().items[makeId(zh, target)]; },
        add: function (info) {
            var zh = String(info && info.zh || "").trim(), target = String(info && info.target || "").trim();
            if (!zh || !target || zh.indexOf(target) < 0) return null;
            var data = load(), id = makeId(zh, target);
            if (data.items[id]) return data.items[id];
            var now = Date.now();
            data.items[id] = {
                id: id, zh: zh.slice(0, 300), target: target, py: info.py || "", hv: info.hv || "", vi: info.vi || "",
                ctx_vi: String(info.ctx_vi || "").slice(0, 600), src: info.src || "", url: info.url || "", added: now,
                card: { ef: 2.5, iv: 0, reps: 0, lapses: 0, due: now, last: 0 }
            };
            save(data);
            return data.items[id];
        },
        remove: function (id) { var d = load(); delete d.items[id]; save(d); },
        update: function (id, patch) {
            var d = load();
            if (!d.items[id]) return null;
            Object.assign(d.items[id], patch || {});
            save(d);
            return d.items[id];
        },
        due: function (now) { now = now || Date.now(); return this.all().filter(function (e) { return e.card && e.card.due <= now; }); },
        schedule: schedule, ivLabel: ivLabel, cloze: cloze, makeId: makeId,
        onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); }
    };
})();
