// Trò "Đúng hay sai": 60 giây, xét từ + nghĩa có khớp không, combo tăng điểm
(function () {
    "use strict";
    const TIME = 60;

    function css() {
        if (document.getElementById("g-tf-css")) return;
        const s = document.createElement("style");
        s.id = "g-tf-css";
        s.textContent = `
.g-tf-hud { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 14px; color: var(--ui-text-2); margin-bottom: 6px; }
.g-tf-hud b { color: var(--ui-text); }
.g-tf-bar { height: 8px; border-radius: 4px; background: var(--ui-surface-3); overflow: hidden; margin-bottom: 14px; }
.g-tf-bar i { display: block; height: 100%; background: var(--ui-primary); transition: width .25s linear; }
.g-tf-card { text-align: center; padding: 22px 12px; border-radius: 16px; background: var(--ui-surface-2); border: 2px solid var(--ui-border); min-height: 190px; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
.g-tf-card.ok { border-color: var(--ui-success); background: var(--ui-success-soft); }
.g-tf-card.no { border-color: var(--ui-danger); background: var(--ui-danger-soft); }
.g-tf-hz { font-family: var(--ui-font-cn); font-size: 44px; font-weight: 600; line-height: 1.2; }
.g-tf-py { color: var(--ui-pinyin); font-size: 16px; }
.g-tf-eq { color: var(--ui-muted); font-size: 13px; }
.g-tf-mean { font-size: 18px; font-weight: 600; }
.g-tf-combo { text-align: center; min-height: 22px; margin: 8px 0; color: var(--ui-warning); font-weight: 700; }
.g-tf-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.g-tf-btns button { min-height: 58px; font-size: 18px; font-weight: 700; border-radius: 14px; border: 0; cursor: pointer; color: #fff; }
.g-tf-yes { background: var(--ui-success); }
.g-tf-no { background: var(--ui-danger); }
.g-tf-keys { text-align: center; font-size: 12px; color: var(--ui-muted); margin-top: 8px; }`;
        document.head.appendChild(s);
    }

    function short(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: "tf", order: 2, ic: "✅", name: "Đúng hay sai",
        desc: "60 giây: từ và nghĩa có khớp không? Đúng liên tiếp để nhân combo.",
        unit: " điểm", minWords: 6,
        start(ctx) {
            css();
            const { esc } = ctx;
            const words = ctx.words;
            let left = TIME, score = 0, combo = 0, maxCombo = 0, correct = 0, total = 0, idx = 0, cur = null, lock = false, over = false;
            const wrong = [];
            ctx.el.innerHTML = `<div class="g-tf-hud"><span>⏱ <b id="gt-t">${TIME}</b>s</span><span>Điểm <b id="gt-s">0</b></span></div>
                <div class="g-tf-bar"><i id="gt-bar" style="width:100%"></i></div>
                <div class="g-tf-card" id="gt-card"></div>
                <div class="g-tf-combo" id="gt-combo"></div>
                <div class="g-tf-btns"><button class="g-tf-no" id="gt-no">✗ Sai</button><button class="g-tf-yes" id="gt-yes">✓ Đúng</button></div>
                <div class="g-tf-keys">Phím tắt: ← Sai · → Đúng</div>`;
            const $ = id => ctx.el.querySelector("#" + id);

            function next() {
                if (idx >= words.length) { ctx.shuffle(words); idx = 0; }
                const w = words[idx++];
                const truth = Math.random() < 0.5;
                let shown = w.mean;
                if (!truth) { const d = ctx.distractors(w, 1); if (d.length) shown = d[0].mean; }
                cur = { w, truth: shown === w.mean, shown };
                const card = $("gt-card");
                card.className = "g-tf-card";
                card.innerHTML = `<div class="g-tf-hz">${esc(w.hz)}</div><div class="g-tf-py">${esc(w.py || "")}</div>
                    <div class="g-tf-eq">nghĩa là</div><div class="g-tf-mean">${esc(short(shown, 90))}</div>`;
                lock = false;
            }
            function answer(yes) {
                if (lock || over || !cur) return;
                lock = true; total++;
                const ok = yes === cur.truth;
                if (ok) {
                    correct++; combo++; maxCombo = Math.max(maxCombo, combo);
                    score += 10 + Math.min(combo - 1, 10) * 2;
                } else {
                    combo = 0;
                    wrong.push({ hz: cur.w.hz, py: cur.w.py, mean: cur.w.mean });
                }
                $("gt-s").textContent = score;
                $("gt-combo").textContent = combo >= 2 ? `🔥 Combo x${combo}` : (ok ? "" : (cur.truth ? "Nghĩa đó đúng!" : "Nghĩa đúng: " + short(cur.w.mean, 60)));
                $("gt-card").classList.add(ok ? "ok" : "no");
                ctx.setTimeout(next, ok ? 280 : 900);
            }
            $("gt-yes").onclick = () => answer(true);
            $("gt-no").onclick = () => answer(false);
            const onKey = e => {
                if (e.key === "ArrowRight") { e.preventDefault(); answer(true); }
                else if (e.key === "ArrowLeft") { e.preventDefault(); answer(false); }
            };
            document.addEventListener("keydown", onKey);
            ctx.onCleanup(() => document.removeEventListener("keydown", onKey));

            const tEnd = Date.now() + TIME * 1000;
            ctx.setInterval(() => {
                left = Math.max(0, (tEnd - Date.now()) / 1000);
                $("gt-t").textContent = Math.ceil(left);
                $("gt-bar").style.width = (left / TIME * 100) + "%";
                if (left <= 0 && !over) {
                    over = true;
                    ctx.finish({ score, correct, total, wrong, note: `Combo cao nhất x${maxCombo}.` });
                }
            }, 200);
            next();
        }
    });
})();
