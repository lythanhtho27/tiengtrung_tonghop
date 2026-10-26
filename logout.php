<?php
// logout.php - Đăng xuất tài khoản
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/helpers.php';

logout_user();
set_flash('success', 'Bạn đã đăng xuất an toàn khỏi hệ thống.');
header('Location: login.php');
exit;
