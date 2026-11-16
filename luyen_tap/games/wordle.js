/* Trò chơi: Wordle chữ Hán — đoán từ 2 chữ trong 5 lượt (ý tưởng từ startHanziWordle ở tuvung). */
(function () {
    "use strict";
    const ID = "wordle", ROUNDS = 3, TRIES = 5, KEYS = 12;
    const HZ2 = /^[一-鿿]{2}$/;

    function css() {
        if (document.getElementById("g-wordle-css")) return;
        const s = document.createElement("style");
        s.id = "g-wordle-css";
        s.textContent = `
.g-wordle-top { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; font-size:14px; color:var(--ui-muted); margin-bottom:10px; }
.g-wordle-top b { color:var(--ui-text); }
.g-wordle-legend { font-size:12.5px; color:var(--ui-muted); text-align:center; margin-bottom:10px; }
.g-wordle-hints { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-bottom:8px; }
.g-wordle-hint { text-align:center; min-height:22px; font-size:15px; color:var(--ui-text-2); margin-bottom:10px; }
.g-wordle-hint .py { color:var(--ui-pinyin); font-weight:600; }
.g-wordle-board { display:grid; gap:6px; justify-content:center; margin-bottom:10px; }
.g-wordle-row { display:flex; gap:6px; }
.g-wordle-tile { width:56px; height:56px; border:2px solid var(--ui-border); border-radius:10px; display:flex; align-items:center; justify-content:center;
  font-family:var(--ui-font-cn); font-size:30px; background:var(--ui-surface); color:var(--ui-text); }
.g-wordle-tile.cur { border-color:var(--ui-primary); }
.g-wordle-tile.ok, .g-wordle-key.ok { background:var(--ui-success); border-color:var(--ui-success); color:#fff; }
.g-wordle-tile.near, .g-wordle-key.near { background:var(--ui-warning); border-color:var(--ui-warning); color:#fff; }
.g-wordle-tile.no, .g-wordle-key.no { background:var(--ui-surface-3); border-color:var(--ui-surface-3); color:var(--ui-muted); }
.g-wordle-msg { text-align:center; min-height:24px; font-weight:600; margin-bottom:8px; }
.g-wordle-msg.ok { color:var(--ui-success); } .g-wordle-msg.bad { color:var(--ui-danger); }
.g-wordle-keys { display:grid; grid-template-columns:repeat(6, 1fr); gap:6px; max-width:420px; margin:0 auto 10px; }
.g-wordle-key { min-height:48px; border:1px solid var(--ui-border-strong); border-radius:10px; background:var(--ui-surface-2); color:var(--ui-text);
  font-family:var(--ui-font-cn); font-size:24px; cursor:pointer; }
.g-wordle-key:active { transform:scale(.95); }
.g-wordle-acts { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; }
.g-wordle-acts .btn { min-height:44px; }
@media (max-width:380px) { .g-wordle-tile { width:50px; height:50px; font-size:26px; } .g-wordle-key { font-size:21px; } }`;
        document.head.appendChild(s);
    }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: ID, order: 8, ic: "🟩", name: "Wordle chữ Hán",
        desc: "Đoán từ 2 chữ trong 5 lượt; ô xanh/vàng/xám cho biết chữ đúng chỗ, sai chỗ hay không có.",
        unit: " điểm", minWords: 8,
        start(ctx) {
            css();
            const esc = ctx.esc;
            const pool = ctx.words.filter(w => HZ2.test(w.hz));
            if (pool.length < 4) {
                ctx.el.innerHTML = `<p class="muted">Cần ít nhất 4 từ gồm 2 chữ Hán trong nguồn từ để chơi trò này.</p>`;
                return;
            }
            const targets = ctx.shuffle(pool.slice()).slice(0, Math.min(ROUNDS, pool.length));
            let r = 0, score = 0, correct = 0;
            const wrong = [];
            let target, keys, rows, input, over, hints;

            function newRound() {
                target = targets[r];
                rows = []; input = []; over = false; hints = 0;
                // Bàn phím: 2 chữ đúng + chữ nhiễu lấy từ các từ khác
                const set = new Set(target.hz.split(""));
                for (const w of ctx.shuffle(pool.slice())) {
                    for (const c of w.hz) { if (set.size < KEYS) set.add(c); }
                    if (set.size >= KEYS) break;
                }
                keys = ctx.shuffle(Array.from(set));
                render();
            }
            function keyState(c) {
                let st = "";
                rows.forEach(row => row.forEach(x => {
                    if (x.c !== c) return;
                    if (x.s === "ok") st = "ok";
                    else if (x.s === "near" && st !== "ok") st = "near";
                    else if (!st) st = "no";
                }));
                return st;
            }
            function render(msg, cls) {
                const board = [];
                for (let i = 0; i < TRIES; i++) {
                    const row = rows[i];
                    const isCur = !over && i === rows.length;
                    board.push(`<div class="g-wordle-row">${[0, 1].map(j => {
                        if (row) return `<div class="g-wordle-tile ${row[j].s}">${esc(row[j].c)}</div>`;
                        const c = isCur ? (input[j] || "") : "";
                        return `<div class="g-wordle-tile${isCur ? " cur" : ""}">${esc(c)}</div>`;
                    }).join("")}</div>`);
                }
                let hint = "";
                if (hints >= 1 || over) hint += `Nghĩa: <b>${esc(target.mean)}</b>`;
                if (hints >= 2 || over) hint += ` · <span class="py">${esc(target.py || "")}</span>`;
                ctx.el.innerHTML = `
                    <div class="g-wordle-top"><span>Từ <b>${r + 1}/${targets.length}</b> · Lượt <b>${Math.min(rows.length + 1, TRIES)}/${TRIES}</b></span><span>Điểm: <b>${score}</b></span></div>
                    <div class="g-wordle-legend">🟩 đúng chữ, đúng chỗ · 🟨 có trong từ nhưng sai chỗ · ⬜ không có</div>
                    <div class="g-wordle-hints">
                        <button class="btn btn-sm" data-act="hint" ${hints >= 2 || over ? "disabled" : ""}>💡 ${hints ? "Gợi ý pinyin" : "Gợi ý nghĩa"} (−10)</button>
                    </div>
                    <div class="g-wordle-hint">${hint}</div>
                    <div class="g-wordle-board">${board.join("")}</div>
                    <div class="g-wordle-msg ${cls || ""}">${msg || ""}</div>
                    ${over ? `<div class="g-wordle-acts"><button class="btn" data-act="say">🔊 Nghe</button>
                        <button class="btn btn-primary" data-act="next">${r + 1 < targets.length ? "Từ tiếp ▶" : "Xem kết quả"}</button></div>`
                    : `<div class="g-wordle-keys">${keys.map((c, i) => `<button class="g-wordle-key ${keyState(c)}" data-k="${i}">${esc(c)}</button>`).join("")}</div>
                       <div class="g-wordle-acts"><button class="btn" data-act="del">⌫ Xóa</button>
                       <button class="btn btn-primary" data-act="enter" ${input.length < 2 ? "disabled" : ""}>Đoán ↵</button>
                       <button class="btn btn-ghost" data-act="give">Bỏ cuộc</button></div>`}`;
            }
            function submit() {
                if (over || input.length < 2) return;
                const t = target.hz.split("");
                const row = input.map(c => ({ c, s: "no" }));
                const left = t.slice();
                row.forEach((x, i) => { if (x.c === t[i]) { x.s = "ok"; left[i] = null; } });
                row.forEach((x, i) => {
                    if (x.s === "ok") return;
                    const k = left.indexOf(x.c);
                    if (k >= 0) { x.s = "near"; left[k] = null; }
                });
                rows.push(row); input = [];
                if (row.every(x => x.s === "ok")) {
                    over = true; correct++;
                    const pts = Math.max(10, (TRIES - rows.length + 1) * 20 - hints * 10);
                    score += pts;
                    ctx.speak(target.hz);
                    render(`🎉 Chính xác! +${pts} điểm`, "ok");
                } else if (rows.length >= TRIES) {
                    lose("Hết lượt!");
                } else render();
            }
            function lose(why) {
                over = true;
                wrong.push({ hz: target.hz, py: target.py, mean: target.mean });
                ctx.speak(target.hz);
                render(`${why} Đáp án: ${esc(target.hz)}`, "bad");
            }
            const onClick = e => {
                const b = e.target.closest("button");
                if (!b || b.disabled) return;
                if (b.dataset.k != null) {
                    if (!over && input.length < 2) { input.push(keys[+b.dataset.k]); render(); }
                    return;
                }
                const a = b.dataset.act;
                if (a === "del") { input.pop(); render(); }
                else if (a === "enter") submit();
                else if (a === "hint") { hints++; render(); }
                else if (a === "give") lose("Đã bỏ cuộc.");
                else if (a === "say") ctx.speak(target.hz);
                else if (a === "next") {
                    r++;
                    if (r < targets.length) newRound();
                    else ctx.finish({ score, correct, total: targets.length, wrong, note: `Đoán được ${correct}/${targets.length} từ.` });
                }
            };
            ctx.el.addEventListener("click", onClick);
            ctx.onCleanup(() => ctx.el.removeEventListener("click", onClick));
            // Phím tắt máy tính: Backspace xóa, Enter đoán
            const onKey = e => {
                if (e.key === "Backspace" && !over) { input.pop(); render(); e.preventDefault(); return; }
                if (e.key !== "Enter" || e.isComposing) return;
                if (e.target && e.target.tagName === "BUTTON") return;   // nút đang focus tự xử lý Enter
                e.preventDefault();
                if (over) { const n = ctx.el.querySelector('[data-act="next"]'); if (n) n.click(); }
                else submit();
            };
            document.addEventListener("keydown", onKey);
            ctx.onCleanup(() => document.removeEventListener("keydown", onKey));
            newRound();
        }
    });
})();
