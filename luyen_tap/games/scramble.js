// Trò "Xếp chữ": từ 2–4 chữ bị xáo, nhìn nghĩa (và gợi ý pinyin) để bấm chữ theo đúng thứ tự
(function () {
    "use strict";
    const COUNT = 10;
    const isHan = ch => /[㐀-鿿]/.test(ch);

    function css() {
        if (document.getElementById("g-scramble-css")) return;
        const s = document.createElement("style");
        s.id = "g-scramble-css";
        s.textContent = `
.g-scramble-hud { display: flex; justify-content: space-between; font-weight: 600; font-size: 14px; color: var(--ui-text-2); margin-bottom: 12px; }
.g-scramble-hud b { color: var(--ui-text); }
.g-scramble-mean { text-align: center; font-size: 18px; font-weight: 600; padding: 14px 10px; border-radius: 14px; background: var(--ui-surface-2); min-height: 56px; }
.g-scramble-py { text-align: center; color: var(--ui-pinyin); font-size: 17px; min-height: 26px; margin: 8px 0; }
.g-scramble-slots, .g-scramble-pool { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin: 12px 0; }
.g-scramble-slot, .g-scramble-ch { width: 64px; height: 64px; border-radius: 14px; font-family: var(--ui-font-cn); font-size: 32px; display: flex; align-items: center; justify-content: center; }
.g-scramble-slot { border: 2px dashed var(--ui-border-strong); background: var(--ui-surface); cursor: pointer; }
.g-scramble-slot.on { border-style: solid; border-color: var(--ui-primary); }
.g-scramble-slots.ok .g-scramble-slot { border-color: var(--ui-success); background: var(--ui-success-soft); }
.g-scramble-slots.bad .g-scramble-slot { border-color: var(--ui-danger); background: var(--ui-danger-soft); animation: g-scramble-shake .3s; }
.g-scramble-ch { border: 2px solid var(--ui-border); background: var(--ui-surface-2); color: var(--ui-text); cursor: pointer; }
.g-scramble-ch:disabled { visibility: hidden; }
.g-scramble-acts { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }
.g-scramble-acts .btn { min-height: 44px; }
.g-scramble-fb { text-align: center; min-height: 24px; font-weight: 600; margin-top: 10px; }
@keyframes g-scramble-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }`;
        document.head.appendChild(s);
    }

    (window.LT_GAMES = window.LT_GAMES || []).push({
        id: "scramble", order: 3, ic: "🔀", name: "Xếp chữ",
        desc: "Các chữ của một từ bị xáo trộn, bấm lại theo đúng thứ tự.",
        unit: " điểm", minWords: 6,
        start(ctx) {
            css();
            const { esc } = ctx;
            const seen = new Set();
            const list = ctx.words.filter(w => {
                const ch = Array.from(w.hz);
                if (ch.length < 2 || ch.length > 4 || !ch.every(isHan) || new Set(ch).size < 2 || seen.has(w.hz)) return false;
                seen.add(w.hz); return true;
            }).slice(0, COUNT);
            if (list.length < 3) {
                ctx.el.innerHTML = `<p class="muted" style="text-align:center">Chưa đủ từ có 2–4 chữ Hán để chơi. Hãy chọn "Luyện tự do" ở mục Nguồn từ hoặc học thêm.</p>`;
                return;
            }
            let i = 0, score = 0, correct = 0, tries = 0, hinted = false, picked = [], lock = false;
            const wrong = [];
            ctx.el.innerHTML = `<div class="g-scramble-hud"><span>Từ <b id="gs-i">1</b>/${list.length}</span><span>Điểm <b id="gs-s">0</b></span></div>
                <div class="g-scramble-mean" id="gs-mean"></div><div class="g-scramble-py" id="gs-py"></div>
                <div class="g-scramble-slots" id="gs-slots"></div><div class="g-scramble-pool" id="gs-pool"></div>
                <div class="g-scramble-acts"><button class="btn" id="gs-hint">💡 Gợi ý pinyin</button><button class="btn" id="gs-skip">Bỏ qua</button></div>
                <div class="g-scramble-fb" id="gs-fb"></div>`;
            const $ = id => ctx.el.querySelector("#" + id);
            let chars = [], order = [];

            function show() {
                const w = list[i];
                chars = Array.from(w.hz);
                order = chars.map((_, k) => k);
                do { ctx.shuffle(order); } while (order.every((v, k) => v === k));
                picked = []; tries = 0; hinted = false; lock = false;
                $("gs-i").textContent = i + 1;
                $("gs-mean").textContent = w.mean;
                $("gs-py").textContent = "";
                $("gs-hint").disabled = false;
                $("gs-fb").textContent = "";
                render();
            }
            function render() {
                $("gs-slots").className = "g-scramble-slots";
                $("gs-slots").innerHTML = chars.map((_, k) => `<div class="g-scramble-slot${picked[k] != null ? " on" : ""}" data-k="${k}">${picked[k] != null ? esc(chars[picked[k]]) : ""}</div>`).join("");
                $("gs-pool").innerHTML = order.map(o => `<button class="g-scramble-ch" data-o="${o}"${picked.includes(o) ? " disabled" : ""}>${esc(chars[o])}</button>`).join("");
            }
            $("gs-pool").onclick = e => {
                const b = e.target.closest(".g-scramble-ch");
                if (!b || lock) return;
                picked.push(+b.dataset.o);
                render();
                if (picked.length === chars.length) check();
            };
            $("gs-slots").onclick = e => {   // bấm ô đã điền để gỡ chữ đó và các chữ sau nó
                const s = e.target.closest(".g-scramble-slot");
                if (!s || lock || picked[+s.dataset.k] == null) return;
                picked = picked.slice(0, +s.dataset.k); render();
            };
            function check() {
                const w = list[i];
                const ok = picked.map(o => chars[o]).join("") === w.hz;
                if (ok) {
                    lock = true; correct++;
                    score += tries === 0 ? (hinted ? 6 : 10) : 4;
                    $("gs-s").textContent = score;
                    $("gs-slots").classList.add("ok");
                    $("gs-py").textContent = w.py;
                    $("gs-fb").textContent = "✓ " + w.hz;
                    ctx.speak(w.hz);
                    ctx.setTimeout(advance, 1000);
                    return;
                }
                tries++;
                $("gs-slots").classList.add("bad");
                if (tries >= 2) return reveal();
                lock = true;
                $("gs-fb").textContent = "Chưa đúng, thử lại nhé!";
                ctx.setTimeout(() => { picked = []; lock = false; render(); }, 600);
            }
            function reveal() {
                const w = list[i];
                lock = true;
                wrong.push({ hz: w.hz, py: w.py, mean: w.mean });
                $("gs-py").textContent = w.py;
                $("gs-fb").innerHTML = `Đáp án: <span style="font-family:var(--ui-font-cn);font-size:22px">${esc(w.hz)}</span>`;
                ctx.speak(w.hz);
                ctx.setTimeout(advance, 1800);
            }
            function advance() {
                i++;
                if (i >= list.length) return ctx.finish({ score, correct, total: list.length, wrong });
                show();
            }
            $("gs-hint").onclick = () => { if (lock) return; hinted = true; $("gs-py").textContent = list[i].py; $("gs-hint").disabled = true; };
            $("gs-skip").onclick = () => { if (!lock) reveal(); };
            show();
        }
    });
})();
