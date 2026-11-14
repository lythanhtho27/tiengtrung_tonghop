/* ==========================================================================
   SHARED/PROGRESS.JS — Tóm tắt tiến độ để trang chủ hiển thị lộ trình
   Mỗi trang gọi HocProgress.save("<trang>", {...}) mỗi khi tiến độ thay đổi.
   Trang chủ đọc bằng HocProgress.load("<trang>") / HocProgress.all().

   Key localStorage: "hoc_summary_v1:<trang>"   (trang: hsk_lotrinh | boya_learning | tuvung | word_learning | luyen_tap | hom_nay | doc_them)
   Dữ liệu (mọi trường đều tùy chọn trừ at):
   {
     at: 1731470000000,                 // thời điểm cập nhật (ms), tự điền
     next: "Chuẩn Trung cấp 1 · Bài 3", // bước nên học tiếp
     nextUrl: "boya_learning/boya_learning.html?book=tc1&lesson=3",  // TÍNH TỪ THƯ MỤC GỐC
     due: 12,                           // số từ đến hạn ôn hôm nay
     learned: 340,                      // số từ đã học
     today: { n: 10, r: 25 },           // hôm nay: từ mới / lượt ôn
     groups: {                          // tiến độ theo nhóm: quyển Boya (tc1..tc4, gc1, gc2) hoặc cấp HSK ("hsk1".."hsk6")
       tc1: { done: 3, total: 15, label: "Chuẩn Trung cấp 1" }
     }
   }
   ========================================================================== */
(function () {
    "use strict";
    var PREFIX = "hoc_summary_v1:";
    var PAGES = ["hsk_lotrinh", "boya_learning", "tuvung", "word_learning", "luyen_tap", "hom_nay", "doc_them"];
    window.HocProgress = {
        save: function (page, data) {
            try {
                var o = Object.assign({}, data || {}, { at: Date.now() });
                localStorage.setItem(PREFIX + page, JSON.stringify(o));
            } catch (e) { /* bộ nhớ bị chặn: bỏ qua */ }
        },
        load: function (page) {
            try { var v = localStorage.getItem(PREFIX + page); return v ? JSON.parse(v) : null; }
            catch (e) { return null; }
        },
        all: function () {
            var out = {};
            for (var i = 0; i < PAGES.length; i++) out[PAGES[i]] = this.load(PAGES[i]);
            return out;
        },
    };
})();
