/* ==========================================================================
   SHARED/TTS.JS — Giọng đọc dùng chung cho cả web (Web Speech API)
   - Nạp ĐỒNG BỘ trong <head> (sau theme.js/sync.js), TRƯỚC script của trang.
   - Bọc speechSynthesis.speak(): mọi câu tiếng Trung mà các trang đọc đều tự dùng giọng người học đã chọn
     (hoặc luân phiên nhiều giọng), nhân thêm tốc độ/cao độ chung — các trang KHÔNG cần sửa gì.
   - Cài đặt lưu theo từng thiết bị ở localStorage "hoc_tts_v1" (không đồng bộ: mỗi máy có bộ giọng khác nhau):
       { voice: "<tên giọng>" | "", rate: 1, pitch: 1, rotate: false, rotateSet: [tên…], others: false,
         roles: { narrator: "", a: "", b: "" } }
   - Phần tử có [data-hoc-voice] tự thành nút mở hộp chọn giọng.
   - API (window.HocTTS):
       voices()                       giọng tiếng Trung có trên máy (phổ thông; thêm Quảng Đông/Đài Loan nếu bật "others")
       settings() / set(patch)        đọc / ghi cài đặt
       speak(text, { voice, rate, pitch, onend })   đọc một câu (rate là tốc độ gốc của trang, sẽ nhân với rate chung)
       stop()
       dialogueSegments(paragraphs)   tách lời dẫn / lời thoại (trong “…” 「…」) và gán vai: [{ p, text, role }]
       readDialogue(paragraphs, { rate, onPara(i), onEnd, onStop })  đọc nhập vai: người dẫn + 2 vai luân phiên; trả về { stop() }
                                      (onEnd: đọc hết bài; onStop: bị speechSynthesis.cancel() từ chỗ khác cắt ngang)
       open()                         mở hộp chọn giọng
       gender(voice) -> "f" | "m" | ""
   ========================================================================== */
(function () {
    "use strict";
    if (!("speechSynthesis" in window)) {
        window.HocTTS = { voices: function () { return []; }, settings: function () { return {}; }, set: function () {}, speak: function () {},
            stop: function () {}, dialogueSegments: function () { return []; }, readDialogue: function () { return { stop: function () {} }; },
            open: function () { alert("Trình duyệt này không hỗ trợ đọc văn bản."); }, gender: function () { return ""; } };
        return;
    }
    var KEY = "hoc_tts_v1";
    var DEF = { voice: "", rate: 1, pitch: 1, rotate: false, rotateSet: [], others: false, roles: { narrator: "", a: "", b: "" } };
    var S = load();
    var synth = window.speechSynthesis;
    var rawSpeak = synth.speak.bind(synth);
    var rotIdx = 0;
    var listeners = [];

    function load() {
        try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v) { v.roles = Object.assign({}, DEF.roles, v.roles || {}); return Object.assign({}, DEF, v); } } catch (e) {}
        return JSON.parse(JSON.stringify(DEF));
    }
    function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} listeners.forEach(function (f) { try { f(S); } catch (e) {} }); }

    // ---------- Danh sách giọng ----------
    var FEMALE = /xiaoxiao|xiaoyi|xiaochen|xiaohan|xiaomo|xiaoqiu|xiaorui|xiaoshuang|xiaoxuan|xiaoyan|xiaoyou|xiaozhen|xiaomeng|xiaobei|xiaoni|huihui|yaoyao|tingting|lili|meijia|sinji|hiugaai|hsiaochen|hsiaoyu|yating|hanhan|female|女/i;
    var MALE = /yunxi|yunjian|yunyang|yunfeng|yunhao|yunze|yunye|yunxia|yunjie|kangkang|wanlung|zhiwei|yunzhe|male|男/i;
    function gender(v) { var n = (v && (v.name || v)) || ""; return FEMALE.test(n) ? "f" : MALE.test(n) ? "m" : ""; }
    function isMandarin(v) {
        var l = (v.lang || "").toLowerCase().replace("_", "-");
        if (/^(zh-cn|zh-hans|cmn)/.test(l)) return true;
        if (l === "zh" ) return true;
        return false;
    }
    function voices() {
        var all = synth.getVoices().filter(function (v) { return /^(zh|cmn|yue)/i.test(v.lang || ""); });
        var list = all.filter(function (v) { return S.others || isMandarin(v); });
        // giọng "Natural"/"Online" (Edge) lên đầu
        list.sort(function (a, b) {
            var na = /natural|online|neural/i.test(a.name) ? 0 : 1, nb = /natural|online|neural/i.test(b.name) ? 0 : 1;
            return na - nb || (isMandarin(a) ? 0 : 1) - (isMandarin(b) ? 0 : 1) || a.name.localeCompare(b.name);
        });
        return list;
    }
    function byName(name) { if (!name) return null; var vs = voices(); for (var i = 0; i < vs.length; i++) if (vs[i].name === name) return vs[i]; return null; }
    function defaultVoice() { return byName(S.voice) || voices()[0] || null; }
    function rotationVoices() {
        var vs = voices();
        var set = (S.rotateSet || []).map(byName).filter(Boolean);
        return set.length >= 2 ? set : vs;
    }
    function pickVoice() {
        if (S.rotate) { var r = rotationVoices(); if (r.length) return r[(rotIdx++) % r.length]; }
        return defaultVoice();
    }

    // ---------- Bọc speechSynthesis.speak ----------
    var HAN = /[㐀-鿿]/;
    synth.speak = function (u) {
        try {
            if (u && !u.__hocManaged && (/^zh|^cmn/i.test(u.lang || "") || HAN.test(u.text || ""))) {
                var v = pickVoice();
                if (v) { u.voice = v; u.lang = v.lang; }
                u.rate = clamp((u.rate || 1) * (S.rate || 1), 0.3, 2.5);
                u.pitch = clamp((u.pitch || 1) * (S.pitch || 1), 0.5, 1.8);
            }
        } catch (e) {}
        return rawSpeak(u);
    };
    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

    function speak(text, o) {
        o = o || {};
        if (!text) return null;
        var u = new SpeechSynthesisUtterance(text);
        u.__hocManaged = true;
        var v = o.voice ? (typeof o.voice === "string" ? byName(o.voice) : o.voice) : pickVoice();
        u.lang = (v && v.lang) || "zh-CN";
        if (v) u.voice = v;
        u.rate = clamp((o.rate || 0.9) * (S.rate || 1), 0.3, 2.5);
        u.pitch = clamp((o.pitch || 1) * (S.pitch || 1), 0.5, 1.8);
        if (o.onend) { u.onend = o.onend; u.onerror = o.onend; }
        rawSpeak(u);
        return u;
    }
    function stop() { synth.cancel(); }

    // ---------- Đọc nhập vai ----------
    // Tách mỗi đoạn thành lời dẫn và lời thoại (trong “…”, 「…」, 『…』, "…").
    // Gán vai: đoạn có lời thoại mới → đổi người nói (A ↔ B); các câu thoại trong cùng đoạn giữ cùng người nói.
    var QUOTE = /(“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*")/g;
    function dialogueSegments(paragraphs) {
        var out = [], speaker = "b";
        (paragraphs || []).forEach(function (para, p) {
            var text = String(para || "");
            var parts = text.split(QUOTE).filter(function (x) { return x && x.trim(); });
            var hasQuote = parts.some(function (x) { return /^[“「『"]/.test(x) && HAN.test(x); });
            if (hasQuote) speaker = speaker === "a" ? "b" : "a";   // mỗi đoạn có lời thoại mới: đổi người nói
            parts.forEach(function (x) {
                var q = /^[“「『"]/.test(x);
                var clean = x.replace(/^[“「『"]|[”」』"]$/g, "");
                if (!HAN.test(clean)) return;
                out.push({ p: p, text: clean, role: q ? speaker : "narrator" });
            });
        });
        return out;
    }
    function roleVoice(role) {
        var name = S.roles && S.roles[role];
        var v = byName(name);
        if (v) return v;
        var vs = voices();
        if (!vs.length) return null;
        var f = vs.filter(function (x) { return gender(x) === "f"; }), m = vs.filter(function (x) { return gender(x) === "m"; });
        var nar = byName(S.voice) || vs[0];
        if (role === "narrator") return nar;
        if (role === "a") return (m.filter(function (x) { return x !== nar; })[0]) || m[0] || vs.filter(function (x) { return x !== nar; })[0] || nar;
        // vai B: khác vai A và (nếu được) khác người dẫn
        var a = roleVoice("a");
        return (f.filter(function (x) { return x !== nar && x !== a; })[0]) || f.filter(function (x) { return x !== a; })[0] ||
               vs.filter(function (x) { return x !== a && x !== nar; })[0] || vs.filter(function (x) { return x !== a; })[0] || nar;
    }
    function readDialogue(paragraphs, o) {
        o = o || {};
        var segs = dialogueSegments(paragraphs), i = 0, stopped = false, lastP = -1;
        stop();
        function next() {
            if (stopped) return;
            if (i >= segs.length) { if (o.onEnd) o.onEnd(); return; }
            var s = segs[i++];
            if (s.p !== lastP) { lastP = s.p; if (o.onPara) o.onPara(s.p, s); }
            if (o.onSeg) o.onSeg(s, i - 1);
            // tách câu dài để không bị trình duyệt cắt giữa chừng
            var chunks = s.text.match(/[^。！？；!?;]+[。！？；!?;]*[”’」』]?/g) || [s.text];
            var k = 0;
            (function say() {
                if (stopped) return;
                if (k >= chunks.length) { next(); return; }
                var text = chunks[k++], done = false, rate = o.rate || 0.9;
                var u = speak(text, { voice: roleVoice(s.role), rate: rate });
                if (!u) { say(); return; }
                // hẹn giờ dự phòng: một số trình duyệt không phát onend (câu dài, tab nền…)
                var guard = setTimeout(function () { finishChunk(); }, Math.max(4000, text.length * 420 / (rate * (S.rate || 1))) + 2500);
                function finishChunk() { if (done) return; done = true; clearTimeout(guard); say(); }
                u.onend = finishChunk;
                u.onerror = function (ev) {
                    clearTimeout(guard);
                    // bị hủy từ chỗ khác (speechSynthesis.cancel()) → dừng hẳn, không nhảy sang câu sau
                    if (ev && (ev.error === "interrupted" || ev.error === "canceled")) {
                        done = true;
                        if (!stopped) { stopped = true; if (o.onStop) o.onStop(); }   // onEnd chỉ gọi khi đọc hết bài
                        return;
                    }
                    finishChunk();
                };
            })();
        }
        next();
        return { stop: function () { stopped = true; stop(); }, segments: segs };
    }

    // ---------- Hộp chọn giọng ----------
    var CSS = "" +
        ".tts-ov{position:fixed;inset:0;background:var(--ui-overlay,rgba(15,23,42,.45));display:flex;align-items:center;justify-content:center;z-index:99990;padding:12px}" +
        ".tts-box{background:var(--ui-surface,#fff);color:var(--ui-text,#0f172a);border:1px solid var(--ui-border,#ddd);border-radius:16px;box-shadow:var(--ui-shadow-lg);width:100%;max-width:460px;max-height:calc(100vh - 24px);overflow:auto;padding:18px;font:14.5px/1.5 var(--ui-font-sans,system-ui,sans-serif)}" +
        ".tts-box h3{margin:0 0 4px;font-size:18px}.tts-box h4{margin:16px 0 6px;font-size:14px}.tts-box p{margin:0 0 8px;color:var(--ui-muted,#64748b);font-size:13px}" +
        ".tts-x{float:right;border:0;background:none;font-size:22px;cursor:pointer;color:var(--ui-muted,#64748b)}" +
        ".tts-v{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--ui-border,#ddd);border-radius:10px;margin-bottom:6px;cursor:pointer}" +
        ".tts-v.on{border-color:var(--ui-primary,#4f46e5);background:var(--ui-primary-soft,rgba(79,70,229,.1))}" +
        ".tts-v input{accent-color:var(--ui-primary,#4f46e5)}.tts-v .nm{flex:1;min-width:0}.tts-v .nm b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tts-v .nm small{color:var(--ui-muted,#64748b)}" +
        ".tts-v button,.tts-btn{border:1px solid var(--ui-border-strong,#ccc);background:var(--ui-surface,#fff);color:inherit;border-radius:8px;padding:5px 10px;cursor:pointer;font:inherit;font-size:13px}" +
        ".tts-row{display:flex;align-items:center;gap:10px;margin:6px 0}.tts-row label{min-width:78px;font-weight:600;font-size:13.5px}.tts-row input[type=range]{flex:1;accent-color:var(--ui-primary,#4f46e5)}" +
        ".tts-row select{flex:1;min-width:0;padding:6px 8px;border-radius:8px;border:1px solid var(--ui-border-strong,#ccc);background:var(--ui-surface-2,#f1f5f9);color:inherit}" +
        ".tts-chk{display:flex;gap:8px;align-items:flex-start;margin:6px 0;font-size:13.5px;cursor:pointer}.tts-chk input{margin-top:3px;accent-color:var(--ui-primary,#4f46e5)}" +
        ".tts-tip{background:var(--ui-surface-2,#f1f5f9);border-radius:10px;padding:8px 10px;font-size:12.5px;color:var(--ui-text-2,#334155);margin-top:12px}" +
        ".tts-rot{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.tts-rot label{font-size:12.5px;border:1px solid var(--ui-border,#ddd);border-radius:99px;padding:2px 8px;cursor:pointer}" +
        "[data-hoc-voice]{cursor:pointer}";
    var SAMPLE = "你好，我是你的中文老师。今天我们一起学习汉语吧！";
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function label(v) {
        var g = gender(v), n = v.name.replace(/^Microsoft\s+/i, "").replace(/\s*-\s*Chinese.*$/i, "").replace(/\s*\(.*?\)\s*/g, " ").trim();
        return { name: n, sub: (g === "f" ? "Nữ" : g === "m" ? "Nam" : "Giọng") + " · " + v.lang + (/natural|online|neural/i.test(v.name) ? " · tự nhiên (cần mạng)" : v.localService ? " · trên máy" : "") };
    }
    function close() { var o = document.getElementById("tts-ov"); if (o) o.remove(); }
    function open() {
        if (!document.getElementById("tts-css")) { var st = document.createElement("style"); st.id = "tts-css"; st.textContent = CSS; document.head.appendChild(st); }
        close();
        var ov = document.createElement("div"); ov.className = "tts-ov"; ov.id = "tts-ov";
        ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
        document.body.appendChild(ov);
        render(ov);
    }
    function render(ov) {
        var vs = voices(), cur = defaultVoice();
        var opts = function (sel) { return '<option value="">Tự động</option>' + vs.map(function (v) { var l = label(v); return '<option value="' + esc(v.name) + '"' + (v.name === sel ? " selected" : "") + ">" + esc(l.name + " (" + l.sub.split(" · ")[0] + ")") + "</option>"; }).join(""); };
        ov.innerHTML = '<div class="tts-box" role="dialog" aria-modal="true"><button class="tts-x" aria-label="Đóng">×</button>' +
            "<h3>🔊 Giọng đọc</h3><p>Áp dụng cho mọi trang trên thiết bị này. Bấm ▶ để nghe thử.</p>" +
            (vs.length ? vs.map(function (v) { var l = label(v); return '<label class="tts-v' + (cur && v.name === cur.name ? " on" : "") + '"><input type="radio" name="tts-v" value="' + esc(v.name) + '"' + (cur && v.name === cur.name ? " checked" : "") + '><span class="nm"><b>' + esc(l.name) + "</b><small>" + esc(l.sub) + '</small></span><button type="button" data-try="' + esc(v.name) + '">▶</button></label>'; }).join("")
                : "<p><b>Chưa thấy giọng tiếng Trung nào trên máy.</b> Thử mở bằng Microsoft Edge, hoặc cài giọng tiếng Trung trong cài đặt hệ điều hành.</p>") +
            '<label class="tts-chk"><input type="checkbox" id="tts-others"' + (S.others ? " checked" : "") + "> Hiện cả giọng Quảng Đông / Đài Loan</label>" +
            "<h4>Tốc độ & cao độ</h4>" +
            '<div class="tts-row"><label>Tốc độ</label><input type="range" id="tts-rate" min="0.6" max="1.4" step="0.05" value="' + S.rate + '"><span id="tts-rate-v">×' + (+S.rate).toFixed(2) + "</span></div>" +
            '<div class="tts-row"><label>Cao độ</label><input type="range" id="tts-pitch" min="0.7" max="1.3" step="0.05" value="' + S.pitch + '"><span id="tts-pitch-v">×' + (+S.pitch).toFixed(2) + "</span></div>" +
            "<h4>Luân phiên giọng</h4>" +
            '<label class="tts-chk"><input type="checkbox" id="tts-rot"' + (S.rotate ? " checked" : "") + "> Mỗi lần đọc dùng một giọng khác (nam/nữ xen kẽ) — giúp tai quen nhiều giọng thật</label>" +
            (vs.length > 2 ? '<p>Chọn các giọng tham gia (bỏ trống = tất cả):</p><div class="tts-rot">' + vs.map(function (v) { return '<label><input type="checkbox" data-rot="' + esc(v.name) + '"' + ((S.rotateSet || []).indexOf(v.name) >= 0 ? " checked" : "") + "> " + esc(label(v).name) + "</label>"; }).join("") + "</div>" : "") +
            "<h4>Đọc nhập vai (bài khóa / bài đọc có hội thoại)</h4>" +
            '<div class="tts-row"><label>Người dẫn</label><select data-role="narrator">' + opts(S.roles.narrator) + "</select></div>" +
            '<div class="tts-row"><label>Vai 1</label><select data-role="a">' + opts(S.roles.a) + "</select></div>" +
            '<div class="tts-row"><label>Vai 2</label><select data-role="b">' + opts(S.roles.b) + '</select></div>' +
            '<div class="tts-row"><button class="tts-btn" id="tts-try-roles" type="button">▶ Nghe thử 3 vai</button></div>' +
            '<div class="tts-tip">💡 Giọng hay nhất: mở web bằng <b>Microsoft Edge</b> (máy tính hoặc Android) để có các giọng tự nhiên Xiaoxiao, Yunxi, Xiaoyi… iPhone: Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Trung để tải thêm giọng.</div></div>';
        ov.querySelector(".tts-x").onclick = close;
        ov.querySelectorAll('input[name="tts-v"]').forEach(function (r) { r.onchange = function () { S.voice = r.value; persist(); render(ov); speak(SAMPLE, { voice: r.value }); }; });
        ov.querySelectorAll("[data-try]").forEach(function (b) { b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); stop(); speak(SAMPLE, { voice: b.getAttribute("data-try") }); }; });
        ov.querySelector("#tts-others").onchange = function (e) { S.others = e.target.checked; persist(); render(ov); };
        var rate = ov.querySelector("#tts-rate"), pitch = ov.querySelector("#tts-pitch");
        rate.oninput = function () { S.rate = +rate.value; ov.querySelector("#tts-rate-v").textContent = "×" + S.rate.toFixed(2); };
        rate.onchange = function () { persist(); stop(); speak(SAMPLE); };
        pitch.oninput = function () { S.pitch = +pitch.value; ov.querySelector("#tts-pitch-v").textContent = "×" + S.pitch.toFixed(2); };
        pitch.onchange = function () { persist(); stop(); speak(SAMPLE); };
        ov.querySelector("#tts-rot").onchange = function (e) { S.rotate = e.target.checked; persist(); };
        ov.querySelectorAll("[data-rot]").forEach(function (c) { c.onchange = function () { S.rotateSet = Array.prototype.map.call(ov.querySelectorAll("[data-rot]:checked"), function (x) { return x.getAttribute("data-rot"); }); persist(); }; });
        ov.querySelectorAll("[data-role]").forEach(function (s) { s.onchange = function () { S.roles[s.getAttribute("data-role")] = s.value; persist(); }; });
        ov.querySelector("#tts-try-roles").onclick = function () {
            readDialogue(["小明走进教室，看见老师正在看书。", "“老师，您好！今天我们学什么？”", "“你好！今天我们学习新的课文。”", "小明高兴地坐了下来。"], { rate: 0.95 });
        };
    }
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    document.addEventListener("click", function (e) {
        var t = e.target.closest && e.target.closest("[data-hoc-voice]");
        if (t) { e.preventDefault(); open(); }
    });
    // danh sách giọng nạp không đồng bộ ở nhiều trình duyệt
    try { synth.addEventListener("voiceschanged", function () { var o = document.getElementById("tts-ov"); if (o) render(o); }); } catch (e) {}
    synth.getVoices();

    window.HocTTS = {
        voices: voices, settings: function () { return S; },
        set: function (p) { Object.assign(S, p || {}); persist(); },
        speak: speak, stop: stop, dialogueSegments: dialogueSegments, readDialogue: readDialogue, open: open, gender: gender,
        onChange: function (f) { if (typeof f === "function") listeners.push(f); }
    };
})();
