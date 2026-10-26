<?php
// config/database.php
// Cấu hình kết nối MySQL / MariaDB (Tương thích hoàn toàn WEMP & XAMPP)

// Máy chủ MariaDB / MySQL
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');

// Cổng kết nối: WEMP MariaDB mặc định dùng cổng 3308 (tránh xung đột với MySQL 3306)
// Hệ thống tự động ưu tiên 3308 nếu có WEMP, hoặc fallback về 3306
define('DB_PORT', getenv('DB_PORT') ?: (file_exists('D:/wemp/mariadb/data/my.ini') ? '3308' : '3306'));

define('DB_NAME', getenv('DB_NAME') ?: 'hsk_word_learning');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_CHARSET', 'utf8mb4');

function getDbConnection($selectDb = true) {
    static $pdo = null;

    if ($pdo !== null && $selectDb) {
        return $pdo;
    }

    $portsToTry = [DB_PORT];
    if (DB_PORT !== '3308') $portsToTry[] = '3308';
    if (DB_PORT !== '3306') $portsToTry[] = '3306';
    $portsToTry = array_unique($portsToTry);

    $lastException = null;

    foreach ($portsToTry as $port) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";port=" . $port . ($selectDb ? ";dbname=" . DB_NAME : "") . ";charset=" . DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . DB_CHARSET . " COLLATE utf8mb4_unicode_ci"
            ];
            
            $conn = new PDO($dsn, DB_USER, DB_PASS, $options);
            if ($selectDb) {
                $pdo = $conn;
            }
            return $conn;
        } catch (PDOException $e) {
            $lastException = $e;
            // Nếu lỗi là mã 1049 (Unknown database) nghĩa là port và user/pass đã kết nối được vào MariaDB
            // chỉ là chưa tạo database `hsk_word_learning`
            if ($selectDb && $e->getCode() == 1049) {
                $scriptName = basename($_SERVER['PHP_SELF'] ?? '');
                if ($scriptName !== 'install.php') {
                    header('Location: install.php');
                    exit;
                }
                throw $e;
            }
            // Thử cổng tiếp theo
            continue;
        }
    }

    throw new Exception("Lỗi kết nối MariaDB/MySQL (đã thử cổng " . implode(', ', $portsToTry) . "): " . ($lastException ? $lastException->getMessage() : 'Không thể kết nối'));
}
