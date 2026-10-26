<?php
// api/vocab.php - API lấy dữ liệu học liệu từ CSDL MySQL
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = getDbConnection();
    $userId = current_user_id();

    // 1. Lấy danh sách toàn bộ giáo trình (Books)
    $stmtBooks = $pdo->query("SELECT id, book_code, title, level, badge, color, description FROM books ORDER BY sort_order ASC, id ASC");
    $books = $stmtBooks->fetchAll();

    if (empty($books)) {
        json_response([
            'status' => 'error',
            'message' => 'Chưa có giáo trình nào trong cơ sở dữ liệu. Vui lòng vào trang quản trị hoặc chạy install.php.'
        ], 404);
    }

    // 2. Xác định book_id hiện tại
    $reqBookId = (int)get('book_id', 0);
    $currentBook = null;
    if ($reqBookId > 0) {
        foreach ($books as $b) {
            if ((int)$b['id'] === $reqBookId) {
                $currentBook = $b;
                break;
            }
        }
    }
    if (!$currentBook) {
        $currentBook = $books[0];
    }
    $bookId = (int)$currentBook['id'];

    // 3. Lấy danh sách các bài học (Units) của sách này
    $stmtUnits = $pdo->prepare("SELECT id, book_id, unit_number, title, description FROM units WHERE book_id = ? ORDER BY sort_order ASC, unit_number ASC");
    $stmtUnits->execute([$bookId]);
    $units = $stmtUnits->fetchAll();

    // 4. Xác định unit_id hiện tại
    $reqUnitId = (int)get('unit_id', 0);
    $currentUnit = null;
    if ($reqUnitId > 0 && !empty($units)) {
        foreach ($units as $u) {
            if ((int)$u['id'] === $reqUnitId) {
                $currentUnit = $u;
                break;
            }
        }
    }
    if (!$currentUnit && !empty($units)) {
        $currentUnit = $units[0];
    }
    $unitId = $currentUnit ? (int)$currentUnit['id'] : 0;

    // 5. Tìm kiếm hoặc lọc
    $search = trim(get('search', ''));
    $filter = get('filter', 'all'); // all, favorites, difficult

    $params = [];
    $where = [];

    if (!empty($search)) {
        $where[] = "(v.word LIKE ? OR v.pinyin LIKE ? OR v.meaning_vi LIKE ? OR v.han_viet LIKE ?)";
        $searchTerm = "%$search%";
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    } else {
        if ($filter === 'favorites' && $userId) {
            $where[] = "up.is_favorite = 1 AND up.user_id = ?";
            $params[] = $userId;
        } elseif ($filter === 'difficult' && $userId) {
            $where[] = "up.is_difficult = 1 AND up.user_id = ?";
            $params[] = $userId;
        } else {
            if ($unitId > 0) {
                $where[] = "v.unit_id = ?";
                $params[] = $unitId;
            }
        }
    }

    $whereSql = !empty($where) ? ("WHERE " . implode(" AND ", $where)) : "";

    // Join với user_progress nếu đã đăng nhập để lấy trạng thái cá nhân hóa
    if ($userId) {
        $sql = "SELECT v.*, 
                       COALESCE(up.is_favorite, 0) AS is_favorite,
                       COALESCE(up.is_difficult, 0) AS is_difficult,
                       COALESCE(up.status, 'new') AS progress_status,
                       COALESCE(up.leitner_box, 1) AS leitner_box,
                       COALESCE(up.review_count, 0) AS review_count
                FROM vocabularies v
                LEFT JOIN user_progress up ON v.id = up.vocab_id AND up.user_id = ?
                $whereSql
                ORDER BY v.sort_order ASC, v.id ASC";
        array_unshift($params, $userId);
    } else {
        $sql = "SELECT v.*, 
                       0 AS is_favorite,
                       0 AS is_difficult,
                       'new' AS progress_status,
                       1 AS leitner_box,
                       0 AS review_count
                FROM vocabularies v
                $whereSql
                ORDER BY v.sort_order ASC, v.id ASC";
    }

    $stmtVocab = $pdo->prepare($sql);
    $stmtVocab->execute($params);
    $rawWords = $stmtVocab->fetchAll();

    // Chuẩn hóa câu ví dụ JSON
    $words = [];
    foreach ($rawWords as $w) {
        $ex = [];
        if (!empty($w['examples'])) {
            $decoded = json_decode($w['examples'], true);
            if (is_array($decoded)) {
                $ex = $decoded;
            }
        }
        $w['examples'] = $ex;
        $w['is_favorite'] = (bool)$w['is_favorite'];
        $w['is_difficult'] = (bool)$w['is_difficult'];
        $words[] = $w;
    }

    // Lấy thống kê của user nếu đã đăng nhập
    $userStats = null;
    if ($userId) {
        $stmtStats = $pdo->prepare("SELECT * FROM user_stats WHERE user_id = ?");
        $stmtStats->execute([$userId]);
        $userStats = $stmtStats->fetch();

        // Lấy tổng số từ yêu thích và từ khó của user
        $stmtCounts = $pdo->prepare("SELECT 
            SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END) AS total_favorites,
            SUM(CASE WHEN is_difficult = 1 THEN 1 ELSE 0 END) AS total_difficult,
            SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) AS total_mastered
            FROM user_progress WHERE user_id = ?");
        $stmtCounts->execute([$userId]);
        $counts = $stmtCounts->fetch();
        if ($userStats) {
            $userStats['total_favorites'] = (int)($counts['total_favorites'] ?? 0);
            $userStats['total_difficult'] = (int)($counts['total_difficult'] ?? 0);
            $userStats['total_mastered'] = (int)($counts['total_mastered'] ?? 0);
        }
    }

    json_response([
        'status' => 'success',
        'is_logged_in' => is_logged_in(),
        'user' => current_user(),
        'user_stats' => $userStats,
        'books' => $books,
        'current_book' => $currentBook,
        'units' => $units,
        'current_unit' => $currentUnit,
        'total_words' => count($words),
        'words' => $words
    ]);

} catch (Exception $e) {
    json_response([
        'status' => 'error',
        'message' => $e->getMessage()
    ], 500);
}
