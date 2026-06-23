-- ============================================
-- BRH Chat — Migration: IT Board Feature
-- Adds role column to users + it_posts table
-- ============================================

USE brh_chat;

-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role ENUM('staff', 'it', 'admin') DEFAULT 'staff';

-- IT Posts table (Job board for IT support requests)
CREATE TABLE IF NOT EXISTS it_posts (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,              -- ผู้แจ้งปัญหา
    accepted_by     INT DEFAULT NULL,          -- ไอทีคนที่กดรับ
    conversation_id INT DEFAULT NULL,          -- ห้องแชท 1:1 ที่ถูกสร้างหลังกด Accept
    title           VARCHAR(255) NOT NULL,     -- หัวข้อปัญหา
    description     TEXT,                      -- รายละเอียดเพิ่มเติม
    media_path      VARCHAR(500) DEFAULT NULL, -- รูปภาพแนบ
    status          ENUM('pending', 'accepted', 'resolved') DEFAULT 'pending',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at     DATETIME DEFAULT NULL,
    resolved_at     DATETIME DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
