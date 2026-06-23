// ============================================
// BRH Chat — Migration: IT Board Feature
// Run: node db/run_migration.js
// ============================================
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  console.log('=== Running IT Board Migration ===');
  
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // 1. Add role column to users (if not exists)
    console.log('1. Adding role column to users...');
    try {
      await conn.execute("ALTER TABLE users ADD COLUMN role ENUM('staff', 'it', 'admin') DEFAULT 'staff'");
      console.log('   ✅ role column added');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('   ⏩ role column already exists, skipping');
      } else {
        throw err;
      }
    }

    // 2. Create it_posts table
    console.log('2. Creating it_posts table...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS it_posts (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        user_id         INT NOT NULL,
        accepted_by     INT DEFAULT NULL,
        conversation_id INT DEFAULT NULL,
        title           VARCHAR(255) NOT NULL,
        description     TEXT,
        media_path      VARCHAR(500) DEFAULT NULL,
        status          ENUM('pending', 'accepted', 'resolved') DEFAULT 'pending',
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        accepted_at     DATETIME DEFAULT NULL,
        resolved_at     DATETIME DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('   ✅ it_posts table created');

    // 3. Verify
    const [cols] = await conn.execute("SHOW COLUMNS FROM users WHERE Field = 'role'");
    console.log('   Verify users.role:', cols.length > 0 ? '✅ exists' : '❌ missing');

    const [tables] = await conn.execute("SHOW TABLES LIKE 'it_posts'");
    console.log('   Verify it_posts table:', tables.length > 0 ? '✅ exists' : '❌ missing');

    console.log('\n🎉 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    await conn.end();
  }
})();
