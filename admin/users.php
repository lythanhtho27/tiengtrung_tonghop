<?php
// admin/users.php - Quản lý Người Dùng & Phân Quyền
require_once __DIR__ . '/layout.php';

$pdo = getDbConnection();
$currentAdminId = current_user_id();
$action = get('action', 'list');
$id = (int)get('id', 0);

// XỬ LÝ KHÓA / MỞ KHÓA TÀI KHOẢN
if ($action === 'toggle_status' && $id > 0) {
    if ($id === $currentAdminId) {
        set_flash('error', 'Bạn không thể tự khóa tài khoản của chính mình.');
    } else {
        try {
            $stmt = $pdo->prepare("SELECT status, username FROM users WHERE id = ?");
            $stmt->execute([$id]);
            $u = $stmt->fetch();
            if ($u) {
                $newStatus = (int)$u['status'] === 1 ? 0 : 1;
                $pdo->prepare("UPDATE users SET status = ? WHERE id = ?")->execute([$newStatus, $id]);
                set_flash('success', "Đã " . ($newStatus ? "kích hoạt" : "khóa") . " tài khoản @{$u['username']}.");
            }
        } catch (Exception $e) {
            set_flash('error', 'Lỗi: ' . $e->getMessage());
        }
    }
    header('Location: users.php');
    exit;
}

// XỬ LÝ XÓA NGƯỜI DÙNG
if ($action === 'delete' && $id > 0) {
    if ($id === $currentAdminId) {
        set_flash('error', 'Bạn không thể tự xóa tài khoản đang đăng nhập.');
    } else {
        try {
            $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
            $stmt->execute([$id]);
            set_flash('success', 'Đã xóa tài khoản người dùng thành công.');
        } catch (Exception $e) {
            set_flash('error', 'Lỗi khi xóa: ' . $e->getMessage());
        }
    }
    header('Location: users.php');
    exit;
}

// XỬ LÝ LƯU NGƯỜI DÙNG (THÊM HOẶC SỬA)
if (is_post() && post('form_type') === 'save_user') {
    $fullName = trim(post('full_name'));
    $username = trim(post('username'));
    $email = trim(post('email'));
    $password = post('password');
    $role = post('role') === 'admin' ? 'admin' : 'user';
    $status = post('status') === '0' ? 0 : 1;
    $editId = (int)post('user_id', 0);

    if (empty($fullName) || empty($username) || empty($email)) {
        set_flash('error', 'Vui lòng điền đầy đủ Họ tên, Tên đăng nhập và Email.');
    } elseif ($editId === 0 && empty($password)) {
        set_flash('error', 'Vui lòng nhập mật khẩu cho tài khoản mới.');
    } else {
        try {
            // Kiểm tra trùng username / email
            $stmtCheck = $pdo->prepare("SELECT id, username, email FROM users WHERE (username = ? OR email = ?) AND id != ?");
            $stmtCheck->execute([$username, $email, $editId]);
            $existing = $stmtCheck->fetch();

            if ($existing) {
                set_flash('error', 'Tên đăng nhập hoặc Email này đã tồn tại trên hệ thống.');
            } else {
                if ($editId > 0) {
                    // Cập nhật người dùng
                    if (!empty($password)) {
                        $hash = hash_password($password);
                        $stmt = $pdo->prepare("UPDATE users SET full_name = ?, username = ?, email = ?, password = ?, role = ?, status = ? WHERE id = ?");
                        $stmt->execute([$fullName, $username, $email, $hash, $role, $status, $editId]);
                    } else {
                        $stmt = $pdo->prepare("UPDATE users SET full_name = ?, username = ?, email = ?, role = ?, status = ? WHERE id = ?");
                        $stmt->execute([$fullName, $username, $email, $role, $status, $editId]);
                    }
                    set_flash('success', "Đã cập nhật thông tin người dùng @{$username} thành công!");
                } else {
                    // Thêm mới người dùng
                    $hash = hash_password($password);
                    $stmt = $pdo->prepare("INSERT INTO users (full_name, username, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)");
                    $stmt->execute([$fullName, $username, $email, $hash, $role, $status]);
                    $newId = $pdo->lastInsertId();

                    // Khởi tạo stats
                    $pdo->prepare("INSERT INTO user_stats (user_id, streak_count, longest_streak, total_xp, level) VALUES (?, 1, 1, 50, 1)")
                        ->execute([$newId]);

                    set_flash('success', "Đã tạo tài khoản mới @{$username} thành công!");
                }
                header('Location: users.php');
                exit;
            }
        } catch (Exception $e) {
            set_flash('error', 'Lỗi cơ sở dữ liệu: ' . $e->getMessage());
        }
    }
}

// LẤY DỮ LIỆU ĐỂ SỬA (NẾU CÓ)
$editUser = null;
if ($action === 'edit' && $id > 0) {
    $stmtUser = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmtUser->execute([$id]);
    $editUser = $stmtUser->fetch();
}

// TÌM KIẾM VÀ LẤY DANH SÁCH TẤT CẢ NGƯỜI DÙNG
$search = trim(get('search', ''));
$params = [];
$whereSql = "";
if (!empty($search)) {
    $whereSql = "WHERE (u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)";
    $term = "%$search%";
    $params = [$term, $term, $term];
}

$sql = "SELECT u.*, s.streak_count, s.total_xp, s.level 
    FROM users u 
    LEFT JOIN user_stats s ON u.id = s.user_id 
    $whereSql 
    ORDER BY u.id DESC";
$stmtUsers = $pdo->prepare($sql);
$stmtUsers->execute($params);
$usersList = $stmtUsers->fetchAll();

renderAdminHeader('Quản Lý Người Dùng & Phân Quyền', 'users');
?>

<div style="display: grid; grid-template-columns: 380px 1fr; gap: 24px;">
    <!-- CỘT TRÁI: FORM THÊM / SỬA NGƯỜI DÙNG -->
    <div class="card">
        <div class="card-title" style="margin-bottom: 20px;">
            <?= $editUser ? ('✏️ Sửa Tài Khoản: @' . e($editUser['username'])) : '➕ Thêm Người Dùng Mới' ?>
        </div>

        <form method="POST">
            <input type="hidden" name="form_type" value="save_user">
            <?php if ($editUser): ?>
                <input type="hidden" name="user_id" value="<?= $editUser['id'] ?>">
            <?php endif; ?>

            <div class="form-group">
                <label>Họ và tên *</label>
                <input type="text" name="full_name" class="form-control" placeholder="Nguyễn Văn A" value="<?= e($editUser['full_name'] ?? '') ?>" required>
            </div>

            <div class="form-group">
                <label>Tên đăng nhập (Username) *</label>
                <input type="text" name="username" class="form-control" placeholder="nguyenvana" value="<?= e($editUser['username'] ?? '') ?>" required>
            </div>

            <div class="form-group">
                <label>Địa chỉ Email *</label>
                <input type="email" name="email" class="form-control" placeholder="a@example.com" value="<?= e($editUser['email'] ?? '') ?>" required>
            </div>

            <div class="form-group">
                <label><?= $editUser ? 'Mật khẩu mới (Bỏ trống nếu không đổi)' : 'Mật khẩu khởi tạo *' ?></label>
                <input type="password" name="password" class="form-control" placeholder="<?= $editUser ? 'Nhập mật khẩu mới...' : 'Ít nhất 6 ký tự' ?>" <?= $editUser ? '' : 'required' ?>>
            </div>

            <div class="form-row">
                <div class="form-col">
                    <label>Phân quyền vai trò</label>
                    <select name="role" class="form-control">
                        <option value="user" <?= ($editUser['role'] ?? '') === 'user' ? 'selected' : '' ?>>🎒 Học viên (User)</option>
                        <option value="admin" <?= ($editUser['role'] ?? '') === 'admin' ? 'selected' : '' ?>>👑 Quản trị viên (Admin)</option>
                    </select>
                </div>
                <div class="form-col">
                    <label>Trạng thái</label>
                    <select name="status" class="form-control">
                        <option value="1" <?= ((int)($editUser['status'] ?? 1) === 1) ? 'selected' : '' ?>>Hoạt động</option>
                        <option value="0" <?= ((int)($editUser['status'] ?? 1) === 0) ? 'selected' : '' ?>>Khóa tài khoản</option>
                    </select>
                </div>
            </div>

            <div style="display:flex; gap:10px; margin-top:20px;">
                <?php if ($editUser): ?>
                    <a href="users.php" class="btn-pill btn-secondary" style="flex:1; justify-content:center;">Hủy</a>
                <?php endif; ?>
                <button type="submit" class="btn-pill btn-primary" style="flex:2; justify-content:center; padding:12px;">
                    💾 <?= $editUser ? 'Cập Nhật Người Dùng' : 'Tạo Tài Khoản Mới' ?>
                </button>
            </div>
        </form>
    </div>

    <!-- CỘT PHẢI: BẢNG DANH SÁCH NGƯỜI DÙNG -->
    <div class="card">
        <div class="card-header">
            <div class="card-title">
                <span>Danh sách tài khoản</span>
                <span class="badge badge-info"><?= count($usersList) ?> người dùng</span>
            </div>
            <form method="GET" style="display:flex; gap:8px;">
                <input type="text" name="search" class="form-control" style="width:200px; padding:6px 12px; font-size:13px;" placeholder="Tìm tên, username..." value="<?= e($search) ?>">
                <button type="submit" class="btn-pill btn-primary" style="padding:6px 12px; font-size:12px;">Tìm</button>
            </form>
        </div>

        <div class="table-responsive">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Người dùng</th>
                        <th>Vai trò</th>
                        <th>Tiến độ</th>
                        <th>Trạng thái</th>
                        <th>Ngày tạo</th>
                        <th style="text-align:right;">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($usersList)): ?>
                        <tr><td colspan="6" style="text-align:center; padding:24px; color:#94a3b8;">Không tìm thấy người dùng nào.</td></tr>
                    <?php else: ?>
                        <?php foreach ($usersList as $u): ?>
                            <tr>
                                <td>
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <div style="width:34px; height:34px; border-radius:50%; background:#4f46e5; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px;">
                                            <?= mb_strtoupper(mb_substr($u['full_name'], 0, 1)) ?>
                                        </div>
                                        <div>
                                            <div style="font-weight:600; color:#fff;"><?= e($u['full_name']) ?></div>
                                            <div style="font-size:12px; color:#94a3b8;">@<?= e($u['username']) ?> · <?= e($u['email']) ?></div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <?php if ($u['role'] === 'admin'): ?>
                                        <span class="badge badge-danger">👑 Quản trị</span>
                                    <?php else: ?>
                                        <span class="badge badge-info">🎒 Học viên</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <div style="font-size:12px;">
                                        🔥 <strong style="color:#fb923c;"><?= $u['streak_count'] ?? 1 ?></strong> ngày
                                    </div>
                                    <div style="font-size:11px; color:#94a3b8;">
                                        ⚡ <?= $u['total_xp'] ?? 50 ?> XP · Lv.<?= $u['level'] ?? 1 ?>
                                    </div>
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
                                <td style="text-align:right;">
                                    <div style="display:inline-flex; gap:6px;">
                                        <a href="users.php?action=edit&id=<?= $u['id'] ?>" class="btn-pill btn-secondary" style="font-size:11px; padding:3px 8px;" title="Chỉnh sửa">
                                            ✏️
                                        </a>

                                        <?php if ($u['id'] != $currentAdminId): ?>
                                            <a href="users.php?action=toggle_status&id=<?= $u['id'] ?>" class="btn-pill <?= (int)$u['status'] === 1 ? 'btn-secondary' : 'btn-primary' ?>" style="font-size:11px; padding:3px 8px;" title="<?= (int)$u['status'] === 1 ? 'Khóa tài khoản' : 'Mở khóa' ?>">
                                                <?= (int)$u['status'] === 1 ? '🔒 Khóa' : '🔓 Mở' ?>
                                            </a>
                                            <a href="users.php?action=delete&id=<?= $u['id'] ?>" class="btn-pill btn-danger" style="font-size:11px; padding:3px 8px;" onclick="return confirm('Bạn có chắc chắn muốn xóa tài khoản @<?= e($u['username']) ?> không?')" title="Xóa vĩnh viễn">
                                                🗑️
                                            </a>
                                        <?php else: ?>
                                            <span style="font-size:11px; color:#64748b; padding:3px 6px;">(Bạn)</span>
                                        <?php endif; ?>
                                    </div>
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
