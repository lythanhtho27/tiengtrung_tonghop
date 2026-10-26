<?php
// admin/index.php - Bảng điều khiển quản trị
require_once __DIR__ . '/layout.php';

$pdo = getDbConnection();

// 1. Thống kê tổng quan
$totalVocab = $pdo->query("SELECT COUNT(*) FROM vocabularies")->fetchColumn();
$totalBooks = $pdo->query("SELECT COUNT(*) FROM books")->fetchColumn();
$totalUnits = $pdo->query("SELECT COUNT(*) FROM units")->fetchColumn();
$totalUsers = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
$totalLearners = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'user'")->fetchColumn();

// Thống kê tiến độ học
$totalFavorites = $pdo->query("SELECT COUNT(*) FROM user_progress WHERE is_favorite = 1")->fetchColumn();
$totalMastered = $pdo->query("SELECT COUNT(*) FROM user_progress WHERE status = 'mastered'")->fetchColumn();

// 2. Danh sách người dùng mới nhất
$stmtRecentUsers = $pdo->query("SELECT id, username, email, full_name, role, status, created_at FROM users ORDER BY id DESC LIMIT 5");
$recentUsers = $stmtRecentUsers->fetchAll();

// 3. Danh sách từ vựng vừa thêm mới nhất
$stmtRecentVocab = $pdo->query("SELECT v.*, u.title AS unit_title, b.title AS book_title 
    FROM vocabularies v
    LEFT JOIN units u ON v.unit_id = u.id
    LEFT JOIN books b ON u.book_id = b.id
    ORDER BY v.id DESC LIMIT 8");
$recentVocab = $stmtRecentVocab->fetchAll();

renderAdminHeader('Bảng Điều Khiển Tổng Quan', 'dashboard');
?>
<style>
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 20px;
        margin-bottom: 28px;
    }
    .stat-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 20px -5px rgba(0,0,0,0.3);
    }
    .stat-icon {
        width: 52px;
        height: 52px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
    }
    .stat-blue { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
    .stat-purple { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
    .stat-green { background: rgba(52, 211, 153, 0.15); color: #34d399; }
    .stat-orange { background: rgba(251, 146, 60, 0.15); color: #fb923c; }

    .stat-info .num {
        font-size: 26px;
        font-weight: 800;
        color: #fff;
        line-height: 1.2;
    }
    .stat-info .label {
        font-size: 13px;
        color: var(--text-muted);
        margin-top: 2px;
    }

    .quick-actions-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 28px;
    }
    .quick-btn {
        background: #1e293b;
        border: 1px solid #334155;
        padding: 10px 18px;
        border-radius: 10px;
        color: #f1f5f9;
        text-decoration: none;
        font-size: 13px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
    }
    .quick-btn:hover {
        background: #334155;
        border-color: #64748b;
        color: #fff;
    }

    .dashboard-split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
    }
    @media (max-width: 1024px) {
        .dashboard-split { grid-template-columns: 1fr; }
    }
    .hanzi-cell {
        font-size: 20px;
        font-weight: 700;
        font-family: 'Noto Sans SC', sans-serif;
        color: #f8fafc;
    }
    .pinyin-cell {
        color: #38bdf8;
        font-size: 13px;
    }
</style>

<!-- THỐNG KÊ NHANH -->
<div class="stats-grid">
    <div class="stat-card">
        <div class="stat-icon stat-blue">📖</div>
        <div class="stat-info">
            <div class="num"><?= number_format($totalVocab) ?></div>
            <div class="label">Từ vựng học liệu</div>
        </div>
    </div>

    <div class="stat-card">
        <div class="stat-icon stat-purple">📑</div>
        <div class="stat-info">
            <div class="num"><?= number_format($totalUnits) ?></div>
            <div class="label">Bài học (<?= $totalBooks ?> giáo trình)</div>
        </div>
    </div>

    <div class="stat-card">
        <div class="stat-icon stat-green">👥</div>
        <div class="stat-info">
            <div class="num"><?= number_format($totalUsers) ?></div>
            <div class="label">Người dùng (<?= $totalLearners ?> học viên)</div>
        </div>
    </div>

    <div class="stat-card">
        <div class="stat-icon stat-orange">🎯</div>
        <div class="stat-info">
            <div class="num"><?= number_format($totalMastered) ?></div>
            <div class="label">Từ đã thuộc (<?= $totalFavorites ?> yêu thích)</div>
        </div>
    </div>
</div>

<!-- THANH THAO TÁC NHANH -->
<div class="quick-actions-bar">
    <a href="vocab.php?action=create" class="quick-btn">
        <span>➕ Thêm từ vựng</span>
    </a>
    <a href="users.php?action=create" class="quick-btn">
        <span>👤 Thêm người dùng</span>
    </a>
    <a href="books.php" class="quick-btn">
        <span>📚 Quản lý giáo trình & bài học</span>
    </a>
    <a href="import.php" class="quick-btn">
        <span>⚡ Nhập thêm từ vựng JSON</span>
    </a>
</div>

<div class="dashboard-split">
    <!-- TỪ VỰNG MỚI THÊM -->
    <div class="card">
        <div class="card-header">
            <div class="card-title">📖 Từ vựng mới cập nhật</div>
            <a href="vocab.php" class="btn-pill btn-secondary" style="font-size:12px; padding:4px 10px;">Xem tất cả</a>
        </div>
        <div class="table-responsive">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Chữ Hán</th>
                        <th>Phiên âm</th>
                        <th>Nghĩa tiếng Việt</th>
                        <th>Bài học</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($recentVocab)): ?>
                        <tr><td colspan="4" style="text-align:center; color:#94a3b8;">Chưa có từ vựng nào.</td></tr>
                    <?php else: ?>
                        <?php foreach ($recentVocab as $v): ?>
                            <tr>
                                <td>
                                    <span class="hanzi-cell"><?= e($v['word']) ?></span>
                                    <?php if ($v['traditional'] && $v['traditional'] !== $v['word']): ?>
                                        <small style="color:#64748b;">(<?= e($v['traditional']) ?>)</small>
                                    <?php endif; ?>
                                </td>
                                <td><span class="pinyin-cell"><?= e($v['pinyin']) ?></span></td>
                                <td><?= e($v['meaning_vi']) ?></td>
                                <td>
                                    <span class="badge badge-primary"><?= e($v['unit_title'] ?? 'Bài ' . $v['unit_id']) ?></span>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- NGƯỜI DÙNG MỚI ĐĂNG KÝ -->
    <div class="card">
        <div class="card-header">
            <div class="card-title">👥 Tài khoản người dùng mới</div>
            <a href="users.php" class="btn-pill btn-secondary" style="font-size:12px; padding:4px 10px;">Quản lý</a>
        </div>
        <div class="table-responsive">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Người dùng</th>
                        <th>Vai trò</th>
                        <th>Trạng thái</th>
                        <th>Ngày tạo</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($recentUsers)): ?>
                        <tr><td colspan="4" style="text-align:center; color:#94a3b8;">Chưa có người dùng.</td></tr>
                    <?php else: ?>
                        <?php foreach ($recentUsers as $u): ?>
                            <tr>
                                <td>
                                    <div style="font-weight:600; color:#fff;"><?= e($u['full_name']) ?></div>
                                    <small style="color:#94a3b8;">@<?= e($u['username']) ?> · <?= e($u['email']) ?></small>
                                </td>
                                <td>
                                    <?php if ($u['role'] === 'admin'): ?>
                                        <span class="badge badge-danger">👑 Quản trị</span>
                                    <?php else: ?>
                                        <span class="badge badge-info">🎒 Học viên</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <?php if ((int)$u['status'] === 1): ?>
                                        <span class="badge badge-success">Hoạt động</span>
                                    <?php else: ?>
                                        <span class="badge badge-danger">Đã khóa</span>
                                    <?php endif; ?>
                                </td>
                                <td style="font-size:12px; color:#94a3b8;">
                                    <?= date('d/m/Y', strtotime($u['created_at'])) ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<?php
renderAdminFooter();
