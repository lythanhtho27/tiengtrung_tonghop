/* Trò chơi: Phân biệt từ gần nghĩa — chọn từ đúng cho chỗ trống (ý tưởng từ startSynonymsDrill ở tuvung, dữ liệu ctx.data.synonyms). */
(function () {
    "use strict";
    const ID = "synonyms";

    function css() {
        if (document.getElementById("g-synonyms-css")) return;
        const s = document.createElement("style");
        s.id = "g-synonyms-css";
        s.textContent = `
.g-synonyms-top { display:flex; justify-content:space-between; font-size:14px; color:var(--ui-muted); margin-bottom:12px; }
.g-synonyms-top b { color:var(--ui-text); }
.g-synonyms-sent { font-family:var(--ui-font-cn); font-size:22px; line-height:1.7; text-align:center; margin-bottom:6px; }
.g-synonyms-blank { display:inline-block; min-width:3em; border-bottom:2px solid var(--ui-primary); color:var(--ui-primary); font-weight:700; }
.g-synonyms-blank.ok { color:var(--ui-success); border-color:var(--ui-success); }
.g-synonyms-blank.bad { color:var(--ui-danger); border-color:var(--ui-danger); }
.g-synonyms-sub { text-align:center; font-size:14px; color:var(--ui-text-2); margin-bottom:14px; min-height:1.3em; }
.g-synonyms-sub .py { display:block; color:var(--ui-pinyin); }
.g-synonyms-opts { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
.g-synonyms-opt { min-height:60px; border:1px solid var(--ui-border-strong); border-radius:12px; background:var(--ui-surface); color:var(--ui-text);
  font-family:var(--ui-font-cn); font-size:28px; cursor:pointer; }
.g-synonyms-opt.ok { background:var(--ui-success-soft); border-color:var(--ui-success); }
.g-synonyms-opt.bad { background:var(--ui-danger-soft); border-color:var(--ui-danger); }
.g-synonyms-exp { background:var(--ui-surface-2); border:1px solid var(--ui-border); border-radius:12px; padding:12px; font-size:14.5px; line-height:1.55; margin-bottom:12px; }
.g-synonyms-exp ul { margin:0 0 8px; padding-left:0; list-style:none; }
.g-synonyms-exp li { margin-bottom:4px; }
.g-synonyms-exp .zh { font-family:var(--ui-font-cn); font-size:18px; font-weight:700; }
.g-synonyms-exp .py { color:var(--ui-pinyin); }
.g-synonyms-exp .role { font-size:12px; padding:1px 6px; border-radius:99px; background:var(--ui-primary-soft); color:var(--ui-primary); }
.g-synonyms-acts { display:flex; justify-content:center; }
.g-synonyms-acts .btn { min-height:44px; min-width:160px; }`;
        document.head.appendChild(s);
    }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: ID, order: 11, ic: "⚖️", name: "Từ gần nghĩa",
        desc: "Chọn từ đúng trong cặp từ gần nghĩa cho chỗ trống, kèm giải thích cách dùng (bộ câu Boya viết sẵn).",
        unit: " điểm", ownData: true,
        start(ctx) {
            css();
            const esc = ctx.esc;
            const items = ctx.shuffle((ctx.data.synonyms || []).slice());
            if (!items.length) { ctx.el.innerHTML = `<p class="muted">Chưa có dữ liệu từ gần nghĩa.</p>`; return; }
            let i = 0, correct = 0, done = false, pair;
            const wrong = [];
            const BLANK = /【\s*_+\s*】/;
            const noteOf = (it, hz) => (it.notes || []).find(n => n.hz === hz) || {};

            function render(chosen) {
                const it = items[i];
                if (!done) pair = ctx.shuffle(it.pair.slice());
                const [pre, post] = it.sentence.split(BLANK);
                const ok = chosen === it.correct;
                const blank = done ? `<span class="g-synonyms-blank ${ok ? "ok" : "bad"}">${esc(it.correct)}</span>` : `<span class="g-synonyms-blank">？</span>`;
                ctx.el.innerHTML = `
                    <div class="g-synonyms-top"><span>Câu <b>${i + 1}/${items.length}</b></span><span>Đúng: <b>${correct}</b></span></div>
                    <div class="g-synonyms-sent">${esc(pre || "")}${blank}${esc(post || "")}</div>
                    <div class="g-synonyms-sub">${done ? `<span class="py">${esc(it.py || "")}</span>${esc(it.mean || "")}` : "Chọn từ phù hợp cho chỗ trống"}</div>
                    <div class="g-synonyms-opts">${pair.map(w => `<button class="g-synonyms-opt${done && w === it.correct ? " ok" : ""}${done && w === chosen && !ok ? " bad" : ""}" data-w="${esc(w)}" ${done ? "disabled" : ""}>${esc(w)}</button>`).join("")}</div>
                    ${done ? `<div class="g-synonyms-exp">
                        <ul>${(it.notes || []).map(n => `<li><span class="zh">${esc(n.hz)}</span> <span class="py">${esc(n.py || "")}</span> <span class="role">${esc(n.role || "")}</span> ${esc(n.hint || "")}</li>`).join("")}</ul>
                        <div>${esc(it.explain || "")}</div></div>
                        <div class="g-synonyms-acts"><button class="btn btn-primary" data-act="next">${i + 1 < items.length ? "Câu tiếp ▶" : "Xem kết quả"}</button></div>` : ""}`;
            }
            function choose(w) {
                if (done) return;
                const it = items[i];
                done = true;
                if (w === it.correct) correct++;
                else { const n = noteOf(it, it.correct); wrong.push({ hz: it.correct, py: n.py || "", mean: `${n.hint || ""} (khác ${w})` }); }
                ctx.speak(it.sentence.replace(BLANK, it.correct));
                render(w);
            }
            const onClick = e => {
                const b = e.target.closest("button");
                if (!b || b.disabled) return;
                if (b.dataset.w != null) choose(b.dataset.w);
                else if (b.dataset.act === "next") {
                    i++; done = false;
                    if (i < items.length) render();
                    else ctx.finish({ score: correct * 10, correct, total: items.length, wrong });
                }
            };
            ctx.el.addEventListener("click", onClick);
            ctx.onCleanup(() => ctx.el.removeEventListener("click", onClick));
            render();
        }
    });
})();
