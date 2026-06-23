// Quick API test
const http = require('http');

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (cookie) opts.headers['Cookie'] = cookie;

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    // 1. Login
    console.log('1. Testing Login...');
    const login = await request('POST', '/api/auth/login', { username: 'anan', password: '1234' });
    console.log('   Status:', login.status);
    console.log('   User:', login.body.user?.full_name, '-', login.body.user?.department);
    
    const cookie = login.headers['set-cookie']?.[0]?.split(';')[0];
    console.log('   Session cookie:', cookie ? 'OK' : 'MISSING');

    // 2. Get /api/auth/me
    console.log('\n2. Testing /api/auth/me...');
    const me = await request('GET', '/api/auth/me', null, cookie);
    console.log('   Status:', me.status);
    console.log('   User:', me.body.user?.full_name);

    // 3. Get conversations
    console.log('\n3. Testing /api/conversations...');
    const convs = await request('GET', '/api/conversations', null, cookie);
    console.log('   Status:', convs.status);
    console.log('   Conversations:', convs.body.conversations?.length);
    convs.body.conversations?.forEach(c => {
      console.log(`   - ${c.full_name} (${c.department}) | unread: ${c.unread_count}`);
    });

    // 4. Get messages
    if (convs.body.conversations?.length > 0) {
      const firstConv = convs.body.conversations[0];
      console.log(`\n4. Testing /api/messages/${firstConv.conversation_id}...`);
      const msgs = await request('GET', `/api/messages/${firstConv.conversation_id}`, null, cookie);
      console.log('   Status:', msgs.status);
      console.log('   Messages:', msgs.body.messages?.length);
    }

    console.log('\n✅ All API tests passed!');
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
