/* ==========================================================================
   DOC_THEM/COMIC_ART.JS — Chế độ Truyện tranh (Comic / Webtoon) cho Đọc thêm
   - Kết hợp tranh AI vẽ riêng (thư mục comics/) và bộ dựng cảnh SVG đa lớp theo ngữ cảnh
     cho toàn bộ truyện HSK 4+ (và hoạt động tốt với mọi bài đọc / hội thoại / thành ngữ).
   - Bảo toàn nguyên vẹn chỉ số ký tự (.lk-c[data-i]) trong .ptext[data-lk-text] để tra từ,
     tô từ chưa học, nhại câu và lưu câu hoạt động chính xác 100%.
   ========================================================================== */
(function () {
    "use strict";

    var HAN = /[㐀-鿿]/;

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    // ====================================================================== 1. Tranh AI vẽ riêng (comics/)
    // Mỗi bài có thể ánh xạ từng chỉ số đoạn (paragraph index) sang ảnh và góc nhìn (focal crop)
    var AI_STORIES = [
        {
            id: "h4-01",
            title: "爷爷的红包",
            title_vi: "Bao lì xì của ông nội",
            level: 4,
            kind: "article",
            thumb: "comics/h4-01_s4.png",
            tag: "Gia đình · Tết"
        },
        {
            id: "s6-01",
            title: "失物招领处的狐狸 · Ch.1",
            title_vi: "Chú cáo ở phòng đồ thất lạc · Ch.1",
            level: 4,
            kind: "series",
            thumb: "comics/s6-01_s3.png",
            tag: "Furry · Bí ẩn"
        }
    ];

    var AI_PANELS = {
        "h4-01": {
            0: { src: "comics/h4-01_s1.png", pos: "50% 45%", zoom: 1, tag: "Đêm giao thừa · Sum họp" },
            1: { src: "comics/h4-01_s1.png", pos: "62% 38%", zoom: 1.12, tag: "Phong bao lì xì đỏ" },
            2: { src: "comics/h4-01_s1.png", pos: "32% 40%", zoom: 1.14, tag: "Kỷ niệm tuổi thơ" },
            3: { src: "comics/h4-01_s2.png", pos: "72% 48%", zoom: 1.1, tag: "Giật lì xì WeChat" },
            4: { src: "comics/h4-01_s2.png", pos: "24% 46%", zoom: 1.14, tag: "Ông ngồi trên sofa" },
            5: { src: "comics/h4-01_s3.png", pos: "50% 45%", zoom: 1, tag: "Chỉ ông bấm điện thoại" },
            6: { src: "comics/h4-01_s4.png", pos: "46% 42%", zoom: 1.06, tag: "Lì xì đầu tiên của ông" },
            7: { src: "comics/h4-01_s4.png", pos: "50% 48%", zoom: 1, tag: "Tấm lòng gia đình" }
        },
        "s6-01": {
            0: { src: "comics/s6-01_s1.png", pos: "52% 40%", zoom: 1.04, tag: "Ga Trung tâm Lục Lâm" },
            1: { src: "comics/s6-01_s1.png", pos: "76% 36%", zoom: 1.14, tag: "Đại sảnh nhộn nhịp" },
            2: { src: "comics/s6-01_s1.png", pos: "36% 52%", zoom: 1.12, tag: "Ba lô biến mất!" },
            6: { src: "comics/s6-01_s3.png", pos: "42% 40%", zoom: 1.08, tag: "Hộp nhạc khắc đuôi cáo" },
            7: { src: "comics/s6-01_s3.png", pos: "62% 48%", zoom: 1.06, tag: "Bí mật mười bốn năm" }
        }
    };

    // Dữ liệu sinh bởi tools/comics/build_comics.py (comic_data.js): ảnh từng đoạn + tên người nói từng câu thoại
    var SPEAKERS = {};
    (function mergeGenerated() {
        var gen = window.HOC_COMIC_DATA && window.HOC_COMIC_DATA.series;
        if (!gen) return;
        Object.keys(gen).forEach(function (sid) {
            var g = gen[sid] || {};
            if (g.story) AI_STORIES.push(g.story);
            Object.keys(g.panels || {}).forEach(function (docId) { AI_PANELS[docId] = g.panels[docId]; });
            Object.keys(g.speakers || {}).forEach(function (docId) { SPEAKERS[docId] = g.speakers[docId]; });
        });
    })();

    // Tên người nói của câu thoại `inner` ở đoạn `pIdx` (khớp theo nội dung câu, không theo thứ tự)
    function knownSpeaker(doc, pIdx, inner) {
        var list = doc && SPEAKERS[doc.id] && SPEAKERS[doc.id][pIdx];
        if (!list) return null;
        var key = inner.replace(/\s/g, "");
        for (var i = 0; i < list.length; i++) {
            var zh = String(list[i][0]).replace(/\s/g, "");
            if (zh === key || (zh.length >= 4 && (key.indexOf(zh) === 0 || zh.indexOf(key) === 0))) return list[i][1];
        }
        return null;
    }

    function hasAI(docId) {
        return !!AI_PANELS[docId];
    }

    function aiStories() {
        return AI_STORIES.slice();
    }

    function getAIFrame(docId, idx) {
        var map = AI_PANELS[docId];
        return (map && map[idx]) || null;
    }

    // ====================================================================== 2. Bộ phân tích ngữ cảnh & nhân vật
    var SERIES_INFO = {
        s1: { bg: "kitchen", label: "Hàng Châu · Bát canh nhớ nhà", isFurry: false, isAncient: false, mainChar: "young_m" },
        s2: { bg: "alley", label: "Trấn Thanh Khê · Tháp chuông", isFurry: false, isAncient: false, mainChar: "young_f" },
        s3: { bg: "office", label: "Thâm Quyến · Đèn khuya", isFurry: false, isAncient: false, mainChar: "young_f" },
        s4: { bg: "ancient", label: "Trường An · Ngàn ba trăm năm", isFurry: false, isAncient: true, mainChar: "young_f" },
        s5: { bg: "kitchen", label: "Quán cà phê góc phố", isFurry: false, isAncient: false, mainChar: "young_f" },
        s6: { bg: "lostfound", label: "Thành Lục Lâm · Phòng thất lạc", isFurry: true, isAncient: false, mainChar: "red_fox" },
        s7: { bg: "desert", label: "Sa mạc · Đi tìm Hồ Trăng", isFurry: true, isAncient: false, mainChar: "otter" },
        s8: { bg: "museum", label: "Vụ án Giọt Lệ Sao", isFurry: true, isAncient: false, mainChar: "cat" },
        s9: { bg: "theater", label: "Nhà hát Lục Lâm · Họa mi", isFurry: true, isAncient: false, mainChar: "cat" },
        s10: { bg: "alley", label: "Bưu điện cũ · Bức thư 10 năm", isFurry: true, isAncient: false, mainChar: "cat" }
    };

    var CHAR_RULES = [
        // Furry & động vật
        { type: "red_fox", name: "A Chanh", re: /阿橙|红狐狸|狐狸/ },
        { type: "cat", name: "Dạ Bạch", re: /夜白|侦探/ },
        { type: "white_fox", name: "Bạch Sương", re: /白霜/ },
        { type: "tortoise", name: "Quy Bá", re: /龟伯|老乌龟|乌龟/ },
        { type: "deer", name: "Lộc Minh", re: /鹿鸣|小鹿|长颈鹿/ },
        { type: "otter", name: "Tiểu Mãn", re: /水獭|小满/ },
        { type: "squirrel", name: "A Lật", re: /阿栗|松鼠/ },
        { type: "hedgehog", name: "Thích Thích", re: /刺刺|刺猬/ },
        { type: "bird", name: "Chim", re: /夜莺|小夜|鹦鹉|小鸟|喜鹊|鸟笼|乌鸦|鹰|鸽/ },
        { type: "cat", name: "Mèo", re: /小猫|老猫|猫|米饭/ },
        { type: "frog", name: "Ếch", re: /青蛙|井底/ },
        { type: "rabbit", name: "Thỏ", re: /兔子|小兔|兔/ },
        { type: "ox", name: "Trâu / Bò", re: /牛主编|老牛|公牛|水牛|牛/ },
        { type: "tiger", name: "Hổ", re: /老虎|虎/ },
        { type: "monkey", name: "Khỉ", re: /猴子|猴/ },
        { type: "horse", name: "Ngựa", re: /塞翁|骏马|骑马|马儿|白马/ },
        { type: "bear", name: "Gấu / Gấu trúc", re: /熊婶|熊猫|胖胖|熊/ },
        // Nhân vật người
        { type: "grandpa", name: "Ông / Bác", re: /爷爷|外公|老大爷|老陈|老李|老张|老王|老爷爷|龟伯|老师傅|老人|父亲|爸爸|叔叔|伯伯/ },
        { type: "grandma", name: "Bà / Mẹ", re: /奶奶|外婆|老奶奶|阿姨|母亲|妈妈|熊婶/ },
        { type: "kid", name: "Bé / Học sinh", re: /小时候|小孩|孩子|小东|小林|孙子|孙女|小男孩|小女孩|小学生|儿子|女儿/ },
        { type: "ancient_scholar", name: "Người xưa", re: /宋国|楚国|秦国|齐国|赵国|魏国|农民|皇帝|将军|士兵|先生|国王|将军|诸葛亮|刘备/ },
        { type: "young_f", name: "Cô gái", re: /林小雨|林晓|陈静|李静|小芳|小美|小丽|小雨|阮秋河|阮兰|女孩|姑娘|小姐|女同事|女友|女朋友|妻子/ },
        { type: "young_m", name: "Chàng trai", re: /张明|张伟|刘阳|阿明|阮明|小马|小王|小李|程序员|小伙子|男人|男同事|男朋友|丈夫/ }
    ];

    function detectBg(txt, doc, sInfo) {
        if (/失物招领|架子|木盒|雨伞|登记本/.test(txt)) return { bg: "lostfound", label: "Phòng đồ thất lạc" };
        if (/高铁|火车|地铁|站台|车站|车厢|飞机|机场|出租车/.test(txt)) return { bg: "station", label: "Nhà ga / Chuyến đi" };
        if (/沙漠|沙丘|月亮湖|绿洲|骆驼|风沙/.test(txt)) return { bg: "desert", label: "Sa mạc · Hồ Trăng" };
        if (/大剧院|舞台|海报|唱歌|歌声|琴声|钢琴|比赛|演出/.test(txt)) return { bg: "theater", label: "Sân khấu / Âm nhạc" };
        if (/宝石|星之泪|失窃|案子|线索|博物馆|文物|展览|警察|侦探/.test(txt)) return { bg: "museum", label: "Điều tra / Hiện trường" };
        if (/黄山|爬山|山顶|日出|云海|长城|瀑布/.test(txt)) return { bg: "mountain", label: "Núi non · Bình minh" };
        if (/草原|内蒙古|蒙古包|放羊|奶茶/.test(txt)) return { bg: "grassland", label: "Thảo nguyên" };
        if (/漓江|竹筏|船|渡船|龙舟|河边|湖边/.test(txt)) return { bg: "river", label: "Sông nước · Thuyền" };
        if (/胡同|丽江|邮局|院子|石板路|古城|青溪镇|钟楼|街道|红灯笼/.test(txt)) return { bg: "alley", label: "Phố cổ / Ngõ nhỏ" };
        if (/面馆|泡馍|火锅|早茶|厨房|烤鸭|饭馆|咖啡|牛奶|蛋糕|外卖|饺子|汤/.test(txt)) return { bg: "kitchen", label: "Quán ăn / Căn bếp" };
        if (/公司|办公室|面试|会议室|加班|电脑|教室|考试|书房|报社|学校/.test(txt)) return { bg: "office", label: "Văn phòng / Lớp học" };
        if (/春节|除夕|红包|客厅|沙发|房间|家里|卧室|床|阳台|冰箱/.test(txt)) return { bg: "home", label: "Ngôi nhà ấm áp" };
        if (doc && doc.lkind === "chengyu" || /唐朝|宋国|楚国|古代|将军|皇帝|田里|庄稼|草丛|茅庐/.test(txt)) return { bg: "ancient", label: "Bối cảnh cổ trang" };
        if (sInfo && sInfo.bg) return { bg: sInfo.bg, label: sInfo.label };
        return { bg: "home", label: "Đời sống thường ngày" };
    }

    function detectTime(txt, isAncient) {
        if (/晚上|夜晚|除夕|夜里|深夜|十一点|月亮|星星|灯笼|路灯|黑夜/.test(txt)) return "night";
        if (/下雨|大雨|雨伞|雨水|江南|淋雨/.test(txt)) return "rain";
        if (/雪|哈尔滨|零下|冰棍|冻梨|冬天|雪人/.test(txt)) return "snow";
        if (/早上|早晨|清晨|日出|天亮|六点|七点/.test(txt)) return "dawn";
        if (/黄昏|傍晚|日落|夕阳|下山/.test(txt)) return "dusk";
        if (isAncient) return "ancient";
        return "day";
    }

    function detectEmotion(txt) {
        if (/吓|吃惊|惊讶|愣住|炸了毛|呆|不见了|丢了|怎么会|竟|突然|糟糕|失窃/.test(txt)) return "shock";
        if (/笑|高兴|开心|兴奋|快乐|满意|欢呼|热乎|温暖|明白|终于|第一名|录取/.test(txt)) return "happy";
        if (/哭|难过|孤单|眼泪|红了|失望|沉默|离开|想念|叹气/.test(txt)) return "sad";
        if (/急|担心|紧张|累|困|辣|冷|汗|麻烦|生气|抱怨|批评|按错|迷路|疼/.test(txt)) return "worry";
        if (/想|以为|回忆|计划|决定|好奇|秘密|奇怪|为什么/.test(txt)) return "think";
        return "calm";
    }

    function detectProps(txt) {
        var props = [];
        if (/手机|微信|短信|电话|拍照/.test(txt)) props.push("phone");
        if (/红包|信|纸条|情书|邮局|信封/.test(txt)) props.push("envelope");
        if (/茶|咖啡|奶茶|杯/.test(txt)) props.push("tea");
        if (/面|泡馍|火锅|饺子|汤|早茶|饼|西瓜|梨|苹果/.test(txt)) props.push("food");
        if (/背包|行李|箱子|钱包/.test(txt)) props.push("bag");
        if (/盒子|八音盒|宝|镜|地图|书|登记本|笔记本|剪刀/.test(txt)) props.push("book");
        if (/雨伞|伞/.test(txt)) props.push("umbrella");
        if (/钟|表|手表/.test(txt)) props.push("clock");
        if (/照相机|照片|画/.test(txt)) props.push("photo");
        if (/自行车|车/.test(txt)) props.push("bike");
        return props.slice(0, 3);
    }

    function detectSFX(txt, emotion) {
        if (/嘀嗒/.test(txt)) return "嘀嗒…";
        if (/电话|响了/.test(txt)) return "叮铃铃!";
        if (/敲/.test(txt)) return "咚咚";
        if (/喷嚏/.test(txt)) return "阿嚏!";
        if (/雨/.test(txt)) return "哗哗…";
        if (/风/.test(txt)) return "呼呼…";
        if (/笑/.test(txt)) return "哈哈";
        if (emotion === "shock") return "啊?!";
        return "";
    }

    function analyzeScene(p, idx, doc) {
        var txt = (p && p.text) || "";
        var allTxt = doc ? [doc.title, doc.series ? doc.series.title : "", (doc.paras || []).slice(0, 3).map(function (x) { return x.text; }).join(" ")].join(" ") : txt;
        var sKey = doc && doc.series ? doc.series.id : "";
        var sInfo = SERIES_INFO[sKey] || null;
        var isFurry = !!(sInfo && sInfo.isFurry) || /绿林|阿橙|龟伯|夜白|白霜|鹿鸣|狐狸|水獭|松鼠|刺猬|夜莺|动物|尾巴/.test(allTxt);
        var isAncient = !!(sInfo && sInfo.isAncient) || (doc && doc.lkind === "chengyu") || /宋国|楚国|秦国|唐朝|古代|皇帝|将军|农民/.test(allTxt);

        var bgObj = detectBg(txt, doc, sInfo);
        var time = detectTime(txt, isAncient);
        var emotion = detectEmotion(txt);
        var props = detectProps(txt);
        var sfx = detectSFX(txt, emotion);

        // Phát hiện tối đa 2 nhân vật xuất hiện trong đoạn (hoặc từ tên nhân vật hội thoại)
        var chars = [];
        var searchStr = (p.name ? p.name + " " : "") + txt;
        for (var i = 0; i < CHAR_RULES.length && chars.length < 2; i++) {
            var r = CHAR_RULES[i];
            if (r.re.test(searchStr) && chars.indexOf(r.type) < 0) chars.push(r.type);
        }
        if (!chars.length) {
            if (sInfo && sInfo.mainChar) chars.push(sInfo.mainChar);
            else if (isAncient) chars.push("ancient_scholar");
            else if (isFurry) chars.push("red_fox");
            else chars.push("young_m");
        }
        // Nếu có lời thoại hoặc nhiều người mà mới có 1 nhân vật, bổ sung nhân vật phụ phù hợp
        if (chars.length === 1 && (/[“「]/.test(txt) || p.name)) {
            if (isFurry && chars[0] !== "tortoise") chars.push(sKey === "s6" ? "tortoise" : "deer");
            else if (/妈|奶奶|阿姨|女/.test(allTxt) && chars[0] !== "grandma") chars.push("grandma");
            else if (/爸|爷爷|叔|老/.test(allTxt) && chars[0] !== "grandpa") chars.push("grandpa");
        }

        return {
            bg: bgObj.bg,
            bgLabel: bgObj.label,
            time: time,
            emotion: emotion,
            props: props,
            sfx: sfx,
            chars: chars,
            isFurry: isFurry,
            isAncient: isAncient,
            seed: (idx + 1) * 37 + txt.length
        };
    }

    // ====================================================================== 3. Bộ dựng cảnh Truyện tranh SVG
    var PALETTES = {
        day: { sky1: "#bae6fd", sky2: "#fef3c7", wall: "#fef9ef", floor: "#e2d4b7", accent: "#0284c7" },
        dawn: { sky1: "#fed7aa", sky2: "#fde68a", wall: "#fff7ed", floor: "#d6c3a5", accent: "#ea580c" },
        dusk: { sky1: "#fb7185", sky2: "#fbbf24", wall: "#fff1f2", floor: "#a88b7d", accent: "#e11d48" },
        night: { sky1: "#0f172a", sky2: "#1e3a5f", wall: "#1e293b", floor: "#334155", accent: "#f59e0b" },
        rain: { sky1: "#475569", sky2: "#94a3b8", wall: "#cbd5e1", floor: "#64748b", accent: "#38bdf8" },
        snow: { sky1: "#cbd5e1", sky2: "#f1f5f9", wall: "#e2e8f0", floor: "#f8fafc", accent: "#0ea5e9" },
        ancient: { sky1: "#f5e6ca", sky2: "#e8d5b5", wall: "#f5ebd6", floor: "#c9b38c", accent: "#b45309" }
    };

    function svgBgLayer(sc, pal, uid) {
        var bg = sc.bg, isNight = sc.time === "night";
        var s = '<defs>' +
            '<linearGradient id="sky-' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="' + pal.sky1 + '"/><stop offset="100%" stop-color="' + pal.sky2 + '"/>' +
            '</linearGradient></defs>';
        s += '<rect width="480" height="270" fill="url(#sky-' + uid + ')"/>';

        // Mặt trời / Trăng / Sao cho cảnh ngoài trời
        if (isNight) {
            s += '<circle cx="395" cy="52" r="22" fill="#fef08a" opacity="0.95"/>';
            s += '<circle cx="404" cy="48" r="19" fill="' + pal.sky1 + '"/>';
            [[60, 35], [125, 58], [210, 28], [290, 48], [340, 25], [440, 82]].forEach(function (pt) {
                s += '<circle cx="' + pt[0] + '" cy="' + pt[1] + '" r="1.8" fill="#fef9c3" opacity="0.85"/>';
            });
        } else if (sc.time === "dawn" || sc.time === "dusk") {
            s += '<circle cx="240" cy="140" r="46" fill="#fde047" opacity="0.85"/>';
        } else if (bg !== "lostfound" && bg !== "home" && bg !== "office") {
            s += '<circle cx="410" cy="48" r="20" fill="#fef08a" opacity="0.9"/>';
            s += '<g fill="#ffffff" opacity="0.7"><ellipse cx="105" cy="52" rx="34" ry="13"/><ellipse cx="128" cy="48" rx="22" ry="11"/><ellipse cx="300" cy="42" rx="30" ry="10"/></g>';
        }

        if (bg === "lostfound") {
            // Phòng đồ thất lạc: tường gỗ, kệ sách/đồ cao chạm trần, đèn bàn vàng, đồng hồ quả lắc
            s += '<rect width="480" height="210" fill="#4a3222"/>';
            s += '<rect y="210" width="480" height="60" fill="#7c5338"/>';
            for (var x = 22; x < 430; x += 110) {
                s += '<rect x="' + x + '" y="16" width="94" height="196" fill="#634028" stroke="#3b2314" stroke-width="3"/>';
                for (var y = 62; y <= 170; y += 46) {
                    s += '<line x1="' + x + '" y1="' + y + '" x2="' + (x + 94) + '" y2="' + y + '" stroke="#3b2314" stroke-width="4"/>';
                }
            }
            // Vật dụng trên kệ: hộp gỗ, mũ, ô, bình, lồng chim
            s += '<rect x="38" y="34" width="28" height="26" rx="3" fill="#b45309" stroke="#fbbf24" stroke-width="1.5"/>'; // hộp nhạc
            s += '<circle cx="92" cy="48" r="11" fill="#38bdf8"/><rect x="148" y="84" width="32" height="22" rx="4" fill="#2563eb"/>'; // ba lô xanh
            s += '<path d="M258,60 Q272,34 286,60 Z" fill="#ef4444"/><rect x="362" y="34" width="24" height="26" rx="10" fill="none" stroke="#eab308" stroke-width="2"/>';
            // Đồng hồ quả lắc và ánh đèn ấm
            s += '<circle cx="240" cy="45" r="20" fill="#fef3c7" stroke="#78350f" stroke-width="4"/>';
            s += '<line x1="240" y1="45" x2="240" y2="33" stroke="#1e293b" stroke-width="2"/><line x1="240" y1="45" x2="249" y2="49" stroke="#1e293b" stroke-width="2"/>';
            s += '<ellipse cx="240" cy="180" rx="180" ry="70" fill="#fbbf24" opacity="0.14"/>';
        } else if (bg === "home") {
            s += '<rect width="480" height="205" fill="' + (isNight ? "#1e293b" : "#fef3c7") + '"/>';
            s += '<rect y="205" width="480" height="65" fill="' + (isNight ? "#334155" : "#d9b99b") + '"/>';
            // Cửa sổ + đèn lồng hoặc tranh treo
            s += '<rect x="44" y="36" width="96" height="84" rx="4" fill="' + pal.sky1 + '" stroke="#78350f" stroke-width="5"/>';
            s += '<line x1="92" y1="36" x2="92" y2="120" stroke="#78350f" stroke-width="3"/><line x1="44" y1="78" x2="140" y2="78" stroke="#78350f" stroke-width="3"/>';
            // Ghế sofa
            s += '<rect x="175" y="138" width="210" height="68" rx="14" fill="#dc2626" opacity="0.88"/>';
            s += '<rect x="165" y="158" width="22" height="50" rx="8" fill="#b91c1c"/><rect x="373" y="158" width="22" height="50" rx="8" fill="#b91c1c"/>';
            // Đèn lồng đỏ treo
            s += '<line x1="418" y1="0" x2="418" y2="32" stroke="#f59e0b" stroke-width="2"/>';
            s += '<ellipse cx="418" cy="50" rx="18" ry="22" fill="#ef4444" stroke="#fbbf24" stroke-width="2"/>';
        } else if (bg === "station") {
            s += '<rect y="198" width="480" height="72" fill="#94a3b8"/>';
            s += '<path d="M0,115 Q240,18 480,115 L480,198 L0,198 Z" fill="#e2e8f0" opacity="0.65"/>';
            // Tàu cao tốc màu trắng mũi xanh
            s += '<path d="M24,185 L270,185 Q315,185 322,162 Q310,138 250,138 L24,138 Z" fill="#f8fafc" stroke="#334155" stroke-width="2.5"/>';
            s += '<rect x="40" y="148" width="210" height="14" rx="3" fill="#0284c7" opacity="0.85"/>';
            s += '<line x1="24" y1="173" x2="310" y2="173" stroke="#0284c7" stroke-width="4"/>';
            // Đồng hồ nhà ga
            s += '<circle cx="395" cy="64" r="22" fill="#ffffff" stroke="#334155" stroke-width="4"/><line x1="395" y1="64" x2="395" y2="50" stroke="#0f172a" stroke-width="2.5"/><line x1="395" y1="64" x2="406" y2="68" stroke="#0f172a" stroke-width="2"/>';
        } else if (bg === "desert") {
            s += '<path d="M0,175 Q120,135 250,170 Q370,195 480,152 L480,270 L0,270 Z" fill="#f59e0b"/>';
            s += '<path d="M0,208 Q160,182 320,210 Q410,224 480,198 L480,270 L0,270 Z" fill="#d97706"/>';
            // Hồ Trăng lưỡi liềm
            s += '<ellipse cx="345" cy="228" rx="88" ry="18" fill="#0ea5e9" stroke="#fde68a" stroke-width="3"/>';
        } else if (bg === "mountain") {
            s += '<polygon points="0,240 110,98 220,240" fill="#475569"/>';
            s += '<polygon points="140,240 285,78 430,240" fill="#334155"/>';
            s += '<polygon points="310,240 430,115 480,185 480,240" fill="#64748b"/>';
            s += '<path d="M0,215 Q120,190 240,215 T480,205 L480,270 L0,270 Z" fill="#f8fafc" opacity="0.72"/>'; // biển mây
            s += '<rect y="232" width="480" height="38" fill="#1e293b"/>';
        } else if (bg === "river") {
            s += '<path d="M20,165 Q60,65 100,165 Q145,82 188,165 Q250,70 300,165 Q365,88 425,165 L480,165 L480,190 L0,190 Z" fill="#4d7c6f" opacity="0.85"/>';
            s += '<rect y="165" width="480" height="105" fill="#0ea5e9" opacity="0.75"/>';
            // Bè tre
            s += '<rect x="145" y="218" width="175" height="14" rx="5" fill="#a16207" stroke="#713f12" stroke-width="2"/>';
        } else if (bg === "grassland") {
            s += '<path d="M0,158 Q240,128 480,162 L480,270 L0,270 Z" fill="#4ade80"/>';
            s += '<path d="M0,196 Q240,175 480,204 L480,270 L0,270 Z" fill="#22c55e"/>';
            // Lều Mông Cổ (yurt)
            s += '<path d="M335,172 Q382,135 430,172 L430,205 L335,205 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>';
            s += '<rect x="374" y="176" width="18" height="29" fill="#b45309"/>';
        } else if (bg === "alley" || bg === "ancient") {
            s += '<rect y="205" width="480" height="65" fill="' + (bg === "ancient" ? "#b89f78" : "#94a3b8") + '"/>';
            // Mái nhà cổ Trung Hoa cong
            s += '<rect x="36" y="102" width="165" height="104" fill="#e2d5c3" stroke="#78350f" stroke-width="2"/>';
            s += '<path d="M20,104 Q118,52 216,104 Z" fill="#334155"/>';
            s += '<rect x="92" y="138" width="52" height="68" fill="#b91c1c"/>'; // Cửa đỏ
            if (bg === "ancient") {
                // Cây cổ thụ bên phải
                s += '<path d="M368,215 L368,95 Q335,70 315,82 M368,125 Q405,85 435,96" stroke="#78350f" stroke-width="14" stroke-linecap="round" fill="none"/>';
                s += '<circle cx="355" cy="72" r="44" fill="#15803d" opacity="0.88"/><circle cx="408" cy="88" r="36" fill="#166534" opacity="0.88"/>';
            } else {
                // Đèn lồng đỏ & hòm thư xanh cổ
                s += '<ellipse cx="176" cy="126" rx="12" ry="15" fill="#ef4444"/>';
                s += '<rect x="372" y="132" width="38" height="74" rx="6" fill="#15803d" stroke="#14532d" stroke-width="2"/>';
            }
        } else if (bg === "kitchen") {
            s += '<rect width="480" height="196" fill="' + (isNight ? "#292524" : "#fff7ed") + '"/>';
            s += '<rect y="196" width="480" height="74" fill="#d6b89c"/>';
            // Bàn gỗ + đèn thả ấm
            s += '<line x1="240" y1="0" x2="240" y2="38" stroke="#78350f" stroke-width="3"/>';
            s += '<path d="M208,58 Q240,26 272,58 Z" fill="#f59e0b"/>';
            s += '<rect x="115" y="172" width="250" height="16" rx="4" fill="#92400e"/>';
            s += '<rect x="142" y="188" width="12" height="58" fill="#78350f"/><rect x="326" y="188" width="12" height="58" fill="#78350f"/>';
        } else if (bg === "theater" || bg === "museum") {
            s += '<rect width="480" height="205" fill="' + (bg === "theater" ? "#450a0a" : "#1e293b") + '"/>';
            s += '<rect y="205" width="480" height="65" fill="#78350f"/>';
            if (bg === "theater") {
                // Rèm nhung đỏ + đèn chiếu
                s += '<path d="M0,0 L70,0 Q55,105 75,205 L0,205 Z" fill="#b91c1c"/>';
                s += '<path d="M480,0 L410,0 Q425,105 405,205 L480,205 Z" fill="#b91c1c"/>';
                s += '<polygon points="240,0 135,205 345,205" fill="#fef08a" opacity="0.16"/>';
            } else {
                // Tủ kính trưng bày bảo tàng
                s += '<rect x="180" y="72" width="120" height="133" fill="#0f172a" stroke="#94a3b8" stroke-width="3"/>';
                s += '<rect x="198" y="92" width="84" height="66" fill="#38bdf8" opacity="0.22"/>';
                s += '<polygon points="240,104 252,126 240,140 228,126" fill="#67e8f9" stroke="#ffffff" stroke-width="1.5"/>';
            }
        } else {
            // Văn phòng / lớp học
            s += '<rect width="480" height="205" fill="' + (isNight ? "#1e293b" : "#f1f5f9") + '"/>';
            s += '<rect y="205" width="480" height="65" fill="#cbd5e1"/>';
            s += '<rect x="260" y="34" width="175" height="96" rx="4" fill="' + pal.sky1 + '" stroke="#64748b" stroke-width="4"/>';
            s += '<rect x="285" y="72" width="28" height="58" fill="#475569" opacity="0.5"/><rect x="322" y="56" width="34" height="74" fill="#334155" opacity="0.55"/><rect x="366" y="82" width="26" height="48" fill="#475569" opacity="0.5"/>';
            s += '<rect x="85" y="168" width="210" height="14" rx="3" fill="#94a3b8"/>';
            s += '<polygon points="150,168 164,132 212,132 200,168" fill="#334155"/>'; // laptop
        }
        return s;
    }

    function svgChar(type, x, y, scale, emotion, flip) {
        var g = '<g transform="translate(' + x + ',' + y + ') scale(' + (flip ? -scale : scale) + ',' + scale + ')">';
        var mouth = emotion === "happy"
            ? '<path d="M-7,7 Q0,14 7,7" fill="none" stroke="#1e293b" stroke-width="2.4" stroke-linecap="round"/>'
            : emotion === "shock"
            ? '<ellipse cx="0" cy="9" rx="4.5" ry="5.5" fill="#1e293b"/>'
            : emotion === "sad" || emotion === "worry"
            ? '<path d="M-6,11 Q0,6 6,11" fill="none" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round"/>'
            : '<path d="M-5,9 Q0,11 5,9" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round"/>';
        var eyes = emotion === "happy"
            ? '<path d="M-12,-4 Q-8,-9 -4,-4 M4,-4 Q8,-9 12,-4" fill="none" stroke="#1e293b" stroke-width="2.4" stroke-linecap="round"/>'
            : '<circle cx="-8" cy="-4" r="3" fill="#1e293b"/><circle cx="8" cy="-4" r="3" fill="#1e293b"/><circle cx="-7" cy="-5" r="1" fill="#fff"/><circle cx="9" cy="-5" r="1" fill="#fff"/>';

        if (type === "red_fox" || type === "white_fox") {
            var fur = type === "red_fox" ? "#ea580c" : "#f8fafc";
            var coat = type === "red_fox" ? "#15803d" : "#334155";
            // Đuôi xù
            g += '<path d="M16,66 Q48,46 44,18 Q32,20 26,38 Q22,52 14,62 Z" fill="' + fur + '" stroke="#1e293b" stroke-width="2.2"/>';
            // Thân
            g += '<path d="M-20,30 L20,30 L26,85 L-26,85 Z" fill="' + coat + '" stroke="#1e293b" stroke-width="2.2"/>';
            // Tai nhọn
            g += '<polygon points="-24,-14 -18,-42 -2,-22" fill="' + fur + '" stroke="#1e293b" stroke-width="2.2"/>';
            g += '<polygon points="24,-14 18,-42 2,-22" fill="' + fur + '" stroke="#1e293b" stroke-width="2.2"/>';
            // Đầu cáo
            g += '<ellipse cx="0" cy="-4" rx="25" ry="22" fill="' + fur + '" stroke="#1e293b" stroke-width="2.2"/>';
            g += '<path d="M-22,2 Q0,18 22,2 Q14,18 0,18 Q-14,18 -22,2 Z" fill="#ffffff" opacity="0.9"/>';
            g += eyes + '<polygon points="-3,3 3,3 0,6" fill="#1e293b"/>' + mouth;
        } else if (type === "tortoise") {
            // Mai rùa & thân
            g += '<ellipse cx="0" cy="54" rx="30" ry="28" fill="#3f6212" stroke="#1e293b" stroke-width="2.2"/>';
            g += '<ellipse cx="0" cy="56" rx="20" ry="22" fill="#d97706" opacity="0.45"/>';
            // Đầu rùa có kính
            g += '<circle cx="0" cy="0" r="21" fill="#84cc16" stroke="#1e293b" stroke-width="2.2"/>';
            g += eyes + '<circle cx="-8" cy="-4" r="6" fill="none" stroke="#1e293b" stroke-width="1.8"/><circle cx="8" cy="-4" r="6" fill="none" stroke="#1e293b" stroke-width="1.8"/><line x1="-2" y1="-4" x2="2" y2="-4" stroke="#1e293b" stroke-width="1.8"/>';
            g += mouth;
        } else if (type === "deer" || type === "otter" || type === "squirrel" || type === "rabbit" || type === "cat" || type === "bear") {
            var cf = type === "deer" ? "#d97706" : type === "otter" ? "#78350f" : type === "squirrel" ? "#b45309" : type === "rabbit" ? "#f8fafc" : type === "cat" ? "#f59e0b" : "#92400e";
            g += '<path d="M-19,28 L19,28 L25,84 L-25,84 Z" fill="#0284c7" stroke="#1e293b" stroke-width="2.2"/>';
            if (type === "rabbit") {
                g += '<ellipse cx="-10" cy="-36" rx="6" ry="18" fill="' + cf + '" stroke="#1e293b" stroke-width="2"/><ellipse cx="10" cy="-36" rx="6" ry="18" fill="' + cf + '" stroke="#1e293b" stroke-width="2"/>';
            } else if (type === "deer") {
                g += '<path d="M-10,-22 L-16,-40 M-13,-31 L-20,-33 M10,-22 L16,-40 M13,-31 L20,-33" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>';
            } else {
                g += '<circle cx="-16" cy="-22" r="8" fill="' + cf + '" stroke="#1e293b" stroke-width="2"/><circle cx="16" cy="-22" r="8" fill="' + cf + '" stroke="#1e293b" stroke-width="2"/>';
            }
            g += '<circle cx="0" cy="-2" r="23" fill="' + cf + '" stroke="#1e293b" stroke-width="2.2"/>';
            g += eyes + '<circle cx="0" cy="3" r="2.8" fill="#1e293b"/>' + mouth;
        } else if (type === "bird" || type === "frog" || type === "ox" || type === "tiger" || type === "monkey" || type === "horse") {
            var bf = type === "frog" ? "#22c55e" : type === "bird" ? "#38bdf8" : type === "tiger" ? "#f97316" : type === "ox" ? "#57534e" : "#a16207";
            g += '<ellipse cx="0" cy="52" rx="22" ry="30" fill="' + bf + '" stroke="#1e293b" stroke-width="2.2"/>';
            g += '<circle cx="0" cy="-2" r="22" fill="' + bf + '" stroke="#1e293b" stroke-width="2.2"/>';
            g += eyes;
            g += type === "bird" ? '<polygon points="-4,2 4,2 0,11" fill="#facc15" stroke="#1e293b" stroke-width="1.5"/>' : mouth;
        } else {
            // Nhân vật người (ông, bà, thanh niên, trẻ em, cổ trang)
            var hair = (type === "grandpa" || type === "grandma") ? "#e2e8f0" : "#1e293b";
            var shirt = type === "grandpa" ? "#b45309" : type === "grandma" ? "#be185d" : type === "ancient_scholar" ? "#0f766e" : type === "young_f" ? "#db2777" : type === "kid" ? "#ef4444" : "#2563eb";
            g += '<path d="M-21,28 L21,28 L27,86 L-27,86 Z" fill="' + shirt + '" stroke="#1e293b" stroke-width="2.2"/>';
            // Cổ áo
            g += '<polygon points="-8,28 8,28 0,38" fill="#f8fafc"/>';
            // Mặt
            g += '<circle cx="0" cy="-2" r="23" fill="#fde68a" stroke="#1e293b" stroke-width="2.2"/>';
            // Tóc / mũ
            if (type === "ancient_scholar") {
                g += '<path d="M-26,-12 L26,-12 L16,-28 L-16,-28 Z" fill="#d97706" stroke="#1e293b" stroke-width="2"/>'; // nón lá cổ
            } else if (type === "young_f" || type === "grandma") {
                g += '<path d="M-24,6 Q-26,-28 0,-28 Q26,-28 24,6 Q16,-14 0,-14 Q-16,-14 -24,6 Z" fill="' + hair + '" stroke="#1e293b" stroke-width="1.8"/>';
                if (type === "grandma") g += '<circle cx="0" cy="-29" r="8" fill="' + hair + '" stroke="#1e293b" stroke-width="1.8"/>';
            } else {
                g += '<path d="M-23,-6 Q-22,-27 0,-27 Q22,-27 23,-6 Q12,-15 0,-15 Q-12,-15 -23,-6 Z" fill="' + hair + '"/>';
            }
            g += eyes;
            if (type === "grandpa") {
                // Kính lão + râu
                g += '<circle cx="-8" cy="-4" r="6" fill="none" stroke="#1e293b" stroke-width="1.6"/><circle cx="8" cy="-4" r="6" fill="none" stroke="#1e293b" stroke-width="1.6"/>';
            }
            g += mouth;
        }

        // Hiệu ứng cảm xúc manga
        if (emotion === "shock") {
            g += '<path d="M24,-28 L30,-42 M30,-22 L40,-30" stroke="#ef4444" stroke-width="2.6" stroke-linecap="round"/>';
        } else if (emotion === "worry") {
            g += '<path d="M24,-18 Q28,-10 24,-5 Q20,-10 24,-18 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="1.2"/>';
        } else if (emotion === "happy") {
            g += '<path d="M-30,-24 L-26,-24 M-28,-26 L-28,-22 M28,-28 L34,-28 M31,-31 L31,-25" stroke="#facc15" stroke-width="2.4" stroke-linecap="round"/>';
        } else if (emotion === "think") {
            g += '<circle cx="28" cy="-20" r="3" fill="#fff" stroke="#64748b"/><circle cx="35" cy="-29" r="5" fill="#fff" stroke="#64748b"/>';
        }
        g += '</g>';
        return g;
    }

    function svgPropsLayer(props) {
        var s = "";
        props.forEach(function (pr, i) {
            var px = 225 + i * 54, py = 186;
            if (pr === "phone") {
                s += '<rect x="' + px + '" y="' + (py - 12) + '" width="18" height="30" rx="3" fill="#0f172a" stroke="#e2e8f0" stroke-width="1.5"/>';
                s += '<rect x="' + (px + 2) + '" y="' + (py - 9) + '" width="14" height="22" fill="#38bdf8"/>';
            } else if (pr === "envelope") {
                s += '<rect x="' + px + '" y="' + py + '" width="24" height="32" rx="3" fill="#dc2626" stroke="#fde047" stroke-width="1.8"/>';
                s += '<circle cx="' + (px + 12) + '" cy="' + (py + 14) + '" r="5" fill="#fde047"/>';
            } else if (pr === "tea") {
                s += '<rect x="' + px + '" y="' + (py + 6) + '" width="22" height="18" rx="4" fill="#f8fafc" stroke="#475569" stroke-width="1.8"/>';
                s += '<path d="M' + (px + 6) + ',' + py + ' Q' + (px + 9) + ',' + (py - 8) + ' ' + (px + 6) + ',' + (py - 14) + '" fill="none" stroke="#fff" stroke-width="1.8" opacity="0.7"/>';
            } else if (pr === "food") {
                s += '<path d="M' + px + ',' + (py + 8) + ' L' + (px + 34) + ',' + (py + 8) + ' Q' + (px + 30) + ',' + (py + 26) + ' ' + (px + 17) + ',' + (py + 26) + ' Q' + (px + 4) + ',' + (py + 26) + ' ' + px + ',' + (py + 8) + ' Z" fill="#fef3c7" stroke="#92400e" stroke-width="1.8"/>';
            } else if (pr === "bag") {
                s += '<rect x="' + px + '" y="' + py + '" width="26" height="30" rx="5" fill="#2563eb" stroke="#1e3a8a" stroke-width="2"/>';
            } else if (pr === "umbrella") {
                s += '<path d="M' + px + ',' + py + ' Q' + (px + 18) + ',' + (py - 20) + ' ' + (px + 36) + ',' + py + ' Z" fill="#0284c7" stroke="#1e293b" stroke-width="1.5"/>';
                s += '<line x1="' + (px + 18) + '" y1="' + py + '" x2="' + (px + 18) + '" y2="' + (py + 26) + '" stroke="#475569" stroke-width="2"/>';
            }
        });
        return s;
    }

    function svgWeatherLayer(sc) {
        var s = "";
        if (sc.time === "rain") {
            for (var i = 0; i < 14; i++) {
                var rx = (i * 37 + 15) % 470, ry = (i * 43 + 10) % 220;
                s += '<line x1="' + rx + '" y1="' + ry + '" x2="' + (rx - 8) + '" y2="' + (ry + 18) + '" stroke="#e0f2fe" stroke-width="1.6" opacity="0.65"/>';
            }
        } else if (sc.time === "snow") {
            for (var j = 0; j < 16; j++) {
                var sx = (j * 41 + 20) % 470, sy = (j * 29 + 15) % 230;
                s += '<circle cx="' + sx + '" cy="' + sy + '" r="' + (2 + (j % 2)) + '" fill="#ffffff" opacity="0.85"/>';
            }
        }
        if (sc.sfx) {
            s += '<g transform="translate(388,36) rotate(-7)"><rect x="-34" y="-14" width="68" height="24" rx="12" fill="#fef08a" stroke="#1e293b" stroke-width="2"/>' +
                '<text x="0" y="3" text-anchor="middle" font-size="13" font-weight="800" fill="#b91c1c">' + esc(sc.sfx) + '</text></g>';
        }
        return s;
    }

    function buildSceneSVG(sc, idx) {
        var pal = PALETTES[sc.time] || PALETTES.day;
        var uid = "cm" + idx + "_" + (sc.seed % 9973);
        var s = '<svg class="cm-svg" viewBox="0 0 480 270" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(sc.bgLabel) + '">';
        s += svgBgLayer(sc, pal, uid);
        if (sc.chars.length === 1) {
            s += svgChar(sc.chars[0], 175, 178, 1.05, sc.emotion, false);
        } else {
            s += svgChar(sc.chars[0], 145, 180, 0.96, sc.emotion, false);
            s += svgChar(sc.chars[1], 325, 180, 0.96, sc.emotion === "shock" ? "think" : "calm", true);
        }
        s += svgPropsLayer(sc.props || []);
        s += svgWeatherLayer(sc);
        // Đường viền trong khung truyện
        s += '<rect x="1.5" y="1.5" width="477" height="267" fill="none" stroke="rgba(15,23,42,0.22)" stroke-width="3"/>';
        s += '</svg>';
        return s;
    }

    function renderPanelArt(p, idx, doc, useAI) {
        var sc = analyzeScene(p, idx, doc);
        var ai = useAI !== false && doc ? getAIFrame(doc.id, idx) : null;
        var svgHtml = buildSceneSVG(sc, idx);
        var pnum = '<span class="cm-pnum">#' + (idx + 1) + "</span>";
        var badge = '<span class="cm-scene-tag">' + (ai ? "🎨 " + esc(ai.tag) : esc(sc.bgLabel)) + "</span>";
        if (ai) {
            var style = "object-position:" + ai.pos + ";transform:scale(" + ai.zoom + ")";
            return '<div class="cm-art cm-art-ai">' + pnum +
                '<img class="cm-img" src="' + esc(ai.src) + '" alt="' + esc(ai.tag) + '" style="' + style + '" loading="lazy" ' +
                'onerror="var f=this.parentNode.querySelector(\'.cm-svg-fb\');if(f){this.style.display=\'none\';f.hidden=false;}">' +
                '<div class="cm-svg-fb" hidden>' + svgHtml + "</div>" + badge + "</div>";
        }
        return '<div class="cm-art">' + pnum + svgHtml + badge + "</div>";
    }

    // ====================================================================== 4. Tách Lời dẫn & Bong bóng thoại
    // Quy tắc: Mọi ký tự trong p.text giữ nguyên chỉ số charIdx (0..p.text.length-1) và pyIdx (0..pys.length-1).
    var SPEECH_QUOTE = /(“[^”]*”|「[^」]*」|『[^』]*』)/g;
    var SPEECH_VERB_RE = /([^\s，。！？；：、“”「」『』]{1,10}?)\s*(?:笑着|小声地?|大声地?|轻轻地?|认真地?|慢慢地?|激动地?|自言自语地?|忍不住|连忙|悄悄地?|忽然|突然|抬头|低头|回头|转身|冷冷地?|淡淡地?)?\s*(?:说|问|答|回答|叫|喊|道|想|心想|提醒|解释|抱怨|安慰|感叹|写着|写|笑|哭)[了着过]?\s*[：:，,]?\s*$/;

    function isSpeechQuote(qText, beforeText) {
        var inner = qText.slice(1, -1);
        if (!HAN.test(inner)) return false;
        if (SPEECH_VERB_RE.test(beforeText) || /[：:]\s*$/.test(beforeText)) return true;
        if (/[。！？!?…]$/.test(inner)) return true;
        return inner.length >= 8;
    }

    function guessSpeaker(beforeText, fallbackIdx) {
        var tail = beforeText.slice(-36);
        var m = SPEECH_VERB_RE.exec(tail);
        if (m && m[1]) {
            var who = m[1].replace(/^[，。！？、\s]+/, "");
            // Lấy chủ ngữ ngắn gọn nhất
            var knownNames = ["爷爷", "奶奶", "爸爸", "妈妈", "老师", "老板", "经理", "医生", "司机", "服务员", "阿橙", "龟伯", "夜白", "白霜", "鹿鸣", "小满", "阿栗", "刺刺", "小夜", "老李", "老陈", "张明", "阮明", "林小雨", "小雨", "林晓", "农民", "松鼠", "老乌龟", "我", "他", "她"];
            for (var i = 0; i < knownNames.length; i++) {
                if (tail.indexOf(knownNames[i]) >= 0) return knownNames[i];
            }
            if (who.length >= 1 && who.length <= 5) return who;
        }
        return fallbackIdx % 2 === 0 ? "Vai 1" : "Vai 2";
    }

    function rubySlice(slice, startCharIdx, pys, pyOffset) {
        var h = "", k = pyOffset;
        for (var i = 0; i < slice.length; i++) {
            var c = slice[i];
            if (HAN.test(c)) {
                h += '<ruby class="lk-c" data-i="' + (startCharIdx + i) + '">' + c + "<rt>" + esc(pys[k++] || "") + "</rt></ruby>";
            } else {
                h += esc(c);
            }
        }
        return { html: h, pyUsed: k - pyOffset };
    }

    function renderComicText(p, pys, doc, kIdx) {
        var text = String(p.text || "");
        if (!pys) pys = window.HocLookup && HocLookup.ready() ? HocLookup.pinyinOf(text) : [];

        // Nếu là hội thoại hoặc dòng tiêu đề/nguồn: giữ 1 khối rõ ràng
        if (p.name) {
            var r0 = rubySlice(text, 0, pys, 0);
            var side = (kIdx % 2 === 0) ? "left" : "right";
            return '<div class="cm-bubble cm-side-' + side + ' spk-' + (kIdx % 4) + '">' +
                '<div class="cm-spk">' + esc(p.name) + ' <button type="button" class="cm-say-bubble" data-say="' + esc(text) + '" title="Nghe câu thoại">🔊</button></div>' +
                '<div class="cm-btxt">' + r0.html + "</div></div>";
        }

        // Tách đoạn văn thành các phần lời dẫn và lời thoại (bảo toàn 100% vị trí ký tự)
        var tokens = [], last = 0, m;
        SPEECH_QUOTE.lastIndex = 0;
        while ((m = SPEECH_QUOTE.exec(text))) {
            if (m.index > last) tokens.push({ raw: text.slice(last, m.index), q: false, at: last });
            tokens.push({ raw: m[0], q: true, at: m.index });
            last = m.index + m[0].length;
        }
        if (last < text.length) tokens.push({ raw: text.slice(last), q: false, at: last });
        if (!tokens.length) tokens.push({ raw: text, q: false, at: 0 });

        // Gom các phần không phải lời thoại thật vào lời dẫn liên tiếp
        var blocks = [], narBuf = "", narAt = 0, spkCount = 0;
        tokens.forEach(function (tk) {
            var before = text.slice(Math.max(0, tk.at - 38), tk.at);
            // Kịch bản (comic_data.js) quyết định trước: có tên → bong bóng; "who": "" → không phải lời thoại
            var known = tk.q ? knownSpeaker(doc, kIdx, tk.raw.slice(1, -1)) : null;
            if (tk.q && known !== "" && (known || isSpeechQuote(tk.raw, before))) {
                if (narBuf) { blocks.push({ type: "nar", raw: narBuf, at: narAt }); narBuf = ""; }
                var guessed = guessSpeaker(before, spkCount++);
                blocks.push({ type: "bub", raw: tk.raw, at: tk.at, speaker: known || guessed });
            } else {
                if (!narBuf) narAt = tk.at;
                narBuf += tk.raw;
            }
        });
        if (narBuf) blocks.push({ type: "nar", raw: narBuf, at: narAt });

        // Đánh số ký tự liên tục từ 0 đến text.length - 1
        var pyPos = 0, spkRoleMap = {}, spkRoleNext = 0;
        return blocks.map(function (b) {
            if (b.type === "nar") {
                var rNar = rubySlice(b.raw, b.at, pys, pyPos);
                pyPos += rNar.pyUsed;
                // Bỏ qua nếu chỉ còn khoảng trắng
                if (!b.raw.trim()) return esc(b.raw);
                return '<div class="cm-narration">' + rNar.html + "</div>";
            }
            // Bong bóng thoại: ẩn dấu ngoặc kép ngoài (vẫn tính đúng offset ký tự bên trong!)
            var openQ = b.raw[0], closeQ = b.raw[b.raw.length - 1], inner = b.raw.slice(1, -1);
            var rBub = rubySlice(inner, b.at + 1, pys, pyPos);
            pyPos += rBub.pyUsed;
            if (spkRoleMap[b.speaker] == null) spkRoleMap[b.speaker] = spkRoleNext++;
            var roleIdx = spkRoleMap[b.speaker];
            var side = roleIdx % 2 === 0 ? "left" : "right";
            return '<div class="cm-bubble cm-side-' + side + ' spk-' + (roleIdx % 4) + '">' +
                '<div class="cm-spk">' + esc(b.speaker) + ' <button type="button" class="cm-say-bubble" data-say="' + esc(inner) + '" title="Nghe câu thoại">🔊</button></div>' +
                '<div class="cm-btxt"><span class="cm-q" aria-hidden="true">' + esc(openQ) + "</span>" + rBub.html + '<span class="cm-q" aria-hidden="true">' + esc(closeQ) + "</span></div></div>";
        }).join("");
    }

    function sceneLabelFor(p, idx, doc) {
        var sc = analyzeScene(p, idx, doc);
        return sc.bgLabel;
    }

    window.HocComicArt = {
        hasAI: hasAI,
        aiStories: aiStories,
        analyzeScene: analyzeScene,
        buildSceneSVG: buildSceneSVG,
        renderPanelArt: renderPanelArt,
        renderComicText: renderComicText,
        sceneLabelFor: sceneLabelFor
    };
})();
