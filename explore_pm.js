// Quick script to test MySQL connection & explore PM database
const mysql = require('mysql2/promise');

(async () => {
  // Test Chat DB
  console.log('=== Testing Chat DB (192.168.95.80) ===');
  try {
    const conn = await mysql.createConnection({
      host: '192.168.95.80',
      port: 3306,
      user: 'drew',
      password: 'Drew@10667',
      connectTimeout: 8000
    });
    const [dbs] = await conn.query('SHOW DATABASES');
    console.log('Databases:', dbs.map(d => Object.values(d)[0]).join(', '));
    await conn.end();
    console.log('Chat DB: OK\n');
  } catch (err) {
    console.error('Chat DB error:', err.message, '\n');
  }

  // Test PM DB
  console.log('=== Testing PM DB (192.168.94.3) ===');
  try {
    const conn = await mysql.createConnection({
      host: '192.168.94.3',
      user: 'homc',
      password: 'homc',
      database: 'PM',
      connectTimeout: 8000
    });
    const [tables] = await conn.query('SHOW TABLES');
    console.log('Tables:', tables.map(t => Object.values(t)[0]).join(', '));
    await conn.end();
    console.log('PM DB: OK');
  } catch (err) {
    console.error('PM DB error:', err.message);
  }
})();
