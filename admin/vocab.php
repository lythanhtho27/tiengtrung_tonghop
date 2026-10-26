<?php
// admin/vocab.php - Quản lý và Thêm Học Liệu Từ Vựng
require_once __DIR__ . '/layout.php';

$pdo = getDbConnection();
$action = get('action', 'list');
$id = (int)get('id', 0);

// XỬ LÝ XÓA TỪ VỰNG
if ($action === 'delete' && $id > 0) {
    try {
        $stmtDel = $pdo->prepare("DELETE FROM vocabularies WHERE id = ?");
        $stmtDel->execute([$id]);
        set_flash('success', 'Đã xóa từ vựng thành công.');
    } catch (Exception $e) {
        set_flash('error', 'Lỗi khi xóa từ vựng: ' . $e->getMessage());
    }
    header('Location: vocab.php');
    exit;
}

// XỬ LÝ LƯU (THÊM MỚI HOẶC SỬA)
if (is_post() && ($action === 'create' || $action === 'edit')) {
    $unitId = (int)post('unit_id');
    $word = trim(post('word'));
    $traditional = trim(post('traditional'));
    $pinyin = trim(post('pinyin'));
    $hanViet = trim(post('han_viet'));
    $pos = trim(post('pos'));
    $posFull = trim(post('pos_full'));
    $meaningVi = trim(post('meaning_vi'));
    $meaningEn = trim(post('meaning_en'));
    $mnemonic = trim(post('mnemonic'));
    $radical = trim(post('radical'));
    $strokeCount = (int)post('stroke_count', 0);

    // Xử lý câu ví dụ
    $exHz = post('ex_hz', []);
    $exPy = post('ex_py', []);
    $exVn = post('ex_vn', []);
    $examplesList = [];

    if (is_array($exHz)) {
        for ($i = 0; $i < count($exHz); $i++) {
            $h = trim($exHz[$i] ?? '');
            $p = trim($exPy[$i] ?? '');
            $v = trim($exVn[$i] ?? '');
            if (!empty($h)) {
                $examplesList[] = [
                    'hz' => $h,
                    'py' => $p,
                    'vn' => $v
                ];
            }
        }
    }
    $examplesJson = !empty($examplesList) ? json_encode($examplesList, JSON_UNESCAPED_UNICODE) : null;

    if (empty($word) || empty($pinyin) || empty($meaningVi) || $unitId <= 0) {
        set_flash('error', 'Vui lòng điền đầy đủ: Bài học, Chữ Hán, Phiên âm Pinyin và Nghĩa tiếng Việt.');
    } else {
        try {
            if ($action === 'create') {
                $stmt = $pdo->prepare("INSERT INTO vocabularies 
                    (unit_id, word, traditional, pinyin, han_viet, pos, pos_full, meaning_vi, meaning_en, examples, mnemonic, radical, stroke_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $unitId, $word, $traditional ?: $word, $pinyin, $hanViet, $pos, $posFull,
                    $meaningVi, $meaningEn, $examplesJson, $mnemonic, $radical, $strokeCount
                ]);
                set_flash('success', "Đã thêm từ vựng “{$word}” thành công!");
                header('Location: vocab.php?unit_id=' . $unitId);
                exit;
            } else {
                $editId = (int)post('id');
                $stmt = $pdo->prepare("UPDATE vocabularies SET
                    unit_id = ?, word = ?, traditional = ?, pinyin = ?, han_viet = ?,
                    pos = ?, pos_full = ?, meaning_vi = ?, meaning_en = ?,
                    examples = ?, mnemonic = ?, radical = ?, stroke_count = ?
                    WHERE id = ?");
                $stmt->execute([
                    $unitId, $word, $traditional ?: $word, $pinyin, $hanViet,
                    $pos, $posFull, $meaningVi, $meaningEn,
                    $examplesJson, $mnemonic, $radical, $strokeCount, $editId
                ]);
                set_flash('success', "Đã cập nhật từ vựng “{$word}” thành công!");
                header('Location: vocab.php?unit_id=' . $unitId);
                exit;
            }
        } catch (Exception $e) {
            set_flash('error', 'Lỗi cơ sở dữ liệu: ' . $e->getMessage());
        }
    }
}

// LẤY DỮ LIỆU SÁCH VÀ BÀI HỌC ĐỂ CHỌN
$books = $pdo->query("SELECT id, title, book_code FROM books ORDER BY sort_order ASC, id ASC")->fetchAll();
$units = $pdo->query("SELECT u.id, u.book_id, u.unit_number, u.title, b.title AS book_title 
    FROM units u 
    JOIN books b ON u.book_id = b.id 
    ORDER BY b.sort_order ASC, u.sort_order ASC, u.unit_number ASC")->fetchAll();

// NẾU LÀ ACTION CREATE HOẶC EDIT -> HIỂN THỊ FORM
if ($action === 'create' || $action === 'edit') {
    $item = null;
    $existingEx = [];
    if ($action === 'edit' && $id > 0) {
        $stmtItem = $pdo->prepare("SELECT * FROM vocabularies WHERE id = ?");
        $stmtItem->execute([$id]);
        $item = $stmtItem->fetch();
        if ($item && !empty($item['examples'])) {
            $existingEx = json_decode($item['examples'], true) ?: [];
        }
    }

    renderAdminHeader(($action === 'create' ? '➕ Thêm Học Liệu Từ Vựng Mới' : '✏️ Chỉnh Sửa Từ Vựng'), 'vocab');
?>
    <div class="card" style="max-width: 900px; margin: 0 auto;">
        <div class="card-header">
            <div class="card-title"><?= $action === 'create' ? '➕ Thêm Từ Vựng Mới' : '✏️ Chỉnh Sửa Từ Vựng: ' . e($item['word'] ?? '') ?></div>
            <a href="vocab.php" class="btn-pill btn-secondary">← Quay lại danh sách</a>
        </div>

        <form method="POST">
            <?php if ($action === 'edit'): ?>
                <input type="hidden" name="id" value="<?= $item['id'] ?>">
            <?php endif; ?>

            <div class="form-row">
                <div class="form-col">
                    <label for="unit_id"><strong>Thuộc Bài học / Chủ đề *</strong></label>
                    <select name="unit_id" id="unit_id" class="form-control" required>
                        <option value="">-- Chọn bài học --</option>
                        <?php foreach ($units as $u): ?>
                            <option value="<?= $u['id'] ?>" <?= (($item['unit_id'] ?? get('unit_id')) == $u['id']) ? 'selected' : '' ?>>
                                [<?= e($u['book_title']) ?>] <?= e($u['title']) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-col">
                    <label for="word"><strong>Chữ Hán giản thể (Word) *</strong></label>
                    <input type="text" name="word" id="word" class="form-control" placeholder="Ví dụ: 爱" value="<?= e($item['word'] ?? '') ?>" required>
                </div>
            </div>

            <div class="form-row">
                <div class="form-col">
                    <label for="traditional">Chữ Phồn thể (Traditional)</label>
                    <input type="text" name="traditional" id="traditional" class="form-control" placeholder="Ví dụ: 愛" value="<?= e($item['traditional'] ?? '') ?>">
                </div>
                <div class="form-col">
                    <label for="pinyin"><strong>Phiên âm Pinyin *</strong></label>
                    <input type="text" name="pinyin" id="pinyin" class="form-control" placeholder="Ví dụ: ài" value="<?= e($item['pinyin'] ?? '') ?>" required>
                </div>
                <div class="form-col">
                    <label for="han_viet">Âm Hán Việt</label>
                    <input type="text" name="han_viet" id="han_viet" class="form-control" placeholder="Ví dụ: ÁI" value="<?= e($item['han_viet'] ?? '') ?>">
                </div>
            </div>

            <div class="form-row">
                <div class="form-col">
                    <label for="pos">Ký hiệu từ loại</label>
                    <input type="text" name="pos" id="pos" class="form-control" placeholder="đ., d., tt., l., ph...." value="<?= e($item['pos'] ?? '') ?>">
                </div>
                <div class="form-col">
                    <label for="pos_full">Tên từ loại đầy đủ</label>
                    <input type="text" name="pos_full" id="pos_full" class="form-control" placeholder="đ. (Động từ), d. (Danh từ)..." value="<?= e($item['pos_full'] ?? '') ?>">
                </div>
            </div>

            <div class="form-group">
                <label for="meaning_vi"><strong>Nghĩa Tiếng Việt *</strong></label>
                <textarea name="meaning_vi" id="meaning_vi" class="form-control" rows="2" placeholder="Ví dụ: yêu, thích" required><?= e($item['meaning_vi'] ?? '') ?></textarea>
            </div>

            <div class="form-group">
                <label for="meaning_en">Nghĩa Tiếng Anh (English Meaning)</label>
                <input type="text" name="meaning_en" id="meaning_en" class="form-control" placeholder="Ví dụ: to love; to like" value="<?= e($item['meaning_en'] ?? '') ?>">
            </div>

            <div class="form-row">
                <div class="form-col">
                    <label for="radical">Bộ thủ (Radical)</label>
                    <input type="text" name="radical" id="radical" class="form-control" placeholder="Ví dụ: 心" value="<?= e($item['radical'] ?? '') ?>">
                </div>
                <div class="form-col">
                    <label for="stroke_count">Số nét viết (Strokes)</label>
                    <input type="number" name="stroke_count" id="stroke_count" class="form-control" placeholder="10" value="<?= e($item['stroke_count'] ?? '0') ?>">
                </div>
            </div>

            <div class="form-group">
                <label for="mnemonic">Câu chuyện chiết tự gợi nhớ (Mnemonic Story)</label>
                <textarea name="mnemonic" id="mnemonic" class="form-control" rows="2" placeholder="Ví dụ: Trên có móng vuốt (爫) che chở mái nhà (冖), ở giữa ôm trọn trái tim (心)..."><?= e($item['mnemonic'] ?? '') ?></textarea>
            </div>

            <!-- CÂU VÍ DỤ -->
            <div style="margin-top: 24px; padding-top: 18px; border-top: 1px dashed var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <label style="font-weight:700; color:#38bdf8; font-size:14px;">💬 Câu ví dụ minh họa ngữ cảnh:</label>
                </div>

                <div id="examplesContainer">
                    <?php
                    $exCount = max(2, count($existingEx));
                    for ($i = 0; $i < $exCount; $i++):
                        $hz = $existingEx[$i]['hz'] ?? '';
                        $py = $existingEx[$i]['py'] ?? '';
                        $vn = $existingEx[$i]['vn'] ?? '';
                    ?>
                        <div style="background: rgba(15,23,42,0.5); border: 1px solid #334155; border-radius:10px; padding:14px; margin-bottom:14px;">
                            <div style="font-size:12px; font-weight:600; color:#94a3b8; margin-bottom:8px;">Ví dụ <?= $i + 1 ?>:</div>
                            <div class="form-row" style="margin-bottom:8px;">
                                <div class="form-col">
                                    <input type="text" name="ex_hz[]" class="form-control" placeholder="Chữ Hán: 我爱你。" value="<?= e($hz) ?>">
                                </div>
                                <div class="form-col">
                                    <input type="text" name="ex_py[]" class="form-control" placeholder="Pinyin: Wǒ ài nǐ." value="<?= e($py) ?>">
                                </div>
                            </div>
                            <input type="text" name="ex_vn[]" class="form-control" placeholder="Dịch nghĩa: Tôi yêu bạn." value="<?= e($vn) ?>">
                        </div>
                    <?php endfor; ?>
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
                <a href="vocab.php" class="btn-pill btn-secondary">Hủy bỏ</a>
                <button type="submit" class="btn-pill btn-primary" style="padding:10px 24px; font-size:14px;">
                    💾 <?= $action === 'create' ? 'Lưu Từ Vựng Mới' : 'Cập Nhật Thay Đổi' ?>
                </button>
            </div>
        </form>
    </div>
<?php
    renderAdminFooter();
    exit;
}

// ==========================================
// DANH SÁCH TỪ VỰNG (LIST VIEW VỚI BỘ LỌC & PHÂN TRANG)
// ==========================================
$selectedBookId = (int)get('book_id', 0);
$selectedUnitId = (int)get('unit_id', 0);
$search = trim(get('search', ''));
$page = max(1, (int)get('page', 1));
$limit = 20;
$offset = ($page - 1) * $limit;

$where = [];
$params = [];

if ($selectedBookId > 0) {
    $where[] = "u.book_id = ?";
    $params[] = $selectedBookId;
}
if ($selectedUnitId > 0) {
    $where[] = "v.unit_id = ?";
    $params[] = $selectedUnitId;
}
if (!empty($search)) {
    $where[] = "(v.word LIKE ? OR v.pinyin LIKE ? OR v.meaning_vi LIKE ? OR v.han_viet LIKE ?)";
    $term = "%$search%";
    $params[] = $term; $params[] = $term; $params[] = $term; $params[] = $term;
}

$whereSql = !empty($where) ? ("WHERE " . implode(" AND ", $where)) : "";

// Đếm tổng số
$countSql = "SELECT COUNT(*) FROM vocabularies v LEFT JOIN units u ON v.unit_id = u.id $whereSql";
$stmtCount = $pdo->prepare($countSql);
$stmtCount->execute($params);
$totalRows = $stmtCount->fetchColumn();
$totalPages = ceil($totalRows / $limit);

// Lấy danh sách trang
$dataSql = "SELECT v.*, u.title AS unit_title, u.unit_number, b.title AS book_title 
    FROM vocabularies v 
    LEFT JOIN units u ON v.unit_id = u.id 
    LEFT JOIN books b ON u.book_id = b.id 
    $whereSql 
    ORDER BY v.id DESC 
    LIMIT $limit OFFSET $offset";
$stmtData = $pdo->prepare($dataSql);
$stmtData->execute($params);
$vocabList = $stmtData->fetchAll();

renderAdminHeader('Quản Lý Học Liệu Từ Vựng', 'vocab');
?>
<style>
    .filter-bar {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 16px 20px;
        margin-bottom: 24px;
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        align-items: center;
    }
    .filter-input {
        min-width: 240px;
        flex: 1;
    }
    .filter-select {
        min-width: 180px;
    }
    .hz-big {
        font-size: 22px;
        font-weight: 700;
        font-family: 'Noto Sans SC', sans-serif;
        color: #fff;
    }
    .py-highlight {
        color: #38bdf8;
        font-weight: 500;
    }
    .actions-cell {
        white-space: nowrap;
        display: flex;
        gap: 8px;
    }
    .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 24px;
    }
    .page-link {
        padding: 8px 14px;
        border-radius: 8px;
        background: #1e293b;
        border: 1px solid #334155;
        color: #e2e8f0;
        text-decoration: none;
        font-size: 13px;
        font-weight: 600;
        transition: 0.2s;
    }
    .page-link:hover, .page-link.active {
        background: var(--primary);
        color: #fff;
        border-color: var(--primary);
    }
</style>

<!-- BỘ LỌC TÌM KIẾM -->
<form method="GET" class="filter-bar">
    <div class="filter-input">
        <input type="text" name="search" class="form-control" placeholder="Tìm theo Chữ Hán, Pinyin, Nghĩa..." value="<?= e($search) ?>">
    </div>

    <div class="filter-select">
        <select name="book_id" class="form-control" onchange="this.form.submit()">
            <option value="">-- Tất cả giáo trình --</option>
            <?php foreach ($books as $b): ?>
                <option value="<?= $b['id'] ?>" <?= $selectedBookId == $b['id'] ? 'selected' : '' ?>>
                    <?= e($b['title']) ?>
                </option>
            <?php endforeach; ?>
        </select>
    </div>

    <div class="filter-select">
        <select name="unit_id" class="form-control" onchange="this.form.submit()">
            <option value="">-- Tất cả bài học --</option>
            <?php foreach ($units as $u): ?>
                <?php if (!$selectedBookId || $u['book_id'] == $selectedBookId): ?>
                    <option value="<?= $u['id'] ?>" <?= $selectedUnitId == $u['id'] ? 'selected' : '' ?>>
                        <?= e($u['title']) ?>
                    </option>
                <?php endif; ?>
            <?php endforeach; ?>
        </select>
    </div>

    <button type="submit" class="btn-pill btn-primary">🔍 Lọc dữ liệu</button>
    <a href="vocab.php" class="btn-pill btn-secondary">🔄 Xóa lọc</a>
    <a href="vocab.php?action=create" class="btn-pill btn-primary" style="margin-left:auto;">➕ Thêm từ vựng</a>
</form>

<!-- BẢNG DỮ LIỆU TỪ VỰNG -->
<div class="card">
    <div class="card-header">
        <div class="card-title">
            <span>Danh sách từ vựng</span>
            <span class="badge badge-info"><?= number_format($totalRows) ?> từ</span>
        </div>
        <div>
            Trang <?= $page ?> / <?= max(1, $totalPages) ?>
        </div>
    </div>

    <div class="table-responsive">
        <table class="admin-table">
            <thead>
                <tr>
                    <th style="width: 50px;">#ID</th>
                    <th style="width: 140px;">Chữ Hán</th>
                    <th style="width: 130px;">Phiên âm</th>
                    <th style="width: 100px;">Hán Việt</th>
                    <th style="width: 80px;">Từ loại</th>
                    <th>Nghĩa Tiếng Việt</th>
                    <th style="width: 180px;">Bài học / Sách</th>
                    <th style="width: 110px; text-align:center;">Thao tác</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($vocabList)): ?>
                    <tr><td colspan="8" style="text-align:center; padding: 30px; color:#94a3b8;">Không tìm thấy từ vựng nào khớp với điều kiện.</td></tr>
                <?php else: ?>
                    <?php foreach ($vocabList as $v): ?>
                        <tr>
                            <td style="color:#64748b; font-size:12px;"><?= $v['id'] ?></td>
                            <td>
                                <div class="hz-big"><?= e($v['word']) ?></div>
                                <?php if ($v['traditional'] && $v['traditional'] !== $v['word']): ?>
                                    <div style="font-size:11px; color:#94a3b8;">Phồn: <?= e($v['traditional']) ?></div>
                                <?php endif; ?>
                            </td>
                            <td>
                                <div class="py-highlight"><?= e($v['pinyin']) ?></div>
                            </td>
                            <td>
                                <span style="font-size:12px; color:#e2e8f0; font-weight:600;"><?= e($v['han_viet'] ?: '—') ?></span>
                            </td>
                            <td>
                                <span class="badge badge-primary"><?= e($v['pos'] ?: '—') ?></span>
                            </td>
                            <td>
                                <div style="font-weight:500; color:#f1f5f9;"><?= e($v['meaning_vi']) ?></div>
                                <?php if ($v['meaning_en']): ?>
                                    <div style="font-size:11px; color:#94a3b8;"><?= e($v['meaning_en']) ?></div>
                                <?php endif; ?>
                            </td>
                            <td>
                                <div style="font-size:13px; font-weight:600; color:#fff;"><?= e($v['unit_title'] ?? ('Bài ' . $v['unit_id'])) ?></div>
                                <div style="font-size:11px; color:#94a3b8;"><?= e($v['book_title'] ?? '') ?></div>
                            </td>
                            <td style="text-align:center;">
                                <div class="actions-cell">
                                    <a href="vocab.php?action=edit&id=<?= $v['id'] ?>" class="btn-pill btn-secondary" style="padding:4px 8px; font-size:12px;" title="Chỉnh sửa">
                                        ✏️ Sửa
                                    </a>
                                    <a href="vocab.php?action=delete&id=<?= $v['id'] ?>" class="btn-pill btn-danger" style="padding:4px 8px; font-size:12px;" onclick="return confirm('Bạn có chắc muốn xóa từ vựng [<?= e($v['word']) ?>] không?')" title="Xóa">
                                        🗑️
                                    </a>
                                </div>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>

    <!-- PHÂN TRANG -->
    <?php if ($totalPages > 1): ?>
        <div class="pagination">
            <?php if ($page > 1): ?>
                <a href="?page=<?= $page - 1 ?>&search=<?= urlencode($search) ?>&book_id=<?= $selectedBookId ?>&unit_id=<?= $selectedUnitId ?>" class="page-link">◀ Trước</a>
            <?php endif; ?>

            <?php
            $startPage = max(1, $page - 2);
            $endPage = min($totalPages, $page + 2);
            for ($p = $startPage; $p <= $endPage; $p++):
            ?>
                <a href="?page=<?= $p ?>&search=<?= urlencode($search) ?>&book_id=<?= $selectedBookId ?>&unit_id=<?= $selectedUnitId ?>" class="page-link <?= $p == $page ? 'active' : '' ?>">
                    <?= $p ?>
                </a>
            <?php endfor; ?>

            <?php if ($page < $totalPages): ?>
                <a href="?page=<?= $page + 1 ?>&search=<?= urlencode($search) ?>&book_id=<?= $selectedBookId ?>&unit_id=<?= $selectedUnitId ?>" class="page-link">Tiếp ▶</a>
            <?php endif; ?>
        </div>
    <?php endif; ?>
</div>

<?php
renderAdminFooter();
