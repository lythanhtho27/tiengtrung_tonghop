<?php
// index.php - Cổng thông tin & Trang chủ Hệ Thống Học Từ Vựng Tiếng Trung
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';

$isLoggedIn = is_logged_in();
$currentUser = current_user();

$dbOk = false;
$stats = [
    'vocab' => 0,
    'units' => 0,
    'books' => 0,
    'users' => 0
];

try {
    $pdo = getDbConnection();
    $dbOk = true;
    $stats['vocab'] = (int)$pdo->query("SELECT COUNT(*) FROM vocabularies")->fetchColumn();
    $stats['units'] = (int)$pdo->query("SELECT COUNT(*) FROM units")->fetchColumn();
    $stats['books'] = (int)$pdo->query("SELECT COUNT(*) FROM books")->fetchColumn();
    $stats['users'] = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
} catch (Exception $e) {
    $dbOk = false;
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hệ Thống Học Từ Vựng Tiếng Trung HSK & BOYA · PHP Thuần & MySQL</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+SC:wght@500;700;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #4f46e5;
            --primary-hover: #4338ca;
            --bg-body: #090d16;
            --card-bg: rgba(30, 41, 59, 0.7);
            --border: rgba(255, 255, 255, 0.1);
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --success: #10b981;
            --cyan: #06b6d4;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body {
            background-color: var(--bg-body);
            background-image: 
                radial-gradient(at 0% 0%, rgba(79, 70, 229, 0.18) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(6, 182, 212, 0.15) 0px, transparent 50%);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        /* NAVBAR */
        .navbar {
            height: 76px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 40px;
            border-bottom: 1px solid var(--border);
            backdrop-filter: blur(12px);
            background: rgba(15, 23, 42, 0.6);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .nav-brand {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
            color: #fff;
        }
        .nav-logo {
            width: 42px;
            height: 42px;
            background: linear-gradient(135deg, #4f46e5, #06b6d4);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            box-shadow: 0 8px 16px rgba(79, 70, 229, 0.3);
        }
        .nav-title h2 { font-size: 18px; font-weight: 800; }
        .nav-title span { font-size: 11px; color: #38bdf8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

        .nav-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .btn-link {
            color: #cbd5e1;
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
            padding: 8px 16px;
            border-radius: 8px;
            transition: all 0.2s;
        }
        .btn-link:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .btn-main {
            background: var(--primary);
            color: #fff;
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
            padding: 10px 20px;
            border-radius: 10px;
            transition: all 0.2s;
            box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .btn-main:hover { background: var(--primary-hover); transform: translateY(-1px); }

        /* HERO SECTION */
        .hero {
            max-width: 1100px;
            margin: 60px auto 40px;
            text-align: center;
            padding: 0 24px;
        }
        .hero-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(79, 70, 229, 0.15);
            border: 1px solid rgba(99, 102, 241, 0.3);
            color: #a5b4fc;
            padding: 6px 16px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 24px;
        }
        .hero h1 {
            font-size: 48px;
            font-weight: 900;
            line-height: 1.2;
            margin-bottom: 20px;
            letter-spacing: -1px;
            background: linear-gradient(135deg, #ffffff 30%, #94a3b8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .hero p {
            font-size: 18px;
            color: var(--text-muted);
            max-width: 680px;
            margin: 0 auto 36px;
            line-height: 1.6;
        }
        .hero-cta {
            display: flex;
            justify-content: center;
            gap: 16px;
            flex-wrap: wrap;
        }
        .btn-hero-primary {
            background: linear-gradient(135deg, #4f46e5, #6366f1);
            color: #fff;
            padding: 16px 36px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 700;
            text-decoration: none;
            box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.5);
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 10px;
        }
        .btn-hero-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 30px -5px rgba(79, 70, 229, 0.6);
        }
        .btn-hero-secondary {
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid var(--border);
            color: #f1f5f9;
            padding: 16px 32px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 10px;
        }
        .btn-hero-secondary:hover {
            background: #334155;
            color: #fff;
        }

        /* STATS BAR */
        .stats-strip {
            max-width: 960px;
            margin: 0 auto 60px;
            background: var(--card-bg);
            border: 1px solid var(--border);
            backdrop-filter: blur(16px);
            border-radius: 18px;
            padding: 24px;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            text-align: center;
        }
        @media (max-width: 768px) {
            .stats-strip { grid-template-columns: repeat(2, 1fr); }
            .hero h1 { font-size: 32px; }
        }
        .stat-item .val {
            font-size: 32px;
            font-weight: 800;
            color: #fff;
        }
        .stat-item .lbl {
            font-size: 13px;
            color: var(--text-muted);
            margin-top: 4px;
        }

        /* FEATURE MODULES GRID */
        .features-grid {
            max-width: 1100px;
            margin: 0 auto 80px;
            padding: 0 24px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
        }
        .feat-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 32px;
            backdrop-filter: blur(12px);
            transition: transform 0.2s, border-color 0.2s;
            display: flex;
            flex-direction: column;
        }
        .feat-card:hover {
            transform: translateY(-4px);
            border-color: rgba(99, 102, 241, 0.4);
        }
        .feat-icon {
            width: 50px;
            height: 50px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            margin-bottom: 20px;
        }
        .feat-icon.blue { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
        .feat-icon.purple { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
        .feat-icon.emerald { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .feat-card h3 {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 12px;
            color: #fff;
        }
        .feat-card p {
            font-size: 14px;
            color: var(--text-muted);
            line-height: 1.6;
            margin-bottom: 24px;
            flex: 1;
        }
        .feat-card .card-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #818cf8;
            font-size: 14px;
            font-weight: 600;
            text-decoration: none;
            transition: gap 0.2s;
        }
        .feat-card .card-link:hover { gap: 10px; color: #a5b4fc; }

        /* FOOTER */
        footer {
            margin-top: auto;
            border-top: 1px solid var(--border);
            padding: 24px 40px;
            text-align: center;
            font-size: 13px;
            color: #64748b;
        }
    </style>
</head>
<body>
    <!-- TOP NAVIGATION -->
    <header class="navbar">
        <a href="index.php" class="nav-brand">
            <div class="nav-logo">词</div>
            <div class="nav-title">
                <h2>HSK · BOYA</h2>
                <span>PHP Thuần & MySQL</span>
            </div>
        </a>

        <div class="nav-actions">
            <a href="word_learning.php" class="btn-link">📖 Học từ vựng</a>

            <?php if ($isLoggedIn): ?>
                <?php if (is_admin()): ?>
                    <a href="admin/index.php" class="btn-link" style="color:#f87171;">👑 Quản Trị Hệ Thống</a>
                <?php endif; ?>
                <span style="font-size:13px; color:#cbd5e1; margin:0 4px;">Chào, <strong><?= e($currentUser['full_name']) ?></strong></span>
                <a href="logout.php" class="btn-link" style="color:#ef4444;">Đăng xuất</a>
            <?php else: ?>
                <a href="login.php" class="btn-link">Đăng nhập</a>
                <a href="register.php" class="btn-main">✨ Đăng ký ngay</a>
            <?php endif; ?>
        </div>
    </header>

    <!-- HERO HEADER -->
    <section class="hero">
        <div class="hero-badge">
            <span>⚡ Kiến trúc PHP Thuần (No-Framework) & MySQL PDO</span>
        </div>
        <h1>Hệ Thống Học Từ Vựng Tiếng Trung Thông Minh</h1>
        <p>
            Nền tảng học từ vựng toàn diện theo giáo trình HSK 3.0 và Boya. Tích hợp Flashcard 3D, Trắc nghiệm Quiz, Podcast rảnh tay, Luyện phát âm AI và bảng Quản trị học liệu & người dùng mạnh mẽ.
        </p>

        <div class="hero-cta">
            <a href="word_learning.php" class="btn-hero-primary">
                <span>📖 Bắt Đầu Học Từ Vựng Ngay</span>
                <span>➔</span>
            </a>
            <a href="admin/index.php" class="btn-hero-secondary">
                <span>⚙️ Trang Quản Trị Hệ Thống</span>
            </a>
        </div>
    </section>

    <!-- LIVE DATABASE STATS STRIP -->
    <section class="stats-strip">
        <div class="stat-item">
            <div class="val"><?= number_format($stats['vocab']) ?></div>
            <div class="lbl">Từ vựng trong MySQL</div>
        </div>
        <div class="stat-item">
            <div class="val"><?= number_format($stats['units']) ?></div>
            <div class="lbl">Bài học / Chủ đề</div>
        </div>
        <div class="stat-item">
            <div class="val"><?= number_format($stats['books']) ?></div>
            <div class="lbl">Giáo trình đào tạo</div>
        </div>
        <div class="stat-item">
            <div class="val"><?= number_format($stats['users']) ?></div>
            <div class="lbl">Học viên & Quản trị</div>
        </div>
    </section>

    <!-- CORE FEATURES GRID -->
    <section class="features-grid">
        <!-- CARD 1 -->
        <div class="feat-card">
            <div class="feat-icon blue">📖</div>
            <h3>Giao Diện Học Từ Vựng Đa Năng</h3>
            <p>
                Trang <strong>word_learning.php</strong> cung cấp đầy đủ 5 chế độ: Sổ tay ghi nhớ, Thẻ Flashcard 3D lật mặt, Trắc nghiệm Quiz 4 phương án, Hands-free Podcast và Phòng thu luyện phát âm AI.
            </p>
            <a href="word_learning.php" class="card-link">Vào trang word_learning ➔</a>
        </div>

        <!-- CARD 2 -->
        <div class="feat-card">
            <div class="feat-icon purple">⚙️</div>
            <h3>Quản Lý & Thêm Học Liệu</h3>
            <p>
                Bảng điều khiển <strong>Admin</strong> cho phép thêm, sửa, xóa từ vựng (chữ Hán, pinyin, âm Hán Việt, từ loại, câu ví dụ, chiết tự), quản lý bài học, giáo trình và nạp nhanh từ file JSON.
            </p>
            <a href="admin/vocab.php" class="card-link">Quản lý học liệu ➔</a>
        </div>

        <!-- CARD 3 -->
        <div class="feat-card">
            <div class="feat-icon emerald">👥</div>
            <h3>Người Dùng & Xác Thực Bảo Mật</h3>
            <p>
                Tính năng đăng ký, đăng nhập bảo mật bằng mật khẩu mã hóa <code>password_hash()</code>, phân quyền quản trị viên / học viên, quản lý người dùng và lưu tiến độ học tập trên MySQL.
            </p>
            <a href="admin/users.php" class="card-link">Quản lý người dùng ➔</a>
        </div>
    </section>

    <!-- FOOTER -->
    <footer>
        <div>Hệ Thống Học Từ Vựng HSK 3.0 & BOYA · Xây dựng bằng PHP Thuần (PDO) & MySQL Database.</div>
    </footer>
</body>
</html>
