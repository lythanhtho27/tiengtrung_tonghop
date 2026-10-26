<?php
// install.php - Trình cài đặt tự động CSDL MySQL & Dữ liệu mẫu
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';

$success = null;
$error = null;
$stats = null;

if (is_post() && post('action') === 'install') {
    try {
        // 1. Kết nối MySQL không chọn database
        $pdo = getDbConnection(false);

        // 2. Tạo database nếu chưa có
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
        $pdo->exec("USE `" . DB_NAME . "`;");

        // 3. Đọc và thực thi database.sql
        $sqlFile = __DIR__ . '/database.sql';
        if (!file_exists($sqlFile)) {
            throw new Exception("Không tìm thấy file database.sql!");
        }
        $sql = file_get_contents($sqlFile);
        $pdo->exec($sql);

        // 4. Nếu người dùng chọn import dữ liệu từ quyen_1.json
        $importFull = post('import_full') === '1';
        $wordsImported = 0;
        $unitsImported = 0;

        if ($importFull) {
            $jsonFile = __DIR__ . '/json_data/quyen_1.json';
            if (file_exists($jsonFile)) {
                $raw = file_get_contents($jsonFile);
                $data = json_decode($raw, true);

                if ($data && !empty($data['units'])) {
                    // Lấy hoặc tạo book HSK 1
                    $stmtBook = $pdo->prepare("SELECT id FROM books WHERE book_code = ?");
                    $stmtBook->execute(['hsk1']);
                    $book = $stmtBook->fetch();
                    $bookId = $book ? $book['id'] : 1;

                    $stmtUnit = $pdo->prepare("INSERT INTO units (book_id, unit_number, title, description, sort_order) 
                        VALUES (?, ?, ?, ?, ?) 
                        ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description)");

                    $stmtVocab = $pdo->prepare("INSERT INTO vocabularies 
                        (unit_id, word, traditional, pinyin, han_viet, pos, pos_full, meaning_vi, meaning_en, examples, mnemonic, radical, stroke_count, sort_order) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE word = VALUES(word)");

                    foreach ($data['units'] as $u) {
                        $uNum = (int)$u['unit'];
                        $uTitle = $u['title'] ?? ("Bài " . $uNum);
                        $uDesc = ($u['start_word'] ?? '') . ' — ' . ($u['end_word'] ?? '');
                        
                        $stmtUnit->execute([$bookId, $uNum, $uTitle, $uDesc, $uNum]);
                        $unitId = $pdo->lastInsertId();
                        if (!$unitId) {
                            $stmtGetU = $pdo->prepare("SELECT id FROM units WHERE book_id = ? AND unit_number = ?");
                            $stmtGetU->execute([$bookId, $uNum]);
                            $unitId = $stmtGetU->fetchColumn();
                        }
                        $unitsImported++;

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
                                $wordsImported++;
                            }
                        }
                    }
                }
            }
        }

        $success = "Cài đặt cơ sở dữ liệu thành công!";
        $stats = [
            'words_imported' => $wordsImported,
            'units_imported' => $unitsImported
        ];
    } catch (Exception $e) {
        $error = "Lỗi trong quá trình cài đặt: " . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Khởi Tạo Cơ Sở Dữ Liệu MySQL · Word Learning</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #4f46e5;
            --primary-hover: #4338ca;
            --bg: #0f172a;
            --card-bg: #1e293b;
            --border: #334155;
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --success: #10b981;
            --danger: #ef4444;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body {
            background-color: var(--bg);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .install-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 16px;
            max-width: 600px;
            width: 100%;
            padding: 32px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }
        .header {
            text-align: center;
            margin-bottom: 24px;
        }
        .header .icon {
            font-size: 48px;
            margin-bottom: 12px;
            display: inline-block;
        }
        .header h1 {
            font-size: 24px;
            font-weight: 700;
            color: #fff;
        }
        .header p {
            color: var(--text-muted);
            font-size: 14px;
            margin-top: 6px;
        }
        .alert {
            padding: 14px 18px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-size: 14px;
            line-height: 1.5;
        }
        .alert-success {
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid var(--success);
            color: #6ee7b7;
        }
        .alert-danger {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid var(--danger);
            color: #fca5a5;
        }
        .info-box {
            background: #0f172a;
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 24px;
            font-size: 13px;
        }
        .info-box h3 {
            font-size: 14px;
            margin-bottom: 8px;
            color: #38bdf8;
        }
        .info-box ul {
            list-style: none;
            padding-left: 0;
        }
        .info-box li {
            padding: 4px 0;
            display: flex;
            justify-content: space-between;
            color: var(--text-muted);
        }
        .info-box strong { color: var(--text); }
        .checkbox-label {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
            color: var(--text);
            margin-bottom: 20px;
            cursor: pointer;
            user-select: none;
            background: rgba(255,255,255,0.03);
            padding: 12px;
            border-radius: 8px;
            border: 1px dashed var(--border);
        }
        .checkbox-label input { width: 18px; height: 18px; cursor: pointer; }
        .btn-submit {
            width: 100%;
            background: var(--primary);
            color: #fff;
            padding: 14px;
            border: none;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .btn-submit:hover {
            background: var(--primary-hover);
        }
        .quick-links {
            display: flex;
            gap: 12px;
            margin-top: 20px;
        }
        .quick-link-btn {
            flex: 1;
            text-align: center;
            padding: 12px;
            background: #334155;
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            transition: 0.2s;
        }
        .quick-link-btn:hover {
            background: #475569;
        }
        .quick-link-btn.primary {
            background: #2563eb;
        }
        .quick-link-btn.primary:hover {
            background: #1d4ed8;
        }
    </style>
</head>
<body>
    <div class="install-card">
        <div class="header">
            <span class="icon">🚀</span>
            <h1>Cài Đặt CSDL MariaDB / MySQL Word Learning</h1>
            <p>Tương thích WEMP (Nginx + MariaDB port 3308) & XAMPP</p>
        </div>

        <?php if ($success): ?>
            <div class="alert alert-success">
                <strong>🎉 Thành công!</strong> <?= e($success) ?>
                <?php if ($stats && $stats['words_imported'] > 0): ?>
                    <div style="margin-top: 6px;">
                        Đã nhập thành công <strong><?= $stats['units_imported'] ?></strong> bài học và <strong><?= $stats['words_imported'] ?></strong> từ vựng từ JSON!
                    </div>
                <?php endif; ?>
            </div>

            <div class="info-box">
                <h3>🔑 Tài khoản kiểm thử mặc định:</h3>
                <ul>
                    <li><span>Quản trị viên (Admin):</span> <strong>admin</strong> / <strong>admin123</strong></li>
                    <li><span>Học viên (User):</span> <strong>hocvien</strong> / <strong>123456</strong></li>
                    <li><span>Database:</span> <strong><?= DB_NAME ?></strong> (Host: <?= DB_HOST ?>:<?= DB_PORT ?>)</li>
                </ul>
            </div>

            <div class="quick-links">
                <a href="login.php" class="quick-link-btn primary">🔑 Đến trang Đăng nhập</a>
                <a href="word_learning.php" class="quick-link-btn">📖 Vào Học Từ Vựng</a>
                <a href="admin/index.php" class="quick-link-btn">⚙️ Trang Quản Trị</a>
            </div>

        <?php else: ?>
            <?php if ($error): ?>
                <div class="alert alert-danger">
                    <strong>⚠️ Thất bại:</strong> <?= e($error) ?>
                </div>
            <?php endif; ?>

            <div class="info-box">
                <h3>📋 Cấu hình kết nối hiện tại:</h3>
                <ul>
                    <li><span>Database Server:</span> <strong><?= DB_HOST ?>:<?= DB_PORT ?></strong></li>
                    <li><span>Tên CSDL mục tiêu:</span> <strong><?= DB_NAME ?></strong></li>
                    <li><span>Tài khoản MySQL:</span> <strong><?= DB_USER ?></strong></li>
                    <li><span>Bảng dữ liệu:</span> <strong>users, books, units, vocabularies, user_progress, user_stats</strong></li>
                </ul>
            </div>

            <form method="POST">
                <input type="hidden" name="action" value="install">
                
                <label class="checkbox-label">
                    <input type="checkbox" name="import_full" value="1" checked>
                    <span><strong>Nhập toàn bộ 500 từ vựng Quyển 1 (HSK 1)</strong> từ file quyen_1.json vào MySQL để học ngay lập tức.</span>
                </label>

                <button type="submit" class="btn-submit">
                    ⚡ Bắt Đầu Khởi Tạo CSDL & Cài Đặt Ngay
                </button>
            </form>
        <?php endif; ?>
    </div>
</body>
</html>
