/* ==========================================================================
   SHARED/VISUAL.JS — hình ảnh hỗ trợ nhớ từ (HocVisual)
   Ba phần, dùng chung cho mọi trang:
     1. Emoji minh họa cho từ cụ thể / hành động / cảm xúc  (shared/emoji_map.js, viết tay)
     2. Nút "🖼️ Ảnh": mở Baidu (hoặc Google) Hình ảnh tìm đúng từ, ở tab mới
     3. Nút "✍️ Nét viết": khung xem thứ tự nét (thư viện Hanzi Writer, nạp từ CDN khi cần — cần mạng),
        tự viết thử, và tách bộ chữ Hán (shared/hanzi_parts.js, sinh bởi tools/build_visual.py):
        hình thanh (bộ nghĩa + bộ âm) / hội ý / tượng hình, kèm âm Hán Việt + nghĩa của từng bộ phận.
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
    var DEF = { emoji: true, img: true, imgSrc: "baidu" };

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
            '<label>Tìm ảnh bằng <select data-set="imgSrc"><option value="baidu">Baidu</option><option value="google">Google</option></select></label>' +
            "</div></div>";
        document.body.appendChild(ov);
        var st = settings();
        ov.querySelector('[data-set="emoji"]').checked = st.emoji;
        ov.querySelector('[data-set="img"]').checked = st.img;
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
        var h = '<div class="hv-big"><span class="hv-hvn">' + esc(String(hv).toUpperCase()) + '</span><span class="py">' + esc(py) + "</span></div>" +
            (mean ? '<div class="hv-mean">' + esc(mean.length > 90 ? mean.slice(0, 90) + "…" : mean) + "</div>" : '<div class="hv-mean"></div>');
        if (!e) { box.innerHTML = h + '<p class="hv-msg" style="text-align:left">Chưa có dữ liệu tách bộ cho chữ này.</p>'; return; }
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
        if (window.HocNotes && HocNotes.get(ch)) h += '<div class="hv-tip">📝 ' + esc(HocNotes.get(ch)) + "</div>";
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
    window.HocVisual = { emoji: emoji, barHTML: barHTML, write: write, close: close, settings: settings, set: set, imgUrl: imgUrl };
})();
