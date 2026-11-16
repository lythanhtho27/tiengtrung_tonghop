/* Trò chơi: Đấu trái nghĩa — chọn từ trái nghĩa trong 4 lựa chọn, có giờ (ý tưởng từ startAntonymDuel ở tuvung, dữ liệu ctx.data.antonyms). */
(function () {
    "use strict";
    const ID = "antonyms", ROUNDS = 10, LIMIT = 8;   // 10 câu, 8 giây mỗi câu

    function css() {
        if (document.getElementById("g-antonyms-css")) return;
        const s = document.createElement("style");
        s.id = "g-antonyms-css";
        s.textContent = `
.g-antonyms-top { display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:14px; color:var(--ui-muted); margin-bottom:8px; }
.g-antonyms-top b { color:var(--ui-text); }
.g-antonyms-bar { height:8px; border-radius:99px; background:var(--ui-surface-3); overflow:hidden; margin-bottom:16px; }
.g-antonyms-bar i { display:block; height:100%; background:var(--ui-primary); transition:width .2s linear; }
.g-antonyms-bar i.low { background:var(--ui-danger); }
.g-antonyms-q { text-align:center; margin-bottom:16px; }
.g-antonyms-q .lbl { font-size:13px; color:var(--ui-muted); }
.g-antonyms-q .zh { font-family:var(--ui-font-cn); font-size:44px; line-height:1.3; }
.g-antonyms-q .py { color:var(--ui-pinyin); font-size:15px; }
.g-antonyms-q .vi { color:var(--ui-text-2); font-size:14px; }
.g-antonyms-opts { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.g-antonyms-opt { min-height:72px; border:1px solid var(--ui-border-strong); border-radius:12px; background:var(--ui-surface); color:var(--ui-text); cursor:pointer; padding:8px; }
.g-antonyms-opt .zh { display:block; font-family:var(--ui-font-cn); font-size:26px; }
.g-antonyms-opt .vi { display:block; font-size:12.5px; color:var(--ui-muted); min-height:1em; }
.g-antonyms-opt.ok { background:var(--ui-success-soft); border-color:var(--ui-success); }
.g-antonyms-opt.bad { background:var(--ui-danger-soft); border-color:var(--ui-danger); }
.g-antonyms-msg { text-align:center; min-height:24px; margin-top:12px; font-weight:600; }
.g-antonyms-msg.ok { color:var(--ui-success); } .g-antonyms-msg.bad { color:var(--ui-danger); }`;
        document.head.appendChild(s);
    }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: ID, order: 12, ic: "⚔️", name: "Đấu trái nghĩa",
        desc: "Chọn từ trái nghĩa trong 4 lựa chọn, 8 giây mỗi câu, trả lời nhanh được thêm điểm (bộ cặp từ Boya viết sẵn).",
        unit: " điểm", ownData: true,
        start(ctx) {
            css();
            const esc = ctx.esc;
            const data = ctx.data.antonyms || [];
            if (data.length < 4) { ctx.el.innerHTML = `<p class="muted">Chưa đủ dữ liệu từ trái nghĩa.</p>`; return; }
            // Mỗi cặp có thể hỏi theo 2 chiều: word → ant hoặc ant → word
            const sides = data.map(a => [{ hz: a.word, py: a.py, mean: a.mean }, { hz: a.ant, py: a.antPy, mean: a.antMean }]);
            const qs = ctx.shuffle(sides.map((s, k) => ({ k, flip: Math.random() < .5 }))).slice(0, Math.min(ROUNDS, sides.length));
            let i = 0, score = 0, correct = 0, combo = 0, left, locked, timer, q, ans, opts;
            const wrong = [];

            function newQ() {
                const cur = qs[i];
                q = sides[cur.k][cur.flip ? 1 : 0]; ans = sides[cur.k][cur.flip ? 0 : 1];
                const others = ctx.shuffle(sides.filter((s, k) => k !== cur.k).map(s => s[Math.random() < .5 ? 0 : 1])).slice(0, 3);
                opts = ctx.shuffle([ans].concat(others));
                left = LIMIT; locked = false;
                ctx.el.innerHTML = `
                    <div class="g-antonyms-top"><span>Câu <b>${i + 1}/${qs.length}</b></span><span>${combo > 1 ? `🔥 x${combo} · ` : ""}Điểm: <b>${score}</b></span></div>
                    <div class="g-antonyms-bar"><i style="width:100%"></i></div>
                    <div class="g-antonyms-q"><div class="lbl">Từ trái nghĩa của</div><div class="zh">${esc(q.hz)}</div>
                        <div class="py">${esc(q.py || "")}</div><div class="vi">${esc(q.mean || "")}</div></div>
                    <div class="g-antonyms-opts">${opts.map((o, k) => `<button class="g-antonyms-opt" data-o="${k}"><span class="zh">${esc(o.hz)}</span><span class="vi"></span></button>`).join("")}</div>
                    <div class="g-antonyms-msg"></div>`;
                timer = ctx.setInterval(() => {
                    if (locked) return;
                    left -= .2;
                    const bar = ctx.el.querySelector(".g-antonyms-bar i");
                    if (bar) { bar.style.width = Math.max(0, left / LIMIT * 100) + "%"; bar.classList.toggle("low", left <= 3); }
                    if (left <= 0) pick(-1);
                }, 200);
            }
            function pick(k) {
                if (locked) return;
                locked = true;
                clearInterval(timer);
                const ok = k >= 0 && opts[k] === ans;
                ctx.el.querySelectorAll(".g-antonyms-opt").forEach((b, j) => {
                    b.disabled = true;
                    b.querySelector(".vi").textContent = opts[j].mean || "";
                    if (opts[j] === ans) b.classList.add("ok"); else if (j === k) b.classList.add("bad");
                });
                const m = ctx.el.querySelector(".g-antonyms-msg");
                if (ok) {
                    correct++; combo++;
                    const pts = 10 + Math.ceil(left) * 2 + Math.min(combo - 1, 5) * 2;
                    score += pts;
                    m.className = "g-antonyms-msg ok"; m.textContent = `✔ ${q.hz} ↔ ${ans.hz} (+${pts})`;
                } else {
                    combo = 0;
                    wrong.push({ hz: `${q.hz} ↔ ${ans.hz}`, py: `${q.py || ""} ↔ ${ans.py || ""}`, mean: `${q.mean} ↔ ${ans.mean}` });
                    m.className = "g-antonyms-msg bad"; m.textContent = `${k < 0 ? "⏰ Hết giờ! " : "✘ "}${q.hz} ↔ ${ans.hz} (${ans.mean})`;
                }
                ctx.speak(q.hz + "，" + ans.hz);
                i++;
                ctx.setTimeout(() => {
                    if (i < qs.length) newQ();
                    else ctx.finish({ score, correct, total: qs.length, wrong });
                }, ok ? 1100 : 2000);
            }
            const onClick = e => {
                const b = e.target.closest("[data-o]");
                if (b && !b.disabled) pick(+b.dataset.o);
            };
            ctx.el.addEventListener("click", onClick);
            ctx.onCleanup(() => ctx.el.removeEventListener("click", onClick));
            newQ();
        }
    });
})();
