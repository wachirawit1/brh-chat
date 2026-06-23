const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '192.168.95.80',
      port: 3306,
      user: 'drew',
      password: 'Drew@10667',
      multipleStatements: true
    });

    console.log('Connected to MySQL. Running schema...');
    
    const sql = fs.readFileSync('db/schema.sql', 'utf8');
    await conn.query(sql);
    
    console.log('✅ Schema created successfully!');

    // Verify users
    const [users] = await conn.query('SELECT id, username, full_name, department FROM brh_chat.users');
    console.log('\nUsers created:');
    users.forEach(u => console.log(`  ${u.id}. ${u.username} — ${u.full_name} (${u.department})`));

    // Verify conversations
    const [convs] = await conn.query('SELECT id, user1_id, user2_id FROM brh_chat.conversations');
    console.log(`\nConversations: ${convs.length}`);

    // Verify messages
    const [msgs] = await conn.query('SELECT COUNT(*) as cnt FROM brh_chat.messages');
    console.log(`Messages: ${msgs[0].cnt}`);

    await conn.end();
    console.log('\n✅ Database setup complete!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
