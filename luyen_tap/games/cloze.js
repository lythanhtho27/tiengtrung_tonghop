// Trò "Điền từ vào câu": câu ví dụ bị che một từ, chọn chữ Hán đúng trong 4 lựa chọn
(function () {
    "use strict";
    const COUNT = 10, MIN_Q = 4;

    function css() {
        if (document.getElementById("g-cloze-css")) return;
        const s = document.createElement("style");
        s.id = "g-cloze-css";
        s.textContent = `
.g-cloze-hud { display: flex; justify-content: space-between; font-weight: 600; font-size: 14px; color: var(--ui-text-2); margin-bottom: 12px; }
.g-cloze-hud b { color: var(--ui-text); }
.g-cloze-sent { font-family: var(--ui-font-cn); font-size: 24px; line-height: 1.7; text-align: center; padding: 16px 12px; border-radius: 14px; background: var(--ui-surface-2); }
.g-cloze-gap { display: inline-block; min-width: 2.2em; border-bottom: 3px solid var(--ui-primary); color: var(--ui-primary); }
.g-cloze-gap.ok { color: var(--ui-success); border-color: var(--ui-success); }
.g-cloze-gap.no { color: var(--ui-danger); border-color: var(--ui-danger); }
.g-cloze-hint { text-align: center; color: var(--ui-muted); font-size: 14px; margin: 8px 0 12px; }
.g-cloze-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.g-cloze-opt { min-height: 60px; border-radius: 14px; border: 2px solid var(--ui-border); background: var(--ui-surface-2); color: var(--ui-text); font-family: var(--ui-font-cn); font-size: 26px; cursor: pointer; }
.g-cloze-opt.ok { border-color: var(--ui-success); background: var(--ui-success-soft); }
.g-cloze-opt.no { border-color: var(--ui-danger); background: var(--ui-danger-soft); }
.g-cloze-fb { margin-top: 12px; padding: 12px; border-radius: 12px; background: var(--ui-surface-2); font-size: 15px; line-height: 1.5; }
.g-cloze-fb .py { color: var(--ui-pinyin); font-size: 14px; }
.g-cloze-next { display: flex; justify-content: center; margin-top: 12px; }
.g-cloze-next .btn { min-height: 46px; min-width: 160px; }`;
        document.head.appendChild(s);
    }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: "cloze", order: 6, ic: "📝", name: "Điền từ vào câu",
        desc: "Chọn từ đúng để điền vào chỗ trống trong câu ví dụ.",
        unit: " điểm", minWords: 6,
        start(ctx) {
            css();
            const { esc } = ctx;
            // Mỗi từ lấy một câu chứa đúng từ đó, câu không quá dài
            const byWord = new Map();
            for (const s of ctx.shuffle(ctx.sents().slice())) {
                const w = s.word;
                if (!w || !w.hz || byWord.has(w.hz) || s.zh.indexOf(w.hz) < 0 || s.zh.length > 40) continue;
                byWord.set(w.hz, s);
            }
            const qs = [];
            for (const s of byWord.values()) {
                const w = s.word;
                const ds = ctx.distractors(w, 12, "hz")
                    .filter(x => s.zh.indexOf(x.hz) < 0)
                    .sort((a, b) => Math.abs(a.hz.length - w.hz.length) - Math.abs(b.hz.length - w.hz.length))
                    .slice(0, 3);
                if (ds.length < 3) continue;
                qs.push({ s, w, opts: ctx.shuffle([w].concat(ds)) });
                if (qs.length >= COUNT) break;
            }
            if (qs.length < MIN_Q) {
                ctx.el.innerHTML = `<div style="text-align:center;padding:20px 6px">
                    <p style="font-size:40px;margin:0">📭</p>
                    <p>Chưa đủ câu ví dụ cho các từ bạn đã học (cần ít nhất ${MIN_Q} câu, hiện có ${qs.length}).</p>
                    <p class="muted">Hãy đổi mục <b>Nguồn từ</b> sang "Luyện tự do" theo cấp HSK, hoặc chọn nguồn có từ HSK / Boya / HSK 3.0 rồi chơi lại.</p></div>`;
                return;
            }
            let i = 0, score = 0, correct = 0, lock = false;
            const wrong = [];
            ctx.el.innerHTML = `<div class="g-cloze-hud"><span>Câu <b id="gc-i">1</b>/${qs.length}</span><span>Điểm <b id="gc-s">0</b></span></div>
                <div class="g-cloze-sent" id="gc-sent"></div><div class="g-cloze-hint" id="gc-hint"></div>
                <div class="g-cloze-opts" id="gc-opts"></div><div id="gc-fb"></div>`;
            const $ = id => ctx.el.querySelector("#" + id);

            function sentHTML(q, fill, cls) {
                const k = q.s.zh.indexOf(q.w.hz);
                return esc(q.s.zh.slice(0, k)) + `<span class="g-cloze-gap ${cls || ""}">${fill ? esc(fill) : "＿＿"}</span>` + esc(q.s.zh.slice(k + q.w.hz.length));
            }
            function show() {
                const q = qs[i];
                lock = false;
                $("gc-i").textContent = i + 1;
                $("gc-sent").innerHTML = sentHTML(q);
                $("gc-hint").textContent = "Gợi ý: " + q.w.mean;
                $("gc-opts").innerHTML = q.opts.map((o, k) => `<button class="g-cloze-opt" data-k="${k}">${esc(o.hz)}</button>`).join("");
                $("gc-fb").innerHTML = "";
            }
            function choose(k) {
                const q = qs[i];
                if (lock || !q.opts[k]) return;
                lock = true;
                const ok = q.opts[k] === q.w;
                const btns = $("gc-opts").querySelectorAll(".g-cloze-opt");
                btns.forEach((b, j) => { if (q.opts[j] === q.w) b.classList.add("ok"); b.disabled = true; });
                if (ok) { correct++; score += 10; }
                else { btns[k].classList.add("no"); wrong.push({ hz: q.w.hz, py: q.w.py, mean: q.w.mean }); }
                $("gc-s").textContent = score;
                $("gc-sent").innerHTML = sentHTML(q, q.w.hz, ok ? "ok" : "no");
                $("gc-fb").innerHTML = `<div class="g-cloze-fb"><div>${ok ? "✓ Chính xác!" : "✗ Đáp án: <b>" + esc(q.w.hz) + "</b> (" + esc(q.w.py || "") + ")"}</div>
                    ${q.s.py ? `<div class="py">${esc(q.s.py)}</div>` : ""}<div>${esc(q.s.vi || "")}</div></div>
                    <div class="g-cloze-next"><button class="btn" id="gc-say">🔊</button>&nbsp;<button class="btn btn-primary" id="gc-next">${i + 1 >= qs.length ? "Xem kết quả" : "Câu tiếp →"}</button></div>`;
                $("gc-say").onclick = () => ctx.speak(q.s.zh);
                $("gc-next").onclick = next;
                $("gc-next").focus();
                ctx.speak(q.s.zh);
            }
            function next() {
                i++;
                if (i >= qs.length) return ctx.finish({ score, correct, total: qs.length, wrong });
                show();
            }
            $("gc-opts").onclick = e => { const b = e.target.closest(".g-cloze-opt"); if (b) choose(+b.dataset.k); };
            const onKey = e => {
                if (/^[1-4]$/.test(e.key) && !lock) choose(+e.key - 1);
            };
            document.addEventListener("keydown", onKey);
            ctx.onCleanup(() => document.removeEventListener("keydown", onKey));
            show();
        }
    });
})();
