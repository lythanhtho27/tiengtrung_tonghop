/* ==========================================================================
   SHARED/ACTIVE.JS — Học chủ động dùng chung (HocActive): Boya, Đọc thêm, Buổi học hôm nay
   - Cùng phương pháp với Học chủ động của hsk_lotrinh (trang đó có bản riêng, gắn với trắc nghiệm của nó):
     lọc từ đã biết → kiểm chứng → từng lượt 5 từ: đoán nghĩa rồi xem thẻ → tự nhớ lại → chốt bài.
   - HocActive.open({
       title, words: [{ id, hz, py, hv, vi, ex, exvi, cloze (câu có "～" ở chỗ từ) }],
       pool: [{ hz, vi }]            nguồn đáp án nhiễu thêm,
       known: Map(id -> {iv, src})   từ đã học ở nguồn khác (iv ≥ 7 được đánh dấu sẵn),
       later: số từ chọn học sẵn     có thì mỗi từ có thêm trạng thái "Để sau" (Đọc thêm),
       kind: "boya" | "my"           nguồn thẻ, để nhớ lại trong ngày,
       related(ch, hz) -> [{hz, py, vi}],
       onKnown(id, "fast"|"slow"), onLearned(id, đúng ngay lần đầu), onFail(id), onBatch(số câu), onFinish(res), onClose() })
     Module không ghi SRS: trang tự ghi trong các hàm on…
   - Nhớ lại trong ngày: key "hoc_active_v1" = { settings{recall, sameDay}, fresh{"boya:<id>" | "my:<hz>": {at, s, u, w}} }
     (được sync.js đồng bộ). HocActive.freshInfo() / startFresh({onClose}) — chạy ở trang Buổi học hôm nay.
   - HocActive.otherKnown() -> Map chữ Hán -> {iv, src} (đọc thẻ HSK, HSK 3.0, Từ của tôi).
   ========================================================================== */
(function () {
    "use strict";
    const KEY = "hoc_active_v1", DAY = 86400000, MIN = 60000;
    const BATCH = 5, KNOWN_IV = 7, VF_LIMIT = 8000, VF_FAST = 4000;

    // ---------------------------------------------------------------- Tiện ích
    function readJSON(k, fb) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? fb : v; } catch (e) { return fb; } }
    function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn("Không lưu được", k, e); } }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
    function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d"); }
    function han(s) { return String(s || "").replace(/[^㐀-鿿]/g, ""); }
    function cleanHz(s) { return String(s || "").replace(/[（(]([^）)]*)[）)](?=[一-鿿])/g, "$1").replace(/[（(][^）)]*[）)]/g, "").replace(/[\s*＊]+/g, ""); }
    function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function startOfDay(t) { const d = new Date(t === undefined ? Date.now() : t); d.setHours(0, 0, 0, 0); return d.getTime(); }
    function cut(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n).trim() + "…" : s; }
    function el(id) { return document.getElementById(id); }

    // ---------------------------------------------------------------- Lưu trữ
    function load() {
        const o = readJSON(KEY, {}) || {};
        const hsk = (readJSON("hsk_lotrinh_v1", {}) || {}).settings || {};      // chưa chọn ở đây thì theo cài đặt của Lộ trình HSK
        return { settings: Object.assign({ recall: hsk.recall === "self" ? "self" : "type", sameDay: hsk.sameDay !== false }, o.settings || {}), fresh: o.fresh || {} };
    }
    function settings() { return load().settings; }
    function set(k, v) { const o = load(); o.settings[k] = v; writeJSON(KEY, o); }

    // Từ đã học ở nguồn khác; Boya cần tên chữ nên trang Boya tự gộp thêm thẻ của mình
    function otherKnown() {
        const out = new Map();
        const add = (hz, iv, src) => {
            hz = cleanHz(hz);
            if (!hz || !(iv >= 1)) return;
            const o = out.get(hz);
            if (!o || iv > o.iv) out.set(hz, { iv, src });
        };
        const hs = (readJSON("hsk_lotrinh_v1", {}) || {}).srs || {};
        Object.keys(hs).forEach(id => { const i = id.indexOf("-"); id.slice(i + 1).split(/[\/／、]/).forEach(x => add(x, hs[id] && hs[id].iv, "HSK " + id.slice(0, i))); });
        const wl = readJSON("hsk_wl_srs_v3", {}) || {};
        Object.keys(wl).forEach(id => { if (wl[id]) add(wl[id].hz, wl[id].iv, "HSK 3.0"); });
        const my = (readJSON("hoc_mywords_v1", {}) || {}).words || {};
        Object.keys(my).forEach(k => { if (my[k] && my[k].card) add(my[k].hz || k, my[k].card.iv, "Từ của tôi"); });
        return out;
    }
    // Khoảng ôn cho từ đã kiểm chứng: nhớ chắc 14–30 ngày, hơi lâu 3–7 ngày (rải ngẫu nhiên)
    function knownIv(speed) { return speed === "fast" ? 14 + Math.floor(Math.random() * 17) : 3 + Math.floor(Math.random() * 5); }

    // ---------------------------------------------------------------- Giọng đọc
    function say(text) {
        text = han(text) ? String(text).replace(/～/g, "") : "";
        if (!text || !("speechSynthesis" in window)) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "zh-CN"; u.rate = 0.85;
        speechSynthesis.speak(u);
    }
    function sayWord(w) {
        if (window.HocTTS && HocTTS.speakWord) HocTTS.speakWord(w.hz, w.ex || "", { rate: 0.85 });
        else say(w.hz);
    }
    function hush() { if ("speechSynthesis" in window) speechSynthesis.cancel(); }

    // ---------------------------------------------------------------- Giao diện
    const CSS = `
html.ha-lock{overflow:hidden}
#ha-ov{position:fixed;inset:0;z-index:99900;background:var(--ui-bg,#f8fafc);color:var(--ui-text,#0f172a);font-family:var(--ui-font-sans,system-ui,sans-serif);font-size:16px;line-height:1.5;overflow-y:auto;-webkit-overflow-scrolling:touch}
#ha-ov *{box-sizing:border-box}
#ha-ov [hidden]{display:none!important}
#ha-ov button{font:inherit;cursor:pointer;color:inherit}
.ha-top{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--ui-surface,#fff);border-bottom:1px solid var(--ui-border,#e2e8f0)}
.ha-x{width:40px;height:40px;flex:none;border-radius:10px;border:1px solid var(--ui-border,#e2e8f0);background:var(--ui-surface,#fff)}
.ha-mid{flex:1;min-width:0}.ha-head{display:flex;justify-content:space-between;gap:10px;font-size:14px;font-weight:600}
.ha-head span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ha-cnt{flex:none;color:var(--ui-muted,#64748b)}
.ha-bar{height:8px;border-radius:99px;background:var(--ui-surface-3,#e2e8f0);margin-top:6px;overflow:hidden}.ha-bar i{display:block;height:100%;width:0;background:var(--ui-primary,#4f46e5);transition:width .25s}
.ha-body{max-width:720px;margin:0 auto;padding:22px 16px 60px}
.ha-tag{text-align:center;color:var(--ui-muted,#64748b);font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px}.ha-tag em{color:var(--ui-warning,#b45309);font-style:normal}
.ha-card{background:var(--ui-surface,#fff);border:1px solid var(--ui-border,#e2e8f0);border-radius:20px;padding:22px;box-shadow:var(--ui-shadow,0 2px 10px rgba(15,23,42,.06))}
.ha-c{text-align:center}.ha-muted{color:var(--ui-muted,#64748b);font-size:14px}
.ha-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:16px}
.ha-btn{border:1px solid var(--ui-border,#e2e8f0);background:var(--ui-surface,#fff);border-radius:10px;padding:9px 16px;font-weight:600!important;min-height:44px}
.ha-btn.pri{background:var(--ui-primary,#4f46e5);border-color:var(--ui-primary,#4f46e5);color:var(--ui-on-primary,#fff)!important}
.ha-btn.lg{padding:12px 22px}.ha-link{border:0;background:none;color:var(--ui-primary,#4f46e5)!important;text-decoration:underline;font-size:14px!important;padding:8px}
.ha-words{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:8px;margin-top:14px}
.ha-w{border:1px solid var(--ui-border,#e2e8f0);background:var(--ui-bg,#f8fafc);border-radius:12px;padding:9px 6px;min-height:56px;text-align:center}
.ha-w b{display:block;font-family:var(--ui-font-cn,serif);font-size:21px;font-weight:600;overflow-wrap:anywhere;line-height:1.3}
.ha-w small{display:block;font-size:11.5px;color:var(--ui-muted,#64748b);line-height:1.4}
.ha-w.known{border-color:var(--ui-success,#059669);background:var(--ui-success-soft,#d1fae5)}.ha-w.known .st{color:var(--ui-success,#059669);font-weight:600}
.ha-w.learn.sel{border-color:var(--ui-primary,#4f46e5);background:var(--ui-primary-soft,#eef2ff)}.ha-w.learn .st{color:var(--ui-primary,#4f46e5);font-weight:600}
.ha-w.later{opacity:.6}
.ha-opt-row{display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:center;margin-top:16px;font-size:14px}.ha-opt-row select{font:inherit;padding:6px 8px;border-radius:8px;border:1px solid var(--ui-border,#e2e8f0);background:var(--ui-surface,#fff);color:inherit}
.ha-hz{font-family:var(--ui-font-cn,serif);font-size:clamp(46px,11vw,72px);font-weight:700;line-height:1.2;text-align:center;overflow-wrap:anywhere}
.ha-py{color:var(--ui-pinyin,#0369a1);font-size:21px;font-weight:500;text-align:center}
.ha-hv{color:var(--ui-muted,#64748b);font-size:14px;text-align:center}.ha-vi{font-size:20px;font-weight:600;text-align:center;margin:10px 0 4px}
.ha-ex{font-family:var(--ui-font-cn,serif);font-size:20px;line-height:1.65;margin-top:12px;text-align:center}.ha-ex mark,.ha-box mark,.ha-fb mark{background:var(--ui-highlight,#fde68a);color:inherit;border-radius:4px;padding:0 2px}
.ha-box{text-align:left;background:var(--ui-bg,#f8fafc);border:1px solid var(--ui-border,#e2e8f0);border-radius:12px;padding:12px 14px;margin-top:14px}.ha-box .z{font-family:var(--ui-font-cn,serif);font-size:19px}.ha-box small{color:var(--ui-text-2,#475569);display:block;margin-top:4px}
.ha-say{border:0;border-radius:50%;width:34px;height:34px;background:var(--ui-primary-soft,#eef2ff);vertical-align:middle}
.ha-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
.ha-o{display:flex;gap:10px;align-items:center;text-align:left;border:2px solid var(--ui-border,#e2e8f0);background:var(--ui-bg,#f8fafc);border-radius:12px;padding:10px 14px;min-height:54px}
.ha-o kbd{flex:none;font-size:11px;border:1px solid var(--ui-border,#e2e8f0);border-radius:5px;padding:0 5px;color:var(--ui-muted,#64748b)}.ha-o .cn{font-family:var(--ui-font-cn,serif);font-size:22px;font-weight:600}
.ha-o.ok{border-color:var(--ui-success,#059669);background:var(--ui-success-soft,#d1fae5)}.ha-o.no{border-color:var(--ui-danger,#dc2626);background:var(--ui-danger-soft,#fee2e2)}
.ha-ver{text-align:center;font-weight:700;border-radius:12px;padding:10px 14px;margin-bottom:12px}
.ha-ver.ok,.ha-fb.ok{background:var(--ui-success-soft,#d1fae5)}.ha-ver.no,.ha-fb.no{background:var(--ui-danger-soft,#fee2e2)}.ha-ver.ok,.ha-fb.ok .t{color:var(--ui-success,#059669)}.ha-ver.no,.ha-fb.no .t{color:var(--ui-danger,#dc2626)}
.ha-hook{background:var(--ui-surface,#fff);border:1px solid var(--ui-border,#e2e8f0);border-radius:14px;padding:12px 14px;margin-top:10px}.ha-hook h4{margin:0 0 6px;font-size:14px;color:var(--ui-text-2,#475569)}
.ha-hook textarea{width:100%;border:1px solid var(--ui-border,#e2e8f0);border-radius:10px;background:var(--ui-bg,#f8fafc);color:inherit;font:inherit;font-size:16px;padding:8px 10px;resize:vertical}
.ha-rel{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px}.ha-rel>b{font-family:var(--ui-font-cn,serif);font-size:19px}
.ha-chip{border:1px solid var(--ui-border,#e2e8f0);background:var(--ui-bg,#f8fafc);border-radius:99px;padding:4px 10px;font-size:13px!important;max-width:100%;text-align:left}.ha-chip span{font-family:var(--ui-font-cn,serif);font-size:16px}
.ha-hook .hv-pline>b,.ha-hook .hv-pline .pc{font-family:var(--ui-font-cn,serif);font-size:19px}.ha-hook .hv-pline small{color:var(--ui-muted,#64748b)}
.ha-form{display:flex;gap:8px;margin-top:8px}.ha-form input{flex:1;min-width:0;font:inherit;font-size:20px;text-align:center;padding:10px 12px;border-radius:10px;border:1px solid var(--ui-border-strong,#cbd5e1);background:var(--ui-bg,#f8fafc);color:inherit}
.ha-listen{width:88px;height:88px;border-radius:50%;border:0;font-size:34px!important;background:var(--ui-primary,#4f46e5)}
.ha-fb{border-radius:14px;border:1px solid var(--ui-border,#e2e8f0);padding:14px 16px;margin-top:14px}.ha-fb .t{font-weight:700;font-size:17px}.ha-fb .ha-btn{width:100%;margin-top:8px}.ha-fb .hz{font-family:var(--ui-font-cn,serif);font-size:22px;font-weight:600}.ha-fb .ex{font-family:var(--ui-font-cn,serif);font-size:17px;margin-top:4px}.ha-fb .ex small{font-family:var(--ui-font-sans,sans-serif);color:var(--ui-text-2,#475569)}
.ha-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ha-timer{height:6px;border-radius:99px;background:var(--ui-surface-3,#e2e8f0);overflow:hidden;margin-bottom:18px}.ha-timer i{display:block;height:100%;background:var(--ui-primary,#4f46e5);transform-origin:left;animation:ha-shrink linear forwards}
@keyframes ha-shrink{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.ha-list{list-style:none;margin:14px auto 0;padding:0;max-width:460px}.ha-list li{border:1px solid var(--ui-border,#e2e8f0);border-radius:12px;padding:10px 14px;margin-bottom:8px;background:var(--ui-bg,#f8fafc)}.ha-list li.ok{border-color:var(--ui-success,#059669);background:var(--ui-success-soft,#d1fae5)}.ha-list li.no{border-color:var(--ui-danger,#dc2626);background:var(--ui-danger-soft,#fee2e2)}
.ha-list .hz{font-family:var(--ui-font-cn,serif);font-size:19px;font-weight:600}
.ha-list .py{color:var(--ui-pinyin,#0369a1)}
.ha-score{font-size:44px;font-weight:700;color:var(--ui-primary,#4f46e5)}
.ha-ra{border:1px solid var(--ui-border,#e2e8f0);border-radius:12px;padding:8px 12px;margin-top:8px}.ha-ra.ok{background:var(--ui-success-soft,#d1fae5)}.ha-ra.no{background:var(--ui-danger-soft,#fee2e2)}.ha-ra>button{width:100%;border:0;background:none;text-align:left;font-weight:600;min-height:36px}.ha-ra>div{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.ha-ra .hz{font-family:var(--ui-font-cn,serif);font-size:24px;font-weight:600}.ha-ra .bt{margin-left:auto;display:flex;gap:6px}
.ha-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ui-text,#0f172a);color:var(--ui-bg,#fff);border-radius:99px;padding:9px 18px;font-size:14px;z-index:3;max-width:90vw}
#ha-ov .hv-bar{justify-content:center}
@media (max-width:720px){.ha-opts{grid-template-columns:1fr}.ha-body{padding:16px 12px 40px}.ha-card{padding:16px}#ha-ov .ko{display:none}}`;
    function injectCSS() {
        if (el("ha-css")) return;
        const s = document.createElement("style"); s.id = "ha-css"; s.textContent = CSS;
        document.head.appendChild(s);
    }
    let A = null;     // phiên đang mở
    const B = () => el("ha-body");
    function openShell(o) {
        injectCSS();
        if (A) shut();
        A = Object.assign({ dirty: false, learned: new Set(), knownDone: new Set(), weak: new Set(), answers: 0, shownAt: 0 }, o);
        const ov = document.createElement("div");
        ov.id = "ha-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Học chủ động");
        ov.innerHTML = `<div class="ha-top"><button type="button" class="ha-x" id="ha-x" title="Thoát (Esc)" aria-label="Thoát">✕</button>
            <div class="ha-mid"><div class="ha-head"><span>${esc(A.title || "Học chủ động")}</span><span class="ha-cnt" id="ha-cnt"></span></div><div class="ha-bar"><i id="ha-p"></i></div></div></div>
            <div class="ha-body" id="ha-body"></div><div class="ha-toast" id="ha-toast" hidden></div>`;
        document.body.appendChild(ov);
        document.documentElement.classList.add("ha-lock");
        el("ha-x").onclick = () => askClose();
    }
    function shut() {
        if (!A) return;
        const a = A;
        clearTimeout(a.timer); hush();
        A = null;
        const ov = el("ha-ov"); if (ov) ov.remove();
        document.documentElement.classList.remove("ha-lock");
        if (a.onClose) a.onClose();
    }
    function askClose() {
        if (!A) return;
        if (A.dirty) {
            clearTimeout(A.timer);
            const msg = A.vf ? "Thoát khi đang kiểm chứng? Kết quả kiểm chứng của lần này sẽ không được lưu."
                : A.bi > 0 ? `Thoát? ${A.bi} lượt đã xong vẫn được lưu, phần đang làm thì không.` : "Thoát? Phần đang làm sẽ không được lưu.";
            if (!confirm(msg)) { if (A.vf) renderVerify(); else if (A.fq && A.fq.done) finalNext(); return; }
        }
        shut();
    }
    function prog(p, cnt) { el("ha-p").style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + "%"; if (cnt !== undefined) el("ha-cnt").textContent = cnt; }
    function html(h) { hush(); B().innerHTML = h; el("ha-ov").scrollTop = 0; }
    let toastTimer;
    function toast(t) { const x = el("ha-toast"); if (!x) return; x.textContent = t; x.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { x.hidden = true; }, 2400); }
    function mark(sentence, hz) { const e = esc(sentence); return hz && sentence.indexOf(hz) >= 0 ? e.split(esc(hz)).join("<mark>" + esc(hz) + "</mark>") : e; }
    // Bắt mọi lần bấm trong khung: [data-say] đọc chữ; còn lại giao cho màn hiện tại
    function onClick(fn) {
        B().onclick = e => {
            const s = e.target.closest("[data-say]"); if (s) { say(s.dataset.say); return; }
            fn(e);
        };
    }

    // ---------------------------------------------------------------- Đáp án nhiễu
    function distract(w, key) {
        const seen = new Set([w[key]]), out = [];
        const take = list => shuffle(list).forEach(x => { if (out.length < 3 && x[key] && x.hz !== w.hz && !seen.has(x[key])) { seen.add(x[key]); out.push(x); } });
        const n = han(w.hz).length, all = A.words.concat(A.pool || []);
        take(all.filter(x => han(x.hz).length === n));
        if (out.length < 3) take(all);
        return out;
    }

    // ================================================================ 1. Lọc nhanh
    function open(opts) {
        const words = (opts.words || []).filter(w => w && w.hz && w.vi);
        if (!words.length) return false;
        openShell(Object.assign({}, opts, { words }));
        const known = A.known || new Map();
        A.st = {};         // id -> "learn" | "known" | "later"
        let n = 0;
        words.forEach(w => {
            const k = known.get(w.id);
            if (k && k.iv >= KNOWN_IV) A.st[w.id] = "known";
            else A.st[w.id] = A.later && n >= A.later ? "later" : (n++, "learn");
        });
        renderFilter();
        return true;
    }
    function pick(st) { return A.words.filter(w => A.st[w.id] === st); }
    function renderFilter() {
        const known = A.known || new Map(), st = settings();
        prog(0, "Lọc từ");
        const tag = w => {
            const s = A.st[w.id], k = known.get(w.id);
            return (k ? `<small>${k.iv >= KNOWN_IV ? "đã nhớ" : "đang học"} · ${esc(k.src)}</small>` : "") +
                (s === "known" ? '<small class="st">✓ Đã biết</small>' : A.later ? `<small class="st">${s === "learn" ? "Học" : "Để sau"}</small>` : "");
        };
        html(`<div class="ha-tag">Học chủ động · Lọc nhanh</div><div class="ha-card">
            <p class="ha-c" style="margin:0"><b>${A.later ? "Chọn từ muốn học trước khi đọc" : "Từ nào bạn đã biết chắc?"}</b><br><span class="ha-muted">${A.later
                ? "Chạm vào từ để đổi: Học → Đã biết → Để sau. Từ “Đã biết” được kiểm chứng nhanh."
                : "Chạm để đánh dấu hoặc bỏ đánh dấu. Các từ đó được kiểm chứng nhanh rồi hẹn ôn xa."}</span></p>
            <div class="ha-words">${A.words.map(w => `<button type="button" class="ha-w ${A.st[w.id]}${A.later ? " sel" : ""}" data-w="${esc(w.id)}"><b>${esc(w.hz)}</b>${tag(w)}</button>`).join("")}</div>
            <div class="ha-row"><button type="button" class="ha-btn pri lg" data-go="start" id="ha-go"></button></div>
            <div class="ha-opt-row"><label>Bước tự nhớ lại <select id="ha-recall"><option value="type">Gõ chữ Hán / pinyin</option><option value="self">Không gõ, tự chấm</option></select></label>
            ${A.kind ? `<label><input type="checkbox" id="ha-same" ${st.sameDay ? "checked" : ""}> Nhớ lại trong ngày</label>` : ""}</div></div>`);
        el("ha-recall").value = st.recall;
        el("ha-recall").onchange = e => set("recall", e.target.value);
        if (el("ha-same")) el("ha-same").onchange = e => set("sameDay", e.target.checked);
        const label = () => {
            const k = pick("known").length, l = pick("learn").length;
            el("ha-go").textContent = k ? `Kiểm chứng ${k} từ${l ? `, rồi học ${l} từ` : ""} →` : `Học ${l} từ →`;
            el("ha-go").disabled = !k && !l;
        };
        label();
        onClick(e => {
            const b = e.target.closest("[data-w]");
            if (b) {
                const id = b.dataset.w, o = A.later ? ["learn", "known", "later"] : ["learn", "known"];
                A.st[id] = o[(o.indexOf(A.st[id]) + 1) % o.length];
                b.className = "ha-w " + A.st[id] + (A.later ? " sel" : "");
                b.innerHTML = `<b>${esc(A.words.find(w => w.id === id).hz)}</b>` + tag(A.words.find(w => w.id === id));
                label(); return;
            }
            if (e.target.closest('[data-go="start"]')) { A.dirty = true; pick("known").length ? startVerify() : startBatches(); }
        });
    }

    // ================================================================ 2. Kiểm chứng từ "đã biết"
    function startVerify() { A.vf = { i: 0, res: new Map(), words: shuffle(pick("known")) }; renderVerify(); }
    function renderVerify() {
        const v = A.vf, a = A;
        clearTimeout(a.timer);
        v.i = v.res.size;
        if (v.i >= v.words.length) { verifyDone(); return; }
        const w = v.words[v.i];
        v.opts = shuffle([w].concat(distract(w, "vi"))); v.open = true;
        prog(v.i / v.words.length, `${v.i + 1}/${v.words.length}`);
        html(`<div class="ha-tag">Kiểm chứng từ đã biết</div><div class="ha-card"><div class="ha-timer"><i style="animation-duration:${VF_LIMIT}ms"></i></div>
            <div class="ha-hz">${esc(w.hz)}</div><div class="ha-hv" id="ha-vp">Nghĩa của từ này là gì?</div>
            <div class="ha-opts">${v.opts.map((o, i) => `<button type="button" class="ha-o" data-v="${i}"><kbd class="ko">${i + 1}</kbd><span>${esc(cut(o.vi, 70))}</span></button>`).join("")}</div>
            <div class="ha-row"><button type="button" class="ha-btn" data-v="-2">🤔 Không chắc</button></div></div>`);
        onClick(e => { const b = e.target.closest("[data-v]"); if (b) answerVerify(+b.dataset.v); });
        v.t0 = performance.now();
        a.timer = setTimeout(() => { if (A === a) answerVerify(-1); }, VF_LIMIT);
    }
    function answerVerify(k) {
        const a = A, v = a.vf; if (!v || !v.open) return;
        v.open = false; clearTimeout(a.timer);
        const w = v.words[v.i], ms = performance.now() - v.t0, ok = k >= 0 && v.opts[k] === w;
        v.res.set(w.id, ok ? (ms <= VF_FAST ? "fast" : "slow") : "bad");
        B().querySelectorAll(".ha-o").forEach((b, i) => { b.disabled = true; if (v.opts[i] === w) b.classList.add("ok"); else if (i === k) b.classList.add("no"); });
        B().querySelector(".ha-timer").style.visibility = "hidden";
        el("ha-vp").textContent = w.py + (k === -1 ? " · hết giờ" : ok && ms > VF_FAST ? " · đúng nhưng hơi lâu" : "");
        if (!ok) say(w.hz);
        a.answers++;
        a.timer = setTimeout(() => { if (A === a && a.vf === v) renderVerify(); }, ok ? 450 : 1500);
    }
    function verifyDone() {
        const n = { fast: 0, slow: 0, bad: 0 };
        A.vf.res.forEach((r, id) => {
            n[r]++;
            if (r === "bad") A.st[id] = "learn";
            else { A.knownDone.add(id); if (r === "slow") A.weak.add(id); if (A.onKnown) A.onKnown(id, r); }
        });
        A.vf = null;
        flush();
        const l = pick("learn").length;
        A.shownAt = Date.now();
        html(`<div class="ha-tag">Kiểm chứng xong</div><div class="ha-card"><ul class="ha-list">
            ${n.fast ? `<li class="ok">✓ <b>${n.fast}</b> từ nhớ chắc, hẹn ôn sau 14–30 ngày</li>` : ""}
            ${n.slow ? `<li>⏱ <b>${n.slow}</b> từ nhớ nhưng hơi lâu, hẹn ôn sau 3–7 ngày</li>` : ""}
            ${n.bad ? `<li class="no">↩ <b>${n.bad}</b> từ chưa chắc, chuyển sang học mới</li>` : ""}</ul>
            <div class="ha-row"><button type="button" class="ha-btn pri lg" data-go="next">${l ? `Học ${l} từ →` : "Xong ✓"}</button></div></div>`);
        onClick(e => { if (e.target.closest('[data-go="next"]')) startBatches(); });
    }
    // Báo cho trang số câu đã trả lời kể từ lần trước (để trang đếm hoạt động / lưu)
    function flush() { if (A.onBatch) A.onBatch(A.answers); A.answers = 0; }

    // ================================================================ 3. Từng lượt: đoán nghĩa → xem thẻ → tự nhớ lại
    function startBatches() {
        const learn = pick("learn");
        A.bs = [];
        for (let i = 0; i < learn.length; i += BATCH) A.bs.push(learn.slice(i, i + BATCH));
        if (A.bs.length > 1 && A.bs[A.bs.length - 1].length < 3) { const last = A.bs.pop(); A.bs[A.bs.length - 1] = A.bs[A.bs.length - 1].concat(last); }
        A.total = learn.length * 2; A.did = 0; A.bi = 0; A.gi = 0;
        learn.length ? renderGuess() : finish(null);
    }
    function bLabel() { return `Lượt ${A.bi + 1}/${A.bs.length}`; }
    function bProg(x) { prog((A.did + (x || 0)) / A.total * 0.8, bLabel()); }
    function renderGuess() {
        const b = A.bs[A.bi], w = b[A.gi];
        bProg();
        A.opts = shuffle([w].concat(distract(w, "vi"))); A.guess = w;
        html(`<div class="ha-tag">${bLabel()} · Đoán nghĩa ${A.gi + 1}/${b.length}</div><div class="ha-card">
            <div class="ha-c ha-muted">Đoán nghĩa trước khi xem đáp án</div>
            <div class="ha-hz">${esc(w.hz)}</div>
            ${w.hv && norm(w.vi).indexOf(norm(w.hv)) < 0 ? `<div class="ha-hv">Hán Việt: <b>${esc(w.hv)}</b></div>` : ""}
            ${w.ex ? `<div class="ha-ex">${mark(w.ex, w.hz)}</div>` : ""}
            <div class="ha-opts">${A.opts.map((o, i) => `<button type="button" class="ha-o" data-g="${i}"><kbd class="ko">${i + 1}</kbd><span>${esc(cut(o.vi, 70))}</span></button>`).join("")}</div>
            <div class="ha-row"><button type="button" class="ha-btn" data-g="-1">Không đoán được</button></div></div>`);
        onClick(e => { const g = e.target.closest("[data-g]"); if (g) revealGuess(+g.dataset.g); });
    }
    function cardHTML(w) {
        return `<div class="ha-card"><div class="ha-hz">${esc(w.hz)}</div>
            <div class="ha-py">${esc(w.py)} <button type="button" class="ha-say" data-say="${esc(w.hz)}" title="Nghe">🔊</button></div>
            ${w.hv ? `<div class="ha-hv">Hán Việt: ${esc(w.hv)}</div>` : ""}<div class="ha-vi">${esc(w.vi)}</div>
            ${window.HocVisual ? HocVisual.barHTML(w.hz) + HocVisual.readingHTML(w.hz, w.py, w.hv) : ""}
            ${w.ex ? `<div class="ha-box"><span class="z">${mark(w.ex, w.hz)}</span> <button type="button" class="ha-say" data-say="${esc(w.ex)}" title="Nghe câu">🔊</button>${w.exvi ? `<small>${esc(w.exvi)}</small>` : ""}</div>` : ""}</div>`;
    }
    function hooksHTML(w) {
        const rows = [...new Set(Array.from(han(w.hz)))].map(ch => {
            const r = (A.related ? A.related(ch, w.hz) : []).slice(0, 4);
            return r.length ? `<div class="ha-rel"><b>${esc(ch)}</b> ${r.map(x => `<button type="button" class="ha-chip" data-say="${esc(x.hz)}" title="${esc(x.py)}"><span>${esc(x.hz)}</span> ${esc(cut(x.vi, 32))}</button>`).join("")}</div>` : "";
        }).join("");
        return `<div class="ha-hook" id="ha-parts" hidden></div>
            ${rows ? `<div class="ha-hook"><h4>🔗 Từ đã học có cùng chữ</h4>${rows}</div>` : ""}
            ${window.HocNotes ? `<div class="ha-hook"><h4>📝 Cách nhớ của bạn</h4><textarea id="ha-note" rows="2" maxlength="500" placeholder="Một hình ảnh, câu chuyện, hay từ tiếng Việt nghe giống… (không bắt buộc)">${esc(HocNotes.get(w.hz))}</textarea></div>` : ""}`;
    }
    function revealGuess(i) {
        const w = A.guess; if (!w) return;
        const ok = i >= 0 && A.opts[i] === w, b = A.bs[A.bi], last = A.gi === b.length - 1;
        A.guess = null; A.shownAt = Date.now(); A.did++;
        if (!ok) A.weak.add(w.id);
        bProg();
        html(`<div class="ha-tag">${bLabel()} · Từ ${A.gi + 1}/${b.length}</div>
            <div class="ha-ver ${ok ? "ok" : "no"}">${ok ? "✓ Đoán đúng!" : i < 0 ? "Xem thẻ và tìm một cách nhớ nhé" : "✗ Bạn đoán: " + esc(cut(A.opts[i].vi, 70))}</div>
            ${cardHTML(w)}${hooksHTML(w)}
            <div class="ha-row"><button type="button" class="ha-btn pri lg" data-go="next">${last ? "Tự nhớ lại →" : "Từ tiếp theo →"}</button></div>`);
        const box = el("ha-parts"), note = el("ha-note");
        if (window.HocVisual && HocVisual.loadParts) HocVisual.loadParts().then(() => {
            const h = box.isConnected ? HocVisual.partsHTML(w.hz) : "";
            if (h) { box.innerHTML = "<h4>🧩 Bộ phận chữ</h4>" + h; box.hidden = false; }
        }).catch(() => {});
        const saveNote = () => { if (note && HocNotes.get(w.hz) !== note.value.trim()) HocNotes.set(w.hz, note.value); };
        if (note) note.onchange = saveNote;
        sayWord(w);
        onClick(e => {
            if (!e.target.closest('[data-go="next"]')) return;
            saveNote();
            if (last) startRecall(); else { A.gi++; renderGuess(); }
        });
    }
    function startRecall() {
        const b = A.bs[A.bi], old = [].concat(...A.bs.slice(0, A.bi));
        const mix = shuffle(old).sort((x, y) => (A.weak.has(y.id) ? 1 : 0) - (A.weak.has(x.id) ? 1 : 0)).slice(0, 2);
        const q = shuffle(b);
        mix.forEach((w, i) => q.splice(Math.min(q.length, 2 + i * 2), 0, w));
        runRecall({
            words: q, tag: `${bLabel()} · Tự nhớ lại`, progress: n => bProg(Math.min(n, b.length)),
            onDone: res => {
                b.forEach(w => {
                    A.learned.add(w.id);
                    if (A.onLearned) A.onLearned(w.id, !!res.get(w.id));
                    if (A.kind && settings().sameDay) addFresh(A.kind, w);
                });
                mix.forEach(w => { if (!res.get(w.id) && A.onFail) A.onFail(w.id); });
                q.forEach(w => { res.get(w.id) ? A.weak.delete(w.id) : A.weak.add(w.id); });
                flush();
                A.did += b.length; A.bi++; A.gi = 0;
                toast(`✓ Xong lượt ${A.bi}/${A.bs.length}, đã lưu ${b.length} từ`);
                A.bi < A.bs.length ? renderGuess() : startFinal();
            }
        });
    }

    // ---------------------------------------------------------------- Bộ hỏi tự nhớ lại
    function runRecall(cfg) {
        const listen = "speechSynthesis" in window;
        A.rc = { cfg, res: new Map(), n: 0, queue: cfg.words.map((w, i) => ({ w, ask: listen && i % 3 === 2 ? "listen" : "vi", retry: false })) };
        renderRecall();
    }
    function renderRecall() {
        const a = A, r = a.rc;
        if (!r.queue.length) { a.rc = null; r.cfg.onDone(r.res); return; }
        const it = r.queue[0], w = it.w, typing = settings().recall !== "self";
        r.cfg.progress(r.n); r.open = true; r.hint = 0; r.shown = false;
        html(`<div class="ha-tag">${r.cfg.tag}${it.retry ? " · <em>hỏi lại</em>" : ""} · còn ${r.queue.length}</div><div class="ha-card" id="ha-rc">
            <div class="ha-c ha-muted">${it.ask === "listen" ? "Nghe rồi nhớ ra từ" : "Từ tiếng Trung là gì?"}</div>
            <div class="ha-c" style="padding:16px 0 12px">${it.ask === "listen" ? `<button type="button" class="ha-listen" data-say="${esc(w.hz)}">🔊</button><div class="ha-muted">Bấm để nghe lại</div>` : `<div class="ha-vi">${esc(w.vi)}</div>`}<div class="ha-muted" id="ha-hint"></div></div>
            ${typing ? `<form class="ha-form" id="ha-form"><input id="ha-in" lang="zh-CN" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Chữ Hán hoặc pinyin" aria-label="Gõ chữ Hán hoặc pinyin không dấu"><button class="ha-btn pri">Kiểm tra</button></form>`
                : `<div class="ha-row"><button type="button" class="ha-btn pri lg" data-rc="show">Xem đáp án</button></div>`}
            <div class="ha-row"><button type="button" class="ha-btn" data-rc="hint">💡 Gợi ý</button><button type="button" class="ha-btn" data-rc="dk">Không nhớ</button></div>
            <div id="ha-fb"></div></div>`);
        if (it.ask === "listen") setTimeout(() => { if (A === a && a.rc === r && r.queue[0] === it && r.open) say(w.hz); }, 200);
        const inp = el("ha-in");
        if (inp) {
            inp.focus({ preventScroll: true });
            // Enter đang chọn chữ trong bộ gõ thì không nộp bài
            inp.addEventListener("keydown", e => { if (e.key === "Enter" && (e.isComposing || e.keyCode === 229)) e.preventDefault(); });
            el("ha-form").onsubmit = e => { e.preventDefault(); const v = inp.value.trim(); if (r.open && v) answerRecall(match(w, v), v); };
        }
        onClick(e => {
            if (e.target.closest('[data-go="next"]')) { recallNext(); return; }
            const b = e.target.closest("[data-rc]"); if (!b) return;
            const x = b.dataset.rc;
            if (x === "right") { r.last.ok = true; if (!it.retry) r.res.set(w.id, !r.hint); const f = el("ha-fb").querySelector(".ha-fb"); f.className = "ha-fb ok"; f.querySelector(".t").textContent = "Đã tính là đúng"; b.remove(); return; }
            if (!r.open) return;
            if (x === "hint") hint(w);
            if (x === "dk") answerRecall(false, "");
            if (x === "show") { r.shown = true; A.shownAt = Date.now(); clearInputs(); el("ha-fb").innerHTML = `<div class="ha-fb">${fbWord(w)}<div class="ha-two"><button type="button" class="ha-btn" data-rc="no">✗ Chưa nhớ</button><button type="button" class="ha-btn pri" data-rc="yes">✓ Nhớ đúng</button></div></div>`; say(w.hz); }
            if (x === "yes") answerRecall(true, "");
            if (x === "no") answerRecall(false, "");
        });
    }
    // Đúng khi gõ đúng chữ Hán hoặc đúng pinyin (bỏ dấu thanh, khoảng trắng); từ có nhiều dạng "A/B" thì đúng một dạng là được
    function match(w, v) {
        const py = t => norm(t).replace(/v/g, "u").replace(/[^a-z]/g, "");
        if (han(v)) return w.hz.split(/[\/／|、，,]/).map(han).filter(Boolean).indexOf(han(v)) >= 0;
        return !!py(v) && String(w.py).split(/[\/／;,，]/).map(py).indexOf(py(v)) >= 0;
    }
    function hint(w) {
        const n = ++A.rc.hint, py = norm(w.py).replace(/[^a-z ]/g, " ").trim();
        el("ha-hint").textContent = n === 1 ? `${han(w.hz).length} chữ · pinyin bắt đầu bằng “${py.charAt(0)}”` : (w.hv ? `Hán Việt: ${w.hv} · ` : "") + py.split(/\s+/).map(x => x.slice(0, 2) + "…").join(" ");
        const i = el("ha-in"); if (i) i.focus({ preventScroll: true });
    }
    function clearInputs() { B().querySelectorAll("#ha-rc > .ha-row, #ha-rc > .ha-form").forEach(x => x.remove()); }
    function fbWord(w) {
        return `<div><span class="hz">${esc(w.hz)}</span> <span style="color:var(--ui-pinyin)">${esc(w.py)}</span> — ${esc(w.vi)} <button type="button" class="ha-say" data-say="${esc(w.hz)}" title="Nghe">🔊</button></div>
            ${w.ex ? `<div class="ex">${mark(w.ex, w.hz)}${w.exvi ? `<br><small>${esc(w.exvi)}</small>` : ""}</div>` : ""}`;
    }
    function answerRecall(ok, typed) {
        const r = A.rc, it = r.queue[0], w = it.w;
        if (!r.open) return;
        r.open = false; A.shownAt = Date.now();
        if (!it.retry) { A.answers++; r.res.set(w.id, ok && !r.hint); }      // dùng gợi ý thì không tính là tự nhớ
        r.last = { ok };
        if (r.shown) { A.shownAt = 0; recallNext(); return; }                // tự chấm: đã xem đáp án, sang từ tiếp
        clearInputs();
        el("ha-fb").innerHTML = `<div class="ha-fb ${ok ? "ok" : "no"}"><div class="t">${ok ? (r.hint ? "Đúng (có gợi ý)" : "Nhớ đúng! 🎉") : "Chưa nhớ, sẽ hỏi lại ngay"}</div>
            ${!ok && typed ? `<div class="ha-muted">Bạn gõ: ${esc(typed)}</div>` : ""}${fbWord(w)}
            ${!ok && typed ? '<button type="button" class="ha-btn" data-rc="right">Từ tôi gõ cũng đúng nghĩa</button>' : ""}
            <button type="button" class="ha-btn pri" data-go="next">Tiếp tục <span class="ko">(Enter)</span></button></div>`;
        say(w.hz);
    }
    function recallNext() {
        const r = A && A.rc;
        if (!r || r.open || Date.now() - A.shownAt < 300) return;
        const it = r.queue.shift();
        if (!it.retry) r.n++;
        if (!r.last.ok) r.queue.splice(Math.min(r.queue.length, 2), 0, { w: it.w, ask: "vi", retry: true });
        renderRecall();
    }

    // ================================================================ 4. Chốt bài: điền từ vào câu / chọn chữ Hán
    function startFinal() {
        const ids = new Set([...A.learned].concat([...A.knownDone].filter(id => A.weak.has(id))));
        const ws = A.words.filter(w => ids.has(w.id));
        A.fq = { queue: shuffle(ws).map(w => ({ w, retry: false })), total: ws.length, n: 0, ok: 0, wrong: new Map(), done: false };
        renderFinal();
    }
    function renderFinal() {
        const f = A.fq;
        f.done = false;
        if (!f.queue.length) { finish({ score: f.total ? Math.round(f.ok / f.total * 100) : 100, correct: f.ok, total: f.total, wrong: [...f.wrong.values()] }); return; }
        const it = f.queue[0], w = it.w;
        const cl = w.cloze && w.cloze.indexOf("～") >= 0 ? w.cloze : w.ex && w.ex.indexOf(w.hz) >= 0 ? w.ex.split(w.hz).join("～") : "";
        f.opts = shuffle([w].concat(distract(w, "hz")));
        prog(0.8 + 0.2 * f.n / f.total, `${Math.min(f.n + 1, f.total)}/${f.total}`);
        html(`<div class="ha-tag">Chốt bài${it.retry ? " · <em>làm lại câu sai</em>" : ""}</div><div class="ha-card">
            <div class="ha-c ha-muted">${cl ? "Chọn từ điền vào chỗ trống" : "Chọn chữ Hán đúng"}</div>
            ${cl ? `<div class="ha-ex">${esc(cl).split("～").join("＿".repeat(Math.max(2, han(w.hz).length)))}</div><div class="ha-c ha-muted">${esc(cut(w.vi, 70))}</div>` : `<div class="ha-vi">${esc(w.vi)}</div>`}
            <div class="ha-opts">${f.opts.map((o, i) => `<button type="button" class="ha-o" data-f="${i}"><kbd class="ko">${i + 1}</kbd><span class="cn">${esc(o.hz)}</span></button>`).join("")}</div><div id="ha-fb"></div></div>`);
        onClick(e => {
            const b = e.target.closest("[data-f]"); if (b) { answerFinal(+b.dataset.f); return; }
            if (e.target.closest('[data-go="next"]')) finalNext();
        });
    }
    function answerFinal(i) {
        const f = A.fq, it = f.queue[0], w = it.w;
        if (f.done || !it) return;
        f.done = true; A.shownAt = Date.now(); A.answers++;
        const ok = f.opts[i] === w;
        B().querySelectorAll(".ha-o").forEach((b, k) => { b.disabled = true; if (f.opts[k] === w) b.classList.add("ok"); else if (k === i) b.classList.add("no"); });
        if (!it.retry) { f.n++; if (ok) f.ok++; else f.wrong.set(w.id, w); }
        f.again = !ok;
        el("ha-fb").innerHTML = `<div class="ha-fb ${ok ? "ok" : "no"}"><div class="t">${ok ? "Chính xác! 🎉" : "Chưa đúng"}</div>${fbWord(w)}<button type="button" class="ha-btn pri" data-go="next">Tiếp tục <span class="ko">(Enter)</span></button></div>`;
        el("ha-fb").scrollIntoView({ block: "nearest" });
        say(w.hz);
    }
    function finalNext() {
        const f = A && A.fq;
        if (!f || !f.done || Date.now() - A.shownAt < 300) return;
        const it = f.queue.shift();
        if (f.again) f.queue.splice(Math.min(f.queue.length, 4), 0, { w: it.w, retry: true });
        renderFinal();
    }
    function finish(res) {
        if (res && A.onFail) res.wrong.forEach(w => A.onFail(w.id));
        flush();
        A.dirty = false; A.fq = null;
        if (A.onFinish) A.onFinish(res);
        prog(1, "✓ Xong");
        const nl = A.learned.size, nk = A.knownDone.size, same = A.kind && settings().sameDay && nl;
        html(`<div class="ha-card ha-c"><h2 style="margin:0 0 6px">${nl ? "Xong phần từ vựng!" : "Bạn đã biết hết các từ này!"}</h2>
            ${res ? `<div class="ha-score">${res.score}%</div><div class="ha-muted">${res.correct}/${res.total} câu chốt đúng ngay lần đầu</div>` : ""}
            <p>${nl ? `${nl} từ mới` : ""}${nl && nk ? " và " : ""}${nk ? `${nk} từ đã biết` : ""} đã vào lịch ôn.${res && res.wrong.length ? " Từ làm sai được hẹn ôn lại sau 10 phút." : ""}${same ? " Từ mới còn được hỏi lại trong ngày ở trang Buổi học hôm nay." : ""}</p>
            ${res && res.wrong.length ? `<ul class="ha-list" style="text-align:left">${res.wrong.map(w => `<li><span class="hz">${esc(w.hz)}</span> <span class="py">${esc(w.py)}</span> ${esc(cut(w.vi, 60))}</li>`).join("")}</ul>` : ""}
            <div class="ha-row">${nl ? '<button type="button" class="ha-btn" data-go="all">🧾 Thử nhớ lại hết</button>' : ""}<button type="button" class="ha-btn pri lg" data-go="close">${esc(A.doneLabel || "Xong")}</button></div></div>`);
        onClick(e => {
            const b = e.target.closest("[data-go]"); if (!b) return;
            if (b.dataset.go === "all") recallAll(); else shut();
        });
    }
    function recallAll() {
        const ws = shuffle(A.words.filter(w => A.learned.has(w.id) || A.knownDone.has(w.id))), marks = new Map();
        html(`<div class="ha-tag">Thử nhớ lại hết</div><div class="ha-card"><p class="ha-c" style="margin:0">Nhìn nghĩa, tự nói to từ tiếng Trung, rồi chạm để xem và tự chấm.</p>
            ${ws.map((w, i) => `<div class="ha-ra" data-i="${i}"><button type="button" class="q">${esc(w.vi)}</button><div hidden><span class="hz">${esc(w.hz)}</span> <span style="color:var(--ui-pinyin)">${esc(w.py)}</span><span class="bt"><button type="button" class="ha-btn" data-m="0" title="Chưa nhớ">✗</button><button type="button" class="ha-btn" data-m="1" title="Nhớ đúng">✓</button></span></div></div>`).join("")}
            <div class="ha-row"><button type="button" class="ha-btn pri" data-go="end">Xong</button></div></div>`);
        onClick(e => {
            if (e.target.closest('[data-go="end"]')) { marks.forEach((ok, id) => { if (!ok && A.onFail) A.onFail(id); }); flush(); shut(); return; }
            const row = e.target.closest(".ha-ra"); if (!row) return;
            const w = ws[+row.dataset.i], m = e.target.closest("[data-m]");
            if (m) { const ok = m.dataset.m === "1"; marks.set(w.id, ok); row.className = "ha-ra " + (ok ? "ok" : "no"); prog(marks.size / ws.length, `${marks.size}/${ws.length}`); return; }
            row.querySelector("div").hidden = false; say(w.hz);
        });
    }

    // ================================================================ Nhớ lại trong ngày
    // Lượt 1 sau 10 phút, lượt 2 từ 19 giờ (cách lúc học ≥ 2 giờ); qua ngày thì bỏ. Nhớ đúng không đổi lịch SRS, chưa nhớ thì hẹn ôn sau 10 phút.
    function addFresh(kind, w) {
        const o = load(), sod = startOfDay();
        Object.keys(o.fresh).forEach(k => { if (o.fresh[k].at < sod) delete o.fresh[k]; });
        o.fresh[kind + ":" + w.id] = { at: Date.now(), s: 0, w: { id: w.id, hz: w.hz, py: w.py, hv: w.hv || "", vi: w.vi, ex: w.ex || "", exvi: w.exvi || "" } };
        writeJSON(KEY, o);
    }
    function splitKey(k) { const i = k.indexOf(":"); return [k.slice(0, i), k.slice(i + 1)]; }
    function cardOf(k) {
        const [kind, id] = splitKey(k);
        if (kind === "boya") return ((readJSON("boya_learning_progress_v2", {}) || {}).srs || {})[id];
        const e = ((readJSON("hoc_mywords_v1", {}) || {}).words || {})[id];
        return e && e.card;
    }
    function failed(c) { return Object.assign({}, c, { iv: 0, reps: 0, last: Date.now(), due: Date.now() + 10 * MIN }); }
    function failCard(k) {
        const [kind, id] = splitKey(k);
        if (kind === "boya") {
            const P = readJSON("boya_learning_progress_v2", null);
            if (P && P.srs && P.srs[id]) { P.srs[id] = failed(P.srs[id]); writeJSON("boya_learning_progress_v2", P); }
        } else if (window.HocMyWords && HocMyWords.get(id)) HocMyWords.update(id, { card: failed(HocMyWords.get(id).card) });
    }
    function step(f, c) { return f.s === 0 && c.last > f.at + 5 * MIN ? 1 : f.s; }     // đã ôn thẻ này ở chỗ khác thì coi như xong lượt 1
    function evening(f) { return Math.max(startOfDay() + 19 * 3600000, f.at + 2 * 3600000); }
    function freshInfo() {
        const o = load(), now = Date.now(), sod = startOfDay(), out = { ready: [], waiting: 0, next: 0 };
        if (!o.settings.sameDay) return out;
        Object.keys(o.fresh).forEach(k => {
            const f = o.fresh[k], c = f && f.at >= sod && f.w ? cardOf(k) : null;
            if (!c) return;
            const s = step(f, c);
            let t = s === 0 ? f.at + 10 * MIN : s === 1 ? evening(f) : 0;
            if (!t || t >= sod + DAY) return;
            if (t <= now) { if (c.due > now) out.ready.push(k); }                        // đã đến hạn SRS thì để phần Ôn tập hỏi
            else { out.waiting++; if (!out.next || t < out.next) out.next = t; }
        });
        return out;
    }
    function startFresh(opts) {
        const keys = shuffle(freshInfo().ready).slice(0, 30);
        if (!keys.length) return false;
        const fr = load().fresh, words = keys.map(k => Object.assign({}, fr[k].w, { id: k }));
        openShell(Object.assign({ title: `🌱 Nhớ lại từ mới · ${words.length} từ` }, opts || {}, { words, kind: "" }));
        A.dirty = true;
        runRecall({
            words, tag: "Nhớ lại từ học hôm nay", progress: n => prog(n / words.length, `${Math.min(n + 1, words.length)}/${words.length}`),
            onDone: res => {
                const now = Date.now(), o = load();
                keys.forEach(k => { const f = o.fresh[k], c = cardOf(k); if (f && c) o.fresh[k] = Object.assign({}, f, { s: step(f, c) === 0 && now < evening(f) ? 1 : 2, u: now }); });
                writeJSON(KEY, o);
                const wrong = words.filter(w => !res.get(w.id)), ok = words.length - wrong.length;
                wrong.forEach(w => failCard(w.id));
                A.dirty = false;
                prog(1, "✓ Xong");
                html(`<div class="ha-card ha-c"><h2 style="margin:0 0 6px">Xong lượt nhớ lại!</h2><div class="ha-score">${Math.round(ok / words.length * 100)}%</div>
                    <p>${wrong.length ? `${wrong.length} từ chưa nhớ sẽ vào phần Ôn tập sau 10 phút.` : "Bạn nhớ được hết các từ vừa học."}</p>
                    <div class="ha-row"><button type="button" class="ha-btn pri lg" data-go="close">Xong</button></div></div>`);
                onClick(e => { if (e.target.closest('[data-go="close"]')) shut(); });
            }
        });
        return true;
    }

    // ---------------------------------------------------------------- Bàn phím: chặn phím tắt của trang khi khung đang mở
    window.addEventListener("keydown", e => {
        if (!A || el("hv-ov") || el("zz-ov") || el("tts-ov")) return;
        e.stopPropagation();
        const tag = e.target && e.target.tagName;
        if (e.key === "Escape") { e.preventDefault(); askClose(); return; }
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.ctrlKey || e.metaKey || e.altKey) return;
        const num = /^[0-4]$/.test(e.key) ? +e.key : -1;
        if (A.vf) { if (num >= 0) { e.preventDefault(); answerVerify(num === 0 ? -2 : num - 1); } return; }
        if (A.guess) { if (num >= 0) { e.preventDefault(); revealGuess(num - 1); } return; }
        if (A.fq && !A.fq.done) { if (num >= 1 && num <= A.fq.opts.length) { e.preventDefault(); answerFinal(num - 1); } return; }
        const yes = B().querySelector('[data-rc="yes"]');
        if (yes) { if ((num === 1 || num === 2) && Date.now() - A.shownAt > 300) { e.preventDefault(); (num === 2 ? yes : B().querySelector('[data-rc="no"]')).click(); } return; }
        if (e.key !== "Enter" && e.key !== " ") return;
        const go = B().querySelector('[data-rc="show"], [data-go="next"]');
        if (!go || (tag === "BUTTON" && e.target !== go && B().contains(e.target))) return;     // Enter trên nút khác: để nút đó xử lý
        e.preventDefault();
        if (Date.now() - A.shownAt > 300) go.click();
    }, true);

    window.HocActive = { open, startFresh, freshInfo, otherKnown, knownIv, settings, set, isOpen: () => !!A, KNOWN_IV };
})();
