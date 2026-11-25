/* ==========================================================================
   LỘ TRÌNH TỪ VỰNG HSK 1–6
   - Dữ liệu: hsk_vocab_data.js (sinh từ word_list_data/HSK1-HSK6_full.xlsx)
   - Lộ trình: Cấp → Chặng (5 bài + kiểm tra chặng) → Bài (10–20 từ)
   - Mỗi bài: Học chủ động (đoán nghĩa → tự nhớ lại theo lượt 5 từ → chốt bài) hoặc Lật thẻ → Luyện tập; ≥70% để qua → từ vào hàng đợi ôn tập
   - Nhớ lại trong ngày: từ mới được hỏi lại sau 10 phút và buổi tối
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
        settings: { goal: 20, speak: true, rate: 0.8, dir: "mix", free: false,
                    learnMode: "active",  // cách học từ mới: "active" (Học chủ động) | "classic" (Lật thẻ)
                    recall: "type",       // bước tự nhớ lại: "type" (gõ chữ Hán / pinyin) | "self" (tự chấm)
                    sameDay: true,        // nhớ lại từ mới trong ngày (sau 10 phút + buổi tối)
                    qtLearn: ["meaning", "pinyin", "hanzi", "listen", "cloze"],     // loại câu hỏi khi học bài mới (luyện tập bài + kiểm tra chặng)
                    qtReview: ["meaning", "pinyin", "hanzi", "listen", "cloze"] },  // loại câu hỏi ở tab Ôn tập (Ôn từ hay sai, Trắc nghiệm nhanh)
        units: {},     // key -> { done, best, stars, at }
        stages: {},    // key -> { done, best, at }
        unlocked: {},  // level -> true (mở khóa cấp thủ công)
        srs: {},       // wordId -> { ef, iv, reps, due, lapses, first, last }
        days: {},      // yyyy-mm-dd -> { n: từ mới, r: lượt ôn, c: đúng, t: tổng câu, ms/mc: tổng thời gian & số lần nhận diện đúng }
        speed: { best: null, runs: 0 }, // kỷ lục chế độ đọc nhanh
        lastLevel: 1,
        fresh: {},       // wordId -> { at, s, u } từ học hôm nay chờ nhớ lại (xem NHỚ LẠI TRONG NGÀY)
        scan: {},        // wordId -> { v: 0 chưa biết | 1 hơi quen, at } kết quả Quét nhanh (từ chưa có thẻ)
        placement: null, // kết quả kiểm tra xếp lớp gần nhất: { at, range, result }
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
                due: dueIds(true).length,
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
    // Cấp đang tạm ẩn (đặt ở trang Buổi học hôm nay: hom_nay_v1.settings.skipLv): không hỏi/đếm ở đây, lịch SRS giữ nguyên
    function skipLevels() {
        try { return ((JSON.parse(localStorage.getItem("hom_nay_v1") || "null") || {}).settings || {}).skipLv || []; } catch (e) { return []; }
    }
    // all = true: tính cả cấp đang ẩn (dùng cho tóm tắt gửi trang chủ, trang chủ tự trừ phần ẩn)
    function dueIds(all) {
        const now = Date.now(), skip = all ? [] : skipLevels();
        return Object.keys(S.srs).filter(id => BY_ID.has(id) && isDue(S.srs[id], now) && (!skip.length || skip.indexOf(BY_ID.get(id).level) < 0))
            .sort((a, b) => S.srs[a].due - S.srs[b].due);
    }
    // Ghi chú "đang tạm ẩn N từ" kèm nút hiện lại ("" nếu không ẩn gì)
    function skipNote() {
        const skip = skipLevels();
        if (!skip.length) return "";
        const hidden = dueIds(true).length - dueIds().length;
        return ` <small class="muted skip-note">(⏸ tạm ẩn ${fmtNum(hidden)} từ HSK ${skip.join(", ")} · <a href="#" data-unskip>hiện lại</a>)</small>`;
    }
    document.addEventListener("click", e => {
        const a = e.target.closest("[data-unskip]");
        if (!a) return;
        e.preventDefault();
        try {
            const hn = JSON.parse(localStorage.getItem("hom_nay_v1") || "null") || {};
            hn.settings = Object.assign({}, hn.settings, { skipLv: [] });
            localStorage.setItem("hom_nay_v1", JSON.stringify(hn));
        } catch (err) {}
        if ($("view-review").classList.contains("active")) renderReview(); else renderPath();
    });
    // Thêm từ vừa học vào hàng đợi ôn
    function introduce(id, knewIt, noFresh) {
        if (S.srs[id]) return;
        S.srs[id] = { ef: 2.5, iv: knewIt ? 1 : 0, reps: knewIt ? 1 : 0, lapses: 0, first: Date.now(), last: Date.now(),
            due: knewIt ? startOfDay() + DAY : Date.now() + 10 * 60000 };
        delete S.scan[id];
        if (S.settings.sameDay && !noFresh) S.fresh[id] = { at: Date.now(), s: 0 };
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
    // Thẻ từ (học từ mới / mặt sau thẻ ôn): đọc từ rồi đọc câu ví dụ (shared/tts.js, tắt được trong hộp chọn giọng)
    function autoSpeakWord(w) {
        if (!S.settings.speak) return;
        if (window.HocTTS && HocTTS.speakWord) HocTTS.speakWord(w.clean, w.ex, { rate: S.settings.rate });
        else speak(w.clean);
    }

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
        steps.push(`<li class="${due === 0 ? "done" : ""}"><b>Ôn tập</b> ${due === 0 ? "— đã ôn hết từ đến hạn ✓" : `— ${fmtNum(due)} từ đến hạn`}${skipNote()}</li>`);
        steps.push(`<li class="${d.n >= goal ? "done" : ""}"><b>Học từ mới</b> — ${d.n >= goal ? "đã đạt mục tiêu ✓" : `còn ${goal - d.n} từ để đạt mục tiêu`}</li>`);
        const slowN = slowWords().length;
        const speedToday = (d.sp || 0) > 0;
        const fr = freshInfo();
        if (fr.ready.length || fr.waiting) steps.push(`<li class="${fr.ready.length ? "" : "done"}"><b>🌱 Nhớ lại từ mới hôm nay</b> — ${fr.ready.length ? `${fr.ready.length} từ đến lượt` : `lượt tới lúc ${hm(fr.next)} (${fr.waiting} từ)`}</li>`);
        steps.push(`<li class="${speedToday ? "done" : ""}"><b>Tăng tốc đọc</b> — ${speedToday ? "đã luyện đọc nhanh hôm nay ✓" : slowN ? `${slowN} từ nhận diện chậm, luyện 3–5 phút` : "luyện đọc nhanh 3–5 phút"}</li>`);
        $("plan-steps").innerHTML = steps.join("");

        const acts = [];
        if (due > 0) acts.push(`<button class="btn btn-primary btn-lg" data-act="review">🔁 Ôn tập ${fmtNum(due)} từ</button>`);
        if (fr.ready.length) acts.push(`<button class="btn ${due > 0 ? "" : "btn-primary"} btn-lg" data-act="fresh">🌱 Nhớ lại ${fr.ready.length} từ mới</button>`);
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
            if (a.dataset.act === "fresh") startFresh();
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
        renderPlacementCTA();
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
                <button class="reset-btn reset-level" data-reset-level="${lv}" title="Đặt lại tiến độ HSK ${lv}">↺ Đặt lại HSK ${lv}</button>
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
                <div class="stage-head"><span>Chặng ${st.n + 1}</span><small>${done}/${st.units.length} bài${stageDone(st) ? " · đã qua kiểm tra" : ""}</small>
                    ${levelUnlocked(lv) && !stageDone(st) && stageUnseen(st).length >= 5 ? `<button class="reset-btn scan-btn" data-scan-stage="${st.key}" title="Lướt các từ chưa học của chặng, bỏ qua từ đã biết">⚡ Quét nhanh ${stageUnseen(st).length} từ</button>` : ""}
                    ${done || stageDone(st) ? `<button class="reset-btn" data-reset-stage="${st.key}" title="Đặt lại chặng ${st.n + 1}">↺ Đặt lại</button>` : ""}</div>
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
            const sc = e.target.closest("[data-scan-stage]");
            if (sc) { startScan(L.stages.find(x => x.key === sc.dataset.scanStage)); return; }
            const rs = e.target.closest("[data-reset-stage]");
            if (rs) { const st = L.stages.find(x => x.key === rs.dataset.resetStage); confirmReset(`HSK ${lv} · Chặng ${st.n + 1}`, st.units, [st]); return; }
            if (e.target.closest("[data-reset-level]")) { confirmReset(`toàn bộ HSK ${lv}`, L.units, L.stages); return; }
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
            <div class="mode-pick" role="radiogroup" aria-label="Cách học">
                <label><input type="radio" name="learn-mode" value="active" ${S.settings.learnMode !== "classic" ? "checked" : ""}><span><b>🧠 Học chủ động</b><small>Đoán nghĩa, tự nhớ lại, từng lượt 5 từ</small></span></label>
                <label><input type="radio" name="learn-mode" value="classic" ${S.settings.learnMode === "classic" ? "checked" : ""}><span><b>🃏 Lật thẻ</b><small>Xem hết thẻ rồi làm trắc nghiệm</small></span></label>
            </div>
            <div class="btn-row end">
                ${r && (r.done || r.best) ? `<button class="btn btn-ghost-danger" data-go="reset" title="Bỏ đánh dấu hoàn thành bài này">↺ Đặt lại bài</button>` : ""}
                ${r && r.done ? `<button class="btn" data-go="practice">Chỉ luyện tập</button>` : ""}
                <button class="btn btn-primary" data-go="learn">${r && r.done ? "Học lại" : "Bắt đầu học"}</button>
            </div>`, e => {
            const tr = e.target.closest("tr[data-id]");
            if (tr) speak(BY_ID.get(tr.dataset.id).clean);
            const g = e.target.closest("[data-go]");
            if (g && g.dataset.go === "reset") { const st = LEVELS[u.level].stages.find(x => x.units.includes(u)); confirmReset(`HSK ${u.level} · Bài ${u.n + 1}`, [u], st && stageDone(st) ? [st] : []); return; }
            if (g) { closeModal(); g.dataset.go === "learn" ? startUnit(u) : startUnit(u, true); }
        });
    }
    // ================================================================ ĐẶT LẠI TIẾN ĐỘ (bài / chặng / cấp / hoàn tác xếp lớp)
    // Không xóa hẳn bản ghi bài/chặng mà ghi đè bằng bản "đã đặt lại" có mốc thời gian mới, để khi đồng bộ
    // giữa các máy (shared/sync.js gộp theo bản ghi mới hơn) dữ liệu cũ không bị khôi phục lại.
    // mode: "mark" chỉ bỏ đánh dấu xong · "placed" bỏ đánh dấu + xóa thẻ do kiểm tra xếp lớp tạo mà chưa ôn lần nào
    //       "all" bỏ đánh dấu + xóa mọi thẻ ôn của các từ (học lại từ đầu)
    function untouchedPlacedCard(c) { return c && c.placed && (!c.last || !c.first || c.last <= c.first) && !c.lapses; }
    function resetProgress(units, stages, mode) {
        const now = Date.now();
        let nu = 0, ns = 0, nc = 0;
        units.forEach(u => {
            if (S.units[u.key] && (S.units[u.key].done || S.units[u.key].best)) nu++;
            S.units[u.key] = { done: false, best: 0, stars: 0, at: now, reset: true };
            if (mode === "placed" || mode === "all") u.words.forEach(w => {
                const c = S.srs[w.id];
                if (c && (mode === "all" || untouchedPlacedCard(c))) { delete S.srs[w.id]; nc++; }
                if (mode === "all") delete S.scan[w.id];
            });
        });
        stages.forEach(st => {
            if (S.stages[st.key] && S.stages[st.key].done) ns++;
            S.stages[st.key] = { done: false, best: 0, at: now, reset: true };
        });
        save();
        renderPath();
        toast(`Đã đặt lại ${nu} bài${ns ? ", " + ns + " chặng" : ""}${nc ? ", xóa " + nc + " thẻ ôn" : ""}.`);
    }
    function confirmReset(title, units, stages) {
        const placedUnits = units.filter(u => S.units[u.key] && S.units[u.key].placed).length;
        const doneUnits = units.filter(unitDone).length;
        const cards = units.reduce((a, u) => a + u.words.filter(w => S.srs[w.id]).length, 0);
        const placedCards = units.reduce((a, u) => a + u.words.filter(w => untouchedPlacedCard(S.srs[w.id])).length, 0);
        openModal(`<div class="modal-head"><h3>↺ Đặt lại ${esc(title)}</h3><button class="icon-btn" data-close>✕</button></div>
            <p class="muted">${units.length} bài · ${doneUnits} bài đang đánh dấu xong${placedUnits ? ` (${placedUnits} bài do kiểm tra xếp lớp)` : ""} · ${cards} từ đang có thẻ ôn.</p>
            <div class="reset-opts">
                <label class="reset-opt"><input type="radio" name="rs-mode" value="placed" ${placedCards || placedUnits ? "checked" : ""}>
                    <span><b>Bỏ đánh dấu + xóa thẻ do kiểm tra xếp lớp tạo</b><small>Khuyên dùng nếu bài bị đánh dấu nhầm sau kiểm tra xếp lớp. Xóa ${placedCards} thẻ chưa từng ôn; thẻ bạn đã tự học/ôn được giữ.</small></span></label>
                <label class="reset-opt"><input type="radio" name="rs-mode" value="mark" ${placedCards || placedUnits ? "" : "checked"}>
                    <span><b>Chỉ bỏ đánh dấu hoàn thành</b><small>Giữ nguyên lịch ôn tập của các từ, chỉ để học lại bài.</small></span></label>
                <label class="reset-opt"><input type="radio" name="rs-mode" value="all">
                    <span><b>Xóa hết, học lại từ đầu</b><small>Bỏ đánh dấu và xóa toàn bộ ${cards} thẻ ôn của các từ này (không hoàn tác được).</small></span></label>
            </div>
            <div class="btn-row end"><button class="btn" data-close>Hủy</button><button class="btn btn-reset-go" data-go="reset">↺ Đặt lại</button></div>`, e => {
            if (!e.target.closest('[data-go="reset"]')) return;
            const m = (document.querySelector('input[name="rs-mode"]:checked') || {}).value || "mark";
            if (m === "all" && !confirm(`Xóa toàn bộ ${cards} thẻ ôn của ${title}? Không thể hoàn tác.`)) return;
            closeModal();
            resetProgress(units, stages, m);
        });
    }
    // Hoàn tác kiểm tra xếp lớp: bỏ đánh dấu mọi bài/chặng có placed:true chưa học thật, xóa thẻ xếp lớp chưa ôn lần nào
    function undoPlacement() {
        const units = [], stages = [];
        Object.keys(LEVELS).forEach(lv => LEVELS[lv].stages.forEach(st => {
            if (S.stages[st.key] && S.stages[st.key].placed) stages.push(st);
            st.units.forEach(u => { if (S.units[u.key] && S.units[u.key].placed) units.push(u); });
        }));
        const cards = Object.keys(S.srs).filter(id => untouchedPlacedCard(S.srs[id])).length;
        if (!units.length && !stages.length && !cards) { toast("Không còn gì từ kiểm tra xếp lớp để hoàn tác."); return; }
        if (!confirm(`Hoàn tác kiểm tra xếp lớp?\n• Bỏ đánh dấu ${units.length} bài và ${stages.length} chặng được đánh dấu bởi bài kiểm tra\n• Xóa ${cards} thẻ ôn do bài kiểm tra tạo mà bạn chưa ôn lần nào\nCác bài bạn tự học và thẻ đã ôn được giữ nguyên.`)) return;
        const now = Date.now();
        units.forEach(u => { S.units[u.key] = { done: false, best: 0, stars: 0, at: now, reset: true }; });
        stages.forEach(st => { S.stages[st.key] = { done: false, best: 0, at: now, reset: true }; });
        Object.keys(S.srs).forEach(id => { if (untouchedPlacedCard(S.srs[id])) delete S.srs[id]; });
        if (S.placement) S.placement = Object.assign({}, S.placement, { undone: now });
        save();
        renderPath();
        toast(`Đã hoàn tác: ${units.length} bài, ${stages.length} chặng, ${cards} thẻ.`);
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
        setProgress(0, "");
    }
    function closeSession(force) {
        if (session && session.dirty && !force) {
            const pl = session.kind === "placement";
            if (pl || session.vf) clearTimeout(session.timer);
            const msg = pl
                ? (session.stage === "result" ? "Thoát mà không áp dụng kết quả kiểm tra xếp lớp?" : "Thoát bài kiểm tra xếp lớp? Các câu đã làm sẽ không được lưu.")
                : session.vf ? "Thoát khi đang kiểm chứng? Kết quả kiểm chứng của lần này sẽ không được lưu."
                : session.kind === "scan" ? "Thoát quét nhanh? Các từ vừa chọn sẽ không được lưu (bấm “Dừng” để lưu)."
                : session.kind === "active" && session.batches && session.bi > 0
                    ? `Thoát phiên học? ${session.bi} lượt đã xong vẫn được lưu, phần đang làm thì không.`
                    : "Thoát phiên học? Kết quả của phần đang làm sẽ không được lưu.";
            if (!confirm(msg)) {
                // tiếp tục câu đang làm với đồng hồ mới
                if (pl && session.stage === "quiz") renderPlacementQ();
                if (session.vf) { session.vf.i = Math.min(session.vf.i, session.vf.res.size); renderVerify(); }
                return;
            }
        }
        document.body.classList.remove("fb-open");
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        if (session && session.timer) clearTimeout(session.timer);
        session = null;
        $("session").hidden = true;
        document.body.classList.remove("no-scroll");
        const active = document.querySelector(".tab.active");
        showView(active ? active.dataset.view : "path");
    }
    // Thanh tiến độ dạng liền (học thẻ, ôn tập, đọc nhanh); count: chữ hiện bên phải, vd "3/10"
    function setProgress(p, count) {
        const tr = $("ss-track");
        let bar = tr.querySelector(".ss-bar");
        if (!bar) { tr.className = "ss-track"; tr.innerHTML = '<div class="ss-bar"></div>'; bar = tr.querySelector(".ss-bar"); }
        bar.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + "%";
        if (count !== undefined) $("ss-count").textContent = count;
        else if (p >= 1) $("ss-count").textContent = "✓ Xong";
    }
    // Thanh tiến độ dạng từng ô cho trắc nghiệm: mỗi câu một ô, xanh = đúng ngay, đỏ = sai, viền = câu hiện tại
    function setSegments(marks, current, count) {
        const tr = $("ss-track");
        if (marks.length > 60) { setProgress(marks.filter(Boolean).length / marks.length, count); return; }
        tr.className = "ss-track ss-seg";
        tr.innerHTML = marks.map((m, i) => `<i class="${m || ""}${i === current ? " cur" : ""}"></i>`).join("");
        $("ss-count").textContent = count;
    }
    const body = () => $("ss-body");

    // ---------- Học bài: bước 1 - thẻ từ
    function startUnit(u, skipLearn) {
        S.lastLevel = u.level; save();
        if (!skipLearn && S.settings.learnMode !== "classic") { startActive(u); return; }
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
            ${window.HocVisual ? HocVisual.barHTML(w.clean) + HocVisual.readingHTML(w.clean, w.py, w.hv) : ""}
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
        setProgress((s.i + 1) / s.words.length, `Thẻ ${s.i + 1}/${s.words.length}`);
        body().innerHTML = `<div class="step-tag">Bước 1/2 · Học từ mới</div>
            ${wordCardHTML(w, { counter: `<span class="muted">${s.i + 1} / ${s.words.length}</span>` })}
            <div class="btn-row center">
                <button class="btn" data-nav="prev" ${s.i === 0 ? "disabled" : ""}>← Trước</button>
                <button class="btn btn-primary" data-nav="next">${s.i === s.words.length - 1 ? "Bắt đầu luyện tập →" : "Tiếp →"}</button>
            </div>
            ${s.i === s.words.length - 1 ? `<div class="qt-inline"><b>Loại câu hỏi khi luyện tập:</b> <span data-qt="learn">${qtChipsHTML("learn")}</span></div>` : ""}
            <div class="kbd-hint">Phím: ← → để chuyển · Space để nghe</div>`;
        autoSpeakWord(w);
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

    // ================================================================ HỌC CHỦ ĐỘNG (settings.learnMode = "active")
    // Lọc từ đã biết → từng lượt 5 từ: đoán nghĩa rồi mới xem thẻ → tự nhớ lại (gõ chữ Hán / pinyin, hoặc tự chấm),
    // xen vài từ của lượt trước → chốt bài bằng điền từ vào câu. Xong lượt nào lưu từ của lượt đó.
    const BATCH = 5;
    function startActive(u) {
        const left = u.words.filter(w => !S.srs[w.id]);
        const relearn = !left.length;
        session = { kind: "active", unit: u, words: u.words, todo: relearn ? u.words.slice() : left, relearn,
            known: new Set(), introduced: new Set(), weak: new Set(), dirty: false };
        openSession(`HSK ${u.level} · Bài ${u.n + 1}`);
        s_mark();
        renderFilter();
        // nạp xong dữ liệu Boya thì đánh dấu thêm, trừ các từ người học đã tự chạm
        const s = session;
        loadOther().then(() => { if (session === s && $("ac-go")) { s_mark(); renderFilter(); } });
    }
    function s_mark() {
        const s = session, map = otherKnown();
        s.other = new Map(); s.touched = s.touched || new Set();
        s.todo.forEach(w => {
            const o = s.relearn ? null : knownOf(map, w);
            if (o) s.other.set(w.id, o);
            if (o && o.iv >= KNOWN_IV && !S.scan[w.id] && !s.touched.has(w.id)) s.known.add(w.id);
        });
    }
    // Bước 1: lọc nhanh từ đã biết
    function renderFilter() {
        const s = session, prev = s.relearn ? 0 : s.words.length - s.todo.length;
        setProgress(0, "Lọc từ");
        body().innerHTML = `<div class="step-tag">Học chủ động · Lọc nhanh</div>
            <div class="quiz">
                <p class="ac-lead"><b>Từ nào bạn đã biết chắc?</b> Chạm để đánh dấu hoặc bỏ đánh dấu. Các từ đó được kiểm chứng nhanh rồi hẹn ôn xa.</p>
                ${s.todo.some(w => s.other.has(w.id) && s.other.get(w.id).iv >= KNOWN_IV) ? `<p class="muted center">Từ bạn đã nhớ ở trang khác được đánh dấu sẵn.</p>` : ""}
                ${prev ? `<p class="muted center">${prev} từ của bài đã có thẻ ôn, lần này học ${s.todo.length} từ còn lại.</p>` : ""}
                <div class="ac-words">${s.todo.map(w => `<button type="button" class="ac-word ${s.known.has(w.id) ? "on" : ""}" data-known="${esc(w.id)}" aria-pressed="${s.known.has(w.id)}"><span class="hz">${esc(w.hz)}</span>${filterTag(w)}</button>`).join("")}</div>
                <div class="btn-row center"><button class="btn btn-primary btn-lg" data-ac="next" id="ac-go"></button></div>
                <p class="center ac-switch"><a href="#" data-ac="classic">🃏 Chuyển sang cách lật thẻ</a></p>
            </div>`;
        const label = () => { const n = s.todo.length - s.known.size; $("ac-go").textContent = s.known.size ? `Kiểm chứng ${s.known.size} từ${n ? `, rồi học ${n} từ` : ""} →` : `Học ${n} từ →`; };
        label();
        body().onclick = e => {
            const k = e.target.closest("[data-known]");
            if (k) {
                const id = k.dataset.known;
                s.known.has(id) ? s.known.delete(id) : s.known.add(id);
                s.touched.add(id);
                k.classList.toggle("on", s.known.has(id)); k.setAttribute("aria-pressed", String(s.known.has(id)));
                label(); return;
            }
            const a = e.target.closest("[data-ac]"); if (!a) return;
            e.preventDefault();
            if (a.dataset.ac === "classic") { setLearnMode("classic"); toast("Đã chuyển sang lật thẻ (đổi lại trong Cài đặt)"); startUnit(s.unit); return; }
            s.known.size ? verifyKnown() : startBatches();
        };
        function filterTag(w) {
            const o = s.other.get(w.id), sc = S.scan[w.id];
            if (o) return `<small class="ac-src ${o.iv >= KNOWN_IV ? "on" : ""}">${o.iv >= KNOWN_IV ? "đã nhớ" : "đang học"} · ${esc(o.src)}</small>`;
            return sc ? `<small class="ac-src">${sc.v ? "hơi quen" : "chưa biết"}</small>` : "";
        }
    }
    // Kiểm chứng các từ vừa đánh dấu "đã biết"; từ chưa chắc chuyển vào danh sách học
    function verifyKnown() {
        const s = session;
        runVerify({
            words: s.todo.filter(w => s.known.has(w.id)),
            onDone: res => {
                const n = applyVerify(res, true);
                res.forEach((r, id) => { if (r === "unsure" || r === "bad") s.known.delete(id); });
                s.todo = s.todo.filter(w => s.relearn ? !s.known.has(w.id) : !S.srs[w.id]);
                s.vfCount = n.fast + n.slow;
                body().innerHTML = `<div class="step-tag">Kiểm chứng xong</div><div class="quiz"><ul class="vf-list">${verifyLines(n)}</ul>
                    <div class="btn-row center"><button class="btn btn-primary btn-lg" data-ac="next">${s.todo.length ? `Học ${s.todo.length} từ →` : "Hoàn thành bài →"}</button></div></div>`;
                s.shownAt = Date.now();
                body().onclick = e => { if (e.target.closest('[data-ac="next"]')) startBatches(); };
            },
        });
    }
    function startBatches() {
        const s = session, learn = s.todo.filter(w => !s.known.has(w.id));
        learn.sort((a, b) => ((S.scan[a.id] || {}).v || 0) - ((S.scan[b.id] || {}).v || 0));   // từ "chưa biết" học trước, "hơi quen" học sau
        s.dirty = true;
        s.batches = [];
        for (let i = 0; i < learn.length; i += BATCH) s.batches.push(learn.slice(i, i + BATCH));
        // lượt cuối quá ngắn thì gộp vào lượt trước
        if (s.batches.length > 1 && s.batches[s.batches.length - 1].length < 3) { const last = s.batches.pop(); s.batches[s.batches.length - 1] = s.batches[s.batches.length - 1].concat(last); }
        s.total = learn.length * 2; s.did = 0; s.bi = 0; s.gi = 0;
        learn.length ? renderGuess() : startFinal();
    }
    const batchLabel = s => `Lượt ${s.bi + 1}/${s.batches.length}`;
    // Bước 2: đoán nghĩa (chữ + Hán Việt + câu ví dụ) rồi mới xem thẻ; Hán Việt trùng nghĩa (安全 = an toàn) thì ẩn để không lộ đáp án
    function renderGuess() {
        const s = session, b = s.batches[s.bi], w = b[s.gi];
        setProgress(s.did / s.total * 0.75, batchLabel(s));
        s.opts = shuffle([w].concat(pickDistractors(w, 3, LEVELS[w.level].words, "vi")));
        s.guess = w;
        body().innerHTML = `<div class="step-tag">${batchLabel(s)} · Đoán nghĩa ${s.gi + 1}/${b.length}</div>
            <div class="quiz ac-guess">
                <div class="q-type">Đoán nghĩa trước khi xem đáp án</div>
                <div class="q-prompt">
                    <div class="q-hz">${esc(w.hz)}</div>
                    ${w.hv && norm(w.vi).indexOf(norm(w.hv)) < 0 ? `<div class="q-sub">Hán Việt: <b>${esc(w.hv)}</b></div>` : ""}
                    ${w.ex ? `<div class="ac-ex">${highlight(w.ex, w.clean)}</div>` : ""}
                </div>
                <div class="opts">${s.opts.map((o, i) => `<button class="opt" data-g="${i}"><kbd>${i + 1}</kbd><span>${esc(o.vi)}</span></button>`).join("")}</div>
                <div class="btn-row center"><button class="btn" data-g="-1">Không đoán được <kbd class="kbd-only">0</kbd></button></div>
            </div>`;
        body().onclick = e => { const g = e.target.closest("[data-g]"); if (g) revealGuess(+g.dataset.g); };
    }
    function revealGuess(i) {
        const s = session, w = s.guess; if (!w) return;
        const ok = i >= 0 && s.opts[i] === w;
        s.guess = null; s.shownAt = Date.now();
        if (!ok) s.weak.add(w.id);
        s.did++;
        const b = s.batches[s.bi], last = s.gi === b.length - 1;
        setProgress(s.did / s.total * 0.75, batchLabel(s));
        body().innerHTML = `<div class="step-tag">${batchLabel(s)} · Từ ${s.gi + 1}/${b.length}</div>
            <div class="ac-verdict ${ok ? "ok" : "bad"}">${ok ? "✓ Đoán đúng!" : i < 0 ? "Xem thẻ và tìm một cách nhớ nhé" : `✗ Bạn đoán: ${esc(s.opts[i].vi)}`}</div>
            ${wordCardHTML(w)}
            ${hooksHTML(w)}
            <div class="btn-row center"><button class="btn btn-primary btn-lg" data-ac="next">${last ? "Tự nhớ lại →" : "Từ tiếp theo →"}</button></div>`;
        $("session").scrollTop = 0;
        fillParts(w);
        const note = $("ac-note");
        if (note) note.onchange = () => HocNotes.set(w.clean, note.value);
        autoSpeakWord(w);
        body().onclick = e => {
            const say = e.target.closest("[data-say]"); if (say) { speak(say.dataset.say); return; }
            if (!e.target.closest('[data-ac="next"]')) return;
            if (note) HocNotes.get(w.clean) !== note.value.trim() && HocNotes.set(w.clean, note.value);
            if (last) { startRecall(); return; }
            s.gi++; renderGuess();
        };
    }
    // Móc nhớ: bộ phận chữ, từ đã học có cùng chữ, ghi chú gợi nhớ (shared/notes.js)
    function hooksHTML(w) {
        const chars = [...new Set(Array.from(w.clean).filter(c => /[一-鿿]/.test(c)))];
        const learned = Object.keys(S.srs).map(id => BY_ID.get(id)).filter(Boolean);
        const rows = chars.map(ch => {
            const seen = new Set([w.clean]);
            const rel = learned.filter(x => x.clean.indexOf(ch) >= 0 && !seen.has(x.clean) && seen.add(x.clean)).slice(0, 4);
            return rel.length ? `<div class="ac-rel"><b>${esc(ch)}</b> ${rel.map(x => `<button type="button" class="ac-chip" data-say="${esc(x.clean)}" title="${esc(x.py)}"><span class="hz">${esc(x.clean)}</span> ${esc(x.vi)}</button>`).join("")}</div>` : "";
        }).join("");
        const note = window.HocNotes ? HocNotes.get(w.clean) : "";
        return `<div class="ac-hooks">
            <div class="ac-parts" id="ac-parts" hidden></div>
            ${rows ? `<div class="ac-h"><h4>🔗 Từ đã học có cùng chữ</h4>${rows}</div>` : ""}
            ${window.HocNotes ? `<div class="ac-h"><h4>📝 Cách nhớ của bạn</h4><textarea id="ac-note" rows="2" maxlength="500" placeholder="Một hình ảnh, câu chuyện, hay từ tiếng Việt nghe giống… (không bắt buộc)">${esc(note)}</textarea></div>` : ""}
        </div>`;
    }
    function fillParts(w) {
        if (!window.HocVisual || !HocVisual.loadParts) return;
        const el = $("ac-parts");
        HocVisual.loadParts().then(() => {
            const h = el && el.isConnected ? HocVisual.partsHTML(w.clean) : "";
            if (h) { el.innerHTML = `<h4>🧩 Bộ phận chữ</h4>${h}`; el.hidden = false; }
        }).catch(() => {});
    }
    // Bước 3: tự nhớ lại các từ của lượt, xen tối đa 2 từ của lượt trước (ưu tiên từ từng sai)
    function startRecall() {
        const s = session, b = s.batches[s.bi];
        const old = [].concat(...s.batches.slice(0, s.bi));
        const mix = shuffle(old).sort((x, y) => (s.weak.has(y.id) ? 1 : 0) - (s.weak.has(x.id) ? 1 : 0)).slice(0, 2);
        const q = shuffle(b);
        mix.forEach((w, i) => q.splice(Math.min(q.length, 2 + i * 2), 0, w));
        runRecall({
            words: q,
            tag: `${batchLabel(s)} · Tự nhớ lại`,
            progress: n => setProgress((s.did + Math.min(n, b.length)) / s.total * 0.75, batchLabel(s)),
            onDone: res => {
                b.forEach(w => {
                    if (!S.srs[w.id]) { introduce(w.id, res.get(w.id)); s.introduced.add(w.id); }
                    else if (!res.get(w.id)) softFail(w.id);
                });
                mix.forEach(w => { if (!res.get(w.id)) softFail(w.id); });
                q.forEach(w => { res.get(w.id) ? s.weak.delete(w.id) : s.weak.add(w.id); });
                save();
                s.did += b.length; s.bi++; s.gi = 0;
                toast(`✓ Xong lượt ${s.bi}/${s.batches.length}, đã lưu ${b.length} từ`);
                s.bi < s.batches.length ? renderGuess() : startFinal();
            },
        });
    }
    // Chưa nhớ từ vừa học: hẹn ôn sau 10 phút. Từ học hôm nay không tính là một lần "quên"; từ cũ thì theo schedule()
    function softFail(id) {
        const c = S.srs[id]; if (!c) return;
        if (dayKey(c.first) !== dayKey()) { S.srs[id] = schedule(c, 1); return; }
        c.iv = 0; c.reps = 0; c.last = Date.now(); c.due = Date.now() + 10 * 60000;
    }
    // ---------- Bộ hỏi "tự nhớ lại" (dùng chung cho Học chủ động và Nhớ lại trong ngày)
    // cfg: { words, tag, progress(n), onDone(Map id -> đúng ngay lần đầu) }
    function runRecall(cfg) {
        const listen = "speechSynthesis" in window && qTypes("learn").indexOf("listen") >= 0;
        session.rc = { cfg, res: new Map(), n: 0, queue: cfg.words.map((w, i) => ({ w, ask: listen && i % 3 === 2 ? "listen" : "vi", retry: false })) };
        renderRecall();
    }
    function renderRecall() {
        const s = session, r = s.rc;
        if (!r.queue.length) { s.rc = null; r.cfg.onDone(r.res); return; }
        const it = r.queue[0], w = it.w, typing = S.settings.recall !== "self";
        r.cfg.progress(r.n);
        r.open = true; r.hint = 0;
        body().innerHTML = `<div class="step-tag">${r.cfg.tag}${it.retry ? " · <em>hỏi lại</em>" : ""} · còn ${r.queue.length}</div>
            <div class="quiz ac-recall">
                <div class="q-type">${it.ask === "listen" ? "Nghe rồi nhớ ra từ" : "Từ tiếng Trung là gì?"}</div>
                <div class="q-prompt">${it.ask === "listen" ? `<button class="listen-btn" type="button" data-say="${esc(w.clean)}">🔊</button><div class="q-sub">Bấm để nghe lại</div>` : `<div class="q-vi">${esc(w.vi)}</div>`}<div class="q-sub" id="rc-hint"></div></div>
                ${typing
                    ? `<form class="rc-form" id="rc-form"><input class="input" id="rc-in" lang="zh-CN" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Chữ Hán hoặc pinyin" aria-label="Gõ chữ Hán hoặc pinyin không dấu"><button class="btn btn-primary">Kiểm tra</button></form>`
                    : `<div class="btn-row center"><button class="btn btn-primary btn-lg" type="button" data-rc="show">Xem đáp án</button></div>`}
                <div class="btn-row center"><button class="btn" type="button" data-rc="hint">💡 Gợi ý</button><button class="btn" type="button" data-rc="dk">Không nhớ</button></div>
                <div id="rc-fb"></div>
            </div>`;
        if (it.ask === "listen") setTimeout(() => { if (session === s && s.rc === r && r.queue[0] === it && r.open) speak(w.clean); }, 200);
        const inp = $("rc-in");
        if (inp) {
            inp.focus({ preventScroll: true });
            // Enter đang chọn chữ trong bộ gõ thì không nộp bài
            inp.addEventListener("keydown", e => { if (e.key === "Enter" && (e.isComposing || e.keyCode === 229)) e.preventDefault(); });
            $("rc-form").onsubmit = e => {
                e.preventDefault();
                const v = inp.value.trim();
                if (r.open && v) answerRecall(recallMatch(w, v), v);
            };
        }
        body().onclick = e => {
            const say = e.target.closest("[data-say]"); if (say) { speak(say.dataset.say); return; }
            if (e.target.closest('[data-ac="next"]')) { recallNext(); return; }
            const b = e.target.closest("[data-rc]"); if (!b) return;
            const a = b.dataset.rc;
            if (a === "right") { acceptRecall(b); return; }
            if (!r.open) return;
            if (a === "hint") recallHint(w);
            if (a === "dk") answerRecall(false, "");
            if (a === "show") selfRecall(w);
            if (a === "self1") answerRecall(true, "");
            if (a === "self0") answerRecall(false, "");
        };
    }
    // Đúng khi gõ đúng chữ Hán (một trong các dạng "儿子/女儿") hoặc đúng pinyin, bỏ qua dấu thanh và khoảng trắng
    function recallMatch(w, v) {
        const han = t => String(t).replace(/[^㐀-鿿]/g, "");
        const py = t => norm(t).replace(/v/g, "u").replace(/[^a-z]/g, "");
        if (han(v)) return w.clean.split(/[\/／|、，,]/).map(han).filter(Boolean).indexOf(han(v)) >= 0;
        return !!py(v) && w.py.split(/[\/／;,，]/).map(py).indexOf(py(v)) >= 0;
    }
    function recallHint(w) {
        const n = ++session.rc.hint, py = norm(w.py).replace(/[^a-z ]/g, " ").trim();
        $("rc-hint").textContent = n === 1
            ? `${Array.from(w.clean).length} chữ · pinyin bắt đầu bằng “${py.charAt(0)}”`
            : (w.hv ? `Hán Việt: ${w.hv} · ` : "") + py.split(/\s+/).map(x => x.slice(0, 2) + "…").join(" ");
        const i = $("rc-in"); if (i) i.focus({ preventScroll: true });
    }
    function recallWordHTML(w) {
        return `<div class="fb-word"><span class="fb-hz">${esc(w.hz)}</span> <span class="py">${esc(w.py)}</span> — ${esc(w.vi)} <button class="say-btn sm" type="button" data-say="${esc(w.clean)}">🔊</button></div>
            ${w.ex ? `<div class="fb-ex">${highlight(w.ex, w.clean)}<br><small>${esc(w.exvi)}</small></div>` : ""}`;
    }
    function clearRecallInputs() {
        body().querySelectorAll(".ac-recall > .btn-row").forEach(x => x.remove());
        const f = $("rc-form"); if (f) f.remove();
    }
    function selfRecall(w) {
        session.shownAt = Date.now();
        clearRecallInputs();
        $("rc-fb").innerHTML = `<div class="fb">${recallWordHTML(w)}<div class="ac-two"><button class="btn" type="button" data-rc="self0">✗ Chưa nhớ <kbd class="kbd-only">1</kbd></button><button class="btn btn-primary" type="button" data-rc="self1">✓ Nhớ đúng <kbd class="kbd-only">2</kbd></button></div></div>`;
        if (S.settings.speak) speak(w.clean);
    }
    function answerRecall(ok, typed) {
        const s = session, r = s.rc, it = r.queue[0], w = it.w;
        if (!r.open) return;
        const viaSelf = !!body().querySelector('[data-rc="self1"]');
        r.open = false; s.shownAt = Date.now();
        if (!it.retry) { logAnswer(ok); r.res.set(w.id, ok && !r.hint); }   // dùng gợi ý thì không tính là tự nhớ
        r.last = { ok };
        if (viaSelf) { s.shownAt = 0; recallNext(); return; }              // tự chấm: đáp án đã xem rồi, sang từ tiếp
        clearRecallInputs();
        $("rc-fb").innerHTML = `<div class="fb ${ok ? "fb-ok" : "fb-bad"}">
            <div class="fb-title">${ok ? (r.hint ? "Đúng (có gợi ý)" : "Nhớ đúng! 🎉") : "Chưa nhớ, sẽ hỏi lại ngay"}</div>
            ${!ok && typed ? `<div class="muted">Bạn gõ: ${esc(typed)}</div>` : ""}
            ${recallWordHTML(w)}
            ${!ok && typed ? `<button class="btn" type="button" data-rc="right">Từ tôi gõ cũng đúng nghĩa</button>` : ""}
            <button class="btn btn-primary" type="button" data-ac="next">Tiếp tục <span class="kbd-only">(Enter)</span></button></div>`;
        if (S.settings.speak) speak(w.clean);
    }
    function acceptRecall(btn) {
        const r = session.rc, it = r.queue[0];
        r.last.ok = true;
        if (!it.retry) { r.res.set(it.w.id, !r.hint); today().c++; }
        const fb = $("rc-fb").querySelector(".fb");
        fb.className = "fb fb-ok"; fb.querySelector(".fb-title").textContent = "Đã tính là đúng";
        btn.remove();
    }
    function recallNext() {
        const s = session, r = s && s.rc;
        if (!r || r.open || Date.now() - (s.shownAt || 0) < 300) return;
        const it = r.queue.shift();
        if (!it.retry) r.n++;
        if (!r.last.ok) r.queue.splice(Math.min(r.queue.length, 2), 0, { w: it.w, ask: "vi", retry: true });
        renderRecall();
    }
    // Bước 4: chốt cả bài bằng điền từ vào câu
    function startFinal() {
        const s = session, pool = LEVELS[s.unit.level].words;
        const types = pickTypes("learn", ["cloze", "cloze", "hanzi"]);
        s.dirty = true; s.rc = null; s.guess = null;
        // chốt những từ còn đang học; từ đã biết chắc (iv ≥ 7) không hỏi lại. Cả bài đều biết thì xong luôn
        const need = s.relearn || s.retryAll ? s.words : s.words.filter(w => !S.srs[w.id] || S.srs[w.id].iv < KNOWN_IV);
        if (!need.length) { finishUnit({ score: 100, correct: s.words.length, total: s.words.length, wrong: [] }, true); return; }
        runQuiz({
            title: "Chốt bài",
            questions: shuffle(need).map(w => makeQuestion(w, types[Math.floor(Math.random() * types.length)], pool)),
            retryWrong: true,
            onDone: res => finishUnit(res),
        });
    }
    // Tùy chọn cuối bài: nhìn nghĩa, tự nhớ lại toàn bộ từ của bài rồi tự chấm
    function renderRecallAll(u) {
        const marks = new Map(), words = shuffle(u.words);
        session = { kind: "active", unit: u, words, dirty: false };
        openSession(`HSK ${u.level} · Bài ${u.n + 1}`);
        body().innerHTML = `<div class="step-tag">Thử nhớ lại cả bài</div>
            <div class="quiz"><p class="ac-lead">Nhìn nghĩa, tự nói to từ tiếng Trung, rồi chạm để xem và tự chấm.</p>
            <div class="ra-list">${words.map((w, i) => `<div class="ra-item" data-ra="${i}"><button type="button" class="ra-q">${esc(w.vi)}</button>
                <div class="ra-a" hidden><span class="hz">${esc(w.hz)}</span> <span class="py">${esc(w.py)}</span> <span class="ra-btns"><button type="button" class="btn" data-m="0" title="Chưa nhớ">✗</button><button type="button" class="btn" data-m="1" title="Nhớ đúng">✓</button></span></div></div>`).join("")}</div>
            <div class="btn-row center"><button class="btn btn-primary" id="ra-done"></button></div></div>`;
        const draw = () => { setProgress(marks.size / words.length, `${marks.size}/${words.length}`); $("ra-done").textContent = marks.size < words.length ? `Kết thúc (${marks.size}/${words.length})` : "Xong ✓"; };
        draw();
        body().onclick = e => {
            if (e.target.closest("#ra-done")) {
                marks.forEach((ok, id) => { if (!ok) softFail(id); });
                save();
                const bad = [...marks.values()].filter(x => !x).length;
                closeSession(true);
                if (marks.size) toast(`Nhớ ${marks.size - bad}/${marks.size} từ${bad ? ` · ${bad} từ sẽ được ôn lại sau 10 phút` : " 🎉"}`);
                return;
            }
            const row = e.target.closest("[data-ra]"); if (!row) return;
            const w = words[+row.dataset.ra], m = e.target.closest("[data-m]");
            if (m) { const ok = m.dataset.m === "1"; marks.set(w.id, ok); row.classList.toggle("ok", ok); row.classList.toggle("bad", !ok); draw(); return; }
            if (e.target.closest(".ra-q")) { row.querySelector(".ra-a").hidden = false; speak(w.clean); }
        };
    }
    function setLearnMode(m) { S.settings.learnMode = m === "classic" ? "classic" : "active"; save(); }

    // ================================================================ TỪ ĐÃ BIẾT: nhận ra từ nguồn khác · kiểm chứng · quét nhanh
    const VF_LIMIT = 8000, VF_FAST = 4000;   // kiểm chứng: 8 giây/câu, đúng trong 4 giây là "nhớ chắc" (giống kiểm tra xếp lớp)
    const KNOWN_IV = 7;                      // thẻ ở nguồn khác có iv ≥ 7 ngày thì đánh dấu sẵn là đã biết
    // Dữ liệu id thẻ Boya -> chữ Hán (luyen_tap/lt_data.js, ~1,6MB): chỉ nạp khi có thẻ Boya
    let ltPromise = null;
    function readKey(k) { try { return JSON.parse(localStorage.getItem(k) || "null") || {}; } catch (e) { return {}; } }
    function loadOther() {
        const need = Object.keys((readKey("boya_learning_progress_v2").srs) || {}).length || Object.keys(readKey("boya_tv_srs")).length;
        if (!need || window.LT_DATA) return Promise.resolve();
        return ltPromise || (ltPromise = new Promise(res => {
            const sc = document.createElement("script");
            sc.src = "../luyen_tap/lt_data.js";
            sc.onload = res;
            sc.onerror = () => { ltPromise = null; res(); };     // thiếu file thì chỉ bỏ qua nguồn Boya
            document.head.appendChild(sc);
        }));
    }
    // Map chữ Hán -> { iv, src } lấy khoảng ôn dài nhất ở các nguồn khác (chỉ đọc)
    function otherKnown() {
        const out = new Map();
        const add = (hz, iv, src) => {
            hz = cleanHanzi(String(hz || ""));
            if (!hz || !(iv >= 1)) return;
            const o = out.get(hz);
            if (!o || iv > o.iv) out.set(hz, { iv, src });
        };
        const lt = (window.LT_DATA && window.LT_DATA.words) || {};
        const boya = (srs, src) => Object.keys(srs || {}).forEach(id => { if (lt[id] && srs[id]) add(lt[id][0], srs[id].iv, src); });
        boya(readKey("boya_learning_progress_v2").srs, "Boya");
        boya(readKey("boya_tv_srs"), "Boya");
        const wl = readKey("hsk_wl_srs_v3");
        Object.keys(wl).forEach(id => { if (wl[id]) add(wl[id].hz, wl[id].iv, "HSK 3.0"); });
        const my = readKey("hoc_mywords_v1").words || {};
        Object.keys(my).forEach(k => { const e = my[k]; if (e && e.card) add(e.hz || k, e.card.iv, "Từ của tôi"); });
        Object.keys(S.srs).forEach(id => { const w = BY_ID.get(id); if (w) add(w.clean, S.srs[id].iv, "HSK " + w.level); });
        return out;
    }
    function knownOf(map, w) {
        const f = [w.clean].concat(w.clean.split(/[\/／|、，,]/));
        for (const x of f) if (map.has(x)) return map.get(x);
        return null;
    }
    // Thêm thẻ cho từ đã biết sau khi kiểm chứng. speed: "fast" hẹn 14–30 ngày, "slow" hẹn 3–7 ngày (rải ngẫu nhiên để không dồn một ngày)
    function addKnown(id, speed) {
        if (S.srs[id]) return;
        const iv = speed === "fast" ? 14 + Math.floor(Math.random() * 17) : 3 + Math.floor(Math.random() * 5);
        S.srs[id] = { ef: 2.5, iv, reps: speed === "fast" ? 3 : 2, lapses: 0, first: Date.now(), last: Date.now(), due: startOfDay() + iv * DAY, kn: 1 };
        delete S.scan[id];
    }
    // ---------- Kiểm chứng: thấy chữ (không pinyin), chọn nghĩa trong 8 giây. onDone(Map id -> "fast" | "slow" | "unsure" | "bad")
    function runVerify(cfg) {
        session.vf = { cfg, i: 0, res: new Map(), words: shuffle(cfg.words) };
        session.dirty = true;
        renderVerify();
    }
    function renderVerify() {
        const s = session, v = s.vf;
        clearTimeout(s.timer);
        if (v.i >= v.words.length) { s.vf = null; v.cfg.onDone(v.res); return; }
        const w = v.words[v.i];
        v.opts = shuffle([w].concat(pickDistractors(w, 3, LEVELS[w.level].words, "vi")));
        v.open = true;
        setProgress(v.i / v.words.length, `${v.i + 1}/${v.words.length}`);
        body().innerHTML = `<div class="pl-q">
            <div class="step-tag">Kiểm chứng từ đã biết</div>
            <div class="sp-timer"><i style="animation-duration:${VF_LIMIT}ms"></i></div>
            <div class="pl-hz">${esc(w.hz)}</div>
            <div class="pl-py" id="vf-py">Nghĩa của từ này là gì?</div>
            <div class="opts pl-opts">${v.opts.map((o, k) => `<button class="opt" data-v="${k}"><kbd>${k + 1}</kbd><span>${esc(o.vi)}</span></button>`).join("")}</div>
            <button class="btn pl-dk" data-v="-2">🤔 Không chắc <kbd class="kbd-only">0</kbd></button>
        </div>`;
        body().onclick = e => { const b = e.target.closest("[data-v]"); if (b) answerVerify(+b.dataset.v); };
        v.t0 = performance.now();
        s.timer = setTimeout(() => answerVerify(-1), VF_LIMIT);
    }
    function answerVerify(k) {
        const s = session, v = s && s.vf; if (!v || !v.open) return;
        v.open = false;
        clearTimeout(s.timer);
        const w = v.words[v.i], ms = performance.now() - v.t0, ok = k >= 0 && v.opts[k] === w;
        const r = ok ? (ms <= VF_FAST ? "fast" : "slow") : k === -2 ? "unsure" : "bad";
        v.res.set(w.id, r);
        if (k !== -2) logAnswer(ok);
        body().querySelectorAll(".opt").forEach((b, i) => { b.disabled = true; if (v.opts[i] === w) b.classList.add("correct"); else if (i === k) b.classList.add("wrong"); });
        const t = body().querySelector(".sp-timer"); if (t) t.style.visibility = "hidden";
        const p = $("vf-py"); if (p) p.textContent = w.py + (ok && r === "slow" ? " · đúng nhưng hơi lâu" : k === -1 ? " · hết giờ" : "");
        if (!ok && S.settings.speak) speak(w.clean);
        v.i++;
        s.timer = setTimeout(() => { if (session === s && s.vf === v) renderVerify(); }, ok ? 450 : 1500);
    }
    // Ghi kết quả kiểm chứng vào lịch ôn; trả về số từ từng loại. count: có tính vào "từ mới hôm nay" không
    function applyVerify(res, count) {
        const n = { fast: 0, slow: 0, unsure: 0, bad: 0 };
        res.forEach((r, id) => {
            n[r]++;
            if (r === "fast" || r === "slow") { if (!S.srs[id]) { addKnown(id, r); if (count) today().n++; } }
            else if (S.srs[id]) softFail(id);                // học lại bài cũ mà không chắc: ôn sau 10 phút
            else S.scan[id] = { v: r === "unsure" ? 1 : 0, at: Date.now() };
        });
        save();
        return n;
    }
    function verifyLines(n) {
        return [n.fast ? `<li class="ok">✓ <b>${n.fast}</b> từ nhớ chắc, hẹn ôn sau 14–30 ngày</li>` : "",
            n.slow ? `<li>⏱ <b>${n.slow}</b> từ nhớ nhưng hơi lâu, hẹn ôn sau 3–7 ngày</li>` : "",
            n.unsure + n.bad ? `<li class="bad">↩ <b>${n.unsure + n.bad}</b> từ chưa chắc, chuyển sang học mới</li>` : ""].join("");
    }
    // ---------- Quét nhanh một chặng: biết / hơi quen / chưa biết → kiểm chứng các từ "biết"
    function stageUnseen(st) { return [].concat(...st.units.map(u => u.words)).filter(w => !S.srs[w.id]); }
    function startScan(st) {
        const all = stageUnseen(st);
        if (!all.length) { toast("Chặng này không còn từ nào chưa có thẻ ôn"); return; }
        const left = all.filter(w => !S.scan[w.id]);
        session = { kind: "scan", stage: st, words: left.length ? left : all, again: !left.length, i: 0, picks: [], dirty: false, other: otherKnown() };
        openSession(`⚡ Quét nhanh · HSK ${st.level} chặng ${st.n + 1}`);
        renderScan();
        loadOther().then(() => { const s = session; if (s && s.kind === "scan" && !s.vf && !s.over) { s.other = otherKnown(); if (s.i < s.words.length) renderScan(); } });
    }
    function renderScan() {
        const s = session;
        if (s.i >= s.words.length) { scanVerify(); return; }
        const w = s.words[s.i], o = knownOf(s.other, w);
        const known = s.picks.filter(p => p === 2).length;
        setProgress(s.i / s.words.length, `${s.i + 1}/${s.words.length}`);
        body().innerHTML = `<div class="pl-q">
            <div class="step-tag">Bạn biết từ này không?</div>
            <div class="pl-hz">${esc(w.hz)}</div>
            <div class="pl-py">${o ? `<span class="ac-src ${o.iv >= KNOWN_IV ? "on" : ""}">${o.iv >= KNOWN_IV ? "đã nhớ ở" : "đang học ở"} ${esc(o.src)}</span>` : s.scanNote || "&nbsp;"}</div>
            <div class="scan-row">
                <button class="rate r1" data-sc="0"><kbd>1</kbd><b>Chưa biết</b></button>
                <button class="rate r2" data-sc="1"><kbd>2</kbd><b>Hơi quen</b></button>
                <button class="rate r3" data-sc="2"><kbd>3</kbd><b>Biết</b></button>
            </div>
            <div class="pl-foot">
                ${s.i ? `<button class="pl-link" data-sc="back">← Từ trước</button>` : ""}
                <button class="pl-link" data-sc="stop">${known ? `Dừng và kiểm chứng ${known} từ` : "Dừng ở đây"}</button>
            </div>
        </div>`;
        body().onclick = e => { const b = e.target.closest("[data-sc]"); if (b) scanPick(b.dataset.sc); };
    }
    function scanPick(x) {
        const s = session;
        if (s.vf || s.over) return;
        if (x === "stop") { scanVerify(); return; }
        if (x === "back") { if (s.i) { s.i--; s.picks.length = s.i; renderScan(); } return; }
        s.picks[s.i] = +x;
        s.i++; s.dirty = true;
        renderScan();
    }
    function scanVerify() {
        const s = session;
        s.over = true;
        // lưu ngay các từ "chưa biết / hơi quen" để lần quét sau không hỏi lại
        s.picks.forEach((p, i) => { if (p < 2) S.scan[s.words[i].id] = { v: p, at: Date.now() }; });
        if (s.picks.length) save();
        const ks = s.words.filter((w, i) => s.picks[i] === 2);
        if (!ks.length) { scanResult({ fast: 0, slow: 0, unsure: 0, bad: 0 }); return; }
        body().innerHTML = `<div class="step-tag">Quét nhanh</div><div class="quiz center">
            <h2>Bạn biết ${ks.length}/${s.picks.length} từ</h2>
            <p class="muted">Giờ kiểm chứng nhanh: nhìn chữ, chọn nghĩa trong 8 giây. Từ nào đúng sẽ được hẹn ôn xa, từ nào sai chuyển sang học mới.</p>
            <div class="btn-row center"><button class="btn btn-primary btn-lg" data-ac="next">Kiểm chứng ${ks.length} từ →</button></div></div>`;
        body().onclick = e => { if (e.target.closest('[data-ac="next"]')) runVerify({ words: ks, onDone: res => scanResult(applyVerify(res, false)) }); };
    }
    function scanResult(n) {
        const s = session, st = s.stage;
        s.dirty = false; s.picks = s.picks || [];
        // bài mà mọi từ đều đã biết chắc thì coi như xong, không phải học lại
        let units = 0;
        st.units.forEach(u => {
            if (unitDone(u) || !u.words.every(w => S.srs[w.id] && (S.srs[w.id].kn || S.srs[w.id].iv >= KNOWN_IV))) return;
            const p = S.units[u.key] || {};
            S.units[u.key] = { done: true, best: Math.max(p.best || 0, PASS_UNIT * 100), stars: p.stars || 0, at: Date.now(), known: true };
            units++;
        });
        save();
        setProgress(1);
        const hint = s.picks.filter(p => p === 1).length, none = s.picks.filter(p => p === 0).length;
        const rest = stageUnseen(st).length, unscanned = stageUnseen(st).filter(w => !S.scan[w.id]).length;
        const open = st.units.find(u => !unitDone(u) && unitAvailable(u));
        body().innerHTML = `<div class="result pass"><h2>Quét xong ${s.picks.length} từ</h2>
            <ul class="vf-list">${verifyLines(n)}
                ${hint + none ? `<li>📚 <b>${hint + none}</b> từ để học (${hint} hơi quen, ${none} chưa biết)</li>` : ""}
                ${units ? `<li class="ok">🏁 <b>${units}</b> bài đã biết hết, được đánh dấu xong</li>` : ""}</ul>
            <p class="muted">Chặng ${st.n + 1} còn <b>${rest}</b> từ cần học${unscanned ? `, trong đó ${unscanned} từ chưa quét` : ""}.</p>
            <div class="btn-row center">
                ${unscanned ? `<button class="btn" data-res="scan">⚡ Quét tiếp</button>` : ""}
                ${!rest && stageUnitsDone(st) && !stageDone(st) ? `<button class="btn btn-primary" data-res="test">🏁 Kiểm tra chặng ${st.n + 1} →</button>` : ""}
                ${open && rest ? `<button class="btn btn-primary" data-res="learn">Học bài ${open.n + 1} →</button>` : ""}
                <button class="btn" data-res="home">Về lộ trình</button></div></div>`;
        body().onclick = e => {
            const b = e.target.closest("[data-res]"); if (!b) return;
            const r = b.dataset.res;
            closeSession(true);
            if (r === "test") startStage(st);
            if (r === "scan") startScan(st);
            if (r === "learn") startUnit(open);
        };
    }

    // ================================================================ NHỚ LẠI TRONG NGÀY (settings.sameDay)
    // S.fresh[id] = { at: lúc học, s: số lượt đã nhớ lại }: lượt 1 sau 10 phút, lượt 2 buổi tối (từ 19h, cách lúc học ≥ 2 giờ).
    // Chỉ là luyện thêm: nhớ đúng không đổi lịch SRS, chưa nhớ thì hẹn ôn sau 10 phút. Qua ngày hôm sau thì bỏ.
    // hom_nay.js có bản chép freshInfo() để hiện dải nhắc; sửa ở đây thì sửa cả bên đó.
    function freshStep(f, c) { return f.s === 0 && c.last > f.at + 5 * 60000 ? 1 : f.s; }   // đã ôn thẻ này ở chỗ khác thì coi như xong lượt 1
    function freshEvening(f) { return Math.max(startOfDay() + 19 * 3600000, f.at + 2 * 3600000); }
    function freshAt(id) {
        const f = S.fresh[id], c = S.srs[id];
        if (!f || !c || !BY_ID.has(id) || dayKey(f.at) !== dayKey()) return 0;
        const st = freshStep(f, c);
        if (st === 0) return f.at + 10 * 60000;
        if (st === 1) { const t = freshEvening(f); return t < startOfDay() + DAY ? t : 0; }
        return 0;
    }
    function freshInfo() {
        const now = Date.now(), out = { ready: [], next: 0, waiting: 0 };
        if (!S.settings.sameDay) return out;
        Object.keys(S.fresh).forEach(id => {
            const t = freshAt(id); if (!t) return;
            if (t <= now) { if (!isDue(S.srs[id], now)) out.ready.push(id); }   // đã đến hạn SRS thì để phần Ôn tập hỏi
            else { out.waiting++; if (!out.next || t < out.next) out.next = t; }
        });
        return out;
    }
    function hm(t) { const d = new Date(t); return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0"); }
    function startFresh() {
        const ids = freshInfo().ready;
        if (!ids.length) { toast("Chưa có từ nào đến lượt nhớ lại"); return; }
        const words = shuffle(ids.map(id => BY_ID.get(id))).slice(0, 30);
        session = { kind: "fresh", dirty: true };
        openSession(`🌱 Nhớ lại từ mới · ${words.length} từ`);
        runRecall({
            words, tag: "Nhớ lại từ học hôm nay",
            progress: n => setProgress(n / words.length, `${Math.min(n + 1, words.length)}/${words.length}`),
            onDone: res => {
                const now = Date.now();
                const wrong = words.filter(w => !res.get(w.id)), ok = words.length - wrong.length;
                words.forEach(w => {
                    const f = S.fresh[w.id], c = S.srs[w.id];
                    if (f && c) S.fresh[w.id] = { at: f.at, s: freshStep(f, c) === 0 && now < freshEvening(f) ? 1 : 2, u: now };
                });
                wrong.forEach(w => softFail(w.id));
                save();
                session.dirty = false;
                setProgress(1);
                renderResult({
                    passed: true, res: { score: Math.round(ok / words.length * 100), correct: ok, total: words.length, wrong },
                    title: "Xong lượt nhớ lại!",
                    note: wrong.length ? "Từ chưa nhớ sẽ vào phần Ôn tập sau 10 phút." : "Bạn nhớ được hết các từ vừa học.",
                    actions: [{ id: "home", label: "Về lộ trình", primary: true }],
                    onAction: () => closeSession(true),
                });
            },
        });
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
    // Loại câu hỏi người học cho phép (Cài đặt hoặc chip ngay trên trang); không bao giờ rỗng
    const QT_ORDER = ["meaning", "pinyin", "hanzi", "listen", "cloze"];
    const QT_SHORT = { meaning: "Chọn nghĩa", pinyin: "Chọn pinyin", hanzi: "Nghĩa → chữ Hán", listen: "Nghe chọn từ", cloze: "Điền từ vào câu" };
    function qTypes(kind) {
        const a = (S.settings[kind === "review" ? "qtReview" : "qtLearn"] || []).filter(t => QT_ORDER.indexOf(t) >= 0);
        return a.length ? a : QT_ORDER.slice();
    }
    // chọn các loại trong "prefer" mà người học cho phép; không còn loại nào thì dùng mọi loại được phép
    function pickTypes(kind, prefer) {
        const ok = qTypes(kind), m = prefer.filter(t => ok.indexOf(t) >= 0);
        return m.length ? m : ok;
    }
    function qtChipsHTML(kind) {
        const ok = qTypes(kind);
        return `<span class="qt-chips" data-qt-box="${kind}">${QT_ORDER.map(t =>
            `<label class="qt-chip"><input type="checkbox" data-qt-kind="${kind}" value="${t}" ${ok.indexOf(t) >= 0 ? "checked" : ""}> ${QT_SHORT[t]}</label>`).join("")}</span>`;
    }
    function renderQtBoxes() {
        document.querySelectorAll("[data-qt]").forEach(el => { el.innerHTML = qtChipsHTML(el.dataset.qt); });
    }
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
        // vòng 1 ưu tiên câu dễ (nghĩa / pinyin), vòng 2 câu khó (chữ Hán / nghe / điền từ) — trong số loại người học cho phép
        const easy = pickTypes("learn", ["meaning", "pinyin"]);
        const hard = pickTypes("learn", ["hanzi", "listen", "cloze", "cloze"]);
        const rnd = a => a[Math.floor(Math.random() * a.length)];
        const r1 = shuffle(s.words).map(w => makeQuestion(w, rnd(easy), pool));
        const r2 = shuffle(s.words).map(w => makeQuestion(w, rnd(hard), pool));
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
        const q = { cfg, queue: cfg.questions.slice(), total: cfg.questions.length, done: 0, firstTry: 0, attempts: {}, wrongWords: new Map(), answered: false,
                    marks: cfg.questions.map(() => "") };
        q.queue.forEach((x, i) => { x.qi = i; });
        session.quiz = q;
        renderQuestion();
    }
    function renderQuestion() {
        const q = session.quiz;
        if (!q.queue.length) { q.cfg.onDone(quizResult(q)); return; }
        const cur = q.queue[0];
        setSegments(q.marks, cur.qi, cur.retry ? `Làm lại · ${q.done}/${q.total}` : `Câu ${q.done + 1}/${q.total}`);
        q.answered = false;
        q.answeredAt = 0;
        document.body.classList.remove("fb-open");
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
            if (e.target.closest("#btn-continue")) tryContinue();
        };
    }
    function answer(i) {
        const q = session.quiz, cur = q.queue[0];
        q.answered = true;
        const ok = i === cur.answer;
        const btns = body().querySelectorAll(".opt");
        btns.forEach((b, k) => { b.disabled = true; if (k === cur.answer) b.classList.add("correct"); else if (k === i) b.classList.add("wrong"); });
        logAnswer(ok);
        if (!cur.retry) { if (ok) q.firstTry++; q.marks[cur.qi] = ok ? "ok" : "bad"; setSegments(q.marks, cur.qi, `Câu ${q.done + 1}/${q.total}`); }
        if (!ok) {
            q.wrongWords.set(cur.w.id, cur.w);
            if (q.cfg.retryWrong && !cur.retry) {
                const again = makeQuestion(cur.w, cur.type, LEVELS[cur.w.level].words);
                again.retry = true;
                again.qi = cur.qi;
                q.queue.splice(Math.min(q.queue.length, 4), 0, again);
            }
        }
        const w = cur.w;
        $("feedback").innerHTML = `<div class="fb ${ok ? "fb-ok" : "fb-bad"}">
            <div class="fb-title">${ok ? "Chính xác! 🎉" : "Chưa đúng"}</div>
            <div class="fb-word"><span class="fb-hz">${esc(w.hz)}</span> <span class="py">${esc(w.py)}</span> — ${esc(w.vi)}
                <button class="say-btn sm" data-say="${esc(w.clean)}">🔊</button></div>
            ${!ok && w.ex ? `<div class="fb-ex">${highlight(w.ex, w.clean)}<br><small>${esc(w.exvi)}</small></div>` : ""}
            <button class="btn btn-primary" id="btn-continue">Tiếp tục <span class="kbd-only">(Enter)</span></button>
        </div>`;
        q.answeredAt = Date.now();
        document.body.classList.add("fb-open");   // điện thoại: khung kết quả + nút Tiếp tục nổi ở đáy màn hình
        if (S.settings.speak && cur.type !== "listen") speak(w.clean);
    }
    // Chặn chạm nhầm: bỏ qua lần bấm "Tiếp tục" trong 350ms đầu sau khi chọn đáp án
    function tryContinue() {
        const q = session && session.quiz;
        if (!q || !q.answered || Date.now() - (q.answeredAt || 0) < 350) return;
        nextQuestion();
    }
    function nextQuestion() {
        document.body.classList.remove("fb-open");
        const q = session.quiz;
        const cur = q.queue.shift();
        if (!cur.retry) q.done++;
        renderQuestion();
    }
    function quizResult(q) {
        return { score: q.total ? Math.round(q.firstTry / q.total * 100) : 0, correct: q.firstTry, total: q.total, wrong: Array.from(q.wrongWords.values()) };
    }
    function starsFor(score) { return score >= 95 ? 3 : score >= 85 ? 2 : score >= 70 ? 1 : 0; }

    function finishUnit(res, allKnown) {
        const s = session, u = s.unit;
        const passed = res.score >= PASS_UNIT * 100;
        const wrongIds = new Set(res.wrong.map(w => w.id));
        let newCount = 0;
        const act = s.kind === "active", known = s.known || new Set(), intro = s.introduced || new Set();
        u.words.forEach(w => {
            const ok = !wrongIds.has(w.id);
            if (!S.srs[w.id]) {
                introduce(w.id, ok); newCount++;
            } else if (act && !ok && (intro.has(w.id) || known.has(w.id))) softFail(w.id);   // học hoặc kiểm chứng ở phiên này mà sai
        });
        newCount += intro.size;
        const prev = S.units[u.key] || {};
        const stars = starsFor(res.score);
        S.units[u.key] = { done: prev.done || passed, best: Math.max(prev.best || 0, res.score), stars: Math.max(prev.stars || 0, stars), at: Date.now() };
        save();
        s.dirty = false;
        setProgress(1);
        const next = passed ? nextStep() : null;
        renderResult({
            passed, res, stars,
            title: allKnown ? "Bạn đã biết cả bài!" : passed ? "Hoàn thành bài học!" : "Chưa đạt — hãy thử lại",
            note: allKnown ? "Mọi từ của bài đều đã nhớ chắc nên không cần làm bài chốt. Các từ vẫn được hẹn ôn theo lịch." : passed
                ? `${newCount ? newCount + " từ mới đã được thêm vào lịch ôn tập. " : ""}Các từ trả lời sai sẽ được hẹn ôn lại sau 10 phút.${S.settings.sameDay && newCount ? " Từ mới còn được hỏi lại trong ngày." : ""}`
                : `Cần đạt ít nhất ${PASS_UNIT * 100}% để qua bài. Xem lại các từ sai bên dưới rồi luyện lại nhé.`,
            actions: passed
                ? [act ? { id: "recall", label: "🧾 Thử nhớ lại hết" } : null, next ? { id: "next", label: next.type === "unit" ? `Bài tiếp theo (Bài ${next.u.n + 1}) →` : `Kiểm tra chặng ${next.st.n + 1} →`, primary: true } : null, { id: "home", label: "Về lộ trình" }]
                : [{ id: "retry", label: "Luyện lại", primary: true }, { id: "relearn", label: act ? "Học lại từ đầu" : "Học lại thẻ từ" }, { id: "home", label: "Về lộ trình" }],
            onAction: id => {
                if (id === "home") closeSession(true);
                if (id === "recall") { renderRecallAll(u); return; }
                if (act && id === "relearn") { startUnit(u); return; }
                if (act && id === "retry") { session = { kind: "active", unit: u, words: u.words, known: new Set(), introduced: new Set(), weak: new Set(), retryAll: !u.words.some(w => !S.srs[w.id] || S.srs[w.id].iv < KNOWN_IV) }; startFinal(); return; }
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
        const types = shuffle(qTypes("learn"));
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
        $("rv-sub").insertAdjacentHTML("beforeend", skipNote());
        $("btn-start-review").disabled = due.length === 0;

        // Dự báo 7 ngày
        const days = [];
        const sod = startOfDay();
        const skip = skipLevels();      // cấp đang tạm ẩn: không tính vào dự báo (khớp với số từ đến hạn ở trên)
        const shown = Object.keys(S.srs).filter(id => BY_ID.has(id) && (!skip.length || skip.indexOf(BY_ID.get(id).level) < 0));
        for (let i = 0; i < 7; i++) {
            const end = sod + (i + 1) * DAY;
            const start = i === 0 ? -Infinity : sod + i * DAY;
            let n = 0;
            for (const id of shown) { const d = S.srs[id].due; if (d >= start && d < end) n++; }
            days.push({ label: i === 0 ? "Hôm nay" : ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][new Date(sod + i * DAY).getDay()], n });
        }
        const max = Math.max(1, ...days.map(d => d.n));
        $("forecast").innerHTML = `<div class="fc-title">Dự báo số từ cần ôn 7 ngày tới${skip.length ? ` <small class="muted">(không tính HSK ${skip.join(", ")} đang tạm ẩn)</small>` : ""}</div><div class="fc-bars">${days.map(d =>
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
        renderQtBoxes();
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
        setProgress(s.done / s.total, `${Math.min(s.done + 1, s.total)}/${s.total}`);
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
        autoSpeakWord(w);
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
        setProgress(s.i / s.list.length, `${s.i + 1}/${s.list.length}`);
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

    // ================================================================ KIỂM TRA XẾP LỚP
    // Dành cho người đã có nền tảng: hỏi nhanh 3–4 từ mỗi bài (thấy chữ Hán → chọn nghĩa, 8 giây/câu).
    // Bài đạt (đúng hết, bài hỏi 4 từ được sai 1; TB thời gian các câu đúng ≤ 4 giây) được đánh dấu hoàn thành,
    // từ của bài vào lịch ôn với khoảng cách dài. Kiểm tra lần lượt từ cấp thấp, cấp nào đúng < 60% thì dừng.
    const PL_LIMIT = 8000;        // giới hạn mỗi câu (ms)
    const PL_FAST = 4000;         // thời gian trung bình tối đa để bài được tính là đạt (ms)
    const PL_LEVEL_MIN = 0.6;     // tỉ lệ đúng tối thiểu của một cấp để kiểm tra tiếp cấp cao hơn
    function plAskCount(u) { return u.words.length >= 20 ? 4 : 3; }
    function plRangeInfo(maxLv) {
        let units = 0, qs = 0;
        for (let lv = 1; lv <= maxLv; lv++) LEVELS[lv].units.forEach(u => { units++; qs += plAskCount(u); });
        return { units, qs, min: Math.max(5, Math.round(qs * 4.5 / 60)) };
    }
    function openPlacementIntro() {
        if (session && !$("session").hidden) return;
        session = { kind: "placement", stage: "intro", dirty: false, maxLv: (S.placement && S.placement.range) || 3 };
        openSession("🎯 Kiểm tra xếp lớp");
        setProgress(0, "");
        renderPlacementIntro();
    }
    function renderPlacementIntro() {
        const s = session;
        const last = S.placement && S.placement.at
            ? `<p class="pl-last">Lần trước: ${fmtDate(S.placement.at)} · phạm vi HSK 1–${S.placement.range}${S.placement.result && S.placement.result.passed !== undefined ? ` · đạt ${S.placement.result.passed} bài` : ""}</p>` : "";
        body().innerHTML = `<div class="pl-intro">
            <div class="pl-badge">🎯</div>
            <h2>Kiểm tra xếp lớp</h2>
            <p class="muted">Đã học tiếng Trung trước đây? Làm bài kiểm tra nhanh để bỏ qua những bài bạn đã biết và bắt đầu đúng trình độ.</p>
            <ul class="pl-points">
                <li>⏱ Khoảng <b>15–20 phút</b> (HSK 1–3). Mỗi bài trong lộ trình hỏi 3–4 từ: thấy chữ Hán, chọn nghĩa đúng trong <b>8 giây</b>.</li>
                <li>🤷 Không chắc thì bấm <b>Không biết</b>. Đừng đoán, kết quả sẽ chính xác hơn.</li>
                <li>✅ Bài nào đạt (đúng hết và trả lời nhanh) sẽ được <b>đánh dấu hoàn thành</b>. Từ của bài vào lịch ôn với khoảng cách dài (20–45 ngày).</li>
                <li>📚 Bài chưa đạt được giữ lại để bạn học. Từ trả lời sai được đưa vào ôn tập ngay.</li>
                <li>🛑 Nếu một cấp đúng dưới 60%, bài kiểm tra tự dừng ở cấp đó. Bạn có thể dừng và xem kết quả bất cứ lúc nào.</li>
            </ul>
            <div class="pl-ranges" role="radiogroup" aria-label="Phạm vi kiểm tra">
                ${[3, 4, 5].map(m => { const r = plRangeInfo(m); return `<button class="pl-range ${s.maxLv === m ? "active" : ""}" data-max="${m}" role="radio" aria-checked="${s.maxLv === m}">
                    <b>HSK 1–${m}</b><small>${r.units} bài · ${r.qs} câu · ~${r.min} phút</small></button>`; }).join("")}
            </div>
            ${last}
            <div class="btn-row center"><button class="btn btn-primary btn-lg pl-start" id="pl-start">Bắt đầu</button></div>
            <div class="kbd-hint">Trên máy tính: phím 1–4 để chọn, phím 0 = Không biết</div>
        </div>`;
        body().onclick = e => {
            const r = e.target.closest(".pl-range");
            if (r) { s.maxLv = +r.dataset.max; renderPlacementIntro(); return; }
            if (e.target.closest("#pl-start")) startPlacement(s.maxLv);
        };
    }
    function startPlacement(maxLv) {
        const plan = [];
        for (let lv = 1; lv <= maxLv; lv++) {
            const items = [];
            LEVELS[lv].units.forEach(u => shuffle(u.words).slice(0, plAskCount(u)).forEach(w => items.push({ w, u })));
            plan.push({ lv, items: shuffle(items) });
        }
        session = {
            kind: "placement", stage: "quiz", dirty: true, maxLv, plan, li: 0, i: 0,
            total: plan.reduce((a, p) => a + p.items.length, 0), answered: 0,
            ans: {},          // unitKey -> [{ id, ok, ms, dk }]
            stopReason: "", timer: null, locked: false,
        };
        openSession(`🎯 Kiểm tra xếp lớp · HSK 1–${maxLv}`);
        renderPlacementQ();
    }
    function renderPlacementQ() {
        const s = session; if (!s || s.kind !== "placement") return;
        const P = s.plan[s.li];
        if (s.i >= P.items.length) { placementLevelEnd(); return; }
        const it = P.items[s.i], w = it.w;
        const ds = pickDistractors(w, 3, LEVELS[w.level].words, "vi");
        s.opts = shuffle([w].concat(ds));
        s.answer = s.opts.indexOf(w);
        s.locked = false;
        s.stage = "quiz";
        setProgress(s.answered / s.total, `${s.answered + 1}/${s.total}`);
        body().innerHTML = `<div class="pl-q">
            <div class="pl-top">
                <span class="chip" style="--c:${LEVEL_COLORS[P.lv]}">Đang kiểm tra HSK ${P.lv}</span>
                <span class="muted">Câu ${s.i + 1}/${P.items.length} của cấp</span>
            </div>
            <div class="sp-timer"><i style="animation-duration:${PL_LIMIT}ms"></i></div>
            <div class="pl-hz">${esc(w.hz)}</div>
            <div class="pl-py" id="pl-py">Nghĩa của từ này là gì?</div>
            <div class="opts pl-opts">${s.opts.map((o, k) => `<button class="opt" data-i="${k}"><kbd>${k + 1}</kbd><span>${esc(o.vi)}</span></button>`).join("")}</div>
            <button class="btn pl-dk" data-dk>🤷 Không biết <kbd class="kbd-only">0</kbd></button>
            <div class="pl-foot"><button class="pl-link" data-stop>Dừng &amp; xem kết quả</button></div>
        </div>`;
        body().onclick = e => {
            if (e.target.closest("[data-stop]")) { placementStop(); return; }
            if (e.target.closest("[data-dk]")) { placementAnswer(-2); return; }
            const o = e.target.closest(".opt"); if (o) placementAnswer(+o.dataset.i);
        };
        s.t0 = performance.now();
        clearTimeout(s.timer);
        s.timer = setTimeout(() => placementAnswer(-1), PL_LIMIT);
    }
    // k: chỉ số đáp án; -1 = hết giờ; -2 = "Không biết"
    function placementAnswer(k) {
        const s = session; if (!s || s.kind !== "placement" || s.stage !== "quiz" || s.locked) return;
        s.locked = true;
        clearTimeout(s.timer);
        const ms = k === -1 ? PL_LIMIT : Math.min(performance.now() - s.t0, PL_LIMIT);
        const it = s.plan[s.li].items[s.i], w = it.w;
        const ok = k === s.answer;
        (s.ans[it.u.key] = s.ans[it.u.key] || []).push({ id: w.id, ok, ms: Math.round(ms), dk: k === -2 });
        s.answered++;
        body().querySelectorAll(".opt, .pl-dk").forEach(b => { b.disabled = true; });
        body().querySelectorAll(".opt").forEach((b, i) => { if (i === s.answer) b.classList.add("correct"); else if (i === k) b.classList.add("wrong"); });
        const tm = body().querySelector(".sp-timer i"); if (tm) tm.style.animationPlayState = "paused";
        const py = $("pl-py");
        py.innerHTML = `<span class="py">${esc(w.py)}</span>${ok ? " ✓" : k === -1 ? " · <b class='pl-late'>hết giờ</b>" : ""}`;
        setProgress(s.answered / s.total, `${Math.min(s.answered + 1, s.total)}/${s.total}`);
        s.i++;
        s.timer = setTimeout(renderPlacementQ, ok ? 450 : 1300);
    }
    function placementLevelStats(lv) {
        const s = session;
        let n = 0, c = 0;
        LEVELS[lv].units.forEach(u => (s.ans[u.key] || []).forEach(a => { n++; if (a.ok) c++; }));
        return { n, c, acc: n ? c / n : 0 };
    }
    function placementLevelEnd() {
        const s = session;
        const P = s.plan[s.li];
        const st = placementLevelStats(P.lv);
        const pct = Math.round(st.acc * 100);
        if (st.acc < PL_LEVEL_MIN) {
            if (s.li < s.plan.length - 1) s.stopReason = `HSK ${P.lv} chỉ đúng ${pct}% (dưới ${PL_LEVEL_MIN * 100}%), nên bài kiểm tra dừng ở đây. Các cấp cao hơn chưa được kiểm tra.`;
            placementFinish(); return;
        }
        if (s.li >= s.plan.length - 1) { placementFinish(); return; }
        // nghỉ giữa hai cấp
        s.stage = "between";
        const nextLv = s.plan[s.li + 1].lv;
        body().innerHTML = `<div class="result pass pl-between">
            <h2>Xong HSK ${P.lv}</h2>
            <div class="score-big">${pct}%</div>
            <div class="muted">${st.c}/${st.n} câu đúng</div>
            <p>Tiếp theo: <b>HSK ${nextLv}</b> · ${s.plan[s.li + 1].items.length} câu.</p>
            <div class="btn-row center">
                <button class="btn btn-primary btn-lg" data-go="next">Tiếp tục HSK ${nextLv} →</button>
                <button class="btn" data-stop>Dừng &amp; xem kết quả</button>
            </div>
        </div>`;
        body().onclick = e => {
            if (e.target.closest("[data-stop]")) { placementFinish(); return; }
            if (e.target.closest("[data-go]")) { s.li++; s.i = 0; renderPlacementQ(); }
        };
    }
    function placementStop() {
        const s = session;
        clearTimeout(s.timer);
        s.stage = "paused";
        if (!confirm("Dừng kiểm tra và xem kết quả? Chỉ những bài đã trả lời đủ câu mới được chấm.")) {
            // làm lại câu hiện tại với đồng hồ mới (câu chưa được ghi)
            renderPlacementQ();
            return;
        }
        if (!s.stopReason) s.stopReason = "Bạn đã dừng giữa chừng. Các bài chưa trả lời đủ câu chưa được chấm.";
        placementFinish();
    }
    // Chấm kết quả từ s.ans
    function computePlacement(s) {
        const levels = [];
        const passedUnits = [];
        const tested = new Set();
        s.plan.forEach(P => {
            const L = LEVELS[P.lv];
            const st = placementLevelStats(P.lv);
            const lvRes = { lv: P.lv, total: L.units.length, tested: 0, passed: 0, n: st.n, c: st.c, acc: st.acc, failed: [] };
            L.units.forEach(u => {
                const a = s.ans[u.key] || [];
                if (a.length < plAskCount(u) || a.length === 0) return; // chưa trả lời đủ -> chưa chấm
                lvRes.tested++;
                tested.add(u.key);
                const wrong = a.filter(x => !x.ok);
                const okA = a.filter(x => x.ok);
                const avg = okA.length ? okA.reduce((t, x) => t + x.ms, 0) / okA.length : PL_LIMIT;
                const accOk = wrong.length === 0 || (a.length >= 4 && wrong.length <= 1);
                const fast = avg <= PL_FAST;
                const score = Math.round(okA.length / a.length * 100);
                if (accOk && fast) { lvRes.passed++; passedUnits.push({ u, score, a }); }
                else lvRes.failed.push({ u, wrong: wrong.map(x => BY_ID.get(x.id)), slow: accOk && !fast, avg });
            });
            if (st.n > 0) levels.push(lvRes);
        });
        // gợi ý: bài đầu tiên chưa đạt (hoặc chưa kiểm tra) trong phạm vi
        let suggest = null;
        const passedSet = new Set(passedUnits.map(p => p.u.key));
        for (let lv = 1; lv <= s.maxLv && !suggest; lv++) {
            const u = LEVELS[lv].units.find(x => !passedSet.has(x.key) && !unitDone(x));
            if (u) suggest = { lv, u };
        }
        if (!suggest && s.maxLv < 6) suggest = { lv: s.maxLv + 1, u: LEVELS[s.maxLv + 1].units.find(x => !unitDone(x)) || LEVELS[s.maxLv + 1].units[0], beyond: true };
        return { levels, passedUnits, tested, suggest };
    }
    function placementFinish() {
        const s = session;
        clearTimeout(s.timer);
        s.stage = "result";
        if (!s.stopReason && s.answered < s.total) s.stopReason = "Bạn đã dừng trước khi hết phạm vi. Các bài chưa trả lời đủ câu chưa được chấm và giữ nguyên.";
        s.result = computePlacement(s);
        setProgress(1, "Kết quả");
        const R = s.result;
        const lvHtml = R.levels.map(L => {
            const pct = Math.round(L.acc * 100);
            const complete = L.tested === L.total;
            return `<div class="pl-lv" style="--c:${LEVEL_COLORS[L.lv]}">
                <div class="pl-lv-head">
                    <b>HSK ${L.lv}</b>
                    <span>${L.passed}/${L.total} bài đạt</span>
                    <span class="pl-acc ${pct >= 80 ? "good" : pct >= PL_LEVEL_MIN * 100 ? "mid" : "low"}">${pct}% đúng</span>
                </div>
                <div class="lvl-bar"><i style="width:${Math.round(L.passed / L.total * 100)}%"></i></div>
                ${!complete ? `<div class="pl-note">Mới chấm ${L.tested}/${L.total} bài.</div>` : ""}
                ${L.failed.length ? `<details class="pl-fail" ${L.failed.length <= 6 ? "open" : ""}><summary>${L.failed.length} bài chưa đạt</summary>
                    <ul>${L.failed.map(f => `<li><b>Bài ${f.u.n + 1}</b> ${f.wrong.length
                        ? f.wrong.slice(0, 3).map(w => `<span class="pl-w" data-say="${esc(w.clean)}">${esc(w.clean)}</span>`).join(" ") + (f.wrong.length > 3 ? " …" : "")
                        : ""}${f.slow ? ` <span class="muted">· trả lời chậm (TB ${fmtSec(f.avg)})</span>` : ""}</li>`).join("")}</ul></details>` : ""}
            </div>`;
        }).join("");
        const totalPassed = R.passedUnits.length;
        const sg = R.suggest;
        const sgHtml = sg
            ? (sg.beyond
                ? `Bạn đã vững toàn bộ HSK 1–${s.maxLv}. Nên học tiếp <b>HSK ${sg.lv}</b>${s.maxLv < 5 ? ", hoặc làm lại kiểm tra với phạm vi rộng hơn" : ""}.`
                : `Nên học tiếp: <b>HSK ${sg.lv} · Bài ${sg.u.n + 1}</b>.`)
            : "Bạn đã hoàn thành toàn bộ lộ trình!";
        body().innerHTML = `<div class="result pl-result ${totalPassed ? "pass" : "fail"}">
            <div class="pl-badge">🎯</div>
            <h2>Kết quả kiểm tra xếp lớp</h2>
            <div class="score-big">${totalPassed} bài</div>
            <div class="muted">đạt trên ${R.tested.size} bài đã chấm · ${s.answered} câu đã trả lời</div>
            ${s.stopReason ? `<p class="pl-stop">${esc(s.stopReason)}</p>` : ""}
            <div class="pl-levels">${lvHtml || `<p class="muted">Chưa có bài nào được chấm.</p>`}</div>
            <p class="pl-suggest">👉 ${sgHtml}</p>
            <p class="muted pl-apply-note">Áp dụng: ${totalPassed} bài đạt được đánh dấu hoàn thành, từ của các bài này vào lịch ôn sau 20–45 ngày. Từ trả lời sai được đưa vào ôn tập ngay. Không có tiến độ nào bị giảm.</p>
            <div class="btn-row center">
                <button class="btn btn-primary btn-lg" data-res="apply" ${s.answered ? "" : "disabled"}>✓ Áp dụng kết quả</button>
                <button class="btn btn-lg" data-res="skip">Bỏ qua</button>
            </div>
        </div>`;
        body().onclick = e => {
            const say = e.target.closest("[data-say]"); if (say) { speak(say.dataset.say); return; }
            const b = e.target.closest("[data-res]"); if (!b || b.disabled) return;
            if (b.dataset.res === "apply") applyPlacement();
            else { s.dirty = false; closeSession(true); }
        };
    }
    function applyPlacement() {
        const s = session, R = s.result;
        const now = Date.now(), sod = startOfDay();
        const passedSet = new Set(R.passedUnits.map(p => p.u.key));
        let newCards = 0, dueNow = 0;
        // 1. Bài đạt
        R.passedUnits.forEach(({ u, score }) => {
            const prev = S.units[u.key] || {};
            S.units[u.key] = Object.assign({}, prev, {
                done: true, best: Math.max(prev.best || 0, score), stars: Math.max(prev.stars || 0, starsFor(score)), placed: true, at: now,
            });
        });
        // 2. Thẻ SRS: từ sai -> ôn ngay; từ đúng -> cập nhật tốc độ nhận diện; từ còn lại của bài đạt -> thẻ "đã thuộc"
        const wrongIds = new Set();
        Object.keys(s.ans).forEach(k => s.ans[k].forEach(a => {
            if (!BY_ID.has(a.id)) return;
            if (!a.ok) {
                wrongIds.add(a.id);
                if (S.srs[a.id]) S.srs[a.id] = schedule(S.srs[a.id], 1);
                else { S.srs[a.id] = { ef: 2.5, iv: 0, reps: 0, lapses: 0, first: now, last: now, due: now, placed: true }; newCards++; }
                dueNow++;
            } else if (S.srs[a.id]) updateRT(a.id, a.ms, true);
        }));
        R.passedUnits.forEach(({ u, a }) => {
            const rtById = new Map(a.filter(x => x.ok).map(x => [x.id, x.ms]));
            u.words.forEach(w => {
                if (S.srs[w.id] || wrongIds.has(w.id)) return;
                const iv = 20 + Math.floor(Math.random() * 26);   // 20–45 ngày, rải đều để không dồn ngày ôn
                S.srs[w.id] = { ef: 2.5, iv, reps: 3, lapses: 0, first: now, last: now, due: sod + iv * DAY, placed: true };
                if (rtById.has(w.id)) S.srs[w.id].rt = Math.max(150, rtById.get(w.id));
                newCards++;
            });
        });
        // 3. Chặng có mọi bài đã hoàn thành (ít nhất một bài vừa đạt) -> qua chặng
        let stagesDone = 0;
        for (let lv = 1; lv <= s.maxLv; lv++) {
            LEVELS[lv].stages.forEach(st => {
                if (stageDone(st) || !st.units.every(unitDone) || !st.units.some(u => passedSet.has(u.key))) return;
                const prev = S.stages[st.key] || {};
                const sc = R.passedUnits.filter(p => p.u.stage === st);
                const avg = sc.length ? Math.round(sc.reduce((t, p) => t + p.score, 0) / sc.length) : 100;
                S.stages[st.key] = Object.assign({}, prev, { done: true, best: Math.max(prev.best || 0, avg), placed: true, at: now });
                stagesDone++;
            });
        }
        // 4. Mở khóa cấp: mọi cấp đã kiểm tra; cấp đã xong hết -> mở cấp kế tiếp
        R.levels.forEach(L => {
            if (L.lv > 1) S.unlocked[L.lv] = true;
            if (levelDone(L.lv) && L.lv < 6) S.unlocked[L.lv + 1] = true;
        });
        if (R.suggest) { if (R.suggest.lv > 1) S.unlocked[R.suggest.lv] = true; S.lastLevel = R.suggest.lv; }
        // 5. Lưu kết quả kiểm tra
        S.placement = {
            at: now, range: s.maxLv,
            result: {
                passed: R.passedUnits.length, tested: R.tested.size, answered: s.answered, stopped: s.stopReason || "",
                levels: R.levels.map(L => ({ lv: L.lv, passed: L.passed, tested: L.tested, total: L.total, acc: Math.round(L.acc * 100) })),
                suggest: R.suggest ? { lv: R.suggest.lv, unit: R.suggest.u ? R.suggest.u.n : 0 } : null,
            },
        };
        save();
        s.dirty = false;
        closeSession(true);
        showView("path");
        toast(`Đã áp dụng: ${R.passedUnits.length} bài hoàn thành${stagesDone ? `, ${stagesDone} chặng` : ""} · ${newCards} từ vào lịch ôn${dueNow ? ` (${dueNow} từ ôn ngay)` : ""}`);
    }
    function placementKey(e) {
        const s = session;
        if (s.stage === "quiz" && !s.locked) {
            if (/^[1-4]$/.test(e.key)) { e.preventDefault(); placementAnswer(+e.key - 1); }
            else if (e.key === "0" || e.key === "?") { e.preventDefault(); placementAnswer(-2); }
        } else if (s.stage === "intro" && e.key === "Enter") { e.preventDefault(); startPlacement(s.maxLv); }
    }
    function renderPlacementCTA() {
        const el = $("placement-cta"); if (!el) return;
        const p = S.placement;
        el.innerHTML = `<div class="pl-cta-ic">🎯</div>
            <div class="pl-cta-txt">
                <b>Kiểm tra xếp lớp</b>
                <span>${p && p.at
                    ? `Đã làm ngày ${fmtDate(p.at)} (HSK 1–${p.range}${p.result ? `, đạt ${p.result.passed} bài` : ""}). Làm lại để cập nhật trình độ.`
                    : "Đã có nền tảng? Làm bài kiểm tra 15–20 phút để bỏ qua các bài đã biết."}</span>
            </div>
            <div class="pl-cta-acts">
                <button class="btn ${p && p.at ? "" : "btn-primary"} pl-cta-btn" id="btn-placement">${p && p.at ? "Làm lại" : "Bắt đầu"}</button>
                ${p && p.at && !p.undone ? `<button class="btn btn-ghost-danger pl-cta-btn" id="btn-placement-undo" title="Bỏ các đánh dấu do bài kiểm tra tạo">↺ Hoàn tác</button>` : ""}
            </div>`;
        $("btn-placement").onclick = openPlacementIntro;
        if ($("btn-placement-undo")) $("btn-placement-undo").onclick = undoPlacement;
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
        $("set-mode").value = S.settings.learnMode === "classic" ? "classic" : "active";
        $("set-recall").value = S.settings.recall === "self" ? "self" : "type";
        $("set-sameday").checked = !!S.settings.sameDay;
        renderQtBoxes();
    }
    function bindSettings() {
        // Chip chọn loại câu hỏi (ở Cài đặt, tab Ôn tập và thẻ cuối trước khi luyện tập): đổi một chỗ thì mọi chỗ cập nhật
        document.addEventListener("change", e => {
            const cb = e.target.closest && e.target.closest("[data-qt-kind]");
            if (!cb) return;
            const kind = cb.dataset.qtKind, key = kind === "review" ? "qtReview" : "qtLearn";
            const box = cb.closest("[data-qt-box]");
            const sel = [...box.querySelectorAll("input:checked")].map(x => x.value);
            if (!sel.length) { cb.checked = true; toast("Cần giữ ít nhất một loại câu hỏi"); return; }
            S.settings[key] = QT_ORDER.filter(t => sel.indexOf(t) >= 0);
            save();
            renderQtBoxes();
        });
        // Cách học từ mới: chọn ở Cài đặt hoặc ngay trong hộp xem trước bài
        document.addEventListener("change", e => { if (e.target.name === "learn-mode") setLearnMode(e.target.value); });
        $("set-mode").onchange = e => { setLearnMode(e.target.value); toast(S.settings.learnMode === "classic" ? "Đã chọn Lật thẻ" : "Đã chọn Học chủ động"); };
        $("set-recall").onchange = e => { S.settings.recall = e.target.value; save(); };
        $("set-sameday").onchange = e => { S.settings.sameDay = e.target.checked; save(); };
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
        if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
        if (e.key === "Escape") { closeSession(); return; }
        if (session.kind === "placement") { placementKey(e); return; }
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
            else if (q.answered && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); tryContinue(); }
            return;
        }
        if (session.vf) { if (/^[0-4]$/.test(e.key)) { e.preventDefault(); answerVerify(e.key === "0" ? -2 : +e.key - 1); } return; }
        if (session.kind === "scan") {
            if (!session.over) {
                if (/^[1-3]$/.test(e.key)) { e.preventDefault(); scanPick(String(+e.key - 1)); }
                else if (e.key === "ArrowLeft" || e.key === "Backspace") { e.preventDefault(); scanPick("back"); }
            } else if (e.key === "Enter") { const b = body().querySelector('[data-ac="next"]'); if (b && e.target.tagName !== "BUTTON") { e.preventDefault(); b.click(); } }
            return;
        }
        if (session.kind === "active" || session.kind === "fresh") {
            if (session.guess) { if (/^[0-4]$/.test(e.key)) { e.preventDefault(); revealGuess(+e.key - 1); } return; }
            const self1 = body().querySelector('[data-rc="self1"]');
            if (self1) {
                if ((e.key === "1" || e.key === "2") && Date.now() - session.shownAt > 300) { e.preventDefault(); (e.key === "2" ? self1 : body().querySelector('[data-rc="self0"]')).click(); }
                return;
            }
            if (e.key !== "Enter" && e.key !== " ") return;
            const go = body().querySelector('[data-rc="show"], [data-ac="next"]');
            if (e.target.tagName === "BUTTON" && e.target !== go && body().contains(e.target)) return;   // Enter trên nút khác: để nút đó xử lý
            if (!go) return;
            e.preventDefault();
            if (Date.now() - (session.shownAt || 0) > 300) go.click();
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
        Object.keys(S.fresh).forEach(id => { if (dayKey(S.fresh[id].at) !== dayKey()) delete S.fresh[id]; });   // chỉ nhớ lại trong ngày
        // Link thẳng tới một cấp: hsk_lotrinh.html?level=3
        const qLevel = +new URLSearchParams(location.search).get("level");
        if (qLevel >= 1 && qLevel <= 6) S.lastLevel = qLevel;
        $("tabs").onclick = e => { const b = e.target.closest(".tab"); if (b) showView(b.dataset.view); };
        $("ss-close").onclick = () => closeSession();
        $("btn-start-review").onclick = startReview;
        $("btn-weak").onclick = () => startFreeQuiz(weakWords(), "Ôn từ hay sai", pickTypes("review", ["hanzi", "meaning", "listen", "cloze"]));
        $("btn-quick").onclick = () => {
            const lv = +$("quick-level").value;
            startFreeQuiz(LEVELS[lv].words.filter(w => S.srs[w.id]), "Trắc nghiệm nhanh HSK " + lv, shuffle(qTypes("review")));
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
        // Mở thẳng kiểm tra xếp lớp: hsk_lotrinh.html?placement=1
        if (new URLSearchParams(location.search).get("placement")) openPlacementIntro();
        // Nhớ lại từ mới trong ngày: hsk_lotrinh.html?fresh=1 (dải nhắc ở Buổi học hôm nay)
        if (new URLSearchParams(location.search).get("fresh")) startFresh();
        // Đến giờ nhớ lại thì cập nhật kế hoạch hôm nay (chỉ khi đang ở tab Lộ trình và không trong phiên học)
        let freshN = freshInfo().ready.length;
        setInterval(() => {
            const n = freshInfo().ready.length;
            if (n === freshN) return;
            freshN = n;
            if (!session && $("modal").hidden && $("view-path").classList.contains("active")) renderPath();
        }, 30000);
    }
    init();
})();
