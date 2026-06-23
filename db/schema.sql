-- ============================================
-- BRH Chat — Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS brh_chat
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE brh_chat;

-- ----- Users Table -----
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_md5  CHAR(32) NOT NULL,
    full_name     VARCHAR(100) NOT NULL,
    department    VARCHAR(50) NOT NULL,
    initials      VARCHAR(4) NOT NULL,
    avatar_color  VARCHAR(20) DEFAULT 'avatar-blue',
    is_online     TINYINT(1) DEFAULT 0,
    last_seen     DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----- Conversations Table -----
CREATE TABLE IF NOT EXISTS conversations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user1_id        INT NOT NULL,
    user2_id        INT NOT NULL,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_pair (user1_id, user2_id)
) ENGINE=InnoDB;

-- ----- Messages Table -----
CREATE TABLE IF NOT EXISTS messages (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id       INT NOT NULL,
    message_text    TEXT,
    media_type      ENUM('none','image','video') DEFAULT 'none',
    media_path      VARCHAR(500) DEFAULT NULL,
    media_caption   VARCHAR(255) DEFAULT NULL,
    is_read         TINYINT(1) DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_conv_time (conversation_id, created_at),
    INDEX idx_sender (sender_id)
) ENGINE=InnoDB;

-- ============================================
-- Seed Data — Staff Users
-- Passwords are MD5('1234') = 81dc9bdb52d04dc20036dbd8313ed055
-- ============================================

INSERT INTO users (username, password_md5, full_name, department, initials, avatar_color) VALUES
  ('anan',    '81dc9bdb52d04dc20036dbd8313ed055', 'อนันต์ สุขใจ',       'OPD',      'AN', 'avatar-teal'),
  ('somsri',  '81dc9bdb52d04dc20036dbd8313ed055', 'สมศรี รักดี',        'ER',       'SS', 'avatar-rose'),
  ('prayuth', '81dc9bdb52d04dc20036dbd8313ed055', 'ดร.ประยุทธ์ ชัยยง',  'ICU',      'PY', 'avatar-violet'),
  ('napa',    '81dc9bdb52d04dc20036dbd8313ed055', 'นภา ศรีสุข',         'Ward 3',   'NP', 'avatar-blue'),
  ('wichai',  '81dc9bdb52d04dc20036dbd8313ed055', 'วิชัย พงษ์พานิช',    'LAB',      'WC', 'avatar-amber'),
  ('pim',     '81dc9bdb52d04dc20036dbd8313ed055', 'พิมพ์ วงศ์สวัสดิ์',   'Pharmacy', 'PM', 'avatar-emerald'),
  ('kanda',   '81dc9bdb52d04dc20036dbd8313ed055', 'กานดา เจริญผล',      'OR',       'KD', 'avatar-sky'),
  ('rattana', '81dc9bdb52d04dc20036dbd8313ed055', 'รัตนา บุญมี',        'IPD',      'RT', 'avatar-pink')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name);

-- ============================================
-- Seed Conversations & Messages
-- ============================================

-- Conversations between user 1 (anan) and others
INSERT INTO conversations (user1_id, user2_id, last_message_at) VALUES
  (1, 2, '2026-06-04 14:32:00'),
  (1, 3, '2026-06-04 12:48:00'),
  (1, 4, '2026-06-04 11:20:00'),
  (1, 5, '2026-06-04 13:55:00'),
  (1, 6, '2026-06-04 13:00:00'),
  (1, 7, '2026-06-03 16:45:00'),
  (1, 8, '2026-06-04 10:30:00')
ON DUPLICATE KEY UPDATE last_message_at=VALUES(last_message_at);

-- Messages for conversation 1 (anan <-> somsri)
INSERT INTO messages (conversation_id, sender_id, message_text, media_type, media_path, media_caption, is_read, created_at) VALUES
  (1, 2, 'พี่ครับ เครื่องปริ้นที่ OPD มันเสียอีกแล้ว', 'none', NULL, NULL, 1, '2026-06-04 13:45:00'),
  (1, 2, 'กระดาษมันติดตลอดเลย ลองรีเซ็ตแล้วก็ไม่หาย', 'none', NULL, NULL, 1, '2026-06-04 13:46:00'),
  (1, 1, 'เอารูปมาให้ดูหน่อยได้ไหมครับ จะได้แจ้ง IT ให้', 'none', NULL, NULL, 1, '2026-06-04 13:50:00'),
  (1, 2, 'ได้ครับ เดี๋ยวถ่ายให้เลย', 'none', NULL, NULL, 1, '2026-06-04 13:51:00'),
  (1, 2, NULL, 'image', '/uploads/broken_printer.png', 'เครื่องปริ้นที่ OPD ชั้น 2', 1, '2026-06-04 14:02:00'),
  (1, 1, 'เห็นแล้วครับ ดูเหมือนลูกกลิ้งมีปัญหา ผมแจ้ง IT ให้เลยนะครับ', 'none', NULL, NULL, 1, '2026-06-04 14:10:00'),
  (1, 1, 'แจ้งไปแล้วครับ เค้าบอกจะไปดูให้ภายในบ่ายนี้', 'none', NULL, NULL, 1, '2026-06-04 14:25:00'),
  (1, 2, 'ขอบคุณมากครับพี่ 🙏', 'none', NULL, NULL, 1, '2026-06-04 14:30:00'),
  (1, 2, 'ผมส่งรูปเครื่องปริ้นที่เสียให้แล้วนะครับ', 'none', NULL, NULL, 0, '2026-06-04 14:32:00');

-- Messages for conversation 2 (anan <-> dr.prayuth)
INSERT INTO messages (conversation_id, sender_id, message_text, media_type, media_path, media_caption, is_read, created_at) VALUES
  (2, 1, 'หมอครับ ผลตรวจ Lab ผู้ป่วย ICU เตียง 3 มาแล้วครับ', 'none', NULL, NULL, 1, '2026-06-04 12:30:00'),
  (2, 3, 'ได้ครับ ส่งมาเลย', 'none', NULL, NULL, 1, '2026-06-04 12:32:00'),
  (2, 3, NULL, 'video', '/uploads/video_thumbnail.png', 'วิดีโออธิบายผล Lab ผู้ป่วย ICU', 1, '2026-06-04 12:45:00'),
  (2, 3, 'ส่งวิดีโอผลตรวจ Lab ให้ดูครับ ดูตามนี้เลย', 'none', NULL, NULL, 1, '2026-06-04 12:48:00');

-- Messages for conversation 3 (anan <-> napa)
INSERT INTO messages (conversation_id, sender_id, message_text, media_type, media_path, media_caption, is_read, created_at) VALUES
  (3, 1, 'พี่นภาครับ ตารางเวร Ward 3 สัปดาห์หน้าเสร็จยังครับ', 'none', NULL, NULL, 1, '2026-06-03 16:00:00'),
  (3, 4, 'ยังไม่เสร็จค่ะ เดี๋ยวกลับมาตอบนะคะ', 'none', NULL, NULL, 1, '2026-06-03 16:15:00'),
  (3, 1, 'สวัสดีครับ เป็นยังไงบ้างครับตารางเวร', 'none', NULL, NULL, 1, '2026-06-04 11:10:00'),
  (3, 4, 'เดี๋ยวกลับมาตอบนะคะ', 'none', NULL, NULL, 0, '2026-06-04 11:20:00');

-- Messages for conversation 4 (anan <-> wichai)
INSERT INTO messages (conversation_id, sender_id, message_text, media_type, media_path, media_caption, is_read, created_at) VALUES
  (4, 5, 'พี่ครับ ผล CBC ผู้ป่วยห้อง 12 ออกแล้วครับ', 'none', NULL, NULL, 0, '2026-06-04 13:55:00');

-- Messages for conversation 5 (anan <-> pim)
INSERT INTO messages (conversation_id, sender_id, message_text, media_type, media_path, media_caption, is_read, created_at) VALUES
  (5, 1, 'พิมพ์คะ ยาผู้ป่วย OPD เคส A-2045 พร้อมจ่ายยังคะ', 'none', NULL, NULL, 1, '2026-06-04 12:45:00'),
  (5, 6, 'รอสักครู่นะคะ กำลังเตรียมอยู่ค่ะ', 'none', NULL, NULL, 1, '2026-06-04 12:50:00'),
  (5, 6, 'ยาที่สั่งพร้อมจ่ายแล้วค่ะ มารับได้เลย', 'none', NULL, NULL, 1, '2026-06-04 13:00:00');

-- Messages for conversation 6 (anan <-> kanda)
INSERT INTO messages (conversation_id, sender_id, message_text, media_type, media_path, media_caption, is_read, created_at) VALUES
  (6, 7, 'ห้องผ่าตัด 3 ว่างตอน 15:00 ค่ะ จองได้เลย', 'none', NULL, NULL, 1, '2026-06-03 16:30:00'),
  (6, 1, 'รับทราบครับ ขอบคุณครับ', 'none', NULL, NULL, 1, '2026-06-03 16:45:00');

-- Messages for conversation 7 (anan <-> rattana)
INSERT INTO messages (conversation_id, sender_id, message_text, media_type, media_path, media_caption, is_read, created_at) VALUES
  (7, 1, 'พี่รัตนาครับ IPD ชั้น 5 มีเตียงว่างไหมครับ', 'none', NULL, NULL, 1, '2026-06-04 10:15:00'),
  (7, 8, 'เตียง IPD ชั้น 5 ว่าง 2 เตียงค่ะ เตียง 5A และ 5C', 'none', NULL, NULL, 1, '2026-06-04 10:30:00');
