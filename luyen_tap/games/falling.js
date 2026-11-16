// Trò "Từ rơi": chữ Hán rơi xuống, chọn nghĩa đúng trước khi chạm đáy; 3 mạng, càng lúc càng nhanh
(function () {
    "use strict";
    const LIVES = 3;
    const BASE_SPEED = 0.11;   // tỉ lệ chiều cao sân mỗi giây (≈ 9 giây để rơi hết)
    const MAX_SPEED = 0.45;

    function css() {
        if (document.getElementById("g-falling-css")) return;
        const s = document.createElement("style");
        s.id = "g-falling-css";
        s.textContent = `
.g-falling-hud { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; color: var(--ui-text-2); margin-bottom: 8px; }
.g-falling-hud b { color: var(--ui-text); }
.g-falling-pause { min-height: 36px; padding: 4px 12px; }
.g-falling-sky { position: relative; height: 300px; border-radius: 16px; overflow: hidden; background: linear-gradient(var(--ui-primary-soft), var(--ui-surface-2)); border: 1px solid var(--ui-border); }
@media (max-height: 640px) { .g-falling-sky { height: 230px; } }
.g-falling-word { position: absolute; left: 50%; top: 0; transform: translateX(-50%); padding: 6px 16px; border-radius: 14px; background: var(--ui-surface); box-shadow: var(--ui-shadow); font-family: var(--ui-font-cn); font-size: 34px; font-weight: 600; white-space: nowrap; }
.g-falling-word.ok { background: var(--ui-success-soft); color: var(--ui-success); }
.g-falling-word.no { background: var(--ui-danger-soft); color: var(--ui-danger); }
.g-falling-ground { position: absolute; left: 0; right: 0; bottom: 0; height: 6px; background: var(--ui-danger); opacity: .6; }
.g-falling-msg { position: absolute; left: 0; right: 0; bottom: 14px; text-align: center; font-size: 14px; padding: 0 8px; }
.g-falling-paused { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--ui-overlay); color: #fff; font-size: 20px; font-weight: 700; }
.g-falling-opts { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 10px; }
@media (min-width: 560px) { .g-falling-opts { grid-template-columns: 1fr 1fr; } }
.g-falling-opt { min-height: 50px; padding: 8px 12px; border-radius: 12px; border: 2px solid var(--ui-border); background: var(--ui-surface-2); color: var(--ui-text); font-size: 15px; cursor: pointer; text-align: left; line-height: 1.3; }
.g-falling-opt.ok { border-color: var(--ui-success); background: var(--ui-success-soft); }
.g-falling-opt.no { border-color: var(--ui-danger); background: var(--ui-danger-soft); }`;
        document.head.appendChild(s);
    }

    function short(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: "falling", order: 5, ic: "🌧️", name: "Từ rơi",
        desc: "Chọn nghĩa đúng trước khi chữ rơi chạm đáy. 3 mạng, càng chơi càng nhanh.",
        unit: " điểm", minWords: 6,
        start(ctx) {
            css();
            const { esc } = ctx;
            const words = ctx.words;
            let idx = 0, lives = LIVES, score = 0, correct = 0, total = 0, combo = 0;
            let speed = BASE_SPEED, y = 0, cur = null, opts = [], state = "idle", paused = false, raf = 0, last = 0;
            const wrong = [];
            ctx.el.innerHTML = `<div class="g-falling-hud"><span id="gf-lives"></span><span>Điểm <b id="gf-s">0</b></span><span>×<b id="gf-v">1.0</b></span>
                    <button class="btn btn-sm g-falling-pause" id="gf-pause">⏸</button></div>
                <div class="g-falling-sky" id="gf-sky"><div class="g-falling-word" id="gf-word"></div><div class="g-falling-msg" id="gf-msg"></div><div class="g-falling-ground"></div></div>
                <div class="g-falling-opts" id="gf-opts"></div>`;
            const $ = id => ctx.el.querySelector("#" + id);
            const sky = $("gf-sky"), wordEl = $("gf-word");
            ctx.onCleanup(() => cancelAnimationFrame(raf));

            function hud() {
                $("gf-lives").textContent = "❤️".repeat(lives) + "🤍".repeat(LIVES - lives);
                $("gf-s").textContent = score;
                $("gf-v").textContent = (speed / BASE_SPEED).toFixed(1);
            }
            function spawn() {
                if (idx >= words.length) { ctx.shuffle(words); idx = 0; }
                cur = words[idx++];
                const n = correct < 8 ? 3 : 4;
                opts = ctx.shuffle([cur].concat(ctx.distractors(cur, n - 1)));
                y = 0; state = "fall";
                wordEl.className = "g-falling-word";
                wordEl.textContent = cur.hz;
                $("gf-msg").textContent = "";
                $("gf-opts").innerHTML = opts.map((o, k) => `<button class="g-falling-opt" data-k="${k}">${k + 1}. ${esc(short(o.mean, 70))}</button>`).join("");
                place();
            }
            function place() {
                const max = sky.clientHeight - wordEl.offsetHeight - 6;
                wordEl.style.top = Math.max(0, y * max) + "px";
            }
            function loop(t) {
                raf = requestAnimationFrame(loop);
                const dt = Math.min(0.05, (t - (last || t)) / 1000);
                last = t;
                if (paused || state !== "fall") return;
                y += speed * dt;
                if (y >= 1) { y = 1; miss(-1); }
                place();
            }
            function miss(k) {   // k = -1 khi chạm đáy
                state = "wait"; total++; combo = 0; lives--;
                wrong.push({ hz: cur.hz, py: cur.py, mean: cur.mean });
                wordEl.classList.add("no");
                const btns = $("gf-opts").querySelectorAll(".g-falling-opt");
                btns.forEach((b, j) => { if (opts[j] === cur) b.classList.add("ok"); });
                if (k >= 0) btns[k].classList.add("no");
                $("gf-msg").innerHTML = `${k < 0 ? "Hết giờ! " : ""}<b>${esc(cur.py || "")}</b>: ${esc(short(cur.mean, 60))}`;
                hud();
                ctx.setTimeout(() => {
                    if (lives <= 0) return ctx.finish({ score, correct, total, wrong, note: `Tốc độ cuối ×${(speed / BASE_SPEED).toFixed(1)}.` });
                    spawn();
                }, 1500);
            }
            function choose(k) {
                if (state !== "fall" || paused || !opts[k]) return;
                if (opts[k] !== cur) return miss(k);
                state = "wait"; total++; correct++; combo++;
                score += 10 + Math.round((1 - y) * 10) + Math.min(combo, 5);   // thưởng khi chọn sớm và giữ combo
                speed = Math.min(MAX_SPEED, speed * 1.07);
                wordEl.classList.add("ok");
                $("gf-opts").querySelectorAll(".g-falling-opt")[k].classList.add("ok");
                $("gf-msg").textContent = cur.py || "";
                hud();
                ctx.setTimeout(spawn, 450);
            }
            $("gf-opts").onclick = e => { const b = e.target.closest(".g-falling-opt"); if (b) choose(+b.dataset.k); };
            function togglePause() {
                paused = !paused;
                $("gf-pause").textContent = paused ? "▶" : "⏸";
                const p = sky.querySelector(".g-falling-paused");
                if (paused && !p) sky.insertAdjacentHTML("beforeend", `<div class="g-falling-paused">Tạm dừng</div>`);
                if (!paused && p) p.remove();
            }
            $("gf-pause").onclick = togglePause;
            const onKey = e => {
                if (/^[1-4]$/.test(e.key)) choose(+e.key - 1);
                else if (e.key === "p" || e.key === "Escape") togglePause();
            };
            document.addEventListener("keydown", onKey);
            ctx.onCleanup(() => document.removeEventListener("keydown", onKey));
            hud();
            spawn();
            raf = requestAnimationFrame(loop);
        }
    });
})();
