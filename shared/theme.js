/* ==========================================================================
   SHARED/THEME.JS — Chế độ sáng/tối dùng chung cho mọi trang
   - Nạp ĐỒNG BỘ trong <head> (không defer) để không bị chớp màu khi tải trang:
       <link rel="stylesheet" href="../shared/theme.css">
       <script src="../shared/theme.js"></script>
   - Lưu ở localStorage "hoc_theme" = "light" | "dark". Chưa chọn thì theo hệ điều hành.
   - Đặt html[data-theme]. Đổi ở một trang/tab thì các tab khác tự đổi theo.
   - API:  HocTheme.get()  HocTheme.set("dark")  HocTheme.toggle()
           HocTheme.onChange(fn)   // fn(theme) mỗi khi đổi
   - Mọi phần tử có thuộc tính [data-ui-theme-toggle] tự thành nút đổi sáng/tối.
   ========================================================================== */
(function () {
    "use strict";
    var KEY = "hoc_theme";
    var listeners = [];

    function stored() {
        try { var v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : null; }
        catch (e) { return null; }
    }
    function system() {
        try { return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
        catch (e) { return "light"; }
    }
    function apply(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        for (var i = 0; i < listeners.length; i++) { try { listeners[i](theme); } catch (e) { console.error(e); } }
        try { document.dispatchEvent(new CustomEvent("hoc-theme-change", { detail: theme })); } catch (e) {}
    }
    var current = stored() || system();
    document.documentElement.setAttribute("data-theme", current);

    var api = {
        get: function () { return current; },
        set: function (theme) {
            if (theme !== "light" && theme !== "dark") return;
            current = theme;
            try { localStorage.setItem(KEY, theme); } catch (e) {}
            apply(theme);
        },
        toggle: function () { api.set(current === "dark" ? "light" : "dark"); return current; },
        onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); },
    };
    window.HocTheme = api;

    // Đồng bộ giữa các tab
    window.addEventListener("storage", function (e) {
        if (e.key === KEY && (e.newValue === "light" || e.newValue === "dark") && e.newValue !== current) {
            current = e.newValue; apply(current);
        }
    });
    // Theo hệ điều hành khi người dùng chưa tự chọn
    try {
        matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
            if (!stored()) { current = system(); apply(current); }
        });
    } catch (e) {}
    // Nút đổi sáng/tối dùng chung
    document.addEventListener("click", function (e) {
        var t = e.target.closest && e.target.closest("[data-ui-theme-toggle]");
        if (t) { e.preventDefault(); api.toggle(); }
    });
})();
