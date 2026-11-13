/* ==========================================================================
   LỘ TRÌNH TỪ VỰNG HSK 1–6
   - Dữ liệu: hsk_vocab_data.js (sinh từ word_list_data/HSK1-HSK6_full.xlsx)
   - Lộ trình: Cấp → Chặng (5 bài + kiểm tra chặng) → Bài (10–20 từ)
   - Mỗi bài: Học thẻ → Luyện tập (≥70% để qua) → từ vào hàng đợi ôn tập
   - Ôn tập: lặp lại ngắt quãng (SM-2 rút gọn), 4 mức Quên / Khó / Nhớ / Dễ
   ========================================================================== */
(function () {
    "use strict";

    // ---------------------------------------------------------------- Cấu hình
    const UNIT_SIZE = { 1: 10, 2: 10, 3: 10, 4: 15, 5: 20, 6: 20 };
    const UNITS_PER_STAGE = 5;
    const PASS_UNIT = 0.7;
    const PASS_STAGE = 0.8;
    const DAY = 86400000;
    const SLOW_MS = 3000;          // nhận diện chậm hơn 3 giây -> "cần tăng tốc"
    const SPEED_MIN = 600, SPEED_MAX = 3500; // giới hạn thời gian mỗi từ trong chế độ đọc nhanh (ms)
    const STORE_KEY = "hsk_lotrinh_v1";
    const LEVEL_COLORS = { 1: "#10b981", 2: "#0ea5e9", 3: "#6366f1", 4: "#a855f7", 5: "#f59e0b", 6: "#ef4444" };

    // ---------------------------------------------------------------- Dữ liệu
    const RAW = window.HSK_VOCAB || [];
    const WORDS = RAW.map((r, i) => ({
        idx: i,
        id: r[0] + "-" + r[1],
        level: r[0],
        hz: r[1],
        clean: cleanHanzi(r[1]),
        py: r[2],
        vi: r[3],
        ex: r[4],
        expy: r[5],
        exvi: r[6],
        hv: r[7] || "",
    }));
    WORDS.forEach(w => { w.search = norm(w.hz + " " + w.py + " " + w.py.replace(/\s+/g, "") + " " + w.vi + " " + w.hv); });
    const BY_ID = new Map(WORDS.map(w => [w.id, w]));

    // Cấu trúc lộ trình
    const LEVELS = {};
    for (let lv = 1; lv <= 6; lv++) {
        const list = WORDS.filter(w => w.level === lv);
        const size = UNIT_SIZE[lv];
        const units = [];
        for (let i = 0; i < list.length; i += size) {
            units.push({ key: lv + "-" + units.length, level: lv, n: units.length, words: list.slice(i, i + size) });
        }
        // gộp bài cuối quá ngắn vào bài trước
        if (units.length > 1 && units[units.length - 1].words.length < size / 2) {
            const last = units.pop();
            units[units.length - 1].words = units[units.length - 1].words.concat(last.words);
        }
        const stages = [];
        for (let i = 0; i < units.length; i += UNITS_PER_STAGE) {
            const su = units.slice(i, i + UNITS_PER_STAGE);
            const st = { key: lv + "-s" + stages.length, level: lv, n: stages.length, units: su };
            su.forEach(u => { u.stage = st; });
            stages.push(st);
        }
        LEVELS[lv] = { level: lv, words: list, units, stages };
    }

    // ---------------------------------------------------------------- Tiện ích
    function cleanHanzi(s) {
        // "（杯）子" -> "杯子";  "哪里 (哪儿)" -> "哪里";  "得（助动词）" -> "得"
        let t = s.replace(/[（(]([^）)]*)[）)](?=[一-鿿])/g, "$1");
        t = t.replace(/\s*[（(][^）)]*[）)]\s*/g, "");
        return t.replace(/\s+/g, "").trim() || s;
    }
    function norm(s) {
        return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
    }
    function esc(s) {
        return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function shuffle(a) {
        a = a.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
    }
    function dayKey(t) {
        const d = new Date(t === undefined ? Date.now() : t);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    function startOfDay(t) { const d = new Date(t === undefined ? Date.now() : t); d.setHours(0, 0, 0, 0); return d.getTime(); }
    function fmtDate(t) { const d = new Date(t); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); }
    function fmtNum(n) { return n.toLocaleString("vi-VN"); }
    const $ = id => document.getElementById(id);

    // ---------------------------------------------------------------- Lưu trữ
    const DEFAULT_STATE = {
        settings: { goal: 20, speak: true, rate: 0.8, dir: "mix", free: false },
        units: {},     // key -> { done, best, stars, at }
        stages: {},    // key -> { done, best, at }
        unlocked: {},  // level -> true (mở khóa cấp thủ công)
        srs: {},       // wordId -> { ef, iv, reps, due, lapses, first, last }
        days: {},      // yyyy-mm-dd -> { n: từ mới, r: lượt ôn, c: đúng, t: tổng câu, ms/mc: tổng thời gian & số lần nhận diện đúng }
        speed: { best: null, runs: 0 }, // kỷ lục chế độ đọc nhanh
        lastLevel: 1,
    };
    let S = load();
    function load() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (raw) {
                const o = JSON.parse(raw);
                return Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), o, { settings: Object.assign({}, DEFAULT_STATE.settings, o.settings || {}) });
            }
        } catch (e) { console.warn("Không đọc được tiến độ", e); }
        return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    function save() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
        catch (e) { toast("Không lưu được tiến độ (bộ nhớ trình duyệt bị chặn)"); }
        writeSummary();
    }
    // Tóm tắt tiến độ cho trang chủ (shared/progress.js)
    function writeSummary() {
        if (!window.HocProgress) return;
        try {
            const nx = nextStep();
            const groups = {};
            for (let lv = 1; lv <= 6; lv++) {
                const L = LEVELS[lv];
                groups["hsk" + lv] = { done: L.units.filter(unitDone).length, total: L.units.length, unit: "bài", label: "HSK " + lv,
                    learned: L.words.filter(w => S.srs[w.id]).length, words: L.words.length };
            }
            const d = S.days[dayKey()] || {};
            HocProgress.save("hsk_lotrinh", {
                next: nx ? (nx.type === "unit" ? `HSK ${nx.u.level} · Bài ${nx.u.n + 1}` : `HSK ${nx.st.level} · Kiểm tra chặng ${nx.st.n + 1}`) : "",
                nextUrl: "hsk_lotrinh/hsk_lotrinh.html" + (nx ? "?level=" + (nx.type === "unit" ? nx.u.level : nx.st.level) : ""),
                due: dueIds().length,
                learned: learnedCount(),
                today: { n: d.n || 0, r: d.r || 0 },
                groups,
            });
        } catch (e) { console.warn("Không ghi được tóm tắt tiến độ", e); }
    }
    function today() {
        const k = dayKey();
        if (!S.days[k]) S.days[k] = { n: 0, r: 0, c: 0, t: 0 };
        return S.days[k];
    }
    function logAnswer(ok) { const d = today(); d.t++; if (ok) d.c++; }

    // ---------------------------------------------------------------- SRS
    function status(id) {
        const c = S.srs[id];
        if (!c) return "new";
        if (c.iv >= 21) return "mastered";
        if (c.iv >= 7) return "familiar";
        return "learning";
    }
    function isDue(c, now) { return c && c.due <= (now || Date.now()); }
    function dueIds() {
        const now = Date.now();
        return Object.keys(S.srs).filter(id => BY_ID.has(id) && isDue(S.srs[id], now)).sort((a, b) => S.srs[a].due - S.srs[b].due);
    }
    // Thêm từ vừa học vào hàng đợi ôn
    function introduce(id, knewIt) {
        if (S.srs[id]) return;
        S.srs[id] = { ef: 2.5, iv: knewIt ? 1 : 0, reps: knewIt ? 1 : 0, lapses: 0, first: Date.now(), last: Date.now(),
            due: knewIt ? startOfDay() + DAY : Date.now() + 10 * 60000 };
        today().n++;
    }
    // Tính lần ôn kế tiếp; rating: 1 Quên, 2 Khó, 3 Nhớ, 4 Dễ
    function schedule(c, rating) {
        const n = Object.assign({}, c);
        n.last = Date.now();
        if (rating === 1) {
            n.reps = 0; n.lapses = (n.lapses || 0) + 1; n.ef = Math.max(1.3, n.ef - 0.2);
            n.iv = 0; n.due = Date.now() + 10 * 60000;
            return n;
        }
        let iv;
        if (rating === 2) { iv = Math.max(1, Math.round(c.iv * 1.2)); n.ef = Math.max(1.3, n.ef - 0.15); }
        else if (rating === 3) { iv = c.iv < 1 ? 1 : (c.reps <= 1 ? Math.max(3, c.iv + 1) : Math.round(c.iv * c.ef)); }
        else { iv = c.iv < 1 ? 3 : Math.round(Math.max(4, c.iv * c.ef * 1.3)); n.ef = n.ef + 0.15; }
        n.iv = Math.min(iv, 365); n.reps = (c.reps || 0) + 1;
        n.due = startOfDay() + n.iv * DAY;
        return n;
    }
    // ---------------------------------------------------------------- Thời gian phản ứng
    // Lưu thời gian nhận diện trung bình (trung bình trượt) của từng từ vào thẻ SRS: c.rt (ms)
    function updateRT(id, ms, ok) {
        const c = S.srs[id]; if (!c) return;
        ms = Math.max(150, Math.min(ms, 15000));
        if (!ok) ms = Math.max(ms, SLOW_MS + 500); // trả lời sai = coi như chưa nhận diện được
        c.rt = c.rt ? Math.round(c.rt * 0.6 + ms * 0.4) : Math.round(ms);
        if (ok) { const d = today(); d.ms = (d.ms || 0) + ms; d.mc = (d.mc || 0) + 1; }
    }
    function slowWords() {
        return Object.keys(S.srs).filter(id => BY_ID.has(id) && S.srs[id].rt >= SLOW_MS).map(id => BY_ID.get(id));
    }
    function avgRT() {
        let s = 0, n = 0;
        for (const id in S.srs) { const c = S.srs[id]; if (c.rt && BY_ID.has(id)) { s += c.rt; n++; } }
        return n ? s / n : 0;
    }
    function fmtSec(ms) { return (ms / 1000).toFixed(1).replace(".", ",") + "s"; }

    function ivLabel(c, rating) {
        const n = schedule(c, rating);
        if (n.iv === 0) return "10 phút";
        if (n.iv < 30) return n.iv + " ngày";
        if (n.iv < 365) return Math.round(n.iv / 30) + " tháng";
        return "1 năm";
    }

    // ---------------------------------------------------------------- Trạng thái lộ trình
    function unitDone(u) { return !!(S.units[u.key] && S.units[u.key].done); }
    function stageDone(st) { return !!(S.stages[st.key] && S.stages[st.key].done); }
    function stageUnitsDone(st) { return st.units.every(unitDone); }
    function levelDone(lv) { return LEVELS[lv].stages.every(stageDone); }
    function levelUnlocked(lv) { return S.settings.free || lv === 1 || S.unlocked[lv] || levelDone(lv - 1); }
    function unitAvailable(u) {
        if (S.settings.free) return true;
        if (!levelUnlocked(u.level)) return false;
        const L = LEVELS[u.level];
        const idx = L.units.indexOf(u);
        if (idx === 0) return true;
        const prev = L.units[idx - 1];
        if (!unitDone(prev)) return false;
        if (prev.stage !== u.stage && !stageDone(prev.stage)) return false;
        return true;
    }
    function stageAvailable(st) { return S.settings.free ? st.units.some(unitDone) || stageUnitsDone(st) : stageUnitsDone(st); }
    // Bài tiếp theo nên học (ưu tiên cấp đang chọn)
    function nextStep() {
        const order = [S.lastLevel].concat([1, 2, 3, 4, 5, 6].filter(l => l !== S.lastLevel));
        for (const lv of order) {
            if (!levelUnlocked(lv)) continue;
            for (const st of LEVELS[lv].stages) {
                for (const u of st.units) if (!unitDone(u) && unitAvailable(u)) return { type: "unit", u };
                if (!stageDone(st) && stageUnitsDone(st)) return { type: "stage", st };
            }
        }
        return null;
    }
    function learnedCount() { return Object.keys(S.srs).filter(id => BY_ID.has(id)).length; }
    function levelStats(lv) {
        const L = LEVELS[lv];
        let learned = 0, mastered = 0;
        L.words.forEach(w => { const s = status(w.id); if (s !== "new") learned++; if (s === "mastered") mastered++; });
        return { total: L.words.length, learned, mastered, unitsDone: L.units.filter(unitDone).length };
    }
    function streak() {
        let n = 0; let t = startOfDay();
        const active = k => S.days[k] && (S.days[k].n > 0 || S.days[k].r > 0);
        if (!active(dayKey(t))) t -= DAY; // hôm nay chưa học vẫn giữ chuỗi
        while (active(dayKey(t))) { n++; t -= DAY; }
        return n;
    }

    // ---------------------------------------------------------------- Phát âm
    let zhVoice = null;
    function pickVoice() {
        if (!("speechSynthesis" in window)) return;
        const vs = speechSynthesis.getVoices();
        zhVoice = vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
    }
    if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
    function speak(text, rate) {
        if (!("speechSynthesis" in window) || !text) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "zh-CN";
        if (zhVoice) u.voice = zhVoice;
        u.rate = rate || S.settings.rate;
        speechSynthesis.speak(u);
    }
    function autoSpeak(text) { if (S.settings.speak) speak(text); }

    // ---------------------------------------------------------------- UI chung
    let toastTimer;
    function toast(msg) {
        const t = $("toast"); t.textContent = msg; t.hidden = false;
        clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
    }
    function showView(v) {
        document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.view === v));
        document.querySelectorAll(".view").forEach(s => s.classList.toggle("active", s.id === "view-" + v));
        if (v === "path") renderPath();
        if (v === "review") renderReview();
        if (v === "dict") renderDict(true);
        if (v === "settings") renderSettings();
        window.scrollTo({ top: 0 });
    }
    function refreshHeader() {
        const due = dueIds().length;
        const b = $("tab-due"); b.hidden = due === 0; b.textContent = due > 99 ? "99+" : due;
        $("streak-pill").querySelector("b").textContent = streak();
    }

    // ================================================================ LỘ TRÌNH
    function renderPath() {
        refreshHeader();
        const d = S.days[dayKey()] || { n: 0, r: 0 };
        const goal = S.settings.goal;
        const due = dueIds().length;
        const now = new Date();
        const wd = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"][now.getDay()];
        $("today-date").textContent = wd + ", " + fmtDate(now);
        $("goal-num").textContent = d.n;
        $("goal-den").textContent = "/" + goal + " từ mới";
        $("goal-ring").style.setProperty("--p", Math.min(100, Math.round(d.n / goal * 100)));

        const next = nextStep();
        const steps = [];
        steps.push(`<li class="${due === 0 ? "done" : ""}"><b>Ôn tập</b> ${due === 0 ? "— đã ôn hết từ đến hạn ✓" : `— ${fmtNum(due)} từ đến hạn`}</li>`);
        steps.push(`<li class="${d.n >= goal ? "done" : ""}"><b>Học từ mới</b> — ${d.n >= goal ? "đã đạt mục tiêu ✓" : `còn ${goal - d.n} từ để đạt mục tiêu`}</li>`);
        const slowN = slowWords().length;
        const speedToday = (d.sp || 0) > 0;
        steps.push(`<li class="${speedToday ? "done" : ""}"><b>Tăng tốc đọc</b> — ${speedToday ? "đã luyện đọc nhanh hôm nay ✓" : slowN ? `${slowN} từ nhận diện chậm, luyện 3–5 phút` : "luyện đọc nhanh 3–5 phút"}</li>`);
        $("plan-steps").innerHTML = steps.join("");

        const acts = [];
        if (due > 0) acts.push(`<button class="btn btn-primary btn-lg" data-act="review">🔁 Ôn tập ${fmtNum(due)} từ</button>`);
        if (learnedCount() >= 4 && !speedToday) acts.push(`<button class="btn btn-lg" data-act="speed">⚡ Đọc nhanh</button>`);
        if (next) {
            const label = next.type === "unit"
                ? `HSK ${next.u.level} · Bài ${next.u.n + 1}`
                : `HSK ${next.st.level} · Kiểm tra chặng ${next.st.n + 1}`;
            acts.push(`<button class="btn ${due > 0 ? "" : "btn-primary"} btn-lg" data-act="next">▶ Học tiếp: ${label}</button>`);
        } else {
            acts.push(`<span class="muted">🎉 Bạn đã hoàn thành toàn bộ lộ trình đang mở!</span>`);
        }
        $("today-actions").innerHTML = acts.join("");
        $("today-actions").onclick = e => {
            const a = e.target.closest("[data-act]"); if (!a) return;
            if (a.dataset.act === "review") startReview();
            if (a.dataset.act === "speed") startSpeed(slowN >= 10 ? "slow" : "all", 30, 2000);
            if (a.dataset.act === "next" && next) next.type === "unit" ? startUnit(next.u) : startStage(next.st);
        };

        // Thống kê
        let learned = 0, mastered = 0;
        for (const id in S.srs) { if (!BY_ID.has(id)) continue; learned++; if (S.srs[id].iv >= 21) mastered++; }
        let c = 0, t = 0;
        Object.values(S.days).forEach(x => { c += x.c || 0; t += x.t || 0; });
        $("st-learned").textContent = fmtNum(learned);
        $("st-mastered").textContent = fmtNum(mastered);
        $("st-due").textContent = fmtNum(due);
        $("st-acc").textContent = t ? Math.round(c / t * 100) + "%" : "–";
        const art = avgRT();
        $("st-rt").textContent = art ? fmtSec(art) : "–";
        $("st-slow").textContent = fmtNum(slowN);
        renderHeatmap();

        // Chọn cấp
        $("level-switch").innerHTML = [1, 2, 3, 4, 5, 6].map(lv => {
            const s = levelStats(lv);
            const pct = Math.round(s.learned / s.total * 100);
            const lock = !levelUnlocked(lv);
            return `<button class="lvl-btn ${S.lastLevel === lv ? "active" : ""} ${lock ? "locked" : ""}" data-lv="${lv}" style="--c:${LEVEL_COLORS[lv]}">
                <span class="lvl-name">HSK ${lv} ${lock ? "🔒" : levelDone(lv) ? "✓" : ""}</span>
                <span class="lvl-sub">${fmtNum(s.total)} từ · ${pct}%</span>
                <span class="lvl-bar"><i style="width:${pct}%"></i></span>
            </button>`;
        }).join("");
        $("level-switch").onclick = e => {
            const b = e.target.closest(".lvl-btn"); if (!b) return;
            S.lastLevel = +b.dataset.lv; save(); renderPath();
        };
        renderLevelPanel(S.lastLevel);
    }

    function renderHeatmap() {
        const cells = [];
        const end = startOfDay();
        const startDow = (new Date(end).getDay() + 6) % 7; // thứ hai = 0
        const total = 11 * 7 + startDow + 1;
        for (let i = total - 1; i >= 0; i--) {
            const t = end - i * DAY;
            const x = S.days[dayKey(t)];
            const v = x ? (x.n || 0) + (x.r || 0) : 0;
            const lvl = v === 0 ? 0 : v < 10 ? 1 : v < 30 ? 2 : v < 60 ? 3 : 4;
            cells.push(`<i class="h${lvl}" title="${fmtDate(t)}: ${x ? x.n : 0} từ mới, ${x ? x.r : 0} lượt ôn"></i>`);
        }
        $("heatmap").innerHTML = cells.join("");
    }

    function renderLevelPanel(lv) {
        const L = LEVELS[lv];
        const s = levelStats(lv);
        const color = LEVEL_COLORS[lv];
        const remaining = s.total - s.learned;
        const daysLeft = Math.ceil(remaining / S.settings.goal);
        const eta = remaining > 0 ? `Với ${S.settings.goal} từ/ngày, dự kiến xong vào <b>${fmtDate(Date.now() + daysLeft * DAY)}</b> (${daysLeft} ngày)` : "Đã học hết từ của cấp này";
        let html = `<div class="lp-head" style="--c:${color}">
            <div>
                <h2>HSK ${lv} <small>${L.units.length} bài · ${L.stages.length} chặng · ${fmtNum(s.total)} từ</small></h2>
                <p class="muted">${eta}</p>
            </div>
            <div class="lp-nums">
                <div><b>${s.unitsDone}/${L.units.length}</b><small>bài</small></div>
                <div><b>${fmtNum(s.learned)}</b><small>đã học</small></div>
                <div><b>${fmtNum(s.mastered)}</b><small>thuộc lâu</small></div>
            </div>
        </div>`;
        if (!levelUnlocked(lv)) {
            html += `<div class="lock-box">
                <div class="lock-ic">🔒</div>
                <p>Hoàn thành HSK ${lv - 1} để mở khóa cấp này.<br><span class="muted">Nếu bạn đã có nền tảng, có thể bắt đầu thẳng từ HSK ${lv}.</span></p>
                <button class="btn btn-primary" id="btn-unlock">Mở khóa HSK ${lv}</button>
            </div>`;
        }
        html += `<div class="stages">`;
        L.stages.forEach(st => {
            const done = st.units.filter(unitDone).length;
            html += `<div class="stage ${stageDone(st) ? "stage-done" : ""}" style="--c:${color}">
                <div class="stage-head"><span>Chặng ${st.n + 1}</span><small>${done}/${st.units.length} bài${stageDone(st) ? " · đã qua kiểm tra" : ""}</small></div>
                <div class="nodes">`;
            st.units.forEach(u => {
                const r = S.units[u.key];
                const avail = unitAvailable(u);
                const cls = unitDone(u) ? "done" : avail ? "open" : "locked";
                const stars = r && r.stars ? "★".repeat(r.stars) + "☆".repeat(3 - r.stars) : "";
                const learnedN = u.words.filter(w => S.srs[w.id]).length;
                html += `<button class="node ${cls}" data-unit="${u.key}" title="${esc(u.words.slice(0, 6).map(w => w.hz).join(" · "))}…">
                    <span class="node-n">${u.n + 1}</span>
                    <span class="node-body">
                        <span class="node-title">Bài ${u.n + 1}</span>
                        <span class="node-preview">${esc(u.words.slice(0, 4).map(w => w.clean).join(" "))}</span>
                        <span class="node-meta">${u.words.length} từ${learnedN && !unitDone(u) ? ` · đã học ${learnedN}` : ""}${stars ? ` · <em>${stars}</em>` : ""}</span>
                    </span>
                    <span class="node-ic">${cls === "done" ? "✓" : cls === "locked" ? "🔒" : "▶"}</span>
                </button>`;
            });
            const sa = stageAvailable(st);
            const sr = S.stages[st.key];
            html += `<button class="node node-stage ${stageDone(st) ? "done" : sa ? "open" : "locked"}" data-stage="${st.key}">
                    <span class="node-n">🏁</span>
                    <span class="node-body">
                        <span class="node-title">Kiểm tra chặng ${st.n + 1}</span>
                        <span class="node-meta">${sr ? "Cao nhất " + sr.best + "%" : "Cần đạt 80% · " + Math.min(25, st.units.reduce((a, u) => a + u.words.length, 0)) + " câu"}</span>
                    </span>
                    <span class="node-ic">${stageDone(st) ? "✓" : sa ? "▶" : "🔒"}</span>
                </button>`;
            html += `</div></div>`;
        });
        html += `</div>`;
        const panel = $("level-panel");
        panel.innerHTML = html;
        panel.onclick = e => {
            if (e.target.id === "btn-unlock") {
                S.unlocked[lv] = true; S.lastLevel = lv; save(); renderPath(); toast("Đã mở khóa HSK " + lv); return;
            }
            const nb = e.target.closest(".node"); if (!nb) return;
            if (nb.dataset.unit) {
                const u = L.units.find(x => x.key === nb.dataset.unit);
                if (!unitAvailable(u)) { toast("Hoàn thành bài trước (và kiểm tra chặng) để mở bài này"); return; }
                openUnitPreview(u);
            } else if (nb.dataset.stage) {
                const st = L.stages.find(x => x.key === nb.dataset.stage);
                if (!stageAvailable(st)) { toast("Hoàn thành đủ các bài trong chặng để làm bài kiểm tra"); return; }
                startStage(st);
            }
        };
    }

    // Xem trước bài (danh sách từ) trước khi học
    function openUnitPreview(u) {
        const r = S.units[u.key];
        const rows = u.words.map(w => `<tr data-id="${esc(w.id)}">
            <td class="hz">${esc(w.hz)}</td><td class="py">${esc(w.py)}</td><td>${esc(w.vi)}</td>
            <td><span class="chip chip-${status(w.id)}">${statusLabel(status(w.id))}</span></td></tr>`).join("");
        openModal(`<div class="modal-head"><h3>HSK ${u.level} · Bài ${u.n + 1}</h3><button class="icon-btn" data-close>✕</button></div>
            <p class="muted">${u.words.length} từ${r ? ` · Điểm cao nhất ${r.best}%` : ""}. Bấm vào từ để nghe phát âm.</p>
            <div class="table-wrap"><table class="wtable">${rows}</table></div>
            <div class="btn-row end">
                ${r && r.done ? `<button class="btn" data-go="practice">Chỉ luyện tập</button>` : ""}
                <button class="btn btn-primary" data-go="learn">${r && r.done ? "Học lại" : "Bắt đầu học"}</button>
            </div>`, e => {
            const tr = e.target.closest("tr[data-id]");
            if (tr) speak(BY_ID.get(tr.dataset.id).clean);
            const g = e.target.closest("[data-go]");
            if (g) { closeModal(); g.dataset.go === "learn" ? startUnit(u) : startUnit(u, true); }
        });
    }
    function statusLabel(s) {
        return { new: "Chưa học", learning: "Đang học", familiar: "Đã quen", mastered: "Thuộc lâu" }[s];
    }

    // ================================================================ PHIÊN HỌC
    let session = null;
    function openSession(label) {
        $("session").hidden = false;
        document.body.classList.add("no-scroll");
        $("ss-label").textContent = label;
        setProgress(0);
    }
    function closeSession(force) {
        if (session && session.dirty && !force && !confirm("Thoát phiên học? Kết quả của phần đang làm sẽ không được lưu.")) return;
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        if (session && session.timer) clearTimeout(session.timer);
        session = null;
        $("session").hidden = true;
        document.body.classList.remove("no-scroll");
        const active = document.querySelector(".tab.active");
        showView(active ? active.dataset.view : "path");
    }
    function setProgress(p) { $("ss-bar").style.width = Math.round(p * 100) + "%"; }
    const body = () => $("ss-body");

    // ---------- Học bài: bước 1 - thẻ từ
    function startUnit(u, skipLearn) {
        S.lastLevel = u.level; save();
        session = { kind: "unit", unit: u, words: u.words, i: 0, dirty: false };
        openSession(`HSK ${u.level} · Bài ${u.n + 1}`);
        skipLearn ? startPractice() : renderLearnCard();
    }
    function wordCardHTML(w, opts) {
        opts = opts || {};
        return `<div class="wcard">
            <div class="wc-top">
                <span class="chip" style="--c:${LEVEL_COLORS[w.level]}">HSK ${w.level}</span>
                ${opts.counter || ""}
            </div>
            <div class="wc-hz" data-say="${esc(w.clean)}">${esc(w.hz)}</div>
            <div class="wc-py">${esc(w.py)} <button class="say-btn" data-say="${esc(w.clean)}" title="Nghe">🔊</button></div>
            ${w.hv ? `<div class="wc-hv">Hán Việt: ${esc(w.hv)}</div>` : ""}
            <div class="wc-vi">${esc(w.vi)}</div>
            ${w.ex ? `<div class="wc-ex">
                <div class="ex-hz">${highlight(w.ex, w.clean)} <button class="say-btn sm" data-say="${esc(w.ex)}" title="Nghe câu">🔊</button></div>
                <div class="ex-py">${esc(w.expy)}</div>
                <div class="ex-vi">${esc(w.exvi)}</div>
            </div>` : ""}
        </div>`;
    }
    function highlight(sentence, word) {
        const e = esc(sentence);
        if (!word || sentence.indexOf(word) < 0) return e;
        return e.split(esc(word)).join(`<mark>${esc(word)}</mark>`);
    }
    function renderLearnCard() {
        const s = session, w = s.words[s.i];
        setProgress(s.i / s.words.length * 0.4);
        body().innerHTML = `<div class="step-tag">Bước 1/2 · Học từ mới</div>
            ${wordCardHTML(w, { counter: `<span class="muted">${s.i + 1} / ${s.words.length}</span>` })}
            <div class="btn-row center">
                <button class="btn" data-nav="prev" ${s.i === 0 ? "disabled" : ""}>← Trước</button>
                <button class="btn btn-primary" data-nav="next">${s.i === s.words.length - 1 ? "Bắt đầu luyện tập →" : "Tiếp →"}</button>
            </div>
            <div class="kbd-hint">Phím: ← → để chuyển · Space để nghe</div>`;
        autoSpeak(w.clean);
        body().onclick = e => {
            const say = e.target.closest("[data-say]"); if (say) { speak(say.dataset.say); return; }
            const n = e.target.closest("[data-nav]"); if (!n) return;
            learnNav(n.dataset.nav === "next" ? 1 : -1);
        };
    }
    function learnNav(d) {
        const s = session;
        if (d > 0 && s.i === s.words.length - 1) { startPractice(); return; }
        s.i = Math.max(0, Math.min(s.words.length - 1, s.i + d));
        renderLearnCard();
    }

    // ---------- Bộ sinh câu hỏi
    function pickDistractors(w, n, pool, key) {
        const seen = new Set([w[key]]);
        const out = [];
        const tryPool = p => { for (const x of shuffle(p)) { if (out.length >= n) break; if (!seen.has(x[key]) && x.clean !== w.clean) { seen.add(x[key]); out.push(x); } } };
        // ưu tiên từ cùng độ dài chữ Hán, cùng cấp để câu hỏi khó hơn
        tryPool(pool.filter(x => x.clean.length === w.clean.length));
        if (out.length < n) tryPool(pool);
        if (out.length < n) tryPool(LEVELS[w.level].words);
        return out;
    }
    const QTYPES = {
        meaning: "Chọn nghĩa đúng",
        hanzi: "Chọn chữ Hán đúng",
        listen: "Nghe và chọn từ đúng",
        cloze: "Chọn từ điền vào chỗ trống",
        pinyin: "Chọn phiên âm đúng",
    };
    function makeQuestion(w, type, pool) {
        if (type === "cloze" && (!w.ex || w.ex.indexOf(w.clean) < 0)) type = "hanzi";
        const ds = pickDistractors(w, 3, pool, type === "meaning" ? "vi" : type === "pinyin" ? "py" : "clean");
        const opts = shuffle([w].concat(ds));
        const q = { w, type, opts, answer: opts.indexOf(w) };
        if (type === "meaning") { q.prompt = `<div class="q-hz" data-say="${esc(w.clean)}">${esc(w.hz)}</div><div class="q-sub">${esc(w.py)}</div>`; q.label = o => esc(o.vi); }
        if (type === "pinyin") { q.prompt = `<div class="q-hz">${esc(w.hz)}</div>`; q.label = o => esc(o.py); }
        if (type === "hanzi") { q.prompt = `<div class="q-vi">${esc(w.vi)}</div>`; q.label = o => `<span class="opt-hz">${esc(o.clean)}</span>`; }
        if (type === "listen") { q.prompt = `<button class="listen-btn" data-say="${esc(w.clean)}">🔊</button><div class="q-sub">Bấm để nghe lại</div>`; q.label = o => `<span class="opt-hz">${esc(o.clean)}</span>`; q.say = w.clean; }
        if (type === "cloze") {
            const blank = esc(w.ex).split(esc(w.clean)).join(`<span class="blank">${"＿".repeat(w.clean.length)}</span>`);
            q.prompt = `<div class="q-cloze">${blank}</div><div class="q-sub">${esc(w.exvi)}</div>`;
            q.label = o => `<span class="opt-hz">${esc(o.clean)}</span>`;
        }
        return q;
    }

    // ---------- Học bài: bước 2 - luyện tập
    function startPractice() {
        const s = session;
        s.dirty = true;
        const pool = LEVELS[s.unit.level].words;
        const r1 = shuffle(s.words).map(w => makeQuestion(w, Math.random() < 0.5 ? "meaning" : "pinyin", pool));
        const hard = ["hanzi", "listen", "cloze", "cloze"];
        const r2 = shuffle(s.words).map(w => makeQuestion(w, hard[Math.floor(Math.random() * hard.length)], pool));
        runQuiz({
            title: "Bước 2/2 · Luyện tập",
            questions: r1.concat(r2),
            progressBase: 0.4,
            retryWrong: true,
            onDone: res => finishUnit(res),
        });
    }

    // ---------- Engine trắc nghiệm dùng chung
    function runQuiz(cfg) {
        const q = { cfg, queue: cfg.questions.slice(), total: cfg.questions.length, done: 0, firstTry: 0, attempts: {}, wrongWords: new Map(), answered: false };
        session.quiz = q;
        renderQuestion();
    }
    function renderQuestion() {
        const q = session.quiz;
        if (!q.queue.length) { q.cfg.onDone(quizResult(q)); return; }
        const cur = q.queue[0];
        const base = q.cfg.progressBase || 0;
        setProgress(base + (1 - base) * (q.done / q.total));
        q.answered = false;
        body().innerHTML = `<div class="step-tag">${q.cfg.title}${cur.retry ? " · <em>làm lại câu sai</em>" : ""}</div>
            <div class="quiz">
                <div class="q-type">${QTYPES[cur.type]}</div>
                <div class="q-prompt">${cur.prompt}</div>
                <div class="opts">${cur.opts.map((o, i) => `<button class="opt" data-i="${i}"><kbd>${i + 1}</kbd><span>${cur.label(o)}</span></button>`).join("")}</div>
                <div class="feedback" id="feedback"></div>
            </div>`;
        if (cur.say) setTimeout(() => speak(cur.say), 150);
        body().onclick = e => {
            const say = e.target.closest("[data-say]"); if (say) { speak(say.dataset.say); return; }
            const o = e.target.closest(".opt"); if (o && !q.answered) { answer(+o.dataset.i); return; }
            if (e.target.closest("#btn-continue")) nextQuestion();
        };
    }
    function answer(i) {
        const q = session.quiz, cur = q.queue[0];
        q.answered = true;
        const ok = i === cur.answer;
        const btns = body().querySelectorAll(".opt");
        btns.forEach((b, k) => { b.disabled = true; if (k === cur.answer) b.classList.add("correct"); else if (k === i) b.classList.add("wrong"); });
        logAnswer(ok);
        if (!cur.retry) { if (ok) q.firstTry++; }
        if (!ok) {
            q.wrongWords.set(cur.w.id, cur.w);
            if (q.cfg.retryWrong && !cur.retry) {
                const again = makeQuestion(cur.w, cur.type, LEVELS[cur.w.level].words);
                again.retry = true;
                q.queue.splice(Math.min(q.queue.length, 4), 0, again);
            }
        }
        const w = cur.w;
        $("feedback").innerHTML = `<div class="fb ${ok ? "fb-ok" : "fb-bad"}">
            <div class="fb-title">${ok ? "Chính xác! 🎉" : "Chưa đúng"}</div>
            <div class="fb-word"><span class="fb-hz">${esc(w.hz)}</span> <span class="py">${esc(w.py)}</span> — ${esc(w.vi)}
                <button class="say-btn sm" data-say="${esc(w.clean)}">🔊</button></div>
            ${!ok && w.ex ? `<div class="fb-ex">${highlight(w.ex, w.clean)}<br><small>${esc(w.exvi)}</small></div>` : ""}
            <button class="btn btn-primary" id="btn-continue">Tiếp tục (Enter)</button>
        </div>`;
        if (S.settings.speak && cur.type !== "listen") speak(w.clean);
    }
    function nextQuestion() {
        const q = session.quiz;
        const cur = q.queue.shift();
        if (!cur.retry) q.done++;
        renderQuestion();
    }
    function quizResult(q) {
        return { score: q.total ? Math.round(q.firstTry / q.total * 100) : 0, correct: q.firstTry, total: q.total, wrong: Array.from(q.wrongWords.values()) };
    }
    function starsFor(score) { return score >= 95 ? 3 : score >= 85 ? 2 : score >= 70 ? 1 : 0; }

    function finishUnit(res) {
        const s = session, u = s.unit;
        const passed = res.score >= PASS_UNIT * 100;
        const wrongIds = new Set(res.wrong.map(w => w.id));
        let newCount = 0;
        u.words.forEach(w => { if (!S.srs[w.id]) { introduce(w.id, !wrongIds.has(w.id)); newCount++; } });
        const prev = S.units[u.key] || {};
        const stars = starsFor(res.score);
        S.units[u.key] = { done: prev.done || passed, best: Math.max(prev.best || 0, res.score), stars: Math.max(prev.stars || 0, stars), at: Date.now() };
        save();
        s.dirty = false;
        setProgress(1);
        const next = passed ? nextStep() : null;
        renderResult({
            passed, res, stars,
            title: passed ? "Hoàn thành bài học!" : "Chưa đạt — hãy thử lại",
            note: passed
                ? `${newCount ? newCount + " từ mới đã được thêm vào lịch ôn tập. " : ""}Các từ trả lời sai sẽ được hẹn ôn lại sau 10 phút.`
                : `Cần đạt ít nhất ${PASS_UNIT * 100}% để qua bài. Xem lại các từ sai bên dưới rồi luyện lại nhé.`,
            actions: passed
                ? [next ? { id: "next", label: next.type === "unit" ? `Bài tiếp theo (Bài ${next.u.n + 1}) →` : `Kiểm tra chặng ${next.st.n + 1} →`, primary: true } : null, { id: "home", label: "Về lộ trình" }]
                : [{ id: "retry", label: "Luyện lại", primary: true }, { id: "relearn", label: "Học lại thẻ từ" }, { id: "home", label: "Về lộ trình" }],
            onAction: id => {
                if (id === "home") closeSession(true);
                if (id === "retry") { session = { kind: "unit", unit: u, words: u.words, i: 0 }; startPractice(); }
                if (id === "relearn") { session = { kind: "unit", unit: u, words: u.words, i: 0 }; renderLearnCard(); }
                if (id === "next") { closeSession(true); next.type === "unit" ? startUnit(next.u) : startStage(next.st); }
            },
        });
    }

    function renderResult(o) {
        const r = o.res;
        const starsHtml = o.stars !== undefined ? `<div class="big-stars">${[0, 1, 2].map(i => `<span class="${i < o.stars ? "on" : ""}">★</span>`).join("")}</div>` : "";
        body().innerHTML = `<div class="result ${o.passed ? "pass" : "fail"}">
            ${starsHtml}
            <h2>${o.title}</h2>
            <div class="score-big">${r.score}%</div>
            <div class="muted">${r.correct}/${r.total} câu đúng ngay lần đầu</div>
            <p>${o.note}</p>
            ${r.wrong.length ? `<div class="wrong-list"><h4>Từ cần chú ý (${r.wrong.length})</h4>${r.wrong.map(w => `<div class="wl-item" data-say="${esc(w.clean)}"><span class="hz">${esc(w.hz)}</span><span class="py">${esc(w.py)}</span><span>${esc(w.vi)}</span></div>`).join("")}</div>` : ""}
            <div class="btn-row center">${o.actions.filter(Boolean).map(a => `<button class="btn ${a.primary ? "btn-primary" : ""}" data-res="${a.id}">${a.label}</button>`).join("")}</div>
        </div>`;
        body().onclick = e => {
            const say = e.target.closest("[data-say]"); if (say) { speak(say.dataset.say); return; }
            const b = e.target.closest("[data-res]"); if (b) o.onAction(b.dataset.res);
        };
    }

    // ---------- Kiểm tra chặng
    function startStage(st) {
        S.lastLevel = st.level; save();
        const words = shuffle([].concat(...st.units.map(u => u.words))).slice(0, 25);
        const pool = LEVELS[st.level].words;
        const types = ["meaning", "hanzi", "listen", "cloze", "pinyin"];
        session = { kind: "stage", stage: st, dirty: true };
        openSession(`HSK ${st.level} · Kiểm tra chặng ${st.n + 1}`);
        runQuiz({
            title: `Kiểm tra chặng · cần đạt ${PASS_STAGE * 100}%`,
            questions: words.map((w, i) => makeQuestion(w, types[i % types.length], pool)),
            retryWrong: false,
            onDone: res => {
                const passed = res.score >= PASS_STAGE * 100;
                const prev = S.stages[st.key] || {};
                S.stages[st.key] = { done: prev.done || passed, best: Math.max(prev.best || 0, res.score), at: Date.now() };
                // từ sai trong bài kiểm tra -> ôn lại sớm
                res.wrong.forEach(w => { if (S.srs[w.id]) S.srs[w.id] = schedule(S.srs[w.id], 1); });
                save();
                session.dirty = false;
                setProgress(1);
                const lvDone = levelDone(st.level);
                const next = passed ? nextStep() : null;
                renderResult({
                    passed, res,
                    title: passed ? (lvDone ? `🎓 Hoàn thành HSK ${st.level}!` : "Qua chặng!") : "Chưa đạt bài kiểm tra",
                    note: passed
                        ? (lvDone ? `Chúc mừng! Bạn đã hoàn thành toàn bộ lộ trình HSK ${st.level}. Tiếp tục ôn tập hằng ngày để giữ từ vựng.` : "Chặng tiếp theo đã được mở khóa.")
                        : `Cần đạt ${PASS_STAGE * 100}%. Các từ sai đã được đưa vào hàng đợi ôn tập — hãy ôn rồi làm lại.`,
                    actions: passed
                        ? [next ? { id: "next", label: "Học tiếp →", primary: true } : null, { id: "home", label: "Về lộ trình" }]
                        : [{ id: "retry", label: "Làm lại", primary: true }, { id: "home", label: "Về lộ trình" }],
                    onAction: id => {
                        if (id === "home") closeSession(true);
                        if (id === "retry") { closeSession(true); startStage(st); }
                        if (id === "next") { closeSession(true); next.type === "unit" ? startUnit(next.u) : startStage(next.st); }
                    },
                });
            },
        });
    }

    // ================================================================ ÔN TẬP SRS
    function renderReview() {
        refreshHeader();
        const due = dueIds();
        $("rv-due").textContent = fmtNum(due.length);
        const learned = Object.keys(S.srs).filter(id => BY_ID.has(id)).length;
        $("rv-sub").textContent = learned === 0
            ? "Bạn chưa học từ nào. Hãy bắt đầu với bài đầu tiên trong Lộ trình."
            : due.length ? "Ôn các từ đến hạn trước khi học bài mới để không bị quên." : "Tuyệt vời! Bạn đã ôn hết các từ đến hạn hôm nay.";
        $("btn-start-review").disabled = due.length === 0;

        // Dự báo 7 ngày
        const days = [];
        const sod = startOfDay();
        for (let i = 0; i < 7; i++) {
            const end = sod + (i + 1) * DAY;
            const start = i === 0 ? -Infinity : sod + i * DAY;
            let n = 0;
            for (const id in S.srs) { const d = S.srs[id].due; if (d >= start && d < end) n++; }
            days.push({ label: i === 0 ? "Hôm nay" : ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][new Date(sod + i * DAY).getDay()], n });
        }
        const max = Math.max(1, ...days.map(d => d.n));
        $("forecast").innerHTML = `<div class="fc-title">Dự báo số từ cần ôn 7 ngày tới</div><div class="fc-bars">${days.map(d =>
            `<div class="fc-col"><span class="fc-n">${d.n}</span><span class="fc-bar" style="height:${Math.max(4, d.n / max * 100)}%"></span><span class="fc-l">${d.label}</span></div>`).join("")}</div>`;

        // Đọc nhanh
        const slow = slowWords().length;
        const ssel = $("speed-src"), scur = ssel.value;
        const opts = [{ v: "slow", t: `Từ cần tăng tốc (${slow})`, n: slow }, { v: "all", t: `Tất cả từ đã học (${learned})`, n: learned }]
            .concat([1, 2, 3, 4, 5, 6].map(lv => { const n = LEVELS[lv].words.filter(w => S.srs[w.id]).length; return { v: "lv" + lv, t: `HSK ${lv} (${n})`, n }; }));
        ssel.innerHTML = opts.map(o => `<option value="${o.v}" ${o.n < 4 ? "disabled" : ""}>${o.t}</option>`).join("");
        const okOpt = opts.find(o => o.v === scur && o.n >= 4) || opts.find(o => o.n >= 4 && o.v === (slow >= 10 ? "slow" : "all")) || opts.find(o => o.n >= 4);
        if (okOpt) ssel.value = okOpt.v;
        $("btn-speed").disabled = !okOpt;
        const best = S.speed && S.speed.best;
        $("speed-best").innerHTML = best
            ? `🏆 Kỷ lục: <b>${best.wpm} từ/phút</b> · ${best.acc}% chính xác · nhanh nhất ${fmtSec(best.limit)}/từ`
            : "Chưa có kỷ lục — hãy thử lượt đầu tiên!";
        const art = avgRT();
        $("speed-avg").innerHTML = art ? `Thời gian nhận diện trung bình: <b>${fmtSec(art)}</b> · ${slow} từ chậm hơn ${SLOW_MS / 1000}s` : "Thời gian nhận diện sẽ được đo khi bạn ôn tập và luyện đọc nhanh.";

        const weak = weakWords();
        $("weak-count").textContent = weak.length + " từ";
        $("btn-weak").disabled = weak.length < 4;
        const sel = $("quick-level");
        const cur = sel.value;
        sel.innerHTML = [1, 2, 3, 4, 5, 6].map(lv => {
            const n = LEVELS[lv].words.filter(w => S.srs[w.id]).length;
            return `<option value="${lv}" ${n < 4 ? "disabled" : ""}>HSK ${lv} (${n} từ)</option>`;
        }).join("");
        const firstOk = [...sel.options].find(o => !o.disabled);
        sel.value = cur && !sel.querySelector(`option[value="${cur}"]`).disabled ? cur : (firstOk ? firstOk.value : "1");
        $("btn-quick").disabled = !firstOk;
        $("btn-listen").disabled = learned < 4;
    }
    function weakWords() {
        return Object.keys(S.srs).filter(id => BY_ID.has(id) && (S.srs[id].lapses || 0) >= 2).map(id => BY_ID.get(id));
    }

    function startReview() {
        const ids = dueIds().slice(0, 100);
        if (!ids.length) { toast("Không có từ nào đến hạn ôn"); return; }
        session = { kind: "review", queue: ids.map(id => ({ id, again: false })), total: ids.length, done: 0, stats: { 1: 0, 2: 0, 3: 0, 4: 0 }, dirty: false };
        openSession(`Ôn tập · ${ids.length} từ`);
        renderReviewCard();
    }
    function reviewFront(c, w) {
        const d = S.settings.dir;
        if (d === "hz") return "hz";
        if (d === "vi") return "vi";
        return (w.idx + (c.reps || 0)) % 2 === 0 ? "hz" : "vi";
    }
    function renderReviewCard() {
        const s = session;
        if (!s.queue.length) { finishReview(); return; }
        setProgress(s.done / s.total);
        const item = s.queue[0], w = BY_ID.get(item.id), c = S.srs[item.id];
        const front = reviewFront(c, w);
        s.revealed = false;
        s.front = front;
        s.t0 = performance.now();
        body().innerHTML = `<div class="step-tag">Ôn tập · còn ${s.queue.length} thẻ${item.again ? " · <em>ôn lại</em>" : ""}</div>
            <div class="rcard">
                <div class="rc-front">${front === "hz"
                    ? `<div class="wc-hz" data-say="${esc(w.clean)}">${esc(w.hz)}</div><div class="q-sub">Nghĩa của từ này là gì?</div>`
                    : `<div class="q-vi">${esc(w.vi)}</div><div class="q-sub">Từ tiếng Trung là gì? Hãy nhớ cả cách đọc.</div>`}
                </div>
                <div class="rc-back" id="rc-back" hidden>${wordCardHTML(w)}</div>
            </div>
            <div class="rc-actions" id="rc-actions">
                <button class="btn btn-primary btn-lg" id="btn-reveal">Hiện đáp án (Space)</button>
            </div>`;
        if (front === "hz") autoSpeak(w.clean);
        body().onclick = e => {
            const say = e.target.closest("[data-say]"); if (say) { speak(say.dataset.say); return; }
            if (e.target.closest("#btn-reveal")) { reveal(); return; }
            const r = e.target.closest("[data-rate]"); if (r) rate(+r.dataset.rate);
        };
    }
    function reveal() {
        const s = session; if (!s || s.revealed) return;
        s.revealed = true;
        s.ms = performance.now() - s.t0;
        const item = s.queue[0], w = BY_ID.get(item.id), c = S.srs[item.id];
        $("rc-back").hidden = false;
        body().querySelector(".rc-front").classList.add("dim");
        const slow = s.ms > SLOW_MS;
        $("rc-actions").innerHTML = `<div class="rt-badge ${slow ? "slow" : "fast"}">⏱ ${fmtSec(s.ms)}${slow ? " — hơi lâu, nếu phải nghĩ mới ra hãy chọn <b>Khó</b>" : " — nhanh!"}</div>
            <div class="rate-row">
            <button class="rate r1" data-rate="1"><kbd>1</kbd><b>Quên</b><small>${ivLabel(c, 1)}</small></button>
            <button class="rate r2" data-rate="2"><kbd>2</kbd><b>Khó</b><small>${ivLabel(c, 2)}</small></button>
            <button class="rate r3" data-rate="3"><kbd>3</kbd><b>Nhớ</b><small>${ivLabel(c, 3)}</small></button>
            <button class="rate r4" data-rate="4"><kbd>4</kbd><b>Dễ</b><small>${ivLabel(c, 4)}</small></button>
        </div>`;
        autoSpeak(w.clean);
    }
    function rate(r) {
        const s = session; if (!s || !s.revealed) return;
        const item = s.queue.shift();
        const rt = S.srs[item.id].rt;
        S.srs[item.id] = schedule(S.srs[item.id], r);
        if (rt) S.srs[item.id].rt = rt;
        // chỉ đo tốc độ nhận diện khi mặt trước là chữ Hán (chiều đọc)
        if (s.front === "hz" && !item.again) {
            updateRT(item.id, s.ms, r >= 3);
            if (r >= 3) { s.rtSum = (s.rtSum || 0) + s.ms; s.rtN = (s.rtN || 0) + 1; }
        }
        const d = today(); d.r++; logAnswer(r >= 3);
        if (!item.again) { s.stats[r]++; s.done++; }
        // thẻ bị quên được đưa lại vào cuối nhóm 5 thẻ tới cho tới khi nhớ
        if (r === 1) s.queue.splice(Math.min(s.queue.length, 5), 0, { id: item.id, again: true });
        save();
        renderReviewCard();
    }
    function finishReview() {
        const s = session; setProgress(1);
        const t = s.stats[1] + s.stats[2] + s.stats[3] + s.stats[4];
        const score = t ? Math.round((s.stats[3] + s.stats[4]) / t * 100) : 0;
        renderResult({
            passed: true,
            res: { score, correct: s.stats[3] + s.stats[4], total: t, wrong: [] },
            title: "Hoàn thành phiên ôn tập!",
            note: `Quên: ${s.stats[1]} · Khó: ${s.stats[2]} · Nhớ: ${s.stats[3]} · Dễ: ${s.stats[4]}.${s.rtN ? ` Thời gian nhận diện trung bình: <b>${fmtSec(s.rtSum / s.rtN)}</b>.` : ""} Các từ sẽ được hẹn ôn vào đúng thời điểm.`,
            actions: [dueIds().length ? { id: "more", label: "Ôn tiếp", primary: true } : null, { id: "home", label: "Về lộ trình", primary: !dueIds().length }],
            onAction: id => { if (id === "home") closeSession(true); if (id === "more") { closeSession(true); startReview(); } },
        });
    }

    // ================================================================ ĐỌC NHANH
    // Chữ Hán hiện ra kèm 2 nghĩa, phải chọn đúng trong thời gian giới hạn.
    // Tốc độ tự điều chỉnh: đúng 3 câu liên tiếp -> nhanh hơn 15%; sai / hết giờ -> chậm lại 15%.
    function speedPool(src) {
        if (src === "slow") return slowWords();
        if (src === "all") return WORDS.filter(w => S.srs[w.id]);
        const lv = +String(src).replace("lv", "");
        return LEVELS[lv] ? LEVELS[lv].words.filter(w => S.srs[w.id]) : [];
    }
    function startSpeed(src, count, limit) {
        const pool = speedPool(src);
        if (pool.length < 4) { toast(src === "slow" ? "Chưa có đủ từ cần tăng tốc — hãy chọn nguồn khác" : "Cần học ít nhất 4 từ để luyện đọc nhanh"); return; }
        // ưu tiên từ chậm nhất, lặp lại nếu nguồn ít từ hơn số câu
        const sorted = shuffle(pool).sort((a, b) => (S.srs[b.id].rt || SLOW_MS) - (S.srs[a.id].rt || SLOW_MS));
        const base = sorted.slice(0, Math.max(count, 4));
        const list = [];
        while (list.length < count) {
            for (const w of shuffle(base)) {
                if (list.length >= count) break;
                if (list.length && list[list.length - 1].id === w.id) continue;
                list.push(w);
            }
        }
        session = {
            kind: "speed", src, list, i: 0, limit, startLimit: limit, minLimit: limit, combo: 0, maxCombo: 0,
            correct: 0, rtSum: 0, totalMs: 0, missed: new Map(), timer: null, locked: false, dirty: true,
        };
        openSession(`⚡ Đọc nhanh · ${count} từ`);
        renderSpeedCountdown(3);
    }
    function renderSpeedCountdown(n) {
        const s = session; if (!s || s.kind !== "speed") return;
        if (n === 0) { renderSpeedItem(); return; }
        body().innerHTML = `<div class="speed"><div class="sp-count">${n}</div>
            <p class="muted center">Nhìn chữ Hán và chọn nghĩa đúng thật nhanh.<br>Phím <kbd>←</kbd> chọn bên trái · <kbd>→</kbd> chọn bên phải</p></div>`;
        body().onclick = null;
        s.timer = setTimeout(() => renderSpeedCountdown(n - 1), 700);
    }
    function renderSpeedItem() {
        const s = session;
        if (s.i >= s.list.length) { finishSpeed(); return; }
        const w = s.list[s.i];
        const d = pickDistractors(w, 1, LEVELS[w.level].words, "vi")[0];
        s.opts = shuffle([w, d]);
        s.answer = s.opts.indexOf(w);
        s.locked = false;
        setProgress(s.i / s.list.length);
        body().innerHTML = `<div class="speed">
            <div class="sp-top">
                <span>Câu <b>${s.i + 1}</b>/${s.list.length}</span>
                <span class="sp-limit">⏱ ${fmtSec(s.limit)}/từ</span>
                <span>🔥 Chuỗi <b>${s.combo}</b></span>
            </div>
            <div class="sp-timer"><i style="animation-duration:${s.limit}ms"></i></div>
            <div class="sp-hz" id="sp-hz">${esc(w.hz)}</div>
            <div class="sp-py" id="sp-py">&nbsp;</div>
            <div class="sp-opts">
                <button class="sp-opt" data-k="0"><kbd>←</kbd><span>${esc(s.opts[0].vi)}</span></button>
                <button class="sp-opt" data-k="1"><span>${esc(s.opts[1].vi)}</span><kbd>→</kbd></button>
            </div>
        </div>`;
        body().onclick = e => { const b = e.target.closest(".sp-opt"); if (b) speedAnswer(+b.dataset.k); };
        s.t0 = performance.now();
        clearTimeout(s.timer);
        s.timer = setTimeout(() => speedAnswer(-1), s.limit);
    }
    function speedAnswer(k) {
        const s = session; if (!s || s.kind !== "speed" || s.locked) return;
        s.locked = true;
        clearTimeout(s.timer);
        const ms = Math.min(performance.now() - s.t0, s.limit);
        const w = s.list[s.i];
        const ok = k === s.answer;
        s.totalMs += ms;
        logAnswer(ok);
        updateRT(w.id, ok ? ms : SLOW_MS + 500, ok);
        const btns = body().querySelectorAll(".sp-opt");
        btns.forEach((b, i) => { b.disabled = true; if (i === s.answer) b.classList.add("correct"); else if (i === k) b.classList.add("wrong"); });
        const timer = body().querySelector(".sp-timer i"); if (timer) timer.style.animationPlayState = "paused";
        $("sp-py").textContent = w.py;
        if (ok) {
            s.correct++; s.rtSum += ms; s.combo++; s.maxCombo = Math.max(s.maxCombo, s.combo);
            if (s.combo % 3 === 0) s.limit = Math.max(SPEED_MIN, Math.round(s.limit * 0.85 / 50) * 50);
            s.minLimit = Math.min(s.minLimit, s.limit);
        } else {
            s.combo = 0;
            s.limit = Math.min(SPEED_MAX, Math.round(s.limit * 1.15 / 50) * 50);
            s.missed.set(w.id, w);
            $("sp-hz").classList.add(k === -1 ? "timeout" : "miss");
            if (k === -1) $("sp-py").textContent = w.py + " · hết giờ!";
            if (S.settings.speak) speak(w.clean);
        }
        s.i++;
        s.timer = setTimeout(renderSpeedItem, ok ? 350 : 1400);
    }
    function finishSpeed() {
        const s = session;
        s.dirty = false;
        setProgress(1);
        const total = s.list.length;
        const acc = Math.round(s.correct / total * 100);
        const avg = s.correct ? s.rtSum / s.correct : 0;
        const wpm = s.totalMs ? Math.round(s.correct / (s.totalMs / 60000)) : 0;
        const d = today(); d.sp = (d.sp || 0) + 1;
        S.speed = S.speed || { best: null, runs: 0 };
        S.speed.runs++;
        const prev = S.speed.best;
        const record = acc >= 80 && (!prev || wpm > prev.wpm);
        if (record) S.speed.best = { wpm, acc, avg: Math.round(avg), limit: s.minLimit, at: Date.now() };
        save();
        const missed = Array.from(s.missed.values());
        body().innerHTML = `<div class="result ${acc >= 80 ? "pass" : "fail"}">
            ${record ? `<div class="record-tag">🏆 Kỷ lục mới!</div>` : ""}
            <h2>${acc >= 90 ? "Phản xạ rất tốt!" : acc >= 70 ? "Khá lắm, tiếp tục luyện!" : "Cần luyện thêm"}</h2>
            <div class="speed-stats">
                <div><b>${wpm}</b><small>từ/phút</small></div>
                <div><b>${avg ? fmtSec(avg) : "–"}</b><small>TB mỗi từ</small></div>
                <div><b>${acc}%</b><small>chính xác</small></div>
                <div><b>${fmtSec(s.minLimit)}</b><small>tốc độ nhanh nhất</small></div>
                <div><b>${s.maxCombo}</b><small>chuỗi dài nhất</small></div>
            </div>
            ${prev && !record ? `<p class="muted">Kỷ lục của bạn: ${prev.wpm} từ/phút (${prev.acc}% chính xác)</p>` : ""}
            <p>${missed.length ? "Các từ sai / hết giờ đã được đánh dấu <b>cần tăng tốc</b> để luyện lại." : "Không sai từ nào — hãy thử bắt đầu với tốc độ nhanh hơn!"}</p>
            ${missed.length ? `<div class="wrong-list"><h4>Từ cần tăng tốc (${missed.length})</h4>${missed.map(w => `<div class="wl-item" data-say="${esc(w.clean)}"><span class="hz">${esc(w.hz)}</span><span class="py">${esc(w.py)}</span><span>${esc(w.vi)}</span></div>`).join("")}</div>` : ""}
            <div class="btn-row center">
                <button class="btn btn-primary" data-res="again">Luyện lượt nữa</button>
                ${slowWords().length >= 4 ? `<button class="btn" data-res="slow">Luyện từ chậm (${slowWords().length})</button>` : ""}
                <button class="btn" data-res="home">Đóng</button>
            </div>
        </div>`;
        const startNext = Math.max(SPEED_MIN, Math.round((acc >= 90 ? s.minLimit * 1.1 : s.startLimit) / 50) * 50);
        body().onclick = e => {
            const say = e.target.closest("[data-say]"); if (say) { speak(say.dataset.say); return; }
            const b = e.target.closest("[data-res]"); if (!b) return;
            const src = s.src;
            if (b.dataset.res === "home") closeSession(true);
            if (b.dataset.res === "again") { closeSession(true); startSpeed(src, total, Math.min(startNext, SPEED_MAX)); }
            if (b.dataset.res === "slow") { closeSession(true); startSpeed("slow", total, s.startLimit); }
        };
    }

    // ---------- Luyện tập tự do (không ảnh hưởng tiến độ bài)
    function startFreeQuiz(all, title, types) {
        const words = shuffle(all).slice(0, 20);
        if (words.length < 4) { toast("Cần học ít nhất 4 từ để luyện tập"); return; }
        session = { kind: "free", dirty: false };
        openSession(title);
        runQuiz({
            title,
            questions: words.map((w, i) => makeQuestion(w, types[i % types.length], LEVELS[w.level].words)),
            retryWrong: true,
            onDone: res => {
                // từ sai -> đưa về ôn sớm
                res.wrong.forEach(w => { if (S.srs[w.id]) S.srs[w.id] = schedule(S.srs[w.id], 1); });
                save();
                setProgress(1);
                renderResult({
                    passed: res.score >= 70, res,
                    title: res.score >= 70 ? "Làm tốt lắm!" : "Cần ôn thêm",
                    note: res.wrong.length ? "Các từ sai đã được đưa vào hàng đợi ôn tập." : "Bạn trả lời đúng tất cả!",
                    actions: [{ id: "again", label: "Luyện lượt khác", primary: true }, { id: "home", label: "Đóng" }],
                    onAction: id => { if (id === "home") closeSession(true); if (id === "again") { closeSession(true); startFreeQuiz(all, title, types); } },
                });
            },
        });
    }

    // ================================================================ TỪ ĐIỂN
    let dictShown = 0, dictResults = [];
    function renderDict(reset) {
        if (reset) {
            const q = norm($("dict-q").value.trim());
            const lv = +$("dict-level").value;
            const st = $("dict-status").value;
            const now = Date.now();
            dictResults = WORDS.filter(w => {
                if (lv && w.level !== lv) return false;
                if (st === "due") { if (!isDue(S.srs[w.id], now)) return false; }
                else if (st === "slow") { if (!S.srs[w.id] || !(S.srs[w.id].rt >= SLOW_MS)) return false; }
                else if (st && status(w.id) !== st) return false;
                if (q && w.search.indexOf(q) < 0 && w.search.replace(/\s+/g, "").indexOf(q.replace(/\s+/g, "")) < 0) return false;
                return true;
            });
            dictShown = 0;
            $("dict-list").innerHTML = "";
            $("dict-meta").textContent = `${fmtNum(dictResults.length)} từ`;
        }
        const chunk = dictResults.slice(dictShown, dictShown + 60);
        $("dict-list").insertAdjacentHTML("beforeend", chunk.map(w => {
            const s = status(w.id);
            return `<button class="drow" data-id="${esc(w.id)}">
                <span class="drow-hz">${esc(w.hz)}</span>
                <span class="drow-main"><span class="py">${esc(w.py)}</span><span class="drow-vi">${esc(w.vi)}</span></span>
                <span class="drow-tags"><span class="chip" style="--c:${LEVEL_COLORS[w.level]}">HSK ${w.level}</span><span class="chip chip-${s}">${statusLabel(s)}</span></span>
            </button>`;
        }).join(""));
        dictShown += chunk.length;
        $("dict-more").hidden = dictShown >= dictResults.length;
    }
    function openWordModal(w) {
        const c = S.srs[w.id];
        const info = c
            ? `<div class="srs-info">
                <span>Trạng thái: <b>${statusLabel(status(w.id))}</b></span>
                <span>Lần ôn tới: <b>${c.due <= Date.now() ? "Đến hạn" : fmtDate(c.due)}</b></span>
                <span>Khoảng cách: <b>${c.iv} ngày</b></span>
                <span>Số lần quên: <b>${c.lapses || 0}</b></span>
                <span>Tốc độ nhận diện: <b>${c.rt ? fmtSec(c.rt) + (c.rt >= SLOW_MS ? " (chậm)" : "") : "chưa đo"}</b></span>
            </div>`
            : `<div class="srs-info"><span>Chưa học từ này.</span></div>`;
        openModal(`<div class="modal-head"><h3>Chi tiết từ</h3><button class="icon-btn" data-close>✕</button></div>
            ${wordCardHTML(w)}
            ${info}
            <div class="btn-row end">
                ${c ? `<button class="btn" data-wact="reset">Học lại từ đầu</button>` : ""}
                ${!c || status(w.id) !== "mastered" ? `<button class="btn btn-primary" data-wact="known">Đánh dấu đã thuộc</button>` : ""}
            </div>`, e => {
            const say = e.target.closest("[data-say]"); if (say) { speak(say.dataset.say); return; }
            const a = e.target.closest("[data-wact]"); if (!a) return;
            if (a.dataset.wact === "known") {
                const wasNew = !S.srs[w.id];
                S.srs[w.id] = Object.assign(S.srs[w.id] || { ef: 2.5, lapses: 0, first: Date.now() }, { iv: 30, reps: 3, last: Date.now(), due: startOfDay() + 30 * DAY });
                if (wasNew) today().n++;
                toast("Đã đánh dấu thuộc — sẽ ôn lại sau 30 ngày");
            } else {
                delete S.srs[w.id];
                toast("Đã đặt lại từ này");
            }
            save(); closeModal(); renderDict(true); refreshHeader();
        });
    }

    // ================================================================ MODAL
    function openModal(html, onClick) {
        $("modal-box").innerHTML = html;
        $("modal").hidden = false;
        $("modal").onclick = e => {
            if (e.target.id === "modal" || e.target.closest("[data-close]")) { closeModal(); return; }
            if (onClick) onClick(e);
        };
    }
    function closeModal() { $("modal").hidden = true; }

    // ================================================================ CÀI ĐẶT
    function renderSettings() {
        $("set-goal").value = String(S.settings.goal);
        $("set-speak").checked = !!S.settings.speak;
        $("set-rate").value = String(S.settings.rate);
        $("set-dir").value = S.settings.dir;
        $("set-free").checked = !!S.settings.free;
    }
    function bindSettings() {
        $("set-goal").onchange = e => { S.settings.goal = +e.target.value; save(); toast("Đã lưu mục tiêu"); };
        $("set-speak").onchange = e => { S.settings.speak = e.target.checked; save(); };
        $("set-rate").onchange = e => { S.settings.rate = +e.target.value; save(); speak("你好，欢迎学习汉语"); };
        $("set-dir").onchange = e => { S.settings.dir = e.target.value; save(); };
        $("set-free").onchange = e => { S.settings.free = e.target.checked; save(); toast(e.target.checked ? "Đã mở khóa tất cả bài" : "Đã bật học theo thứ tự"); };
        $("btn-export").onclick = () => {
            const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "tien-do-hsk-" + dayKey() + ".json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        };
        $("file-import").onchange = e => {
            const f = e.target.files[0]; if (!f) return;
            const rd = new FileReader();
            rd.onload = () => {
                try {
                    const o = JSON.parse(rd.result);
                    if (!o || typeof o.srs !== "object") throw new Error("sai định dạng");
                    if (!confirm("Nhập tiến độ sẽ thay thế toàn bộ tiến độ hiện tại. Tiếp tục?")) return;
                    S = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), o, { settings: Object.assign({}, DEFAULT_STATE.settings, o.settings || {}) });
                    save(); renderSettings(); refreshHeader(); toast("Đã nhập tiến độ");
                } catch (err) { toast("File không hợp lệ"); }
                e.target.value = "";
            };
            rd.readAsText(f);
        };
        $("btn-reset").onclick = () => {
            if (!confirm("Xóa TOÀN BỘ tiến độ học? Không thể hoàn tác.")) return;
            S = JSON.parse(JSON.stringify(DEFAULT_STATE));
            save(); renderSettings(); refreshHeader(); toast("Đã xóa tiến độ");
        };
    }

    // ================================================================ PHÍM TẮT
    document.addEventListener("keydown", e => {
        if (!$("modal").hidden && e.key === "Escape") { closeModal(); return; }
        if (!session || $("session").hidden) return;
        if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
        if (e.key === "Escape") { closeSession(); return; }
        if (session.kind === "speed") {
            if (body().querySelector(".sp-opts")) {
                if (e.key === "ArrowLeft" || e.key === "1") { e.preventDefault(); speedAnswer(0); }
                else if (e.key === "ArrowRight" || e.key === "2") { e.preventDefault(); speedAnswer(1); }
            }
            return;
        }
        if (session.quiz && body().querySelector(".quiz")) {
            const q = session.quiz;
            if (!q.answered && /^[1-4]$/.test(e.key)) { e.preventDefault(); answer(+e.key - 1); }
            else if (q.answered && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); nextQuestion(); }
            return;
        }
        if (session.kind === "unit" && body().querySelector(".wcard") && !session.quiz) {
            if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); learnNav(1); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); learnNav(-1); }
            else if (e.key === " ") { e.preventDefault(); speak(session.words[session.i].clean); }
            return;
        }
        if (session.kind === "review" && body().querySelector(".rcard")) {
            if (!session.revealed && (e.key === " " || e.key === "Enter")) { e.preventDefault(); reveal(); }
            else if (session.revealed && /^[1-4]$/.test(e.key)) { e.preventDefault(); rate(+e.key); }
        }
    });

    // ================================================================ KHỞI ĐỘNG
    function init() {
        if (!WORDS.length) {
            document.querySelector(".container").innerHTML = `<div class="card"><h2>Không tải được dữ liệu</h2><p>Thiếu file hsk_vocab_data.js. Chạy <code>python extract_hsk_vocab.py</code> để tạo lại.</p></div>`;
            return;
        }
        // Chuyển cài đặt theme cũ sang theme chung (chỉ khi người dùng chưa chọn ở trang khác)
        if (S.settings.theme) {
            let has = false; try { has = !!localStorage.getItem("hoc_theme"); } catch (e) {}
            if (!has && window.HocTheme) HocTheme.set(S.settings.theme);
            delete S.settings.theme; save();
        }
        // Link thẳng tới một cấp: hsk_lotrinh.html?level=3
        const qLevel = +new URLSearchParams(location.search).get("level");
        if (qLevel >= 1 && qLevel <= 6) S.lastLevel = qLevel;
        $("tabs").onclick = e => { const b = e.target.closest(".tab"); if (b) showView(b.dataset.view); };
        $("ss-close").onclick = () => closeSession();
        $("btn-start-review").onclick = startReview;
        $("btn-weak").onclick = () => startFreeQuiz(weakWords(), "Ôn từ hay sai", ["hanzi", "meaning", "listen", "cloze"]);
        $("btn-quick").onclick = () => {
            const lv = +$("quick-level").value;
            startFreeQuiz(LEVELS[lv].words.filter(w => S.srs[w.id]), "Trắc nghiệm nhanh HSK " + lv, ["meaning", "hanzi", "cloze", "pinyin", "listen"]);
        };
        $("btn-speed").onclick = () => startSpeed($("speed-src").value, +$("speed-count").value, +$("speed-start").value);
        $("btn-listen").onclick = () => startFreeQuiz(WORDS.filter(w => S.srs[w.id]), "Luyện nghe", ["listen"]);
        let dt;
        $("dict-q").oninput = () => { clearTimeout(dt); dt = setTimeout(() => renderDict(true), 200); };
        $("dict-level").onchange = () => renderDict(true);
        $("dict-status").onchange = () => renderDict(true);
        $("dict-more").onclick = () => renderDict(false);
        $("dict-list").onclick = e => { const r = e.target.closest(".drow"); if (r) openWordModal(BY_ID.get(r.dataset.id)); };
        bindSettings();
        renderPath();
        writeSummary(); // cập nhật số từ đến hạn cho trang chủ mỗi lần mở trang
    }
    init();
})();
