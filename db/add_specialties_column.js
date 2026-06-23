const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '192.168.95.80',
      port: 3306,
      user: 'drew',
      password: 'Drew@10667',
      database: 'brh_chat'
    });

    console.log('Connected to MySQL. Adding specialties column to users table...');
    
    // Check if column already exists
    const [columns] = await conn.query('SHOW COLUMNS FROM users LIKE "specialties"');
    if (columns.length === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN specialties VARCHAR(255) DEFAULT NULL');
      console.log('✅ Specialties column added successfully!');
    } else {
      console.log('ℹ️ Specialties column already exists.');
    }

    await conn.end();
  } catch (err) {
    console.error('❌ Error running migration:', err.message);
    process.exit(1);
  }
})();
