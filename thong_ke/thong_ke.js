/* ==========================================================================
   THỐNG KÊ & DỰ BÁO — chỉ ĐỌC tiến độ trong localStorage của các trang, không ghi key nào.
   Nguồn thẻ SRS (thẻ: { ef, iv, reps, lapses, due, last, first?, rt?, wrong? }):
     hsk   hsk_lotrinh_v1.srs[id]              id "3-帮忙" (chứa cấp)
     boya  boya_learning_progress_v2.srs[id]   id "tc1_3_5" -> chữ Hán qua LT_DATA.words
     tv    boya_tv_srs[id]                     id "tc1_3_5"
     wl    hsk_wl_srs_v3[id]                   thẻ tự chứa hz/py/vi, first
     my    hoc_mywords_v1.words[hz].card       (+ added)
   Bộ đếm ngày:
     hsk_lotrinh_v1.days[d] = { n, r, c, t, ms, mc }       n từ mới, r lượt ôn, t câu trả lời
     boya_learning_progress_v2.days[d] = { n, q, r, c, rd } (+ streak, reading{key:[{d,cpm}]})
     boya_tv_days[d] = { n, r }  (trang tuvung chỉ giữ 60 ngày)
     hsk_wl_json_progress_v2.daily = { d, n, r }  (chỉ hôm nay) -> từ mới theo ngày lấy từ card.first
     luyen_tap_v1.days[d] = { n, ok }, hom_nay_v1.days[d] = { r, ok, steps }
     doc_them_v1.read[id] = { done, at, cpm: [{ at, v }] }
   Lượt ôn ở trang Hôm nay đã được ghi vào bộ đếm của từng trang nguồn nên không cộng thêm hom_nay_v1.days.r.
   ========================================================================== */
(function () {
    "use strict";

    const DAY = 86400000;
    const MASTER_IV = 21;
    const SLOW_MS = 3000;
    const OVERLOAD = 100;
    const HSK_TOTAL = { 1: 149, 2: 150, 3: 295, 4: 600, 5: 1295, 6: 2513 };
    const SRC = {
        hsk:  { name: "HSK 1–6",     page: "hsk_lotrinh" },
        boya: { name: "Boya",        page: "boya_learning" },
        tv:   { name: "Boya TC",     page: "tuvung" },
        wl:   { name: "HSK 3.0",     page: "word_learning" },
        my:   { name: "Từ của tôi",  page: "" },
    };
    const LT = window.LT_DATA || { words: {} };
    const HAN = /[㐀-鿿]/;

    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const fmt = n => Number(n || 0).toLocaleString("vi-VN");
    const pct = x => Math.round(x * 100) + "%";
    function dayKey(t) {
        const d = new Date(t === undefined ? Date.now() : t);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    function startOfDay(t) { const d = new Date(t === undefined ? Date.now() : t); d.setHours(0, 0, 0, 0); return d.getTime(); }
    function addDays(t, n) { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); }   // an toàn với giờ mùa hè
    function parseDay(k) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : NaN; }
    function weekStart(t) { const d = new Date(startOfDay(t)); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.getTime(); }   // thứ Hai
    function readJSON(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
    const obj = v => (v && typeof v === "object" ? v : {});
    function cleanHz(s) {   // giống hom_nay.js / luyen_tap.js
        let t = String(s || "").replace(/[（(]([^）)]*)[）)](?=[一-鿿])/g, "$1");
        t = t.replace(/\s*[（(][^）)]*[）)]\s*/g, "");
        return t.replace(/\s+/g, "").trim() || String(s || "");
    }
    const ddmm = t => { const d = new Date(t); return d.getDate() + "/" + (d.getMonth() + 1); };
    const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

    // ====================================================================== Đọc dữ liệu
    // Cấp HSK của chữ Hán (cấp thấp nhất nếu trùng nhiều cấp), từ id "N-..." trong LT_DATA
    const HSK_LV = new Map();
    Object.keys(LT.words || {}).forEach(id => {
        const m = /^([1-6])-/.exec(id);
        if (!m) return;
        const hz = cleanHz(LT.words[id][0]);
        const lv = +m[1];
        if (!HSK_LV.has(hz) || HSK_LV.get(hz) > lv) HSK_LV.set(hz, lv);
    });

    function loadAll() {
        const D = {
            hsk: obj(readJSON("hsk_lotrinh_v1", {})),
            boya: obj(readJSON("boya_learning_progress_v2", {})),
            tvSrs: obj(readJSON("boya_tv_srs", {})),
            tvDays: obj(readJSON("boya_tv_days", {})),
            wlSrs: obj(readJSON("hsk_wl_srs_v3", {})),
            wlProg: obj(readJSON("hsk_wl_json_progress_v2", {})),
            my: obj(obj(readJSON("hoc_mywords_v1", {})).words),
            lt: obj(readJSON("luyen_tap_v1", {})),
            hn: obj(readJSON("hom_nay_v1", {})),
            dt: obj(readJSON("doc_them_v1", {})),
        };
        return D;
    }

    // Mọi thẻ SRS: [{ src, id, card, hz, py, vi }] — cùng bộ lọc với trang Hôm nay
    function collectCards(D) {
        const out = [];
        const push = (src, id, card, hz, py, vi) => {
            if (!card || typeof card !== "object" || !hz || !HAN.test(hz)) return;
            out.push({ src, id, card, hz: cleanHz(hz), py: py || "", vi: vi || "" });
        };
        const hs = obj(D.hsk.srs);
        Object.keys(hs).forEach(id => {
            const w = LT.words[id];
            push("hsk", id, hs[id], w ? w[0] : id.slice(id.indexOf("-") + 1), w && w[1], w && w[2]);
        });
        [["boya", obj(D.boya.srs)], ["tv", D.tvSrs]].forEach(([src, srs]) => {
            Object.keys(srs).forEach(id => { const w = LT.words[id]; if (w) push(src, id, srs[id], w[0], w[1], w[2]); });
        });
        Object.keys(D.wlSrs).forEach(id => { const c = D.wlSrs[id]; if (c) push("wl", id, c, c.hz, c.py, c.vi); });
        Object.keys(D.my).forEach(k => { const e = D.my[k]; if (e && e.card) push("my", k, e.card, e.hz || k, e.py, e.vi); });
        return out;
    }

    // Gộp theo chữ Hán
    function groupWords(cards) {
        const map = new Map();
        cards.forEach(x => {
            let w = map.get(x.hz);
            if (!w) { w = { hz: x.hz, py: "", vi: "", cards: [], srcs: new Set() }; map.set(x.hz, w); }
            w.cards.push(x); w.srcs.add(x.src);
            if (!w.py && x.py) w.py = x.py;
            if (!w.vi && x.vi) w.vi = x.vi;
        });
        map.forEach(w => {
            w.iv = Math.max.apply(null, w.cards.map(x => +x.card.iv || 0));
            const rts = w.cards.map(x => +x.card.rt || 0).filter(Boolean);
            w.rt = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;
            // số lần quên: mỗi thẻ lấy max(lapses, wrong) (tuvung tăng cả hai khi quên), cộng qua các nguồn
            w.forgot = w.cards.reduce((s, x) => s + Math.max(+x.card.lapses || 0, +x.card.wrong || 0), 0);
            w.reps = w.cards.reduce((s, x) => s + (+x.card.reps || 0), 0);
            w.lapses = w.cards.reduce((s, x) => s + (+x.card.lapses || 0), 0);
            const lv = HSK_LV.get(w.hz);
            w.group = lv ? "hsk" + lv : (w.srcs.has("boya") || w.srcs.has("tv")) ? "boya" : w.srcs.has("wl") ? "wl" : w.srcs.has("hsk") ? "hsk_other" : "my";
        });
        return map;
    }

    // Hoạt động theo ngày: { "YYYY-MM-DD": { n, r, q, lt, rd, src:Set } }
    function collectDays(D, cards) {
        const days = {};
        const at = (k, src) => { const d = days[k] || (days[k] = { n: 0, r: 0, q: 0, lt: 0, rd: 0, src: new Set() }); if (src) d.src.add(src); return d; };
        const has = { hsk: false, boya: false, tv: false, wl: false, my: false, lt: false, dt: false, hn: false };
        Object.entries(obj(D.hsk.days)).forEach(([k, x]) => {
            if (!x || isNaN(parseDay(k))) return; has.hsk = true;
            const d = at(k, "hsk"); d.n += +x.n || 0; d.r += +x.r || 0;
            d.q += Math.max(0, (+x.t || 0) - (+x.r || 0));         // t gồm cả lượt ôn: phần còn lại là câu luyện tập
        });
        Object.entries(obj(D.boya.days)).forEach(([k, x]) => {
            if (!x || isNaN(parseDay(k))) return; has.boya = true;
            const d = at(k, "boya"); d.n += +x.n || 0; d.r += +x.r || 0; d.q += +x.q || 0; d.rd += +x.rd || 0;
        });
        Object.entries(D.tvDays).forEach(([k, x]) => {
            if (!x || isNaN(parseDay(k))) return; has.tv = true;
            const d = at(k, "tv"); d.n += +x.n || 0; d.r += +x.r || 0;
        });
        // HSK 3.0: chỉ có bộ đếm hôm nay -> từ mới theo ngày tính từ card.first; lượt ôn chỉ có hôm nay
        cards.forEach(x => {
            if (x.src === "wl" && x.card.first) { has.wl = true; at(dayKey(x.card.first), "wl").n++; }
        });
        const dl = D.wlProg.daily;
        if (dl && dl.d && !isNaN(parseDay(dl.d))) { has.wl = true; at(dl.d, "wl").r += +dl.r || 0; }
        Object.keys(D.my).forEach(k => {
            const e = D.my[k];
            if (e && e.added) { has.my = true; at(dayKey(e.added), "my").n++; }
        });
        Object.entries(obj(D.lt.days)).forEach(([k, x]) => {
            if (!x || isNaN(parseDay(k)) || !(+x.n > 0)) return; has.lt = true;
            at(k, "lt").lt += +x.n || 0;
        });
        Object.values(obj(D.dt.read)).forEach(r => {
            if (!r) return;
            const list = Array.isArray(r.cpm) ? r.cpm : [];
            list.forEach(c => { if (c && c.at) { has.dt = true; at(dayKey(c.at), "dt").rd++; } });
            if (r.done && r.at && !list.length) { has.dt = true; at(dayKey(r.at), "dt").rd++; }
        });
        // Trang Hôm nay: chỉ để đánh dấu ngày có học (lượt ôn đã nằm trong bộ đếm các trang nguồn)
        Object.entries(obj(D.hn.days)).forEach(([k, x]) => {
            if (!x || isNaN(parseDay(k))) return;
            if ((+x.r || 0) > 0 || x.ok) { has.hn = true; at(k, "hn"); }
        });
        Object.values(days).forEach(d => { d.total = d.n + d.r + d.q + d.lt + d.rd; });
        return { days, has };
    }
    const activeDay = d => d && (d.total > 0 || d.src.has("hn"));

    function streakOf(days) {
        const today = startOfDay();
        let t = activeDay(days[dayKey(today)]) ? today : addDays(today, -1);
        let cur = 0;
        while (activeDay(days[dayKey(t)])) { cur++; t = addDays(t, -1); }
        // kỷ lục
        const keys = Object.keys(days).filter(k => activeDay(days[k])).sort();
        let best = 0, run = 0, prev = NaN;
        keys.forEach(k => { const t2 = parseDay(k); run = (!isNaN(prev) && dayKey(addDays(prev, 1)) === k) ? run + 1 : 1; best = Math.max(best, run); prev = t2; });
        return { cur, best: Math.max(best, cur), activeDays: keys.length };
    }

    // Dự báo: số chữ đến hạn mỗi ngày trong n ngày (ngày 0 gồm cả quá hạn), gộp trùng theo chữ trong cùng ngày
    function forecast(cards, n) {
        const sod = startOfDay();
        const bounds = [];
        for (let i = 0; i <= n; i++) bounds.push(addDays(sod, i));
        const sets = Array.from({ length: n }, () => new Set());
        cards.forEach(x => {
            const due = +x.card.due;
            if (!due || isNaN(due)) return;
            let i;
            if (due < bounds[1]) i = 0;
            else { i = -1; for (let j = 1; j < n; j++) if (due < bounds[j + 1]) { i = j; break; } }
            if (i >= 0) sets[i].add(x.hz);
        });
        return sets.map((s, i) => ({ t: bounds[i], n: s.size }));
    }

    // ====================================================================== Vẽ biểu đồ (SVG tự viết)
    const NS = "http://www.w3.org/2000/svg";
    function niceMax(v) {
        if (v <= 5) return 5;
        const p = Math.pow(10, Math.floor(Math.log10(v)));
        const m = v / p;
        return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
    }
    function widthOf(el) { return Math.max(260, Math.floor(el.clientWidth || el.parentNode.clientWidth || 600)); }

    // Biểu đồ cột: items [{ label, v, tip, cls, sub }]
    function barChart(el, items, o) {
        o = o || {};
        const W = widthOf(el), H = o.h || 180;
        const pad = { l: 34, r: 8, t: 18, b: o.compact ? 20 : 34 };
        const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
        const max = niceMax(Math.max(1, o.ref || 0, ...items.map(x => x.v)));
        const step = iw / items.length;
        const bw = Math.max(3, Math.min(o.compact ? 14 : 42, step - (o.compact ? 2 : 8)));
        let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || "")}">`;
        for (let g = 0; g <= 4; g++) {
            const y = pad.t + ih - ih * g / 4;
            s += `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/>`;
            if (g % 2 === 0) s += `<text class="ax" x="${pad.l - 6}" y="${y + 4}" text-anchor="end">${fmt(max * g / 4)}</text>`;
        }
        if (o.ref && o.ref <= max) {
            const y = pad.t + ih - ih * o.ref / max;
            s += `<line class="ref" x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/><text class="ax ref-t" x="${W - pad.r}" y="${y - 4}" text-anchor="end">${o.refLabel || ""}</text>`;
        }
        const every = Math.ceil(items.length / Math.max(1, Math.floor(iw / (o.compact ? 34 : 44))));
        items.forEach((x, i) => {
            const cx = pad.l + step * i + step / 2;
            const h = x.v > 0 ? Math.max(2, ih * x.v / max) : 0;
            const y = pad.t + ih - h, r = Math.min(4, bw / 2, h);
            if (h > 0) {
                // cột bo góc trên 4px, chân phẳng trên trục
                s += `<path class="bar ${x.cls || ""}" d="M${cx - bw / 2},${pad.t + ih} V${y + r} Q${cx - bw / 2},${y} ${cx - bw / 2 + r},${y} H${cx + bw / 2 - r} Q${cx + bw / 2},${y} ${cx + bw / 2},${y + r} V${pad.t + ih} Z"/>`;
            }
            if (o.values && x.v > 0) s += `<text class="val" x="${cx}" y="${y - 5}" text-anchor="middle">${fmt(x.v)}</text>`;
            if ((i % every === 0 && (o.compact || items.length - 1 - i >= every)) || (i === items.length - 1 && !o.compact)) {
                s += `<text class="ax${x.strong ? " strong" : ""}" x="${cx}" y="${H - (o.compact ? 5 : 19)}" text-anchor="middle">${esc(x.label)}</text>`;
                if (x.sub && !o.compact) s += `<text class="ax" x="${cx}" y="${H - 5}" text-anchor="middle">${esc(x.sub)}</text>`;
            }
            s += `<rect class="hit" x="${pad.l + step * i}" y="${pad.t}" width="${step}" height="${ih}" data-tip="${esc(x.tip)}"/>`;
        });
        s += `<line class="axis" x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ih}" y2="${pad.t + ih}"/></svg>`;
        el.innerHTML = s;
    }

    // Biểu đồ đường: items [{ label, v, tip }]
    function lineChart(el, items, o) {
        o = o || {};
        const W = widthOf(el), H = o.h || 170;
        const pad = { l: 34, r: 12, t: 18, b: 34 };
        const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
        const max = niceMax(Math.max(1, ...items.map(x => x.v)));
        const step = iw / items.length;
        const X = i => pad.l + step * i + step / 2, Y = v => pad.t + ih - ih * v / max;
        let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || "")}">`;
        for (let g = 0; g <= 4; g++) {
            const y = pad.t + ih - ih * g / 4;
            s += `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/>`;
            if (g % 2 === 0) s += `<text class="ax" x="${pad.l - 6}" y="${y + 4}" text-anchor="end">${fmt(max * g / 4)}</text>`;
        }
        const pts = items.map((x, i) => X(i) + "," + Y(x.v));
        s += `<polygon class="area" points="${X(0)},${pad.t + ih} ${pts.join(" ")} ${X(items.length - 1)},${pad.t + ih}"/>`;
        s += `<polyline class="line" points="${pts.join(" ")}"/>`;
        const every = Math.ceil(items.length / Math.max(1, Math.floor(iw / 44)));
        items.forEach((x, i) => {
            if (x.v > 0) s += `<circle class="dot" cx="${X(i)}" cy="${Y(x.v)}" r="4"/>`;
            if ((i % every === 0 && items.length - 1 - i >= every) || i === items.length - 1) {
                s += `<text class="ax${x.strong ? " strong" : ""}" x="${X(i)}" y="${H - 19}" text-anchor="middle">${esc(x.label)}</text>`;
                if (x.sub) s += `<text class="ax" x="${X(i)}" y="${H - 5}" text-anchor="middle">${esc(x.sub)}</text>`;
            }
            s += `<rect class="hit" x="${pad.l + step * i}" y="${pad.t}" width="${step}" height="${ih}" data-tip="${esc(x.tip)}"/>`;
        });
        s += `<line class="axis" x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ih}" y2="${pad.t + ih}"/></svg>`;
        el.innerHTML = s;
    }

    // Biểu đồ điểm theo thời gian + đường xu hướng (hồi quy tuyến tính)
    function trendChart(el, pts) {
        const W = widthOf(el), H = 190;
        const pad = { l: 38, r: 12, t: 16, b: 26 };
        const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
        const t0 = Math.min(...pts.map(p => p.t)), t1 = Math.max(...pts.map(p => p.t));
        const span = Math.max(DAY, t1 - t0);
        const max = niceMax(Math.max(...pts.map(p => p.v)) * 1.05);
        const X = t => pad.l + iw * (t - t0) / span, Y = v => pad.t + ih - ih * v / max;
        let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tốc độ đọc theo thời gian">`;
        for (let g = 0; g <= 4; g++) {
            const y = pad.t + ih - ih * g / 4;
            s += `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/>`;
            if (g % 2 === 0) s += `<text class="ax" x="${pad.l - 6}" y="${y + 4}" text-anchor="end">${fmt(max * g / 4)}</text>`;
        }
        s += `<text class="ax" x="${pad.l}" y="${H - 6}" text-anchor="start">${ddmm(t0)}</text><text class="ax" x="${W - pad.r}" y="${H - 6}" text-anchor="end">${ddmm(t1)}</text>`;
        const tr = trend(pts);
        if (tr) s += `<line class="trend" x1="${X(t0)}" y1="${Y(Math.max(0, tr.a + tr.b * t0))}" x2="${X(t1)}" y2="${Y(Math.max(0, tr.a + tr.b * t1))}"/>`;
        pts.forEach(p => {
            s += `<circle class="pt ${p.src}" cx="${X(p.t)}" cy="${Y(p.v)}" r="4.5"/>`;
            s += `<circle class="hit" cx="${X(p.t)}" cy="${Y(p.v)}" r="12" data-tip="${esc(p.tip)}"/>`;
        });
        s += `<line class="axis" x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ih}" y2="${pad.t + ih}"/></svg>`;
        el.innerHTML = s;
    }
    function trend(pts) {
        if (pts.length < 3) return null;
        const n = pts.length;
        const mt = pts.reduce((s, p) => s + p.t, 0) / n, mv = pts.reduce((s, p) => s + p.v, 0) / n;
        let sxy = 0, sxx = 0;
        pts.forEach(p => { sxy += (p.t - mt) * (p.v - mv); sxx += (p.t - mt) * (p.t - mt); });
        if (!sxx) return null;
        const b = sxy / sxx;
        return { a: mv - b * mt, b };
    }

    // ====================================================================== Các mục
    let M = null;   // số liệu đã tính (cho test và vẽ lại khi đổi cỡ)

    function compute() {
        const D = loadAll();
        const cards = collectCards(D);
        const words = groupWords(cards);
        const { days, has } = collectDays(D, cards);
        const fc30 = forecast(cards, 30);
        let mastered = 0;
        words.forEach(w => { if (w.iv >= MASTER_IV) mastered++; });
        const bySrc = {};
        cards.forEach(x => { bySrc[x.src] = (bySrc[x.src] || 0) + 1; });
        M = { D, cards, words, days, has, fc30, fc7: fc30.slice(0, 7), mastered, learned: words.size, bySrc, streak: streakOf(days) };
        M.weeks = weekly(days);
        M.levels = levels(words);
        M.cpm = readingPoints(D);
        M.hard = Array.from(words.values()).filter(w => w.forgot > 0).sort((a, b) => (b.forgot - a.forgot) || (a.iv - b.iv)).slice(0, 15);
        return M;
    }

    function weekly(days) {
        const ws = weekStart(Date.now());
        const weeks = [];
        for (let i = 11; i >= 0; i--) weeks.push({ t: addDays(ws, -7 * i), n: 0, r: 0 });
        const first = weeks[0].t;
        Object.keys(days).forEach(k => {
            const t = parseDay(k);
            if (t < first) return;
            const w = weeks[Math.min(11, Math.floor(Math.round((weekStart(t) - first) / DAY) / 7))];
            if (w) { w.n += days[k].n; w.r += days[k].r; }
        });
        return weeks;
    }

    const GROUPS = [
        { key: "hsk1", name: "HSK 1", color: "var(--ui-hsk-1)", total: HSK_TOTAL[1] },
        { key: "hsk2", name: "HSK 2", color: "var(--ui-hsk-2)", total: HSK_TOTAL[2] },
        { key: "hsk3", name: "HSK 3", color: "var(--ui-hsk-3)", total: HSK_TOTAL[3] },
        { key: "hsk4", name: "HSK 4", color: "var(--ui-hsk-4)", total: HSK_TOTAL[4] },
        { key: "hsk5", name: "HSK 5", color: "var(--ui-hsk-5)", total: HSK_TOTAL[5] },
        { key: "hsk6", name: "HSK 6", color: "var(--ui-hsk-6)", total: HSK_TOTAL[6] },
        { key: "boya", name: "Boya (ngoài HSK)", color: "var(--ui-book-tc1)" },
        { key: "wl", name: "HSK 3.0 (ngoài HSK 1–6)", color: "var(--ui-book-tc3)" },
        { key: "hsk_other", name: "HSK khác", color: "var(--ui-muted)" },
        { key: "my", name: "Từ của tôi", color: "var(--ui-book-tc2)" },
    ];
    function levels(words) {
        const G = {};
        GROUPS.forEach(g => { G[g.key] = { learned: 0, mastered: 0, reps: 0, lapses: 0, rtSum: 0, rtN: 0, slow: 0 }; });
        words.forEach(w => {
            const g = G[w.group]; if (!g) return;
            g.learned++;
            if (w.iv >= MASTER_IV) g.mastered++;
            g.reps += w.reps; g.lapses += w.lapses;
            if (w.rt) { g.rtSum += w.rt; g.rtN++; if (w.rt >= SLOW_MS) g.slow++; }
        });
        return GROUPS.map(g => {
            const x = G[g.key];
            return Object.assign({}, g, x, {
                retention: (x.reps + x.lapses) > 0 ? 1 - x.lapses / (x.reps + x.lapses) : null,
                rt: x.rtN ? x.rtSum / x.rtN : 0,
            });
        });
    }

    function readingPoints(D) {
        const pts = [];
        Object.entries(obj(D.dt.read)).forEach(([id, r]) => {
            (r && Array.isArray(r.cpm) ? r.cpm : []).forEach(c => {
                if (c && c.at && c.v > 0) pts.push({ t: +c.at, v: +c.v, src: "dt", tip: `${ddmm(c.at)} · ${fmt(c.v)} chữ/phút · Đọc thêm` });
            });
        });
        Object.entries(obj(D.boya.reading)).forEach(([key, list]) => {
            (Array.isArray(list) ? list : []).forEach(h => {
                const t = parseDay(h && h.d);
                if (!isNaN(t) && h.cpm > 0) pts.push({ t: t + 12 * 3600000, v: +h.cpm, src: "boya", tip: `${ddmm(t)} · ${fmt(h.cpm)} chữ/phút · Bài khóa Boya` });
            });
        });
        return pts.sort((a, b) => a.t - b.t);
    }

    // ---------------------------------------------------------------------- Render
    function renderOverview() {
        const st = M.streak;
        const due = M.fc30[0] ? M.fc30[0].n : 0;
        const tiles = [
            { v: M.learned, l: "Từ đã học", s: "gộp trùng theo chữ Hán" },
            { v: M.mastered, l: "Đã thuộc", s: M.learned ? pct(M.mastered / M.learned) + " · ôn cách ≥ 21 ngày" : "ôn cách ≥ 21 ngày", c: "ok" },
            { v: M.learned - M.mastered, l: "Đang học", s: "chưa tới mốc 21 ngày" },
            { v: st.cur, l: "Ngày liên tiếp", s: "kỷ lục " + fmt(st.best) + " · " + fmt(st.activeDays) + " ngày có học", c: st.cur ? "warn" : "" },
            { v: due, l: "Đến hạn hôm nay", s: due ? "gồm cả từ quá hạn" : "không còn từ nào", c: due > OVERLOAD ? "bad" : "pri", href: due ? "../hom_nay/hom_nay.html" : "" },
        ];
        $("ov-tiles").innerHTML = tiles.map(t => {
            const inner = `<b>${fmt(t.v)}</b><span class="t-l">${t.l}</span><span class="t-s">${t.s}</span>`;
            return t.href ? `<a class="tile ${t.c || ""}" href="${t.href}">${inner}</a>` : `<div class="tile ${t.c || ""}">${inner}</div>`;
        }).join("");
        const chips = Object.keys(SRC).filter(k => M.bySrc[k]).map(k => `<span class="src-chip">${SRC[k].name}<b>${fmt(M.bySrc[k])}</b></span>`);
        $("ov-src").innerHTML = chips.length ? `<span class="muted small">Thẻ theo trang:</span> ` + chips.join("") : "";
        const dup = M.cards.length - M.learned;
        $("ov-note").textContent = dup > 0 ? fmt(M.cards.length) + " thẻ · " + fmt(dup) + " thẻ trùng chữ" : "";
    }

    function renderForecast() {
        const el7 = $("fc-7"), el30 = $("fc-30");
        const total7 = M.fc7.reduce((s, x) => s + x.n, 0);
        if (!M.cards.length) {
            el7.innerHTML = empty("📅", "Chưa có thẻ ôn tập nào. Học từ mới ở bất kỳ trang nào, lịch ôn sẽ hiện ở đây.");
            el30.innerHTML = ""; $("fc-alert").innerHTML = ""; return;
        }
        const over = M.fc30.filter(x => x.n > OVERLOAD);
        $("fc-alert").innerHTML = over.length
            ? `<div class="alert"><span>⚠️</span><div><b>Có ${over.length} ngày quá tải (> ${OVERLOAD} từ)</b>: ${over.slice(0, 6).map(x => (x.t === M.fc30[0].t ? "hôm nay" : WD[new Date(x.t).getDay()] + " " + ddmm(x.t)) + " (" + fmt(x.n) + ")").join(", ")}${over.length > 6 ? "…" : ""}. Nên ôn bớt trước hoặc giảm số từ mới mỗi ngày.</div></div>`
            : `<p class="ok-note">✓ 7 ngày tới có ${fmt(total7)} lượt từ cần ôn, không ngày nào quá ${OVERLOAD} từ.</p>`;
        const mk = (x, i, compact) => ({
            label: i === 0 ? (compact ? "Nay" : "Hôm nay") : compact ? ddmm(x.t) : WD[new Date(x.t).getDay()],
            sub: i === 0 ? "" : ddmm(x.t), v: x.n, strong: i === 0,
            cls: x.n > OVERLOAD ? "over" : "", tip: (i === 0 ? "Hôm nay (gồm quá hạn)" : WD[new Date(x.t).getDay()] + " " + ddmm(x.t)) + ": " + fmt(x.n) + " từ" + (x.n > OVERLOAD ? " ⚠️ quá tải" : ""),
        });
        barChart(el7, M.fc7.map((x, i) => mk(x, i, false)), { values: true, ref: OVERLOAD, refLabel: "quá tải " + OVERLOAD, h: 200, aria: "Số từ đến hạn 7 ngày tới" });
        barChart(el30, M.fc30.map((x, i) => mk(x, i, true)), { compact: true, ref: OVERLOAD, refLabel: OVERLOAD + "", h: 130, aria: "Số từ đến hạn 30 ngày tới" });
    }

    function renderWeekly() {
        const W = M.weeks;
        const any = W.some(w => w.n || w.r);
        const lbl = (w, i) => ({ label: i === W.length - 1 ? "Tuần này" : ddmm(w.t), strong: i === W.length - 1 });
        if (!any) {
            $("wk-new").innerHTML = empty("📈", "12 tuần qua chưa có hoạt động học từ nào.");
            $("wk-rev").innerHTML = "";
        } else {
            barChart($("wk-new"), W.map((w, i) => Object.assign(lbl(w, i), { v: w.n, tip: "Tuần từ " + ddmm(w.t) + ": " + fmt(w.n) + " từ mới" })), { values: true, h: 170, aria: "Số từ mới mỗi tuần" });
            lineChart($("wk-rev"), W.map((w, i) => Object.assign(lbl(w, i), { v: w.r, tip: "Tuần từ " + ddmm(w.t) + ": " + fmt(w.r) + " lượt ôn" })), { h: 160, aria: "Số lượt ôn mỗi tuần" });
        }
        const h = M.has, src = [];
        if (h.hsk) src.push("Lộ trình HSK");
        if (h.boya) src.push("Boya Learning");
        if (h.tv) src.push("Từ vựng Boya TC (chỉ giữ 60 ngày)");
        if (h.wl) src.push("HSK 3.0 (từ mới theo ngày thêm thẻ; lượt ôn chỉ có hôm nay)");
        if (h.my) src.push("Từ của tôi (ngày thêm)");
        $("wk-note").textContent = src.length
            ? "Nguồn có dữ liệu: " + src.join(" · ") + ". Lượt ôn ở trang Hôm nay đã nằm trong số của từng trang."
            : "";
    }

    function renderLevels() {
        const rows = M.levels.filter(g => g.learned > 0 || g.total);
        if (!M.learned) { $("lv-list").innerHTML = empty("🎯", "Chưa học từ nào, bảng tỉ lệ nhớ sẽ hiện khi bạn bắt đầu."); return; }
        $("lv-list").innerHTML = rows.map(g => {
            const ret = g.retention == null ? "—" : pct(g.retention);
            const retCls = g.retention == null ? "" : g.retention >= 0.85 ? "good" : g.retention >= 0.7 ? "mid" : "low";
            const base = g.total || g.learned || 1;
            const wL = Math.min(100, g.learned / base * 100), wM = Math.min(100, g.mastered / base * 100);
            const tip = `${g.name}: đã học ${fmt(g.learned)}${g.total ? "/" + fmt(g.total) : ""}, đã thuộc ${fmt(g.mastered)}`;
            return `<div class="lv${g.learned ? "" : " dim"}" style="--c:${g.color}">
                <div class="lv-top"><span class="lv-name"><i class="sw"></i>${esc(g.name)}</span>
                    <span class="lv-count"><b>${fmt(g.learned)}</b>${g.total ? `<span class="muted">/${fmt(g.total)}</span>` : " từ"}</span></div>
                <div class="lv-bar" data-tip="${esc(tip)}"><i class="l" style="width:${wL}%"></i><i class="m" style="width:${wM}%"></i></div>
                <div class="lv-stats">
                    <span>Đã thuộc <b>${g.learned ? pct(g.mastered / g.learned) : "—"}</b></span>
                    <span>Tỉ lệ nhớ <b class="ret ${retCls}">${ret}</b></span>
                    ${g.lapses ? `<span class="muted">${fmt(g.lapses)} lần quên</span>` : ""}
                </div></div>`;
        }).join("") + `<div class="lv-legend small muted"><span><i class="lg l"></i>đã học</span><span><i class="lg m"></i>đã thuộc</span></div>`;
    }

    function renderHeat() {
        const WEEKS = 20;
        const ws = weekStart(Date.now()), start = addDays(ws, -7 * (WEEKS - 1));
        const today = startOfDay();
        const vals = [];
        for (let i = 0; i < WEEKS * 7; i++) { const t = addDays(start, i); const d = M.days[dayKey(t)]; vals.push({ t, d, v: d ? d.total : 0 }); }
        const nz = vals.filter(x => x.v > 0).map(x => x.v).sort((a, b) => a - b);
        const q = p => nz.length ? nz[Math.min(nz.length - 1, Math.floor(nz.length * p))] : 1;
        const cuts = [q(0.25), q(0.5), q(0.75)];
        const lvl = x => !x.v ? (activeDay(x.d) ? 1 : 0) : x.v <= cuts[0] ? 1 : x.v <= cuts[1] ? 2 : x.v <= cuts[2] ? 3 : 4;
        let months = "", grid = "";
        let lastM = -1;
        for (let w = 0; w < WEEKS; w++) {
            const t = addDays(start, w * 7), m = new Date(t).getMonth();
            months += `<span>${m !== lastM && w < WEEKS - 1 ? "Th" + (m + 1) : ""}</span>`;
            lastM = m;
        }
        vals.forEach((x, i) => {
            const fut = x.t > today;
            const dd = x.d;
            const parts = dd ? [dd.n && fmt(dd.n) + " từ mới", dd.r && fmt(dd.r) + " lượt ôn", dd.q && fmt(dd.q) + " câu hỏi", dd.lt && fmt(dd.lt) + " câu luyện tập", dd.rd && fmt(dd.rd) + " lần đọc"].filter(Boolean) : [];
            const tip = WD[new Date(x.t).getDay()] + " " + ddmm(x.t) + ": " + (parts.length ? parts.join(", ") : activeDay(dd) ? "có học ở trang Hôm nay" : "không học");
            grid += `<i class="h${fut ? "f" : lvl(x)}${x.t === today ? " today" : ""}" style="grid-row:${(i % 7) + 1};grid-column:${Math.floor(i / 7) + 1}"${fut ? "" : ` data-tip="${esc(tip)}" data-day="${esc(tip)}"`}></i>`;
        });
        $("heat").innerHTML = `<div class="heat-days"><span>T2</span><span></span><span>T4</span><span></span><span>T6</span><span></span><span>CN</span></div>
            <div class="heat-main"><div class="heat-months" style="grid-template-columns:repeat(${WEEKS},1fr)">${months}</div>
            <div class="heat-grid" style="grid-template-columns:repeat(${WEEKS},1fr)">${grid}</div></div>`;
        const act = vals.filter(x => x.t <= today && activeDay(x.d)).length;
        $("heat-note").textContent = fmt(act) + " ngày có học / " + WEEKS + " tuần";
    }

    function renderSpeed() {
        const rows = M.levels.filter(g => g.rtN > 0);
        if (!rows.length) {
            $("rt-list").innerHTML = empty("⚡", "Chưa đo được tốc độ nhận diện. Số liệu có khi ôn thẻ mặt chữ Hán hoặc luyện Đọc nhanh (Lộ trình HSK).");
        } else {
            const maxRt = Math.max(SLOW_MS * 1.5, ...rows.map(g => g.rt));
            const slowAll = rows.reduce((s, g) => s + g.slow, 0);
            $("rt-list").innerHTML = `<div class="rt-rows">` + rows.map(g => {
                const w = g.rt / maxRt * 100, slowX = SLOW_MS / maxRt * 100;
                return `<div class="rt-row" style="--c:${g.color}" data-tip="${esc(g.name + ": trung bình " + (g.rt / 1000).toFixed(1) + " giây (" + fmt(g.rtN) + " từ đo được), " + fmt(g.slow) + " từ chậm")}">
                    <span class="rt-name">${esc(g.name.replace(/ \(.*\)/, ""))}</span>
                    <span class="rt-track"><i style="width:${w}%" class="${g.rt >= SLOW_MS ? "slow" : ""}"></i><em style="left:${slowX}%"></em></span>
                    <span class="rt-v"><b>${(g.rt / 1000).toFixed(1)}s</b>${g.slow ? `<small>${fmt(g.slow)} chậm</small>` : ""}</span></div>`;
            }).join("") + `</div><p class="muted small">Vạch dọc: mốc 3 giây. <b>${fmt(slowAll)}</b> từ “chậm” (≥ 3 giây) — luyện thêm ở <a href="../hsk_lotrinh/hsk_lotrinh.html">Đọc nhanh</a>.</p>`;
        }
        const P = M.cpm;
        if (!P.length) {
            $("cpm-summary").innerHTML = empty("📖", "Chưa có lần đọc tính giờ nào. Thử “Đọc tính giờ” ở trang Đọc thêm hoặc Bài khóa Boya.", "../doc_them/doc_them.html", "Mở Đọc thêm");
            $("cpm-chart").innerHTML = "";
            return;
        }
        const k = Math.min(5, Math.ceil(P.length / 2));
        const avg = a => Math.round(a.reduce((s, p) => s + p.v, 0) / a.length);
        const a0 = avg(P.slice(0, k)), a1 = avg(P.slice(-k));
        const best = Math.max(...P.map(p => p.v));
        const tr = trend(P);
        const perMonth = tr ? Math.round(tr.b * 30 * DAY) : 0;
        const srcs = new Set(P.map(p => p.src));
        $("cpm-summary").innerHTML = `<div class="mini-stats">
            <div><b>${fmt(a1)}</b><span>${P.length > 1 ? k + " lần gần nhất" : "lần đọc"}</span></div>
            ${P.length > 1 ? `<div><b>${fmt(a0)}</b><span>${k} lần đầu</span></div>` : ""}
            <div><b>${fmt(best)}</b><span>kỷ lục</span></div>
            ${tr ? `<div><b class="${perMonth >= 0 ? "up" : "down"}">${perMonth >= 0 ? "↗ +" : "↘ "}${fmt(perMonth)}</b><span>chữ/phút mỗi tháng</span></div>` : ""}
            </div>
            ${srcs.size > 1 ? `<div class="cpm-legend small muted"><span><i class="pt-k dt"></i>Đọc thêm</span><span><i class="pt-k boya"></i>Bài khóa Boya</span><span><i class="tr-k"></i>xu hướng</span></div>` : ""}`;
        if (P.length >= 2) trendChart($("cpm-chart"), P); else $("cpm-chart").innerHTML = "";
    }

    function renderHard() {
        if (!M.hard.length) {
            $("hard-list").innerHTML = empty("🌟", M.learned ? "Chưa có từ nào bị quên. Tuyệt vời!" : "Chưa có dữ liệu. Từ bạn hay quên sẽ hiện ở đây để luyện lại.");
            return;
        }
        const max = M.hard[0].forgot;
        $("hard-list").innerHTML = `<ol class="hard">` + M.hard.map((w, i) => `<li>
            <span class="rank">${i + 1}</span>
            <span class="hz" lang="zh-CN">${esc(w.hz)}</span>
            <span class="hw"><span class="py">${esc(w.py)}</span><span class="vi">${esc(w.vi)}</span></span>
            <span class="hf" title="Số lần quên (cộng các trang)"><i style="width:${Math.max(8, w.forgot / max * 100)}%"></i><b>${fmt(w.forgot)}</b></span>
            <button class="say" type="button" data-say="${esc(w.hz)}" aria-label="Nghe ${esc(w.hz)}" title="Nghe">🔊</button>
        </li>`).join("") + `</ol>`;
    }

    function empty(ic, text, href, label) {
        return `<div class="empty"><span>${ic}</span><p>${esc(text)}</p>${href ? `<a class="btn" href="${href}">${label}</a>` : ""}</div>`;
    }

    function speak(text) {
        if (window.HocTTS && HocTTS.speak) { try { HocTTS.stop && HocTTS.stop(); HocTTS.speak(text, { rate: 0.85 }); return; } catch (e) { /* dùng cách dưới */ } }
        if (!window.speechSynthesis) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text); u.lang = "zh-CN"; u.rate = 0.85;
        speechSynthesis.speak(u);
    }

    // ---------------------------------------------------------------------- Tooltip (di chuột hoặc chạm)
    function initTip() {
        const tip = $("tip");
        let pinned = null;
        const show = (el, x, y) => {
            tip.textContent = el.getAttribute("data-tip");
            tip.hidden = false;
            const r = tip.getBoundingClientRect();
            let left = x - r.width / 2, top = y - r.height - 14;
            left = Math.max(8, Math.min(window.innerWidth - r.width - 8, left));
            if (top < 8) top = y + 18;
            tip.style.left = left + "px"; tip.style.top = top + "px";
        };
        document.addEventListener("pointermove", e => {
            if (e.pointerType !== "mouse") return;
            const el = e.target.closest && e.target.closest("[data-tip]");
            if (el && el.getAttribute("data-tip")) show(el, e.clientX, e.clientY);
            else if (!pinned) tip.hidden = true;
        });
        document.addEventListener("click", e => {
            const say = e.target.closest && e.target.closest("[data-say]");
            if (say) { speak(say.getAttribute("data-say")); return; }
            const day = e.target.closest && e.target.closest("[data-day]");
            if (day) {
                $("heat-detail").textContent = day.getAttribute("data-day");
                document.querySelectorAll(".heat-grid .sel").forEach(x => x.classList.remove("sel"));
                day.classList.add("sel");
            }
            const el = e.target.closest && e.target.closest("[data-tip]");
            if (el && el.getAttribute("data-tip") && !day) { pinned = el; show(el, e.clientX, e.clientY); }
            else { pinned = null; tip.hidden = true; }
        });
        window.addEventListener("scroll", () => { pinned = null; tip.hidden = true; }, { passive: true });
    }

    function renderCharts() { renderForecast(); renderWeekly(); renderSpeed(); }
    function render() {
        compute();
        const hasAny = M.cards.length || Object.keys(M.days).length || M.cpm.length;
        $("empty").hidden = !!hasAny;
        document.querySelectorAll("main > section:not(#empty)").forEach(sec => { sec.hidden = !hasAny; });
        renderOverview();
        renderLevels();
        renderHeat();
        renderHard();
        renderCharts();
        $("brand-sub").textContent = "Cập nhật " + new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + " · " + new Date().toLocaleDateString("vi-VN");
    }

    let lastW = 0, rz = 0;
    window.addEventListener("resize", () => {
        clearTimeout(rz);
        rz = setTimeout(() => { const w = document.querySelector(".container").clientWidth; if (w !== lastW) { lastW = w; renderCharts(); } }, 150);
    });
    // Tiến độ đổi ở tab khác -> vẽ lại
    window.addEventListener("storage", e => { if (!e.key || !/^hoc_theme$/.test(e.key)) { clearTimeout(rz); rz = setTimeout(render, 300); } });

    initTip();
    render();
    lastW = document.querySelector(".container").clientWidth;

    window.__TK = { compute, forecast, collectCards, groupWords, streakOf, get M() { return M; }, render };
})();
