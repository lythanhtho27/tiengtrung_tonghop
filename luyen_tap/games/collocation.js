/* Trò chơi: Kết hợp từ — ghép từ cột trái với cột phải thành cụm đúng, 3 vòng × 5 cặp
   (ý tưởng từ startCollocationGame ở tuvung, dữ liệu ctx.data.collocations). */
(function () {
    "use strict";
    const ID = "collocation", ROUNDS = 3, PAIRS = 5;

    function css() {
        if (document.getElementById("g-collocation-css")) return;
        const s = document.createElement("style");
        s.id = "g-collocation-css";
        s.textContent = `
.g-collocation-top { display:flex; justify-content:space-between; font-size:14px; color:var(--ui-muted); margin-bottom:6px; }
.g-collocation-top b { color:var(--ui-text); }
.g-collocation-help { text-align:center; font-size:13px; color:var(--ui-muted); margin-bottom:12px; }
.g-collocation-cols { display:grid; grid-template-columns:1fr 1fr; gap:10px 14px; }
.g-collocation-col { display:grid; gap:8px; align-content:start; }
.g-collocation-it { min-height:54px; border:1px solid var(--ui-border-strong); border-radius:12px; background:var(--ui-surface); color:var(--ui-text);
  font-family:var(--ui-font-cn); font-size:24px; cursor:pointer; padding:4px; }
.g-collocation-it.sel { background:var(--ui-primary); border-color:var(--ui-primary); color:var(--ui-on-primary); }
.g-collocation-it.done { background:var(--ui-success-soft); border-color:var(--ui-success); color:var(--ui-success); cursor:default; }
.g-collocation-it.bad { background:var(--ui-danger-soft); border-color:var(--ui-danger); animation:g-collocation-shake .3s; }
@keyframes g-collocation-shake { 25% { transform:translateX(-4px); } 75% { transform:translateX(4px); } }
.g-collocation-log { list-style:none; padding:0; margin:14px 0 0; display:grid; gap:4px; font-size:14px; }
.g-collocation-log li { padding:6px 10px; border-radius:10px; background:var(--ui-surface-2); }
.g-collocation-log .zh { font-family:var(--ui-font-cn); font-size:17px; font-weight:700; }
.g-collocation-log .py { color:var(--ui-pinyin); }`;
        document.head.appendChild(s);
    }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: ID, order: 13, ic: "🧩", name: "Kết hợp từ",
        desc: "Ghép động từ/tính từ ở cột trái với từ ở cột phải thành cụm đúng, 3 vòng × 5 cặp (bộ cụm từ Boya viết sẵn).",
        unit: " điểm", ownData: true,
        start(ctx) {
            css();
            const esc = ctx.esc;
            const data = ctx.data.collocations || [];
            if (data.length < PAIRS) { ctx.el.innerHTML = `<p class="muted">Chưa đủ dữ liệu cụm từ.</p>`; return; }
            const valid = new Set(data.map(c => c.left + "|" + c.right));   // một từ có thể ghép đúng với nhiều từ
            // Chia vòng: mỗi vòng 5 cặp, không trùng chữ ở cùng một cột
            const pool = ctx.shuffle(data.slice());
            const rounds = [];
            for (let r = 0; r < ROUNDS; r++) {
                const set = [], L = new Set(), R = new Set();
                for (let k = 0; k < pool.length && set.length < PAIRS; k++) {
                    const c = pool[k];
                    if (L.has(c.left) || R.has(c.right)) continue;
                    // Tránh cặp chéo cũng đúng (dễ kẹt ở cuối vòng): chỉ cặp được chọn là hợp lệ trong vòng
                    if (set.some(x => valid.has(c.left + "|" + x.right) || valid.has(x.left + "|" + c.right))) continue;
                    L.add(c.left); R.add(c.right); set.push(c); pool.splice(k--, 1);
                }
                if (set.length >= 3) rounds.push(set);
            }
            let r = 0, mistakes = 0, matched = 0, selL = -1, selR = -1, cur, lefts, rights, log;
            const t0 = Date.now();
            const wrong = [], missed = new Set();

            function newRound() {
                cur = rounds[r];
                lefts = ctx.shuffle(cur.map(c => ({ hz: c.left, done: false })));
                rights = ctx.shuffle(cur.map(c => ({ hz: c.right, done: false })));
                log = []; selL = selR = -1;
                render();
            }
            function render(bad) {
                const btn = (side, x, k) => `<button class="g-collocation-it${x.done ? " done" : ""}${(side === "l" ? selL : selR) === k ? " sel" : ""}${bad && bad[side] === k ? " bad" : ""}" data-${side}="${k}" ${x.done ? "disabled" : ""}>${esc(x.hz)}</button>`;
                ctx.el.innerHTML = `
                    <div class="g-collocation-top"><span>Vòng <b>${r + 1}/${rounds.length}</b></span><span>Đã ghép <b>${matched}</b> · Sai <b>${mistakes}</b></span></div>
                    <div class="g-collocation-help">Chạm một từ bên trái rồi một từ bên phải để tạo cụm từ đúng.</div>
                    <div class="g-collocation-cols">
                        <div class="g-collocation-col">${lefts.map((x, k) => btn("l", x, k)).join("")}</div>
                        <div class="g-collocation-col">${rights.map((x, k) => btn("r", x, k)).join("")}</div>
                    </div>
                    <ul class="g-collocation-log">${log.map(c => `<li>✅ <span class="zh">${esc(c.left)}${esc(c.right)}</span> <span class="py">${esc(c.py || "")}</span> — ${esc(c.mean || "")}</li>`).join("")}</ul>`;
            }
            function tryPair() {
                if (selL < 0 || selR < 0) { render(); return; }
                const l = lefts[selL], rr = rights[selR];
                if (valid.has(l.hz + "|" + rr.hz)) {
                    l.done = rr.done = true; matched++;
                    const c = data.find(x => x.left === l.hz && x.right === rr.hz);
                    log.unshift(c);
                    ctx.speak(c.left + c.right);
                    selL = selR = -1;
                    render();
                    if (lefts.every(x => x.done)) {
                        r++;
                        ctx.setTimeout(() => { if (r < rounds.length) newRound(); else end(); }, 900);
                    }
                } else {
                    mistakes++;
                    // Ghi lại cụm đúng của từ bên trái để xem lại
                    const c = cur.find(x => x.left === l.hz);
                    if (c) { wrong.push({ hz: c.left + c.right, py: c.py, mean: c.mean }); missed.add(c.left); }
                    const bad = { l: selL, r: selR };
                    selL = selR = -1;
                    render(bad);
                }
            }
            function end() {
                const total = rounds.reduce((n, s) => n + s.length, 0);
                const secs = Math.round((Date.now() - t0) / 1000);
                const score = Math.max(0, matched * 10 - mistakes * 3 + Math.max(0, 90 - secs));
                ctx.finish({ score, correct: total - missed.size, total, wrong, note: `Thời gian ${secs} giây, ghép sai ${mistakes} lần.` });
            }
            const onClick = e => {
                const b = e.target.closest("button");
                if (!b || b.disabled) return;
                if (b.dataset.l != null) { const k = +b.dataset.l; selL = selL === k ? -1 : k; ctx.speak(lefts[k].hz); tryPair(); }
                else if (b.dataset.r != null) { const k = +b.dataset.r; selR = selR === k ? -1 : k; ctx.speak(rights[k].hz); tryPair(); }
            };
            ctx.el.addEventListener("click", onClick);
            ctx.onCleanup(() => ctx.el.removeEventListener("click", onClick));
            newRound();
        }
    });
})();
