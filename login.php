<?php
// login.php - Trang đăng nhập tài khoản
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';

// Nếu đã đăng nhập, chuyển hướng phù hợp
if (is_logged_in()) {
    header('Location: ' . (is_admin() ? 'admin/index.php' : 'word_learning.php'));
    exit;
}

$error = get_flash('error');
$success = get_flash('success');
$loginIdentity = '';

if (is_post()) {
    $loginIdentity = trim(post('identity'));
    $password = post('password');

    if (empty($loginIdentity) || empty($password)) {
        $error = 'Vui lòng nhập tên đăng nhập / email và mật khẩu.';
    } else {
        try {
            $pdo = getDbConnection();

            // Tìm user theo username hoặc email
            $stmt = $pdo->prepare("SELECT * FROM users WHERE (username = ? OR email = ?) LIMIT 1");
            $stmt->execute([$loginIdentity, $loginIdentity]);
            $user = $stmt->fetch();

            if (!$user) {
                $error = 'Tài khoản không tồn tại trên hệ thống.';
            } elseif ((int)$user['status'] !== 1) {
                $error = 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.';
            } elseif (!verify_password($password, $user['password'])) {
                $error = 'Mật khẩu không chính xác. Vui lòng kiểm tra lại.';
            } else {
                // Đăng nhập thành công
                login_user($user);

                // Cập nhật streak học tập trong user_stats
                $userId = $user['id'];
                $stmtStat = $pdo->prepare("SELECT * FROM user_stats WHERE user_id = ?");
                $stmtStat->execute([$userId]);
                $stat = $stmtStat->fetch();

                $today = date('Y-m-d');
                if ($stat) {
                    $lastDate = $stat['last_learned_date'];
                    if ($lastDate) {
                        $diffDays = (strtotime($today) - strtotime($lastDate)) / 86400;
                        if ($diffDays == 1) {
                            // Học liên tiếp các ngày
                            $newStreak = $stat['streak_count'] + 1;
                            $longest = max($newStreak, $stat['longest_streak']);
                            $pdo->prepare("UPDATE user_stats SET streak_count = ?, longest_streak = ?, last_learned_date = ? WHERE user_id = ?")
                                ->execute([$newStreak, $longest, $today, $userId]);
                        } elseif ($diffDays > 1) {
                            // Bị gián đoạn
                            $pdo->prepare("UPDATE user_stats SET streak_count = 1, last_learned_date = ? WHERE user_id = ?")
                                ->execute([$today, $userId]);
                        }
                    } else {
                        $pdo->prepare("UPDATE user_stats SET last_learned_date = ? WHERE user_id = ?")
                            ->execute([$today, $userId]);
                    }
                } else {
                    $pdo->prepare("INSERT INTO user_stats (user_id, streak_count, longest_streak, last_learned_date, total_xp, level) VALUES (?, 1, 1, ?, 50, 1)")
                        ->execute([$userId, $today]);
                }

                // Chuyển hướng
                $redirect = $_SESSION['redirect_after_login'] ?? null;
                unset($_SESSION['redirect_after_login']);

                if ($redirect) {
                    header("Location: $redirect");
                } elseif ($user['role'] === 'admin') {
                    header("Location: admin/index.php");
                } else {
                    header("Location: word_learning.php");
                }
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
    <title>Đăng Nhập · Word Learning HSK & Boya</title>
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
            max-width: 440px;
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
        .alert {
            padding: 12px 16px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            line-height: 1.4;
        }
        .alert-error {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid var(--danger);
            color: #fca5a5;
        }
        .alert-success {
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid var(--success);
            color: #6ee7b7;
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
        .demo-box {
            margin-top: 24px;
            background: rgba(15, 23, 42, 0.5);
            border: 1px dashed #334155;
            border-radius: 12px;
            padding: 14px;
        }
        .demo-box-title {
            font-size: 12px;
            font-weight: 600;
            color: #94a3b8;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .demo-actions {
            display: flex;
            gap: 8px;
        }
        .btn-demo {
            flex: 1;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid #475569;
            background: #1e293b;
            color: #e2e8f0;
            transition: all 0.2s;
            text-align: center;
        }
        .btn-demo:hover {
            background: #334155;
            border-color: #64748b;
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
            <h1>Đăng Nhập</h1>
            <p>Đăng nhập để lưu tiến độ học tập và quản lý học liệu</p>
        </div>

        <?php if ($error): ?>
            <div class="alert alert-error">
                <span>⚠️</span>
                <span><?= e($error) ?></span>
            </div>
        <?php endif; ?>

        <?php if ($success): ?>
            <div class="alert alert-success">
                <span>✅</span>
                <span><?= e($success) ?></span>
            </div>
        <?php endif; ?>

        <form method="POST" id="loginForm">
            <div class="form-group">
                <label for="identity">Tên đăng nhập hoặc Email</label>
                <input type="text" id="identity" name="identity" class="form-control" placeholder="admin hoặc hocvien" value="<?= e($loginIdentity) ?>" required autofocus>
            </div>

            <div class="form-group">
                <label for="password">Mật khẩu</label>
                <input type="password" id="password" name="password" class="form-control" placeholder="Nhập mật khẩu" required>
            </div>

            <button type="submit" class="btn-submit">
                🔐 Đăng Nhập
            </button>
        </form>

        <!-- Quick Demo Login Buttons for convenience -->
        <div class="demo-box">
            <div class="demo-box-title">
                <span>⚡ Đăng nhập thử nghiệm 1-click</span>
            </div>
            <div class="demo-actions">
                <button type="button" class="btn-demo" onclick="fillAndLogin('admin', 'admin123')">
                    👑 Quản Trị Viên (Admin)
                </button>
                <button type="button" class="btn-demo" onclick="fillAndLogin('hocvien', '123456')">
                    🎒 Học Viên (User)
                </button>
            </div>
        </div>

        <div class="auth-footer">
            Chưa có tài khoản? <a href="register.php">Đăng ký ngay</a>
        </div>
    </div>

    <script>
        function fillAndLogin(user, pass) {
            document.getElementById('identity').value = user;
            document.getElementById('password').value = pass;
            document.getElementById('loginForm').submit();
        }
    </script>
</body>
</html>
