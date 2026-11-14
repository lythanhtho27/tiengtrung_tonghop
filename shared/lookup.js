/* ==========================================================================
   SHARED/LOOKUP.JS — Tách từ, sinh pinyin và tra từ (chạm vào chữ) dùng chung
   Dựa trên từ điển shared/dict_vi.js (window.HOC_DICT, nạp lười):
     HOC_DICT = { m: độ dài từ dài nhất, w: { từ: [pinyin, HÁN VIỆT, nghĩa] }, c: { chữ: [pinyin, HÁN VIỆT] } }

   API (window.HocLookup):
     loadDict(url) -> Promise           nạp dict_vi.js một lần (url tương đối với trang, vd "../shared/dict_vi.js")
     ready()                            đã có từ điển chưa
     segment(text) -> [{ t, w }]        tách khớp dài nhất; w = true nếu là từ có trong từ điển
     pinyinOf(text) -> ["xué", …]       pinyin cho TỪNG CHỮ HÁN trong text (theo từ, không có thì theo chữ)
     splitPinyin(py, n) -> [..] | null  tách chuỗi pinyin của một từ thành đúng n âm tiết
     findWord(text, i) -> { start, end, word, alts }   từ dài nhất chứa chữ thứ i (chỉ số trong chuỗi text)
     info(word) -> { hz, py, hv, vi, chars: [{ c, py, hv }] }
     rubyHTML(text, pys?) -> HTML       mỗi chữ Hán thành <ruby class="lk-c" data-i="…">字<rt>py</rt></ruby>
     attach(container, opts)            bật chạm-để-tra trong container:
         mỗi đoạn là phần tử có thuộc tính data-lk-text="<văn bản thuần của đoạn>", bên trong các chữ là .lk-c[data-i]
         (data-i = chỉ số của chữ trong data-lk-text) — rubyHTML() tạo sẵn đúng dạng này.
         opts: { getSrc(): chuỗi nguồn khi thêm vào sổ, enabled(): bool, speak(text), onAdd(entry) }
     close()                            đóng khung tra
   ========================================================================== */
(function () {
    "use strict";
    var HAN = /[㐀-鿿]/;
    var loading = null;

    function D() { return window.HOC_DICT || null; }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

    function loadDict(url) {
        if (D()) return Promise.resolve(true);
        if (loading) return loading;
        loading = new Promise(function (resolve) {
            var s = document.createElement("script");
            s.src = url || "../shared/dict_vi.js";
            s.onload = function () { resolve(!!D()); };
            s.onerror = function () { loading = null; resolve(false); };
            document.head.appendChild(s);
        });
        return loading;
    }

    // ---------- Tách âm tiết pinyin ----------
    // Âm tiết = (thanh mẫu)? + vận mẫu; kiểm tra trên chuỗi đã bỏ dấu thanh (độ dài không đổi nên ánh xạ ngược được).
    var INITIAL = "(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?";
    var FINAL = "(?:iang|iong|uang|ang|eng|ing|ong|ian|iao|uai|uan|van|ue|ve|ai|ao|an|ei|en|er|ia|ie|in|iu|ou|ua|uo|ui|un|vn|a|o|e|i|u|v)";
    var SYL = new RegExp("^" + INITIAL + FINAL + "$");
    var TONES = { "ā": "a", "á": "a", "ǎ": "a", "à": "a", "ē": "e", "é": "e", "ě": "e", "è": "e", "ī": "i", "í": "i", "ǐ": "i", "ì": "i",
        "ō": "o", "ó": "o", "ǒ": "o", "ò": "o", "ū": "u", "ú": "u", "ǔ": "u", "ù": "u", "ǖ": "v", "ǘ": "v", "ǚ": "v", "ǜ": "v", "ü": "v" };
    function baseOf(s) { var o = ""; for (var i = 0; i < s.length; i++) { var c = s[i]; o += TONES[c] || c; } return o; }
    function isSyl(b) { return b === "r" || b === "m" || b === "n" || b === "ng" || SYL.test(b); }   // r: âm cuốn lưỡi của 儿; m/n/ng: thán từ

    function splitPinyin(py, n) {
        if (!py || !n) return null;
        var parts = String(py).toLowerCase().normalize("NFC").replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü'\s\-]/g, " ").split(/[\s'\-]+/).filter(Boolean);
        // tách từng cụm, ghép kết quả; số âm tiết các cụm cộng lại phải đúng n
        var memo = {};
        function splitChunk(ch) {
            if (memo[ch]) return memo[ch];
            var b = baseOf(ch), res = [];
            // mọi cách tách hợp lệ, ưu tiên âm tiết dài trước (tìm theo chiều sâu, giới hạn số kết quả)
            (function go(pos, acc) {
                if (res.length > 12) return;
                if (pos === b.length) { res.push(acc.slice()); return; }
                for (var len = Math.min(6, b.length - pos); len >= 1; len--) {
                    var piece = b.substr(pos, len);
                    if (!isSyl(piece)) continue;
                    // không để âm tiết sau bắt đầu bằng nguyên âm khi có thể dính vào trước (xi'an viết liền là hiếm)
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

    // ---------- Tách từ (khớp dài nhất, từ trái sang phải) ----------
    function segment(text) {
        var d = D(), out = [], i = 0, m = d ? d.m || 8 : 1;
        text = String(text || "");
        while (i < text.length) {
            if (!HAN.test(text[i])) {
                var j = i; while (j < text.length && !HAN.test(text[j])) j++;
                out.push({ t: text.slice(i, j), w: false }); i = j; continue;
            }
            var hit = null;
            if (d) for (var len = Math.min(m, text.length - i); len >= 2; len--) {
                var cand = text.substr(i, len);
                if (d.w[cand] && !/[^㐀-鿿]/.test(cand)) { hit = cand; break; }
            }
            if (hit) { out.push({ t: hit, w: true }); i += hit.length; }
            else { out.push({ t: text[i], w: !!(d && d.w[text[i]]) }); i++; }
        }
        return out;
    }
    function charPy(c) { var d = D(); return (d && d.c[c] && d.c[c][0]) || (d && d.w[c] && splitPinyin(d.w[c][0], 1) || [""])[0] || ""; }
    function pinyinOf(text) {
        var d = D(), out = [];
        segment(text).forEach(function (s) {
            var hans = s.t.split("").filter(function (c) { return HAN.test(c); });
            if (!hans.length) return;
            var sp = s.w && d && d.w[s.t] ? splitPinyin(d.w[s.t][0], hans.length) : null;
            hans.forEach(function (c, k) { out.push(sp ? sp[k] : charPy(c)); });
        });
        return out;
    }
    function rubyHTML(text, pys) {
        text = String(text || "");
        pys = pys || pinyinOf(text);
        var k = 0, h = "";
        for (var i = 0; i < text.length; i++) {
            var c = text[i];
            if (HAN.test(c)) h += '<ruby class="lk-c" data-i="' + i + '">' + c + "<rt>" + esc(pys[k++] || "") + "</rt></ruby>";
            else h += esc(c);
        }
        return h;
    }

    // ---------- Tra một vị trí ----------
    function findWord(text, i) {
        var d = D(), m = d ? d.m || 8 : 1, alts = [], best = null;
        for (var s = Math.max(0, i - m + 1); s <= i; s++) {
            for (var e = i + 1; e <= Math.min(text.length, s + m); e++) {
                var w = text.slice(s, e);
                if (/[^㐀-鿿]/.test(w)) break;
                if (w.length > 1 && d && d.w[w]) {
                    alts.push({ start: s, end: e, word: w });
                    if (!best || w.length > best.word.length) best = { start: s, end: e, word: w };
                }
            }
        }
        var single = { start: i, end: i + 1, word: text[i] };
        alts.sort(function (a, b) { return b.word.length - a.word.length || a.start - b.start; });
        alts.push(single);
        best = best || single;
        return { start: best.start, end: best.end, word: best.word, alts: alts };
    }
    function info(word) {
        var d = D() || { w: {}, c: {} }, e = d.w[word];
        var chars = word.split("").map(function (c) { var x = d.c[c]; return { c: c, py: x ? x[0] : "", hv: x ? x[1] : "" }; });
        var sp = e ? splitPinyin(e[0], word.length) : null;
        if (sp) chars.forEach(function (x, k) { x.py = sp[k]; });
        var py = e ? (sp ? sp.join("") : e[0]) : chars.map(function (x) { return x.py; }).join("");
        var hv = e && e[1] ? e[1] : (chars.every(function (x) { return x.hv; }) ? chars.map(function (x) { return x.hv; }).join(" ") : "");
        return { hz: word, py: py, hv: hv, vi: e ? e[2] : "", chars: chars, found: !!e };
    }
    function sentenceAround(text, s, e) {
        var a = s, b = e;
        while (a > 0 && !/[。！？!?\n]/.test(text[a - 1])) a--;
        while (b < text.length && !/[。！？!?\n]/.test(text[b])) b++;
        if (b < text.length) b++;
        while (b < text.length && /[”’」』）)]/.test(text[b])) b++;
        return text.slice(a, b).trim();
    }

    // ---------- Khung tra ----------
    var CSS = "" +
        ".lk-c{cursor:pointer;border-radius:4px}" +
        ".lk-c.lk-hl{background:var(--ui-highlight,rgba(251,191,36,.3))}" +
        ".lk-pop{position:fixed;z-index:9000;width:min(360px,calc(100vw - 24px));background:var(--ui-surface,#fff);color:var(--ui-text,#0f172a);border:1px solid var(--ui-border-strong,#ccc);border-radius:16px;box-shadow:var(--ui-shadow-lg);padding:14px 16px;font-family:var(--ui-font-sans,system-ui,sans-serif);font-size:14.5px;line-height:1.5}" +
        ".lk-pop[hidden]{display:none}" +
        ".lk-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding-right:28px}" +
        ".lk-hz{font-family:var(--ui-font-cn,serif);font-size:30px;font-weight:700;line-height:1.2}" +
        ".lk-py{color:var(--ui-pinyin,#0369a1);font-size:17px;font-weight:600}" +
        ".lk-hv{font-weight:700;font-size:13px;letter-spacing:.03em;color:var(--ui-text-2,#334155);margin-top:4px}" +
        ".lk-vi{margin-top:4px}.lk-none{color:var(--ui-muted,#64748b);font-style:italic}" +
        ".lk-chars{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}" +
        ".lk-ch{border:1px solid var(--ui-border,#ddd);border-radius:10px;padding:4px 8px;text-align:center;min-width:52px}" +
        ".lk-ch b{display:block;font-family:var(--ui-font-cn,serif);font-size:20px}.lk-ch span{display:block;font-size:12px;color:var(--ui-pinyin,#0369a1)}.lk-ch i{display:block;font-style:normal;font-size:11px;font-weight:700;color:var(--ui-muted,#64748b)}" +
        ".lk-alts{margin-top:10px;font-size:13px;color:var(--ui-muted,#64748b);display:flex;gap:6px;flex-wrap:wrap;align-items:center}" +
        ".lk-alts button{font-family:var(--ui-font-cn,serif);font-size:15px;border:1px solid var(--ui-border-strong,#ccc);background:var(--ui-surface-2,#f1f5f9);color:inherit;border-radius:8px;padding:1px 8px;cursor:pointer}" +
        ".lk-alts button.on{background:var(--ui-primary,#4f46e5);color:var(--ui-on-primary,#fff);border-color:transparent}" +
        ".lk-act{display:flex;gap:8px;margin-top:12px}" +
        ".lk-act button{flex:1;border:1px solid var(--ui-border-strong,#ccc);background:var(--ui-surface,#fff);color:inherit;border-radius:10px;padding:9px 10px;font:inherit;font-weight:600;cursor:pointer}" +
        ".lk-act .lk-add{background:var(--ui-primary,#4f46e5);color:var(--ui-on-primary,#fff);border-color:transparent}" +
        ".lk-act .lk-add.in{background:var(--ui-success-soft,rgba(5,150,105,.12));color:var(--ui-success,#047857);border-color:var(--ui-success,#047857)}" +
        ".lk-x{position:absolute;top:8px;right:10px;border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:var(--ui-muted,#64748b)}" +
        "@media (max-width:720px){.lk-pop{left:0!important;right:0;bottom:0;top:auto!important;width:auto;border-radius:18px 18px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));animation:lk-up .2s ease}}" +
        "@keyframes lk-up{from{transform:translateY(100%)}to{transform:none}}";
    var pop = null, cur = null;

    function ensurePop() {
        if (pop) return pop;
        if (!document.getElementById("lk-css")) { var st = document.createElement("style"); st.id = "lk-css"; st.textContent = CSS; document.head.appendChild(st); }
        pop = document.createElement("div");
        pop.className = "lk-pop"; pop.hidden = true;
        pop.setAttribute("role", "dialog");
        document.body.appendChild(pop);
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
        document.addEventListener("click", function (e) {
            if (!pop.hidden && !pop.contains(e.target) && !(e.target.closest && e.target.closest(".lk-c"))) close();
        });
        window.addEventListener("resize", function () { if (cur) place(); });
        return pop;
    }
    function clearHl() { document.querySelectorAll(".lk-c.lk-hl").forEach(function (el) { el.classList.remove("lk-hl"); }); }
    function close() { if (pop) pop.hidden = true; clearHl(); cur = null; }
    function place() {
        if (!cur || window.matchMedia("(max-width: 720px)").matches) return;
        var r = cur.anchor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
        var left = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 12);
        var top = r.bottom + 8;
        if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 8);
        pop.style.left = left + "px"; pop.style.top = top + "px";
    }
    function speakDefault(t) {
        if (!("speechSynthesis" in window)) return;
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(t); u.lang = "zh-CN"; u.rate = 0.85;
        var v = speechSynthesis.getVoices().filter(function (x) { return /zh[-_]CN/i.test(x.lang); })[0]; if (v) u.voice = v;
        speechSynthesis.speak(u);
    }
    function render() {
        var c = cur, I = info(c.word), opts = c.opts;
        var inBook = window.HocMyWords && HocMyWords.has(I.hz);
        pop.innerHTML = '<button class="lk-x" aria-label="Đóng">×</button>' +
            '<div class="lk-head"><span class="lk-hz">' + esc(I.hz) + '</span><span class="lk-py">' + esc(I.py) + "</span></div>" +
            (I.hv ? '<div class="lk-hv">' + esc(I.hv) + "</div>" : "") +
            '<div class="lk-vi">' + (I.vi ? esc(I.vi) : '<span class="lk-none">' + (D() ? "Chưa có nghĩa trong từ điển." : "Đang tải từ điển…") + "</span>") + "</div>" +
            (I.hz.length > 1 ? '<div class="lk-chars">' + I.chars.map(function (x) { return '<div class="lk-ch"><b>' + esc(x.c) + "</b><span>" + esc(x.py) + "</span><i>" + esc(x.hv) + "</i></div>"; }).join("") + "</div>" : "") +
            (c.alts.length > 1 ? '<div class="lk-alts">Cách tách khác: ' + c.alts.map(function (a, k) { return '<button data-k="' + k + '" class="' + (a.word === c.word && a.start === c.start ? "on" : "") + '">' + esc(a.word) + "</button>"; }).join("") + "</div>" : "") +
            '<div class="lk-act"><button class="lk-say">🔊 Nghe</button>' +
            (window.HocMyWords ? '<button class="lk-add' + (inBook ? " in" : "") + '">' + (inBook ? "✓ Đã trong sổ" : "＋ Từ của tôi") + "</button>" : "") + "</div>";
        pop.querySelector(".lk-x").onclick = close;
        pop.querySelector(".lk-say").onclick = function () { (opts.speak || speakDefault)(I.hz); };
        pop.querySelectorAll(".lk-alts button").forEach(function (b) {
            b.onclick = function (ev) { ev.stopPropagation(); var a = c.alts[+b.dataset.k]; show(c.para, a.start, a.end, c.alts, c.opts); };
        });
        var add = pop.querySelector(".lk-add");
        if (add) add.onclick = function () {
            if (HocMyWords.has(I.hz)) { HocMyWords.remove(I.hz); render(); return; }
            var entry = HocMyWords.add({ hz: I.hz, py: I.py, hv: I.hv, vi: I.vi, ex: sentenceAround(c.text, c.start, c.end), src: opts.getSrc ? opts.getSrc() : "" });
            if (opts.onAdd) opts.onAdd(entry);
            render();
        };
    }
    function show(para, start, end, alts, opts) {
        ensurePop();
        clearHl();
        var text = para.getAttribute("data-lk-text") || "";
        var anchor = null;
        for (var i = start; i < end; i++) {
            var el = para.querySelector('.lk-c[data-i="' + i + '"]');
            if (el) { el.classList.add("lk-hl"); if (!anchor) anchor = el; }
        }
        cur = { para: para, text: text, start: start, end: end, word: text.slice(start, end), alts: alts, opts: opts, anchor: anchor || para };
        pop.hidden = false;
        render();
        place();
        if (window.matchMedia("(max-width: 720px)").matches && anchor) {
            var r = anchor.getBoundingClientRect(), top = window.innerHeight - pop.offsetHeight;
            if (r.bottom > top - 8) window.scrollBy({ top: r.bottom - top + 24, behavior: "smooth" });
        }
    }
    function attach(container, opts) {
        opts = opts || {};
        container.addEventListener("click", function (e) {
            var c = e.target.closest && e.target.closest(".lk-c");
            if (!c || !container.contains(c)) return;
            if (opts.enabled && !opts.enabled()) return;
            var para = c.closest("[data-lk-text]");
            if (!para) return;
            var i = +c.getAttribute("data-i"), text = para.getAttribute("data-lk-text") || "";
            if (cur && cur.para === para && i >= cur.start && i < cur.end && !pop.hidden) { close(); return; }
            var r = findWord(text, i);
            show(para, r.start, r.end, r.alts, opts);
            if (!D() && opts.dictUrl) loadDict(opts.dictUrl).then(function () { if (cur && cur.para === para) { var r2 = findWord(text, i); show(para, r2.start, r2.end, r2.alts, opts); } });
        });
        if (opts.dictUrl) loadDict(opts.dictUrl);
    }

    window.HocLookup = {
        loadDict: loadDict, ready: function () { return !!D(); },
        segment: segment, pinyinOf: pinyinOf, splitPinyin: splitPinyin, findWord: findWord, info: info,
        rubyHTML: rubyHTML, sentenceAround: sentenceAround, attach: attach, close: close
    };
})();
