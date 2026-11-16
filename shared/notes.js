/* ==========================================================================
   SHARED/NOTES.JS — Ghi chú gợi nhớ cho từng từ (dùng chung mọi trang)
   - Key localStorage "hoc_notes_v1" = { "<chữ Hán>": { t: "ghi chú", at: ms } }  (được sync.js đồng bộ)
   - API: HocNotes.get(hz) -> chuỗi | ""   HocNotes.set(hz, text)  (text rỗng = xóa)   HocNotes.all() -> {hz: {t, at}}
          HocNotes.onChange(fn)
   - Dùng ở: hom_nay (thẻ ôn, danh sách từ cứng đầu), khung tra từ (shared/lookup.js), bảng Họ chữ (shared/zizu.js).
   ========================================================================== */
(function () {
    "use strict";
    var KEY = "hoc_notes_v1", listeners = [];
    function key(hz) { return String(hz || "").replace(/\s+/g, "").replace(/[（(][^）)]*[）)]/g, ""); }
    function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }
    window.HocNotes = {
        get: function (hz) { var n = load()[key(hz)]; return n && n.t ? n.t : ""; },
        set: function (hz, text) {
            var d = load(), k = key(hz);
            if (!k) return;
            text = String(text || "").trim();
            if (text) d[k] = { t: text.slice(0, 500), at: Date.now() }; else delete d[k];
            try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
            listeners.forEach(function (f) { try { f(k, text); } catch (e) {} });
        },
        all: function () { return load(); },
        onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); }
    };
})();
