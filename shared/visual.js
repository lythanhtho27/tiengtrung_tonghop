/* ==========================================================================
   SHARED/VISUAL.JS — hình ảnh hỗ trợ nhớ từ (HocVisual)
   Ba phần, dùng chung cho mọi trang:
     1. Emoji minh họa cho từ cụ thể / hành động / cảm xúc  (shared/emoji_map.js, viết tay)
     2. Nút "🖼️ Ảnh": mở Baidu (hoặc Google) Hình ảnh tìm đúng từ, ở tab mới
     3. Nút "✍️ Nét viết": khung xem thứ tự nét (thư viện Hanzi Writer, nạp từ CDN khi cần — cần mạng),
        tự viết thử, và tách bộ chữ Hán (shared/hanzi_parts.js, sinh bởi tools/build_visual.py):
        hình thanh (bộ nghĩa + bộ âm) / hội ý / tượng hình, kèm âm Hán Việt + nghĩa của từng bộ phận.
   Thêm: (A) readingHTML(hz, py, hv) — khối "🔤 Hán Việt → pinyin": so từng chữ với quy tắc chuyển âm
        (huyền→2, hỏi→3, sắc/nặng→4; -m→-n, -ng/-nh→-ng, -p/-t/-c/-ch→không -n/-ng; đ→d/t, v→w/y, tr→zh/ch…),
        chữ ngoại lệ được đánh ⚠; (B) trong khung Nét viết: họ chữ cùng bộ âm (青 → 清情晴请精睛静), tô màu theo thanh.
   API:
     HocVisual.emoji(hz)            → emoji hoặc "" (đã tôn trọng cài đặt)
     HocVisual.barHTML(hz, {emoji, compact}) → chuỗi HTML thanh nhỏ: [emoji] [🖼️ Ảnh] [✍️ Nét viết]
                                    (compact: emoji nhỏ, inline — dùng trong thẻ lật có chiều cao cố định)
     HocVisual.write(hz, i)         → mở khung Nét viết cho từ hz (chữ thứ i)
     HocVisual.settings() / set(patch)
   Phần tử có data-hv-write="từ" tự thành nút mở khung Nét viết (bắt ở pha capture để không lật thẻ).
   Cài đặt lưu theo thiết bị ở hoc_visual_v1 (tùy chọn giao diện, không đồng bộ).
   ========================================================================== */
(function () {
    "use strict";
    var HAN = /[㐀-鿿]/;
    var KEY = "hoc_visual_v1";
    var HW_URL = "https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js";
    var base = (function () {
        var s = document.currentScript && document.currentScript.src;
        return s ? s.replace(/[^/]*$/, "") : "../shared/";
    })();
    var DEF = { emoji: true, img: true, imgSrc: "baidu", rules: true };

    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
    function cleanHz(s) { return String(s || "").replace(/[（(]([^）)]*)[）)](?=[一-鿿])/g, "$1").replace(/\s*[（(][^）)]*[）)]\s*/g, "").replace(/[\s～~…]+/g, ""); }
    function settings() {
        var o = {};
        try { o = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) {}
        var r = {}; for (var k in DEF) r[k] = k in o ? o[k] : DEF[k];
        return r;
    }
    function set(patch) {
        var s = settings(); for (var k in patch) s[k] = patch[k];
        try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
        return s;
    }
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
    // emoji_map.js nhỏ (~25KB) nên nạp sẵn ngay khi trang mở
    if (!window.HOC_EMOJI) loadScript(base + "emoji_map.js", function () { return !!window.HOC_EMOJI; });

    function emojiRaw(hz) {
        var m = window.HOC_EMOJI; if (!m) return "";
        var w = cleanHz(hz);
        return m[w] || m[w.replace(/[儿子]$/, "")] || "";
    }
    function emoji(hz) { return settings().emoji ? emojiRaw(hz) : ""; }
    function imgUrl(hz) {
        var w = encodeURIComponent(cleanHz(hz));
        return settings().imgSrc === "google" ? "https://www.google.com/search?tbm=isch&q=" + w
            : "https://image.baidu.com/search/index?tn=baiduimage&word=" + w;
    }
    function barHTML(hz, opts) {
        opts = opts || {};
        var w = cleanHz(hz);
        if (!w || !HAN.test(w)) return "";
        injectCSS();
        var st = settings(), e = opts.emoji === false ? "" : emoji(w);
        return '<div class="hv-bar' + (opts.compact ? " hv-compact" : "") + '">' +
            (e ? '<span class="hv-emoji" title="Hình minh họa">' + e + "</span>" : "") +
            (st.img ? '<a class="hv-btn" data-hv-img href="' + esc(imgUrl(w)) + '" target="_blank" rel="noopener" title="Xem ảnh thật của từ này (mở tab mới)">🖼️' + (opts.compact ? "" : " Ảnh") + "</a>" : "") +
            '<button type="button" class="hv-btn" data-hv-write="' + esc(w) + '" title="Thứ tự nét, tự viết thử, tách bộ">✍️' + (opts.compact ? "" : " Nét viết") + "</button>" +
            "</div>";
    }

    // ---------------------------------------------------------------- Giao diện
    var CSS = "" +
        ".hv-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;margin:8px 0 4px}" +
        ".hv-emoji{font-size:40px;line-height:1;margin-right:4px;font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif}" +
        ".hv-compact{margin:0;display:inline-flex}.hv-compact .hv-emoji{font-size:26px}.lk-pop .hv-bar{justify-content:flex-start}" +
        ".hv-btn{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--ui-border-strong,#cbd5e1);background:var(--ui-surface,#fff);color:var(--ui-text,#0f172a);border-radius:99px;padding:4px 11px;font:600 12.5px/1.4 var(--ui-font-sans,system-ui,sans-serif);cursor:pointer;text-decoration:none}" +
        ".hv-btn:hover{border-color:var(--ui-primary,#4f46e5);color:var(--ui-primary,#4f46e5)}" +
        ".hv-ov{position:fixed;inset:0;background:var(--ui-overlay,rgba(15,23,42,.45));z-index:99965;display:flex;align-items:center;justify-content:center;padding:12px}" +
        ".hv-box{background:var(--ui-surface,#fff);color:var(--ui-text,#0f172a);border:1px solid var(--ui-border,#ddd);border-radius:16px;box-shadow:var(--ui-shadow-lg);width:100%;max-width:600px;max-height:calc(100vh - 24px);display:flex;flex-direction:column;font:14.5px/1.5 var(--ui-font-sans,system-ui,sans-serif)}" +
        ".hv-head{display:flex;gap:8px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--ui-border,#ddd);flex-wrap:wrap}" +
        ".hv-head b{font-size:14px;color:var(--ui-muted,#64748b);font-weight:600;margin-right:4px}" +
        ".hv-tab{font-family:var(--ui-font-cn,serif);font-size:24px;line-height:1;border:1px solid var(--ui-border,#ddd);background:var(--ui-surface-2,#f1f5f9);color:inherit;border-radius:10px;padding:6px 10px;cursor:pointer}" +
        ".hv-tab.on{border-color:var(--ui-primary,#4f46e5);background:var(--ui-primary-soft,#eef2ff);color:var(--ui-primary,#4f46e5)}" +
        ".hv-x{margin-left:auto;border:0;background:none;font-size:24px;cursor:pointer;color:var(--ui-muted,#64748b)}" +
        ".hv-body{overflow:auto;padding:14px 16px;display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start}" +
        ".hv-pad{display:flex;flex-direction:column;align-items:center;gap:8px}" +
        ".hv-canvas{width:220px;height:220px;border:1px solid var(--ui-border-strong,#cbd5e1);border-radius:12px;background:var(--ui-surface,#fff);position:relative;touch-action:none}" +
        ".hv-canvas svg.hv-grid{position:absolute;inset:0;pointer-events:none}" +
        ".hv-canvas .hv-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 150px/1 var(--ui-font-cn,serif)}" +
        ".hv-ctl{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}" +
        ".hv-ctl button{border:1px solid var(--ui-border-strong,#cbd5e1);background:var(--ui-surface,#fff);color:inherit;border-radius:9px;padding:5px 10px;cursor:pointer;font:600 13px/1.3 inherit}" +
        ".hv-ctl button.on{background:var(--ui-primary,#4f46e5);border-color:var(--ui-primary,#4f46e5);color:#fff}" +
        ".hv-msg{font-size:12.5px;color:var(--ui-muted,#64748b);text-align:center;min-height:18px;max-width:230px}" +
        ".hv-info .hv-big{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}" +
        ".hv-info .hv-big .hv-hvn{font-size:20px;font-weight:800;letter-spacing:.04em}" +
        ".hv-info .hv-big .py{color:var(--ui-pinyin,#0369a1);font-weight:600;font-size:16px}" +
        ".hv-info .hv-mean{font-size:13.5px;margin:2px 0 10px}" +
        ".hv-type{display:inline-block;font-size:12px;font-weight:700;border-radius:99px;padding:2px 9px;background:var(--ui-surface-2,#f1f5f9);color:var(--ui-muted,#64748b);margin-bottom:8px}" +
        ".hv-part{display:flex;gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--ui-border,#eee)}" +
        ".hv-part .pc{font-family:var(--ui-font-cn,serif);font-size:30px;min-width:40px;text-align:center;line-height:1}" +
        ".hv-part .pt{flex:1;min-width:0}.hv-part .pt b{letter-spacing:.03em}.hv-part .pt small{display:block;color:var(--ui-muted,#64748b);font-size:12.5px}" +
        ".hv-role{font-size:11px;font-weight:700;border-radius:99px;padding:1px 8px;flex:none}" +
        ".hv-role.sem{background:var(--ui-success-soft,#d1fae5);color:var(--ui-success,#047857)}" +
        ".hv-role.pho{background:var(--ui-warning-soft,#fef3c7);color:var(--ui-warning,#b45309)}" +
        ".hv-tip{font-size:13px;background:var(--ui-surface-2,#f1f5f9);border-radius:10px;padding:7px 10px;margin-top:10px}" +
        ".hv-tip i{color:var(--ui-muted,#64748b)}" +
        ".hv-foot{border-top:1px solid var(--ui-border,#ddd);padding:8px 16px;font-size:12.5px;color:var(--ui-muted,#64748b);display:flex;gap:14px;flex-wrap:wrap;align-items:center}" +
        ".hv-foot label{display:inline-flex;gap:5px;align-items:center;cursor:pointer}" +
        ".hv-foot select{font:inherit;color:inherit;background:var(--ui-surface,#fff);border:1px solid var(--ui-border,#ddd);border-radius:6px}" +
        ".hv-read{margin:10px auto 2px;max-width:460px;text-align:left;font-size:13px;border:1px solid var(--ui-border,#e2e8f0);border-radius:12px;padding:4px 10px;background:var(--ui-surface-2,#f8fafc)}" +
        ".hv-read summary{cursor:pointer;font-weight:700;font-size:12.5px;color:var(--ui-muted,#64748b);padding:3px 0;list-style-position:inside}" +
        ".hv-read summary em{font-style:normal;color:var(--ui-warning,#b45309)}.hv-read summary small{font-weight:600}" +
        ".hv-rd{display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-top:1px solid var(--ui-border,#e2e8f0)}" +
        ".hv-rd .c{font:700 22px/1.1 var(--ui-font-cn,serif);cursor:pointer;min-width:26px;text-align:center}" +
        ".hv-rd .m{white-space:nowrap;min-width:92px;padding-top:2px}.hv-rd .m b{letter-spacing:.02em}" +
        ".hv-rd .r{display:flex;flex-direction:column;gap:1px;padding-top:2px;min-width:0}" +
        ".hv-rd .ok,.hv-rule .ok{color:var(--ui-success,#047857)}.hv-rd .wn,.hv-rule .wn{color:var(--ui-warning,#b45309);font-weight:600}.hv-rd .nt,.hv-rule .nt{color:var(--ui-muted,#64748b)}" +
        ".hv-rule{display:flex;flex-direction:column;gap:1px;font-size:12.5px;margin:-4px 0 10px}" +
        ".hv-famwrap{margin-top:12px;border-top:1px dashed var(--ui-border-strong,#cbd5e1);padding-top:8px}" +
        ".hv-fam-h{font-size:13px;margin:6px 0 6px}" +
        ".hv-fam{display:flex;flex-wrap:wrap;gap:6px}" +
        ".hv-fc{display:flex;flex-direction:column;align-items:center;min-width:54px;border:1px solid var(--ui-border,#e2e8f0);background:var(--ui-surface,#fff);color:inherit;border-radius:10px;padding:4px 6px;cursor:pointer;line-height:1.25}" +
        ".hv-fc:hover{border-color:var(--ui-primary,#4f46e5)}.hv-fc.on{border-color:var(--ui-primary,#4f46e5);background:var(--ui-primary-soft,#eef2ff)}" +
        ".hv-fc .z{font:700 22px/1.15 var(--ui-font-cn,serif)}.hv-fc .p{font-size:12.5px;font-weight:700}.hv-fc .v{font-size:10px;color:var(--ui-muted,#64748b);letter-spacing:.03em}" +
        ".hv-more{align-self:center;font-size:12px;color:var(--ui-muted,#64748b)}" +
        "@media (max-width:620px){.hv-body{grid-template-columns:1fr}.hv-ov{align-items:flex-end;padding:0}.hv-box{max-width:none;border-radius:18px 18px 0 0;max-height:92vh}}";
    function injectCSS() {
        if (document.getElementById("hv-css")) return;
        var st = document.createElement("style"); st.id = "hv-css"; st.textContent = CSS; document.head.appendChild(st);
    }
    var GRID = '<svg class="hv-grid" viewBox="0 0 220 220"><g stroke="var(--ui-border,#e2e8f0)" stroke-width="1" stroke-dasharray="4 4">' +
        '<line x1="0" y1="0" x2="220" y2="220"/><line x1="220" y1="0" x2="0" y2="220"/><line x1="110" y1="0" x2="110" y2="220"/><line x1="0" y1="110" x2="220" y2="110"/></g></svg>';

    function cssVar(name, fb) {
        var v = getComputedStyle(document.documentElement).getPropertyValue(name);
        return (v && v.trim()) || fb;
    }
    function speak(t) {
        if (!("speechSynthesis" in window)) return;
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(t); u.lang = "zh-CN"; u.rate = 0.8;
        speechSynthesis.speak(u);   // shared/tts.js (nếu có) tự chọn giọng
    }
    function close() {
        var o = document.getElementById("hv-ov");
        if (o) o.remove();
        writer = null;
    }

    var writer = null;
    function write(hz, idx) {
        var w = cleanHz(hz);
        var chars = Array.from(w).filter(function (c, i, a) { return HAN.test(c) && a.indexOf(c) === i; });   // 妈妈 → một tab
        if (!chars.length) return;
        injectCSS();
        close();
        var ov = document.createElement("div"); ov.className = "hv-ov"; ov.id = "hv-ov";
        ov.innerHTML = '<div class="hv-box" role="dialog" aria-modal="true" aria-label="Nét viết">' +
            '<div class="hv-head"><b>✍️ Nét viết</b>' +
            chars.map(function (c, i) { return '<button class="hv-tab" data-i="' + i + '">' + esc(c) + "</button>"; }).join("") +
            '<button class="hv-x" aria-label="Đóng">×</button></div>' +
            '<div class="hv-body">' +
            '<div class="hv-pad"><div class="hv-canvas" id="hv-canvas"></div>' +
            '<div class="hv-ctl"><button data-act="anim">▶ Xem nét</button><button data-act="quiz">✍️ Tự viết</button><button data-act="say">🔊</button></div>' +
            '<div class="hv-msg" id="hv-msg"></div></div>' +
            '<div class="hv-info" id="hv-info">Đang tải…</div></div>' +
            '<div class="hv-foot">' +
            '<label><input type="checkbox" data-set="emoji"> Hiện emoji</label>' +
            '<label><input type="checkbox" data-set="img"> Nút ảnh</label>' +
            '<label><input type="checkbox" data-set="rules"> Quy tắc Hán Việt → pinyin</label>' +
            '<label>Tìm ảnh bằng <select data-set="imgSrc"><option value="baidu">Baidu</option><option value="google">Google</option></select></label>' +
            "</div></div>";
        document.body.appendChild(ov);
        var st = settings();
        ov.querySelector('[data-set="emoji"]').checked = st.emoji;
        ov.querySelector('[data-set="img"]').checked = st.img;
        ov.querySelector('[data-set="rules"]').checked = st.rules;
        ov.querySelector('[data-set="imgSrc"]').value = st.imgSrc;
        ov.querySelector(".hv-foot").onchange = function (e) {
            var k = e.target.getAttribute("data-set"); if (!k) return;
            var p = {}; p[k] = e.target.type === "checkbox" ? e.target.checked : e.target.value; set(p);
            document.dispatchEvent(new CustomEvent("hocvisual:change"));
        };
        ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
        ov.querySelector(".hv-x").onclick = close;
        var cur = Math.max(0, Math.min(chars.length - 1, +idx || 0));
        ov.querySelector(".hv-head").addEventListener("click", function (e) {
            var t = e.target.closest(".hv-tab"); if (t) show(+t.getAttribute("data-i"));
        });
        ov.querySelector(".hv-ctl").onclick = function (e) {
            var b = e.target.closest("button"); if (!b) return;
            var act = b.getAttribute("data-act");
            if (act === "say") { speak(chars[cur]); return; }
            if (!writer) return;
            var msg = document.getElementById("hv-msg");
            ov.querySelectorAll(".hv-ctl button").forEach(function (x) { x.classList.remove("on"); });
            if (act === "anim") { writer.cancelQuiz && writer.cancelQuiz(); writer.showCharacter(); writer.showOutline(); writer.animateCharacter(); msg.textContent = ""; }
            if (act === "quiz") {
                b.classList.add("on");
                writer.hideCharacter(); writer.showOutline();
                msg.textContent = "Viết từng nét theo đúng thứ tự. Sai 3 lần sẽ có gợi ý.";
                writer.quiz({
                    onMistake: function (d) { msg.textContent = "Chưa đúng nét " + (d.strokeNum + 1) + " · sai " + d.totalMistakes + " lần"; },
                    onCorrectStroke: function (d) { msg.textContent = "✓ Nét " + (d.strokeNum + 1) + "/" + (d.strokeNum + 1 + d.strokesRemaining); },
                    onComplete: function (d) {
                        b.classList.remove("on");
                        msg.textContent = d.totalMistakes ? "Xong! Sai " + d.totalMistakes + " lần — viết lại lần nữa cho nhớ nhé." : "🎉 Hoàn hảo, không sai nét nào!";
                    }
                });
            }
        };
        function show(i) {
            cur = i;
            ov.querySelectorAll(".hv-tab").forEach(function (t, j) { t.classList.toggle("on", j === i); });
            ov.querySelectorAll(".hv-ctl button").forEach(function (x) { x.classList.remove("on"); });
            document.getElementById("hv-msg").textContent = "";
            drawWriter(chars[i]);
            renderInfo(chars[i]);
        }
        Promise.all([
            loadScript(base + "hanzi_parts.js", function () { return !!window.HOC_PARTS; }),
            loadScript(base + "dict_vi.js", function () { return !!window.HOC_DICT; })
        ]).then(function () { if (document.getElementById("hv-ov") === ov) renderInfo(chars[cur]); });
        show(cur);
    }

    function drawWriter(ch) {
        var box = document.getElementById("hv-canvas"); if (!box) return;
        box.innerHTML = GRID;
        writer = null;
        loadScript(HW_URL, function () { return !!window.HanziWriter; }).then(function (ok) {
            if (!document.getElementById("hv-canvas") || box !== document.getElementById("hv-canvas")) return;
            if (!ok) { offline(box, ch); return; }
            var dark = document.documentElement.getAttribute("data-theme") === "dark";
            var w = HanziWriter.create(box, ch, {
                width: 220, height: 220, padding: 12,
                strokeColor: cssVar("--ui-text", dark ? "#e2e8f0" : "#0f172a"),
                radicalColor: cssVar("--ui-primary", "#4f46e5"),
                outlineColor: dark ? "#334155" : "#e2e8f0",
                drawingColor: cssVar("--ui-primary", "#4f46e5"),
                highlightColor: cssVar("--ui-success", "#10b981"),
                strokeAnimationSpeed: 1, delayBetweenStrokes: 220, showCharacter: false,
                onLoadCharDataError: function () { offline(box, ch); }
            });
            writer = w;
            w.animateCharacter();
        });
    }
    function offline(box, ch) {
        writer = null;
        box.innerHTML = GRID + '<div class="hv-fallback">' + esc(ch) + "</div>";
        var m = document.getElementById("hv-msg");
        if (m) m.textContent = "Cần kết nối mạng để xem thứ tự nét (phần tách bộ bên cạnh vẫn dùng được).";
    }

    // ================================================================ (A) Quy tắc âm Hán Việt → pinyin
    // Tỉ lệ đo trên ~3.400 cặp (chữ, pinyin, âm Hán Việt) của tools/hanviet (11/2026). Chỉ giữ quy tắc đúng ≥ 85%.
    // Tách âm tiết pinyin: chép từ shared/lookup.js (splitPinyin) để file này tự chạy được ở mọi trang.
    var INITIAL = "(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?";
    var FINAL = "(?:iang|iong|uang|ang|eng|ing|ong|ian|iao|uai|uan|van|ue|ve|ai|ao|an|ei|en|er|ia|ie|in|iu|ou|ua|uo|ui|un|vn|a|o|e|i|u|v)";
    var SYL = new RegExp("^" + INITIAL + FINAL + "$");
    var TONE_OF = {}, PLAIN = {};
    ["āēīōūǖ", "áéíóúǘ", "ǎěǐǒǔǚ", "àèìòùǜ"].forEach(function (s, t) {
        Array.from(s).forEach(function (c, k) { TONE_OF[c] = t + 1; PLAIN[c] = "aeiouv"[k]; });
    });
    PLAIN["ü"] = "v";
    function pyPlain(s) { return Array.from(String(s || "").toLowerCase()).map(function (c) { return PLAIN[c] || c; }).join(""); }
    function pyTone(s) { var a = Array.from(String(s || "")); for (var i = 0; i < a.length; i++) if (TONE_OF[a[i]]) return TONE_OF[a[i]]; return 5; }
    function isSyl(b) { return b === "r" || b === "m" || b === "n" || b === "ng" || SYL.test(b); }
    function splitPinyin(py, n) {
        if (!py || !n) return null;
        var parts = String(py).toLowerCase().normalize("NFC").replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü'\s\-]/g, " ").split(/[\s'\-]+/).filter(Boolean);
        var memo = {};
        function splitChunk(ch) {
            if (memo[ch]) return memo[ch];
            var b = pyPlain(ch), res = [];
            (function go(pos, acc) {
                if (res.length > 12) return;
                if (pos === b.length) { res.push(acc.slice()); return; }
                for (var len = Math.min(6, b.length - pos); len >= 1; len--) {
                    if (!isSyl(b.substr(pos, len))) continue;
                    acc.push(ch.substr(pos, len)); go(pos + len, acc); acc.pop();
                }
            })(0, []);
            return (memo[ch] = res);
        }
        var options = parts.map(splitChunk);
        if (options.some(function (o) { return !o.length; })) return null;
        var out = null;
        (function pick(k, acc) {
            if (out) return;
            if (k === options.length) { if (acc.length === n) out = acc.slice(); return; }
            for (var j = 0; j < options[k].length && !out; j++) {
                if (acc.length + options[k][j].length > n) continue;
                pick(k + 1, acc.concat(options[k][j]));
            }
        })(0, []);
        return out;
    }
    var VN_TONE = { "̀": "huyền", "́": "sắc", "̉": "hỏi", "̃": "ngã", "̣": "nặng" };
    function hvTone(s) {
        var d = String(s || "").toLowerCase().normalize("NFD");
        for (var i = 0; i < d.length; i++) if (VN_TONE[d[i]]) return VN_TONE[d[i]];
        return "ngang";
    }
    function hvBase(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̣̀́̉̃]/g, "").normalize("NFC"); }
    // phụ âm đầu Hán Việt → các phụ âm đầu pinyin thường gặp ("" = không có phụ âm đầu: a-, e-, o-, y-, w-)
    var INIT_RULES = [
        ["ngh", ["", "n"]], ["ng", ["", "n"]], ["nh", ["r", ""]], ["ph", ["f", "p"]], ["tr", ["zh", "ch"]], ["ch", ["zh", "ch"]],
        ["kh", ["k", "q"]], ["gi", ["j", "x"]], ["đ", ["d", "t"]], ["v", ["w", "y"]], ["h", ["h", "x"]], ["m", ["m", "w"]],
        ["l", ["l"]], ["b", ["b", "p"]], ["n", ["n"]], ["th", null], ["t", ["z", "j", "x", "c", "q", "s"]],
        ["k", ["g", "j", "k", "q"]], ["c", ["g", "j", "k", "q"]], ["q", ["g", "j", "k", "q"]], ["s", null], ["x", null], ["d", null], ["r", null]
    ];
    function pyInitial(p) { var m = /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcs])/.exec(p); return m ? m[1] : ""; }
    // Kiểm tra một chữ: trả {tone:{ok,txt}, init:{ok,txt}|null, fin:{ok,txt}|null, enter}
    function checkChar(hv, py) {
        var b = hvBase(hv), t = hvTone(hv), p = pyPlain(py), pt = pyTone(py);
        if (!b || !p) return null;
        var enter = /(p|t|c|ch)$/.test(b);
        var r = { enter: enter, tone: null, init: null, fin: null };
        // thanh điệu
        if (enter) r.tone = { ok: null, txt: "vần -" + /(ch|p|t|c)$/.exec(b)[1] + ": thanh phải nhớ riêng" };
        else {
            var exp = { "huyền": [2], "hỏi": [3], "sắc": [4], "nặng": [4], "ngã": [3, 4], "ngang": [1, 2] }[t];
            var main = { "huyền": "2", "hỏi": "3", "sắc": "4", "nặng": "4", "ngã": "3 hoặc 4", "ngang": "1 (đôi khi 2)" }[t];
            var ok = exp.indexOf(pt) >= 0;
            r.tone = { ok: ok, txt: ok ? t + " → thanh " + pt : t + " thường là thanh " + main + ", chữ này thanh " + (pt === 5 ? "nhẹ" : pt) };
        }
        // vần cuối
        var pFin = /ng$/.test(p) ? "-ng" : /n$/.test(p) && p !== "n" ? "-n" : "";
        var want = enter ? "" : /(ng|nh)$/.test(b) ? "-ng" : /[mn]$/.test(b) ? "-n" : "";
        var hvEnd = enter ? "-" + /(ch|p|t|c)$/.exec(b)[1] : /nh$/.test(b) ? "-nh" : /ng$/.test(b) ? "-ng" : /m$/.test(b) ? "-m" : /n$/.test(b) ? "-n" : "vần mở";
        var fok = pFin === want;
        r.fin = { ok: fok, txt: fok ? (want ? hvEnd + " → " + want : "") : hvEnd + " thường " + (want ? "→ " + want : "không có -n/-ng") + ", chữ này " + (pFin || "không có -n/-ng") };
        // phụ âm đầu
        var rule = null;
        for (var i = 0; i < INIT_RULES.length; i++) if (b.indexOf(INIT_RULES[i][0]) === 0) { rule = INIT_RULES[i]; break; }
        if (rule && rule[1]) {
            var pi = pyInitial(p);
            if (pi === "y" || pi === "w") pi = "";
            var allow = rule[1].map(function (x) { return x === "w" || x === "y" ? "" : x; });
            var iok = allow.indexOf(pi) >= 0;
            var show = rule[1].map(function (x) { return x || "(không phụ âm)"; }).join("/");
            r.init = { ok: iok, txt: iok ? rule[0] + " → " + (pyInitial(p) || "vần") : rule[0] + " thường → " + show + ", chữ này " + (pyInitial(p) || "không có phụ âm đầu") };
        }
        return r;
    }
    function toneColor(py) { var t = pyTone(py); return "var(--ui-tone-" + (t === 5 ? 0 : t) + ",inherit)"; }
    // Danh sách (chữ, Hán Việt, pinyin) của một từ
    function charRows(hz, py, hv) {
        var D = window.HOC_DICT;
        var chars = Array.from(cleanHz(hz)).filter(function (c) { return HAN.test(c); });
        if (!chars.length) return [];
        var sy = splitPinyin(py, chars.length);
        var hvs = String(hv || "").trim().split(/\s+/).filter(Boolean);
        if (hvs.length !== chars.length) hvs = [];
        return chars.map(function (c, i) {
            var dc = D && D.c[c];
            return { c: c, py: (sy && sy[i]) || (dc && dc[0]) || "", hv: hvs[i] || (dc && dc[1]) || "" };
        }).filter(function (x) { return x.py && x.hv; });
    }
    // Khối "🔤 Hán Việt → pinyin" cho mặt sau thẻ: mỗi chữ một dòng, quy tắc khớp thì ✓, không khớp thì ⚠ ngoại lệ
    function readingHTML(hz, py, hv) {
        if (!settings().rules) return "";
        injectCSS();
        var rows = charRows(hz, py, hv);
        if (!rows.length) return "";
        var nWarn = 0;
        var body = rows.map(function (x) {
            var r = checkChar(x.hv, x.py);
            if (!r) return "";
            var okBits = [], warn = [];
            [r.init, r.fin, r.tone].forEach(function (k) {
                if (!k || !k.txt) return;
                if (k.ok === false) warn.push(k.txt); else if (k.ok) okBits.push(k.txt); else warn.push(k.txt);
            });
            var bad = [r.init, r.fin, r.tone].some(function (k) { return k && k.ok === false; });
            if (bad) nWarn++;
            return '<div class="hv-rd' + (bad ? " bad" : "") + '"><span class="c" data-hv-write="' + esc(x.c) + '" title="Nét viết · họ chữ cùng bộ âm">' + esc(x.c) + "</span>" +
                '<span class="m"><b>' + esc(String(x.hv).toUpperCase()) + '</b> → <b style="color:' + toneColor(x.py) + '">' + esc(x.py) + "</b></span>" +
                '<span class="r">' + (okBits.length ? '<span class="ok">✓ ' + esc(okBits.join(" · ")) + "</span>" : "") +
                warn.map(function (w) { return '<span class="' + (r.enter && w.indexOf("nhớ riêng") >= 0 ? "nt" : "wn") + '">' + (w.indexOf("nhớ riêng") >= 0 ? "• " : "⚠ ") + esc(w) + "</span>"; }).join("") + "</span></div>";
        }).join("");
        if (!body) return "";
        var pairs = rows.map(function (x) { return esc(String(x.hv).toUpperCase()) + ' → <b style="color:' + toneColor(x.py) + '">' + esc(x.py) + "</b>"; }).join(" · ");
        return '<details class="hv-read"' + (nWarn ? " open" : "") + '><summary>🔤 ' + pairs + (nWarn ? ' <em>· ⚠ ' + nWarn + " chữ ngoại lệ</em>" : " <small>· ✓ đúng quy tắc</small>") + "</summary>" + body + "</details>";
    }

    // ================================================================ (B) Họ chữ cùng bộ âm (hình thanh)
    var phoIndex = null, wordFreq = {};
    function buildPhoIndex() {
        if (phoIndex || !window.HOC_PARTS) return;
        phoIndex = {};
        var C = HOC_PARTS.c;
        Object.keys(C).forEach(function (x) { var p = C[x][1] === "p" && C[x][3]; if (p) (phoIndex[p] = phoIndex[p] || []).push(x); });
    }
    function freq(c) {      // số từ trong từ điển có chữ này: ước lượng độ thông dụng
        if (wordFreq[c] != null) return wordFreq[c];
        var D = window.HOC_DICT, n = 0;
        if (D) for (var w in D.w) if (w.indexOf(c) >= 0) n++;
        return (wordFreq[c] = n);
    }
    function familyHTML(ch) {
        buildPhoIndex();
        var P = window.HOC_PARTS, D = window.HOC_DICT;
        if (!phoIndex || !D) return "";
        var e = P.c[ch];
        var keys = [];
        if (e && e[1] === "p" && e[3]) keys.push(e[3]);                     // họ của bộ âm trong chữ này
        if (phoIndex[ch] && phoIndex[ch].length >= 2) keys.push(ch);          // chữ này làm bộ âm cho chữ khác
        var h = "";
        keys.forEach(function (key) {
            var mem = (phoIndex[key] || []).slice();
            if (D.c[key] && mem.indexOf(key) < 0) mem.unshift(key);
            mem = mem.filter(function (x) { return D.c[x] && D.c[x][0]; });
            if (mem.length < 2) return;
            mem.sort(function (a, b) { return (a === key ? -1 : b === key ? 1 : 0) || freq(b) - freq(a); });
            var more = mem.length - 16;
            mem = mem.slice(0, 16);
            // vần chung nhiều nhất trong họ
            var cnt = {};
            mem.forEach(function (x) { var f = pyPlain(D.c[x][0]).replace(/^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])/, ""); cnt[f] = (cnt[f] || 0) + 1; });
            var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
            var kinfo = P.p[key] || [];
            h += '<div class="hv-fam-h">👪 Họ bộ âm <b>' + esc(key) + "</b>" + (kinfo[0] ? " (" + esc(kinfo[0]) + ")" : "") +
                (cnt[top] >= 2 ? " · " + cnt[top] + "/" + mem.length + " chữ có vần <b>-" + esc(top) + "</b>" : "") + "</div>" +
                '<div class="hv-fam">' + mem.map(function (x) {
                    var py = D.c[x][0], hvx = D.c[x][1] || "";
                    return '<button type="button" class="hv-fc' + (x === ch ? " on" : "") + '" data-hv-write="' + esc(x) + '" title="' + esc(hvx) + '">' +
                        '<span class="z">' + esc(x) + '</span><span class="p" style="color:' + toneColor(py) + '">' + esc(py) + '</span><span class="v">' + esc(String(hvx).toUpperCase()) + "</span></button>";
                }).join("") + (more > 0 ? '<span class="hv-more">+' + more + "</span>" : "") + "</div>";
        });
        return h ? '<div class="hv-famwrap">' + h + '<div class="hv-msg" style="text-align:left;max-width:none">Cùng bộ âm thường cùng vần pinyin, chỉ khác phụ âm đầu hoặc thanh. Chạm một chữ để xem chữ đó.</div></div>' : "";
    }

    var TYPES = {
        p: ["形声 · Hình thanh", "một bộ chỉ nghĩa + một bộ gợi cách đọc"],
        i: ["会意 · Hội ý", "ghép nghĩa các bộ phận lại"],
        g: ["象形 · Tượng hình", "vẽ lại hình dáng sự vật"]
    };
    function renderInfo(ch) {
        var box = document.getElementById("hv-info"); if (!box) return;
        var D = window.HOC_DICT, P = window.HOC_PARTS;
        if (!P) { box.innerHTML = '<p class="hv-msg">Đang tải dữ liệu tách bộ…</p>'; return; }
        var c = (D && D.c[ch]) || [], sw = D && D.w[ch];
        var hv = c[1] || (sw && sw[1]) || "", py = c[0] || (sw && sw[0]) || "";
        var mean = sw && sw[2] ? String(sw[2]) : "";
        var e = P.c[ch];
        var h = '<div class="hv-big"><span class="hv-hvn">' + esc(String(hv).toUpperCase()) + '</span><span class="py" style="color:' + toneColor(py) + '">' + esc(py) + "</span></div>" +
            (mean ? '<div class="hv-mean">' + esc(mean.length > 90 ? mean.slice(0, 90) + "…" : mean) + "</div>" : '<div class="hv-mean"></div>');
        var rule = hv && py ? checkChar(hv, py) : null;
        if (rule) {
            var bits = [rule.init, rule.fin, rule.tone].filter(function (k) { return k && k.txt; });
            h += '<div class="hv-rule">' + bits.map(function (k) {
                return '<span class="' + (k.ok === false ? "wn" : k.ok ? "ok" : "nt") + '">' + (k.ok === false ? "⚠ " : k.ok ? "✓ " : "• ") + esc(k.txt) + "</span>";
            }).join("") + "</div>";
        }
        if (e) {
            var parts = Array.from(e[0] || ""), type = e[1], sem = e[2], pho = e[3];
            if (TYPES[type]) h += '<div class="hv-type" title="' + esc(TYPES[type][1]) + '">' + TYPES[type][0] + " — " + TYPES[type][1] + "</div>";
            else if (parts.length) h += '<div class="hv-type">Cấu tạo</div>';
            var list = parts.slice();
            [sem, pho].forEach(function (x) { if (x && list.indexOf(x) < 0) list.push(x); });
            list.forEach(function (x) {
                var info = P.p[x] || [];
                var role = type === "p" ? (x === sem ? '<span class="hv-role sem">bộ nghĩa</span>' : x === pho ? '<span class="hv-role pho">bộ âm</span>' : "") : "";
                h += '<div class="hv-part"><span class="pc"' + (HAN.test(x) ? ' data-zizu="' + esc(x) + '" title="Họ chữ"' : "") + ">" + esc(x) + "</span>" +
                    '<span class="pt"><b>' + esc(info[0] || "") + "</b>" + (info[1] ? "<small>" + esc(info[1]) + "</small>" : "") + "</span>" + role + "</div>";
            });
            if (type === "p" && pho) {
                var phv = (P.p[pho] || [])[0] || "";
                if (phv && hv) {
                    var HV = String(hv).toUpperCase(), PH = String(phv).toUpperCase();
                    var how = PH === HV ? "đọc giống hệt — nhớ bộ âm là biết luôn âm Hán Việt."
                        : norm(PH) === norm(HV) ? "chỉ khác dấu thanh — nhớ bộ âm là đoán gần đúng âm Hán Việt."
                        : rhyme(PH) === rhyme(HV) ? "cùng vần, dễ đoán."
                        : "âm đã đổi khác, nhưng bộ âm vẫn giúp nhận ra chữ.";
                    h += '<div class="hv-tip">💡 Bộ âm <b>' + esc(pho) + "</b> đọc " + esc(PH) + " → chữ <b>" + esc(ch) + "</b> đọc " + esc(HV) + ": " + how + "</div>";
                }
            }
            if (e[4]) h += '<div class="hv-tip">💡 <i>Gợi ý (tiếng Anh):</i> ' + esc(e[4]) + "</div>";
        } else h += '<p class="hv-msg" style="text-align:left">Chưa có dữ liệu tách bộ cho chữ này.</p>';
        if (window.HocNotes && HocNotes.get(ch)) h += '<div class="hv-tip">📝 ' + esc(HocNotes.get(ch)) + "</div>";
        h += familyHTML(ch);
        box.innerHTML = h;
    }
    function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d"); }
    function rhyme(s) { return norm(s).replace(/^(ngh|ng|nh|ch|gh|gi|kh|ph|th|tr|qu|[bcdghklmnpqrstvx])/, ""); }

    document.addEventListener("click", function (e) {
        var t = e.target.closest && e.target.closest("[data-hv-write]");
        if (t) { e.preventDefault(); e.stopPropagation(); write(t.getAttribute("data-hv-write")); return; }
        if (e.target.closest && e.target.closest("[data-hv-img]")) e.stopPropagation();   // mở link, nhưng không lật thẻ
    }, true);
    // Khung Nét viết đang mở thì phím tắt của trang (Space lật thẻ, 1–4 chấm điểm…) không chạy.
    // Bảng Họ chữ (zizu.js) mở chồng lên trên thì để bảng đó xử lý trước.
    window.addEventListener("keydown", function (e) {
        if (!document.getElementById("hv-ov") || document.getElementById("zz-ov")) return;
        e.stopPropagation();
        if (e.key === "Escape") { e.preventDefault(); close(); }
    }, true);
    window.HocVisual = { emoji: emoji, barHTML: barHTML, readingHTML: readingHTML, checkChar: checkChar, splitPinyin: splitPinyin,
        write: write, close: close, settings: settings, set: set, imgUrl: imgUrl };
})();
