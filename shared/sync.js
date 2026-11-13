/* ==========================================================================
   SHARED/SYNC.JS — Tài khoản & đồng bộ tiến độ học qua Supabase
   - Nạp ĐỒNG BỘ trong <head>, ngay sau theme.js, TRƯỚC script của trang:
       <script src="../shared/sync.js"></script>
     Khi đã đăng nhập, file này tải tiến độ mới nhất từ máy chủ (XHR đồng bộ, chỉ vài trăm ms)
     rồi mới để trang khởi tạo từ localStorage -> trang luôn đọc dữ liệu mới nhất.
   - localStorage vẫn là bộ nhớ chính (chạy được khi mất mạng). Mỗi lần trang ghi một key
     thuộc danh sách SYNC_KEYS, key đó được đánh dấu "bẩn" và đẩy lên sau vài giây.
     Chưa đẩy được (mất mạng, đóng tab) thì lần mở trang sau sẽ đẩy tiếp.
   - Hai máy cùng sửa một key: gộp (thẻ SRS lấy bản ôn gần nhất, số lấy lớn hơn, cờ "xong" lấy OR,
     danh sách lấy hợp), xem mergeValues().
   - Bảng Supabase: progress(user_id, key, value, updated_at), có RLS: mỗi tài khoản chỉ thấy dữ liệu
     của mình. SQL tạo bảng: xem CLAUDE.md (mục "Tài khoản & đồng bộ").
   - Giao diện: phần tử có [data-hoc-account] tự thành nút tài khoản (mở hộp đăng nhập / thông tin).
   - API: HocSync.user()  HocSync.signIn(email, pw)  HocSync.signUp(email, pw)  HocSync.signOut()
          HocSync.syncNow()  HocSync.open()  HocSync.onChange(fn)
   ========================================================================== */
(function () {
    "use strict";

    var SUPABASE_URL = "https://tlixkdkdfowlokgendgp.supabase.co";
    // Khóa "anon" công khai (được phép để trong mã trang; quyền truy cập do RLS của bảng quyết định)
    var SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsaXhrZGtkZm93bG9rZ2VuZGdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1NTI3NDMsImV4cCI6MjExMDEyODc0M30.0zOpvvyFO_cRwN7lzNwCBhYU92quGKX7YMbY9MsM5SA";

    // Các key tiến độ được đồng bộ (khi thêm key tiến độ mới ở một trang, thêm vào đây)
    var SYNC_KEYS = [
        "hoc_theme",
        "hsk_lotrinh_v1",
        "boya_learning_progress_v2", "boya_learning_settings_v1", "boya_learning_starred_words_v1",
        "boya_tv_srs", "boya_tv_progress", "boya_tv_settings", "boya_tv_days", "boya_tv_best", "boya_starred_words",
        "hsk_wl_srs_v3", "hsk_wl_json_progress_v2", "hsk_wl_gamify_data_v2", "hsk_wl_json_font_v2", "hsk_wl_json_tone_color_v2",
        "luyen_tap_v1"
    ];
    var SYNC_PREFIXES = ["hoc_summary_v1:"];

    var SESSION_KEY = "hoc_sync_session";   // { access_token, refresh_token, expires_at (giây), user: {id, email} }
    var META_KEY = "hoc_sync_meta";         // { keys: { key: { rv: thời điểm bản trên máy chủ đã biết, d: 1 nếu bẩn, t: ms ghi } }, lastPull, lastPush, error }
    var PUSH_DELAY = 3000;
    var PULL_ON_LOAD_MIN_GAP = 10000;       // mở trang liên tiếp trong 10 giây thì không tải lại

    var store = window.localStorage;
    var rawGet = Storage.prototype.getItem, rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
    var applying = false;                   // đang ghi dữ liệu tải về -> không đánh dấu bẩn
    var listeners = [];
    var pushTimer = null, pushing = false;

    function isTracked(k) {
        if (!k) return false;
        if (SYNC_KEYS.indexOf(k) >= 0) return true;
        for (var i = 0; i < SYNC_PREFIXES.length; i++) if (k.indexOf(SYNC_PREFIXES[i]) === 0) return true;
        return false;
    }
    function lsGet(k) { try { return rawGet.call(store, k); } catch (e) { return null; } }
    function lsSet(k, v) { try { rawSet.call(store, k, v); } catch (e) { console.warn("[sync] không ghi được", k, e); } }
    function lsRemove(k) { try { rawRemove.call(store, k); } catch (e) {} }
    function readJSON(k, fb) { try { var v = lsGet(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }

    var session = readJSON(SESSION_KEY, null);
    var meta = readJSON(META_KEY, null) || { keys: {} };
    if (!meta.keys) meta.keys = {};
    function saveMeta() { lsSet(META_KEY, JSON.stringify(meta)); }
    function saveSession() { if (session) lsSet(SESSION_KEY, JSON.stringify(session)); else lsRemove(SESSION_KEY); }
    function notify() { for (var i = 0; i < listeners.length; i++) { try { listeners[i](api.user()); } catch (e) { console.error(e); } } renderButtons(); }

    // ---------- Bắt mọi lần ghi localStorage của trang ----------
    function markDirty(k) {
        var m = meta.keys[k] || (meta.keys[k] = {});
        m.d = 1; m.t = Date.now();
        saveMeta();
        schedulePush();
    }
    Storage.prototype.setItem = function (k, v) {
        if (this !== store || applying || !isTracked(k)) return rawSet.call(this, k, v);
        var old = lsGet(k);
        rawSet.call(this, k, v);
        if (String(v) !== old) markDirty(k);
    };
    Storage.prototype.removeItem = function (k) {
        if (this !== store || applying || !isTracked(k)) return rawRemove.call(this, k);
        var had = lsGet(k) !== null;
        rawRemove.call(this, k);
        if (had) markDirty(k);
    };

    // ---------- HTTP (XHR: dùng được cả đồng bộ lẫn bất đồng bộ, chạy được qua file://) ----------
    function request(method, path, body, opts) {
        opts = opts || {};
        var xhr = new XMLHttpRequest();
        xhr.open(method, SUPABASE_URL + path, !opts.sync);
        xhr.setRequestHeader("apikey", SUPABASE_ANON);
        xhr.setRequestHeader("Authorization", "Bearer " + (opts.token || SUPABASE_ANON));
        if (body !== undefined) xhr.setRequestHeader("Content-Type", "application/json");
        if (opts.prefer) xhr.setRequestHeader("Prefer", opts.prefer);
        if (!opts.sync) xhr.timeout = 20000;
        function result() {
            var data = null;
            try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch (e) { data = xhr.responseText; }
            return { ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data: data };
        }
        var payload = body === undefined ? null : JSON.stringify(body);
        if (opts.sync) {
            try { xhr.send(payload); } catch (e) { return { ok: false, status: 0, data: null }; }
            return result();
        }
        return new Promise(function (resolve) {
            xhr.onload = function () { resolve(result()); };
            xhr.onerror = xhr.ontimeout = function () { resolve({ ok: false, status: 0, data: null }); };
            xhr.send(payload);
        });
    }
    function errMsg(r) {
        var d = r && r.data, m = (d && (d.msg || d.message || d.error_description || d.error)) || "";
        if (!r || r.status === 0) return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
        if (/Invalid login credentials/i.test(m)) return "Sai email hoặc mật khẩu.";
        if (/already registered|already exists/i.test(m)) return "Email này đã có tài khoản, hãy đăng nhập.";
        if (/Password should be at least/i.test(m)) return "Mật khẩu phải có ít nhất 6 ký tự.";
        if (/Email not confirmed/i.test(m)) return "Email chưa được xác nhận. Mở hộp thư và bấm link xác nhận trước.";
        if (/valid email|invalid format/i.test(m)) return "Email không hợp lệ.";
        if (/PGRST205|Could not find the table/i.test(m + (d && d.code))) return "Chưa tạo bảng progress trên Supabase (chạy đoạn SQL trong CLAUDE.md).";
        if (/rate limit/i.test(m)) return "Thao tác quá nhiều lần, hãy đợi một lát.";
        return m || ("Lỗi máy chủ (" + r.status + ")");
    }

    // ---------- Phiên đăng nhập ----------
    function setSession(d) {
        if (!d || !d.access_token) return false;
        session = {
            access_token: d.access_token, refresh_token: d.refresh_token,
            expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
            user: { id: d.user && d.user.id, email: d.user && d.user.email }
        };
        saveSession();
        return true;
    }
    function tokenFresh() { return session && session.expires_at - 60 > Date.now() / 1000; }
    function refreshSync() {
        var r = request("POST", "/auth/v1/token?grant_type=refresh_token", { refresh_token: session.refresh_token }, { sync: true });
        if (r.ok) return setSession(r.data);
        if (r.status === 400 || r.status === 401) { session = null; saveSession(); }
        return false;
    }
    function ensureToken() {
        if (!session) return Promise.resolve(false);
        if (tokenFresh()) return Promise.resolve(true);
        return request("POST", "/auth/v1/token?grant_type=refresh_token", { refresh_token: session.refresh_token }).then(function (r) {
            if (r.ok) return setSession(r.data);
            if (r.status === 400 || r.status === 401) { session = null; saveSession(); notify(); }
            return false;
        });
    }

    // ---------- Gộp dữ liệu khi cả hai phía cùng thay đổi ----------
    function isObj(x) { return x && typeof x === "object" && !Array.isArray(x); }
    function recency(o) {   // thời điểm gần nhất ghi trong một bản ghi (số ms hoặc chuỗi ngày)
        var best = 0;
        for (var k in o) {
            var v = o[k];
            if (typeof v === "number" && v > 1e12 && v < 1e13) best = Math.max(best, v);
            else if (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v)) { var t = Date.parse(v); if (t) best = Math.max(best, t); }
        }
        return best;
    }
    function mergeAny(a, b, preferA, depth) {
        if (isObj(a) && isObj(b)) {
            var ra = recency(a), rb = recency(b);
            if (depth >= 1 && (ra || rb)) return ra >= rb ? a : b;   // một bản ghi (thẻ SRS, tiến độ bài…): lấy bản mới hơn
            var out = {}, k;
            for (k in b) out[k] = b[k];
            for (k in a) out[k] = (k in b) ? mergeAny(a[k], b[k], preferA, depth + 1) : a[k];
            return out;
        }
        if (Array.isArray(a) && Array.isArray(b)) {
            var prim = a.concat(b).every(function (x) { return x === null || typeof x !== "object"; });
            if (prim) { var seen = {}, res = []; a.concat(b).forEach(function (x) { var s = JSON.stringify(x); if (!seen[s]) { seen[s] = 1; res.push(x); } }); return res; }
            return preferA ? a : b;
        }
        if (typeof a === "number" && typeof b === "number") return Math.max(a, b);
        if (typeof a === "boolean" && typeof b === "boolean") return a || b;
        if (a === undefined || a === null) return b;
        if (b === undefined || b === null) return a;
        return preferA ? a : b;
    }
    function mergeValues(local, remote, localTime, remoteTime) {
        var A, B;
        try { A = JSON.parse(local); B = JSON.parse(remote); } catch (e) { return localTime > remoteTime ? local : remote; }
        if (!isObj(A) || !isObj(B)) return localTime > remoteTime ? local : remote;
        return JSON.stringify(mergeAny(A, B, localTime > remoteTime, 0));
    }

    // ---------- Tải về (pull) ----------
    function applyRows(rows) {
        var changed = [];
        var remoteKeys = {};
        applying = true;
        try {
            (rows || []).forEach(function (row) {
                if (!isTracked(row.key)) return;
                remoteKeys[row.key] = 1;
                var m = meta.keys[row.key] || (meta.keys[row.key] = {});
                var rt = Date.parse(row.updated_at) || 0;
                var remoteChanged = !m.rv || rt > (Date.parse(m.rv) || 0);
                if (!remoteChanged) return;
                var local = lsGet(row.key);
                if (local === null || !m.d || local === row.value) {
                    if (local !== row.value) { lsSet(row.key, row.value); changed.push(row.key); }
                    meta.keys[row.key] = { rv: row.updated_at };
                } else {
                    var merged = mergeValues(local, row.value, m.t || 0, rt);
                    if (merged !== local) { lsSet(row.key, merged); changed.push(row.key); }
                    meta.keys[row.key] = { rv: row.updated_at, d: 1, t: Date.now() };   // cần đẩy bản đã gộp lên
                }
            });
            // Key có trên máy này mà máy chủ chưa có (vd. lần đầu đăng nhập) -> đẩy lên
            for (var i = 0; i < store.length; i++) {
                var k = store.key(i);
                if (isTracked(k) && !remoteKeys[k]) {
                    var m2 = meta.keys[k] || (meta.keys[k] = {});
                    if (!m2.rv) { m2.d = 1; m2.t = m2.t || Date.now(); }
                }
            }
        } finally { applying = false; }
        meta.lastPull = Date.now();
        meta.error = null;
        saveMeta();
        return changed;
    }
    var SELECT = "/rest/v1/progress?select=key,value,updated_at";
    function pullSync() {     // dùng khi tải trang: chặn trang vài trăm ms để trang khởi tạo bằng dữ liệu mới nhất
        if (!tokenFresh() && !refreshSync()) return;
        var r = request("GET", SELECT, undefined, { sync: true, token: session.access_token });
        if (r.ok) applyRows(r.data); else { meta.error = errMsg(r); saveMeta(); }
    }
    function pull() {
        return ensureToken().then(function (ok) {
            if (!ok) return null;
            return request("GET", SELECT, undefined, { token: session.access_token }).then(function (r) {
                if (!r.ok) { meta.error = errMsg(r); saveMeta(); notify(); return null; }
                var changed = applyRows(r.data);
                notify();
                return changed;
            });
        });
    }

    // ---------- Đẩy lên (push) ----------
    function schedulePush() {
        if (!session) return;
        clearTimeout(pushTimer);
        pushTimer = setTimeout(push, PUSH_DELAY);
    }
    function push() {
        if (!session || pushing) return Promise.resolve(false);
        var dirty = Object.keys(meta.keys).filter(function (k) { return meta.keys[k].d && isTracked(k); });
        if (!dirty.length) return Promise.resolve(true);
        pushing = true;
        var sentAt = Date.now();
        return ensureToken().then(function (ok) {
            if (!ok) return false;
            // updated_at do máy chủ đặt (trigger) để không phụ thuộc đồng hồ của từng máy
            var upserts = [], deletes = [];
            dirty.forEach(function (k) { var v = lsGet(k); if (v === null) deletes.push(k); else upserts.push({ user_id: session.user.id, key: k, value: v }); });
            var jobs = [];
            if (upserts.length) jobs.push(request("POST", "/rest/v1/progress?on_conflict=user_id,key", upserts,
                { token: session.access_token, prefer: "resolution=merge-duplicates,return=representation" }).then(function (r) {
                if (!r.ok) throw r;
                (r.data || []).forEach(function (row) {
                    var m = meta.keys[row.key] || {};
                    // Chỉ xóa cờ bẩn nếu không có lần ghi mới hơn trong lúc đang gửi
                    meta.keys[row.key] = (m.t && m.t > sentAt) ? { rv: row.updated_at, d: 1, t: m.t } : { rv: row.updated_at };
                });
            }));
            deletes.forEach(function (k) {
                jobs.push(request("DELETE", "/rest/v1/progress?key=eq." + encodeURIComponent(k), undefined, { token: session.access_token }).then(function (r) {
                    if (!r.ok) throw r;
                    delete meta.keys[k];
                }));
            });
            return Promise.all(jobs).then(function () {
                meta.lastPush = Date.now(); meta.error = null; saveMeta(); notify(); return true;
            });
        }).catch(function (r) {
            meta.error = errMsg(r); saveMeta(); notify(); return false;
        }).then(function (res) { pushing = false; return res; });
    }

    // ---------- Đăng ký / đăng nhập / đăng xuất ----------
    function afterLogin() {
        meta = { keys: {} };     // tài khoản mới trên máy này: gộp toàn bộ với dữ liệu trên máy chủ
        saveMeta();
        return pull().then(function () { return push(); }).then(function () {
            notify();
            return { ok: true };
        });
    }
    var api = {
        user: function () { return session && session.user ? session.user : null; },
        status: function () { return { lastPull: meta.lastPull || 0, lastPush: meta.lastPush || 0, error: meta.error || null,
            pending: Object.keys(meta.keys).filter(function (k) { return meta.keys[k].d; }).length }; },
        signIn: function (email, password) {
            return request("POST", "/auth/v1/token?grant_type=password", { email: email, password: password }).then(function (r) {
                if (!r.ok || !setSession(r.data)) return { ok: false, error: errMsg(r) };
                return afterLogin();
            });
        },
        signUp: function (email, password) {
            return request("POST", "/auth/v1/signup", { email: email, password: password }).then(function (r) {
                if (!r.ok) return { ok: false, error: errMsg(r) };
                if (setSession(r.data)) return afterLogin();
                return { ok: true, confirm: true };   // Supabase đang bật "Confirm email"
            });
        },
        signOut: function () {
            var s = session;
            return push().then(function () {
                if (s) request("POST", "/auth/v1/logout", {}, { token: s.access_token });
                session = null; saveSession();
                meta = { keys: {} }; saveMeta();
                notify();
            });
        },
        syncNow: function () {
            return pull().then(function (changed) { return push().then(function () { return changed || []; }); });
        },
        onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); },
        open: function () { openDialog(); },
        _merge: mergeValues
    };
    window.HocSync = api;

    // ---------- Khi tải trang ----------
    if (session) {
        var online = !("onLine" in navigator) || navigator.onLine;
        if (online && Date.now() - (meta.lastPull || 0) > PULL_ON_LOAD_MIN_GAP) {
            try { pullSync(); } catch (e) { console.warn("[sync]", e); }
        }
    }
    window.addEventListener("load", function () { if (session) setTimeout(push, 1500); });
    // Quay lại tab sau một lúc: kiểm tra máy khác có học thêm không
    document.addEventListener("visibilitychange", function () {
        if (!session) return;
        if (document.visibilityState === "hidden") { push(); return; }
        if (Date.now() - (meta.lastPull || 0) < 60000) return;
        ensureToken().then(function (ok) {
            if (!ok) return;
            request("GET", "/rest/v1/progress?select=key,updated_at", undefined, { token: session.access_token }).then(function (r) {
                if (!r.ok) return;
                var newer = (r.data || []).some(function (row) {
                    var m = meta.keys[row.key];
                    return isTracked(row.key) && (!m || !m.rv || Date.parse(row.updated_at) > Date.parse(m.rv));
                });
                if (newer) showBanner();
            });
        });
    });
    window.addEventListener("online", function () { if (session) push(); });

    // ---------- Giao diện ----------
    var CSS = "" +
        ".hs-ov{position:fixed;inset:0;background:var(--ui-overlay,rgba(15,23,42,.45));display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px}" +
        ".hs-box{background:var(--ui-surface,#fff);color:var(--ui-text,#0f172a);border:1px solid var(--ui-border,#ddd);border-radius:16px;box-shadow:var(--ui-shadow-lg);width:100%;max-width:380px;padding:22px;font-family:var(--ui-font-sans,system-ui,sans-serif)}" +
        ".hs-box h3{margin:0 0 4px;font-size:19px}.hs-box p{margin:0 0 14px;color:var(--ui-muted,#64748b);font-size:13.5px;line-height:1.5}" +
        ".hs-box label{display:block;font-size:13px;font-weight:600;margin:10px 0 4px}" +
        ".hs-box input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--ui-border-strong,#ccc);background:var(--ui-surface-2,#f1f5f9);color:inherit;font:inherit;font-size:15px}" +
        ".hs-box input:focus{outline:2px solid var(--ui-primary,#4f46e5);outline-offset:0;border-color:transparent}" +
        ".hs-row{display:flex;gap:8px;margin-top:16px}.hs-btn{flex:1;padding:10px 12px;border-radius:10px;border:1px solid var(--ui-border-strong,#ccc);background:var(--ui-surface,#fff);color:inherit;font:inherit;font-weight:600;cursor:pointer}" +
        ".hs-btn:disabled{opacity:.6;cursor:wait}.hs-btn.pri{background:var(--ui-primary,#4f46e5);border-color:transparent;color:var(--ui-on-primary,#fff)}" +
        ".hs-msg{margin-top:12px;font-size:13.5px;min-height:1em}.hs-msg.err{color:var(--ui-danger,#dc2626)}.hs-msg.ok{color:var(--ui-success,#047857)}" +
        ".hs-link{background:none;border:0;color:var(--ui-primary,#4f46e5);cursor:pointer;font:inherit;font-size:13.5px;padding:0;margin-top:12px}" +
        ".hs-x{float:right;background:none;border:0;font-size:20px;line-height:1;cursor:pointer;color:var(--ui-muted,#64748b)}" +
        ".hs-banner{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99998;background:var(--ui-surface,#fff);color:var(--ui-text,#0f172a);border:1px solid var(--ui-border-strong,#ccc);box-shadow:var(--ui-shadow-lg);border-radius:12px;padding:10px 12px 10px 16px;display:flex;gap:10px;align-items:center;font:14px var(--ui-font-sans,system-ui,sans-serif);max-width:calc(100% - 32px)}" +
        "[data-hoc-account]{cursor:pointer}";
    function injectCss() {
        if (document.getElementById("hs-css")) return;
        var s = document.createElement("style"); s.id = "hs-css"; s.textContent = CSS; document.head.appendChild(s);
    }
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function timeAgo(ms) {
        if (!ms) return "chưa";
        var s = Math.round((Date.now() - ms) / 1000);
        if (s < 60) return "vừa xong";
        if (s < 3600) return Math.round(s / 60) + " phút trước";
        if (s < 86400) return Math.round(s / 3600) + " giờ trước";
        return new Date(ms).toLocaleDateString("vi-VN");
    }
    function renderButtons() {
        var els = document.querySelectorAll("[data-hoc-account]");
        var u = api.user(), st = api.status();
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (!el.hasAttribute("title") || el.getAttribute("data-hs-auto-title")) {
                el.setAttribute("data-hs-auto-title", "1");
                el.title = u ? ("Đã đăng nhập: " + u.email + (st.error ? " · Lỗi đồng bộ" : " · Đồng bộ " + timeAgo(Math.max(st.lastPush, st.lastPull)))) : "Đăng nhập để lưu tiến độ trên mọi máy";
            }
            var label = el.querySelector("[data-hoc-account-label]") || el;
            label.textContent = u ? (st.error ? "⚠️ " : "☁️ ") + u.email.split("@")[0] : "Đăng nhập";
            el.classList.toggle("is-signed-in", !!u);
        }
    }
    function closeDialog() { var o = document.getElementById("hs-ov"); if (o) o.remove(); }
    function openDialog(mode) {
        injectCss(); closeDialog();
        var u = api.user();
        var ov = document.createElement("div");
        ov.className = "hs-ov"; ov.id = "hs-ov";
        ov.addEventListener("click", function (e) { if (e.target === ov) closeDialog(); });
        document.addEventListener("keydown", function onKey(e) { if (e.key === "Escape") { closeDialog(); document.removeEventListener("keydown", onKey); } });
        if (u) {
            var st = api.status();
            ov.innerHTML = '<div class="hs-box" role="dialog" aria-modal="true"><button class="hs-x" aria-label="Đóng">×</button>' +
                '<h3>Tài khoản</h3><p>Đang đăng nhập: <b>' + esc(u.email) + '</b><br>Tiến độ học được lưu trên máy chủ và tự đồng bộ giữa các máy.</p>' +
                '<p>Lần đồng bộ gần nhất: <b>' + esc(timeAgo(Math.max(st.lastPull, st.lastPush))) + '</b>' + (st.pending ? ' · ' + st.pending + ' mục chờ gửi' : '') + '</p>' +
                '<div class="hs-msg ' + (st.error ? 'err' : '') + '">' + esc(st.error || "") + '</div>' +
                '<div class="hs-row"><button class="hs-btn pri" data-a="sync">Đồng bộ ngay</button><button class="hs-btn" data-a="out">Đăng xuất</button></div></div>';
        } else {
            var reg = mode === "signup";
            ov.innerHTML = '<div class="hs-box" role="dialog" aria-modal="true"><button class="hs-x" aria-label="Đóng">×</button>' +
                '<h3>' + (reg ? 'Tạo tài khoản' : 'Đăng nhập') + '</h3>' +
                '<p>Đăng nhập để lưu lộ trình học trên máy chủ, đổi máy vẫn học tiếp được. Tiến độ đang có trên máy này sẽ được gộp vào tài khoản.</p>' +
                '<form><label for="hs-email">Email</label><input id="hs-email" type="email" autocomplete="email" required>' +
                '<label for="hs-pw">Mật khẩu' + (reg ? ' (ít nhất 6 ký tự)' : '') + '</label><input id="hs-pw" type="password" minlength="6" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" required>' +
                '<div class="hs-msg"></div>' +
                '<div class="hs-row"><button class="hs-btn pri" type="submit">' + (reg ? 'Đăng ký' : 'Đăng nhập') + '</button></div></form>' +
                '<button class="hs-link" data-a="switch">' + (reg ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký') + '</button></div>';
        }
        document.body.appendChild(ov);
        var box = ov.querySelector(".hs-box"), msg = ov.querySelector(".hs-msg");
        function say(t, cls) { msg.className = "hs-msg " + (cls || ""); msg.textContent = t; }
        ov.querySelector(".hs-x").onclick = closeDialog;
        box.addEventListener("click", function (e) {
            var a = e.target.getAttribute && e.target.getAttribute("data-a");
            if (a === "switch") openDialog(mode === "signup" ? "signin" : "signup");
            if (a === "sync") {
                e.target.disabled = true; say("Đang đồng bộ…");
                api.syncNow().then(function (changed) {
                    if (api.status().error) { say(api.status().error, "err"); e.target.disabled = false; return; }
                    if (changed.length) { say("Đã tải tiến độ mới, đang tải lại trang…", "ok"); setTimeout(function () { location.reload(); }, 600); }
                    else { say("Đã đồng bộ.", "ok"); e.target.disabled = false; }
                });
            }
            if (a === "out") {
                e.target.disabled = true; say("Đang lưu và đăng xuất…");
                api.signOut().then(function () { closeDialog(); });
            }
        });
        var form = ov.querySelector("form");
        if (form) {
            setTimeout(function () { ov.querySelector("#hs-email").focus(); }, 30);
            form.addEventListener("submit", function (e) {
                e.preventDefault();
                var btn = form.querySelector("button[type=submit]");
                var email = ov.querySelector("#hs-email").value.trim(), pw = ov.querySelector("#hs-pw").value;
                btn.disabled = true; say(mode === "signup" ? "Đang tạo tài khoản…" : "Đang đăng nhập…");
                (mode === "signup" ? api.signUp(email, pw) : api.signIn(email, pw)).then(function (r) {
                    btn.disabled = false;
                    if (!r.ok) { say(r.error, "err"); return; }
                    if (r.confirm) { say("Đã tạo tài khoản. Mở email và bấm link xác nhận, sau đó quay lại đăng nhập.", "ok"); return; }
                    say("Thành công! Đang tải lại trang với tiến độ của tài khoản…", "ok");
                    setTimeout(function () { location.reload(); }, 700);
                });
            });
        }
    }
    function showBanner() {
        if (document.getElementById("hs-banner")) return;
        injectCss();
        var b = document.createElement("div");
        b.className = "hs-banner"; b.id = "hs-banner";
        b.innerHTML = '<span>☁️ Có tiến độ mới từ máy khác.</span><button class="hs-btn pri" style="flex:none">Tải lại</button><button class="hs-x" aria-label="Đóng" style="float:none">×</button>';
        b.querySelector(".pri").onclick = function () { location.reload(); };
        b.querySelector(".hs-x").onclick = function () { b.remove(); };
        document.body.appendChild(b);
    }
    document.addEventListener("click", function (e) {
        var t = e.target.closest && e.target.closest("[data-hoc-account]");
        if (t) { e.preventDefault(); openDialog(); }
    });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderButtons); else renderButtons();
})();
