/* ==========================================================================
   SHARED/LOOKUPS.JS — Đếm số lần tra từ khi đọc (HocLookups), để gợi ý học những từ hay tra mà chưa nhớ
   - Key localStorage "hoc_lookups_v1" = { v: 1, w: { "<chữ Hán>": { n: số lần tra, at: lần tra gần nhất, src, ex: câu chứa từ } } }
     (được sync.js đồng bộ). Tra lại cùng từ trong vòng 30 phút không tính thêm lần.
   - Ghi ở: khung tra của shared/lookup.js (Đọc thêm) và boya_learning. Danh sách "Từ bạn hay tra" ở Thư viện Đọc thêm.
   - API: HocLookups.record(hz, {src, ex}) -> số lần · count(hz) · list(minN) -> [{hz, n, at, src, ex}] · remove(hz)
   ========================================================================== */
(function () {
    "use strict";
    var KEY = "hoc_lookups_v1", GAP = 30 * 60000, MAX = 1500;
    function load() {
        try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v && v.w) return v; } catch (e) {}
        return { v: 1, w: {} };
    }
    function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
    function key(hz) { return String(hz || "").replace(/[^㐀-鿿]/g, ""); }
    // Giữ tối đa MAX từ: bỏ trước các từ chỉ tra 1 lần và lâu nhất
    function prune(d) {
        var ks = Object.keys(d.w);
        if (ks.length <= MAX) return;
        ks.sort(function (a, b) { return (d.w[a].n - d.w[b].n) || (d.w[a].at - d.w[b].at); });
        ks.slice(0, ks.length - MAX).forEach(function (k) { delete d.w[k]; });
    }
    window.HocLookups = {
        record: function (hz, o) {
            var k = key(hz);
            if (!k) return 0;
            var d = load(), e = d.w[k], now = Date.now();
            if (!e) e = d.w[k] = { n: 0, at: 0 };
            if (now - (e.at || 0) >= GAP) e.n = (e.n || 0) + 1;
            e.at = now;
            if (o && o.src) e.src = String(o.src).slice(0, 80);
            if (o && o.ex) e.ex = String(o.ex).slice(0, 120);
            prune(d);
            save(d);
            return e.n;
        },
        count: function (hz) { var e = load().w[key(hz)]; return e ? e.n || 0 : 0; },
        list: function (minN) {
            var w = load().w;
            return Object.keys(w).filter(function (k) { return (w[k].n || 0) >= (minN || 1); })
                .map(function (k) { return { hz: k, n: w[k].n, at: w[k].at, src: w[k].src || "", ex: w[k].ex || "" }; })
                .sort(function (a, b) { return (b.n - a.n) || (b.at - a.at); });
        },
        remove: function (hz) { var d = load(); delete d.w[key(hz)]; save(d); }
    };
})();
