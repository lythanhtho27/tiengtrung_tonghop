<?php
// admin/books.php - Quản lý Giáo trình và Bài học
require_once __DIR__ . '/layout.php';

$pdo = getDbConnection();
$tab = get('tab', 'books');
$action = get('action', '');
$id = (int)get('id', 0);

// XỬ LÝ XÓA SÁCH HOẶC BÀI HỌC
if ($action === 'delete_book' && $id > 0) {
    try {
        $stmt = $pdo->prepare("DELETE FROM books WHERE id = ?");
        $stmt->execute([$id]);
        set_flash('success', 'Đã xóa giáo trình thành công.');
    } catch (Exception $e) {
        set_flash('error', 'Lỗi khi xóa: ' . $e->getMessage());
    }
    header('Location: books.php?tab=books');
    exit;
}

if ($action === 'delete_unit' && $id > 0) {
    try {
        $stmt = $pdo->prepare("DELETE FROM units WHERE id = ?");
        $stmt->execute([$id]);
        set_flash('success', 'Đã xóa bài học thành công.');
    } catch (Exception $e) {
        set_flash('error', 'Lỗi khi xóa: ' . $e->getMessage());
    }
    header('Location: books.php?tab=units');
    exit;
}

// XỬ LÝ LƯU SÁCH (THÊM / SỬA)
if (is_post() && post('form_type') === 'book') {
    $bookCode = trim(post('book_code'));
    $title = trim(post('title'));
    $level = trim(post('level'));
    $badge = trim(post('badge'));
    $color = trim(post('color', '#ef4444'));
    $description = trim(post('description'));
    $sortOrder = (int)post('sort_order', 0);
    $bookId = (int)post('book_id', 0);

    if (empty($bookCode) || empty($title)) {
        set_flash('error', 'Vui lòng nhập Mã giáo trình và Tên giáo trình.');
    } else {
        try {
            if ($bookId > 0) {
                $stmt = $pdo->prepare("UPDATE books SET book_code = ?, title = ?, level = ?, badge = ?, color = ?, description = ?, sort_order = ? WHERE id = ?");
                $stmt->execute([$bookCode, $title, $level, $badge, $color, $description, $sortOrder, $bookId]);
                set_flash('success', 'Đã cập nhật giáo trình thành công.');
            } else {
                $stmt = $pdo->prepare("INSERT INTO books (book_code, title, level, badge, color, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([$bookCode, $title, $level, $badge, $color, $description, $sortOrder]);
                set_flash('success', 'Đã thêm giáo trình mới thành công.');
            }
        } catch (Exception $e) {
            set_flash('error', 'Lỗi: ' . $e->getMessage());
        }
    }
    header('Location: books.php?tab=books');
    exit;
}

// XỬ LÝ LƯU BÀI HỌC (THÊM / SỬA)
if (is_post() && post('form_type') === 'unit') {
    $bookId = (int)post('book_id');
    $unitNumber = (int)post('unit_number');
    $title = trim(post('title'));
    $description = trim(post('description'));
    $sortOrder = (int)post('sort_order', 0);
    $unitId = (int)post('unit_id', 0);

    if (empty($title) || $bookId <= 0 || $unitNumber <= 0) {
        set_flash('error', 'Vui lòng chọn Giáo trình, nhập Số thứ tự bài và Tên bài học.');
    } else {
        try {
            if ($unitId > 0) {
                $stmt = $pdo->prepare("UPDATE units SET book_id = ?, unit_number = ?, title = ?, description = ?, sort_order = ? WHERE id = ?");
                $stmt->execute([$bookId, $unitNumber, $title, $description, $sortOrder, $unitId]);
                set_flash('success', 'Đã cập nhật bài học thành công.');
            } else {
                $stmt = $pdo->prepare("INSERT INTO units (book_id, unit_number, title, description, sort_order) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$bookId, $unitNumber, $title, $description, $sortOrder ?: $unitNumber]);
                set_flash('success', 'Đã thêm bài học mới thành công.');
            }
        } catch (Exception $e) {
            set_flash('error', 'Lỗi: ' . $e->getMessage());
        }
    }
    header('Location: books.php?tab=units');
    exit;
}

// LẤY DANH SÁCH SÁCH KÈM SỐ BÀI VÀ TỪ VỰNG
$books = $pdo->query("SELECT b.*, 
    (SELECT COUNT(*) FROM units u WHERE u.book_id = b.id) AS unit_count,
    (SELECT COUNT(*) FROM vocabularies v JOIN units u ON v.unit_id = u.id WHERE u.book_id = b.id) AS word_count
    FROM books b ORDER BY b.sort_order ASC, b.id ASC")->fetchAll();

// LẤY DANH SÁCH BÀI HỌC
$selectedBookFilter = (int)get('filter_book', 0);
$unitWhere = $selectedBookFilter > 0 ? "WHERE u.book_id = $selectedBookFilter" : "";
$units = $pdo->query("SELECT u.*, b.title AS book_title, b.color AS book_color,
    (SELECT COUNT(*) FROM vocabularies v WHERE v.unit_id = u.id) AS word_count
    FROM units u
    JOIN books b ON u.book_id = b.id
    $unitWhere
    ORDER BY b.sort_order ASC, u.sort_order ASC, u.unit_number ASC")->fetchAll();

renderAdminHeader('Quản Lý Giáo Trình & Bài Học', 'books');
?>
<style>
    .tabs-nav {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 12px;
    }
    .tab-btn {
        padding: 10px 20px;
        border-radius: 10px;
        color: #94a3b8;
        text-decoration: none;
        font-weight: 600;
        font-size: 14px;
        transition: 0.2s;
    }
    .tab-btn:hover { color: #fff; background: rgba(255,255,255,0.05); }
    .tab-btn.active { background: var(--primary); color: #fff; }
</style>

<div class="tabs-nav">
    <a href="?tab=books" class="tab-btn <?= $tab === 'books' ? 'active' : '' ?>">📚 Danh Mục Giáo Trình (<?= count($books) ?>)</a>
    <a href="?tab=units" class="tab-btn <?= $tab === 'units' ? 'active' : '' ?>">📑 Danh Sách Bài Học (<?= count($units) ?>)</a>
</div>

<?php if ($tab === 'books'): ?>
    <!-- TAB 1: QUẢN LÝ GIÁO TRÌNH -->
    <div style="display: grid; grid-template-columns: 360px 1fr; gap: 24px;">
        <!-- FORM THÊM GIÁO TRÌNH -->
        <div class="card">
            <div class="card-title" style="margin-bottom: 18px;">➕ Thêm Giáo Trình Mới</div>
            <form method="POST">
                <input type="hidden" name="form_type" value="book">

                <div class="form-group">
                    <label>Mã giáo trình (Book Code) *</label>
                    <input type="text" name="book_code" class="form-control" placeholder="ví dụ: hsk2, boya2..." required>
                </div>

                <div class="form-group">
                    <label>Tên giáo trình (Tiêu đề) *</label>
                    <input type="text" name="title" class="form-control" placeholder="Ví dụ: HSK 3.0 — Quyển 2" required>
                </div>

                <div class="form-row">
                    <div class="form-col">
                        <label>Cấp độ</label>
                        <input type="text" name="level" class="form-control" placeholder="HSK 2">
                    </div>
                    <div class="form-col">
                        <label>Huy hiệu Badge</label>
                        <input type="text" name="badge" class="form-control" placeholder="CẤP ĐỘ 2">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-col">
                        <label>Màu chủ đề</label>
                        <input type="color" name="color" class="form-control" value="#3b82f6" style="height: 42px; padding: 4px;">
                    </div>
                    <div class="form-col">
                        <label>Thứ tự sắp xếp</label>
                        <input type="number" name="sort_order" class="form-control" value="0">
                    </div>
                </div>

                <div class="form-group">
                    <label>Mô tả ngắn</label>
                    <textarea name="description" class="form-control" rows="2" placeholder="Mô tả nội dung giáo trình..."></textarea>
                </div>

                <button type="submit" class="btn-pill btn-primary" style="width: 100%; justify-content: center; padding: 12px;">
                    💾 Lưu Giáo Trình
                </button>
            </form>
        </div>

        <!-- DANH SÁCH GIÁO TRÌNH -->
        <div class="card">
            <div class="card-header">
                <div class="card-title">📚 Các Giáo Trình Hiện Có</div>
            </div>
            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Mã sách</th>
                            <th>Tên giáo trình</th>
                            <th>Cấp độ</th>
                            <th>Bài học</th>
                            <th>Từ vựng</th>
                            <th style="text-align:right;">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($books as $b): ?>
                            <tr>
                                <td>
                                    <span class="badge" style="background: <?= e($b['color']) ?>22; color: <?= e($b['color']) ?>; border: 1px solid <?= e($b['color']) ?>55;">
                                        <?= e($b['book_code']) ?>
                                    </span>
                                </td>
                                <td>
                                    <strong style="color:#fff; font-size:15px;"><?= e($b['title']) ?></strong>
                                    <?php if ($b['description']): ?>
                                        <div style="font-size:12px; color:#94a3b8;"><?= e($b['description']) ?></div>
                                    <?php endif; ?>
                                </td>
                                <td><span class="badge badge-primary"><?= e($b['level']) ?></span></td>
                                <td><strong style="color:#38bdf8;"><?= $b['unit_count'] ?></strong> bài</td>
                                <td><strong style="color:#34d399;"><?= number_format($b['word_count']) ?></strong> từ</td>
                                <td style="text-align:right;">
                                    <a href="books.php?tab=units&filter_book=<?= $b['id'] ?>" class="btn-pill btn-secondary" style="font-size:11px; padding:3px 8px;">Xem bài</a>
                                    <a href="books.php?action=delete_book&id=<?= $b['id'] ?>" class="btn-pill btn-danger" style="font-size:11px; padding:3px 8px;" onclick="return confirm('Xóa giáo trình này sẽ xóa TOÀN BỘ bài học và từ vựng liên quan! Bạn có chắc không?')">🗑️</a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

<?php else: ?>
    <!-- TAB 2: QUẢN LÝ BÀI HỌC -->
    <div style="display: grid; grid-template-columns: 360px 1fr; gap: 24px;">
        <!-- FORM THÊM BÀI HỌC -->
        <div class="card">
            <div class="card-title" style="margin-bottom: 18px;">➕ Thêm Bài Học Mới</div>
            <form method="POST">
                <input type="hidden" name="form_type" value="unit">

                <div class="form-group">
                    <label>Thuộc Giáo trình *</label>
                    <select name="book_id" class="form-control" required>
                        <?php foreach ($books as $b): ?>
                            <option value="<?= $b['id'] ?>" <?= $selectedBookFilter == $b['id'] ? 'selected' : '' ?>>
                                <?= e($b['title']) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="form-row">
                    <div class="form-col">
                        <label>Số thứ tự bài *</label>
                        <input type="number" name="unit_number" class="form-control" placeholder="1" min="1" required>
                    </div>
                    <div class="form-col">
                        <label>Thứ tự hiển thị</label>
                        <input type="number" name="sort_order" class="form-control" placeholder="0">
                    </div>
                </div>

                <div class="form-group">
                    <label>Tên bài học (Tiêu đề) *</label>
                    <input type="text" name="title" class="form-control" placeholder="Ví dụ: Bài 1: Xin chào (你好)" required>
                </div>

                <div class="form-group">
                    <label>Mô tả / Phạm vi từ vựng</label>
                    <textarea name="description" class="form-control" rows="2" placeholder="Ví dụ: Từ vựng mở đầu: 爱 - 北边..."></textarea>
                </div>

                <button type="submit" class="btn-pill btn-primary" style="width: 100%; justify-content: center; padding: 12px;">
                    💾 Lưu Bài Học
                </button>
            </form>
        </div>

        <!-- DANH SÁCH BÀI HỌC -->
        <div class="card">
            <div class="card-header">
                <div class="card-title">📑 Danh Sách Bài Học Hiện Có</div>
                <form method="GET" style="display:flex; gap:10px;">
                    <input type="hidden" name="tab" value="units">
                    <select name="filter_book" class="form-control" onchange="this.form.submit()" style="font-size:13px; width:220px;">
                        <option value="0">-- Tất cả giáo trình --</option>
                        <?php foreach ($books as $b): ?>
                            <option value="<?= $b['id'] ?>" <?= $selectedBookFilter == $b['id'] ? 'selected' : '' ?>>
                                <?= e($b['title']) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </form>
            </div>

            <div class="table-responsive">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th style="width:60px;">Bài</th>
                            <th>Tiêu đề bài học</th>
                            <th>Giáo trình</th>
                            <th>Số từ</th>
                            <th style="text-align:right;">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($units)): ?>
                            <tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">Chưa có bài học nào.</td></tr>
                        <?php else: ?>
                            <?php foreach ($units as $u): ?>
                                <tr>
                                    <td><strong style="color:#38bdf8;">#<?= $u['unit_number'] ?></strong></td>
                                    <td>
                                        <div style="font-weight:600; color:#fff;"><?= e($u['title']) ?></div>
                                        <?php if ($u['description']): ?>
                                            <div style="font-size:12px; color:#94a3b8;"><?= e($u['description']) ?></div>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <span class="badge" style="background: <?= e($u['book_color']) ?>22; color: <?= e($u['book_color']) ?>;">
                                            <?= e($u['book_title']) ?>
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge badge-info"><?= $u['word_count'] ?> từ</span>
                                    </td>
                                    <td style="text-align:right;">
                                        <a href="vocab.php?unit_id=<?= $u['id'] ?>" class="btn-pill btn-secondary" style="font-size:11px; padding:3px 8px;">Xem từ</a>
                                        <a href="vocab.php?action=create&unit_id=<?= $u['id'] ?>" class="btn-pill btn-primary" style="font-size:11px; padding:3px 8px;">+ Thêm từ</a>
                                        <a href="books.php?action=delete_unit&id=<?= $u['id'] ?>" class="btn-pill btn-danger" style="font-size:11px; padding:3px 8px;" onclick="return confirm('Bạn có chắc muốn xóa bài học này?')">🗑️</a>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
<?php endif; ?>

<?php
renderAdminFooter();
