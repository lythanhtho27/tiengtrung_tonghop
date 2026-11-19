/* ==========================================================================
   BUỔI HỌC HÔM NAY — gom cả buổi học hằng ngày vào một trang
   Bước 1. Ôn tập đến hạn: gom thẻ đến hạn từ MỌI nguồn SRS trong localStorage, ôn kiểu flashcard
           và ghi kết quả ngược lại đúng key, đúng thẻ, bằng công thức schedule của chính trang đó:
             hsk      hsk_lotrinh_v1.srs[id]            id "3-帮忙"   (hsk_lotrinh/hsk_lotrinh.js)
             boya     boya_learning_progress_v2.srs[id] id "tc1_3_5"  (boya_learning/boya_learning.js)
             tv       boya_tv_srs[id] + boya_tv_days    id "tc1_3_5"  (tuvung/tuvung.js)
             wl       hsk_wl_srs_v3[id] + hsk_wl_json_progress_v2.daily, id "L1-0001" (word_learning/word_learning.js)
             my       hoc_mywords_v1 qua API shared/mywords.js (HocMyWords)
             sent     hoc_sentences_v1 qua API shared/sentences.js (HocSentences) — thẻ "✂️ Câu của tôi" (điền từ),
                      KHÔNG gộp với thẻ từ, mỗi câu là một lượt hỏi riêng
           Cùng chữ Hán (đã bỏ chú thích ngoặc) đến hạn ở nhiều nguồn -> chỉ hỏi MỘT lần,
           điểm chấm áp dụng cho mọi thẻ đó (mỗi thẻ theo schedule của nguồn mình).
   Bước 2. Học bài mới: 1–2 bài nên học tiếp của chặng hiện tại (logic chặng giống index.html).
   Bước 3. Đọc 1 bài: gợi ý từ doc_them/doc_index.js (nạp lười) + tiến độ doc_them_v1.read[id] = {done, at, rr[]}:
           chương kế của bộ truyện đang đọc dở, bài đến hạn đọc lại (quy tắc rr giống doc_them: 1 lần → +3 ngày,
           2 lần → +7 ngày, ≥ 3 lần thôi nhắc), 1–2 bài "vừa sức" (% từ đã biết 90–95%).
           Xong khi hôm nay đọc xong ít nhất một bài (rr hoặc at thuộc hôm nay).
   - Hiển thị: luyen_tap/lt_data.js (LT_DATA.words[id] = [hz, py, nghĩa], LT_DATA.sents),
     shared/dict_vi.js (HOC_DICT.w[hz] = [py, HV, nghĩa], HOC_DICT.c[chữ] = [py, HV]).
   - Kiểu thẻ ôn (settings.cardMode): "mix" (trộn 50/30/20, thẻ reps ≤ 1 luôn là Chữ → nghĩa) / "hz" Chữ → nghĩa /
     "vi" Nghĩa → chữ / "listen" Nghe → nghĩa. Chỉ đo rt ở kiểu Chữ → nghĩa (lần hỏi đầu).
   - Mặt sau thẻ: mỗi chữ có data-zizu (bảng Họ chữ, shared/zizu.js) + ghi chú gợi nhớ (shared/notes.js, HocNotes).
   - Từ cứng đầu: số lần quên max(lapses, wrong) của một thẻ ≥ HARD_MIN ở bất kỳ nguồn nào (gộp theo chữ Hán,
     lấy giá trị lớn nhất giữa các nguồn để không đếm trùng một lần quên đã ghi vào nhiều nguồn).
     "Luyện riêng" = phiên ôn bất kể hạn, KHÔNG ghi gì vào lịch SRS / bộ đếm ngày.
   - Lưu: "hom_nay_v1" = { settings{limit, speak, cardMode}, days{date:{r, ok, steps}}, streak } (đồng bộ qua sync.js),
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
    const HARD_MIN = 4;             // quên ≥ 4 lần -> "từ cứng đầu"
    const HARD_SHOW = 8;            // số từ cứng đầu hiện sẵn trên trang chính
    const MODES = { hz: "Chữ → nghĩa", vi: "Nghĩa → chữ", listen: "Nghe → nghĩa" };
    const SRC = {
        hsk:  { name: "HSK",        order: 0 },
        boya: { name: "Boya",       order: 1 },
        tv:   { name: "Boya TC",    order: 2 },
        wl:   { name: "HSK 3.0",    order: 3 },
        my:   { name: "Từ của tôi", order: 4 },
    };
    const SENT_LABEL = "Câu của tôi";
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
    // Cấp HSK đang tạm ẩn khỏi buổi ôn (settings.skipLv): thẻ giữ nguyên lịch, chỉ không hỏi ở trang này
    function hskLevelOf(id) { return parseInt(id, 10) || 0; }
    function hskSkipped(id) {
        const s = S && S.settings && S.settings.skipLv;
        return !!(s && s.length && s.indexOf(hskLevelOf(id)) >= 0);
    }
    // Số thẻ HSK đến hạn theo từng cấp (tính cả cấp đang ẩn)
    function hskDueByLevel(now) {
        const srs = (readJSON("hsk_lotrinh_v1", {}) || {}).srs || {}, out = {};
        for (const id in srs) {
            const c = srs[id];
            if (c && c.due <= now && LT.words[id]) { const lv = hskLevelOf(id); out[lv] = (out[lv] || 0) + 1; }
        }
        return out;
    }

    const SOURCES = {
        hsk: {
            key: "hsk_lotrinh_v1",
            list(now) {
                const S = readJSON(this.key, null);
                const srs = (S && S.srs) || {};
                return Object.keys(srs).filter(id => srs[id] && srs[id].due <= now && !hskSkipped(id)).map(id => ({ id, card: srs[id] }));
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
    const DEFAULT = { settings: { limit: 50, speak: true, cardMode: "mix", skipLv: [], readGoal: 3 }, days: {}, streak: { count: 0, last: "", best: 0 } };
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
    // Ngày "đạt" khi ôn ≥ 10 thẻ hoặc xong bước 2 (bài mới) / bước 3 (đọc)
    function checkDayOk() {
        const d = today();
        const ok = (d.r || 0) >= STREAK_MIN || !!d.steps.learn || !!d.steps.read || readCountToday() > 0;
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
    // Gom thẻ có due <= now của mọi nguồn, gộp theo chữ Hán (now = Infinity: mọi thẻ)
    function gatherGroups(now) {
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
            g.forgot = Math.max.apply(null, g.cards.map(c => forgotCount(c.card)));
        });
        return out;
    }
    // Số lần quên của một thẻ: lapses (SM-2) hoặc wrong (sổ lỗi boya_tv), lấy giá trị lớn hơn vì một lần sai tăng cả hai
    function forgotCount(c) { return Math.max((c && c.lapses) || 0, (c && c.wrong) || 0); }
    function collectDue(now) {
        now = now || Date.now();
        const out = gatherGroups(now);
        // Quá hạn lâu trước (theo ngày), cùng mức thì hay quên trước
        out.sort((a, b) => {
            const oa = Math.floor((now - a.minDue) / DAY), ob = Math.floor((now - b.minDue) / DAY);
            return (ob - oa) || (b.lapses - a.lapses) || (a.minDue - b.minDue);
        });
        return out;
    }
    // Từ cứng đầu: mọi thẻ (bất kể hạn) có số lần quên ≥ HARD_MIN
    function collectHard() {
        const out = gatherGroups(Infinity).filter(g => g.forgot >= HARD_MIN);
        out.sort((a, b) => (b.forgot - a.forgot) || (a.minDue - b.minDue));
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
    function speak(text, rate) {
        if (!("speechSynthesis" in window) || !text) return;
        try {
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = "zh-CN";
            if (zhVoice) u.voice = zhVoice;
            u.rate = rate || 0.85;
            speechSynthesis.speak(u);
        } catch (e) {}
    }

    // Lật thẻ: đọc từ + câu ví dụ qua HocTTS.speakWord (shared/tts.js, tắt được trong hộp chọn giọng)
    function speakCard(word, exZh) {
        if (window.HocTTS && HocTTS.speakWord) HocTTS.speakWord(word, exZh, { rate: 0.85 });
        else if (word) speak(word);
    }

    // ====================================================================== Phiên ôn tập
    let session = null;
    let hardMap = new Map();         // chữ Hán -> số lần quên (để gắn nhãn 🧠 trên thẻ ôn thường)
    // "✂️ Câu của tôi" đến hạn (shared/sentences.js), câu quá hạn lâu trước
    function sentDue(now) {
        if (!window.HocSentences) return [];
        try {
            return HocSentences.due(now || Date.now())
                .filter(e => e && e.zh && e.target && e.card)
                .sort((a, b) => (a.card.due || 0) - (b.card.due || 0));
        } catch (e) { console.warn("Không đọc được Câu của tôi", e); return []; }
    }
    // Trộn thẻ câu vào giữa thẻ từ (rải đều) để phiên không dồn câu về cuối
    function mixQueue(groups, sents) {
        const q = groups.map(g => ({ g, again: false }));
        if (!sents.length) return q;
        const step = Math.max(1, Math.floor((q.length + sents.length) / sents.length));
        sents.forEach((e, i) => q.splice(Math.min(q.length, i * step + Math.floor(step / 2)), 0, { sent: e, again: false }));
        return q;
    }
    function newSession(groups, practice, remainAfter, sents) {
        hardMap = new Map(collectHard().map(g => [g.key, g.forgot]));
        sents = sents || [];
        session = {
            queue: mixQueue(groups, sents),
            total: groups.length + sents.length, done: 0, rated: 0,
            stats: { 1: 0, 2: 0, 3: 0, 4: 0 },
            remainAfter: remainAfter || 0,
            practice: !!practice,
            flipped: false, t0: 0, ms: 0,
        };
        if (groups.some(g => g.cards.some(c => c.src === "wl"))) ensureWLSents();
        document.body.classList.add("in-review");
        $("practice-note").hidden = !practice;
        show("review");
        renderCard();
    }
    function startReview() {
        const all = collectDue();
        const sAll = sentDue();
        if (!all.length && !sAll.length) { toast("Không còn thẻ nào đến hạn. Tuyệt vời!"); renderHome(); return; }
        const limit = +S.settings.limit || 0;
        let groups = all, sents = sAll;
        if (limit && all.length + sAll.length > limit) {
            // câu chiếm tối đa ~30% phiên, phần còn thừa của bên này nhường cho bên kia
            let ns = Math.min(sAll.length, Math.max(1, Math.round(limit * 0.3)));
            let nw = Math.min(all.length, limit - ns);
            ns = Math.min(sAll.length, limit - nw);
            groups = all.slice(0, nw); sents = sAll.slice(0, ns);
        }
        newSession(groups, false, all.length + sAll.length - groups.length - sents.length, sents);
    }
    // Luyện riêng từ cứng đầu: bất kể hạn, không ghi vào lịch SRS
    function startPractice() {
        const groups = collectHard();
        if (!groups.length) { toast("Chưa có từ cứng đầu nào."); return; }
        newSession(groups, true, 0);
    }
    function curItem() { return session && session.queue[0]; }
    // Chọn kiểu thẻ cho một lượt hỏi
    function pickMode(g) {
        let m = S.settings.cardMode || "mix";
        if (m === "mix") {
            const reps = Math.min.apply(null, g.cards.map(c => (c.card && c.card.reps) || 0));
            if (reps <= 1) m = "hz";                       // thẻ mới học: nhận diện chữ trước
            else { const x = Math.random(); m = x < 0.5 ? "hz" : x < 0.8 ? "vi" : "listen"; }
        }
        if (!MODES[m]) m = "hz";
        if (m === "vi" && !meaningOnly(g.vi)) m = "hz";                 // không có nghĩa thì không hỏi ngược được
        if (m === "listen" && !("speechSynthesis" in window)) m = "hz";
        return m;
    }
    // Nghĩa để hỏi ở kiểu Nghĩa → chữ: bỏ phần Hán Việt viết hoa ở đầu (dữ liệu Boya: "THƯƠNG TRƯỜNG (chợ, thị trường)")
    function meaningOnly(vi) {
        const t = String(vi || "").trim();
        let m = /^\p{Lu}+(?:[\s-]+\p{Lu}+)*\s*\((.*)\)\s*$/u.exec(t);
        if (m) return m[1].trim();
        m = /^\p{Lu}{2,}(?:[\s-]+\p{Lu}+)*\s*[:：\-–]\s*(.+)$/u.exec(t);
        if (m) return m[1].trim();
        return /^[\p{Lu}\s-]+$/u.test(t) ? "" : t;      // chỉ có Hán Việt -> không dùng làm câu hỏi
    }
    function zizuHTML(hz) {
        return Array.from(hz).map(ch => HAN.test(ch) ? `<span class="zz-ch" data-zizu="${esc(ch)}">${esc(ch)}</span>` : esc(ch)).join("");
    }
    function frontHTML(g, mode) {
        if (mode === "vi") {
            const n = Array.from(g.hz).filter(ch => HAN.test(ch)).length;
            return `<div class="fc-q-vi">${esc(meaningOnly(g.vi))}</div>
                <div class="fc-q-sub">${n} chữ Hán · nhớ chữ và pinyin rồi lật thẻ</div>
                <button class="btn btn-sm hint-btn" type="button" data-hint>💡 Gợi ý</button>
                <div class="fc-hintbox" id="fc-hintbox" hidden></div>`;
        }
        if (mode === "listen") {
            return `<button class="say-big" type="button" data-say-word title="Nghe lại" aria-label="Nghe lại">🔊</button>
                <div class="listen-row">
                    <button class="btn btn-sm" type="button" data-say-word>🔁 Nghe lại</button>
                    <button class="btn btn-sm" type="button" data-say-slow>🐢 Chậm</button>
                </div>
                <div class="fc-q-sub">Nghe rồi nhớ nghĩa và mặt chữ, sau đó lật thẻ</div>`;
        }
        return `<div class="fc-hz">${esc(g.hz)}</div>
            <button class="say" id="fc-say" type="button" title="Nghe phát âm" aria-label="Nghe phát âm">🔊</button>`;
    }
    const HINTS = { hz: "Nhớ nghĩa rồi chạm vào thẻ hoặc nhấn <kbd>Space</kbd> để lật",
        vi: "Nhớ chữ Hán + pinyin rồi chạm vào thẻ hoặc nhấn <kbd>Space</kbd> để lật",
        listen: "Nhớ nghĩa rồi chạm vào thẻ hoặc nhấn <kbd>Space</kbd> để lật · <kbd>R</kbd> nghe lại" };
    function hardCount(g) { return Math.max(hardMap.get(g.key) || 0, g.forgot || 0); }
    function renderCard() {
        const s = session;
        if (!s.queue.length) { finishReview(); return; }
        const it = s.queue[0], g = it.g;
        s.flipped = false;
        $("prog-bar").style.width = (s.done / s.total * 100) + "%";
        $("prog-text").textContent = Math.min(s.done + 1, s.total) + "/" + s.total;
        if (it.sent) { renderSentCard(it); return; }
        if (!it.mode) it.mode = pickMode(g);
        $("fc-mode").textContent = MODES[it.mode];
        $("fc-mode").className = "fc-mode m-" + it.mode;
        $("fc-src").innerHTML = uniqSrc(g).map(src => `<span class="s-${src}">${esc(SRC[src].name)}</span>`).join("");
        $("fc-again").hidden = !it.again;
        const hc = hardCount(g);
        $("fc-hard").hidden = hc < HARD_MIN;
        $("fc-hard").textContent = "🧠 Cứng đầu";
        $("fc-hard").title = `Đã quên ${hc} lần`;
        $("fc-front").className = "fc-front m-" + it.mode;
        $("fc-front").innerHTML = frontHTML(g, it.mode);
        $("fc-back").hidden = true;
        $("fcard").classList.remove("flipped");
        $("fc-hint").innerHTML = HINTS[it.mode];
        $("fc-hint").hidden = false;
        $("btn-flip").hidden = false;
        $("rate-row").hidden = true;
        s.t0 = performance.now();
        window.scrollTo(0, 0);
        if (it.mode === "listen") setTimeout(() => { if (curItem() === it && !s.flipped) speak(g.hz); }, 120);
    }
    // Gợi ý ở kiểu Nghĩa → chữ: ghi chú gợi nhớ nếu có, không thì chữ cái đầu của pinyin
    function showHint() {
        const it = curItem(), box = $("fc-hintbox");
        if (!it || !box) return;
        if (it.sent) { showSentHint(it, box); return; }
        const note = window.HocNotes ? HocNotes.get(it.g.hz) : "";
        const py = String(it.g.py || "").trim();
        box.innerHTML = note ? `📝 ${esc(note)}`
            : py ? `Pinyin bắt đầu bằng “<b>${esc(py.charAt(0))}</b>…”`
            : "Chưa có gợi ý cho từ này.";
        box.hidden = false;
    }
    function uniqSrc(g) { return Array.from(new Set(g.cards.map(c => c.src))); }
    function flip() {
        const s = session;
        if (!s || s.flipped || !s.queue.length) return;
        s.flipped = true;
        s.ms = performance.now() - s.t0;
        const it = s.queue[0], g = it.g;
        if (it.sent) { flipSent(it); return; }
        $("fc-front").className = "fc-front m-back";
        $("fc-front").innerHTML = `<div class="fc-hz">${zizuHTML(g.hz)}</div>
            <button class="say" id="fc-say" type="button" title="Nghe phát âm" aria-label="Nghe phát âm">🔊</button>`;
        $("fc-py").textContent = g.py || "";
        $("fc-hv").textContent = g.hv ? g.hv.toUpperCase() : "";
        $("fc-vi").textContent = g.vi || "";
        const ex = exampleFor(g);
        if (ex) {
            const zh = esc(ex.zh).split(esc(g.hz)).join(`<mark>${esc(g.hz)}</mark>`);
            $("fc-ex").innerHTML = `<button class="say" data-say="${esc(ex.zh)}" title="Nghe câu ví dụ">🔊</button>
                <div class="zh">${zh}</div>${ex.py ? `<div class="py">${esc(ex.py)}</div>` : ""}${ex.vi ? `<div class="vi">${esc(ex.vi)}</div>` : ""}`;
        } else $("fc-ex").innerHTML = "";
        const nb = $("fc-note");
        nb.dataset.hz = g.hz;
        nb.dataset.hard = hardCount(g) >= HARD_MIN ? "1" : "0";
        fillNoteBox(nb);
        $("fc-back").hidden = false;
        $("fcard").classList.add("flipped");
        $("btn-flip").hidden = true;
        $("rate-row").hidden = false;
        // khoảng ôn kế tiếp: theo thẻ chính (nguồn đầu tiên) của nhóm
        const main = g.cards[0];
        const sched = SOURCES[main.src].schedule;
        const live = freshCard(main) || main.card;
        for (let r = 1; r <= 4; r++) $("iv-" + r).textContent = s.practice ? "luyện thêm"
            : ivText(sched(Object.assign({ ef: 2.5, iv: 0, reps: 0, lapses: 0 }, live), r).iv);
        // đọc từ rồi đọc câu ví dụ (thẻ Nghe → nghĩa đã đọc từ ở mặt trước nên chỉ đọc câu)
        if (S.settings.speak) speakCard(it.mode === "listen" ? "" : g.hz, ex && ex.zh);
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
        if (it.sent) { rateSent(it, r); return; }
        if (s.practice) {                       // luyện riêng: không ghi gì vào lịch ôn / bộ đếm
            s.rated++;
            if (!it.again) { s.stats[r]++; s.done++; }
            if (r === 1) s.queue.push({ g: it.g, again: true });
            renderCard();
            return;
        }
        // chỉ đo tốc độ ở lần hỏi đầu (giống hsk_lotrinh) và chỉ khi mặt trước là chữ Hán
        const ms = it.again || it.mode !== "hz" ? null : s.ms;
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
    // ---------------------------------------------------------------------- Thẻ "✂️ Câu của tôi" (điền từ)
    const hanOnly = t => Array.from(String(t || "")).filter(ch => HAN.test(ch)).join("");
    // Câu đầy đủ, từ được che tô sáng (lần xuất hiện đầu, giống HocSentences.cloze); chữ Hán của từ mở được Họ chữ
    function sentFullHTML(e, zizu) {
        const zh = String(e.zh || ""), t = String(e.target || "");
        const i = t ? zh.indexOf(t) : -1;
        if (i < 0) return esc(zh);
        return esc(zh.slice(0, i)) + `<mark>${zizu ? zizuHTML(t) : esc(t)}</mark>` + esc(zh.slice(i + t.length));
    }
    function sentClozeHTML(e) {
        const c = window.HocSentences ? HocSentences.cloze(e) : String(e.zh || "");
        return esc(c).replace(/＿+/g, m => `<span class="gap">${m}</span>`);
    }
    function renderSentCard(it) {
        const s = session, e = it.sent;
        it.typed = "";
        $("fc-mode").textContent = "✂️ Điền từ";
        $("fc-mode").className = "fc-mode m-sent";
        $("fc-src").innerHTML = `<span class="s-sent">${esc(SENT_LABEL)}</span>`;
        $("fc-again").hidden = !it.again;
        $("fc-hard").hidden = true;
        $("fc-front").className = "fc-front m-sent";
        $("fc-front").innerHTML = `<div class="fc-sent">${sentClozeHTML(e)}</div>
            ${e.vi ? `<div class="fc-q-sub">Từ bị che nghĩa là: <b>${esc(e.vi)}</b></div>` : `<div class="fc-q-sub">Nhớ lại từ bị che</div>`}
            <button class="btn btn-sm hint-btn" type="button" data-hint>💡 Gợi ý</button>
            <div class="fc-hintbox" id="fc-hintbox" hidden></div>
            <input class="sent-try" id="sent-try" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
                placeholder="Gõ thử chữ Hán (tùy chọn) rồi Enter" aria-label="Gõ thử từ bị che">`;
        $("fc-back").hidden = true;
        $("fcard").classList.remove("flipped");
        $("fc-hint").innerHTML = "Nhớ từ bị che rồi chạm vào thẻ hoặc nhấn <kbd>Space</kbd> để lật";
        $("fc-hint").hidden = false;
        $("btn-flip").hidden = false;
        $("rate-row").hidden = true;
        s.t0 = performance.now();
        window.scrollTo(0, 0);
        const inp = $("sent-try");
        inp.addEventListener("keydown", ev => {
            // Enter đang soạn chữ (bộ gõ) không tính là nộp
            if (ev.key === "Enter" && !ev.isComposing && ev.keyCode !== 229) {
                ev.preventDefault(); ev.stopPropagation();
                if (curItem() === it && !session.flipped) { it.typed = inp.value; flip(); }
            } else if (ev.key === "Escape") { ev.stopPropagation(); inp.blur(); }
        });
    }
    function showSentHint(it, box) {
        const e = it.sent, n = hanOnly(e.target).length || String(e.target || "").length;
        const py = String(e.py || "").trim();
        box.innerHTML = `${n} chữ` + (py ? ` · pinyin bắt đầu bằng “<b>${esc(py.charAt(0))}</b>…”` : "");
        box.hidden = false;
    }
    function flipSent(it) {
        const s = session;
        const e = (window.HocSentences && HocSentences.get(it.sent.id)) || it.sent;
        it.sent = e;
        const inp = $("sent-try");
        if (inp && !it.typed) it.typed = inp.value;
        $("fc-front").className = "fc-front m-sent m-back";
        $("fc-front").innerHTML = `<div class="fc-sent">${sentFullHTML(e, true)}</div>
            <button class="say" type="button" data-say="${esc(e.zh)}" title="Nghe cả câu" aria-label="Nghe cả câu">🔊</button>`;
        $("fc-py").textContent = e.py || "";
        $("fc-hv").textContent = e.hv ? String(e.hv).toUpperCase() : "";
        $("fc-vi").textContent = e.vi || "";
        const typed = hanOnly(it.typed);
        let res = "";
        if (typed) {
            const ok = typed === hanOnly(e.target);
            res = `<div class="sent-res ${ok ? "ok" : "bad"}">${ok ? "✓ Bạn gõ đúng" : "✗ Bạn gõ"}: <span class="zh-in">${esc(typed)}</span></div>`;
        }
        const url = e.url ? "../" + String(e.url).replace(/^\.?\//, "") : "";
        $("fc-ex").innerHTML = res
            + (e.ctx_vi ? `<div class="vi">${esc(e.ctx_vi)}</div>` : "")
            + (e.src || url ? `<div class="sent-src">${esc(e.src || "Nguồn")}${url ? ` · <a href="${esc(url)}">Mở lại bài ↗</a>` : ""}</div>` : "");
        const nb = $("fc-note");
        nb.dataset.hz = hanOnly(e.target) || e.target;
        nb.dataset.hard = "0";
        fillNoteBox(nb);
        $("fc-back").hidden = false;
        $("fcard").classList.add("flipped");
        $("btn-flip").hidden = true;
        $("rate-row").hidden = false;
        const card = Object.assign({ ef: 2.5, iv: 0, reps: 0, lapses: 0 }, e.card || {});
        for (let r = 1; r <= 4; r++) $("iv-" + r).textContent = window.HocSentences ? HocSentences.ivLabel(card, r) : "";
        if (S.settings.speak) speak(e.zh);
    }
    function rateSent(it, r) {
        const s = session;
        if (window.HocSentences) {
            const e = HocSentences.get(it.sent.id);          // đọc lại bản mới nhất trước khi ghi
            if (e) {
                const n = HocSentences.schedule(Object.assign({ ef: 2.5, iv: 0, reps: 0, lapses: 0 }, e.card || {}), r);
                const upd = HocSentences.update(e.id, { card: n });
                if (upd) it.sent = upd;
            }
        }
        s.rated++;
        if (!it.again) { s.stats[r]++; s.done++; }
        if (r === 1) s.queue.push({ sent: it.sent, again: true });
        const d = today();
        d.r = (d.r || 0) + 1;
        if (checkDayOk()) toast(`🔥 Chuỗi ngày học: ${S.streak.count} ngày!`);
        save();
        renderCard();
    }
    // Phát âm phần đang hỏi: thẻ từ → từ; thẻ câu → cả câu (chỉ sau khi lật, vì nghe trước sẽ lộ đáp án)
    function sayCur(slow) {
        const it = curItem();
        if (!it) return;
        if (it.sent) { if (session.flipped) speak(it.sent.zh, slow ? 0.5 : undefined); return; }
        speak(it.g.hz, slow ? 0.5 : undefined);
    }

    function finishReview(quit) {
        const s = session;
        if (!s) return;
        document.body.classList.remove("in-review");
        $("practice-note").hidden = true;
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        if (s.practice) { finishPractice(s, quit); return; }
        const remain = collectDue().concat(sentDue());
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
        if (remain.length) acts.push(`<button class="btn ${st.learn.done && st.read.done ? "btn-primary" : ""}" id="res-more">🔁 Ôn tiếp (${fmt(remain.length)})</button>`);
        if (!st.learn.done && st.learn.items.length) {
            const n = st.learn.items[0];
            acts.unshift(`<a class="btn btn-primary" href="${esc(n.url)}">Bước 2 · ▶ ${esc(n.label)}</a>`);
        } else if (!st.read.done) {
            const r0 = (readSuggestions() || [])[0];
            acts.unshift(`<a class="btn btn-primary" href="${esc(r0 ? r0.url : "../doc_them/doc_them.html")}">Bước 3 · 📖 ${esc(r0 ? r0.title : "Đọc 1 bài")}</a>`);
        }
        acts.push(`<button class="btn" id="res-home">Về buổi học hôm nay</button>`);
        $("res-actions").innerHTML = acts.join("");
        if ($("res-more")) $("res-more").onclick = startReview;
        $("res-home").onclick = () => { session = null; show("home"); };
        session = null;
        show("done");
    }

    function finishPractice(s, quit) {
        const t = s.stats[1] + s.stats[2] + s.stats[3] + s.stats[4];
        const pct = t ? Math.round((s.stats[3] + s.stats[4]) / t * 100) : 0;
        const noNote = collectHard().filter(g => !(window.HocNotes && HocNotes.get(g.hz))).length;
        $("res-score").textContent = t ? pct + "%" : "–";
        $("res-title").textContent = !t ? "Chưa luyện từ nào" : quit ? "Đã dừng phiên luyện" : "Xong phần luyện từ cứng đầu!";
        $("res-sub").innerHTML = (t ? `Đã luyện <b>${fmt(t)}</b> từ, nhớ được <b>${pct}%</b>. ` : "")
            + "Phiên luyện riêng không thay đổi lịch ôn."
            + (noNote ? ` Còn <b>${fmt(noNote)}</b> từ chưa có ghi chú gợi nhớ.` : "");
        $("res-stats").innerHTML = [
            [s.stats[1], "Quên"], [s.stats[2], "Khó"], [s.stats[3] + s.stats[4], "Nhớ / Dễ"], ["🔥 " + currentStreak(), "ngày liên tiếp"],
        ].map(x => `<div><b>${x[0]}</b><span>${x[1]}</span></div>`).join("");
        $("res-actions").innerHTML = `<button class="btn btn-primary" id="res-again">🎯 Luyện lại</button><button class="btn" id="res-home">Về buổi học hôm nay</button>`;
        $("res-again").onclick = startPractice;
        $("res-home").onclick = () => { session = null; show("home"); };
        session = null;
        show("done");
    }

    // ====================================================================== Ghi chú gợi nhớ (HocNotes)
    // Khung ghi chú: phần tử .note-box[data-hz][data-hard] — hiện ghi chú + Sửa/Xóa, hoặc nút thêm
    function noteBoxHTML(hz, hard) {
        const t = window.HocNotes ? HocNotes.get(hz) : "";
        if (t) return `<div class="note-show"><span class="note-t">📝 ${esc(t)}</span>
            <span class="note-acts"><button class="lnk" type="button" data-note-edit>Sửa</button><button class="lnk danger" type="button" data-note-del>Xóa</button></span></div>`;
        return (hard ? `<div class="note-ask">🧠 Bạn hay quên từ này. Viết một ghi chú gợi nhớ (tách chữ, liên tưởng, câu vui…) để nhớ lâu hơn.</div>` : "")
            + `<button class="btn btn-sm note-add" type="button" data-note-edit>📝 Ghi chú gợi nhớ</button>`;
    }
    function fillNoteBox(box) {
        if (!window.HocNotes) { box.innerHTML = ""; return; }
        box.innerHTML = noteBoxHTML(box.dataset.hz, box.dataset.hard === "1");
    }
    function editNote(box) {
        const t = HocNotes.get(box.dataset.hz);
        box.innerHTML = `<textarea class="note-input" rows="2" maxlength="500" placeholder="Ví dụ: 休 = người (亻) tựa gốc cây (木) → nghỉ ngơi">${esc(t)}</textarea>
            <div class="note-edit-acts"><button class="btn btn-sm btn-primary" type="button" data-note-save>Lưu</button><button class="btn btn-sm" type="button" data-note-cancel>Hủy</button></div>`;
        const ta = box.querySelector("textarea");
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        ta.addEventListener("keydown", e => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveNote(box); }
            else if (e.key === "Escape") { e.stopPropagation(); fillNoteBox(box); }
        });
    }
    function saveNote(box) {
        const ta = box.querySelector("textarea");
        if (!ta) return;
        const v = ta.value;
        HocNotes.set(box.dataset.hz, v);
        fillNoteBox(box);
        toast(v.trim() ? "Đã lưu ghi chú gợi nhớ" : "Đã xóa ghi chú");
    }
    document.addEventListener("click", e => {
        const box = e.target.closest && e.target.closest(".note-box");
        if (!box || !window.HocNotes) return;
        if (e.target.closest("[data-note-edit]")) editNote(box);
        else if (e.target.closest("[data-note-save]")) saveNote(box);
        else if (e.target.closest("[data-note-cancel]")) fillNoteBox(box);
        else if (e.target.closest("[data-note-del]")) { HocNotes.set(box.dataset.hz, ""); fillNoteBox(box); toast("Đã xóa ghi chú"); }
    });

    // ====================================================================== Từ cứng đầu (trang chính)
    let hardAll = false;
    function renderHard() {
        const list = collectHard();
        $("hard-box").hidden = !list.length;
        if (!list.length) return;
        const noNote = list.filter(g => !(window.HocNotes && HocNotes.get(g.hz))).length;
        $("hard-title").textContent = `🧠 Từ cứng đầu (${list.length})`;
        $("hard-note").innerHTML = `Những từ bạn đã quên từ ${HARD_MIN} lần trở lên. `
            + (noNote ? `<b>${fmt(noNote)}</b> từ chưa có ghi chú gợi nhớ, hãy viết một câu liên tưởng để nhớ lâu hơn. ` : "")
            + `“Luyện riêng” chỉ để luyện thêm, <b>không thay đổi lịch ôn</b>.`;
        const shown = hardAll ? list : list.slice(0, HARD_SHOW);
        $("hard-list").innerHTML = shown.map(g => `
            <div class="hard-item">
                <div class="hard-main">
                    <span class="hard-hz">${zizuHTML(g.hz)}</span>
                    <span class="hard-info">
                        <span class="hard-line"><span class="py">${esc(g.py || "")}</span>${g.hv ? `<span class="hv">${esc(g.hv.toUpperCase())}</span>` : ""}</span>
                        <span class="vi">${esc(meaningOnly(g.vi) || g.vi || "")}</span>
                    </span>
                    <span class="hard-side">
                        <span class="hard-n" title="Số lần quên">quên ${g.forgot}×</span>
                        <button class="say sm" type="button" data-say="${esc(g.hz)}" title="Nghe" aria-label="Nghe">🔊</button>
                    </span>
                </div>
                <div class="note-box" data-hz="${esc(g.hz)}" data-hard="0">${noteBoxHTML(g.hz, false)}</div>
            </div>`).join("");
        $("hard-more").hidden = list.length <= HARD_SHOW;
        $("hard-more").textContent = hardAll ? "Thu gọn ▲" : `Xem tất cả ${fmt(list.length)} từ ▼`;
    }

    // ====================================================================== Bước 2 & 3 (đọc tiến độ các trang)
    // Giống index.html: tổng số bài mỗi nhóm khi trang con chưa ghi tóm tắt
    const DEFAULTS = {
        hsk1: { label: "HSK 1", total: 15 }, hsk2: { label: "HSK 2", total: 15 }, hsk3: { label: "HSK 3", total: 30 },
        hsk4: { label: "HSK 4", total: 40 }, hsk5: { label: "HSK 5", total: 65 }, hsk6: { label: "HSK 6", total: 126 },
        tc1: { label: "Chuẩn Trung cấp 1", total: 16 }, tc2: { label: "Chuẩn Trung cấp 2", total: 16 },
        tc3: { label: "Trung cấp 1", total: 12 }, tc4: { label: "Trung cấp 2", total: 10 },
        gc1: { label: "Cao cấp 1", total: 10 }, gc2: { label: "Cao cấp 2", total: 10 }, gc3: { label: "Cao cấp 3", total: 8 },
    };
    const STAGES = [
        { title: "Nền tảng", tracks: ["hsk1", "hsk2", "hsk3"] },
        { title: "Trung cấp nền", tracks: ["tc1", "tc2", "hsk4"] },
        { title: "Trung cấp nâng cao", tracks: ["tc3", "tc4", "hsk5"] },
        { title: "Cao cấp", tracks: ["gc1", "gc2", "gc3", "hsk6"] },
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
    // ====================================================================== Bước 3: Đọc 1 bài (doc_them)
    const FIT_LO = 90, FIT_HI = 95, FIT_MID = 92;    // "vừa sức": biết 90–95% số từ (không có thì gần 92% nhất)
    const READ_MAX = 8;                                // số gợi ý tối đa
    const STRETCH_LO = 80, STRETCH_HI = 89;          // "thử sức": biết 80–89% số từ, cấp bằng hoặc cao hơn trình độ
    function docRead() { const v = readJSON("doc_them_v1", {}) || {}; return (v.read && typeof v.read === "object") ? v.read : {}; }
    // Các mốc đọc xong; bài đã done mà chưa có rr coi như rr = [at] (giống doc_them)
    function rrOf(r) {
        if (!r) return [];
        if (Array.isArray(r.rr) && r.rr.length) {
            // lọc trùng ngày (sync.js hợp mảng từ hai máy có thể ra hai mốc cùng ngày) — khớp rrOf của doc_them.js
            const seen = new Set();
            return r.rr.filter(x => +x > 0).map(Number).sort((a, b) => a - b)
                .filter(x => { const d = startOfDay(x); if (seen.has(d)) return false; seen.add(d); return true; });
        }
        return r.done && r.at ? [r.at] : [];
    }
    // Hạn đọc lại: 1 lần → đầu ngày(rr[0]) + 3 ngày; 2 lần → đầu ngày(rr[1]) + 7 ngày; ≥ 3 lần → không nhắc (null)
    function rereadDue(r) {
        if (!r || !r.done) return null;       // bài đã bỏ đánh dấu thì không nhắc (giống doc_them.js)
        const rr = rrOf(r);
        if (rr.length === 1) return startOfDay(rr[0]) + 3 * DAY;
        if (rr.length === 2) return startOfDay(rr[1]) + 7 * DAY;
        return null;
    }
    // Số bài đọc xong hôm nay (đọc mới hoặc đọc lại)
    function readCountToday() {
        const t0 = startOfDay(), rd = docRead();
        return Object.keys(rd).filter(id => {
            const r = rd[id] || {};
            return (Array.isArray(r.rr) && r.rr.some(x => +x >= t0)) || (r.done && (r.at || 0) >= t0);
        }).length;
    }
    function readGoal() { return Math.max(1, +S.settings.readGoal || 3); }
    let docLoading = null;
    function ensureDocIndex() {       // mục lục bài đọc (~340KB) — chỉ nạp khi vẽ bước 4
        if (window.DOC_INDEX) return Promise.resolve(true);
        if (docLoading) return docLoading;
        docLoading = new Promise(resolve => {
            const s = document.createElement("script");
            s.src = "../doc_them/doc_index.js";
            s.onload = () => resolve(!!window.DOC_INDEX);
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        });
        return docLoading;
    }
    // Tập từ đã biết: chữ Hán của mọi thẻ SRS + Từ của tôi (giống buildKnown() của doc_them)
    function buildKnown() {
        const set = new Set();
        const add = raw => String(raw || "").split(/[\/、,，;；|\s]+/).forEach(p => {
            const w = hanOnly(cleanHz(p));
            if (w) set.add(w);
        });
        const hs = readJSON("hsk_lotrinh_v1", {}) || {};
        Object.keys(hs.srs || {}).forEach(id => add(id.slice(id.indexOf("-") + 1)));
        const wl = readJSON("hsk_wl_srs_v3", {}) || {};
        Object.keys(wl).forEach(id => { if (wl[id] && wl[id].hz) add(wl[id].hz); });
        const bl = readJSON("boya_learning_progress_v2", {}) || {};
        Object.keys(bl.srs || {}).concat(Object.keys(readJSON("boya_tv_srs", {}) || {}))
            .forEach(id => { const w = LT.words[id]; if (w) add(w[0]); });
        if (window.HocMyWords) HocMyWords.all().forEach(e => add(e.hz));
        const chars = new Set();
        set.forEach(w => { for (const ch of w) chars.add(ch); });
        return { words: set, chars };
    }
    // % từ đã biết = số từ (khác nhau) trong d.w đã biết / tổng số từ của bài
    function knownPctOf(d, K) {
        const toks = String(d.w || "").split(/\s+/).map(t => hanOnly(cleanHz(t))).filter(Boolean);
        if (!toks.length) return 0;
        let ok = 0;
        toks.forEach(t => { if (K.words.has(t) || (t.length === 1 && K.chars.has(t))) ok++; });
        return Math.round(ok * 100 / toks.length);
    }
    // Trình độ ước lượng để ưu tiên cấp bài: cấp HSK cao nhất đã có thẻ ở hsk_lotrinh, hoặc theo chặng hiện tại
    function learnerLevel() {
        let lv = 0;
        const hs = readJSON("hsk_lotrinh_v1", {}) || {};
        Object.keys(hs.srs || {}).forEach(id => { const n = parseInt(id, 10); if (n > lv) lv = n; });
        try { const st = nextLessons().stage; if (st && st.n > 1) lv = Math.max(lv, st.n + 2); } catch (e) {}
        return Math.min(6, Math.max(1, lv || 1));
    }
    const KIND_VI = { article: "Bài đọc", series: "Truyện dài", dialogue: "Hội thoại", chengyu: "Thành ngữ" };
    function docLink(id) { return "../doc_them/doc_them.html?id=" + encodeURIComponent(id); }
    // Gợi ý bước 4 (null nếu chưa nạp được mục lục): [{type: "next"|"reread"|"fit", id, title, sub, url, level, pct}]
    function readSuggestions() {
        const D = window.DOC_INDEX;
        if (!Array.isArray(D)) return null;
        const rd = docRead(), now = Date.now();
        const isDone = id => rrOf(rd[id]).length > 0 || !!(rd[id] && rd[id].done);
        const lastAt = id => { const r = rd[id] || {}; return Math.max(r.at || 0, ...rrOf(r)); };
        const K = buildKnown();
        const pctCache = {};
        const pct = d => (pctCache[d.id] != null ? pctCache[d.id] : (pctCache[d.id] = knownPctOf(d, K)));
        const out = [], used = new Set();
        const push = (type, d, extra, force) => {
            if (used.has(d.id) || (out.length >= READ_MAX && !force)) return;
            used.add(d.id);
            const title = d.kind === "series" ? `${d.series_title || "Truyện"} · Chương ${d.chapter}: ${d.title}` : d.title;
            out.push(Object.assign({ type, id: d.id, title, title_vi: d.title_vi || "", kind: d.kind, level: d.level,
                pct: pct(d), url: docLink(d.id) }, extra || {}));
        };
        // (a) chương kế tiếp của bộ truyện đang đọc dở (bộ đọc gần nhất trước), tối đa 2 bộ
        const series = new Map();
        D.forEach(d => { if (d.kind === "series" && d.series) { if (!series.has(d.series)) series.set(d.series, []); series.get(d.series).push(d); } });
        const prog = [];
        series.forEach(chs => {
            chs.sort((a, b) => (a.chapter || 0) - (b.chapter || 0));
            const done = chs.filter(c => isDone(c.id));
            if (!done.length || done.length === chs.length) return;
            const maxCh = Math.max(...done.map(c => c.chapter || 0));
            const next = chs.find(c => (c.chapter || 0) > maxCh && !isDone(c.id)) || chs.find(c => !isDone(c.id));
            if (next) prog.push({ next, at: Math.max(...done.map(c => lastAt(c.id))), n: done.length, total: chs.length });
        });
        prog.sort((a, b) => b.at - a.at).slice(0, 3).forEach(p => push("next", p.next, { progress: `${p.n}/${p.total} chương` }));
        // (b) bài đến hạn đọc lại (quá hạn lâu trước), tối đa 2
        const byId = new Map(D.map(d => [d.id, d]));
        Object.keys(rd).map(id => ({ id, due: rereadDue(rd[id]), n: rrOf(rd[id]).length }))
            .filter(x => x.due != null && now >= x.due && byId.has(x.id))
            .sort((a, b) => a.due - b.due).slice(0, 3)
            .forEach(x => push("reread", byId.get(x.id), { times: x.n }));
        // (c) 1–2 bài chưa đọc "vừa sức" (bỏ chương giữa truyện: truyện nên đọc từ chương 1), ưu tiên cấp gần trình độ
        const room = Math.max(3, READ_MAX - 1 - out.length);      // chừa 1 chỗ cho bài "thử sức"
        const lv = learnerLevel();
        const cands = D.filter(d => !isDone(d.id) && !used.has(d.id) && !(d.kind === "series" && (d.chapter || 1) > 1));
        const near = d => d.level >= lv - 1;                  // bài cấp quá thấp so với trình độ thì nhàm, chỉ dùng khi thiếu
        const closeness = d => Math.abs(pct(d) - FIT_MID);
        // (d) chọn trước 1 bài "thử sức": khó hơn một chút (biết 80–89% từ), cấp ≥ trình độ, ưu tiên cấp cao hơn rồi tới truyện
        const stretch = cands.filter(d => d.level >= lv && pct(d) >= STRETCH_LO && pct(d) <= STRETCH_HI)
            .sort((a, b) => ((a.level > lv ? 0 : 1) - (b.level > lv ? 0 : 1)) || ((b.kind === "series") - (a.kind === "series")) || (pct(b) - pct(a)))[0];
        const pool = cands.filter(d => d !== stretch);
        // Tầng 1: cấp gần trình độ, biết ≥ 90% từ · Tầng 2: cấp gần trình độ (không cao hơn), biết nhiều từ nhất (≥ 75%)
        // · Tầng 3: cấp thấp hơn nhưng vừa 90–95%
        const t1 = pool.filter(d => near(d) && pct(d) >= FIT_LO).sort((a, b) => closeness(a) - closeness(b));
        const t2 = pool.filter(d => near(d) && d.level <= lv && pct(d) < FIT_LO && pct(d) >= 75).sort((a, b) => pct(b) - pct(a));
        const t3 = pool.filter(d => !near(d) && pct(d) >= FIT_LO && pct(d) <= FIT_HI).sort((a, b) => (b.level - a.level) || (closeness(a) - closeness(b)));
        let fit = t1.concat(t2, t3);
        if (!fit.length) fit = pool.slice().sort((a, b) => closeness(a) - closeness(b)).slice(0, 6);
        // luôn có ít nhất 3 bài vừa sức; xen kẽ loại bài (truyện / bài đọc / hội thoại / thành ngữ) cho đỡ nhàm
        const picked = [], kinds = {};
        fit.forEach(d => { if (picked.length < room && (kinds[d.kind] || 0) < 2) { picked.push(d); kinds[d.kind] = (kinds[d.kind] || 0) + 1; } });
        fit.forEach(d => { if (picked.length < room && picked.indexOf(d) < 0) picked.push(d); });
        picked.forEach(d => push("fit", d, null, true));
        if (stretch) push("stretch", stretch, null, true);
        return out;
    }

    function stepState() {
        const d = S.days[dayKey()] || { steps: {} };
        const steps = d.steps || {};
        const nl = nextLessons();
        const newN = newWordsToday();
        return {
            review: { done: !!steps.review },
            learn: { done: newN > 0 || !!steps.learn, n: newN, items: nl.items, stage: nl.stage },
            read: (function () { const n = readCountToday(), g = readGoal(); return { done: n >= g, n, goal: g }; })(),
        };
    }

    // ====================================================================== Màn hình chính
    function show(view) {
        ["home", "review", "done"].forEach(v => { $(v).hidden = v !== view; });
        window.scrollTo(0, 0);
        if (view === "home") renderHome();
    }
    function renderSkip() {
        const by = hskDueByLevel(Date.now()), skip = S.settings.skipLv || [];
        $("skip-lv").innerHTML = [1, 2, 3, 4, 5, 6].map(lv =>
            `<label class="check"><input type="checkbox" data-skip-lv="${lv}" ${skip.indexOf(lv) >= 0 ? "checked" : ""}> HSK ${lv} <small class="muted">(${fmt(by[lv] || 0)} đến hạn)</small></label>`).join("");
        const hidden = skip.reduce((a, lv) => a + (by[lv] || 0), 0);
        $("skip-sum").textContent = skip.length ? `· đang ẩn HSK ${skip.join(", ")} (${fmt(hidden)} thẻ)` : "";
        if (skip.length) $("skip-box").classList.add("on"); else $("skip-box").classList.remove("on");
    }
    function renderHome() {
        const due = collectDue();
        const sdue = sentDue();
        lastDueCount = due.length + sdue.length;
        const st = stepState();
        // ghi nhận bước 2/3 vừa xong ở trang khác (bài mới, đọc)
        const d = today();
        let changed = false;
        if (!due.length && !sdue.length && !d.steps.review && (d.r || 0) > 0) { d.steps.review = true; changed = true; }
        if (st.learn.done && !d.steps.learn) { d.steps.learn = true; changed = true; }
        if (st.read.done && !d.steps.read) { d.steps.read = true; changed = true; }
        if (checkDayOk()) changed = true;
        save();
        const nDue = due.length + sdue.length;
        const reviewDone = !nDue || !!d.steps.review;
        const flags = [reviewDone, st.learn.done, st.read.done];
        const curStep = flags.indexOf(false);

        // Đầu trang
        const now = new Date();
        const wd = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"][now.getDay()];
        $("hero-date").textContent = `${wd}, ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
        const nDone = flags.filter(Boolean).length;
        const NSTEP = flags.length;
        $("hero-title").textContent = nDone === NSTEP ? "🎉 Xong buổi học hôm nay!" : "Buổi học hôm nay";
        $("hero-note").textContent = nDone === NSTEP
            ? `Bạn đã làm đủ ${NSTEP} bước. Có thể ôn thêm hoặc học thêm nếu còn thời gian.`
            : `Đã xong ${nDone}/${NSTEP} bước · khoảng 30–45 phút: ôn tập → học bài mới → đọc 1 bài.`;
        $("day-bar").style.width = Math.round(nDone / NSTEP * 100) + "%";
        const sk = currentStreak();
        $("streak-n").textContent = sk;
        $("streak").classList.toggle("cold", !(S.streak.last === dayKey()));

        // Bước 1
        ["step-review", "step-learn", "step-read"].forEach((id, i) => {
            $(id).classList.toggle("done", flags[i]);
            $(id).classList.toggle("current", i === curStep);
            $(id).querySelector(".step-num").textContent = flags[i] ? "✓" : i + 1;
        });
        const bySrc = {};
        let cards = 0;
        due.forEach(g => uniqSrc(g).forEach(src => { bySrc[src] = (bySrc[src] || 0) + 1; }));
        due.forEach(g => { cards += g.cards.length; });
        const dueTxt = [due.length ? `${fmt(due.length)} từ` : "", sdue.length ? `${fmt(sdue.length)} câu` : ""].filter(Boolean).join(" + ");
        setTag("review-tag", reviewDone, dueTxt || "Không còn thẻ");
        const todayR = d.r || 0;
        const sentTxt = sdue.length ? ` và <b>${fmt(sdue.length)}</b> câu ✂️ đến hạn` : "";
        $("review-note").innerHTML = due.length
            ? `Có <b>${fmt(due.length)}</b> từ${sentTxt ? "" : " đến hạn"}${cards > due.length ? ` (${fmt(cards)} thẻ, từ trùng giữa các trang chỉ hỏi một lần)` : ""}${sentTxt}.`
              + (todayR ? ` Hôm nay đã ôn ${fmt(todayR)} lượt.` : "") + " Từ quá hạn lâu và hay quên được hỏi trước."
            : sdue.length ? `Có <b>${fmt(sdue.length)}</b> câu ✂️ Câu của tôi đến hạn.` + (todayR ? ` Hôm nay đã ôn ${fmt(todayR)} lượt.` : "")
            : todayR ? `Đã ôn ${fmt(todayR)} lượt hôm nay. Không còn thẻ nào đến hạn.` : "Không có thẻ nào đến hạn hôm nay. Hãy sang bước 2.";
        $("review-src").innerHTML = SRC_KEYS.filter(k => bySrc[k]).map(k => `<span class="src-chip">${esc(SRC[k].name)}<b>${fmt(bySrc[k])}</b></span>`).join("")
            + (sdue.length ? `<span class="src-chip">✂️ ${esc(SENT_LABEL)}<b>${fmt(sdue.length)}</b></span>` : "");
        $("btn-review").hidden = !nDue;
        const lim = +S.settings.limit || 0;
        $("btn-review").textContent = reviewDone && nDue ? `🔁 Ôn tiếp (${fmt(nDue)})` : `▶ Bắt đầu ôn${lim && nDue > lim ? ` ${lim} thẻ` : ""}`;
        $("opt-limit").value = String(lim);
        $("opt-speak").checked = !!S.settings.speak;
        $("opt-mode").value = MODES[S.settings.cardMode] ? S.settings.cardMode : "mix";
        renderSkip();
        renderHard();
        renderSentBox();

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

        // Bước 3 · Đọc 1 bài
        renderRead(st.read, curStep === 2);
        if (!window.DOC_INDEX) ensureDocIndex().then(ok => { if (ok && !$("home").hidden) renderRead(stepState().read, curStep === 2); });
        if (changed) writeSummary();
    }
    function renderRead(rs, isCur) {
        const done = rs.done, sug = readSuggestions();
        $("read-h").textContent = `Đọc ${rs.goal} bài`;
        $("opt-read-goal").value = String(rs.goal);
        setTag("read-tag", done, `${fmt(rs.n)}/${rs.goal} bài`);
        $("btn-read").className = "btn" + (isCur ? " btn-primary" : "");
        if (!sug) {
            $("read-note").textContent = docLoading ? "Đang tìm bài vừa sức…" : "Đọc một bài ngắn ở trang Đọc thêm.";
            $("read-list").innerHTML = "";
            return;
        }
        $("read-note").textContent = done
            ? `Hôm nay bạn đã đọc ${fmt(rs.n)} bài, đạt mục tiêu 🎉. Còn hứng thì đọc thêm:`
            : `Hôm nay đã đọc ${fmt(rs.n)}/${rs.goal} bài (đánh dấu “đã đọc” ở cuối bài). Vừa sức = bài ở cấp gần trình độ mà bạn biết nhiều từ nhất (lý tưởng 90–95%); Thử sức = khó hơn một chút (biết 80–89% từ) để luyện lên trình độ cao hơn.`;
        const TAG = { next: "📖 Đọc tiếp", reread: "🔁 Đọc lại", fit: "🎯 Vừa sức", stretch: "💪 Thử sức" };
        $("read-list").innerHTML = sug.map(x => {
            const meta = [`HSK ${x.level}`, KIND_VI[x.kind] || "", x.title_vi,
                x.type === "next" && x.progress ? `đã đọc ${x.progress}` : "",
                x.type === "reread" ? `đã đọc ${x.times} lần` : "", `biết ${x.pct}% từ`].filter(Boolean).join(" · ");
            return `<a class="lesson rd-${x.type}" href="${esc(x.url)}" style="--c:var(--ui-hsk-${Math.min(6, Math.max(1, x.level || 1))})" data-read-id="${esc(x.id)}">
                <span><span class="rd-tag">${TAG[x.type]}</span><b class="rd-title">${esc(x.title)}</b><small>${esc(meta)}</small></span>
                <span class="go">Đọc ▶</span></a>`;
        }).join("");
    }

    // ====================================================================== Khối "✂️ Câu của tôi" (trang chính)
    const SENT_SHOW = 10;
    let sentAll = false;
    const sentFull = new Set();          // id câu đang hiện đầy đủ (mặc định hiện dạng che từ)
    function dueLabel(c) {
        if (!c || !c.due || c.due <= Date.now()) return "đến hạn";
        const days = Math.round((startOfDay(c.due) - startOfDay()) / DAY);
        if (days <= 0) return "ôn lại hôm nay";
        if (days === 1) return "ôn ngày mai";
        return `ôn sau ${days} ngày`;
    }
    function renderSentBox() {
        const box = $("sent-box");
        const list = window.HocSentences ? HocSentences.all() : [];
        box.hidden = !list.length;
        if (!list.length) return;
        const now = Date.now();
        const nDue = list.filter(e => e.card && e.card.due <= now).length;
        const open = S.settings.sentOpen !== false;
        $("sent-title").textContent = `✂️ Câu của tôi (${list.length})`;
        $("sent-due").textContent = nDue ? `${fmt(nDue)} đến hạn` : "Chưa đến hạn";
        $("sent-due").className = "tag " + (nDue ? "todo" : "ok");
        $("sent-toggle").textContent = open ? "Thu gọn ▲" : "Mở ▼";
        $("sent-toggle").setAttribute("aria-expanded", open ? "true" : "false");
        $("sent-body").hidden = !open;
        if (!open) return;
        // câu đến hạn lên đầu, rồi theo hạn ôn
        list.sort((a, b) => ((a.card && a.card.due) || 0) - ((b.card && b.card.due) || 0));
        const shown = sentAll ? list : list.slice(0, SENT_SHOW);
        $("sent-list").innerHTML = shown.map(e => {
            const full = sentFull.has(e.id);
            const isDue = e.card && e.card.due <= now;
            return `<div class="sent-item" data-sid="${esc(e.id)}">
                <div class="sent-main">
                    <div class="sent-zh" data-sent-toggle title="${full ? "Che từ" : "Chạm để hiện câu đầy đủ"}">${full ? sentFullHTML(e, false) : sentClozeHTML(e)}</div>
                    <div class="sent-meta">
                        <span class="sent-w">${full ? `<b>${esc(e.target)}</b> ${esc(e.py || "")} · ` : ""}${esc(e.vi || "")}</span>
                        ${e.src ? `<span class="sent-src-s">${esc(e.src)}</span>` : ""}
                        <span class="sent-dl ${isDue ? "due" : ""}">${dueLabel(e.card)}</span>
                    </div>
                </div>
                <span class="sent-acts">
                    <button class="say sm" type="button" data-say="${esc(e.zh)}" title="Nghe câu" aria-label="Nghe câu">🔊</button>
                    <button class="say sm del" type="button" data-sent-del title="Xóa câu" aria-label="Xóa câu">🗑</button>
                </span>
            </div>`;
        }).join("");
        $("sent-more").hidden = list.length <= SENT_SHOW;
        $("sent-more").textContent = sentAll ? "Thu gọn ▲" : `Xem tất cả ${fmt(list.length)} câu ▼`;
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
    $("opt-mode").onchange = e => { S.settings.cardMode = e.target.value; save(); };
    $("opt-read-goal").onchange = e => { S.settings.readGoal = +e.target.value; save(); renderHome(); };
    $("skip-lv").onchange = e => {
        const lv = +e.target.dataset.skipLv;
        if (!lv) return;
        const set = new Set(S.settings.skipLv || []);
        if (e.target.checked) set.add(lv); else set.delete(lv);
        S.settings.skipLv = Array.from(set).sort((a, b) => a - b);
        save(); renderHome();
    };
    $("btn-hard").onclick = startPractice;
    $("hard-more").onclick = () => { hardAll = !hardAll; renderHard(); };
    $("hard-list").addEventListener("click", e => {
        const say = e.target.closest("[data-say]");
        if (say) speak(say.dataset.say);
    });
    $("sent-toggle").onclick = () => { S.settings.sentOpen = S.settings.sentOpen === false; save(); renderSentBox(); };
    $("sent-more").onclick = () => { sentAll = !sentAll; renderSentBox(); };
    $("sent-list").addEventListener("click", e => {
        const item = e.target.closest(".sent-item");
        if (!item) return;
        const id = item.dataset.sid;
        const say = e.target.closest("[data-say]");
        if (say) { speak(say.dataset.say); return; }
        if (e.target.closest("[data-sent-del]")) {
            const en = window.HocSentences && HocSentences.get(id);
            if (!en) return;
            if (!confirm(`Xóa câu này khỏi “Câu của tôi”?\n\n${en.zh}`)) return;
            HocSentences.remove(id);
            sentFull.delete(id);
            toast("Đã xóa câu");
            renderHome();
            return;
        }
        if (e.target.closest("[data-sent-toggle]")) { if (sentFull.has(id)) sentFull.delete(id); else sentFull.add(id); renderSentBox(); }
    });
    if (window.HocSentences) HocSentences.onChange(() => { if (!$("home").hidden) renderSentBox(); });
    if (window.HocNotes) HocNotes.onChange(() => { if (!$("home").hidden && !document.querySelector("#hard-list textarea")) renderHard(); });
    $("btn-flip").onclick = flip;
    $("fcard").addEventListener("click", e => {
        if (e.target.closest(".note-box") || e.target.closest("[data-zizu]")) return;   // ghi chú / Họ chữ tự xử lý
        if (e.target.closest("input, a")) return;                                       // ô gõ thử / link mở lại bài (thẻ câu)
        if (e.target.closest("[data-say-word]")) { e.stopPropagation(); sayCur(); return; }
        if (e.target.closest("[data-say-slow]")) { e.stopPropagation(); sayCur(true); return; }
        if (e.target.closest("[data-hint]")) { e.stopPropagation(); showHint(); return; }
        const say = e.target.closest("[data-say]");
        if (say) { e.stopPropagation(); speak(say.dataset.say); return; }
        if (e.target.closest("#fc-say")) { e.stopPropagation(); sayCur(); return; }
        flip();
    });
    $("rate-row").addEventListener("click", e => { const b = e.target.closest("[data-rate]"); if (b) rate(+b.dataset.rate); });
    $("btn-quit").onclick = () => { if (session) finishReview(true); };
    // Bảng Họ chữ đang mở thì phím tắt thuộc về bảng (zizu.js đóng bảng bằng Esc trước khi tới đây nên phải ghi nhận ở pha capture)
    let zzOpenAtKey = false;
    window.addEventListener("keydown", () => { zzOpenAtKey = !!document.getElementById("zz-ov"); }, true);
    document.addEventListener("keydown", e => {
        if (!session || $("review").hidden || zzOpenAtKey) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = e.target && e.target.tagName;
        if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (!session.flipped) flip(); else if (e.key === " ") sayCur();
        } else if ((e.key === "h" || e.key === "H") && !session.flipped) showHint();
        else if (/^[1-4]$/.test(e.key) && session.flipped) { e.preventDefault(); rate(+e.key); }
        else if (e.key === "Escape") finishReview(true);
        else if (e.key === "r" || e.key === "R") {
            const it = curItem();
            if (it && (session.flipped || (!it.sent && it.mode !== "vi"))) sayCur();   // Nghĩa → chữ / thẻ câu: không đọc trước khi lật (lộ đáp án)
        }
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
    window.__HN = { collectDue, collectHard, startReview, startPractice, flip, rate, finishReview, stepState, renderHard, pickMode, meaningOnly, state: () => S, session: () => session, SOURCES,
        sentDue, readSuggestions, rereadDue, readCountToday, buildKnown, knownPctOf, ensureDocIndex, renderHome };
})();
