/* ==========================================================================
   SHARED/MYWORDS.JS — Sổ "Từ của tôi": từ người học tự thêm (ví dụ khi tra từ trong bài khóa)
   - Key localStorage "hoc_mywords_v1" = { v: 1, words: { "<chữ Hán>": entry } }  (được sync.js đồng bộ)
   - entry = { hz, py, hv, vi, ex, exvi, src, added, card: { ef, iv, reps, lapses, due, last, rt } }
     src: nơi thêm (vd "Boya · Chuẩn TC1 · Bài 3"). Thẻ ôn theo SM-2 giống hsk_lotrinh (schedule()).
   - Ôn ở trang "Hôm nay" (hom_nay/) cùng các thẻ của mọi trang khác; trang Luyện tập cũng dùng các từ này.
   - API: HocMyWords.all() / get(hz) / has(hz) / add({...}) / remove(hz) / update(hz, patch)
          HocMyWords.due(now) / schedule(card, rating) / ivLabel(card, rating) / onChange(fn)
   ========================================================================== */
(function () {
    "use strict";
    var KEY = "hoc_mywords_v1";
    var DAY = 86400000;
    var listeners = [];

    function startOfDay(t) { var d = new Date(t === undefined ? Date.now() : t); d.setHours(0, 0, 0, 0); return d.getTime(); }
    function load() {
        try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v && v.words) return v; } catch (e) {}
        return { v: 1, words: {} };
    }
    function save(data) {
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
        for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) { console.error(e); } }
    }
    function keyOf(hz) { return String(hz || "").replace(/\s+/g, "").trim(); }

    // SM-2 rút gọn, giống hsk_lotrinh.js: 1 Quên / 2 Khó / 3 Nhớ / 4 Dễ; hạn ôn làm tròn về đầu ngày
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

    window.HocMyWords = {
        KEY: KEY,
        all: function () { var w = load().words; return Object.keys(w).map(function (k) { return w[k]; }); },
        get: function (hz) { return load().words[keyOf(hz)] || null; },
        has: function (hz) { return !!load().words[keyOf(hz)]; },
        add: function (info) {
            var k = keyOf(info && info.hz);
            if (!k) return null;
            var data = load();
            if (data.words[k]) return data.words[k];
            var now = Date.now();
            data.words[k] = {
                hz: k, py: info.py || "", hv: info.hv || "", vi: info.vi || "", ex: info.ex || "", exvi: info.exvi || "",
                src: info.src || "", added: now,
                card: { ef: 2.5, iv: 0, reps: 0, lapses: 0, due: now, last: 0 }   // đến hạn ngay: ôn lần đầu trong hôm nay
            };
            save(data);
            return data.words[k];
        },
        remove: function (hz) { var data = load(); delete data.words[keyOf(hz)]; save(data); },
        update: function (hz, patch) {
            var data = load(), k = keyOf(hz);
            if (!data.words[k]) return null;
            Object.assign(data.words[k], patch || {});
            save(data);
            return data.words[k];
        },
        due: function (now) {
            now = now || Date.now();
            return this.all().filter(function (e) { return e.card && e.card.due <= now; });
        },
        schedule: schedule,
        ivLabel: ivLabel,
        onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); }
    };
})();
