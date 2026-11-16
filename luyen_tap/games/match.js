// Trò "Ghép thẻ": lưới thẻ chữ Hán ↔ nghĩa, 3 vòng × 6 cặp, điểm theo tốc độ và độ chính xác
(function () {
    "use strict";
    const ROUNDS = 3, PAIRS = 6;

    function css() {
        if (document.getElementById("g-match-css")) return;
        const s = document.createElement("style");
        s.id = "g-match-css";
        s.textContent = `
.g-match-hud { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 12px; font-weight: 600; font-size: 14px; color: var(--ui-text-2); }
.g-match-hud b { color: var(--ui-text); }
.g-match-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
@media (min-width: 640px) { .g-match-grid { grid-template-columns: repeat(4, 1fr); } }
.g-match-tile { min-height: 76px; padding: 8px 6px; border-radius: 12px; border: 2px solid var(--ui-border); background: var(--ui-surface-2); color: var(--ui-text); cursor: pointer; font-size: 14px; line-height: 1.3; display: flex; align-items: center; justify-content: center; text-align: center; word-break: break-word; transition: border-color .15s, background .15s, transform .15s; }
.g-match-tile.hz { font-family: var(--ui-font-cn); font-size: 24px; font-weight: 600; }
.g-match-tile.sel { border-color: var(--ui-primary); background: var(--ui-primary-soft); transform: scale(1.03); }
.g-match-tile.bad { border-color: var(--ui-danger); background: var(--ui-danger-soft); animation: g-match-shake .3s; }
.g-match-tile.done { visibility: hidden; }
@keyframes g-match-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
.g-match-msg { text-align: center; margin-top: 12px; min-height: 22px; color: var(--ui-success); font-weight: 600; }`;
        document.head.appendChild(s);
    }

    function short(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: "match", order: 1, ic: "🃏", name: "Ghép thẻ",
        desc: "Ghép chữ Hán với nghĩa, càng nhanh càng chính xác càng nhiều điểm.",
        unit: " điểm", minWords: 6,
        start(ctx) {
            css();
            const { esc } = ctx;
            // Bỏ các từ trùng nghĩa để một nghĩa chỉ khớp một chữ
            const seen = new Set(), list = [];
            for (const w of ctx.words) { if (seen.has(w.mean) || seen.has("hz:" + w.hz)) continue; seen.add(w.mean); seen.add("hz:" + w.hz); list.push(w); }
            const rounds = Math.max(1, Math.min(ROUNDS, Math.floor(list.length / PAIRS)));
            const t0 = Date.now();
            let round = 0, mistakes = 0, matched = 0, totalPairs = 0;
            const wrong = [];
            ctx.el.innerHTML = `<div class="g-match-hud"><span>Vòng <b id="gm-r">1</b>/${rounds}</span><span>⏱ <b id="gm-t">0</b>s</span><span>Sai <b id="gm-m">0</b></span></div>
                <div class="g-match-grid" id="gm-grid"></div><div class="g-match-msg" id="gm-msg"></div>`;
            const $ = id => ctx.el.querySelector("#" + id);
            ctx.setInterval(() => { $("gm-t").textContent = Math.floor((Date.now() - t0) / 1000); }, 250);

            let sel = null, lock = false, left = 0;
            function startRound() {
                const ws = list.slice(round * PAIRS, round * PAIRS + Math.min(PAIRS, list.length));
                totalPairs += ws.length; left = ws.length;
                const tiles = ctx.shuffle(ws.flatMap((w, i) => [{ i, hz: true, w }, { i, hz: false, w }]));
                $("gm-r").textContent = round + 1;
                $("gm-grid").innerHTML = tiles.map((t, k) => `<button class="g-match-tile${t.hz ? " hz" : ""}" data-k="${k}">${esc(t.hz ? t.w.hz : short(t.w.mean, 48))}</button>`).join("");
                $("gm-grid").onclick = e => {
                    const b = e.target.closest(".g-match-tile");
                    if (!b || lock || b.classList.contains("done")) return;
                    const t = tiles[+b.dataset.k];
                    if (!sel) { sel = { b, t }; b.classList.add("sel"); if (t.hz) ctx.speak(t.w.hz); return; }
                    if (sel.b === b) { b.classList.remove("sel"); sel = null; return; }
                    if (sel.t.hz === t.hz) { sel.b.classList.remove("sel"); sel = { b, t }; b.classList.add("sel"); if (t.hz) ctx.speak(t.w.hz); return; }
                    const a = sel; sel = null;
                    if (a.t.i === t.i) {
                        a.b.classList.add("done"); b.classList.add("done"); a.b.classList.remove("sel");
                        matched++; left--;
                        $("gm-msg").textContent = t.w.hz + " · " + t.w.py;
                        if (!left) {
                            round++;
                            if (round >= rounds) return end();
                            lock = true;
                            ctx.setTimeout(() => { lock = false; startRound(); }, 500);
                        }
                    } else {
                        mistakes++; $("gm-m").textContent = mistakes;
                        wrong.push(a.t.w, t.w);
                        lock = true;
                        a.b.classList.remove("sel"); a.b.classList.add("bad"); b.classList.add("bad");
                        ctx.setTimeout(() => { a.b.classList.remove("bad"); b.classList.remove("bad"); lock = false; }, 450);
                    }
                };
            }
            function end() {
                const sec = Math.round((Date.now() - t0) / 1000);
                // 30 điểm mỗi cặp, thưởng thời gian (6 giây/cặp là chuẩn), trừ 10 mỗi lần ghép sai
                const score = Math.max(0, totalPairs * 30 + Math.max(0, totalPairs * 6 - sec) * 3 - mistakes * 10);
                ctx.finish({ score, correct: matched, total: matched + mistakes, wrong: wrong.map(w => ({ hz: w.hz, py: w.py, mean: w.mean })),
                    note: `${totalPairs} cặp trong ${sec} giây, ${mistakes} lần ghép sai.` });
            }
            startRound();
        }
    });
})();
