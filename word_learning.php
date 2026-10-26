<?php
// word_learning.php - Trang học từ vựng bằng PHP thuần & CSDL MySQL
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';

$pdo = getDbConnection();
$isLoggedIn = is_logged_in();
$currentUser = current_user();
$userId = current_user_id();

// 1. LẤY DANH SÁCH GIÁO TRÌNH (BOOKS) TỪ MYSQL
$stmtBooks = $pdo->query("SELECT id, book_code, title, level, badge, color, description FROM books ORDER BY sort_order ASC, id ASC");
$books = $stmtBooks->fetchAll();

if (empty($books)) {
    header('Location: install.php');
    exit;
}

// 2. XÁC ĐỊNH SÁCH VÀ BÀI ĐANG HỌC
$currentBookId = (int)get('book_id', $books[0]['id']);
$currentBook = null;
foreach ($books as $b) {
    if ((int)$b['id'] === $currentBookId) {
        $currentBook = $b;
        break;
    }
}
if (!$currentBook) {
    $currentBook = $books[0];
    $currentBookId = (int)$currentBook['id'];
}

// LẤY DANH SÁCH BÀI HỌC CỦA SÁCH HIỆN TẠI
$stmtUnits = $pdo->prepare("SELECT id, book_id, unit_number, title, description FROM units WHERE book_id = ? ORDER BY sort_order ASC, unit_number ASC");
$stmtUnits->execute([$currentBookId]);
$units = $stmtUnits->fetchAll();

$currentUnitId = (int)get('unit_id', !empty($units) ? $units[0]['id'] : 0);
$currentUnit = null;
foreach ($units as $u) {
    if ((int)$u['id'] === $currentUnitId) {
        $currentUnit = $u;
        break;
    }
}
if (!$currentUnit && !empty($units)) {
    $currentUnit = $units[0];
    $currentUnitId = (int)$currentUnit['id'];
}

// 3. LẤY DỮ LIỆU THỐNG KÊ NGƯỜI DÙNG TỪ MYSQL
$userStats = [
    'streak_count' => 1,
    'total_xp' => 50,
    'level' => 1,
    'total_favorites' => 0,
    'total_difficult' => 0,
    'total_mastered' => 0
];

if ($isLoggedIn && $userId) {
    $stmtStat = $pdo->prepare("SELECT * FROM user_stats WHERE user_id = ?");
    $stmtStat->execute([$userId]);
    $dbStat = $stmtStat->fetch();
    if ($dbStat) {
        $userStats['streak_count'] = (int)$dbStat['streak_count'];
        $userStats['total_xp'] = (int)$dbStat['total_xp'];
        $userStats['level'] = (int)$dbStat['level'];
    }

    $stmtCounts = $pdo->prepare("SELECT 
        SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) AS total_favorites,
        SUM(CASE WHEN is_difficult = 1 THEN 1 ELSE 0 END) AS total_difficult,
        SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) AS total_mastered
        FROM user_progress WHERE user_id = ?");
    $stmtCounts->execute([$userId]);
    $counts = $stmtCounts->fetch();
    if ($counts) {
        $userStats['total_favorites'] = (int)($counts['total_favorites'] ?? 0);
        $userStats['total_difficult'] = (int)($counts['total_difficult'] ?? 0);
        $userStats['total_mastered'] = (int)($counts['total_mastered'] ?? 0);
    }
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
    <title>Học Từ Vựng Tiếng Trung HSK & BOYA · Dữ Liệu MySQL</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Ma+Shan+Zheng&family=Noto+Sans+SC:wght@400;500;600;700;800&family=Noto+Serif+SC:wght@500;600;700;900&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="word_learning.css">
    <style>
        /* Tùy chỉnh thêm cho tích hợp PHP & MySQL */
        .auth-pill {
            background: rgba(79, 70, 229, 0.15) !important;
            border: 1px solid rgba(99, 102, 241, 0.4) !important;
            color: #a5b4fc !important;
            font-weight: 600;
        }
        .auth-pill:hover {
            background: rgba(79, 70, 229, 0.3) !important;
            color: #fff !important;
        }
        .admin-pill {
            background: rgba(239, 68, 68, 0.15) !important;
            border: 1px solid rgba(239, 68, 68, 0.4) !important;
            color: #fca5a5 !important;
            font-weight: 600;
        }
        .admin-pill:hover {
            background: rgba(239, 68, 68, 0.3) !important;
            color: #fff !important;
        }
        .sync-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: #34d399;
            background: rgba(16, 185, 129, 0.12);
            padding: 2px 8px;
            border-radius: 999px;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .book-dropdown-wrap {
            margin-bottom: 12px;
            padding: 0 4px;
        }
        .book-select {
            width: 100%;
            background: #1e293b;
            color: #f8fafc;
            border: 1px solid #334155;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            outline: none;
        }
        .book-select:focus {
            border-color: #6366f1;
        }
    </style>
</head>
<body>
    <!-- Top Header -->
    <header class="wl-header">
        <div class="wl-header-left">
            <a href="index.php" class="back-home-btn" title="Về Trang Chủ">
                <span class="home-icon">🏠</span>
                <span class="hide-xs">Trang chủ</span>
            </a>
            <div class="brand-title">
                <div class="brand-badge"><?= e($currentBook['level']) ?></div>
                <h1><?= e($currentBook['title']) ?> <span class="sync-badge">● MySQL</span></h1>
            </div>
        </div>

        <div class="wl-header-Center">
            <div class="global-search-box">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                <input type="text" id="globalWordSearch" placeholder="Tìm từ vựng trong CSDL MySQL (Chữ Hán, Pinyin, nghĩa)...">
                <kbd class="search-kbd-hint hide-sm">Ctrl K</kbd>
                <button id="clearGlobalSearch" class="clear-btn hidden" title="Xóa">✕</button>
            </div>
        </div>

        <div class="wl-header-right">
            <!-- Chuỗi ngày học Streak & Level -->
            <button id="btnBadgesModal" class="action-pill streak-pill" title="Xem chuỗi ngày học & huy hiệu thành tích">
                🔥 <span id="hdrStreakCount"><?= $userStats['streak_count'] ?></span> ngày · <span id="hdrUserLevel">Lv.<?= $userStats['level'] ?></span>
            </button>

            <!-- Hộp từ khó SRS -->
            <button id="btnSrsQuickReview" class="action-pill srs-pill" title="Hộp từ khó (Spaced Repetition) - Xem các từ cần ôn tập">
                🧠 <span class="hide-sm">Từ khó</span> <span class="srs-count-badge" id="hdrSrsCount"><?= $userStats['total_difficult'] ?></span>
            </button>

            <!-- Menu Cài đặt giao diện & công cụ -->
            <div class="settings-menu-wrapper" id="settingsMenuWrapper">
                <button id="btnOpenSettings" class="action-pill settings-pill" title="Cài đặt giao diện & công cụ học tập">
                    ⚙️ <span class="hide-sm">Giao diện</span> <span class="settings-caret">▾</span>
                </button>
                <div class="settings-dropdown-menu hidden" id="settingsDropdownMenu">
                    <div class="sdm-section">
                        <div class="sdm-sec-title">🎨 Giao Diện Chủ Đề (Themes)</div>
                        <div class="theme-swatch-grid">
                            <button class="tsg-item" data-set-theme="dark" title="Dạ Thạch (Dark)"><span class="tsg-icon">🌙</span><span class="tsg-label">Dạ Thạch</span></button>
                            <button class="tsg-item" data-set-theme="light" title="Bạch Tuyết (Light)"><span class="tsg-icon">☀️</span><span class="tsg-label">Bạch Tuyết</span></button>
                            <button class="tsg-item" data-set-theme="palace" title="Cố Cung Chu Sa"><span class="tsg-icon">🏮</span><span class="tsg-label">Cố Cung</span></button>
                            <button class="tsg-item" data-set-theme="matcha" title="Trà Đạo Giấy Mộc"><span class="tsg-icon">🍵</span><span class="tsg-label">Trà Đạo</span></button>
                            <button class="tsg-item" data-set-theme="cyberpunk" title="Cyberpunk"><span class="tsg-icon">🌌</span><span class="tsg-label">Cyberpunk</span></button>
                            <button class="tsg-item" data-set-theme="jiangnan" title="Giang Nam"><span class="tsg-icon">🌸</span><span class="tsg-label">Giang Nam</span></button>
                        </div>
                    </div>
                    <div class="sdm-divider"></div>
                    <div class="sdm-section">
                        <div class="sdm-sec-title">🛠️ Công Cụ</div>
                        <div class="sdm-tools-list">
                            <button class="sdm-tool-row" id="btnToggleHanziFont">
                                <div class="sdm-tool-info">
                                    <span class="sdm-tool-icon">✍️</span>
                                    <div><strong>Kiểu chữ Hán: <span id="lblHanziFont">Khải Thể</span></strong></div>
                                </div>
                                <span class="sdm-action-arrow">⇄</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- PHẦN XÁC THỰC NGƯỜI DÙNG & ADMIN -->
            <?php if ($isLoggedIn): ?>
                <?php if (is_admin()): ?>
                    <a href="admin/index.php" class="action-pill admin-pill" title="Truy cập Trang Quản Trị Hệ Thống">
                        👑 <span class="hide-xs">Quản Trị</span>
                    </a>
                <?php endif; ?>

                <div class="action-pill auth-pill" title="Tài khoản đang đăng nhập">
                    👤 <span class="hide-xs"><?= e($currentUser['full_name']) ?></span>
                </div>
                <a href="logout.php" class="action-pill" style="color:#ef4444;" title="Đăng xuất khỏi hệ thống">
                    🚪
                </a>
            <?php else: ?>
                <a href="login.php" class="action-pill auth-pill" title="Đăng nhập để lưu tiến độ học tập">
                    🔑 Đăng nhập
                </a>
                <a href="register.php" class="action-pill" title="Đăng ký tài khoản">
                    ✨ Đăng ký
                </a>
            <?php endif; ?>
        </div>
    </header>

    <!-- Main Workspace -->
    <main class="wl-main">
        <!-- LEFT SIDEBAR: DANH SÁCH BÀI HỌC TỪ CSDL MYSQL -->
        <aside class="wl-sidebar" id="wlSidebar">
            <div class="sidebar-header">
                <div class="book-dropdown-wrap">
                    <select id="bookSelector" class="book-select" onchange="switchBook(this.value)">
                        <?php foreach ($books as $b): ?>
                            <option value="<?= $b['id'] ?>" <?= $b['id'] == $currentBookId ? 'selected' : '' ?>>
                                📚 <?= e($b['title']) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="unit-filter-tabs">
                    <button class="uf-tab active" data-filter="all">Tất cả</button>
                    <button class="uf-tab" data-filter="star">⭐ Lưu</button>
                    <button class="uf-tab" data-filter="srs">🧠 Từ khó</button>
                </div>
            </div>

            <!-- Danh sách bài học nạp động -->
            <div class="units-list" id="unitsListContainer">
                <?php if (empty($units)): ?>
                    <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 13px;">
                        Chưa có bài học nào trong giáo trình này.<br>
                        <a href="admin/books.php" style="color: #6366f1; margin-top: 8px; display: inline-block;">+ Thêm bài học mới</a>
                    </div>
                <?php else: ?>
                    <?php foreach ($units as $u): ?>
                        <div class="unit-item <?= $u['id'] == $currentUnitId ? 'active' : '' ?>" 
                             data-unit-id="<?= $u['id'] ?>" 
                             data-unit-num="<?= $u['unit_number'] ?>"
                             onclick="selectUnit(<?= $u['id'] ?>, <?= $u['unit_number'] ?>)">
                            <div class="ui-num">#<?= $u['unit_number'] ?></div>
                            <div class="ui-info">
                                <div class="ui-title"><?= e($u['title']) ?></div>
                                <div class="ui-range"><?= e($u['description'] ?: 'Học liệu bài ' . $u['unit_number']) ?></div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>

            <div class="sidebar-footer-stat">
                <span>Tổng cộng: <strong id="sidebarUnitCount"><?= count($units) ?></strong> bài học</span>
                <span class="sync-badge">MySQL Live</span>
            </div>
        </aside>

        <!-- CENTER STAGE: KHÔNG GIAN HỌC TẬP CHÍNH -->
        <section class="wl-content">
            <!-- Mode Switcher Tabs -->
            <div class="study-mode-bar">
                <div class="sm-tabs-group">
                    <button class="sm-tab active" data-mode="memory" id="tabModeMemory">
                        📖 Sổ Tay Từ Vựng
                    </button>
                    <button class="sm-tab" data-mode="flashcard" id="tabModeFlashcard">
                        🎴 Thẻ Ghi Nhớ 3D
                    </button>
                    <button class="sm-tab" data-mode="quiz" id="tabModeQuiz">
                        🎯 Trắc Nghiệm Quiz
                    </button>
                    <button class="sm-tab" data-mode="shadowing" id="tabModeShadowing">
                        🎙️ Luyện Phát Âm AI
                    </button>
                </div>

                <div class="sm-actions-group">
                    <button class="action-pill" id="btnToggleSpeakAll" title="Đọc toàn bộ từ vựng trong bài tự động">
                        🔊 <span id="lblSpeakAll">Đọc cả bài</span>
                    </button>
                    <button class="action-pill" id="btnOpenPodcast" title="Mở thanh Podcast rảnh tay">
                        🎧 Podcast
                    </button>
                </div>
            </div>

            <!-- CHẾ ĐỘ 1: SỔ TAY TỪ VỰNG (MEMORY LIST VIEW) -->
            <div class="mode-pane active" id="paneMemory">
                <!-- Unit Hero Summary Card -->
                <div class="unit-hero-card">
                    <div class="uh-left">
                        <span class="uh-badge" id="heroUnitBadge">Bài <?= $currentUnit ? $currentUnit['unit_number'] : 1 ?></span>
                        <h2 class="uh-title" id="heroUnitTitle"><?= e($currentUnit ? $currentUnit['title'] : 'Đang tải...') ?></h2>
                        <p class="uh-desc" id="heroUnitDesc"><?= e($currentUnit ? $currentUnit['description'] : '') ?></p>
                    </div>
                    <div class="uh-stats">
                        <div class="uh-stat-box">
                            <span class="uh-stat-num" id="heroWordCount">...</span>
                            <span class="uh-stat-lbl">Từ vựng</span>
                        </div>
                    </div>
                </div>

                <!-- Vocabulary Words Grid Container (Populated dynamically) -->
                <div class="words-grid-wrapper" id="wordsGridWrapper">
                    <div class="loading-state" style="padding: 40px; text-align: center; color: #94a3b8;">
                        ⏳ Đang tải từ vựng từ cơ sở dữ liệu MySQL...
                    </div>
                </div>
            </div>

            <!-- CHẾ ĐỘ 2: THẺ GHI NHỚ FLASHCARD 3D -->
            <div class="mode-pane" id="paneFlashcard">
                <div class="fc-workspace">
                    <div class="fc-toolbar">
                        <div class="fc-counter" id="fcCounter">1 / 20</div>
                        <div class="fc-options">
                            <label><input type="checkbox" id="fcAutoSpeakCheck" checked> Tự động phát âm khi lật</label>
                        </div>
                    </div>

                    <div class="fc-stage">
                        <div class="fc-card" id="flashcardBox" onclick="flipFlashcard()">
                            <div class="fc-inner" id="fcCardInner">
                                <div class="fc-front">
                                    <div class="fc-hz" id="fcFrontHz">爱</div>
                                    <div class="fc-hint">Bấm vào thẻ hoặc nhấn Phím Cách (Space) để lật xem nghĩa</div>
                                </div>
                                <div class="fc-back">
                                    <div class="fc-back-hz" id="fcBackHz">爱</div>
                                    <div class="fc-py" id="fcBackPy">ài</div>
                                    <div class="fc-meaning" id="fcBackVn">yêu, thích</div>
                                    <div class="fc-hanviet" id="fcBackHanViet">Hán Việt: ÁI · Động từ</div>
                                    <div class="fc-ex" id="fcBackEx">我爱你。 (Tôi yêu bạn.)</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="fc-controls">
                        <button class="fc-btn fc-btn-prev" onclick="prevFlashcard()">◀ Thẻ trước</button>
                        <button class="fc-btn fc-btn-speak" onclick="speakCurrentFc()">🔊 Phát âm</button>
                        <button class="fc-btn fc-btn-flip" onclick="flipFlashcard()">🔄 Lật mặt</button>
                        <button class="fc-btn fc-btn-star" id="btnFcStar" onclick="toggleCurrentWordStar()">⭐ Đánh dấu</button>
                        <button class="fc-btn fc-btn-next" onclick="nextFlashcard()">Tiếp theo ▶</button>
                    </div>
                </div>
            </div>

            <!-- CHẾ ĐỘ 3: TRẮC NGHIỆM QUIZ -->
            <div class="mode-pane" id="paneQuiz">
                <div class="quiz-container">
                    <div class="quiz-progress-bar-wrap">
                        <div class="quiz-progress-bar" id="quizProgressBar"></div>
                    </div>
                    <div class="quiz-header-row">
                        <span id="quizCounterText">Câu 1 / 10</span>
                        <span id="quizScoreText">Điểm: 0 XP</span>
                    </div>

                    <div class="quiz-card">
                        <div class="quiz-prompt-hz" id="quizWord">爱</div>
                        <div class="quiz-prompt-py" id="quizPinyin">ài</div>
                        <button class="quiz-audio-btn" onclick="speakQuizWord()">🔊 Nghe lại</button>

                        <div class="quiz-options-grid" id="quizOptionsGrid">
                            <!-- 4 lựa chọn được sinh tự động -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- CHẾ ĐỘ 4: LUYỆN NÓI & SHADOWING -->
            <div class="mode-pane" id="paneShadowing">
                <div class="shad-workspace">
                    <div class="shad-card" style="text-align: center; max-width: 600px; margin: 0 auto; padding: 30px;">
                        <div style="font-size: 48px; font-weight: 800; color: #fff; margin-bottom: 8px;" id="shadCurrentHz">爱</div>
                        <div style="font-size: 20px; color: #38bdf8; margin-bottom: 8px;" id="shadCurrentPy">ài</div>
                        <div style="font-size: 16px; color: #cbd5e1; margin-bottom: 24px;" id="shadCurrentVn">yêu, thích</div>

                        <div style="display: flex; justify-content: center; gap: 14px; margin-bottom: 24px;">
                            <button class="btn-pill btn-primary" onclick="speakCurrentWord()" style="padding: 12px 24px; font-size: 15px;">
                                🔊 Nghe Giọng Bản Xứ
                            </button>
                            <button class="btn-pill btn-secondary" id="btnRecordMic" onclick="toggleVoiceRecord()" style="padding: 12px 24px; font-size: 15px;">
                                🎙️ Bắt Đầu Nói
                            </button>
                        </div>

                        <div id="shadResultBox" style="background: rgba(15,23,42,0.6); padding: 16px; border-radius: 12px; border: 1px solid #334155; font-size: 14px; color: #94a3b8;">
                            Nhấn nút <strong>"Bắt Đầu Nói"</strong> và đọc to chữ Hán trên màn hình để AI đánh giá phát âm.
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <!-- FLOATING PODCAST PLAYER -->
    <div class="podcast-player-bar hidden" id="podcastPlayerBar">
        <div class="ppb-inner">
            <div class="ppb-left">
                <div class="ppb-visualizer">
                    <span class="bar b1"></span><span class="bar b2"></span><span class="bar b3"></span><span class="bar b4"></span>
                </div>
                <div class="ppb-word-info">
                    <div class="ppb-line1">
                        <strong class="ppb-hz" id="ppbHz">爱</strong>
                        <span class="ppb-py" id="ppbPy">ài</span>
                    </div>
                    <div class="ppb-line2">
                        <span class="ppb-vn" id="ppbVn">yêu, thích</span>
                    </div>
                </div>
            </div>

            <div class="ppb-center">
                <div class="ppb-controls">
                    <button class="ppb-btn" onclick="prevPodcast()">⏮️</button>
                    <button class="ppb-btn ppb-play-btn" id="btnPodcastPlay" onclick="togglePodcastPlay()">▶️</button>
                    <button class="ppb-btn" onclick="nextPodcast()">⏭️</button>
                </div>
            </div>

            <div class="ppb-right">
                <span class="ppb-counter" id="ppbCounter">1 / 20</span>
                <button class="ppb-close-btn" onclick="closePodcast()">✕</button>
            </div>
        </div>
    </div>

    <!-- TOAST NOTIFICATION -->
    <div class="wl-toast-container" id="toastContainer"></div>

    <!-- KHỞI TẠO BIẾN DỮ LIỆU TỪ PHP & MYSQL CHO JAVASCRIPT -->
    <script>
        const APP_CONFIG = {
            isLoggedIn: <?= json_encode($isLoggedIn) ?>,
            user: <?= json_encode($currentUser) ?>,
            userStats: <?= json_encode($userStats) ?>,
            currentBookId: <?= (int)$currentBookId ?>,
            currentUnitId: <?= (int)$currentUnitId ?>
        };
    </script>
    <script src="word_learning_mysql.js"></script>
</body>
</html>
