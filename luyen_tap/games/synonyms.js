/* Trò chơi: Phân biệt từ dễ nhầm (HSK 4–6) — chọn từ đúng cho chỗ trống, xem giải thích khác biệt của cả nhóm.
   Dữ liệu: ctx.data.confusables = [{ id, level, words:[{hz,py,hv,mean}], explain, items:[{sentence (có "＿＿"), answer, py, vi, why}] }].
   Nếu thiếu thì chuyển bộ cũ ctx.data.synonyms (cặp từ gần nghĩa) sang cùng định dạng. */
(function () {
    "use strict";
    const ID = "synonyms";
    const BLANK = "＿＿";
    // Lựa chọn của người chơi giữ trong bộ nhớ trong phiên mở trang (không cần lưu lâu dài).
    const pref = { level: 0, count: 10, listLevel: 0, q: "" };

    function css() {
        if (document.getElementById("g-synonyms-css")) return;
        const s = document.createElement("style");
        s.id = "g-synonyms-css";
        s.textContent = `
.g-synonyms-menu { max-width:560px; margin:0 auto; }
.g-synonyms-intro { color:var(--ui-text-2); font-size:14.5px; line-height:1.55; margin:0 0 14px; }
.g-synonyms-lbl { font-size:13px; font-weight:700; color:var(--ui-muted); text-transform:uppercase; letter-spacing:.04em; margin:14px 0 6px; }
.g-synonyms-seg { display:flex; flex-wrap:wrap; gap:8px; }
.g-synonyms-seg button { flex:1 1 0; min-width:64px; min-height:44px; border:1px solid var(--ui-border-strong); border-radius:12px;
  background:var(--ui-surface); color:var(--ui-text); font-size:15px; font-weight:600; cursor:pointer; padding:6px 10px; }
.g-synonyms-seg button small { display:block; font-size:11.5px; font-weight:500; color:var(--ui-muted); }
.g-synonyms-seg button.on { background:var(--ui-primary); border-color:var(--ui-primary); color:var(--ui-on-primary); }
.g-synonyms-seg button.on small { color:var(--ui-on-primary); opacity:.85; }
.g-synonyms-go { display:flex; flex-direction:column; gap:10px; margin-top:20px; }
.g-synonyms-go .btn { min-height:48px; width:100%; }
.g-synonyms-top { display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:14px; color:var(--ui-muted); margin-bottom:10px; }
.g-synonyms-top b { color:var(--ui-text); }
.g-synonyms-bar { height:6px; border-radius:99px; background:var(--ui-surface-3); overflow:hidden; margin-bottom:16px; }
.g-synonyms-bar i { display:block; height:100%; background:var(--ui-primary); transition:width .25s; }
.g-synonyms-lv { font-size:12px; font-weight:700; padding:2px 8px; border-radius:99px; color:#fff; background:var(--ui-hsk-4); white-space:nowrap; }
.g-synonyms-lv.l5 { background:var(--ui-hsk-5); } .g-synonyms-lv.l6 { background:var(--ui-hsk-6); }
.g-synonyms-retry { font-size:12px; font-weight:700; color:var(--ui-warning); }
.g-synonyms-sent { font-family:var(--ui-font-cn); font-size:23px; line-height:1.75; text-align:center; margin:4px 0 6px; word-break:break-all; }
.g-synonyms-blank { display:inline-block; min-width:2.6em; padding:0 4px; border-bottom:2px solid var(--ui-primary); color:var(--ui-primary); font-weight:700; }
.g-synonyms-blank.ok { color:var(--ui-success); border-color:var(--ui-success); }
.g-synonyms-blank.bad { color:var(--ui-danger); border-color:var(--ui-danger); }
.g-synonyms-sub { text-align:center; font-size:14.5px; color:var(--ui-text-2); margin-bottom:14px; line-height:1.5; }
.g-synonyms-sub .py { display:block; color:var(--ui-pinyin); font-size:13.5px; }
.g-synonyms-opts { display:grid; grid-template-columns:repeat(var(--n,2),1fr); gap:10px; margin-bottom:14px; }
.g-synonyms-opt { min-height:64px; border:1px solid var(--ui-border-strong); border-radius:14px; background:var(--ui-surface); color:var(--ui-text);
  font-family:var(--ui-font-cn); font-size:26px; cursor:pointer; padding:6px 4px; line-height:1.2; }
.g-synonyms-opt small { display:block; font-family:var(--ui-font-sans); font-size:12px; color:var(--ui-pinyin); margin-top:2px; }
.g-synonyms-opt:not(:disabled):hover { border-color:var(--ui-primary); }
.g-synonyms-opt:disabled { cursor:default; }
.g-synonyms-opt.ok { background:var(--ui-success-soft); border-color:var(--ui-success); }
.g-synonyms-opt.bad { background:var(--ui-danger-soft); border-color:var(--ui-danger); }
.g-synonyms-why { border-radius:12px; padding:10px 12px; font-size:14.5px; line-height:1.55; margin-bottom:12px; border:1px solid var(--ui-border); }
.g-synonyms-why.ok { background:var(--ui-success-soft); border-color:var(--ui-success); }
.g-synonyms-why.bad { background:var(--ui-danger-soft); border-color:var(--ui-danger); }
.g-synonyms-why b { display:block; margin-bottom:2px; }
.g-synonyms-acts { display:flex; gap:10px; flex-wrap:wrap; }
.g-synonyms-acts .btn { min-height:46px; flex:1 1 140px; }
.g-synonyms-exp { background:var(--ui-surface-2); border:1px solid var(--ui-border); border-radius:12px; padding:12px; margin:0 0 12px; font-size:14.5px; line-height:1.6; }
.g-synonyms-words { display:grid; gap:8px; margin-bottom:10px; }
.g-synonyms-w { display:grid; grid-template-columns:auto 1fr; gap:2px 12px; align-items:baseline; background:var(--ui-surface); border:1px solid var(--ui-border); border-radius:10px; padding:8px 10px; }
.g-synonyms-w .zh { font-family:var(--ui-font-cn); font-size:22px; font-weight:700; grid-row:span 2; }
.g-synonyms-w .meta { font-size:13px; } .g-synonyms-w .meta .py { color:var(--ui-pinyin); margin-right:6px; }
.g-synonyms-w .meta .hv { font-size:11.5px; font-weight:700; letter-spacing:.03em; color:var(--ui-muted); }
.g-synonyms-w .mean { font-size:14px; color:var(--ui-text); }
.g-synonyms-w.ans { border-color:var(--ui-success); }
.g-synonyms-ex { color:var(--ui-text); }
.g-synonyms-ex .hl { font-family:var(--ui-font-cn); font-weight:700; color:var(--ui-primary); }
.g-synonyms-list-tools { display:flex; flex-direction:column; gap:10px; margin-bottom:12px; }
.g-synonyms-search { width:100%; box-sizing:border-box; min-height:44px; border:1px solid var(--ui-border-strong); border-radius:12px; padding:8px 12px;
  font-size:16px; background:var(--ui-surface); color:var(--ui-text); }
.g-synonyms-count { font-size:13px; color:var(--ui-muted); margin-bottom:8px; }
.g-synonyms-card { border:1px solid var(--ui-border); border-radius:14px; background:var(--ui-surface); padding:12px; margin-bottom:12px; }
.g-synonyms-card h3 { display:flex; justify-content:space-between; align-items:center; gap:8px; margin:0 0 8px; font-family:var(--ui-font-cn); font-size:22px; }
.g-synonyms-card .g-synonyms-exp { margin-bottom:8px; }
.g-synonyms-card details summary { cursor:pointer; min-height:36px; display:flex; align-items:center; font-weight:600; color:var(--ui-primary); font-size:14px; }
.g-synonyms-card ol { margin:4px 0 0; padding-left:20px; font-size:14px; line-height:1.5; }
.g-synonyms-card ol li { margin-bottom:8px; }
.g-synonyms-card ol .zh { font-family:var(--ui-font-cn); font-size:17px; }
.g-synonyms-card ol .vi { color:var(--ui-text-2); }
.g-synonyms-back { min-height:44px; margin-bottom:12px; }
.g-synonyms-empty { text-align:center; color:var(--ui-muted); padding:24px 0; }
@media (min-width:640px) { .g-synonyms-sent { font-size:26px; } .g-synonyms-opt { font-size:30px; } }`;
        document.head.appendChild(s);
    }

    // Chuẩn hóa dữ liệu: ưu tiên confusables, thiếu thì chuyển bộ synonyms cũ.
    function loadGroups(data) {
        const cf = (data && data.confusables) || [];
        if (cf.length) return cf.filter(g => g && g.words && g.words.length >= 2 && g.items && g.items.length);
        return ((data && data.synonyms) || []).map(it => {
            const notes = it.notes || [];
            const words = (it.pair || []).map(hz => { const n = notes.find(x => x.hz === hz) || {}; return { hz, py: n.py || "", hv: "", mean: n.hint || "" }; });
            return { id: it.id, level: 4, words, explain: String(it.explain || "").replace(/^💡\s*/, ""),
                items: [{ sentence: String(it.sentence || "").replace(/【\s*_+\s*】/, BLANK), answer: it.correct, py: it.py || "", vi: it.mean || "", why: "" }] };
        }).filter(g => g.words.length >= 2 && g.items[0].sentence.includes(BLANK));
    }
    const noTone = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ü/g, "u").toLowerCase();

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: ID, order: 11, ic: "⚖️", name: "Phân biệt từ dễ nhầm",
        desc: "HSK 4–6: chọn đúng từ trong cặp/bộ từ dễ nhầm (了解/理解, 以为/认为…) cho chỗ trống, xem bảng phân biệt cách dùng.",
        unit: " điểm", ownData: true,
        start(ctx) {
            css();
            const esc = ctx.esc, el = ctx.el;
            const groups = loadGroups(ctx.data);
            if (!groups.length) { el.innerHTML = `<p class="muted">Chưa có dữ liệu từ dễ nhầm.</p>`; return; }
            const levels = [4, 5, 6].filter(l => groups.some(g => g.level === l));
            if (pref.level && !levels.includes(pref.level)) pref.level = 0;

            let view = "menu";            // menu | play | list
            let queue = [], qi = 0, correct = 0, total = 0, answered = null, showExp = false, opts = [];
            const wrongGroups = new Map(); // id nhóm → mục cho màn kết quả

            const lvBadge = l => `<span class="g-synonyms-lv l${+l}">HSK ${+l}</span>`;
            const ofLevel = l => groups.filter(g => !l || g.level === l);
            // Tô đậm các từ của nhóm trong đoạn giải thích (đã escape trước), từ dài khớp trước.
            function hlExplain(g) {
                const hzs = g.words.map(w => esc(w.hz)).sort((a, b) => b.length - a.length);
                const re = new RegExp(hzs.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
                return esc(g.explain || "").replace(re, m => `<span class="hl">${m}</span>`);
            }
            function expHTML(g, ans) {
                return `<div class="g-synonyms-exp">
                    <div class="g-synonyms-words">${g.words.map(w => `<div class="g-synonyms-w${w.hz === ans ? " ans" : ""}">
                        <span class="zh">${esc(w.hz)}</span>
                        <span class="meta"><span class="py">${esc(w.py || "")}</span><span class="hv">${esc(w.hv || "")}</span></span>
                        <span class="mean">${esc(w.mean || "")}</span></div>`).join("")}</div>
                    <div class="g-synonyms-ex">${hlExplain(g)}</div></div>`;
            }

            // ------------------------------------------------ Màn bắt đầu
            function renderMenu() {
                view = "menu";
                const cnt = l => ofLevel(l).reduce((n, g) => n + g.items.length, 0);
                el.innerHTML = `<div class="g-synonyms-menu">
                    <p class="g-synonyms-intro">Mỗi câu có một chỗ trống và 2–3 từ dễ nhầm. Chọn từ đúng, rồi đọc lý do và bảng phân biệt cả nhóm. Câu sai được hỏi lại một lần ở cuối phiên (điểm tính theo lần đầu).</p>
                    <div class="g-synonyms-lbl">Cấp độ</div>
                    <div class="g-synonyms-seg" data-seg="level">
                        ${levels.map(l => `<button data-v="${l}" class="${pref.level === l ? "on" : ""}">HSK ${l}<small>${ofLevel(l).length} nhóm · ${cnt(l)} câu</small></button>`).join("")}
                        <button data-v="0" class="${!pref.level ? "on" : ""}">Trộn<small>${groups.length} nhóm</small></button>
                    </div>
                    <div class="g-synonyms-lbl">Số câu</div>
                    <div class="g-synonyms-seg" data-seg="count">
                        ${[10, 20].map(n => `<button data-v="${n}" class="${pref.count === n ? "on" : ""}">${n} câu</button>`).join("")}
                    </div>
                    <div class="g-synonyms-go">
                        <button class="btn btn-primary btn-lg" data-act="start">▶ Bắt đầu</button>
                        <button class="btn" data-act="list">📚 Xem danh sách (${groups.length} nhóm)</button>
                    </div></div>`;
            }

            // ------------------------------------------------ Chơi
            function buildQueue() {
                const pool = ofLevel(pref.level);
                const want = pref.count;
                // Mỗi nhóm lấy 1 câu trước cho đa dạng, thiếu thì lấy thêm câu khác của các nhóm.
                const firsts = [], rest = [];
                ctx.shuffle(pool.slice()).forEach(g => {
                    const its = ctx.shuffle(g.items.slice());
                    firsts.push({ g, it: its[0] });
                    its.slice(1).forEach(it => rest.push({ g, it }));
                });
                const picked = firsts.slice(0, want);
                if (picked.length < want) picked.push(...ctx.shuffle(rest).slice(0, want - picked.length));
                return ctx.shuffle(picked);
            }
            function startPlay() {
                queue = buildQueue(); qi = 0; correct = 0; total = queue.length; wrongGroups.clear();
                if (!total) { ctx.toast("Cấp này chưa có câu nào."); return; }
                view = "play"; nextQ();
            }
            function nextQ() {
                answered = null; showExp = false;
                const q = queue[qi];
                opts = ctx.shuffle(q.g.words.slice());
                renderPlay();
            }
            function renderPlay() {
                const q = queue[qi], g = q.g, it = q.it;
                const [pre, post] = it.sentence.split(BLANK);
                const done = answered != null, ok = answered === it.answer;
                const blank = done ? `<span class="g-synonyms-blank ${ok ? "ok" : "bad"}">${esc(it.answer)}</span>` : `<span class="g-synonyms-blank">？</span>`;
                const firstPass = Math.min(qi + 1, total);
                el.innerHTML = `
                    <div class="g-synonyms-top"><span>Câu <b>${q.retry ? "ôn lại" : firstPass + "/" + total}</b> ${q.retry ? `<span class="g-synonyms-retry">↻ hỏi lại</span>` : ""}</span>
                        <span>Đúng: <b>${correct}</b> ${lvBadge(g.level)}</span></div>
                    <div class="g-synonyms-bar"><i style="width:${Math.round(100 * Math.min(qi + (done ? 1 : 0), queue.length) / queue.length)}%"></i></div>
                    <div class="g-synonyms-sent">${esc(pre || "")}${blank}${esc(post || "")}</div>
                    <div class="g-synonyms-sub">${done ? `<span class="py">${esc(it.py || "")}</span>${esc(it.vi || "")}` : "Chọn từ phù hợp nhất cho chỗ trống"}</div>
                    <div class="g-synonyms-opts" style="--n:${opts.length}">${opts.map((w, k) => `<button class="g-synonyms-opt${done && w.hz === it.answer ? " ok" : ""}${done && w.hz === answered && !ok ? " bad" : ""}"
                        data-w="${esc(w.hz)}" ${done ? "disabled" : ""} aria-label="${k + 1}. ${esc(w.hz)}">${esc(w.hz)}<small>${esc(w.py || "")}</small></button>`).join("")}</div>
                    ${done ? `<div class="g-synonyms-why ${ok ? "ok" : "bad"}"><b>${ok ? "✅ Chính xác!" : `❌ Chưa đúng — đáp án: ${esc(it.answer)}`}</b>${esc(it.why || "")}</div>
                        ${showExp ? expHTML(g, it.answer) : ""}
                        <div class="g-synonyms-acts">
                            <button class="btn" data-act="exp">${showExp ? "▲ Ẩn phân biệt" : "📖 Xem phân biệt"}</button>
                            <button class="btn" data-act="say" aria-label="Nghe câu">🔊</button>
                            <button class="btn btn-primary" data-act="next">${qi + 1 < queue.length ? "Câu tiếp ▶" : "Xem kết quả"}</button>
                        </div>` : ""}`;
            }
            const fullSentence = it => it.sentence.replace(BLANK, it.answer);
            function choose(hz) {
                if (answered != null) return;
                const q = queue[qi], g = q.g, it = q.it;
                answered = hz;
                if (hz === it.answer) { if (!q.retry) correct++; }
                else {
                    if (!q.retry) queue.push({ g, it, retry: true });
                    if (!wrongGroups.has(g.id)) {
                        wrongGroups.set(g.id, { hz: g.words.map(w => w.hz).join("/"), py: g.words.map(w => w.py).join(" / "),
                            mean: g.words.map(w => `${w.hz}: ${w.mean}`).join(" · ") });
                    }
                }
                ctx.speak(fullSentence(it));
                renderPlay();
            }
            function next() {
                qi++;
                if (qi < queue.length) { nextQ(); return; }
                const retried = queue.length - total;
                ctx.finish({ score: correct * 10, correct, total, wrong: Array.from(wrongGroups.values()),
                    note: retried ? `Có ${retried} câu sai đã được hỏi lại ở cuối phiên.` : "Không sai câu nào!" });
            }

            // ------------------------------------------------ Danh sách
            function renderList() {
                view = "list";
                el.innerHTML = `
                    <button class="btn g-synonyms-back" data-act="menu">◀ Quay lại</button>
                    <div class="g-synonyms-list-tools">
                        <input class="g-synonyms-search" type="search" placeholder="Tìm chữ Hán, pinyin, Hán Việt, nghĩa…" value="${esc(pref.q)}" aria-label="Tìm nhóm từ">
                        <div class="g-synonyms-seg" data-seg="listLevel">
                            <button data-v="0" class="${!pref.listLevel ? "on" : ""}">Tất cả</button>
                            ${levels.map(l => `<button data-v="${l}" class="${pref.listLevel === l ? "on" : ""}">HSK ${l}</button>`).join("")}
                        </div>
                    </div>
                    <div class="g-synonyms-results"></div>`;
                const inp = el.querySelector(".g-synonyms-search");
                inp.addEventListener("input", e => { if (e.isComposing) return; pref.q = inp.value; renderResults(); });
                inp.addEventListener("compositionend", () => { pref.q = inp.value; renderResults(); });
                renderResults();
            }
            function renderResults() {
                const box = el.querySelector(".g-synonyms-results");
                if (!box) return;
                const q = pref.q.trim(), qn = noTone(q);
                const list = ofLevel(pref.listLevel).filter(g => !q || g.words.some(w =>
                    w.hz.includes(q) || noTone(w.py).replace(/\s/g, "").includes(qn.replace(/\s/g, "")) ||
                    noTone(w.hv).includes(qn) || noTone(w.mean).includes(qn)));
                box.innerHTML = `<div class="g-synonyms-count">${list.length} nhóm</div>` + (list.length ? list.map(g => `
                    <div class="g-synonyms-card">
                        <h3><span>${g.words.map(w => esc(w.hz)).join(" / ")}</span>${lvBadge(g.level)}</h3>
                        ${expHTML(g)}
                        <details><summary>Câu ví dụ (${g.items.length})</summary><ol>${g.items.map(it => `<li>
                            <span class="zh">${esc(fullSentence(it))}</span> <button class="btn btn-sm" data-say="${esc(fullSentence(it))}" aria-label="Nghe">🔊</button>
                            <div class="vi">${esc(it.vi || "")}</div></li>`).join("")}</ol></details>
                    </div>`).join("") : `<div class="g-synonyms-empty">Không tìm thấy nhóm nào.</div>`);
            }

            // ------------------------------------------------ Sự kiện
            const onClick = e => {
                const b = e.target.closest("button");
                if (!b || b.disabled || !el.contains(b)) return;
                const seg = b.closest("[data-seg]");
                if (seg) {
                    pref[seg.dataset.seg] = +b.dataset.v;
                    seg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
                    if (seg.dataset.seg === "listLevel") renderResults();
                    return;
                }
                if (b.dataset.say != null) { ctx.speak(b.dataset.say); return; }
                if (b.dataset.w != null) { choose(b.dataset.w); return; }
                const act = b.dataset.act;
                if (act === "start") startPlay();
                else if (act === "list") renderList();
                else if (act === "menu") renderMenu();
                else if (act === "exp") { showExp = !showExp; renderPlay(); }
                else if (act === "say") ctx.speak(fullSentence(queue[qi].it));
                else if (act === "next") next();
            };
            // Phím tắt máy tính: 1–3 chọn đáp án, Enter/→ sang câu, X mở phân biệt.
            const onKey = e => {
                if (view !== "play" || e.ctrlKey || e.metaKey || e.altKey) return;
                if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
                if (answered == null) {
                    const k = +e.key;
                    if (k >= 1 && k <= opts.length) { e.preventDefault(); choose(opts[k - 1].hz); }
                } else if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); next(); }
                else if (e.key === "x" || e.key === "X") { showExp = !showExp; renderPlay(); }
            };
            el.addEventListener("click", onClick);
            document.addEventListener("keydown", onKey);
            ctx.onCleanup(() => { el.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); });
            renderMenu();
        }
    });
})();
