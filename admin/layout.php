<?php
// admin/layout.php - Giao diện chung cho trang Quản trị Admin
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

// Bắt buộc quyền Quản trị viên
require_admin();

$currentUser = current_user();

function renderAdminHeader(string $pageTitle, string $activeNav = 'dashboard') {
    global $currentUser;
    $flashSuccess = get_flash('success');
    $flashError = get_flash('error');
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($pageTitle) ?> · Quản Trị Hệ Thống</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #4f46e5;
            --primary-hover: #4338ca;
            --primary-light: rgba(79, 70, 229, 0.1);
            --bg-body: #0f172a;
            --bg-sidebar: #1e293b;
            --bg-card: #1e293b;
            --bg-input: #0f172a;
            --border: #334155;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --success: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
            --sidebar-width: 260px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, sans-serif; }
        body {
            background-color: var(--bg-body);
            color: var(--text-main);
            display: flex;
            min-height: 100vh;
        }
        /* SIDEBAR */
        .admin-sidebar {
            width: var(--sidebar-width);
            background: var(--bg-sidebar);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0; bottom: 0; left: 0;
            z-index: 100;
        }
        .sidebar-brand {
            padding: 24px 20px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .brand-icon {
            width: 38px;
            height: 38px;
            background: linear-gradient(135deg, #4f46e5, #06b6d4);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }
        .brand-text h2 {
            font-size: 16px;
            font-weight: 700;
            color: #fff;
            letter-spacing: -0.3px;
        }
        .brand-text span {
            font-size: 11px;
            color: #38bdf8;
            font-weight: 600;
            text-transform: uppercase;
        }
        .sidebar-menu {
            padding: 20px 12px;
            flex: 1;
            overflow-y: auto;
            list-style: none;
        }
        .menu-label {
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            padding: 10px 12px 6px;
        }
        .menu-item a {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            color: var(--text-muted);
            text-decoration: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.15s ease;
            margin-bottom: 3px;
        }
        .menu-item a:hover {
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
        }
        .menu-item.active a {
            background: var(--primary);
            color: #fff;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
        }
        .menu-item .icon { font-size: 18px; width: 22px; text-align: center; }
        .sidebar-footer {
            padding: 16px;
            border-top: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(0, 0, 0, 0.15);
        }
        .user-mini {
            display: flex;
            align-items: center;
            gap: 10px;
            overflow: hidden;
        }
        .user-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #4f46e5;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 14px;
        }
        .user-info {
            overflow: hidden;
        }
        .user-name {
            font-size: 13px;
            font-weight: 600;
            color: #fff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .user-role {
            font-size: 11px;
            color: #38bdf8;
        }
        .btn-logout {
            background: none;
            border: none;
            color: #94a3b8;
            font-size: 18px;
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            transition: color 0.2s;
        }
        .btn-logout:hover { color: #ef4444; }

        /* MAIN CONTENT */
        .admin-main {
            margin-left: var(--sidebar-width);
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }
        .admin-topbar {
            height: 70px;
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border);
            padding: 0 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 90;
        }
        .topbar-title h1 {
            font-size: 20px;
            font-weight: 700;
            color: #fff;
        }
        .topbar-actions {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .btn-pill {
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
            cursor: pointer;
            border: 1px solid transparent;
        }
        .btn-primary {
            background: var(--primary);
            color: #fff;
        }
        .btn-primary:hover {
            background: var(--primary-hover);
        }
        .btn-secondary {
            background: #334155;
            color: #e2e8f0;
            border-color: #475569;
        }
        .btn-secondary:hover {
            background: #475569;
            color: #fff;
        }
        .btn-danger {
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
            border-color: rgba(239, 68, 68, 0.4);
        }
        .btn-danger:hover {
            background: var(--danger);
            color: #fff;
        }

        /* PAGE BODY */
        .admin-content {
            padding: 32px;
            flex: 1;
        }
        .alert {
            padding: 14px 18px;
            border-radius: 10px;
            margin-bottom: 24px;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .alert-success {
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid var(--success);
            color: #6ee7b7;
        }
        .alert-error {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid var(--danger);
            color: #fca5a5;
        }

        /* CARDS & TABLES */
        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        .card-title {
            font-size: 16px;
            font-weight: 700;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .table-responsive {
            overflow-x: auto;
        }
        table.admin-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            text-align: left;
        }
        table.admin-table th {
            background: rgba(15, 23, 42, 0.6);
            color: #94a3b8;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
        }
        table.admin-table td {
            padding: 14px 16px;
            border-bottom: 1px solid #334155;
            color: #e2e8f0;
            vertical-align: middle;
        }
        table.admin-table tr:hover td {
            background: rgba(255, 255, 255, 0.02);
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
        }
        .badge-success { background: rgba(16, 185, 129, 0.2); color: #34d399; }
        .badge-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; }
        .badge-primary { background: rgba(79, 70, 229, 0.2); color: #818cf8; }
        .badge-info { background: rgba(6, 182, 212, 0.2); color: #38bdf8; }

        /* FORM CONTROLS */
        .form-row {
            display: flex;
            gap: 16px;
            margin-bottom: 16px;
        }
        .form-col { flex: 1; }
        .form-group {
            margin-bottom: 16px;
        }
        .form-group label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #cbd5e1;
            margin-bottom: 6px;
        }
        .form-control {
            width: 100%;
            background: var(--bg-input);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px 14px;
            color: #fff;
            font-size: 14px;
            outline: none;
            transition: all 0.2s;
        }
        .form-control:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
        }
        textarea.form-control {
            min-height: 80px;
            resize: vertical;
        }
        select.form-control {
            cursor: pointer;
        }

        /* MODAL */
        .modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
        }
        .modal-overlay.hidden { display: none; }
        .modal-box {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            max-width: 650px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .modal-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .modal-header h3 { font-size: 18px; font-weight: 700; color: #fff; }
        .modal-close {
            background: none;
            border: none;
            color: #94a3b8;
            font-size: 20px;
            cursor: pointer;
        }
        .modal-body { padding: 24px; }
        .modal-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            background: rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <!-- SIDEBAR -->
    <aside class="admin-sidebar">
        <div class="sidebar-brand">
            <div class="brand-icon">📚</div>
            <div class="brand-text">
                <h2>HSK · BOYA</h2>
                <span>Quản Trị Hệ Thống</span>
            </div>
        </div>

        <ul class="sidebar-menu">
            <li class="menu-label">Tổng Quan</li>
            <li class="menu-item <?= $activeNav === 'dashboard' ? 'active' : '' ?>">
                <a href="index.php">
                    <span class="icon">📊</span>
                    <span>Bảng Điều Khiển</span>
                </a>
            </li>

            <li class="menu-label">Quản Lý Học Liệu</li>
            <li class="menu-item <?= $activeNav === 'vocab' ? 'active' : '' ?>">
                <a href="vocab.php">
                    <span class="icon">📖</span>
                    <span>Từ Vựng Học Liệu</span>
                </a>
            </li>
            <li class="menu-item <?= $activeNav === 'books' ? 'active' : '' ?>">
                <a href="books.php">
                    <span class="icon">📑</span>
                    <span>Giáo Trình & Bài Học</span>
                </a>
            </li>
            <li class="menu-item <?= $activeNav === 'import' ? 'active' : '' ?>">
                <a href="import.php">
                    <span class="icon">⚡</span>
                    <span>Nhập Dữ Liệu JSON</span>
                </a>
            </li>

            <li class="menu-label">Hệ Thống & Người Dùng</li>
            <li class="menu-item <?= $activeNav === 'users' ? 'active' : '' ?>">
                <a href="users.php">
                    <span class="icon">👥</span>
                    <span>Quản Lý Người Dùng</span>
                </a>
            </li>

            <li class="menu-label">Học Viên</li>
            <li class="menu-item">
                <a href="../word_learning.php" target="_blank">
                    <span class="icon">🎓</span>
                    <span>Xem Trang Học ↗</span>
                </a>
            </li>
        </ul>

        <div class="sidebar-footer">
            <div class="user-mini">
                <div class="user-avatar"><?= mb_strtoupper(mb_substr($currentUser['full_name'] ?? 'A', 0, 1)) ?></div>
                <div class="user-info">
                    <div class="user-name"><?= e($currentUser['full_name']) ?></div>
                    <div class="user-role">Quản trị viên</div>
                </div>
            </div>
            <a href="../logout.php" class="btn-logout" title="Đăng xuất">🚪</a>
        </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="admin-main">
        <header class="admin-topbar">
            <div class="topbar-title">
                <h1><?= e($pageTitle) ?></h1>
            </div>
            <div class="topbar-actions">
                <a href="../word_learning.php" class="btn-pill btn-secondary" target="_blank">
                    <span>👁️ Xem giao diện học</span>
                </a>
                <a href="vocab.php?action=create" class="btn-pill btn-primary">
                    <span>➕ Thêm từ vựng mới</span>
                </a>
            </div>
        </header>

        <div class="admin-content">
            <?php if ($flashSuccess): ?>
                <div class="alert alert-success">
                    <span>✅</span>
                    <span><?= e($flashSuccess) ?></span>
                </div>
            <?php endif; ?>

            <?php if ($flashError): ?>
                <div class="alert alert-error">
                    <span>⚠️</span>
                    <span><?= e($flashError) ?></span>
                </div>
            <?php endif; ?>
<?php
}

function renderAdminFooter() {
?>
        </div><!-- .admin-content -->
    </main>
</body>
</html>
<?php
}
