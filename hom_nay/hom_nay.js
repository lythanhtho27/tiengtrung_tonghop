/* ==========================================================================
   BUỔI HỌC HÔM NAY — gom cả buổi học hằng ngày vào một trang
   Bước 1. Ôn tập đến hạn: gom thẻ đến hạn từ MỌI nguồn SRS trong localStorage, ôn kiểu flashcard
           và ghi kết quả ngược lại đúng key, đúng thẻ, bằng công thức schedule của chính trang đó:
             hsk      hsk_lotrinh_v1.srs[id]            id "3-帮忙"   (hsk_lotrinh/hsk_lotrinh.js)
             boya     boya_learning_progress_v2.srs[id] id "tc1_3_5"  (boya_learning/boya_learning.js)
             tv       boya_tv_srs[id] + boya_tv_days    id "tc1_3_5"  (tuvung/tuvung.js)
             wl       hsk_wl_srs_v3[id] + hsk_wl_json_progress_v2.daily, id "L1-0001" (word_learning/word_learning.js)
             my       hoc_mywords_v1 qua API shared/mywords.js (HocMyWords)
           Cùng chữ Hán (đã bỏ chú thích ngoặc) đến hạn ở nhiều nguồn -> chỉ hỏi MỘT lần,
           điểm chấm áp dụng cho mọi thẻ đó (mỗi thẻ theo schedule của nguồn mình).
   Bước 2. Học bài mới: 1–2 bài nên học tiếp của chặng hiện tại (logic chặng giống index.html).
   Bước 3. Luyện tập 10 phút: trang luyen_tap, xong khi hôm nay làm ≥ 10 câu.
   - Hiển thị: luyen_tap/lt_data.js (LT_DATA.words[id] = [hz, py, nghĩa], LT_DATA.sents),
     shared/dict_vi.js (HOC_DICT.w[hz] = [py, HV, nghĩa], HOC_DICT.c[chữ] = [py, HV]).
   - Lưu: "hom_nay_v1" = { settings, days{date:{r, ok, steps}}, streak } (đồng bộ qua sync.js),
     tóm tắt qua HocProgress.save("hom_nay", …).
   ========================================================================== */
(function () {
    "use strict";

    const STORE = "hom_nay_v1";
    const DAY = 86400000;
    const RELEARN_MS = 10 * 60000;
    const SLOW_MS = 3000;
    const STREAK_MIN = 10;          // ôn ≥ 10 thẻ trong ngày (hoặc xong bước 2/3) mới tính vào chuỗi ngày học
    const BOYA_STREAK_MIN = 10;     // boya_learning: STREAK_MIN của trang đó
    const SRC = {
        hsk:  { name: "HSK",        order: 0 },
        boya: { name: "Boya",       order: 1 },
        tv:   { name: "Boya TC",    order: 2 },
        wl:   { name: "HSK 3.0",    order: 3 },
        my:   { name: "Từ của tôi", order: 4 },
    };
    const LT = window.LT_DATA || { words: {}, sents: [] };
    const DICT = window.HOC_DICT || { w: {}, c: {} };

    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const fmt = n => Number(n || 0).toLocaleString("vi-VN");
    function dayKey(t) {
        const d = new Date(t === undefined ? Date.now() : t);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    function startOfDay(t) { const d = new Date(t === undefined ? Date.now() : t); d.setHours(0, 0, 0, 0); return d.getTime(); }
    function yesterdayKey() { return dayKey(startOfDay() - DAY / 2); }
    function readJSON(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
    function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.warn("Không lưu được " + k, e); return false; } }
    // Bỏ chú thích trong ngoặc: "（杯）子" -> "杯子", "打（电话）" -> "打" (giống luyen_tap.js)
    function cleanHz(s) {
        let t = String(s || "").replace(/[（(]([^）)]*)[）)](?=[一-鿿])/g, "$1");
        t = t.replace(/\s*[（(][^）)]*[）)]\s*/g, "");
        return t.replace(/\s+/g, "").trim() || String(s || "");
    }
    const HAN = /[㐀-鿿]/;

    // ====================================================================== Công thức lập lịch của từng trang
    // (chép nguyên văn, mỗi trang giữ một bản riêng — sửa ở trang gốc thì nhớ sửa ở đây)

    // hsk_lotrinh/hsk_lotrinh.js: schedule() — boya_learning.js dùng bản giống hệt
    function scheduleHsk(c, rating) {
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
    // boya_learning/boya_learning.js: schedule() (chép từ hsk_lotrinh)
    const scheduleBoya = scheduleHsk;
    // tuvung/tuvung.js: schedule() (RELEARN_MS = 10 phút)
    function scheduleTv(c, rating) {
        const n = Object.assign({}, c);
        n.last = Date.now();
        if (rating === 1) {
            n.reps = 0; n.lapses = (n.lapses || 0) + 1; n.ef = Math.max(1.3, n.ef - 0.2);
            n.iv = 0; n.due = Date.now() + RELEARN_MS;
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
    // tuvung/tuvung.js: trackMistake() — sổ lỗi: sai -> +1; đúng 3 lần liên tiếp -> -1
    function trackMistakeTv(c, ok) {
        if (ok) {
            c.streak = (c.streak || 0) + 1;
            if (c.wrong > 0 && c.streak >= 3) { c.wrong--; c.streak = 0; }
        } else {
            c.streak = 0;
            c.wrong = Math.min(5, (c.wrong || 0) + 1);
        }
    }
    // word_learning/word_learning.js: scheduleCard()
    function scheduleWl(c, rating) {
        const n = Object.assign({}, c);
        n.last = Date.now();
        if (rating === 1) {
            n.reps = 0; n.lapses = (n.lapses || 0) + 1; n.ef = Math.max(1.3, (n.ef || 2.5) - 0.2);
            n.iv = 0; n.due = Date.now() + RELEARN_MS;
            return n;
        }
        const ef = c.ef || 2.5;
        const civ = c.iv || 0;
        let iv;
        if (rating === 2) { iv = Math.max(1, Math.round(civ * 1.2)); n.ef = Math.max(1.3, ef - 0.15); }
        else if (rating === 3) { iv = civ < 1 ? 1 : ((c.reps || 0) <= 1 ? Math.max(3, civ + 1) : Math.round(civ * ef)); }
        else { iv = civ < 1 ? 3 : Math.round(Math.max(4, civ * ef * 1.3)); n.ef = ef + 0.15; }
        n.iv = Math.min(iv, 365); n.reps = (c.reps || 0) + 1;
        n.due = startOfDay() + n.iv * DAY;
        return n;
    }
    // shared/mywords.js: HocMyWords.schedule()
    function scheduleMy(c, rating) {
        if (window.HocMyWords) return HocMyWords.schedule(c, rating);
        return scheduleHsk(Object.assign({ ef: 2.5, iv: 0, reps: 0, lapses: 0 }, c), rating);
    }
    // Trung bình trượt thời gian nhận diện (giống updateRT() của hsk_lotrinh / tuvung / word_learning)
    function rtMix(c, ms, ok) {
        ms = Math.max(150, Math.min(ms, 15000));
        if (!ok) ms = Math.max(ms, SLOW_MS + 500);   // trả lời sai = coi như chưa nhận diện được
        c.rt = c.rt ? Math.round(c.rt * 0.6 + ms * 0.4) : Math.round(ms);
        return ms;
    }
    function ivText(iv) {
        if (iv === 0) return "10 phút";
        if (iv < 30) return iv + " ngày";
        if (iv < 365) return Math.round(iv / 30) + " tháng";
        return "1 năm";
    }

    // Cập nhật một phần bản tóm tắt của trang khác (để trang chủ thấy số thẻ đến hạn mới ngay)
    function patchSummary(page, fn) {
        if (!window.HocProgress) return;
        const s = HocProgress.load(page);
        if (!s) return;
        try { fn(s); HocProgress.save(page, s); } catch (e) { console.warn(e); }
    }
    function countDue(map, filter) {
        const now = Date.now();
        let n = 0;
        for (const id in map) { const c = map[id]; if (c && c.due <= now && (!filter || filter(id))) n++; }
        return n;
    }

    // ====================================================================== Nguồn thẻ
    // Mỗi nguồn: list(now) -> [{ id, card }] thẻ đến hạn; info(id, card) -> {hz, py, vi, ...};
    // rate(id, rating, ms|null) -> đọc lại key, chấm thẻ, ghi lại (đọc – sửa – ghi để không đè dữ liệu tab khác)
    const SOURCES = {
        hsk: {
            key: "hsk_lotrinh_v1",
            list(now) {
                const S = readJSON(this.key, null);
                const srs = (S && S.srs) || {};
                return Object.keys(srs).filter(id => srs[id] && srs[id].due <= now).map(id => ({ id, card: srs[id] }));
            },
            info(id) {
                const w = LT.words[id];
                if (w) return { hz: w[0], py: w[1], vi: w[2] };
                const hz = id.slice(id.indexOf("-") + 1);
                return { hz, py: "", vi: "" };
            },
            schedule: scheduleHsk,
            rate(id, r, ms) {
                const S = readJSON(this.key, null);
                if (!S || !S.srs || !S.srs[id]) return null;
                const old = S.srs[id];
                const rt = old.rt;
                const n = scheduleHsk(old, r);
                if (rt) n.rt = rt;
                S.days = S.days || {};
                const k = dayKey();
                const d = S.days[k] || (S.days[k] = { n: 0, r: 0, c: 0, t: 0 });
                // hsk_lotrinh rate(): đo tốc độ khi mặt trước là chữ Hán và không phải lượt ôn lại
                if (ms != null) {
                    const m = rtMix(n, ms, r >= 3);
                    if (r >= 3) { d.ms = (d.ms || 0) + m; d.mc = (d.mc || 0) + 1; }
                }
                S.srs[id] = n;
                d.r = (d.r || 0) + 1; d.t = (d.t || 0) + 1; if (r >= 3) d.c = (d.c || 0) + 1;   // d.r++; logAnswer(r >= 3)
                writeJSON(this.key, S);
                return n;
            },
            summary() {
                const S = readJSON(this.key, null);
                if (!S) return;
                const d = (S.days || {})[dayKey()] || {};
                patchSummary("hsk_lotrinh", s => {
                    s.due = countDue(S.srs || {}, id => !!LT.words[id]);
                    s.today = Object.assign({}, s.today, { n: d.n || 0, r: d.r || 0 });
                });
            },
        },
        boya: {
            key: "boya_learning_progress_v2",
            list(now) {
                const P = readJSON(this.key, null);
                const srs = (P && P.srs) || {};
                // boya_learning dueIds() chỉ tính từ có trong dữ liệu sách
                return Object.keys(srs).filter(id => srs[id] && srs[id].due <= now && LT.words[id]).map(id => ({ id, card: srs[id] }));
            },
            info(id) { const w = LT.words[id] || []; return { hz: w[0] || "", py: w[1] || "", vi: w[2] || "" }; },
            schedule: scheduleBoya,
            rate(id, r) {
                const P = readJSON(this.key, null);
                if (!P || !P.srs || !P.srs[id]) return null;
                const n = scheduleBoya(P.srs[id], r);    // boya_learning không đo rt khi ôn
                P.srs[id] = n;
                // addActivity('r'): đếm thẻ ôn, streak tăng khi trong ngày q + r ≥ 10
                P.days = P.days || {};
                const k = dayKey();
                const d = P.days[k] || (P.days[k] = { q: 0, r: 0, c: 0, rd: 0 });
                d.r = (d.r || 0) + 1;
                P.streak = P.streak || { count: 0, last: "", best: 0 };
                const units = (d.q || 0) + (d.r || 0);
                if (units >= BOYA_STREAK_MIN && P.streak.last !== k) {
                    P.streak.count = P.streak.last === yesterdayKey() ? (P.streak.count || 0) + 1 : 1;
                    P.streak.last = k;
                    P.streak.best = Math.max(P.streak.best || 0, P.streak.count);
                }
                writeJSON(this.key, P);
                return n;
            },
            summary() {
                const P = readJSON(this.key, null);
                if (!P) return;
                const d = (P.days || {})[dayKey()] || {};
                const st = P.streak || {};
                patchSummary("boya_learning", s => {
                    s.due = countDue(P.srs || {}, id => !!LT.words[id]);
                    s.today = Object.assign({}, s.today, { n: d.n || 0, r: d.r || 0, q: d.q || 0 });
                    s.streak = (st.last === dayKey() || st.last === yesterdayKey()) ? (st.count || 0) : 0;
                });
            },
        },
        tv: {
            key: "boya_tv_srs",
            daysKey: "boya_tv_days",
            list(now) {
                const srs = readJSON(this.key, {}) || {};
                return Object.keys(srs).filter(id => srs[id] && srs[id].due <= now && LT.words[id]).map(id => ({ id, card: srs[id] }));
            },
            info(id) { const w = LT.words[id] || []; return { hz: w[0] || "", py: w[1] || "", vi: w[2] || "" }; },
            schedule: scheduleTv,
            rate(id, r, ms) {
                const srs = readJSON(this.key, null);
                if (!srs || !srs[id]) return null;
                // tuvung rateWord(): schedule + sổ lỗi (trackMistake)
                const before = srs[id];
                const wasLearned = before.reps > 0 || before.iv > 0;
                const n = scheduleTv(before, r);
                if (r === 1) { if (wasLearned) trackMistakeTv(n, false); else n.streak = 0; }
                else trackMistakeTv(n, true);
                // gradeFlashcard(): đo tốc độ khi mặt trước là chữ Hán
                if (ms != null) rtMix(n, ms, r >= 3);
                srs[id] = n;
                writeJSON(this.key, srs);
                const days = readJSON(this.daysKey, {}) || {};
                const k = dayKey();
                const d = days[k] || (days[k] = { n: 0, r: 0 });
                d.r = (d.r || 0) + 1;
                const keys = Object.keys(days).sort();       // pruneDays(): giữ 60 ngày
                while (keys.length > 60) delete days[keys.shift()];
                writeJSON(this.daysKey, days);
                return n;
            },
            summary() {
                const srs = readJSON(this.key, {}) || {};
                const d = (readJSON(this.daysKey, {}) || {})[dayKey()] || {};
                patchSummary("tuvung", s => {
                    s.due = countDue(srs, id => !!LT.words[id]);
                    s.today = Object.assign({}, s.today, { n: d.n || 0, r: d.r || 0 });
                });
            },
        },
        wl: {
            key: "hsk_wl_srs_v3",
            progKey: "hsk_wl_json_progress_v2",
            list(now) {
                const srs = readJSON(this.key, {}) || {};
                return Object.keys(srs).filter(id => srs[id] && srs[id].due <= now && srs[id].hz).map(id => ({ id, card: srs[id] }));
            },
            info(id, c) { c = c || {}; return { hz: c.hz || "", py: c.py || "", vi: c.vi || "" }; },
            schedule: scheduleWl,
            rate(id, r, ms) {
                const srs = readJSON(this.key, null);
                if (!srs || !srs[id]) return null;
                const n = scheduleWl(srs[id], r);
                // handleFlashcardRate(): updateRT(id, flipMs, rating >= 2) khi mặt trước là chữ Hán
                if (ms != null) rtMix(n, ms, r >= 2);
                srs[id] = n;
                writeJSON(this.key, srs);
                // bumpDaily('r'): state.daily = { d, n, r } trong hsk_wl_json_progress_v2
                const prog = readJSON(this.progKey, {}) || {};
                const k = dayKey();
                if (!prog.daily || prog.daily.d !== k) prog.daily = { d: k, n: 0, r: 0 };
                prog.daily.r = (prog.daily.r || 0) + 1;
                writeJSON(this.progKey, prog);
                return n;
            },
            summary() {
                const srs = readJSON(this.key, {}) || {};
                const prog = readJSON(this.progKey, {}) || {};
                const d = prog.daily && prog.daily.d === dayKey() ? prog.daily : { n: 0, r: 0 };
                patchSummary("word_learning", s => {
                    s.due = countDue(srs);
                    s.today = Object.assign({}, s.today, { n: d.n || 0, r: d.r || 0 });
                });
            },
        },
        my: {
            key: "hoc_mywords_v1",
            list(now) {
                if (!window.HocMyWords) return [];
                return HocMyWords.due(now).map(e => ({ id: e.hz, card: e.card, entry: e }));
            },
            info(id) {
                const e = (window.HocMyWords && HocMyWords.get(id)) || { hz: id };
                return { hz: e.hz, py: e.py || "", vi: e.vi || "", hv: e.hv || "", ex: e.ex || "", exvi: e.exvi || "" };
            },
            schedule: scheduleMy,
            rate(id, r, ms) {
                if (!window.HocMyWords) return null;
                const e = HocMyWords.get(id);
                if (!e || !e.card) return null;
                const rt = e.card.rt;
                const n = scheduleMy(e.card, r);
                if (rt) n.rt = rt;
                if (ms != null) rtMix(n, ms, r >= 3);
                HocMyWords.update(id, { card: n });
                return n;
            },
            summary() {},
        },
    };
    const SRC_KEYS = Object.keys(SOURCES);

    // ====================================================================== Trạng thái trang
    const DEFAULT = { settings: { limit: 50, speak: true }, days: {}, streak: { count: 0, last: "", best: 0 } };
    let S = loadState();
    function loadState() {
        const o = readJSON(STORE, {}) || {};
        const s = Object.assign({}, DEFAULT, o);
        s.settings = Object.assign({}, DEFAULT.settings, o.settings || {});
        if (!s.days || typeof s.days !== "object") s.days = {};
        s.streak = Object.assign({}, DEFAULT.streak, o.streak || {});
        return s;
    }
    function today() {
        const k = dayKey();
        const d = S.days[k] || (S.days[k] = { r: 0, ok: false, steps: {} });
        d.steps = d.steps || {};
        return d;
    }
    function save() {
        S = Object.assign(loadState(), { settings: S.settings, days: S.days, streak: S.streak });
        const keys = Object.keys(S.days).sort();
        while (keys.length > 90) delete S.days[keys.shift()];
        writeJSON(STORE, S);
        writeSummary();
    }
    function currentStreak() {
        const st = S.streak || {};
        return (st.last === dayKey() || st.last === yesterdayKey()) ? (st.count || 0) : 0;
    }
    // Ngày "đạt" khi ôn ≥ 10 thẻ hoặc xong bước 2 / bước 3
    function checkDayOk() {
        const d = today();
        const ok = (d.r || 0) >= STREAK_MIN || !!d.steps.learn || !!d.steps.practice;
        const k = dayKey();
        if (ok && S.streak.last !== k) {
            S.streak.count = S.streak.last === yesterdayKey() ? (S.streak.count || 0) + 1 : 1;
            S.streak.last = k;
            S.streak.best = Math.max(S.streak.best || 0, S.streak.count);
            d.ok = true;
            return true;
        }
        if (ok) d.ok = true;
        return false;
    }
    let lastDueCount = 0;
    function writeSummary() {
        if (!window.HocProgress) return;
        const d = S.days[dayKey()] || { r: 0, steps: {} };
        HocProgress.save("hom_nay", {
            next: "Buổi học hôm nay", nextUrl: "hom_nay/hom_nay.html",
            due: lastDueCount,
            today: { n: 0, r: d.r || 0 },
            streak: currentStreak(),
            steps: Object.assign({}, d.steps),
        });
    }

    // ====================================================================== Gom thẻ đến hạn + gộp trùng
    function dictInfo(hz) {
        const w = DICT.w && DICT.w[hz];
        let hv = w && w[1] ? w[1] : "";
        if (!hv && DICT.c) {          // ghép Hán Việt từng chữ nếu từ không có trong từ điển
            const chars = Array.from(hz).filter(ch => HAN.test(ch));
            const parts = chars.map(ch => DICT.c[ch] && DICT.c[ch][1]);
            if (chars.length && parts.every(Boolean)) hv = parts.join(" ");
        }
        return { py: w ? w[0] : "", hv, vi: w ? w[2] : "" };
    }
    function collectDue(now) {
        now = now || Date.now();
        const groups = new Map();
        SRC_KEYS.forEach(src => {
            let list = [];
            try { list = SOURCES[src].list(now); } catch (e) { console.warn("Không đọc được nguồn " + src, e); }
            list.forEach(({ id, card }) => {
                const inf = SOURCES[src].info(id, card);
                if (!inf.hz || !HAN.test(inf.hz)) return;
                const key = cleanHz(inf.hz);
                let g = groups.get(key);
                if (!g) { g = { key, hz: key, cards: [], info: {} }; groups.set(key, g); }
                g.cards.push({ src, id, card });
                // thông tin hiển thị: lấy giá trị đầu tiên có được theo thứ tự nguồn
                ["py", "vi", "hv", "ex", "exvi"].forEach(f => { if (!g.info[f] && inf[f]) g.info[f] = inf[f]; });
            });
        });
        const out = Array.from(groups.values());
        out.forEach(g => {
            g.cards.sort((a, b) => SRC[a.src].order - SRC[b.src].order);
            const di = dictInfo(g.hz);
            g.py = g.info.py || di.py;
            g.vi = g.info.vi || di.vi;
            g.hv = g.info.hv || di.hv;
            g.minDue = Math.min.apply(null, g.cards.map(c => c.card.due || 0));
            g.lapses = Math.max.apply(null, g.cards.map(c => (c.card.lapses || 0) + (c.card.wrong || 0)));
        });
        // Quá hạn lâu trước (theo ngày), cùng mức thì hay quên trước
        out.sort((a, b) => {
            const oa = Math.floor((now - a.minDue) / DAY), ob = Math.floor((now - b.minDue) / DAY);
            return (ob - oa) || (b.lapses - a.lapses) || (a.minDue - b.minDue);
        });
        return out;
    }

    // Câu ví dụ: của chính thẻ (Từ của tôi / câu của id trong LT_DATA), không có thì tìm câu chứa từ
    let SENT_BY_OWNER = null;
    function sentIndex() {
        if (SENT_BY_OWNER) return SENT_BY_OWNER;
        SENT_BY_OWNER = new Map();
        const add = arr => (arr || []).forEach(s => { if (!SENT_BY_OWNER.has(s[0])) SENT_BY_OWNER.set(s[0], s); });
        add(LT.sents);
        if (window.LT_DATA_WL) add(window.LT_DATA_WL.sents);
        return SENT_BY_OWNER;
    }
    function exampleFor(g) {
        if (g.info.ex) return { zh: g.info.ex, py: "", vi: g.info.exvi || "" };
        const idx = sentIndex();
        for (const c of g.cards) {
            const s = idx.get(c.id);
            if (s) return { zh: s[1].replace(/\|/g, ""), py: s[2], vi: s[3] };
        }
        if (g.hz.length >= 1) {
            const all = LT.sents;
            for (let i = 0; i < all.length; i++) {
                const zh = all[i][1].replace(/\|/g, "");
                if (zh.indexOf(g.hz) >= 0 && zh.length <= 30) return { zh, py: all[i][2], vi: all[i][3] };
            }
        }
        return null;
    }
    let wlLoading = null;
    function ensureWLSents() {        // câu ví dụ của HSK 3.0 (1,8MB) — chỉ nạp khi có thẻ HSK 3.0 trong phiên
        if (window.LT_DATA_WL) return Promise.resolve();
        if (wlLoading) return wlLoading;
        wlLoading = new Promise(resolve => {
            const s = document.createElement("script");
            s.src = "../luyen_tap/lt_data_wl.js";
            s.onload = () => { SENT_BY_OWNER = null; resolve(); };
            s.onerror = () => resolve();
            document.head.appendChild(s);
        });
        return wlLoading;
    }

    // ====================================================================== Phát âm
    let zhVoice = null;
    function pickVoice() {
        if (!("speechSynthesis" in window)) return;
        const vs = speechSynthesis.getVoices();
        zhVoice = vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
    }
    if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
    function speak(text) {
        if (!("speechSynthesis" in window) || !text) return;
        try {
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = "zh-CN";
            if (zhVoice) u.voice = zhVoice;
            u.rate = 0.85;
            speechSynthesis.speak(u);
        } catch (e) {}
    }

    // ====================================================================== Phiên ôn tập
    let session = null;
    function startReview() {
        const all = collectDue();
        if (!all.length) { toast("Không còn thẻ nào đến hạn. Tuyệt vời!"); renderHome(); return; }
        const limit = +S.settings.limit || 0;
        const groups = limit ? all.slice(0, limit) : all;
        session = {
            queue: groups.map(g => ({ g, again: false })),
            total: groups.length, done: 0, rated: 0,
            stats: { 1: 0, 2: 0, 3: 0, 4: 0 },
            remainAfter: all.length - groups.length,
            flipped: false, t0: 0, ms: 0,
        };
        if (groups.some(g => g.cards.some(c => c.src === "wl"))) ensureWLSents();
        document.body.classList.add("in-review");
        show("review");
        renderCard();
    }
    function curItem() { return session && session.queue[0]; }
    function renderCard() {
        const s = session;
        if (!s.queue.length) { finishReview(); return; }
        const it = s.queue[0], g = it.g;
        s.flipped = false;
        $("prog-bar").style.width = (s.done / s.total * 100) + "%";
        $("prog-text").textContent = Math.min(s.done + 1, s.total) + "/" + s.total;
        $("fc-src").innerHTML = uniqSrc(g).map(src => `<span class="s-${src}">${esc(SRC[src].name)}</span>`).join("");
        $("fc-again").hidden = !it.again;
        $("fc-hz").textContent = g.hz;
        $("fc-back").hidden = true;
        $("fcard").classList.remove("flipped");
        $("fc-hint").hidden = false;
        $("btn-flip").hidden = false;
        $("rate-row").hidden = true;
        s.t0 = performance.now();
        window.scrollTo(0, 0);
    }
    function uniqSrc(g) { return Array.from(new Set(g.cards.map(c => c.src))); }
    function flip() {
        const s = session;
        if (!s || s.flipped || !s.queue.length) return;
        s.flipped = true;
        s.ms = performance.now() - s.t0;
        const g = s.queue[0].g;
        $("fc-py").textContent = g.py || "";
        $("fc-hv").textContent = g.hv ? g.hv.toUpperCase() : "";
        $("fc-vi").textContent = g.vi || "";
        const ex = exampleFor(g);
        if (ex) {
            const zh = esc(ex.zh).split(esc(g.hz)).join(`<mark>${esc(g.hz)}</mark>`);
            $("fc-ex").innerHTML = `<button class="say" data-say="${esc(ex.zh)}" title="Nghe câu ví dụ">🔊</button>
                <div class="zh">${zh}</div>${ex.py ? `<div class="py">${esc(ex.py)}</div>` : ""}${ex.vi ? `<div class="vi">${esc(ex.vi)}</div>` : ""}`;
        } else $("fc-ex").innerHTML = "";
        $("fc-back").hidden = false;
        $("fcard").classList.add("flipped");
        $("btn-flip").hidden = true;
        $("rate-row").hidden = false;
        // khoảng ôn kế tiếp: theo thẻ chính (nguồn đầu tiên) của nhóm
        const main = g.cards[0];
        const sched = SOURCES[main.src].schedule;
        const live = freshCard(main) || main.card;
        for (let r = 1; r <= 4; r++) $("iv-" + r).textContent = ivText(sched(Object.assign({ ef: 2.5, iv: 0, reps: 0, lapses: 0 }, live), r).iv);
        if (S.settings.speak) speak(g.hz);
    }
    // Đọc lại thẻ mới nhất từ localStorage (thẻ có thể vừa đổi sau một lần chấm "Quên")
    function freshCard(c) {
        try {
            if (c.src === "hsk") return (readJSON("hsk_lotrinh_v1", {}).srs || {})[c.id];
            if (c.src === "boya") return (readJSON("boya_learning_progress_v2", {}).srs || {})[c.id];
            if (c.src === "tv") return (readJSON("boya_tv_srs", {}) || {})[c.id];
            if (c.src === "wl") return (readJSON("hsk_wl_srs_v3", {}) || {})[c.id];
            if (c.src === "my") { const e = window.HocMyWords && HocMyWords.get(c.id); return e && e.card; }
        } catch (e) {}
        return null;
    }
    function rate(r) {
        const s = session;
        if (!s || !s.flipped || !s.queue.length) return;
        const it = s.queue.shift();
        const ms = it.again ? null : s.ms;      // chỉ đo tốc độ ở lần hỏi đầu (giống hsk_lotrinh)
        const touched = new Set();
        it.g.cards.forEach(c => {
            try {
                const n = SOURCES[c.src].rate(c.id, r, ms);
                if (n) { c.card = n; touched.add(c.src); }
            } catch (e) { console.error("Không ghi được thẻ", c, e); }
        });
        touched.forEach(src => SOURCES[src].summary());
        s.rated++;
        if (!it.again) { s.stats[r]++; s.done++; }
        if (r === 1) s.queue.push({ g: it.g, again: true });      // Quên: hỏi lại cuối hàng đợi trong phiên
        const d = today();
        d.r = (d.r || 0) + 1;
        if (checkDayOk()) toast(`🔥 Chuỗi ngày học: ${S.streak.count} ngày!`);
        save();
        renderCard();
    }
    function finishReview(quit) {
        const s = session;
        if (!s) return;
        document.body.classList.remove("in-review");
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        const remain = collectDue();
        lastDueCount = remain.length;
        if (!quit || !remain.length) { today().steps.review = true; }
        checkDayOk();
        save();
        const t = s.stats[1] + s.stats[2] + s.stats[3] + s.stats[4];
        const pct = t ? Math.round((s.stats[3] + s.stats[4]) / t * 100) : 0;
        $("res-score").textContent = t ? pct + "%" : "–";
        $("res-title").textContent = !t ? "Chưa ôn thẻ nào" : quit && remain.length ? "Đã dừng phiên ôn" : "Xong phần ôn tập!";
        $("res-sub").innerHTML = t
            ? `Đã ôn <b>${fmt(t)}</b> thẻ, nhớ được <b>${pct}%</b>. ${remain.length ? `Còn <b>${fmt(remain.length)}</b> thẻ đến hạn.` : "Không còn thẻ nào đến hạn."}`
            : "Bạn có thể quay lại ôn bất cứ lúc nào.";
        $("res-stats").innerHTML = [
            [s.stats[1], "Quên"], [s.stats[2], "Khó"], [s.stats[3] + s.stats[4], "Nhớ / Dễ"], ["🔥 " + currentStreak(), "ngày liên tiếp"],
        ].map(x => `<div><b>${x[0]}</b><span>${x[1]}</span></div>`).join("");
        const st = stepState();
        const acts = [];
        if (remain.length) acts.push(`<button class="btn ${st.learn.done && st.practice.done ? "btn-primary" : ""}" id="res-more">🔁 Ôn tiếp (${fmt(remain.length)})</button>`);
        if (!st.learn.done && st.learn.items.length) {
            const n = st.learn.items[0];
            acts.unshift(`<a class="btn btn-primary" href="${esc(n.url)}">Bước 2 · ▶ ${esc(n.label)}</a>`);
        } else if (!st.practice.done) {
            acts.unshift(`<a class="btn btn-primary" href="../luyen_tap/luyen_tap.html">Bước 3 · ✍️ Luyện tập 10 phút</a>`);
        }
        acts.push(`<button class="btn" id="res-home">Về buổi học hôm nay</button>`);
        $("res-actions").innerHTML = acts.join("");
        if ($("res-more")) $("res-more").onclick = startReview;
        $("res-home").onclick = () => { session = null; show("home"); };
        session = null;
        show("done");
    }

    // ====================================================================== Bước 2 & 3 (đọc tiến độ các trang)
    // Giống index.html: tổng số bài mỗi nhóm khi trang con chưa ghi tóm tắt
    const DEFAULTS = {
        hsk1: { label: "HSK 1", total: 15 }, hsk2: { label: "HSK 2", total: 15 }, hsk3: { label: "HSK 3", total: 30 },
        hsk4: { label: "HSK 4", total: 40 }, hsk5: { label: "HSK 5", total: 65 }, hsk6: { label: "HSK 6", total: 126 },
        tc1: { label: "Chuẩn Trung cấp 1", total: 16 }, tc2: { label: "Chuẩn Trung cấp 2", total: 16 },
        tc3: { label: "Trung cấp 1", total: 12 }, tc4: { label: "Trung cấp 2", total: 10 },
        gc1: { label: "Cao cấp 1", total: 10 }, gc2: { label: "Cao cấp 2", total: 10 },
    };
    const STAGES = [
        { title: "Nền tảng", tracks: ["hsk1", "hsk2", "hsk3"] },
        { title: "Trung cấp nền", tracks: ["tc1", "tc2", "hsk4"] },
        { title: "Trung cấp nâng cao", tracks: ["tc3", "tc4", "hsk5"] },
        { title: "Cao cấp", tracks: ["gc1", "gc2", "hsk6"] },
    ];
    function summaryToday(page) {      // bản tóm tắt chỉ có giá trị "hôm nay" nếu được ghi trong hôm nay
        const s = window.HocProgress ? HocProgress.load(page) : null;
        return s && s.at && dayKey(s.at) === dayKey() ? (s.today || {}) : {};
    }
    function newWordsToday() {
        const k = dayKey();
        const hs = readJSON("hsk_lotrinh_v1", {}) || {};
        const bl = readJSON("boya_learning_progress_v2", {}) || {};
        const tv = readJSON("boya_tv_days", {}) || {};
        const wp = readJSON("hsk_wl_json_progress_v2", {}) || {};
        const raw = {
            hsk_lotrinh: ((hs.days || {})[k] || {}).n || 0,
            boya_learning: (((bl.days || {})[k] || {}).n || 0) + (((bl.days || {})[k] || {}).c || 0),
            tuvung: (tv[k] || {}).n || 0,
            word_learning: wp.daily && wp.daily.d === k ? (wp.daily.n || 0) : 0,
        };
        let total = 0;
        Object.keys(raw).forEach(p => { total += Math.max(raw[p], summaryToday(p).n || 0); });
        return total;
    }
    function practiceToday() {
        const lt = readJSON("luyen_tap_v1", {}) || {};
        const d = (lt.days || {})[dayKey()] || {};
        return Math.max(d.n || 0, summaryToday("luyen_tap").n || 0);
    }
    function nextLessons() {
        const P = window.HocProgress ? HocProgress.all() : {};
        const hsk = P.hsk_lotrinh || {}, boya = P.boya_learning || {};
        function group(key) {
            const isHsk = key.indexOf("hsk") === 0;
            const src = (isHsk ? hsk.groups : boya.groups) || {};
            const g = Object.assign({}, DEFAULTS[key], src[key] || {});
            g.key = key; g.isHsk = isHsk;
            g.done = Math.min(g.done || 0, g.total || 0);
            g.pct = g.total ? Math.round(g.done / g.total * 100) : 0;
            g.color = isHsk ? `var(--ui-hsk-${key.slice(3)})` : `var(--ui-book-${key})`;
            g.url = isHsk ? `hsk_lotrinh/hsk_lotrinh.html?level=${key.slice(3)}` : `boya_learning/boya_learning.html?book=${key}`;
            return g;
        }
        const stages = STAGES.map((s, i) => {
            const gs = s.tracks.map(group);
            const done = gs.reduce((a, g) => a + g.done, 0), total = gs.reduce((a, g) => a + (g.total || 0), 0);
            return { n: i + 1, title: s.title, gs, complete: total > 0 && done >= total };
        });
        let curIdx = stages.findIndex(s => !s.complete);
        if (curIdx < 0) curIdx = stages.length - 1;
        const cur = stages[curIdx];
        function nextFor(g) {
            const src = g.isHsk ? hsk : boya;
            if (src.next && src.nextUrl && (g.isHsk ? src.nextUrl.indexOf("level=" + g.key.slice(3)) >= 0 : src.nextUrl.indexOf("book=" + g.key) >= 0))
                return { label: src.next, url: src.nextUrl };
            return { label: g.done ? `${g.label} · Bài ${g.done + 1}` : `${g.label} · Bài 1`, url: g.url };
        }
        const pending = cur.gs.filter(g => g.done < g.total);
        const picks = [pending.find(g => !g.isHsk), pending.find(g => g.isHsk)].filter(Boolean);
        return {
            stage: cur,
            items: picks.map(g => {
                const n = nextFor(g);
                return { label: n.label, url: "../" + n.url, kind: g.isHsk ? "Từ vựng" : "Bài khóa", pct: g.pct, color: g.color };
            }),
        };
    }
    function stepState() {
        const d = S.days[dayKey()] || { steps: {} };
        const steps = d.steps || {};
        const nl = nextLessons();
        const newN = newWordsToday();
        const prN = practiceToday();
        return {
            review: { done: !!steps.review },
            learn: { done: newN > 0 || !!steps.learn, n: newN, items: nl.items, stage: nl.stage },
            practice: { done: prN >= 10 || !!steps.practice, n: prN },
        };
    }

    // ====================================================================== Màn hình chính
    function show(view) {
        ["home", "review", "done"].forEach(v => { $(v).hidden = v !== view; });
        window.scrollTo(0, 0);
        if (view === "home") renderHome();
    }
    function renderHome() {
        const due = collectDue();
        lastDueCount = due.length;
        const st = stepState();
        // ghi nhận bước 2/3 vừa xong ở trang khác
        const d = today();
        let changed = false;
        if (!due.length && !d.steps.review && (d.r || 0) > 0) { d.steps.review = true; changed = true; }
        if (st.learn.done && !d.steps.learn) { d.steps.learn = true; changed = true; }
        if (st.practice.done && !d.steps.practice) { d.steps.practice = true; changed = true; }
        if (checkDayOk()) changed = true;
        save();
        const reviewDone = !due.length || !!d.steps.review;
        const flags = [reviewDone, st.learn.done, st.practice.done];
        const curStep = flags.indexOf(false);

        // Đầu trang
        const now = new Date();
        const wd = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"][now.getDay()];
        $("hero-date").textContent = `${wd}, ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
        const nDone = flags.filter(Boolean).length;
        $("hero-title").textContent = nDone === 3 ? "🎉 Xong buổi học hôm nay!" : "Buổi học hôm nay";
        $("hero-note").textContent = nDone === 3
            ? "Bạn đã làm đủ 3 bước. Có thể ôn thêm hoặc học thêm nếu còn thời gian."
            : `Đã xong ${nDone}/3 bước · khoảng 30–45 phút: ôn tập → học bài mới → luyện tập.`;
        $("day-bar").style.width = Math.round(nDone / 3 * 100) + "%";
        const sk = currentStreak();
        $("streak-n").textContent = sk;
        $("streak").classList.toggle("cold", !(S.streak.last === dayKey()));

        // Bước 1
        ["step-review", "step-learn", "step-practice"].forEach((id, i) => {
            $(id).classList.toggle("done", flags[i]);
            $(id).classList.toggle("current", i === curStep);
            $(id).querySelector(".step-num").textContent = flags[i] ? "✓" : i + 1;
        });
        const bySrc = {};
        let cards = 0;
        due.forEach(g => uniqSrc(g).forEach(src => { bySrc[src] = (bySrc[src] || 0) + 1; }));
        due.forEach(g => { cards += g.cards.length; });
        setTag("review-tag", reviewDone, due.length ? `${fmt(due.length)} từ` : "Không còn thẻ");
        const todayR = d.r || 0;
        $("review-note").innerHTML = due.length
            ? `Có <b>${fmt(due.length)}</b> từ đến hạn${cards > due.length ? ` (${fmt(cards)} thẻ, từ trùng giữa các trang chỉ hỏi một lần)` : ""}.`
              + (todayR ? ` Hôm nay đã ôn ${fmt(todayR)} lượt.` : "") + " Từ quá hạn lâu và hay quên được hỏi trước."
            : todayR ? `Đã ôn ${fmt(todayR)} lượt hôm nay. Không còn thẻ nào đến hạn.` : "Không có thẻ nào đến hạn hôm nay. Hãy sang bước 2.";
        $("review-src").innerHTML = SRC_KEYS.filter(k => bySrc[k]).map(k => `<span class="src-chip">${esc(SRC[k].name)}<b>${fmt(bySrc[k])}</b></span>`).join("");
        $("btn-review").hidden = !due.length;
        const lim = +S.settings.limit || 0;
        $("btn-review").textContent = reviewDone && due.length ? `🔁 Ôn tiếp (${fmt(due.length)})` : `▶ Bắt đầu ôn${lim && due.length > lim ? ` ${lim} thẻ` : ""}`;
        $("opt-limit").value = String(lim);
        $("opt-speak").checked = !!S.settings.speak;

        // Bước 2
        setTag("learn-tag", st.learn.done, st.learn.done ? `${fmt(st.learn.n)} từ mới` : "Chưa học");
        $("learn-note").textContent = st.learn.items.length
            ? `Chặng ${st.learn.stage.n} · ${st.learn.stage.title}. ${st.learn.done ? "Hôm nay bạn đã học từ mới. Có thể học thêm:" : "Học một bài khóa Boya và/hoặc một bài từ vựng HSK, làm bài kiểm tra cho đến khi đạt."}`
            : "🎉 Bạn đã hoàn thành toàn bộ lộ trình! Có thể học thêm ở Giáo trình HSK 3.0.";
        $("learn-list").innerHTML = st.learn.items.map(n => `
            <a class="lesson" href="${esc(n.url)}" style="--c:${n.color}">
                <span><b>${esc(n.label)}</b><small>${n.kind} · đã xong ${n.pct}%</small></span>
                <span class="go">Học ▶</span>
            </a>`).join("") || `<a class="lesson" href="../word_learning/word_learning.html"><span><b>Giáo trình HSK 3.0</b><small>8 quyển · 368 bài</small></span><span class="go">Mở ▶</span></a>`;

        // Bước 3
        setTag("practice-tag", st.practice.done, st.practice.n ? `${fmt(st.practice.n)}/10 câu` : "0/10 câu");
        $("btn-practice").className = "btn" + (curStep === 2 ? " btn-primary" : "");
        if (changed) writeSummary();
    }
    function setTag(id, ok, text) {
        const el = $(id);
        el.className = "tag " + (ok ? "ok" : "todo");
        el.textContent = (ok ? "✓ " : "") + text;
    }

    // ====================================================================== Sự kiện
    $("btn-review").onclick = startReview;
    $("opt-limit").onchange = e => { S.settings.limit = +e.target.value; save(); renderHome(); };
    $("opt-speak").onchange = e => { S.settings.speak = e.target.checked; save(); };
    $("btn-flip").onclick = flip;
    $("fcard").addEventListener("click", e => {
        const say = e.target.closest("[data-say]");
        if (say) { e.stopPropagation(); speak(say.dataset.say); return; }
        if (e.target.closest("#fc-say")) { e.stopPropagation(); const it = curItem(); if (it) speak(it.g.hz); return; }
        flip();
    });
    $("rate-row").addEventListener("click", e => { const b = e.target.closest("[data-rate]"); if (b) rate(+b.dataset.rate); });
    $("btn-quit").onclick = () => { if (session) finishReview(true); };
    document.addEventListener("keydown", e => {
        if (!session || $("review").hidden) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = e.target && e.target.tagName;
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (!session.flipped) flip(); else if (e.key === " ") { const it = curItem(); if (it) speak(it.g.hz); }
        } else if (/^[1-4]$/.test(e.key) && session.flipped) { e.preventDefault(); rate(+e.key); }
        else if (e.key === "Escape") finishReview(true);
        else if (e.key === "r" || e.key === "R") { const it = curItem(); if (it) speak(it.g.hz); }
    });

    let toastTimer;
    function toast(msg) {
        const t = $("toast");
        t.textContent = msg; t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
    }

    // Quay lại tab (vd sau khi học ở trang khác): vẽ lại checklist
    document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("home").hidden) renderHome(); });

    show("home");
    // test tự động có thể dùng
    window.__HN = { collectDue, startReview, flip, rate, finishReview, stepState, state: () => S, session: () => session, SOURCES };
})();
