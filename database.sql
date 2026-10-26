-- ========================================================
-- CƠ SỞ DỮ LIỆU WORD LEARNING HSK / TIẾNG TRUNG
-- ========================================================

CREATE DATABASE IF NOT EXISTS `hsk_word_learning` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `hsk_word_learning`;

-- 1. BẢNG NGƯỜI DÙNG (USERS)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  `avatar` VARCHAR(255) DEFAULT NULL,
  `status` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1: Hoạt động, 0: Bị khóa',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. BẢNG GIÁO TRÌNH / SÁCH HỌC LIỆU (BOOKS)
CREATE TABLE IF NOT EXISTS `books` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `book_code` VARCHAR(50) NOT NULL UNIQUE,
  `title` VARCHAR(255) NOT NULL,
  `level` VARCHAR(50) NOT NULL DEFAULT 'HSK 1',
  `badge` VARCHAR(50) DEFAULT 'CẤP ĐỘ 1',
  `color` VARCHAR(20) DEFAULT '#ef4444',
  `description` TEXT DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. BẢNG BÀI HỌC / CHỦ ĐỀ (UNITS)
CREATE TABLE IF NOT EXISTS `units` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `book_id` INT NOT NULL,
  `unit_number` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_units_book` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. BẢNG TỪ VỰNG HỌC LIỆU (VOCABULARIES)
CREATE TABLE IF NOT EXISTS `vocabularies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `unit_id` INT NOT NULL,
  `word` VARCHAR(100) NOT NULL,
  `traditional` VARCHAR(100) DEFAULT NULL,
  `pinyin` VARCHAR(150) NOT NULL,
  `han_viet` VARCHAR(100) DEFAULT NULL,
  `pos` VARCHAR(50) DEFAULT NULL,
  `pos_full` VARCHAR(100) DEFAULT NULL,
  `meaning_vi` TEXT NOT NULL,
  `meaning_en` TEXT DEFAULT NULL,
  `examples` LONGTEXT DEFAULT NULL COMMENT 'JSON array danh sách câu ví dụ [{hz, py, vn}]',
  `mnemonic` TEXT DEFAULT NULL COMMENT 'Chiết tự & câu chuyện gợi nhớ',
  `radical` VARCHAR(50) DEFAULT NULL COMMENT 'Bộ thủ chính',
  `stroke_count` INT NOT NULL DEFAULT 0,
  `audio_url` VARCHAR(255) DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_vocab_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. BẢNG TIẾN ĐỘ HỌC CỦA NGƯỜI DÙNG (USER_PROGRESS)
CREATE TABLE IF NOT EXISTS `user_progress` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `vocab_id` INT NOT NULL,
  `is_favorite` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Đánh dấu sao yêu thích',
  `is_difficult` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Hộp từ khó (Spaced Repetition)',
  `status` ENUM('new', 'learning', 'mastered') NOT NULL DEFAULT 'new',
  `leitner_box` INT NOT NULL DEFAULT 1 COMMENT 'Hộp ghi nhớ Leitner 1-5',
  `review_count` INT NOT NULL DEFAULT 0,
  `last_reviewed_at` DATETIME DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_user_vocab` (`user_id`, `vocab_id`),
  CONSTRAINT `fk_progress_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_progress_vocab` FOREIGN KEY (`vocab_id`) REFERENCES `vocabularies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. BẢNG THỐNG KÊ NGƯỜI DÙNG (USER_STATS)
CREATE TABLE IF NOT EXISTS `user_stats` (
  `user_id` INT PRIMARY KEY,
  `streak_count` INT NOT NULL DEFAULT 1,
  `longest_streak` INT NOT NULL DEFAULT 1,
  `last_learned_date` DATE DEFAULT NULL,
  `total_xp` INT NOT NULL DEFAULT 50,
  `level` INT NOT NULL DEFAULT 1,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_stats_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- DỮ LIỆU MẪU MẶC ĐỊNH
-- Mật khẩu mặc định:
-- Admin: admin / admin123
-- User:  hocvien / 123456
-- (Được hash bằng password_hash bcrypt)
-- ========================================================

INSERT INTO `users` (`id`, `username`, `email`, `password`, `full_name`, `role`, `status`) VALUES
(1, 'admin', 'admin@example.com', '$2y$10$CCbPVwHQs1Zd9JLpkO6ZK.1zUipgx10knmIBOolkSU4d1CTJz1s6C', 'Quản Trị Viên', 'admin', 1),
(2, 'hocvien', 'hocvien@example.com', '$2y$10$FHDy2DhHSXg4.Jn.z05FiuPb.h7O9Lp6xSBDSsE5hHcMdLDHFXTj6', 'Nguyễn Văn Học', 'user', 1)
ON DUPLICATE KEY UPDATE `password`=VALUES(`password`);

INSERT INTO `user_stats` (`user_id`, `streak_count`, `longest_streak`, `last_learned_date`, `total_xp`, `level`) VALUES
(1, 1, 1, CURDATE(), 250, 2),
(2, 3, 5, CURDATE(), 120, 1)
ON DUPLICATE KEY UPDATE `streak_count`=`streak_count`;

-- Giáo trình mẫu
INSERT INTO `books` (`id`, `book_code`, `title`, `level`, `badge`, `color`, `description`, `sort_order`) VALUES
(1, 'hsk1', 'HSK 3.0 — Quyển 1 (一级)', 'HSK 1', 'CẤP ĐỘ 1', '#ef4444', 'Giáo trình luyện và nhớ nhanh từ vựng HSK 3.0 Cấp 1 gồm 500 từ cốt lõi.', 1),
(2, 'boya1', 'Giáo Trình Boya Sơ Cấp 1', 'Sơ Cấp', 'BOYA 1', '#06b6d4', 'Từ vựng trọng tâm giao tiếp thực hành theo giáo trình Đại học Bắc Kinh.', 2)
ON DUPLICATE KEY UPDATE `book_code`=`book_code`;

-- Bài học mẫu
INSERT INTO `units` (`id`, `book_id`, `unit_number`, `title`, `description`, `sort_order`) VALUES
(1, 1, 1, 'Bài 1: Lời chào & Đại từ cơ bản', 'Từ vựng mở đầu: 愛, 爸爸, 杯子, 北京...', 1),
(2, 1, 2, 'Bài 2: Gia đình & Đồ vật thường ngày', 'Từ vựng về gia đình, bạn bè và sinh hoạt hằng ngày', 2),
(3, 2, 1, 'Bài 1: Xin chào (你好)', 'Giao tiếp làm quen và xưng hô căn bản', 1)
ON DUPLICATE KEY UPDATE `id`=`id`;

-- Từ vựng mẫu cho Bài 1
INSERT INTO `vocabularies` (`id`, `unit_id`, `word`, `traditional`, `pinyin`, `han_viet`, `pos`, `pos_full`, `meaning_vi`, `meaning_en`, `examples`, `mnemonic`, `radical`, `stroke_count`, `sort_order`) VALUES
(1, 1, '爱', '愛', 'ài', 'ÁI', 'đ.', 'đ. (Động từ)', 'yêu, thích', 'to love, to like', '[{"hz":"我爱你。","py":"Wǒ ài nǐ.","vn":"Tôi yêu bạn."},{"hz":"我爱我的家人。","py":"Wǒ ài wǒ de jiā rén.","vn":"Tôi yêu gia đình tôi."}]', 'Trên có móng vuốt (爫) che chở mái nhà (冖), ở giữa ôm trọn trái tim (心), cùng bước đi (夂).', '心', 10, 1),
(2, 1, '爸爸', '爸爸', 'bàba', 'BÁ BÁ', 'd.', 'd. (Danh từ)', 'bố, cha, ba', 'father, dad', '[{"hz":"我爸爸是医生。","py":"Wǒ bàba shì yīshēng.","vn":"Bố tôi là bác sĩ."},{"hz":"爸爸，您好！","py":"Bàba, nín hǎo!","vn":"Con chào bố ạ!"}]', 'Bộ Phụ (父) tượng trưng người cha cầm gậy lao động, dưới là chữ Ba (巴) mượn âm.', '父', 8, 2),
(3, 1, '杯子', '杯子', 'bēizi', 'BÔI TỬ', 'd.', 'd. (Danh từ)', 'cốc, ly, tách', 'cup, glass', '[{"hz":"桌子上有一个杯子。","py":"Zhuōzi shàng yǒu yí gè bēizi.","vn":"Trên bàn có một cái cốc."},{"hz":"这个杯子很漂亮。","py":"Zhège bēizi hěn piàoliang.","vn":"Cái ly này rất đẹp."}]', 'Bên trái là bộ Mộc (木) cái cốc làm bằng gỗ thời xưa, bên phải là chữ Bất (不).', '木', 8, 3),
(4, 1, '北京', '北京', 'Běijīng', 'BẮC KINH', 'd. riêng', 'd. riêng (Danh từ riêng)', 'Bắc Kinh (thủ đô TQ)', 'Beijing', '[{"hz":"我想去北京旅游。","py":"Wǒ xiǎng qù Běijīng lǚyóu.","vn":"Tôi muốn đi du lịch Bắc Kinh."},{"hz":"北京的天气怎么样？","py":"Běijīng de tiānqì zěnmeyàng?","vn":"Thời tiết Bắc Kinh thế nào?"}]', 'Bắc (北) là hướng bắc, Kinh (京) là kinh thành, nơi đóng đô.', '亠', 5, 4),
(5, 1, '本', '本', 'běn', 'BẢN', 'l.', 'l. (Lượng từ)', 'quyển, cuốn (sách, vở); gốc rễ', 'measure word for books', '[{"hz":"这是一本书。","py":"Zhè shì yì běn shū.","vn":"Đây là một quyển sách."},{"hz":"我买了两本书。","py":"Wǒ mǎi le liǎng běn shū.","vn":"Tôi đã mua hai quyển sách."}]', 'Bộ Mộc (木) có thêm nét gạch ngang ở dưới chỉ gốc rễ cây, nghĩa mở rộng là cội nguồn, bản sách.', '木', 5, 5),
(6, 1, '不客气', '不客氣', 'bú kèqi', 'BẤT KHÁCH KHÍ', 'cụm', 'cụm từ giao tiếp', 'đừng khách sáo, không có chi', 'you are welcome', '[{"hz":"谢谢你！——不客气。","py":"Xièxie nǐ! —— Bú kèqi.","vn":"Cảm ơn bạn! —— Không có chi."}]', 'Bất (不) là không, Khách (客) là khách sáo, Khí (气) là thái độ khí chất.', '大', 4, 6),
(7, 1, '不', '不', 'bù', 'BẤT', 'ph.', 'ph. (Phó từ)', 'không, chẳng (phủ định)', 'not, no', '[{"hz":"我不是老师。","py":"Wǒ bú shì lǎoshī.","vn":"Tôi không phải là giáo viên."},{"hz":"他不去学校。","py":"Tā bú qù xuéxiào.","vn":"Anh ấy không đi đến trường."}]', 'Hình tượng một con chim bay vút lên trời không chịu trở lại mặt đất.', '一', 4, 7),
(8, 1, '菜', '菜', 'cài', 'THÁI', 'd.', 'd. (Danh từ)', 'món ăn, thức ăn, rau cỏ', 'dish, vegetable', '[{"hz":"今天做中国菜。","py":"Jīntiān zuò Zhōngguó cài.","vn":"Hôm nay nấu món ăn Trung Quốc."},{"hz":"这个菜很好吃。","py":"Zhège cài hěn hǎochī.","vn":"Món này rất ngon."}]', 'Bộ Thảo (艹) ở trên là rau cỏ, chữ Thải (采) ở dưới nghĩa hái lượm.', '艹', 11, 8),
(9, 1, '茶', '茶', 'chá', 'TRÀ', 'd.', 'd. (Danh từ)', 'trà, chè', 'tea', '[{"hz":"请喝茶。","py":"Qǐng hē chá.","vn":"Mời uống trà."},{"hz":"中国人喜欢喝茶。","py":"Zhōngguórén xǐhuan hē chá.","vn":"Người Trung Quốc thích uống trà."}]', 'Bộ Thảo (艹) ngọn lá non, dưới là Nhân (人) hái trong rừng cây (木).', '艹', 9, 9),
(10, 1, '吃', '吃', 'chī', 'NGẬT', 'đ.', 'đ. (Động từ)', 'ăn', 'to eat', '[{"hz":"你想吃什么？","py":"Nǐ xiǎng chī shénme?","vn":"Bạn muốn ăn gì?"},{"hz":"吃饭了吗？","py":"Chī fàn le ma?","vn":"Ăn cơm chưa?"}]', 'Bộ Khẩu (口) cái miệng đưa thức ăn vào, chữ Ngật (乞) van xin.', '口', 6, 10)
ON DUPLICATE KEY UPDATE `id`=`id`;
