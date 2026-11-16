/* Trò chơi: Ghép bộ thủ — chọn các bộ phận ghép thành chữ theo nghĩa/pinyin
   (ý tưởng từ startRadicalAlchemy ở tuvung, dữ liệu ctx.data.radicals). */
(function () {
    "use strict";
    const ID = "radicals", ROUNDS = 8, TILES = 6;

    function css() {
        if (document.getElementById("g-radicals-css")) return;
        const s = document.createElement("style");
        s.id = "g-radicals-css";
        s.textContent = `
.g-radicals-top { display:flex; justify-content:space-between; font-size:14px; color:var(--ui-muted); margin-bottom:12px; }
.g-radicals-top b { color:var(--ui-text); }
.g-radicals-q { text-align:center; margin-bottom:12px; }
.g-radicals-q .lbl { font-size:13px; color:var(--ui-muted); }
.g-radicals-q .vi { font-size:20px; font-weight:700; }
.g-radicals-q .py { color:var(--ui-pinyin); font-size:16px; }
.g-radicals-eq { display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
.g-radicals-slot { width:60px; height:60px; border:2px dashed var(--ui-border-strong); border-radius:12px; background:var(--ui-surface-2); color:var(--ui-text);
  font-family:var(--ui-font-cn); font-size:32px; cursor:pointer; padding:0; }
.g-radicals-slot.full { border-style:solid; border-color:var(--ui-primary); background:var(--ui-primary-soft); }
.g-radicals-op { font-size:22px; color:var(--ui-muted); }
.g-radicals-res { width:72px; height:72px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-family:var(--ui-font-cn); font-size:44px;
  background:var(--ui-surface-3); color:var(--ui-muted); }
.g-radicals-res.ok { background:var(--ui-success-soft); color:var(--ui-success); }
.g-radicals-res.bad { background:var(--ui-danger-soft); color:var(--ui-danger); }
.g-radicals-tiles { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; max-width:360px; margin:0 auto 14px; }
.g-radicals-tile { min-height:58px; border:1px solid var(--ui-border-strong); border-radius:12px; background:var(--ui-surface); color:var(--ui-text);
  font-family:var(--ui-font-cn); font-size:30px; cursor:pointer; }
.g-radicals-tile:disabled { opacity:.35; cursor:default; }
.g-radicals-exp { background:var(--ui-surface-2); border:1px solid var(--ui-border); border-radius:12px; padding:12px; font-size:15px; line-height:1.55; margin-bottom:12px; text-align:center; }
.g-radicals-exp.ok { border-color:var(--ui-success); } .g-radicals-exp.bad { border-color:var(--ui-danger); }
.g-radicals-acts { display:flex; justify-content:center; gap:8px; }
.g-radicals-acts .btn { min-height:44px; }`;
        document.head.appendChild(s);
    }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: ID, order: 14, ic: "⚗️", name: "Ghép bộ thủ",
        desc: "Chọn các bộ phận ghép thành chữ Hán theo nghĩa và pinyin, xem giải thích cấu tạo chữ (bộ chữ Boya viết sẵn).",
        unit: " điểm", ownData: true,
        start(ctx) {
            css();
            const esc = ctx.esc;
            const data = ctx.data.radicals || [];
            if (!data.length) { ctx.el.innerHTML = `<p class="muted">Chưa có dữ liệu bộ thủ.</p>`; return; }
            const items = ctx.shuffle(data.slice()).slice(0, Math.min(ROUNDS, data.length));
            const allParts = Array.from(new Set(data.reduce((a, d) => a.concat(d.parts), [])));
            let i = 0, correct = 0, it, tiles, slots, done, ok;
            const wrong = [];
            const key = arr => arr.slice().sort().join("+");

            function newQ() {
                it = items[i];
                // Ô chọn: các bộ phận đúng (kể cả trùng như 木+木) + bộ phận nhiễu
                const extra = ctx.shuffle(allParts.filter(p => !it.parts.includes(p))).slice(0, Math.max(0, TILES - it.parts.length));
                tiles = ctx.shuffle(it.parts.concat(extra)).map(p => ({ p, used: false }));
                slots = it.parts.map(() => -1);
                done = false;
                render();
            }
            function render() {
                const filled = slots.every(s => s >= 0);
                ctx.el.innerHTML = `
                    <div class="g-radicals-top"><span>Chữ <b>${i + 1}/${items.length}</b></span><span>Đúng: <b>${correct}</b></span></div>
                    <div class="g-radicals-q"><div class="lbl">Ghép thành chữ có nghĩa</div><div class="vi">${esc(it.mean)}</div><div class="py">${esc(it.pinyin || "")}</div></div>
                    <div class="g-radicals-eq">${slots.map((s, k) => `${k ? '<span class="g-radicals-op">+</span>' : ""}<button class="g-radicals-slot${s >= 0 ? " full" : ""}" data-s="${k}" ${done ? "disabled" : ""}>${s >= 0 ? esc(tiles[s].p) : ""}</button>`).join("")}
                        <span class="g-radicals-op">=</span><div class="g-radicals-res${done ? (ok ? " ok" : " bad") : ""}">${done ? esc(it.target) : "?"}</div></div>
                    ${done ? `<div class="g-radicals-exp ${ok ? "ok" : "bad"}">${ok ? "🎉 Chính xác! " : `✘ Đáp án: ${esc(it.parts.join(" + "))}. `}${esc(it.explain || "")}</div>
                        <div class="g-radicals-acts"><button class="btn" data-act="say">🔊 ${esc(it.target)}</button><button class="btn btn-primary" data-act="next">${i + 1 < items.length ? "Chữ tiếp ▶" : "Xem kết quả"}</button></div>`
                    : `<div class="g-radicals-tiles">${tiles.map((t, k) => `<button class="g-radicals-tile" data-t="${k}" ${t.used ? "disabled" : ""}>${esc(t.p)}</button>`).join("")}</div>
                        <div class="g-radicals-acts"><button class="btn btn-ghost" data-act="skip">Bỏ qua</button><button class="btn btn-primary" data-act="check" ${filled ? "" : "disabled"}>Ghép ✓</button></div>`}`;
            }
            function check(skip) {
                done = true;
                ok = !skip && key(slots.map(s => tiles[s].p)) === key(it.parts);
                if (ok) correct++;
                else wrong.push({ hz: it.target, py: it.pinyin, mean: `${it.mean} (${it.parts.join(" + ")})` });
                ctx.speak(it.target);
                render();
            }
            const onClick = e => {
                const b = e.target.closest("button");
                if (!b || b.disabled) return;
                if (b.dataset.t != null) {
                    const k = +b.dataset.t, free = slots.indexOf(-1);
                    if (free < 0) return;
                    slots[free] = k; tiles[k].used = true; render();
                } else if (b.dataset.s != null) {
                    const k = +b.dataset.s;
                    if (slots[k] >= 0) { tiles[slots[k]].used = false; slots[k] = -1; render(); }
                } else {
                    const a = b.dataset.act;
                    if (a === "check") check(false);
                    else if (a === "skip") check(true);
                    else if (a === "say") ctx.speak(it.target);
                    else if (a === "next") {
                        i++;
                        if (i < items.length) newQ();
                        else ctx.finish({ score: correct * 10, correct, total: items.length, wrong });
                    }
                }
            };
            ctx.el.addEventListener("click", onClick);
            ctx.onCleanup(() => ctx.el.removeEventListener("click", onClick));
            newQ();
        }
    });
})();
