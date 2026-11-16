// Trò "Đánh boss": trả lời đúng gây sát thương (combo đánh mạnh hơn), sai thì boss đánh lại
(function () {
    "use strict";
    const BOSS_HP = 200, PLAYER_HP = 100, HIT_TAKEN = 25, Q_TIME = 12;

    function css() {
        if (document.getElementById("g-boss-css")) return;
        const s = document.createElement("style");
        s.id = "g-boss-css";
        s.textContent = `
.g-boss-arena { text-align: center; padding: 12px; border-radius: 16px; background: var(--ui-surface-2); border: 1px solid var(--ui-border); }
.g-boss-row { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; margin: 4px 0; }
.g-boss-row span:first-child { width: 58px; text-align: left; }
.g-boss-row span:last-child { width: 64px; text-align: right; color: var(--ui-text-2); }
.g-boss-track { flex: 1; height: 12px; border-radius: 6px; background: var(--ui-surface-3); overflow: hidden; }
.g-boss-track i { display: block; height: 100%; transition: width .35s; }
.g-boss-hp i { background: var(--ui-danger); }
.g-boss-me i { background: var(--ui-success); }
.g-boss-time i { background: var(--ui-warning); transition: width .2s linear; }
.g-boss-face { font-size: 64px; line-height: 1.1; margin: 6px 0 2px; display: inline-block; }
.g-boss-face.hit { animation: g-boss-hit .35s; }
.g-boss-dmg { min-height: 22px; font-weight: 700; color: var(--ui-warning); }
@keyframes g-boss-hit { 0%,100% { transform: translateX(0) scale(1); } 30% { transform: translateX(-8px) scale(.92); } 70% { transform: translateX(8px) scale(.96); } }
.g-boss-q { margin: 14px 0 10px; text-align: center; }
.g-boss-q .lab { font-size: 13px; color: var(--ui-muted); }
.g-boss-q .hz { font-family: var(--ui-font-cn); font-size: 42px; font-weight: 600; }
.g-boss-q .mean { font-size: 19px; font-weight: 600; padding: 4px 6px; }
.g-boss-opts { display: grid; grid-template-columns: 1fr; gap: 8px; }
.g-boss-opts.hzs { grid-template-columns: 1fr 1fr; }
.g-boss-opt { min-height: 50px; padding: 8px 12px; border-radius: 12px; border: 2px solid var(--ui-border); background: var(--ui-surface); color: var(--ui-text); font-size: 15px; cursor: pointer; text-align: left; line-height: 1.3; }
.g-boss-opts.hzs .g-boss-opt { font-family: var(--ui-font-cn); font-size: 26px; text-align: center; min-height: 60px; }
.g-boss-opt.ok { border-color: var(--ui-success); background: var(--ui-success-soft); }
.g-boss-opt.no { border-color: var(--ui-danger); background: var(--ui-danger-soft); }`;
        document.head.appendChild(s);
    }

    function short(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: "boss", order: 7, ic: "👹", name: "Đánh boss",
        desc: "Trả lời đúng để tấn công boss, đúng liên tiếp đánh càng mạnh. Sai sẽ bị boss đánh lại.",
        unit: " điểm", minWords: 8,
        start(ctx) {
            css();
            const { esc } = ctx;
            const words = ctx.words;
            let idx = 0, boss = BOSS_HP, me = PLAYER_HP, combo = 0, maxCombo = 0, correct = 0, total = 0, dealt = 0;
            let cur = null, opts = [], mode = "mean", lock = false, qEnd = 0;
            const wrong = [];
            ctx.el.innerHTML = `<div class="g-boss-arena">
                    <div class="g-boss-face" id="gb-face">👹</div>
                    <div class="g-boss-row g-boss-hp"><span>Boss</span><div class="g-boss-track"><i id="gb-hp"></i></div><span id="gb-hpt"></span></div>
                    <div class="g-boss-row g-boss-me"><span>Bạn</span><div class="g-boss-track"><i id="gb-me"></i></div><span id="gb-met"></span></div>
                    <div class="g-boss-row g-boss-time"><span>⏱</span><div class="g-boss-track"><i id="gb-time"></i></div><span id="gb-combo"></span></div>
                    <div class="g-boss-dmg" id="gb-dmg"></div>
                </div>
                <div class="g-boss-q" id="gb-q"></div><div class="g-boss-opts" id="gb-opts"></div>`;
            const $ = id => ctx.el.querySelector("#" + id);

            function hud() {
                $("gb-hp").style.width = (boss / BOSS_HP * 100) + "%";
                $("gb-hpt").textContent = boss + "/" + BOSS_HP;
                $("gb-me").style.width = (me / PLAYER_HP * 100) + "%";
                $("gb-met").textContent = me + "/" + PLAYER_HP;
                $("gb-combo").textContent = combo >= 2 ? "🔥x" + combo : "";
            }
            function ask() {
                if (idx >= words.length) { ctx.shuffle(words); idx = 0; }
                cur = words[idx++];
                mode = Math.random() < 0.5 ? "mean" : "hz";   // hỏi nghĩa của chữ, hoặc chữ của nghĩa
                opts = ctx.shuffle([cur].concat(ctx.distractors(cur, 3, mode === "mean" ? "mean" : "hz")));
                lock = false;
                $("gb-q").innerHTML = mode === "mean"
                    ? `<div class="lab">Nghĩa của từ này là gì?</div><div class="hz">${esc(cur.hz)}</div>`
                    : `<div class="lab">Chữ Hán nào có nghĩa:</div><div class="mean">${esc(short(cur.mean, 90))}</div>`;
                $("gb-opts").className = "g-boss-opts" + (mode === "hz" ? " hzs" : "");
                $("gb-opts").innerHTML = opts.map((o, k) => `<button class="g-boss-opt" data-k="${k}">${esc(mode === "mean" ? short(o.mean, 70) : o.hz)}</button>`).join("");
                qEnd = Date.now() + Q_TIME * 1000;
            }
            function choose(k) {
                if (lock || (k >= 0 && !opts[k])) return;
                lock = true; total++;
                const ok = k >= 0 && opts[k] === cur;
                const btns = $("gb-opts").querySelectorAll(".g-boss-opt");
                btns.forEach((b, j) => { if (opts[j] === cur) b.classList.add("ok"); });
                if (ok) {
                    correct++; combo++; maxCombo = Math.max(maxCombo, combo);
                    const fast = qEnd - Date.now() > (Q_TIME - 4) * 1000;   // trả lời trong 4 giây
                    const dmg = Math.min(boss, 15 + Math.min(combo - 1, 5) * 5 + (fast ? 5 : 0));
                    boss -= dmg; dealt += dmg;
                    $("gb-dmg").textContent = `⚔️ -${dmg}${fast ? " (nhanh!)" : ""}`;
                    const f = $("gb-face"); f.classList.remove("hit"); void f.offsetWidth; f.classList.add("hit");
                    if (mode === "mean") ctx.speak(cur.hz);
                } else {
                    combo = 0;
                    me = Math.max(0, me - HIT_TAKEN);
                    if (k >= 0) btns[k].classList.add("no");
                    $("gb-dmg").textContent = `${k < 0 ? "Hết giờ! " : ""}💥 Boss đánh bạn -${HIT_TAKEN} · ${cur.hz} ${cur.py || ""}`;
                    wrong.push({ hz: cur.hz, py: cur.py, mean: cur.mean });
                }
                hud();
                ctx.setTimeout(() => {
                    if (boss <= 0 || me <= 0) return end(boss <= 0);
                    $("gb-dmg").textContent = "";
                    ask();
                }, ok ? 700 : 1600);
            }
            function end(win) {
                $("gb-face").textContent = win ? "💀" : "😈";
                const score = dealt + (win ? me * 2 + 100 : 0);
                ctx.finish({ score, correct, total, wrong, title: win ? "🎉 Bạn đã hạ gục boss!" : "Boss thắng rồi, thử lại nhé!",
                    note: `Combo cao nhất x${maxCombo}.` });
            }
            $("gb-opts").onclick = e => { const b = e.target.closest(".g-boss-opt"); if (b) choose(+b.dataset.k); };
            const onKey = e => { if (/^[1-4]$/.test(e.key)) choose(+e.key - 1); };
            document.addEventListener("keydown", onKey);
            ctx.onCleanup(() => document.removeEventListener("keydown", onKey));
            ctx.setInterval(() => {
                if (lock) return;
                const left = Math.max(0, qEnd - Date.now());
                $("gb-time").style.width = (left / (Q_TIME * 1000) * 100) + "%";
                if (left <= 0) choose(-1);
            }, 200);
            hud();
            ask();
        }
    });
})();
