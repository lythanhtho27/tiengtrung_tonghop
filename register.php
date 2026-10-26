<?php
// register.php - Trang đăng ký tài khoản
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';

// Nếu đã đăng nhập, chuyển đến trang học
if (is_logged_in()) {
    header('Location: word_learning.php');
    exit;
}

$error = null;
$username = '';
$email = '';
$fullName = '';

if (is_post()) {
    $username = trim(post('username'));
    $email = trim(post('email'));
    $fullName = trim(post('full_name'));
    $password = post('password');
    $passwordConfirm = post('password_confirm');

    // Validation
    if (empty($username) || empty($email) || empty($fullName) || empty($password)) {
        $error = 'Vui lòng điền đầy đủ tất cả các trường thông tin.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Địa chỉ email không hợp lệ.';
    } elseif (strlen($username) < 3 || strlen($username) > 50) {
        $error = 'Tên đăng nhập phải có độ dài từ 3 đến 50 ký tự.';
    } elseif (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
        $error = 'Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới (_).';
    } elseif (strlen($password) < 6) {
        $error = 'Mật khẩu phải có ít nhất 6 ký tự.';
    } elseif ($password !== $passwordConfirm) {
        $error = 'Mật khẩu xác nhận không khớp.';
    } else {
        try {
            $pdo = getDbConnection();

            // Kiểm tra username hoặc email đã tồn tại chưa
            $stmtCheck = $pdo->prepare("SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1");
            $stmtCheck->execute([$username, $email]);
            $existing = $stmtCheck->fetch();

            if ($existing) {
                if (strcasecmp($existing['username'], $username) === 0) {
                    $error = 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.';
                } else {
                    $error = 'Địa chỉ email này đã được đăng ký tài khoản.';
                }
            } else {
                // Tạo tài khoản mới
                $hash = hash_password($password);
                $stmtInsert = $pdo->prepare("INSERT INTO users (username, email, password, full_name, role, status) VALUES (?, ?, ?, ?, 'user', 1)");
                $stmtInsert->execute([$username, $email, $fullName, $hash]);
                $newUserId = $pdo->lastInsertId();

                // Tạo thống kê khởi đầu cho học viên
                $stmtStats = $pdo->prepare("INSERT INTO user_stats (user_id, streak_count, longest_streak, last_learned_date, total_xp, level) VALUES (?, 1, 1, CURDATE(), 50, 1)");
                $stmtStats->execute([$newUserId]);

                // Đăng nhập tự động
                $newUser = [
                    'id' => $newUserId,
                    'username' => $username,
                    'email' => $email,
                    'full_name' => $fullName,
                    'role' => 'user',
                    'avatar' => null
                ];
                login_user($newUser);

                set_flash('success', 'Chào mừng ' . $fullName . '! Tài khoản của bạn đã được tạo thành công.');
                header('Location: word_learning.php');
                exit;
            }
        } catch (Exception $e) {
            $error = 'Lỗi hệ thống: ' . $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Đăng Ký Tài Khoản · Word Learning</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #4f46e5;
            --primary-hover: #4338ca;
            --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
            --card-bg: rgba(30, 41, 59, 0.85);
            --border: rgba(255, 255, 255, 0.1);
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --danger: #ef4444;
            --success: #10b981;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body {
            background: var(--bg-gradient);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .auth-card {
            background: var(--card-bg);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border);
            border-radius: 20px;
            max-width: 460px;
            width: 100%;
            padding: 36px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .brand-header {
            text-align: center;
            margin-bottom: 28px;
        }
        .brand-badge {
            display: inline-block;
            background: rgba(79, 70, 229, 0.2);
            color: #818cf8;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
            border: 1px solid rgba(129, 140, 248, 0.3);
        }
        .brand-header h1 {
            font-size: 26px;
            font-weight: 800;
            color: #fff;
            letter-spacing: -0.5px;
        }
        .brand-header p {
            color: var(--text-muted);
            font-size: 14px;
            margin-top: 6px;
        }
        .alert-error {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid var(--danger);
            color: #fca5a5;
            padding: 12px 16px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .form-group {
            margin-bottom: 18px;
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
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid #334155;
            border-radius: 10px;
            padding: 12px 16px;
            color: #fff;
            font-size: 14px;
            transition: all 0.2s;
            outline: none;
        }
        .form-control:focus {
            border-color: #6366f1;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
            background: rgba(15, 23, 42, 0.85);
        }
        .form-control::placeholder {
            color: #64748b;
        }
        .btn-submit {
            width: 100%;
            background: var(--primary);
            color: #fff;
            padding: 13px;
            border: none;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 8px;
            box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
        }
        .btn-submit:hover {
            background: var(--primary-hover);
            transform: translateY(-1px);
        }
        .auth-footer {
            text-align: center;
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            font-size: 14px;
            color: var(--text-muted);
        }
        .auth-footer a {
            color: #818cf8;
            text-decoration: none;
            font-weight: 600;
        }
        .auth-footer a:hover {
            text-decoration: underline;
        }
        .home-nav {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #94a3b8;
            text-decoration: none;
            font-size: 13px;
            margin-bottom: 18px;
            transition: color 0.2s;
        }
        .home-nav:hover { color: #fff; }
    </style>
</head>
<body>
    <div class="auth-card">
        <a href="index.php" class="home-nav">← Về trang chủ</a>
        <div class="brand-header">
            <span class="brand-badge">HSK 3.0 & BOYA</span>
            <h1>Đăng Ký Tài Khoản</h1>
            <p>Tạo tài khoản để bắt đầu lộ trình học từ vựng thông minh</p>
        </div>

        <?php if ($error): ?>
            <div class="alert-error">
                <span>⚠️</span>
                <span><?= e($error) ?></span>
            </div>
        <?php endif; ?>

        <form method="POST" autocomplete="off">
            <div class="form-group">
                <label for="full_name">Họ và tên của bạn</label>
                <input type="text" id="full_name" name="full_name" class="form-control" placeholder="Ví dụ: Nguyễn Văn A" value="<?= e($fullName) ?>" required>
            </div>

            <div class="form-group">
                <label for="username">Tên đăng nhập (Username)</label>
                <input type="text" id="username" name="username" class="form-control" placeholder="chữ_cái_hoặc_số (3-50 ký tự)" value="<?= e($username) ?>" required>
            </div>

            <div class="form-group">
                <label for="email">Địa chỉ Email</label>
                <input type="email" id="email" name="email" class="form-control" placeholder="name@example.com" value="<?= e($email) ?>" required>
            </div>

            <div class="form-group">
                <label for="password">Mật khẩu</label>
                <input type="password" id="password" name="password" class="form-control" placeholder="Ít nhất 6 ký tự" required>
            </div>

            <div class="form-group">
                <label for="password_confirm">Xác nhận mật khẩu</label>
                <input type="password" id="password_confirm" name="password_confirm" class="form-control" placeholder="Nhập lại mật khẩu ở trên" required>
            </div>

            <button type="submit" class="btn-submit">
                ✨ Tạo Tài Khoản & Bắt Đầu Học
            </button>
        </form>

        <div class="auth-footer">
            Đã có tài khoản? <a href="login.php">Đăng nhập ngay</a>
        </div>
    </div>
</body>
</html>
