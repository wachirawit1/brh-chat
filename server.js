// ============================================
// BRH Chat — Main Server
// Express + Socket.io + MySQL
// ============================================
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const mysql = require('mysql2/promise');
const cors = require('cors');
const fs = require('fs');
const os = require('os');

const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const { requireAuth } = require('./middleware/auth');
const sql = require('mssql');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ----- MySQL Connection Pool -----
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4'
});

// ----- SQL Server (MSSQL) Connection Pool -----
const mssqlConfig = {
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  server: process.env.MSSQL_SERVER,
  port: parseInt(process.env.MSSQL_PORT) || 1433,
  database: process.env.MSSQL_DATABASE,
  options: {
    encrypt: false, // Bypasses SSL requirements on local network
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const mssqlPool = new sql.ConnectionPool(mssqlConfig);
const mssqlConnectPromise = mssqlPool.connect()
  .then(pool => {
    console.log('🏥 Connected to PM SQL Server successfully');
    return pool;
  })
  .catch(err => {
    console.error('❌ Failed to connect to PM SQL Server:', err.message);
  });

// ----- Session Config -----
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'brh-default-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true
  }
});

// ----- Middleware -----
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ----- Static Files -----
app.use(express.static(path.join(__dirname, 'public')));

// ----- API Routes -----
app.use('/api/auth', authRoutes(db, mssqlPool));
app.use('/api/upload', uploadRoutes);

// ----- Staff List API (Role-aware) -----
app.get('/api/staff', requireAuth, async (req, res) => {
  try {
    const userRole = req.session.user.role || 'staff';
    let rows;

    if (userRole === 'it' || userRole === 'admin') {
      // IT/Admin can see everyone
      [rows] = await db.execute(
        'SELECT id, username, full_name, department, initials, avatar_color, role, specialties, is_online, last_seen FROM users WHERE id != ? ORDER BY full_name',
        [req.session.user.id]
      );
    } else {
      // Staff can only see IT users (to start direct chat with IT)
      [rows] = await db.execute(
        "SELECT id, username, full_name, department, initials, avatar_color, role, specialties, is_online, last_seen FROM users WHERE id != ? AND role IN ('it', 'admin') ORDER BY full_name",
        [req.session.user.id]
      );
    }

    res.json({ staff: rows });
  } catch (err) {
    console.error('Staff list error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงรายชื่อบุคลากรได้' });
  }
});

// ----- Update User Specialties API -----
app.put('/api/users/specialties', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { specialties } = req.body; // e.g. "database_reports,hardware_printers" or null

    await db.execute(
      'UPDATE users SET specialties = ? WHERE id = ?',
      [specialties || null, userId]
    );

    // Update in session
    req.session.user.specialties = specialties || null;

    res.json({ success: true, specialties: specialties || null });
  } catch (err) {
    console.error('Update specialties error:', err);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตข้อมูลความเชี่ยวชาญได้' });
  }
});

// ----- Conversations List API -----
app.get('/api/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.execute(`
      SELECT
        c.id AS conversation_id,
        CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END AS other_user_id,
        u.full_name, u.department, u.initials, u.avatar_color, u.is_online, u.last_seen,
        c.last_message_at,
        m.message_text AS last_message_text,
        m.media_type AS last_media_type,
        m.sender_id AS last_message_sender_id,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != ? AND is_read = 0) AS unread_count
      FROM conversations c
      JOIN users u ON u.id = CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END
      LEFT JOIN messages m ON m.id = (
        SELECT id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
      )
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY c.last_message_at DESC
    `, [userId, userId, userId, userId, userId]);
    res.json({ conversations: rows });
  } catch (err) {
    console.error('Conversations error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงรายการแชทได้' });
  }
});

// ----- Messages for a Conversation -----
app.get('/api/messages/:conversationId', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const convId = parseInt(req.params.conversationId);

    // Verify user is part of conversation
    const [conv] = await db.execute(
      'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [convId, userId, userId]
    );
    if (conv.length === 0) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงแชทนี้' });
    }

    const [messages] = await db.execute(
      `SELECT m.id, m.sender_id, m.message_text, m.media_type, m.media_path, m.media_caption, m.is_read, m.created_at,
              u.full_name AS sender_name, u.initials AS sender_initials, u.avatar_color AS sender_color
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`,
      [convId]
    );

    // Mark messages as read
    await db.execute(
      'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0',
      [convId, userId]
    );

    res.json({ messages });
  } catch (err) {
    console.error('Messages error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อความได้' });
  }
});

// ----- Start/Get Conversation -----
app.post('/api/conversations/start', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { otherUserId } = req.body;

    if (!otherUserId || otherUserId === userId) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    // Check existing conversation (either order)
    const uid1 = Math.min(userId, otherUserId);
    const uid2 = Math.max(userId, otherUserId);

    const [existing] = await db.execute(
      'SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?',
      [uid1, uid2]
    );

    if (existing.length > 0) {
      return res.json({ conversation_id: existing[0].id });
    }

    // Create new conversation
    const [result] = await db.execute(
      'INSERT INTO conversations (user1_id, user2_id, last_message_at) VALUES (?, ?, NOW())',
      [uid1, uid2]
    );

    res.json({ conversation_id: result.insertId });
  } catch (err) {
    console.error('Start conversation error:', err);
    res.status(500).json({ error: 'ไม่สามารถสร้างแชทได้' });
  }
});

// ============================================
// IT BOARD — Post & Accept System
// ============================================

// ----- Create IT Post (Staff submits a problem) -----
app.post('/api/it-posts', requireAuth, async (req, res) => {
  try {
    const { title, description, media_path } = req.body;
    const userId = req.session.user.id;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'กรุณาระบุหัวข้อปัญหา' });
    }

    const [result] = await db.execute(
      'INSERT INTO it_posts (user_id, title, description, media_path) VALUES (?, ?, ?, ?)',
      [userId, title.trim(), description || null, media_path || null]
    );

    // Notify IT staff via socket
    io.emit('new_it_post', {
      id: result.insertId,
      user_id: userId,
      user_name: req.session.user.full_name,
      user_dept: req.session.user.department,
      user_initials: req.session.user.initials,
      user_avatar_color: req.session.user.avatar_color,
      title: title.trim(),
      description: description || null,
      media_path: media_path || null,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    res.json({ success: true, post_id: result.insertId });
  } catch (err) {
    console.error('Create IT post error:', err);
    res.status(500).json({ error: 'ไม่สามารถสร้างโพสต์ได้' });
  }
});

// ----- List Pending IT Posts (For IT staff queue) -----
app.get('/api/it-posts/pending', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.id, p.title, p.description, p.media_path, p.status, p.created_at,
             u.id AS user_id, u.full_name AS user_name, u.department AS user_dept,
             u.initials AS user_initials, u.avatar_color AS user_avatar_color
      FROM it_posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.status = 'pending'
      ORDER BY p.created_at DESC
    `);
    res.json({ posts: rows });
  } catch (err) {
    console.error('List IT posts error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงรายการโพสต์ได้' });
  }
});

// ----- List My IT Posts (For staff to see their own posts) -----
app.get('/api/it-posts/mine', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.execute(`
      SELECT p.id, p.title, p.description, p.media_path, p.status, p.created_at,
             p.accepted_at, p.resolved_at, p.conversation_id,
             u.full_name AS user_name, u.initials AS user_initials, u.avatar_color AS user_avatar_color, u.department AS user_dept,
             a.full_name AS accepted_by_name, a.department AS accepted_by_dept,
             a.initials AS accepted_by_initials, a.avatar_color AS accepted_by_color
      FROM it_posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN users a ON a.id = p.accepted_by
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `, [userId]);
    res.json({ posts: rows });
  } catch (err) {
    console.error('List my IT posts error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงรายการโพสต์ได้' });
  }
});

// ----- List IT Posts accepted by me (For IT to see their active jobs) -----
app.get('/api/it-posts/my-jobs', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.execute(`
      SELECT p.id, p.title, p.description, p.media_path, p.status, p.created_at,
             p.accepted_at, p.resolved_at, p.conversation_id,
             u.id AS user_id, u.full_name AS user_name, u.department AS user_dept,
             u.initials AS user_initials, u.avatar_color AS user_avatar_color
      FROM it_posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.accepted_by = ?
      ORDER BY p.accepted_at DESC
    `, [userId]);
    res.json({ posts: rows });
  } catch (err) {
    console.error('List my jobs error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงรายการงานได้' });
  }
});

// ----- Accept IT Post (IT staff picks up a job) -----
app.post('/api/it-posts/:id/accept', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const itUserId = req.session.user.id;
    const userRole = req.session.user.role || 'staff';

    // Only IT/Admin can accept
    if (userRole !== 'it' && userRole !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะเจ้าหน้าที่ IT เท่านั้น' });
    }

    // Check post exists and is pending
    const [posts] = await db.execute(
      'SELECT * FROM it_posts WHERE id = ? AND status = ?',
      [postId, 'pending']
    );

    if (posts.length === 0) {
      return res.status(404).json({ error: 'โพสต์นี้ถูกรับไปแล้วหรือไม่พบ' });
    }

    const post = posts[0];

    // Create 1:1 conversation between IT user and the requester
    const uid1 = Math.min(itUserId, post.user_id);
    const uid2 = Math.max(itUserId, post.user_id);

    let conversationId;

    // Check if conversation already exists
    const [existingConv] = await db.execute(
      'SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?',
      [uid1, uid2]
    );

    if (existingConv.length > 0) {
      conversationId = existingConv[0].id;
    } else {
      const [convResult] = await db.execute(
        'INSERT INTO conversations (user1_id, user2_id, last_message_at) VALUES (?, ?, NOW())',
        [uid1, uid2]
      );
      conversationId = convResult.insertId;
    }

    // Update the post: accepted
    await db.execute(
      'UPDATE it_posts SET status = ?, accepted_by = ?, conversation_id = ?, accepted_at = NOW() WHERE id = ?',
      ['accepted', itUserId, conversationId, postId]
    );

    // Send auto-greeting message from IT staff
    const greeting = `สวัสดีครับ/ค่ะ ผม/ดิฉัน ${req.session.user.full_name} จากแผนก ${req.session.user.department} รับเรื่อง "${post.title}" ของคุณแล้วครับ/ค่ะ`;
    
    await db.execute(
      `INSERT INTO messages (conversation_id, sender_id, message_text, created_at)
       VALUES (?, ?, ?, NOW())`,
      [conversationId, itUserId, greeting]
    );

    // Update conversation timestamp
    await db.execute(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = ?',
      [conversationId]
    );

    // Notify via socket: post accepted (remove from queue)
    io.emit('it_post_accepted', {
      post_id: postId,
      accepted_by: req.session.user.full_name,
      accepted_by_id: itUserId,
      conversation_id: conversationId
    });

    // Also notify the requester about the new message in conversation
    const requesterSockets = onlineUsers.get(post.user_id);
    if (requesterSockets) {
      requesterSockets.forEach(sid => {
        io.to(sid).emit('post_accepted_notify', {
          post_id: postId,
          post_title: post.title,
          accepted_by: req.session.user.full_name,
          conversation_id: conversationId
        });
      });
    }

    res.json({ success: true, conversation_id: conversationId });
  } catch (err) {
    console.error('Accept IT post error:', err);
    res.status(500).json({ error: 'ไม่สามารถรับงานได้' });
  }
});

// ----- Resolve IT Post (Mark as resolved) -----
app.post('/api/it-posts/:id/resolve', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Only the IT person who accepted can resolve
    const [posts] = await db.execute(
      'SELECT * FROM it_posts WHERE id = ? AND accepted_by = ? AND status = ?',
      [postId, userId, 'accepted']
    );

    if (posts.length === 0) {
      return res.status(404).json({ error: 'ไม่พบโพสต์หรือไม่มีสิทธิ์' });
    }

    await db.execute(
      'UPDATE it_posts SET status = ?, resolved_at = NOW() WHERE id = ?',
      ['resolved', postId]
    );

    io.emit('it_post_resolved', { post_id: postId });

    res.json({ success: true });
  } catch (err) {
    console.error('Resolve IT post error:', err);
    res.status(500).json({ error: 'ไม่สามารถปิดงานได้' });
  }
});

// ----- Catch-all: serve index.html for SPA -----
app.get('/', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// Socket.io — Real-time Events
// ============================================

// Share session with Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Track online users: userId -> Set<socketId>
const onlineUsers = new Map();

io.on('connection', (socket) => {
  const session = socket.request.session;
  if (!session || !session.user) {
    socket.disconnect();
    return;
  }

  const user = session.user;
  console.log(`✅ ${user.full_name} (${user.department}) connected`);

  // Track socket
  if (!onlineUsers.has(user.id)) {
    onlineUsers.set(user.id, new Set());
  }
  onlineUsers.get(user.id).add(socket.id);

  // Update online status in DB
  db.execute('UPDATE users SET is_online = 1, last_seen = NOW() WHERE id = ?', [user.id]);

  // Broadcast online status
  io.emit('user_online', { userId: user.id });

  // ---------- Send Message ----------
  socket.on('send_message', async (data) => {
    try {
      const { conversation_id, text, media_type, media_path, media_caption } = data;

      // Insert message into DB
      const [result] = await db.execute(
        `INSERT INTO messages (conversation_id, sender_id, message_text, media_type, media_path, media_caption, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          conversation_id,
          user.id,
          text || null,
          media_type || 'none',
          media_path || null,
          media_caption || null
        ]
      );

      // Update conversation timestamp
      await db.execute(
        'UPDATE conversations SET last_message_at = NOW() WHERE id = ?',
        [conversation_id]
      );

      // Get the other user in conversation
      const [conv] = await db.execute(
        'SELECT user1_id, user2_id FROM conversations WHERE id = ?',
        [conversation_id]
      );

      if (conv.length === 0) return;

      const otherUserId = conv[0].user1_id === user.id ? conv[0].user2_id : conv[0].user1_id;

      const messageData = {
        id: result.insertId,
        conversation_id,
        sender_id: user.id,
        sender_name: user.full_name,
        sender_initials: user.initials,
        sender_color: user.avatar_color,
        message_text: text || null,
        media_type: media_type || 'none',
        media_path: media_path || null,
        media_caption: media_caption || null,
        is_read: 0,
        created_at: new Date().toISOString()
      };

      // Send to sender (confirmation)
      socket.emit('message_sent', messageData);

      // Send to recipient (all their sockets)
      const recipientSockets = onlineUsers.get(otherUserId);
      if (recipientSockets) {
        recipientSockets.forEach(sid => {
          io.to(sid).emit('new_message', messageData);
        });
      }

    } catch (err) {
      console.error('Send message error:', err);
      socket.emit('message_error', { error: 'ไม่สามารถส่งข้อความได้' });
    }
  });

  // ---------- Typing Events ----------
  socket.on('typing_start', (data) => {
    const { conversation_id, to_user_id } = data;
    const recipientSockets = onlineUsers.get(to_user_id);
    if (recipientSockets) {
      recipientSockets.forEach(sid => {
        io.to(sid).emit('typing_start', {
          conversation_id,
          user_id: user.id,
          user_name: user.full_name
        });
      });
    }
  });

  socket.on('typing_stop', (data) => {
    const { conversation_id, to_user_id } = data;
    const recipientSockets = onlineUsers.get(to_user_id);
    if (recipientSockets) {
      recipientSockets.forEach(sid => {
        io.to(sid).emit('typing_stop', {
          conversation_id,
          user_id: user.id
        });
      });
    }
  });

  // ---------- Mark Read ----------
  socket.on('mark_read', async (data) => {
    try {
      const { conversation_id } = data;
      await db.execute(
        'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0',
        [conversation_id, user.id]
      );

      // Notify sender their messages were read
      const [conv] = await db.execute(
        'SELECT user1_id, user2_id FROM conversations WHERE id = ?',
        [conversation_id]
      );
      if (conv.length > 0) {
        const otherUserId = conv[0].user1_id === user.id ? conv[0].user2_id : conv[0].user1_id;
        const recipientSockets = onlineUsers.get(otherUserId);
        if (recipientSockets) {
          recipientSockets.forEach(sid => {
            io.to(sid).emit('messages_read', { conversation_id, read_by: user.id });
          });
        }
      }
    } catch (err) {
      console.error('Mark read error:', err);
    }
  });

  // ---------- Disconnect ----------
  socket.on('disconnect', async () => {
    console.log(`❌ ${user.full_name} disconnected`);

    const userSockets = onlineUsers.get(user.id);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(user.id);
        await db.execute('UPDATE users SET is_online = 0, last_seen = NOW() WHERE id = ?', [user.id]);
        io.emit('user_offline', { userId: user.id });
      }
    }
  });
});

// ============================================
// Start Server
// ============================================
// Function to handle database startup resets
async function onServerStartup() {
  try {
    // Reset all users to offline on server startup (since all sockets are disconnected on startup)
    await db.execute('UPDATE users SET is_online = 0');
    console.log('🔄 Offline status reset for all users on startup.');
  } catch (err) {
    console.error('❌ Failed to reset offline status on startup:', err.message);
  }
}

// Start Server
if (typeof PORT === 'string' && PORT.startsWith('\\\\.\\pipe\\')) {
  server.listen(PORT, async () => {
    console.log(`\n🏥 BRH Chat Server running via iisnode (Named Pipe: ${PORT})`);
    console.log(`\n📡 Socket.io ready for real-time messaging\n`);
    await onServerStartup();
  });
} else {
  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n🏥 BRH Chat Server running at:`);
    console.log(`- Local: http://localhost:${PORT}`);
    
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`- Network: http://${iface.address}:${PORT}`);
        }
      }
    }
    
    console.log(`\n📡 Socket.io ready for real-time messaging\n`);
    await onServerStartup();
  });
}
