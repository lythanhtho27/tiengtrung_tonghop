<?php
// includes/auth.php
// Hệ thống quản lý phiên đăng nhập và phân quyền

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Kiểm tra xem người dùng đã đăng nhập hay chưa
 */
function is_logged_in(): bool {
    return !empty($_SESSION['user']) && !empty($_SESSION['user']['id']);
}

/**
 * Lấy thông tin người dùng hiện tại
 */
function current_user(): ?array {
    return $_SESSION['user'] ?? null;
}

/**
 * Lấy user_id hiện tại (hoặc null nếu chưa đăng nhập)
 */
function current_user_id(): ?int {
    return $_SESSION['user']['id'] ?? null;
}

/**
 * Kiểm tra người dùng có phải là Quản trị viên (Admin) không
 */
function is_admin(): bool {
    return is_logged_in() && ($_SESSION['user']['role'] ?? '') === 'admin';
}

/**
 * Bắt buộc phải đăng nhập để truy cập trang
 */
function require_login(string $redirect = 'login.php') {
    if (!is_logged_in()) {
        $_SESSION['flash_error'] = 'Vui lòng đăng nhập để tiếp tục.';
        $_SESSION['redirect_after_login'] = $_SERVER['REQUEST_URI'] ?? 'word_learning.php';
        header("Location: $redirect");
        exit;
    }
}

/**
 * Bắt buộc quyền Quản trị viên (Admin)
 */
function require_admin(string $redirect = '../login.php') {
    if (!is_logged_in()) {
        $_SESSION['flash_error'] = 'Bạn cần đăng nhập với quyền Quản trị viên.';
        $_SESSION['redirect_after_login'] = $_SERVER['REQUEST_URI'] ?? 'admin/index.php';
        header("Location: $redirect");
        exit;
    }
    if (!is_admin()) {
        $_SESSION['flash_error'] = 'Bạn không có quyền truy cập trang quản trị này.';
        header('Location: ../word_learning.php');
        exit;
    }
}

/**
 * Thực hiện đăng nhập và lưu session
 */
function login_user(array $user): void {
    // Không lưu password hash vào session
    unset($user['password']);
    $_SESSION['user'] = $user;
    $_SESSION['login_time'] = time();
}

/**
 * Đăng xuất
 */
function logout_user(): void {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
}

/**
 * Hash mật khẩu an toàn bằng bcrypt
 */
function hash_password(string $password): string {
    return password_hash($password, PASSWORD_DEFAULT);
}

/**
 * Kiểm tra mật khẩu
 */
function verify_password(string $password, string $hash): bool {
    return password_verify($password, $hash);
}
