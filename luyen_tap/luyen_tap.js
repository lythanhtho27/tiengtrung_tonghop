/* ==========================================================================
   LUYỆN TẬP — Sắp xếp câu (Việt → Trung) & Nghe – viết
   - Lấy từ ĐÃ HỌC ở các trang khác (đọc thẻ SRS trong localStorage):
       hsk_lotrinh_v1.srs (id "3-帮忙"), boya_learning_progress_v2.srs và boya_tv_srs (id "tc1_3_5"),
       hsk_wl_srs_v3 (id "L1-0001", thẻ tự chứa hz/py/vi).
   - Câu luyện: luyen_tap/lt_data.js (HSK + Boya) và lt_data_wl.js (HSK 3.0, nạp khi cần),
     sinh bởi tools/build_luyen_tap.py. Mỗi câu: [chủ, "mảnh|mảnh", pinyin, nghĩa Việt].
   - Ưu tiên: từ đến hạn ôn, hay quên (lapses), nhận diện chậm (rt), câu từng làm sai ở trang này.
   - Lưu: localStorage "luyen_tap_v1" (được shared/sync.js đồng bộ), tóm tắt qua HocProgress("luyen_tap").
   ========================================================================== */
(function () {
    "use strict";

    const STORE = "luyen_tap_v1";
    const DAY = 86400000;
    const TYPES = {
        order: { name: "Sắp xếp câu", ic: "🧩" },
        dword: { name: "Nghe – viết từ", ic: "🎧" },
        dsent: { name: "Nghe – viết câu", ic: "✍️" },
        dstory: { name: "Chép chính tả câu truyện", ic: "📖" },
        tfsent: { name: "Nghe hiểu: Đúng / Sai", ic: "✅" },
        lchoose: { name: "Nghe hiểu: chọn nghĩa", ic: "🎧" },
    };
    const SRC_NAME = { hsk: "HSK", boya: "Boya", wl: "HSK 3.0", my: "Từ của tôi" };
    const HAN = /[㐀-鿿]/;
    const DATA = window.LT_DATA || { words: {}, sents: [] };

    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const stripP = s => String(s).replace(/[^㐀-鿿A-Za-z0-9]/g, "");
    const dayKey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    function readJSON(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
    function cleanHz(s) {
        let t = String(s || "").replace(/[（(]([^）)]*)[）)](?=[一-鿿])/g, "$1");
        t = t.replace(/\s*[（(][^）)]*[）)]\s*/g, "");
        return t.replace(/\s+/g, "").trim() || s;
    }
    function cleanMean(m) { return String(m || "").replace(/\s*\/\s*$/, "").trim(); }

    // ---------------------------------------------------------------- Trạng thái
    const DEFAULT = { settings: { types: ["order", "dword", "dsent"], count: 20, rate: 0.9, src: "all", distract: false, showpy: false, slen: "mid" },
                      items: {}, types: {}, days: {}, games: {} };
    let S = Object.assign({}, DEFAULT, readJSON(STORE, {}));
    S.settings = Object.assign({}, DEFAULT.settings, S.settings || {});
    ["items", "types", "days", "games"].forEach(k => { if (!S[k] || typeof S[k] !== "object") S[k] = {}; });
    function save() {
        try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {}
        writeSummary();
    }
    function today() { const k = dayKey(); return S.days[k] || (S.days[k] = { n: 0, ok: 0 }); }
    function writeSummary() {
        if (!window.HocProgress) return;
        const t = S.days[dayKey()] || { n: 0, ok: 0 };
        HocProgress.save("luyen_tap", {
            next: "Luyện tập 10 phút", nextUrl: "luyen_tap/luyen_tap.html",
            today: { n: t.n, r: 0 }, learned: Object.keys(S.items).length,
        });
    }

    // ---------------------------------------------------------------- Từ đã học
    let POOL = new Map();   // id -> { id, hz, py, mean, src, card }
    let WL_LOADED = !!window.LT_DATA_WL;
    function buildPool() {
        POOL = new Map();
        const add = (id, info, src, card) => {
            if (!info || !info[0] || !HAN.test(info[0])) return;
            if (!POOL.has(id)) POOL.set(id, { id, hz: cleanHz(info[0]), py: info[1] || "", mean: cleanMean(info[2]), src, card: card || {} });
        };
        const hs = readJSON("hsk_lotrinh_v1", {});
        Object.keys((hs && hs.srs) || {}).forEach(id => add(id, DATA.words[id], "hsk", hs.srs[id]));
        const bl = readJSON("boya_learning_progress_v2", {});
        Object.keys((bl && bl.srs) || {}).forEach(id => add(id, DATA.words[id], "boya", bl.srs[id]));
        const tv = readJSON("boya_tv_srs", {});
        Object.keys(tv || {}).forEach(id => add(id, DATA.words[id], "boya", tv[id]));
        const wl = readJSON("hsk_wl_srs_v3", {});
        Object.keys(wl || {}).forEach(id => { const c = wl[id] || {}; add(id, [c.hz, c.py, c.vi], "wl", c); });
        // Sổ "Từ của tôi" (shared/mywords.js): từ tự thêm khi tra trong bài khóa — dùng cho Nghe – viết từ
        if (window.HocMyWords) HocMyWords.all().forEach(e => add("my:" + e.hz, [e.hz, e.py, e.vi], "my", e.card));
        return POOL;
    }
    function freePool(level) {     // chưa học gì / muốn luyện tự do: lấy toàn bộ từ HSK của cấp đó
        const m = new Map();
        Object.keys(DATA.words).forEach(id => {
            if (id.indexOf(level + "-") !== 0) return;
            const w = DATA.words[id];
            if (w && HAN.test(w[0])) m.set(id, { id, hz: cleanHz(w[0]), py: w[1], mean: cleanMean(w[2]), src: "hsk", card: {} });
        });
        return m;
    }
    function ensureWL() {      // nạp câu của Word Learning (1,8MB) khi có thẻ HSK 3.0
        if (WL_LOADED) return Promise.resolve();
        return new Promise(resolve => {
            const s = document.createElement("script");
            s.src = "lt_data_wl.js";
            s.onload = () => { WL_LOADED = true; resolve(); };
            s.onerror = () => resolve();
            document.head.appendChild(s);
        });
    }

    // Lấy các câu thuộc về những từ trong pool
    function sentencesFor(pool) {
        const lessons = new Set();   // "tc1_3" nếu đã học ít nhất 1 từ của bài
        pool.forEach(w => { if (w.src === "boya") { const m = /^([a-z]+\d)_(\d+)_/.exec(w.id); if (m) lessons.add(m[1] + "_" + m[2]); } });
        const all = DATA.sents.concat(WL_LOADED && window.LT_DATA_WL ? window.LT_DATA_WL.sents : []);
        const out = [];
        for (const s of all) {
            const owner = s[0];
            let w = null;
            if (owner.indexOf("L:") === 0) { if (!lessons.has(owner.slice(2))) continue; }
            else { w = pool.get(owner); if (!w) continue; }
            out.push({ owner, word: w, parts: s[1].split("|"), zh: s[1].replace(/\|/g, ""), py: s[2], vi: s[3],
                       src: w ? w.src : "boya", lesson: owner.indexOf("L:") === 0 ? owner.slice(2) : null });
        }
        return out;
    }

    // Độ ưu tiên: từ yếu / đến hạn / từng sai ở đây lên trước, có yếu tố ngẫu nhiên để đổi mới
    function weight(itemKey, word) {
        const now = Date.now();
        let w = Math.random() * 2;
        const c = word && word.card;
        if (c) {
            if (c.due && c.due <= now) w += 2;
            w += Math.min(3, (c.lapses || 0) + (c.wrong || 0) * 0.5);
            if (c.rt && c.rt >= 3000) w += 1;
        }
        const st = S.items[itemKey];
        if (st) {
            w += Math.max(0, (st.w || 0) - (st.c || 0)) * 2;
            if (st.t && now - st.t < DAY) w -= 2.5;          // vừa luyện hôm nay
        } else w += 0.5;                                      // chưa từng luyện
        return w;
    }
    function pickTop(list, n, keyFn, wordFn) {
        return list.map(x => ({ x, w: weight(keyFn(x), wordFn(x)) + (x.s && x.s.read ? 1.5 : 0) })).sort((a, b) => b.w - a.w).slice(0, n).map(o => o.x);
    }

    // ---------------------------------------------------------------- Câu truyện (doc_them/doc_sents.js): chép chính tả + nghe hiểu
    // Câu chứa từ đã học, lấy từ bài Đọc thêm: ưu tiên bài đã đọc; không lấy truyện dài chưa đọc (khỏi lộ tình tiết)
    const STORY_TYPES = ["dstory", "tfsent", "lchoose"];
    const SLEN = { short: [6, 14], mid: [8, 22], long: [14, 36] };
    let storyLoading = null;
    function ensureStory() {
        if (window.DOC_SENTS) return Promise.resolve(true);
        return storyLoading || (storyLoading = new Promise(resolve => {
            const s = document.createElement("script");
            s.src = "../doc_them/doc_sents.js";
            s.onload = () => resolve(!!window.DOC_SENTS);
            s.onerror = () => { storyLoading = null; resolve(false); };
            document.head.appendChild(s);
        }));
    }
    function storyCands(pool) {
        const D = window.DOC_SENTS;
        if (!D) return [];
        const rd = (readJSON("doc_them_v1", {}) || {}).read || {}, [lo, hi] = SLEN[S.settings.slen] || SLEN.mid;
        const seen = new Set(), out = [];
        pool.forEach(w => {
            (D.w[w.hz] || []).forEach(i => {
                const s = D.s[i], t = D.t[s[2]], read = !!(rd[t[0]] && rd[t[0]].done);
                if (seen.has(s[0]) || (t[2] && !read)) return;
                const n = s[0].replace(/[^㐀-鿿]/g, "").length;
                if (n < lo || n > hi) return;
                seen.add(s[0]);
                out.push({ zh: s[0], py: "", vi: s[1], word: w, read, story: t[1], url: "../doc_them/doc_them.html?id=" + encodeURIComponent(t[0]) + "&s=" + encodeURIComponent(s[0].slice(0, 14)) });
            });
        });
        return out;
    }
    // Nghĩa sai cho câu Đúng/Sai và câu chọn nghĩa: bản dịch của câu khác có cùng từ khóa (phải hiểu cả câu mới loại được)
    function otherMeanings(s, n) {
        const D = window.DOC_SENTS, out = [], seen = new Set([s.vi]);
        const take = list => { for (const i of shuffle(list.slice())) { if (out.length >= n) return; const v = D.s[i][1]; if (v && !seen.has(v) && D.s[i][0] !== s.zh) { seen.add(v); out.push(v); } } };
        take(D.w[s.word.hz] || []);
        if (out.length < n) take(Array.from({ length: 60 }, () => Math.floor(Math.random() * D.s.length)));
        return out;
    }
    function renderListen(it) {
        const s = it.s, tf = it.type === "tfsent";
        if (!it.state) {
            const wrong = otherMeanings(s, tf ? 1 : 2);
            it.state = tf ? { truth: !wrong.length || Math.random() < 0.5 } : { opts: shuffle([s.vi].concat(wrong)) };
            if (tf) it.state.claim = it.state.truth ? s.vi : wrong[0];
        }
        const st = it.state;
        $("qcard").innerHTML = `
            <span class="qsrc">📖 ${esc(s.read ? "Truyện đã đọc" : "Đọc thêm")}</span>
            <div class="qtype">${tf ? "✅ Nghe rồi chọn Đúng hay Sai" : "🎧 Nghe rồi chọn nghĩa đúng"}</div>
            <div class="listen">
                <button class="big-play" id="b-play" title="Nghe lại (Ctrl+Space)">🔊</button>
                <button class="btn btn-sm" id="b-slow" title="Nghe chậm">🐢 Chậm</button>
                <button class="btn btn-sm" id="b-hint" title="Hiện từ khóa">💡 Từ khóa</button>
                <div class="clue" id="clue">Nghe xong rồi trả lời, nghe lại bao nhiêu lần cũng được.</div>
            </div>
            ${tf ? `<div class="claim"><small>Câu bạn vừa nghe có nghĩa là:</small>“${esc(st.claim)}”</div>
                <div class="tf-row"><button class="btn tf-btn ok" data-tf="1"><kbd>1</kbd> ✓ Đúng</button><button class="btn tf-btn bad" data-tf="0"><kbd>2</kbd> ✗ Sai</button></div>`
                : `<div class="lopts">${st.opts.map((o, i) => `<button class="btn lopt" data-lo="${i}"><kbd>${i + 1}</kbd><span>${esc(o)}</span></button>`).join("")}</div>`}
            <div id="fb"></div>`;
        const play = rate => speak(s.zh, rate);
        $("b-play").onclick = () => play();
        $("b-slow").onclick = () => play(0.55);
        $("b-hint").onclick = () => { st.hint = true; $("clue").innerHTML = `Từ khóa: <b>${esc(s.word.hz)}</b> <span class="py">${esc(s.word.py)}</span> · ${esc(s.word.mean)}`; };
        $("qcard").querySelectorAll("[data-tf],[data-lo]").forEach(b => b.onclick = () => listenAnswer(it, b.dataset.tf != null ? b.dataset.tf === "1" : +b.dataset.lo));
        setTimeout(() => play(), 150);
    }
    function listenAnswer(it, pick) {
        if (answered) return;
        const s = it.s, st = it.state, tf = it.type === "tfsent";
        const ok = tf ? pick === st.truth : st.opts[pick] === s.vi;
        answered = true;
        $("qcard").querySelectorAll("[data-tf],[data-lo]").forEach(b => {
            b.disabled = true;
            const right = tf ? (b.dataset.tf === "1") === st.truth : st.opts[+b.dataset.lo] === s.vi;
            const mine = tf ? (b.dataset.tf === "1") === pick : +b.dataset.lo === pick;
            if (right) b.classList.add("is-right"); else if (mine) b.classList.add("is-wrong");
        });
        feedback(it, ok && !st.hint, `
            <div class="verdict">${ok ? (st.hint ? "Đúng (có xem từ khóa)" : "Chính xác!") : "Chưa đúng"}</div>
            <div class="zh">${esc(s.zh)}</div>
            <div class="vi">${esc(s.vi)}</div>
            ${tf && !st.truth ? `<div class="yours">Câu sai vì “${esc(st.claim)}” là nghĩa của một câu khác.</div>` : ""}
            <div class="story">📖 ${esc(s.story)} · <a href="${esc(s.url)}" target="_blank" rel="noopener">Mở lại đoạn ↗</a></div>`);
    }

    // ---------------------------------------------------------------- Tạo phiên
    let session = null;
    function buildItems(pool, count, types, onlyKeys) {
        const sents = sentencesFor(pool);
        const orderCands = sents.filter(s => s.parts.length >= 3 && s.parts.length <= 9);
        const dsentCands = sents.filter(s => { const n = s.zh.replace(/[^㐀-鿿]/g, "").length; return n >= 4 && n <= 14; });
        const dwordCands = Array.from(pool.values()).filter(w => w.hz.length <= 6);
        const story = types.some(t => STORY_TYPES.includes(t)) ? storyCands(pool) : [];
        const withVi = story.filter(s => s.vi);
        const cands = {
            dstory: story.map(s => ({ type: "dstory", key: "t:" + s.zh, s })),
            tfsent: withVi.map(s => ({ type: "tfsent", key: "t:" + s.zh, s })),
            lchoose: withVi.map(s => ({ type: "lchoose", key: "t:" + s.zh, s })),
            order: orderCands.map(s => ({ type: "order", key: "s:" + s.zh, s })),
            dsent: dsentCands.map(s => ({ type: "dsent", key: "s:" + s.zh, s })),
            dword: dwordCands.map(w => ({ type: "dword", key: "w:" + w.id, w })),
        };
        if (onlyKeys) Object.keys(cands).forEach(t => { cands[t] = cands[t].filter(it => onlyKeys.has(it.key)); });
        const active = types.filter(t => cands[t].length);
        if (!active.length) return [];
        // chia đều số câu cho các dạng
        const per = {}; active.forEach(t => { per[t] = 0; });
        for (let i = 0; i < count; i++) per[active[i % active.length]]++;
        let items = [];
        const usedOwner = new Set();
        active.forEach(t => {
            const top = pickTop(cands[t], per[t] * 3, it => it.key, it => it.w || (it.s && it.s.word));
            const chosen = [];
            for (const it of top) {
                const own = it.w ? it.w.id : it.s.owner + ":" + it.s.zh.slice(0, 4);
                if (usedOwner.has(own) && top.length > per[t] * 1.5) continue;
                usedOwner.add(own);
                chosen.push(it);
                if (chosen.length >= per[t]) break;
            }
            items = items.concat(chosen);
        });
        // nếu một dạng thiếu câu, bù bằng dạng khác
        if (items.length < count) {
            const have = new Set(items.map(i => i.type + i.key));
            const extra = shuffle(active.flatMap(t => cands[t])).filter(i => !have.has(i.type + i.key));
            items = items.concat(extra.slice(0, count - items.length));
        }
        return shuffle(items).slice(0, count);
    }

    // Pool từ theo mục "Nguồn từ" (dùng cho phiên luyện và trò chơi)
    async function currentPool() {
        const st = S.settings;
        let pool;
        if (st.src.indexOf("free") === 0) pool = freePool(+st.src.slice(4));
        else {
            pool = buildPool();
            if (st.src !== "all") pool = new Map(Array.from(pool).filter(([, w]) => w.src === st.src));
        }
        if (Array.from(pool.values()).some(w => w.src === "wl")) await ensureWL();
        if (st.types.some(t => STORY_TYPES.includes(t)) && !(await ensureStory())) toast("Không tải được câu truyện (doc_them/doc_sents.js).");
        return pool;
    }
    async function startSession(opts) {
        opts = opts || {};
        const st = S.settings;
        const pool = await currentPool();
        if (!pool.size) { toast("Chưa có từ đã học ở nguồn này. Hãy chọn \"Luyện tự do\" hoặc học vài bài trước."); return; }
        const types = opts.types || st.types;
        if (types.some(t => STORY_TYPES.includes(t))) await ensureStory();
        if (!types.length) { toast("Hãy chọn ít nhất một dạng bài."); return; }
        const items = buildItems(pool, opts.count || st.count, types, opts.onlyKeys);
        if (!items.length) { toast(opts.onlyKeys ? "Không còn câu sai nào để luyện." : "Chưa đủ câu cho các dạng bài đã chọn. Thử chọn thêm dạng bài hoặc nguồn khác."); return; }
        session = { items, i: 0, first: {}, results: [], requeued: new Set(), pool, sents: sentencesFor(pool) };
        show("session");
        renderQuestion();
    }

    // ---------------------------------------------------------------- Phát âm
    let zhVoice = null;
    function pickVoice() {
        if (!("speechSynthesis" in window)) return;
        const vs = speechSynthesis.getVoices();
        zhVoice = vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
    }
    if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
    function speak(text, rate) {
        if (!("speechSynthesis" in window) || !text) { toast("Trình duyệt không hỗ trợ đọc tiếng Trung."); return; }
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "zh-CN";
        if (zhVoice) u.voice = zhVoice;
        u.rate = rate || S.settings.rate;
        speechSynthesis.speak(u);
    }

    // ---------------------------------------------------------------- Câu hỏi
    let answered = false;
    function renderQuestion() {
        answered = false;
        const it = session.items[session.i];
        const total = session.items.length;
        $("prog-bar").style.width = (session.i / total * 100) + "%";
        $("prog-text").textContent = (session.i + 1) + "/" + total;
        if (it.type === "order") renderOrder(it);
        else if (it.type === "tfsent" || it.type === "lchoose") renderListen(it);
        else renderDict(it);
    }
    function srcLabel(it) {
        const s = it.s, w = it.w || (s && s.word);
        if (s && s.lesson) return "Boya · ngữ pháp bài " + s.lesson.replace(/_/, " – ").toUpperCase();
        if (w) return (SRC_NAME[w.src] || "") + " · " + w.hz;
        return "";
    }

    // ----- Sắp xếp câu
    function renderOrder(it) {
        const s = it.s;
        const parts = s.parts.map(p => ({ text: p, show: p.replace(/[^㐀-鿿A-Za-z0-9％%·]/g, "") || p }));
        let bank = parts.map((p, idx) => ({ show: p.show, idx, real: true }));
        if (S.settings.distract) {
            const others = session.items.filter(x => x.s && x.s !== s).flatMap(x => x.s.parts)
                .concat(shuffle(session.sents.slice()).slice(0, 200).flatMap(x => x.parts));
            const own = new Set(parts.map(p => p.show));
            const extra = shuffle(others.map(p => p.replace(/[^㐀-鿿]/g, "")).filter(p => p && !own.has(p))).slice(0, 2);
            extra.forEach(e => bank.push({ show: e, idx: -1, real: false }));
        }
        do { shuffle(bank); } while (bank.length > 2 && bank.every((b, i) => b.idx === i));
        it.state = { parts, bank, picked: [], hints: 0 };
        $("qcard").innerHTML = `
            <span class="qsrc">${esc(srcLabel(it))}</span>
            <div class="qtype">🧩 Sắp xếp thành câu tiếng Trung</div>
            <div class="qprompt">${esc(s.vi)}</div>
            <div class="answer-line empty" id="ans"></div>
            <div class="bank" id="bank"></div>
            <div class="tools" id="tools">
                <button class="btn btn-sm" id="b-hint" title="Đặt đúng mảnh tiếp theo">💡 Gợi ý</button>
                <button class="btn btn-sm" id="b-undo" title="Bỏ mảnh cuối (Backspace)">⌫ Bỏ mảnh cuối</button>
                <span class="spacer"></span>
                <button class="btn btn-primary" id="b-check">Kiểm tra <kbd>Enter</kbd></button>
            </div>
            <div id="fb"></div>`;
        drawOrder(it);
        $("b-hint").onclick = () => orderHint(it);
        $("b-undo").onclick = () => orderUndo(it);
        $("b-check").onclick = () => orderCheck(it);
    }
    function drawOrder(it) {
        const st = it.state;
        const ans = $("ans"), bank = $("bank");
        ans.classList.toggle("empty", !st.picked.length);
        ans.innerHTML = st.picked.map((b, i) => `<button class="chip" data-pi="${i}">${esc(b.show)}</button>`).join("");
        bank.innerHTML = st.bank.map((b, i) => `<button class="chip ${st.picked.includes(b) ? "used" : ""}" data-bi="${i}">${i < 9 ? `<span class="k">${i + 1}</span>` : ""}${esc(b.show)}</button>`).join("");
        ans.querySelectorAll(".chip").forEach(el => el.onclick = () => { if (answered) return; st.picked.splice(+el.dataset.pi, 1); drawOrder(it); });
        bank.querySelectorAll(".chip").forEach(el => el.onclick = () => orderPick(it, +el.dataset.bi));
    }
    function orderPick(it, bi) {
        if (answered) return;
        const st = it.state, b = st.bank[bi];
        if (!b || st.picked.includes(b)) return;
        st.picked.push(b);
        drawOrder(it);
    }
    function orderUndo(it) { if (answered) return; it.state.picked.pop(); drawOrder(it); }
    function orderHint(it) {
        if (answered) return;
        const st = it.state;
        // giữ phần đầu đã đúng, thêm mảnh đúng kế tiếp
        let k = 0;
        while (k < st.picked.length && st.picked[k].show === st.parts[k].show) k++;
        st.picked = st.picked.slice(0, k);
        if (k >= st.parts.length) return;
        const target = st.parts[k].show;
        const b = st.bank.find(x => x.real && x.show === target && !st.picked.includes(x));
        if (b) { st.picked.push(b); st.hints++; }
        drawOrder(it);
    }
    function orderCheck(it) {
        if (answered) { next(); return; }
        const st = it.state;
        if (!st.picked.length) { toast("Hãy chọn các mảnh trước."); return; }
        const mine = stripP(st.picked.map(b => b.show).join(""));
        const right = stripP(it.s.zh);
        const ok = mine === right && st.hints === 0;
        const exact = mine === right;
        answered = true;
        $("ans").classList.add(exact ? "is-ok" : "is-bad");
        $("tools").hidden = true;
        $("bank").hidden = true;
        const verdict = exact ? (st.hints ? `Đúng (dùng ${st.hints} gợi ý)` : "Chính xác!") : "Chưa đúng";
        feedback(it, ok, `
            <div class="verdict">${verdict}</div>
            <div class="zh">${esc(it.s.zh)}</div>
            <div class="py">${esc(it.s.py)}</div>
            <div class="vi">${esc(it.s.vi)}</div>
            ${exact ? "" : `<div class="yours">Bạn xếp: <span>${esc(st.picked.map(b => b.show).join(" "))}</span></div>`}`,
            !exact);
        speak(it.s.zh);
    }

    // ----- Nghe – viết
    function renderDict(it) {
        const isWord = it.type === "dword", isStory = it.type === "dstory";
        const target = isWord ? it.w.hz : it.s.zh;
        const py = isWord ? it.w.py : it.s.py;
        const meaning = isWord ? it.w.mean : it.s.vi;
        it.state = { target, py, meaning, hints: 0 };
        $("qcard").innerHTML = `
            <span class="qsrc">${esc(isStory ? "📖 " + (it.s.read ? "Truyện đã đọc" : "Đọc thêm") : isWord ? (SRC_NAME[it.w.src] || "") : srcLabel(it).split(" · ")[0])}</span>
            <div class="qtype">${isWord ? "🎧 Nghe và gõ từ" : isStory ? "📖 Chép chính tả câu truyện" : "✍️ Nghe và gõ lại cả câu"}</div>
            <div class="listen">
                <button class="big-play" id="b-play" title="Nghe lại (Ctrl+Space)">🔊</button>
                <button class="btn btn-sm" id="b-slow" title="Nghe chậm">🐢 Chậm</button>
                <button class="btn btn-sm" id="b-hint">💡 Gợi ý</button>
                <div class="clue" id="clue"></div>
            </div>
            <input class="dict-input" id="dict" type="text" lang="zh-CN" autocomplete="off" autocapitalize="off" spellcheck="false"
                   placeholder="${isWord ? "Gõ chữ Hán của từ vừa nghe…" : "Gõ lại câu vừa nghe bằng chữ Hán…"}">
            <div class="tools" id="tools">
                <button class="btn btn-sm" id="b-skip">Không biết</button>
                <span class="spacer"></span>
                <button class="btn btn-primary" id="b-check">Kiểm tra <kbd>Enter</kbd></button>
            </div>
            <div id="fb"></div>`;
        drawClue(it);
        const play = rate => speak(target, rate);
        $("b-play").onclick = () => { play(); $("dict").focus(); };
        $("b-slow").onclick = () => { play(0.55); $("dict").focus(); };
        $("b-hint").onclick = () => { it.state.hints = Math.min(2, it.state.hints + 1); drawClue(it); $("dict").focus(); };
        $("b-skip").onclick = () => dictCheck(it, true);
        $("b-check").onclick = () => dictCheck(it);
        const inp = $("dict");
        inp.addEventListener("keydown", e => {
            if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); dictCheck(it); }
        });
        setTimeout(() => { inp.focus(); play(); }, 150);
    }
    function drawClue(it) {
        const st = it.state;
        const isWord = it.type === "dword";
        const n = st.target.replace(/[^㐀-鿿]/g, "").length;
        let html = `<b>${n}</b> chữ`;
        if (st.hints >= 1 && st.meaning) html += ` · nghĩa: <b>${esc(st.meaning)}</b>`;
        if (it.type === "dstory") { if (st.hints >= 2 || (st.hints >= 1 && !st.meaning)) html += ` · từ khóa: <b>${esc(it.s.word.hz)}</b> <span class="py">${esc(it.s.word.py)}</span>`; }
        else if (st.hints >= 2 || S.settings.showpy) html += ` · <span class="py">${esc(st.py)}</span>`;
        if (!isWord && st.hints === 0) html += " · bấm 🔊 để nghe lại";
        $("clue").innerHTML = html;
    }
    // So khớp từng chữ (LCS) để tô chữ đúng / sai
    function diffMarks(right, mine) {
        const a = Array.from(right), b = Array.from(stripP(mine));
        const A = a.map(c => HAN.test(c) || /[A-Za-z0-9]/.test(c));
        const ai = a.map((c, i) => i).filter(i => A[i]);
        const ra = ai.map(i => a[i]);
        const n = ra.length, m = b.length;
        const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
        for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
            dp[i][j] = ra[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        const hit = new Set();
        let i = 0, j = 0;
        while (i < n && j < m) {
            if (ra[i] === b[j]) { hit.add(ai[i]); i++; j++; }
            else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
            else j++;
        }
        return a.map((c, k) => !A[k] ? esc(c) : `<span class="${hit.has(k) ? "hit" : "miss"}">${esc(c)}</span>`).join("");
    }
    function dictCheck(it, skip) {
        if (answered) { next(); return; }
        const inp = $("dict");
        const mine = skip ? "" : inp.value;
        if (!skip && !stripP(mine)) { toast("Hãy gõ chữ Hán trước, hoặc bấm \"Không biết\"."); return; }
        const st = it.state;
        const exact = stripP(mine) === stripP(st.target);
        const ok = exact && st.hints === 0;
        answered = true;
        inp.readOnly = true;
        inp.classList.add(exact ? "is-ok" : "is-bad");
        $("tools").hidden = true;
        const isWord = it.type === "dword";
        const verdict = exact ? (ok ? "Chính xác!" : "Đúng (có dùng gợi ý)") : (skip ? "Đáp án" : "Chưa đúng");
        feedback(it, ok, `
            <div class="verdict">${verdict}</div>
            <div class="zh">${exact ? esc(st.target) : diffMarks(st.target, mine)}</div>
            <div class="py">${esc(st.py)}</div>
            <div class="vi">${esc(st.meaning)}</div>
            ${!exact && !skip ? `<div class="yours">Bạn gõ: <span>${esc(mine)}</span></div>` : ""}
            ${it.type === "dstory" ? `<div class="story">📖 ${esc(it.s.story)} · <a href="${esc(it.s.url)}" target="_blank" rel="noopener">Mở lại đoạn ↗</a></div>` : ""}
`,
            !exact && !skip);
        speak(st.target);
    }

    // ----- Phản hồi chung
    function feedback(it, ok, html, allowOverride) {
        record(it, ok);
        $("fb").innerHTML = `
            <div class="feedback ${ok ? "ok" : "bad"}">${html}
                <div class="row">
                    <button class="btn btn-sm" id="b-say">🔊 Nghe</button>
                    ${allowOverride ? `<button class="btn btn-sm" id="b-mine" title="Câu của bạn cũng đúng (cách diễn đạt khác)">✔ Tôi đúng</button>` : ""}
                </div>
            </div>
            <div class="next-row"><button class="btn btn-primary" id="b-next">${session.i + 1 >= session.items.length ? "Xem kết quả" : "Câu tiếp"} <kbd>Enter</kbd></button></div>`;
        $("b-say").onclick = () => speak(it.type === "dword" ? it.w.hz : it.s.zh);
        if ($("b-mine")) $("b-mine").onclick = () => { record(it, true, true); $("b-mine").remove(); toast("Đã tính là đúng."); };
        $("b-next").onclick = next;
        setTimeout(() => { const b = $("b-next"); if (b) b.focus(); }, 50);
    }
    function record(it, ok, override) {
        const firstTime = !(it.key + it.type in session.first);
        if (override) {
            // sửa lại kết quả câu vừa chấm
            const r = session.results[session.results.length - 1];
            if (r && r.it === it && !r.ok) {
                r.ok = true;
                if (r.first) { session.first[it.key + it.type] = true; const st = S.items[it.key]; if (st) { st.w = Math.max(0, (st.w || 0) - 1); st.c = (st.c || 0) + 1; }
                    const ty = S.types[it.type]; if (ty) ty.ok++; today().ok++; }
                if (session.requeued.has(it.key + it.type)) { session.items.splice(session.items.lastIndexOf(it), 1); session.requeued.delete(it.key + it.type); }
                save();
            }
            return;
        }
        session.results.push({ it, ok, first: firstTime });
        if (firstTime) {
            session.first[it.key + it.type] = ok;
            const st = S.items[it.key] || (S.items[it.key] = { w: 0, c: 0, t: 0 });
            if (ok) st.c++; else st.w++;
            st.t = Date.now();
            const ty = S.types[it.type] || (S.types[it.type] = { n: 0, ok: 0 });
            ty.n++; if (ok) ty.ok++;
            const d = today(); d.n++; if (ok) d.ok++;
            save();
        }
        // sai lần đầu -> hỏi lại ở cuối phiên (một lần)
        if (!ok && !session.requeued.has(it.key + it.type)) {
            session.requeued.add(it.key + it.type);
            session.items.push(it);
        }
    }
    function next() {
        if (!session) return;
        session.i++;
        if (session.i >= session.items.length) finish();
        else renderQuestion();
    }

    // ---------------------------------------------------------------- Kết quả
    function finish() {
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        const firsts = Object.keys(session.first);
        const okN = firsts.filter(k => session.first[k]).length;
        const pct = firsts.length ? Math.round(okN / firsts.length * 100) : 0;
        $("res-score").textContent = pct + "%";
        $("res-title").textContent = pct >= 90 ? "Xuất sắc!" : pct >= 70 ? "Tốt lắm!" : pct >= 50 ? "Cố lên!" : "Cần luyện thêm";
        $("res-sub").textContent = `Đúng ngay lần đầu ${okN}/${firsts.length} câu. Câu sai đã được hỏi lại, và sẽ được ưu tiên ở các phiên sau.`;
        const wrong = [];
        const seen = new Set();
        session.results.forEach(r => {
            const k = r.it.key + r.it.type;
            if (r.first && !session.first[k] && !seen.has(k)) { seen.add(k); wrong.push(r.it); }
        });
        $("res-mistakes-card").hidden = !wrong.length;
        $("res-mistakes").innerHTML = wrong.map((it, i) => {
            const zh = it.type === "dword" ? it.w.hz : it.s.zh, py = it.type === "dword" ? it.w.py : it.s.py, vi = it.type === "dword" ? it.w.mean : it.s.vi;
            return `<li><button class="btn btn-sm" data-say="${i}">🔊</button><span class="muted">${TYPES[it.type].ic}</span>
                <span class="zh">${esc(zh)}</span><div class="py">${esc(py)}</div><div class="vi">${esc(vi)}</div></li>`;
        }).join("");
        $("res-mistakes").querySelectorAll("[data-say]").forEach(b => b.onclick = () => { const it = wrong[+b.dataset.say]; speak(it.type === "dword" ? it.w.hz : it.s.zh); });
        $("btn-redo").hidden = !wrong.length;
        $("btn-redo").onclick = () => {
            session = { items: shuffle(wrong.slice()), i: 0, first: {}, results: [], requeued: new Set(), pool: session.pool, sents: session.sents };
            show("session"); renderQuestion();
        };
        show("result");
    }

    // ---------------------------------------------------------------- Màn hình chính
    function show(view) {
        if (view !== "game") closeGame();
        ["home", "session", "result", "game"].forEach(v => { $(v).hidden = v !== view; });
        window.scrollTo(0, 0);
        if (view === "home") renderHome();
    }
    function renderHome() {
        const pool = buildPool();
        const bySrc = { hsk: 0, boya: 0, wl: 0, my: 0 };
        pool.forEach(w => { bySrc[w.src]++; });
        const parts = Object.keys(bySrc).filter(k => bySrc[k]).map(k => `${SRC_NAME[k]} ${bySrc[k].toLocaleString("vi-VN")}`);
        $("pool-note").innerHTML = pool.size
            ? `Có <b>${pool.size.toLocaleString("vi-VN")}</b> từ đã học để luyện (${parts.join(" · ")}). Từ hay quên, nhận diện chậm và câu từng sai được ưu tiên.`
            : `Bạn chưa học từ nào ở các trang khác. Hãy chọn <b>Luyện tự do</b> theo cấp HSK ở mục Nguồn từ, hoặc học vài bài trước.`;
        if (!pool.size && S.settings.src.indexOf("free") !== 0) { S.settings.src = "free1"; }
        const t = S.days[dayKey()] || { n: 0, ok: 0 };
        $("today-n").textContent = t.n;
        $("today-acc").textContent = t.n ? Math.round(t.ok / t.n * 100) + "%" : "–";
        // tùy chọn
        document.querySelectorAll("[data-type]").forEach(cb => { cb.checked = S.settings.types.includes(cb.dataset.type); });
        $("opt-src").value = S.settings.src;
        setSeg("opt-count", S.settings.count);
        setSeg("opt-rate", S.settings.rate);
        $("opt-distract").checked = !!S.settings.distract;
        $("opt-showpy").checked = !!S.settings.showpy;
        $("opt-slen").value = S.settings.slen;
        // thống kê
        $("stats").innerHTML = Object.keys(TYPES).map(k => {
            const ty = S.types[k] || { n: 0, ok: 0 };
            const p = ty.n ? Math.round(ty.ok / ty.n * 100) : 0;
            return `<div class="stat">${TYPES[k].ic} ${TYPES[k].name}<b>${ty.n ? p + "%" : "–"}</b><span>${ty.n} câu đã làm</span><div class="bar"><i style="width:${p}%"></i></div></div>`;
        }).join("");
        const wrongKeys = Object.keys(S.items).filter(k => (S.items[k].w || 0) > (S.items[k].c || 0));
        $("wrong-n").textContent = wrongKeys.length;
        $("btn-wrong").hidden = !wrongKeys.length;
        renderGamesHub();
    }

    // ---------------------------------------------------------------- Trò chơi
    // Mỗi trò là một file luyen_tap/games/<id>.js tự đăng ký vào window.LT_GAMES (xem games/README.md).
    let game = null;   // { def, cleanups: [] }
    function gameList() { return (window.LT_GAMES || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99)); }
    function renderGamesHub() {
        const list = gameList();
        $("games-card").hidden = !list.length;
        $("games-grid").innerHTML = list.map(g => {
            const st = S.games[g.id];
            return `<button class="game-tile" data-game="${esc(g.id)}"><span class="gt-ic">${g.ic || "🎮"}</span>
                <span class="gt-body"><b>${esc(g.name)}</b><small>${esc(g.desc || "")}</small>
                ${st && st.plays ? `<em>Kỷ lục ${st.best}${esc(g.unit || " điểm")} · ${st.plays} lượt</em>` : ""}</span></button>`;
        }).join("");
    }
    function distractors(words, w, n, key) {
        key = key || "mean";
        const seen = new Set([String(w[key])]);
        const out = [];
        for (const x of shuffle(words.slice())) {
            const v = String(x[key] || "");
            if (!v || seen.has(v) || x.hz === w.hz) continue;
            seen.add(v); out.push(x);
            if (out.length >= n) break;
        }
        return out;
    }
    async function openGame(id) {
        const def = gameList().find(g => g.id === id);
        if (!def) return;
        const pool = await currentPool();
        const words = Array.from(pool.values()).filter(w => w.hz && w.mean);
        if (!def.ownData && words.length < (def.minWords || 8)) {
            toast(`Trò này cần ít nhất ${def.minWords || 8} từ. Hãy chọn "Luyện tự do" ở mục Nguồn từ hoặc học thêm.`);
            return;
        }
        closeGame();
        game = { def, cleanups: [] };
        show("game");
        $("game-title").textContent = (def.ic || "🎮") + " " + def.name;
        const el = $("game-body");
        el.innerHTML = "";
        let sentCache = null;
        const ctx = {
            el, words: shuffle(words.slice()), data: window.LT_GAMES_DATA || {},
            sents: () => sentCache || (sentCache = sentencesFor(pool)),
            speak, shuffle, esc, toast,
            distractors: (w, n, key) => distractors(words, w, n, key),
            pick: (n, filter) => shuffle(words.filter(filter || (() => true))).slice(0, n),
            onCleanup: fn => { if (game) game.cleanups.push(fn); },
            setTimeout: (f, ms) => { const t = setTimeout(f, ms); ctx.onCleanup(() => clearTimeout(t)); return t; },
            setInterval: (f, ms) => { const t = setInterval(f, ms); ctx.onCleanup(() => clearInterval(t)); return t; },
            finish: res => finishGame(def, res || {}),
            best: () => (S.games[def.id] || {}).best || 0,
        };
        try { def.start(ctx); }
        catch (e) { console.error(e); el.innerHTML = `<p class="muted">Trò chơi gặp lỗi: ${esc(e.message)}</p>`; }
    }
    function closeGame() {
        if (!game) return;
        game.cleanups.forEach(f => { try { f(); } catch (e) {} });
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        game = null;
    }
    // res: { score, unit?, correct?, total?, wrong?: [{hz, py, mean}], note?, title? }
    function finishGame(def, res) {
        closeGame();
        const st = S.games[def.id] || (S.games[def.id] = { plays: 0, best: 0 });
        const score = Math.round(res.score || 0);
        const isBest = score > (st.best || 0);
        st.plays++; st.last = Date.now(); if (isBest) st.best = score;
        const d = today(); d.g = (d.g || 0) + 1;
        save();
        const unit = res.unit || def.unit || " điểm";
        const wrong = (res.wrong || []).filter((w, i, a) => w && w.hz && a.findIndex(x => x.hz === w.hz) === i);
        $("game-body").innerHTML = `
            <div class="game-result">
                <div class="score">${score}<small>${esc(unit)}</small></div>
                <h2>${isBest && st.plays > 1 ? "🏆 Kỷ lục mới!" : esc(res.title || "Hoàn thành!")}</h2>
                <p class="muted">${res.total ? `Đúng ${res.correct || 0}/${res.total}. ` : ""}${esc(res.note || "")} Kỷ lục: ${st.best}${esc(unit)} · ${st.plays} lượt chơi.</p>
                ${wrong.length ? `<h3>Từ cần xem lại</h3><ul class="mistakes">${wrong.map((w, i) => `<li><button class="btn btn-sm" data-say="${i}">🔊</button>
                    <span class="zh">${esc(w.hz)}</span> <span class="py">${esc(w.py || "")}</span><div class="vi">${esc(w.mean || "")}</div></li>`).join("")}</ul>` : ""}
                <div class="actions"><button class="btn btn-primary" id="g-again">▶ Chơi lại</button><button class="btn" id="g-back">🎮 Trò khác</button></div>
            </div>`;
        $("game-body").querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(wrong[+b.dataset.say].hz));
        $("g-again").onclick = () => openGame(def.id);
        $("g-back").onclick = () => show("home");
    }
    function setSeg(id, v) { document.querySelectorAll("#" + id + " button").forEach(b => b.classList.toggle("on", +b.dataset.v === +v)); }

    document.querySelectorAll("[data-type]").forEach(cb => cb.addEventListener("change", () => {
        S.settings.types = Array.from(document.querySelectorAll("[data-type]")).filter(c => c.checked).map(c => c.dataset.type);
        save();
    }));
    $("opt-src").addEventListener("change", e => { S.settings.src = e.target.value; save(); });
    $("opt-count").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.settings.count = +b.dataset.v; setSeg("opt-count", S.settings.count); save(); });
    $("opt-rate").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.settings.rate = +b.dataset.v; setSeg("opt-rate", S.settings.rate); save(); speak("你好，我们开始练习吧。"); });
    $("opt-distract").addEventListener("change", e => { S.settings.distract = e.target.checked; save(); });
    $("opt-showpy").addEventListener("change", e => { S.settings.showpy = e.target.checked; save(); });
    $("opt-slen").addEventListener("change", e => { S.settings.slen = e.target.value; save(); });
    // Phiên chỉ luyện nghe: ba dạng câu truyện, không đổi lựa chọn dạng bài đã lưu
    $("btn-listen").onclick = () => startSession({ types: STORY_TYPES });
    $("btn-start").onclick = () => startSession();
    $("games-grid").addEventListener("click", e => { const b = e.target.closest("[data-game]"); if (b) openGame(b.dataset.game); });
    $("btn-game-quit").onclick = () => show("home");
    $("btn-wrong").onclick = () => {
        const keys = new Set(Object.keys(S.items).filter(k => (S.items[k].w || 0) > (S.items[k].c || 0)));
        startSession({ onlyKeys: keys, types: Object.keys(TYPES), count: Math.min(30, keys.size * 2) });
    };
    $("btn-quit").onclick = () => {
        if (session && session.results.length && !confirm("Kết thúc phiên luyện? Kết quả các câu đã làm vẫn được lưu.")) return;
        if (session && session.results.length) finish(); else { session = null; show("home"); }
    };
    $("btn-again").onclick = () => startSession();
    $("btn-home").onclick = () => { session = null; show("home"); };

    // Phím tắt: số 1–9 chọn mảnh, Backspace bỏ mảnh cuối, Enter kiểm tra / câu tiếp, Ctrl+Space nghe lại
    document.addEventListener("keydown", e => {
        if (!session || $("session").hidden) return;
        const it = session.items[session.i];
        const inInput = e.target && e.target.tagName === "INPUT";
        if (e.key === " " && e.ctrlKey && it.type !== "order") { e.preventDefault(); speak(it.state.target || it.s.zh); return; }
        if ((it.type === "tfsent" || it.type === "lchoose") && !answered && !inInput && /^[1-3]$/.test(e.key)) {
            e.preventDefault();
            if (it.type === "tfsent") { if (e.key !== "3") listenAnswer(it, e.key === "1"); }
            else if (+e.key <= it.state.opts.length) listenAnswer(it, +e.key - 1);
            return;
        }
        if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) {
            if (inInput) return;                        // ô nhập tự xử lý Enter
            if (e.target && e.target.tagName === "BUTTON" && e.target.id !== "b-next") return;
            e.preventDefault();
            if (answered) next(); else if (it.type === "order") orderCheck(it);
            return;
        }
        if (it.type !== "order" || answered || inInput) return;
        if (/^[1-9]$/.test(e.key)) { orderPick(it, +e.key - 1); e.preventDefault(); }
        else if (e.key === "Backspace") { orderUndo(it); e.preventDefault(); }
    });

    let toastTimer;
    function toast(msg) {
        const t = $("toast");
        t.textContent = msg; t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
    }

    show("home");
    writeSummary();
    // test tự động có thể dùng
    window.__LT = { buildPool, sentencesFor, buildItems, storyCands, ensureStory, startSession, openGame, gameList, state: () => S, session: () => session };
})();
