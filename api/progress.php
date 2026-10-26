<?php
// api/progress.php - API lưu tiến độ học tập vào MySQL
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

header('Content-Type: application/json; charset=utf-8');

if (!is_post()) {
    json_response(['status' => 'error', 'message' => 'Phương thức không hợp lệ.'], 405);
}

// Nếu người dùng chưa đăng nhập, lưu ý là trạng thái khách
if (!is_logged_in()) {
    json_response([
        'status' => 'guest',
        'message' => 'Bạn đang học ở chế độ khách. Hãy đăng nhập để lưu tiến độ vĩnh viễn trên tài khoản!'
    ]);
}

$userId = current_user_id();
$action = post('action');
$vocabId = (int)post('vocab_id', 0);

try {
    $pdo = getDbConnection();

    if ($action === 'toggle_favorite') {
        if ($vocabId <= 0) throw new Exception("Thiếu mã từ vựng.");

        // Kiểm tra xem đã có bản ghi trong user_progress chưa
        $stmt = $pdo->prepare("SELECT id, is_favorite FROM user_progress WHERE user_id = ? AND vocab_id = ?");
        $stmt->execute([$userId, $vocabId]);
        $row = $stmt->fetch();

        if ($row) {
            $newFav = $row['is_favorite'] ? 0 : 1;
            $pdo->prepare("UPDATE user_progress SET is_favorite = ?, updated_at = NOW() WHERE id = ?")
                ->execute([$newFav, $row['id']]);
        } else {
            $newFav = 1;
            $pdo->prepare("INSERT INTO user_progress (user_id, vocab_id, is_favorite, status) VALUES (?, ?, 1, 'learning')")
                ->execute([$userId, $vocabId]);
        }

        json_response([
            'status' => 'success',
            'vocab_id' => $vocabId,
            'is_favorite' => (bool)$newFav,
            'message' => $newFav ? 'Đã thêm vào danh sách yêu thích' : 'Đã xóa khỏi yêu thích'
        ]);

    } elseif ($action === 'toggle_difficult') {
        if ($vocabId <= 0) throw new Exception("Thiếu mã từ vựng.");

        $stmt = $pdo->prepare("SELECT id, is_difficult FROM user_progress WHERE user_id = ? AND vocab_id = ?");
        $stmt->execute([$userId, $vocabId]);
        $row = $stmt->fetch();

        if ($row) {
            $newDiff = $row['is_difficult'] ? 0 : 1;
            $pdo->prepare("UPDATE user_progress SET is_difficult = ?, updated_at = NOW() WHERE id = ?")
                ->execute([$newDiff, $row['id']]);
        } else {
            $newDiff = 1;
            $pdo->prepare("INSERT INTO user_progress (user_id, vocab_id, is_difficult, status) VALUES (?, ?, 1, 'learning')")
                ->execute([$userId, $vocabId]);
        }

        json_response([
            'status' => 'success',
            'vocab_id' => $vocabId,
            'is_difficult' => (bool)$newDiff,
            'message' => $newDiff ? 'Đã thêm vào Hộp từ khó (SRS)' : 'Đã bỏ khỏi Hộp từ khó'
        ]);

    } elseif ($action === 'update_leitner') {
        if ($vocabId <= 0) throw new Exception("Thiếu mã từ vựng.");
        $box = max(1, min(5, (int)post('box', 1)));
        $isMastered = post('status') === 'mastered' || $box >= 5;
        $status = $isMastered ? 'mastered' : 'learning';

        $stmt = $pdo->prepare("INSERT INTO user_progress (user_id, vocab_id, leitner_box, status, review_count, last_reviewed_at) 
            VALUES (?, ?, ?, ?, 1, NOW())
            ON DUPLICATE KEY UPDATE 
                leitner_box = VALUES(leitner_box),
                status = VALUES(status),
                review_count = review_count + 1,
                last_reviewed_at = NOW()");
        $stmt->execute([$userId, $vocabId, $box, $status]);

        // Cộng 5 XP cho người dùng
        $pdo->prepare("UPDATE user_stats SET total_xp = total_xp + 5, level = 1 + FLOOR((total_xp + 5) / 100) WHERE user_id = ?")
            ->execute([$userId]);

        json_response([
            'status' => 'success',
            'vocab_id' => $vocabId,
            'leitner_box' => $box,
            'progress_status' => $status
        ]);

    } elseif ($action === 'add_xp') {
        $xp = max(1, (int)post('xp', 10));
        $pdo->prepare("UPDATE user_stats SET total_xp = total_xp + ?, level = 1 + FLOOR((total_xp + ?) / 100), last_learned_date = CURDATE() WHERE user_id = ?")
            ->execute([$xp, $xp, $userId]);

        $stmtStats = $pdo->prepare("SELECT total_xp, level, streak_count FROM user_stats WHERE user_id = ?");
        $stmtStats->execute([$userId]);
        $stats = $stmtStats->fetch();

        json_response([
            'status' => 'success',
            'stats' => $stats
        ]);

    } else {
        throw new Exception("Hành động không được hỗ trợ.");
    }

} catch (Exception $e) {
    json_response(['status' => 'error', 'message' => $e->getMessage()], 400);
}
