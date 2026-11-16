/* ==========================================================================
   SHARED/ZIZU.JS — "Họ chữ" (字族): mọi từ chứa một chữ Hán, chia Đã học / Chưa học, kèm Hán Việt
   - Phần tử có thuộc tính data-zizu="学" tự thành nút mở bảng Họ chữ của chữ đó (chạm ở bất kỳ trang nào).
   - Tự nạp lười (đường dẫn tính theo vị trí file này): shared/dict_vi.js (từ, pinyin, HV, nghĩa)
     và luyen_tap/lt_data.js (cấp HSK của từ + đổi id thẻ Boya sang chữ Hán để biết từ đã học).
   - "Đã học" = có thẻ SRS ở bất kỳ trang nào (hsk_lotrinh_v1, boya_learning_progress_v2, boya_tv_srs, hsk_wl_srs_v3) hoặc trong Từ của tôi.
   - API: HocZizu.open(char)   HocZizu.close()
   ========================================================================== */
(function () {
    "use strict";
    var HAN = /[㐀-鿿]/;
    var base = (function () {
        var s = document.currentScript && document.currentScript.src;
        return s ? s.replace(/[^/]*$/, "") : "../shared/";
    })();
    var loads = {};
    function loadScript(url, test) {
        if (test()) return Promise.resolve(true);
        if (loads[url]) return loads[url];
        return (loads[url] = new Promise(function (res) {
            var s = document.createElement("script");
            s.src = url; s.onload = function () { res(test()); }; s.onerror = function () { delete loads[url]; res(false); };
            document.head.appendChild(s);
        }));
    }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
    function cleanHz(s) { return String(s || "").replace(/[（(]([^）)]*)[）)](?=[一-鿿])/g, "$1").replace(/\s*[（(][^）)]*[）)]\s*/g, "").replace(/\s+/g, ""); }

    var levelMap = null;   // từ -> cấp HSK (thấp nhất)
    function buildLevels() {
        if (levelMap || !window.LT_DATA) return;
        levelMap = {};
        Object.keys(LT_DATA.words).forEach(function (id) {
            var m = /^(\d)-/.exec(id);
            if (!m) return;
            var hz = cleanHz(LT_DATA.words[id][0]);
            levelMap[hz] = Math.min(levelMap[hz] || 9, +m[1]);
        });
    }
    function learnedSet() {
        var set = {};
        var hs = readJSON("hsk_lotrinh_v1");
        Object.keys((hs && hs.srs) || {}).forEach(function (id) { set[cleanHz(id.replace(/^\d+-/, ""))] = 1; });
        var wl = readJSON("hsk_wl_srs_v3") || {};
        Object.keys(wl).forEach(function (id) { if (wl[id] && wl[id].hz) set[cleanHz(wl[id].hz)] = 1; });
        if (window.HocMyWords) HocMyWords.all().forEach(function (e) { set[cleanHz(e.hz)] = 1; });
        var boyaIds = Object.keys(((readJSON("boya_learning_progress_v2") || {}).srs) || {}).concat(Object.keys(readJSON("boya_tv_srs") || {}));
        if (window.LT_DATA) boyaIds.forEach(function (id) { var w = LT_DATA.words[id]; if (w) set[cleanHz(w[0])] = 1; });
        return set;
    }
    // ---------- Giao diện ----------
    var CSS = "" +
        ".zz-ov{position:fixed;inset:0;background:var(--ui-overlay,rgba(15,23,42,.45));z-index:99970;display:flex;align-items:center;justify-content:center;padding:12px}" +
        ".zz-box{background:var(--ui-surface,#fff);color:var(--ui-text,#0f172a);border:1px solid var(--ui-border,#ddd);border-radius:16px;box-shadow:var(--ui-shadow-lg);width:100%;max-width:520px;max-height:calc(100vh - 24px);display:flex;flex-direction:column;font:14.5px/1.5 var(--ui-font-sans,system-ui,sans-serif)}" +
        ".zz-head{display:flex;gap:14px;align-items:center;padding:16px 18px 10px;border-bottom:1px solid var(--ui-border,#ddd)}" +
        ".zz-ch{font-family:var(--ui-font-cn,serif);font-size:52px;line-height:1;font-weight:700}" +
        ".zz-info b{display:block;font-size:17px;letter-spacing:.03em}.zz-info .py{color:var(--ui-pinyin,#0369a1);font-weight:600}.zz-info small{color:var(--ui-muted,#64748b)}" +
        ".zz-x{margin-left:auto;align-self:flex-start;border:0;background:none;font-size:24px;cursor:pointer;color:var(--ui-muted,#64748b)}" +
        ".zz-body{overflow:auto;padding:8px 18px 16px}" +
        ".zz-body h4{margin:12px 0 6px;font-size:13.5px;color:var(--ui-muted,#64748b);text-transform:uppercase;letter-spacing:.05em}" +
        ".zz-w{display:flex;gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--ui-border,#eee)}" +
        ".zz-w .hz{font-family:var(--ui-font-cn,serif);font-size:21px;min-width:64px}.zz-w .hz em{font-style:normal;color:var(--ui-primary,#4f46e5)}" +
        ".zz-w .tx{flex:1;min-width:0}.zz-w .tx .py{color:var(--ui-pinyin,#0369a1);font-size:13px}.zz-w .tx .hv{font-size:11.5px;font-weight:700;color:var(--ui-muted,#64748b);margin-left:6px}" +
        ".zz-w .tx .vi{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
        ".zz-w .lv{font-size:11px;font-weight:700;border-radius:99px;padding:1px 7px;background:var(--ui-surface-2,#f1f5f9);color:var(--ui-muted,#64748b);flex:none}" +
        ".zz-w button{border:1px solid var(--ui-border-strong,#ccc);background:var(--ui-surface,#fff);color:inherit;border-radius:8px;min-width:34px;height:34px;cursor:pointer;flex:none}" +
        ".zz-w button.in{color:var(--ui-success,#047857);border-color:var(--ui-success,#047857)}" +
        ".zz-note{margin-top:8px;font-size:13px;background:var(--ui-warning-soft,#fef3c7);border-radius:10px;padding:6px 10px}" +
        ".zz-more{display:block;margin:8px auto 0;border:1px solid var(--ui-border-strong,#ccc);background:none;color:inherit;border-radius:10px;padding:6px 14px;cursor:pointer}" +
        "[data-zizu]{cursor:pointer}" +
        "@media (max-width:720px){.zz-ov{align-items:flex-end;padding:0}.zz-box{max-width:none;border-radius:18px 18px 0 0;max-height:85vh;animation:zz-up .2s ease}}" +
        "@keyframes zz-up{from{transform:translateY(100%)}to{transform:none}}";
    function speak(t) {
        if (!("speechSynthesis" in window)) return;
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(t); u.lang = "zh-CN"; u.rate = 0.85;
        speechSynthesis.speak(u);   // shared/tts.js (nếu có) tự chọn giọng
    }
    function close() { var o = document.getElementById("zz-ov"); if (o) o.remove(); }
    function open(ch) {
        ch = String(ch || "").trim()[0];
        if (!ch || !HAN.test(ch)) return;
        if (!document.getElementById("zz-css")) { var st = document.createElement("style"); st.id = "zz-css"; st.textContent = CSS; document.head.appendChild(st); }
        close();
        var ov = document.createElement("div"); ov.className = "zz-ov"; ov.id = "zz-ov";
        ov.innerHTML = '<div class="zz-box" role="dialog" aria-modal="true"><div class="zz-head"><span class="zz-ch">' + esc(ch) + '</span><div class="zz-info">Đang tải…</div><button class="zz-x" aria-label="Đóng">×</button></div><div class="zz-body"></div></div>';
        ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
        ov.querySelector(".zz-x").onclick = close;
        document.body.appendChild(ov);
        var tasks = [loadScript(base + "dict_vi.js", function () { return !!window.HOC_DICT; }),
                     loadScript(base + "../luyen_tap/lt_data.js", function () { return !!window.LT_DATA; })];   // cấp HSK + id thẻ Boya
        Promise.all(tasks).then(function () { if (document.getElementById("zz-ov") === ov) render(ov, ch); });
    }
    function render(ov, ch) {
        var D = window.HOC_DICT;
        if (!D) { ov.querySelector(".zz-info").textContent = "Không tải được từ điển."; return; }
        buildLevels();
        var learned = learnedSet();
        var c = D.c[ch] || [], single = D.w[ch];
        ov.querySelector(".zz-info").innerHTML = "<b>" + esc(c[1] || (single && single[1]) || "") + "</b>" +
            '<span class="py">' + esc(c[0] || (single && single[0]) || "") + "</span>" +
            (single && single[2] ? "<div>" + esc(single[2]) + "</div>" : "") +
            (window.HocNotes && HocNotes.get(ch) ? '<div class="zz-note">📝 ' + esc(HocNotes.get(ch)) + "</div>" : "");
        var words = Object.keys(D.w).filter(function (w) { return w.length > 1 && w.indexOf(ch) >= 0; });
        var lv = function (w) { return levelMap && levelMap[w] ? levelMap[w] : 9; };
        words.sort(function (a, b) { return lv(a) - lv(b) || a.length - b.length || a.localeCompare(b); });
        var known = words.filter(function (w) { return learned[w]; }), rest = words.filter(function (w) { return !learned[w]; });
        var row = function (w) {
            var e = D.w[w], inBook = window.HocMyWords && HocMyWords.has(w);
            return '<div class="zz-w"><span class="hz">' + w.split("").map(function (x) { return x === ch ? "<em>" + esc(x) + "</em>" : esc(x); }).join("") + "</span>" +
                '<span class="tx"><span class="py">' + esc(e[0]) + '</span><span class="hv">' + esc(e[1]) + '</span><div class="vi">' + esc(e[2]) + "</div></span>" +
                (lv(w) < 9 ? '<span class="lv">HSK ' + lv(w) + "</span>" : "") +
                '<button data-say="' + esc(w) + '" aria-label="Nghe">🔊</button>' +
                (learned[w] || !window.HocMyWords ? "" : '<button data-add="' + esc(w) + '" class="' + (inBook ? "in" : "") + '" title="' + (inBook ? "Đã trong Từ của tôi" : "Thêm vào Từ của tôi") + '">' + (inBook ? "✓" : "＋") + "</button>") + "</div>";
        };
        var LIMIT = 30, body = ov.querySelector(".zz-body");
        function draw(showAll) {
            var r = showAll ? rest : rest.slice(0, LIMIT);
            body.innerHTML =
                "<h4>✅ Đã học (" + known.length + ")</h4>" + (known.length ? known.map(row).join("") : '<p style="color:var(--ui-muted,#64748b);font-size:13px">Chưa có từ nào chứa chữ này trong lịch ôn của bạn.</p>') +
                "<h4>📚 Chưa học (" + rest.length + ")</h4>" + r.map(row).join("") +
                (!showAll && rest.length > LIMIT ? '<button class="zz-more">Xem thêm ' + (rest.length - LIMIT) + " từ</button>" : "");
            var more = body.querySelector(".zz-more"); if (more) more.onclick = function () { draw(true); };
        }
        draw(false);
        body.onclick = function (e) {
            var s = e.target.closest("[data-say]"); if (s) { speak(s.getAttribute("data-say")); return; }
            var a = e.target.closest("[data-add]");
            if (a && window.HocMyWords) {
                var w = a.getAttribute("data-add"), en = D.w[w];
                if (HocMyWords.has(w)) { HocMyWords.remove(w); a.classList.remove("in"); a.textContent = "＋"; }
                else { HocMyWords.add({ hz: w, py: en[0], hv: en[1], vi: en[2], src: "Họ chữ · " + ch }); a.classList.add("in"); a.textContent = "✓"; }
            }
        };
    }
    document.addEventListener("click", function (e) {
        var t = e.target.closest && e.target.closest("[data-zizu]");
        if (!t) return;
        e.preventDefault(); e.stopPropagation();
        open(t.getAttribute("data-zizu"));
    }, true);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    window.HocZizu = { open: open, close: close };
})();
