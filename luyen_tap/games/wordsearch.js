/* Trò chơi: Tìm chữ — lưới 7×7 giấu các từ 2 chữ (ngang/dọc), chạm 2 ô liền nhau để chọn (ý tưởng từ startHanziWordSearch ở tuvung). */
(function () {
    "use strict";
    const ID = "wordsearch", N = 7;
    const HZ2 = /^[一-鿿]{2}$/;

    function css() {
        if (document.getElementById("g-wordsearch-css")) return;
        const s = document.createElement("style");
        s.id = "g-wordsearch-css";
        s.textContent = `
.g-wordsearch-top { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; font-size:14px; color:var(--ui-muted); margin-bottom:8px; }
.g-wordsearch-top b { color:var(--ui-text); }
.g-wordsearch-help { font-size:13px; color:var(--ui-muted); text-align:center; margin-bottom:10px; }
.g-wordsearch-grid { display:grid; grid-template-columns:repeat(${N}, 1fr); gap:4px; max-width:400px; margin:0 auto 12px; }
.g-wordsearch-cell { aspect-ratio:1; min-height:42px; border:1px solid var(--ui-border); border-radius:8px; background:var(--ui-surface);
  color:var(--ui-text); font-family:var(--ui-font-cn); font-size:clamp(20px, 6vw, 28px); cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center; }
.g-wordsearch-cell.sel { background:var(--ui-primary); border-color:var(--ui-primary); color:var(--ui-on-primary); }
.g-wordsearch-cell.found { background:var(--ui-success-soft); border-color:var(--ui-success); color:var(--ui-success); }
.g-wordsearch-cell.hint { box-shadow:0 0 0 3px var(--ui-warning) inset; }
.g-wordsearch-cell.bad { background:var(--ui-danger-soft); border-color:var(--ui-danger); animation:g-wordsearch-shake .3s; }
@keyframes g-wordsearch-shake { 25% { transform:translateX(-3px); } 75% { transform:translateX(3px); } }
.g-wordsearch-list { list-style:none; padding:0; margin:0 0 12px; display:grid; gap:6px; }
.g-wordsearch-list li { display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--ui-border); border-radius:10px; background:var(--ui-surface-2); font-size:14.5px; }
.g-wordsearch-list li span { flex:1; }
.g-wordsearch-list li.done { border-color:var(--ui-success); background:var(--ui-success-soft); }
.g-wordsearch-list li .zh { font-family:var(--ui-font-cn); font-size:20px; color:var(--ui-success); }
.g-wordsearch-list li .py { color:var(--ui-pinyin); font-size:13px; }
.g-wordsearch-acts { display:flex; gap:8px; justify-content:center; }
.g-wordsearch-acts .btn { min-height:44px; }`;
        document.head.appendChild(s);
    }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: ID, order: 9, ic: "🔎", name: "Tìm chữ",
        desc: "Tìm các từ 2 chữ giấu trong lưới 7×7 theo nghĩa cho sẵn; chạm 2 ô liền nhau để chọn.",
        unit: " điểm", minWords: 8,
        start(ctx) {
            css();
            const esc = ctx.esc;
            // Lấy 5 từ 2 chữ khác nhau (không trùng chữ Hán, nghĩa khác nhau)
            const seen = new Set(), words = [];
            for (const w of ctx.words) {
                if (!HZ2.test(w.hz) || seen.has(w.hz) || w.hz[0] === w.hz[1]) continue;
                seen.add(w.hz); words.push(w);
                if (words.length >= 5) break;
            }
            if (words.length < 3) { ctx.el.innerHTML = `<p class="muted">Cần ít nhất 3 từ gồm 2 chữ Hán để chơi trò này.</p>`; return; }

            // Đặt từ vào lưới: ngang (dx=1) hoặc dọc (dy=1), không chồng lên nhau
            let grid, placed;
            for (let attempt = 0; attempt < 50; attempt++) {
                grid = Array(N * N).fill(null); placed = [];
                for (const w of words) {
                    for (let t = 0; t < 100; t++) {
                        const hor = Math.random() < .5;
                        const x = Math.floor(Math.random() * (hor ? N - 1 : N)), y = Math.floor(Math.random() * (hor ? N : N - 1));
                        const a = y * N + x, b = a + (hor ? 1 : N);
                        if (grid[a] || grid[b]) continue;
                        grid[a] = w.hz[0]; grid[b] = w.hz[1];
                        placed.push({ w, cells: [a, b], found: false, hint: false });
                        break;
                    }
                }
                if (placed.length === words.length) break;
            }
            // Chữ lấp chỗ trống: lấy từ các từ khác trong pool
            const fill = [];
            ctx.words.forEach(w => { for (const c of w.hz) if (/[一-鿿]/.test(c)) fill.push(c); });
            for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = fill[Math.floor(Math.random() * fill.length)] || "的";
            ctx.shuffle(placed);

            const t0 = Date.now();
            let sel = -1, mistakes = 0, hints = 0, ended = false;

            function render() {
                const found = placed.filter(p => p.found).length;
                const foundCells = new Set(), hintCells = new Set();
                placed.forEach(p => { if (p.found) p.cells.forEach(c => foundCells.add(c)); else if (p.hint) hintCells.add(p.cells[0]); });
                ctx.el.innerHTML = `
                    <div class="g-wordsearch-top"><span>Đã tìm <b>${found}/${placed.length}</b></span><span>Sai: <b>${mistakes}</b> · ⏱ <b id="g-wordsearch-time">0</b>s</span></div>
                    <div class="g-wordsearch-help">Chạm chữ đầu rồi chạm chữ ngay bên phải hoặc bên dưới.</div>
                    <div class="g-wordsearch-grid">${grid.map((c, i) => `<button class="g-wordsearch-cell${foundCells.has(i) ? " found" : ""}${hintCells.has(i) ? " hint" : ""}${i === sel ? " sel" : ""}" data-i="${i}">${esc(c)}</button>`).join("")}</div>
                    <ul class="g-wordsearch-list">${placed.map((p, k) => p.found
                        ? `<li class="done">✅ <b class="zh">${esc(p.w.hz)}</b><span>${esc(p.w.mean)} <em class="py">${esc(p.w.py || "")}</em></span></li>`
                        : `<li>🔍 <span>${esc(p.w.mean)}</span><button class="btn btn-sm" data-hint="${k}" ${p.hint ? "disabled" : ""}>💡</button></li>`).join("")}</ul>
                    <div class="g-wordsearch-acts"><button class="btn btn-ghost" data-act="give">Bỏ cuộc</button></div>`;
                tick();
            }
            function tick() {
                const t = ctx.el.querySelector("#g-wordsearch-time");
                if (t) t.textContent = Math.floor((Date.now() - t0) / 1000);
            }
            function end(gaveUp) {
                if (ended) return;
                ended = true;
                const found = placed.filter(p => p.found).length;
                const secs = Math.round((Date.now() - t0) / 1000);
                const bonus = gaveUp ? 0 : Math.max(0, 120 - secs);
                const score = Math.max(0, found * 20 + bonus - mistakes * 5 - hints * 10);
                ctx.finish({
                    score, correct: found, total: placed.length,
                    wrong: placed.filter(p => !p.found || p.hint).map(p => ({ hz: p.w.hz, py: p.w.py, mean: p.w.mean })),
                    note: `Thời gian ${secs} giây, chọn sai ${mistakes} lần.`,
                });
            }
            function pickCell(i) {
                if (sel < 0) { sel = i; render(); return; }
                if (sel === i) { sel = -1; render(); return; }
                const a = Math.min(sel, i), b = Math.max(sel, i);
                const adj = (b - a === 1 && Math.floor(a / N) === Math.floor(b / N)) || b - a === N;
                if (!adj) { sel = i; render(); return; }      // không liền nhau → coi như chọn lại từ đầu
                const str = grid[a] + grid[b];
                const hit = placed.find(p => !p.found && p.w.hz === str);
                sel = -1;
                if (hit) {
                    hit.found = true; hit.cells = [a, b];
                    ctx.speak(hit.w.hz);
                    render();
                    if (placed.every(p => p.found)) ctx.setTimeout(() => end(false), 700);
                } else {
                    mistakes++;
                    render();
                    [a, b].forEach(c => { const el = ctx.el.querySelector(`[data-i="${c}"]`); if (el) el.classList.add("bad"); });
                }
            }
            const onClick = e => {
                const b = e.target.closest("button");
                if (!b || b.disabled || ended) return;
                if (b.dataset.i != null) pickCell(+b.dataset.i);
                else if (b.dataset.hint != null) { placed[+b.dataset.hint].hint = true; hints++; render(); }
                else if (b.dataset.act === "give") end(true);
            };
            ctx.el.addEventListener("click", onClick);
            ctx.onCleanup(() => ctx.el.removeEventListener("click", onClick));
            ctx.setInterval(tick, 1000);
            render();
        }
    });
})();
