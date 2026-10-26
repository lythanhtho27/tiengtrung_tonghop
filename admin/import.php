<?php
// admin/import.php - Công cụ nhập dữ liệu học liệu từ JSON vào MySQL
require_once __DIR__ . '/layout.php';

$pdo = getDbConnection();
$importLog = null;

if (is_post() && post('action') === 'import_json') {
    $selectedFile = post('json_file');
    $bookId = (int)post('target_book_id');
    $maxUnits = (int)post('max_units', 50);

    $jsonPath = __DIR__ . '/../json_data/' . basename($selectedFile);

    if (!file_exists($jsonPath)) {
        set_flash('error', "Không tìm thấy file: " . e($selectedFile));
    } elseif ($bookId <= 0) {
        set_flash('error', "Vui lòng chọn Giáo trình đích để nhập dữ liệu vào.");
    } else {
        try {
            $raw = file_get_contents($jsonPath);
            $data = json_decode($raw, true);

            if (!$data || empty($data['units'])) {
                throw new Exception("File JSON không đúng cấu trúc (thiếu mảng 'units').");
            }

            $unitsCount = 0;
            $wordsCount = 0;

            $stmtUnit = $pdo->prepare("INSERT INTO units (book_id, unit_number, title, description, sort_order) 
                VALUES (?, ?, ?, ?, ?) 
                ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description)");

            $stmtVocab = $pdo->prepare("INSERT INTO vocabularies 
                (unit_id, word, traditional, pinyin, han_viet, pos, pos_full, meaning_vi, meaning_en, examples, mnemonic, radical, stroke_count, sort_order) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            $countU = 0;
            foreach ($data['units'] as $u) {
                if ($countU >= $maxUnits) break;
                $countU++;

                $uNum = (int)($u['unit'] ?? $countU);
                $uTitle = $u['title'] ?? ("Bài " . $uNum);
                $uDesc = ($u['start_word'] ?? '') . ' — ' . ($u['end_word'] ?? '');

                $stmtUnit->execute([$bookId, $uNum, $uTitle, $uDesc, $uNum]);
                $stmtGetU = $pdo->prepare("SELECT id FROM units WHERE book_id = ? AND unit_number = ?");
                $stmtGetU->execute([$bookId, $uNum]);
                $unitId = $stmtGetU->fetchColumn();
                $unitsCount++;

                if (!empty($u['target_words']) && is_array($u['target_words'])) {
                    foreach ($u['target_words'] as $w) {
                        $wWord = $w['word'] ?? '';
                        if (!$wWord) continue;

                        $wTrad = $w['traditional'] ?? $wWord;
                        $wPinyin = $w['pinyin'] ?? '';
                        $wHanViet = $w['han_viet'] ?? '';
                        $wPos = $w['pos'] ?? '';
                        $wPosFull = $w['pos_full'] ?? '';
                        $wMeanVi = $w['meaning_vi'] ?? ($w['meaning_primary'] ?? '');
                        $wMeanEn = $w['meaning_en'] ?? '';
                        $wEx = !empty($w['examples']) ? json_encode($w['examples'], JSON_UNESCAPED_UNICODE) : null;
                        $wMnemonic = $w['mnemonic_story'] ?? ($w['mnemonic'] ?? null);
                        $wRadical = $w['radical'] ?? null;
                        $wStrokes = (int)($w['stroke_count'] ?? 0);
                        $wSort = (int)($w['num'] ?? 0);

                        $stmtVocab->execute([
                            $unitId, $wWord, $wTrad, $wPinyin, $wHanViet, $wPos, $wPosFull,
                            $wMeanVi, $wMeanEn, $wEx, $wMnemonic, $wRadical, $wStrokes, $wSort
                        ]);
                        $wordsCount++;
                    }
                }
            }

            set_flash('success', "Nhập thành công {$unitsCount} bài học và {$wordsCount} từ vựng vào giáo trình!");
            header('Location: vocab.php?book_id=' . $bookId);
            exit;

        } catch (Exception $e) {
            set_flash('error', "Lỗi trong khi nhập dữ liệu: " . $e->getMessage());
        }
    }
}

// QUÉT CÁC FILE JSON CÓ SẴN TRONG THƯ MỤC json_data
$jsonDir = __DIR__ . '/../json_data';
$jsonFiles = [];
if (is_dir($jsonDir)) {
    $files = scandir($jsonDir);
    foreach ($files as $f) {
        if (pathinfo($f, PATHINFO_EXTENSION) === 'json' && $f !== 'index_metadata.json') {
            $jsonFiles[] = $f;
        }
    }
}

$books = $pdo->query("SELECT id, title, book_code FROM books ORDER BY sort_order ASC, id ASC")->fetchAll();

renderAdminHeader('Công Cụ Nhập Dữ Liệu Học Liệu (JSON Import)', 'import');
?>

<div style="max-width: 800px; margin: 0 auto;">
    <div class="card">
        <div class="card-header">
            <div class="card-title">⚡ Nhập Hàng Loạt Từ Vựng Từ File JSON Vào MySQL</div>
        </div>

        <form method="POST">
            <input type="hidden" name="action" value="import_json">

            <div class="form-group">
                <label><strong>Chọn file JSON nguồn trong hệ thống:</strong></label>
                <select name="json_file" class="form-control" required>
                    <option value="">-- Chọn file JSON --</option>
                    <?php foreach ($jsonFiles as $jf): ?>
                        <option value="<?= e($jf) ?>" <?= $jf === 'quyen_1.json' ? 'selected' : '' ?>>
                            📁 <?= e($jf) ?> (<?= round(filesize($jsonDir . '/' . $jf) / 1024, 1) ?> KB)
                        </option>
                    <?php endforeach; ?>
                </select>
                <small style="color:#94a3b8; display:block; margin-top:4px;">Các file được lưu trong thư mục <code>json_data/</code> của hệ thống.</small>
            </div>

            <div class="form-group">
                <label><strong>Nhập vào Giáo trình đích:</strong></label>
                <select name="target_book_id" class="form-control" required>
                    <option value="">-- Chọn giáo trình --</option>
                    <?php foreach ($books as $b): ?>
                        <option value="<?= $b['id'] ?>"><?= e($b['title']) ?> (<?= e($b['book_code']) ?>)</option>
                    <?php endforeach; ?>
                </select>
            </div>

            <div class="form-group">
                <label><strong>Số bài học tối đa cần nạp (Giới hạn batch):</strong></label>
                <input type="number" name="max_units" class="form-control" value="25" min="1" max="100">
                <small style="color:#94a3b8; display:block; margin-top:4px;">Nhập 25 tương đương 500 từ vựng cho mỗi lần nạp để đảm bảo tốc độ xử lý nhanh nhất.</small>
            </div>

            <button type="submit" class="btn-pill btn-primary" style="width:100%; justify-content:center; padding:14px; font-size:15px; margin-top:10px;" onclick="return confirm('Bắt đầu nạp dữ liệu từ file JSON vào MySQL? Thao tác có thể mất vài giây.')">
                🚀 Bắt Đầu Nạp Dữ Liệu Vào MySQL
            </button>
        </form>
    </div>
</div>

<?php
renderAdminFooter();
