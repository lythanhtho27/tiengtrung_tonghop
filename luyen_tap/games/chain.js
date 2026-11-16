/* Trò chơi: Nối chữ — từ sau bắt đầu bằng chữ cuối của từ trước (ý tưởng từ startWordChain ở tuvung).
   Ưu tiên từ đã học (ctx.words); thiếu thì bổ sung bằng bộ từ nối viết sẵn ctx.data.word_chain. */
(function () {
    "use strict";
    const ID = "chain", ROUNDS = 10, LIMIT = 12;   // 10 lượt, 12 giây mỗi lượt
    const HZ = /^[一-鿿]{2,4}$/;

    function css() {
        if (document.getElementById("g-chain-css")) return;
        const s = document.createElement("style");
        s.id = "g-chain-css";
        s.textContent = `
.g-chain-top { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; font-size:14px; color:var(--ui-muted); margin-bottom:8px; }
.g-chain-top b { color:var(--ui-text); }
.g-chain-bar { height:8px; border-radius:99px; background:var(--ui-surface-3); overflow:hidden; margin-bottom:12px; }
.g-chain-bar i { display:block; height:100%; background:var(--ui-primary); transition:width .25s linear; }
.g-chain-bar i.low { background:var(--ui-danger); }
.g-chain-track { display:flex; flex-wrap:wrap; gap:4px 2px; align-items:center; justify-content:center; margin-bottom:12px; min-height:30px; }
.g-chain-node { font-family:var(--ui-font-cn); font-size:16px; padding:2px 8px; border-radius:99px; background:var(--ui-surface-2); border:1px solid var(--ui-border); }
.g-chain-node.cur { background:var(--ui-primary-soft); border-color:var(--ui-primary); }
.g-chain-arrow { color:var(--ui-muted); font-size:12px; }
.g-chain-prompt { text-align:center; margin-bottom:14px; }
.g-chain-prompt .w { font-family:var(--ui-font-cn); font-size:30px; }
.g-chain-prompt .w b { color:var(--ui-primary); font-size:40px; }
.g-chain-prompt small { display:block; color:var(--ui-muted); font-size:13px; }
.g-chain-prompt .q { margin-top:6px; font-size:15px; }
.g-chain-prompt .q b { font-family:var(--ui-font-cn); font-size:24px; color:var(--ui-primary); }
.g-chain-opts { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.g-chain-opt { min-height:64px; border:1px solid var(--ui-border-strong); border-radius:12px; background:var(--ui-surface); color:var(--ui-text); cursor:pointer; padding:8px; }
.g-chain-opt .zh { display:block; font-family:var(--ui-font-cn); font-size:26px; }
.g-chain-opt .py { display:block; font-size:12.5px; color:var(--ui-pinyin); min-height:1em; }
.g-chain-opt.ok { background:var(--ui-success-soft); border-color:var(--ui-success); }
.g-chain-opt.bad { background:var(--ui-danger-soft); border-color:var(--ui-danger); }
.g-chain-msg { text-align:center; min-height:24px; margin-top:10px; font-weight:600; }
.g-chain-msg.ok { color:var(--ui-success); } .g-chain-msg.bad { color:var(--ui-danger); }`;
        document.head.appendChild(s);
    }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: ID, order: 10, ic: "🐉", name: "Nối chữ",
        desc: "Chọn từ bắt đầu bằng chữ cuối của từ trước, 12 giây mỗi lượt. Thiếu từ đã học thì dùng bộ từ nối Boya viết sẵn.",
        unit: " điểm", minWords: 1,
        start(ctx) {
            css();
            const esc = ctx.esc;
            // Gộp từ đã học + bộ viết sẵn (bỏ trùng chữ Hán), đánh dấu từ đã học để ưu tiên
            const all = [], seen = new Set();
            ctx.words.forEach(w => { if (HZ.test(w.hz) && !seen.has(w.hz)) { seen.add(w.hz); all.push({ hz: w.hz, py: w.py, mean: w.mean, mine: true }); } });
            (ctx.data.word_chain || []).forEach(w => { if (HZ.test(w.hz) && !seen.has(w.hz)) { seen.add(w.hz); all.push({ hz: w.hz, py: w.py, mean: w.mean, mine: false }); } });
            const byFirst = {};
            all.forEach(w => { (byFirst[w.hz[0]] = byFirst[w.hz[0]] || []).push(w); });
            const last = w => w.hz[w.hz.length - 1];
            const used = new Set();
            const nextOf = w => (byFirst[last(w)] || []).filter(x => !used.has(x.hz));
            // Chọn từ nối tiếp: ưu tiên từ còn nối tiếp được, rồi từ đã học
            function chooseNext(w) {
                const c = nextOf(w);
                if (!c.length) return null;
                const rank = x => (nextOf(x).some(y => y.hz !== x.hz) ? 2 : 0) + (x.mine ? 1 : 0) + Math.random() * .5;
                return c.sort((a, b) => rank(b) - rank(a))[0];
            }
            function chooseStart() {
                const c = ctx.shuffle(all.filter(w => !used.has(w.hz) && nextOf(w).some(x => x.hz !== w.hz)));
                c.sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0));
                return c[0] || null;
            }
            let cur = chooseStart();
            if (!cur) { ctx.el.innerHTML = `<p class="muted">Không tìm được chuỗi từ để nối.</p>`; return; }
            used.add(cur.hz);
            const track = [cur];
            let round = 0, score = 0, correct = 0, combo = 0, maxCombo = 0, answer, opts, left, locked, timer;
            const wrong = [];

            function newRound(msg) {
                let ans = chooseNext(cur);
                if (!ans) {   // chuỗi đứt → bắt đầu chuỗi mới
                    const s = chooseStart();
                    if (!s) return end();
                    cur = s; used.add(cur.hz); track.length = 0; track.push(cur);
                    msg = "Chuỗi hết đường nối, bắt đầu chuỗi mới!";
                    ans = chooseNext(cur);
                }
                answer = ans;
                const lc = last(cur);
                const distract = ctx.shuffle(all.filter(w => w.hz[0] !== lc && w.hz !== cur.hz)).slice(0, 3);
                opts = ctx.shuffle([answer].concat(distract));
                left = LIMIT; locked = false;
                render(msg);
                timer = ctx.setInterval(() => {
                    if (locked) return;
                    left -= .25;
                    const bar = ctx.el.querySelector(".g-chain-bar i");
                    if (bar) { bar.style.width = Math.max(0, left / LIMIT * 100) + "%"; bar.classList.toggle("low", left <= 4); }
                    if (left <= 0) answerWith(-1);
                }, 250);
            }
            function render(msg, cls) {
                const lc = last(cur);
                const shown = track.slice(-5);
                ctx.el.innerHTML = `
                    <div class="g-chain-top"><span>Lượt <b>${Math.min(round + 1, ROUNDS)}/${ROUNDS}</b></span><span>${combo > 1 ? `🔥 x${combo} · ` : ""}Điểm: <b>${score}</b></span></div>
                    <div class="g-chain-bar"><i style="width:${left / LIMIT * 100}%"></i></div>
                    <div class="g-chain-track">${shown.map((w, i) => `${i ? '<span class="g-chain-arrow">→</span>' : ""}<span class="g-chain-node${w === cur ? " cur" : ""}">${esc(w.hz)}</span>`).join("")}</div>
                    <div class="g-chain-prompt">
                        <div class="w">${esc(cur.hz.slice(0, -1))}<b>${esc(lc)}</b></div>
                        <small>${esc(cur.py || "")} · ${esc(cur.mean || "")}</small>
                        <div class="q">Chọn từ bắt đầu bằng <b>${esc(lc)}</b></div>
                    </div>
                    <div class="g-chain-opts">${opts.map((w, i) => `<button class="g-chain-opt" data-o="${i}"><span class="zh">${esc(w.hz)}</span><span class="py"></span></button>`).join("")}</div>
                    <div class="g-chain-msg ${cls || ""}">${esc(msg || "")}</div>`;
            }
            function answerWith(i) {
                if (locked) return;
                locked = true;
                clearInterval(timer);
                const ok = i >= 0 && opts[i] === answer;
                const btns = ctx.el.querySelectorAll(".g-chain-opt");
                btns.forEach((b, k) => {
                    b.disabled = true;
                    b.querySelector(".py").textContent = opts[k].py || "";
                    if (opts[k] === answer) b.classList.add("ok");
                    else if (k === i) b.classList.add("bad");
                });
                const m = ctx.el.querySelector(".g-chain-msg");
                if (ok) {
                    correct++; combo++; maxCombo = Math.max(maxCombo, combo);
                    const pts = 10 + Math.ceil(left) + Math.min(combo - 1, 5) * 2;
                    score += pts;
                    m.className = "g-chain-msg ok"; m.textContent = `✔ ${answer.hz} — ${answer.mean} (+${pts})`;
                } else {
                    combo = 0;
                    wrong.push({ hz: answer.hz, py: answer.py, mean: answer.mean });
                    m.className = "g-chain-msg bad"; m.textContent = `${i < 0 ? "⏰ Hết giờ! " : "✘ "}Đáp án: ${answer.hz} — ${answer.mean}`;
                }
                ctx.speak(answer.hz);
                used.add(answer.hz); track.push(answer); cur = answer;
                round++;
                ctx.setTimeout(() => { if (round >= ROUNDS) end(); else newRound(); }, ok ? 1100 : 2000);
            }
            function end() {
                ctx.finish({ score, correct, total: round, wrong, note: `Combo dài nhất ${maxCombo}.` });
            }
            const onClick = e => {
                const b = e.target.closest("[data-o]");
                if (b && !b.disabled) answerWith(+b.dataset.o);
            };
            ctx.el.addEventListener("click", onClick);
            ctx.onCleanup(() => ctx.el.removeEventListener("click", onClick));
            newRound();
        }
    });
})();
