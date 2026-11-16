// Trò "Săn âm thanh": nghe đọc, chọn đúng chữ Hán trong 4–6 ô
(function () {
    "use strict";
    const COUNT = 10;

    function css() {
        if (document.getElementById("g-hunter-css")) return;
        const s = document.createElement("style");
        s.id = "g-hunter-css";
        s.textContent = `
.g-hunter-hud { display: flex; justify-content: space-between; font-weight: 600; font-size: 14px; color: var(--ui-text-2); margin-bottom: 12px; }
.g-hunter-hud b { color: var(--ui-text); }
.g-hunter-play { display: flex; justify-content: center; align-items: center; gap: 12px; margin: 6px 0 14px; }
.g-hunter-big { width: 84px; height: 84px; border-radius: 50%; border: 0; background: var(--ui-primary); color: var(--ui-on-primary); font-size: 34px; cursor: pointer; box-shadow: var(--ui-shadow); }
.g-hunter-slow { min-height: 44px; }
.g-hunter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (min-width: 560px) { .g-hunter-grid.six { grid-template-columns: repeat(3, 1fr); } }
.g-hunter-opt { min-height: 80px; border-radius: 14px; border: 2px solid var(--ui-border); background: var(--ui-surface-2); color: var(--ui-text); font-family: var(--ui-font-cn); font-size: 30px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
.g-hunter-opt small { font-family: var(--ui-font-sans); font-size: 12px; color: var(--ui-pinyin); }
.g-hunter-opt.ok { border-color: var(--ui-success); background: var(--ui-success-soft); }
.g-hunter-opt.no { border-color: var(--ui-danger); background: var(--ui-danger-soft); }
.g-hunter-fb { text-align: center; min-height: 48px; margin-top: 12px; font-size: 15px; }
.g-hunter-fb .zh { font-family: var(--ui-font-cn); font-size: 22px; }`;
        document.head.appendChild(s);
    }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: "hunter", order: 4, ic: "🎧", name: "Săn âm thanh",
        desc: "Nghe đọc rồi chọn đúng chữ Hán trong các ô.",
        unit: " điểm", minWords: 6,
        start(ctx) {
            const { esc } = ctx;
            css();
            const list = ctx.words.slice(0, Math.min(COUNT, ctx.words.length));
            let i = 0, score = 0, correct = 0, lock = false, tq = 0, opts = [];
            const wrong = [];
            ctx.el.innerHTML = `<div class="g-hunter-hud"><span>Câu <b id="gh-i">1</b>/${list.length}</span><span>Điểm <b id="gh-s">0</b></span></div>
                <div class="g-hunter-play"><button class="g-hunter-big" id="gh-play" title="Nghe lại (Space)">🔊</button><button class="btn g-hunter-slow" id="gh-slow">🐢 Chậm</button></div>
                <div class="g-hunter-grid" id="gh-grid"></div><div class="g-hunter-fb" id="gh-fb"></div>`;
            const $ = id => ctx.el.querySelector("#" + id);

            function show() {
                const w = list[i];
                const n = i < 5 ? 4 : 6;            // 5 câu đầu 4 ô, sau đó 6 ô
                // Ưu tiên đáp án nhiễu cùng số chữ cho khó hơn
                const ds = ctx.distractors(w, 12, "hz").sort((a, b) => Math.abs(a.hz.length - w.hz.length) - Math.abs(b.hz.length - w.hz.length)).slice(0, n - 1);
                opts = ctx.shuffle([w].concat(ds));
                lock = false;
                $("gh-i").textContent = i + 1;
                $("gh-grid").className = "g-hunter-grid" + (opts.length > 4 ? " six" : "");
                $("gh-grid").innerHTML = opts.map((o, k) => `<button class="g-hunter-opt" data-k="${k}">${esc(o.hz)}</button>`).join("");
                $("gh-fb").textContent = "";
                tq = Date.now();
                ctx.setTimeout(() => ctx.speak(w.hz), 250);
            }
            function choose(k) {
                if (lock || !opts[k]) return;
                lock = true;
                const w = list[i], ok = opts[k] === w;
                const btns = $("gh-grid").querySelectorAll(".g-hunter-opt");
                btns.forEach((b, j) => { if (opts[j] === w) b.classList.add("ok"); b.insertAdjacentHTML("beforeend", `<small>${esc(opts[j].py || "")}</small>`); });
                if (ok) {
                    correct++;
                    const sec = (Date.now() - tq) / 1000;
                    score += 10 + Math.max(0, Math.round(5 - sec));   // thưởng nếu chọn nhanh
                } else {
                    btns[k].classList.add("no");
                    wrong.push({ hz: w.hz, py: w.py, mean: w.mean });
                }
                $("gh-s").textContent = score;
                $("gh-fb").innerHTML = `${ok ? "✓" : "✗"} <span class="zh">${esc(w.hz)}</span> <span style="color:var(--ui-pinyin)">${esc(w.py || "")}</span><br><span class="muted">${esc(w.mean)}</span>`;
                ctx.setTimeout(() => {
                    i++;
                    if (i >= list.length) return ctx.finish({ score, correct, total: list.length, wrong });
                    show();
                }, ok ? 1100 : 2000);
            }
            $("gh-grid").onclick = e => { const b = e.target.closest(".g-hunter-opt"); if (b) choose(+b.dataset.k); };
            $("gh-play").onclick = () => ctx.speak(list[i].hz);
            $("gh-slow").onclick = () => ctx.speak(list[i].hz, 0.5);
            const onKey = e => {
                if (e.key === " ") { e.preventDefault(); ctx.speak(list[i].hz); }
                else if (/^[1-6]$/.test(e.key)) choose(+e.key - 1);
            };
            document.addEventListener("keydown", onKey);
            ctx.onCleanup(() => document.removeEventListener("keydown", onKey));
            show();
        }
    });
})();
