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
    httpOnly: true,
    sameSite: 'lax'
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

// ----- Main SPA Page Auth Guard (Redirects before index.html is sent) -----
const serveIndexPage = (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
};

app.get('/', serveIndexPage);
app.get('/index.html', serveIndexPage);

// ----- Static Files -----
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ----- API Routes -----
app.use('/api/auth', authRoutes(db, mssqlPool));
app.use('/api/upload', uploadRoutes);
app.get('/api/download', (req, res, next) => {
  req.url = '/download?' + new URLSearchParams(req.query).toString();
  uploadRoutes(req, res, next);
});

// ----- Staff List API (Role-aware) -----
app.get('/api/staff', requireAuth, async (req, res) => {
  try {
    const userRole = req.session.user.role || 'staff';
    let rows;

    if (userRole === 'it' || userRole === 'admin') {
      // IT/Admin can see everyone
      [rows] = await db.execute(
        'SELECT id, username, full_name, department, dept_name, position, initials, avatar_color, role, specialties, is_online, last_seen FROM users WHERE id != ? ORDER BY full_name',
        [req.session.user.id]
      );
    } else {
      // Staff can only see IT users (to start direct chat with IT)
      [rows] = await db.execute(
        "SELECT id, username, full_name, department, dept_name, position, initials, avatar_color, role, specialties, is_online, last_seen FROM users WHERE id != ? AND role IN ('it', 'admin') ORDER BY full_name",
        [req.session.user.id]
      );
    }

    const staffList = (rows || []).map(u => {
      const d1 = (u.department || '').trim();
      const d2 = (u.dept_name || '').trim();
      const formattedDept = (d2 && d2 !== d1 && !d1.includes(d2)) ? `${d2} (${d1})` : d1;
      return {
        ...u,
        department: formattedDept,
        parent_department: d1,
        sub_department: d2
      };
    });

    res.json({ staff: staffList });
  } catch (err) {
    console.error('Staff list error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงรายชื่อบุคลากรได้' });
  }
});

// ----- Search Staff from PM Database (with Detailed Sub-departments) -----
app.get('/api/staff/pm-search', requireAuth, async (req, res) => {
  try {
    const rawQuery = String(req.query.q || '').trim();
    if (!rawQuery || rawQuery.length < 2) {
      return res.json({ results: [] });
    }

    let results = [];

    // 1. Primary: Detailed query with sub-department (dept_name) and title (tname) via single OPENQUERY
    if (mssqlPool && mssqlPool.connected) {
      try {
        const request = mssqlPool.request();
        request.input('q', `%${rawQuery}%`);
        const result = await request.query(`
          SELECT TOP 15 * FROM OPENQUERY(MYSQL_PM, '
            SELECT 
                w.user_id AS userid,
                u.cid,
                TRIM(t.tname) AS tname,
                TRIM(u.fname) AS fname,
                TRIM(u.lname) AS lname,
                TRIM(p2.position_level2_name) AS position,
                CASE WHEN w.position_level3_id = 34 THEN '''' ELSE TRIM(p3.position_level3_name) END AS position2,
                w.parent_dept_id AS parent_deptid,
                w.dept_id,
                TRIM(d.dept_name) AS department,
                TRIM(d2.dept_name) AS dept_name,
                u.username
            FROM hr_work_experience w
            JOIN erp_user_profile u ON u.user_id = w.user_id 
            LEFT JOIN hr_titlename t ON t.tname_id = u.tname_id
            LEFT JOIN hr_position_level2 p2 ON p2.position_level2_id = w.position_level2_id
            LEFT JOIN hr_position_level3 p3 ON p3.position_level3_id = w.position_level3_id
            LEFT JOIN hr_dept d ON d.dept_id = w.parent_dept_id
            LEFT JOIN hr_dept d2 ON d2.dept_id = w.dept_id
            WHERE w.position_active = ''Y''
          ') WHERE fname LIKE @q OR lname LIKE @q OR username LIKE @q
          ORDER BY fname ASC, lname ASC
        `);

        if (result && result.recordset && result.recordset.length > 0) {
          results = result.recordset.map(row => {
            const pos1 = row.position ? String(row.position).trim() : '';
            const pos2 = row.position2 ? String(row.position2).trim() : '';
            const position = (pos1 + pos2) || pos1 || '';
            const tname = row.tname ? String(row.tname).trim() : '';
            const fname = row.fname ? String(row.fname).trim() : '';
            const lname = row.lname ? String(row.lname).trim() : '';
            const fullName = `${tname ? tname + ' ' : ''}${fname} ${lname}`.trim();
            const rawFullName = `${fname} ${lname}`.trim();
            const parentDept = row.department ? String(row.department).trim() : '';
            const subDept = row.dept_name ? String(row.dept_name).trim() : '';
            const username = row.username ? String(row.username).trim() : '';

            // Format composite department (e.g. "พิเศษอายุรกรรม ชั้น 6 (กลุ่มงานการพยาบาลผู้ป่วยอายุรกรรม 1)")
            let displayDept = parentDept;
            if (subDept && subDept !== parentDept && !parentDept.includes(subDept)) {
              displayDept = `${subDept} (${parentDept})`;
            } else if (!displayDept && subDept) {
              displayDept = subDept;
            }

            return {
              full_name: rawFullName,
              title_name: tname,
              position,
              department: parentDept,
              sub_department: subDept,
              dept_name: subDept,
              display_department: displayDept,
              username
            };
          }).filter(u => u.full_name);
        }
      } catch (sqlErr) {
        console.error('PM Detailed Search error, falling back to vwUserinfo:', sqlErr.message);
        // Fallback to vwUserinfo
        try {
          const request = mssqlPool.request();
          request.input('q', `%${rawQuery}%`);
          const fbRes = await request.query(`
            SELECT TOP 15 userid, fname, lname, position, position2, department, username 
            FROM vwUserinfo 
            WHERE fname LIKE @q OR lname LIKE @q OR username LIKE @q
            ORDER BY fname ASC, lname ASC
          `);
          if (fbRes && fbRes.recordset && fbRes.recordset.length > 0) {
            results = fbRes.recordset.map(row => {
              const pos1 = row.position ? String(row.position).trim() : '';
              const pos2 = row.position2 ? String(row.position2).trim() : '';
              const position = (pos1 + pos2) || pos1 || '';
              const fname = row.fname ? String(row.fname).trim() : '';
              const lname = row.lname ? String(row.lname).trim() : '';
              return {
                full_name: `${fname} ${lname}`.trim(),
                position,
                department: row.department ? String(row.department).trim() : '',
                username: row.username ? String(row.username).trim() : ''
              };
            }).filter(u => u.full_name);
          }
        } catch (_) {}
      }
    }

    // 2. Fallback to MySQL users table if SQL Server returned no results or is unavailable
    if (results.length === 0) {
      const [localUsers] = await db.execute(
        `SELECT full_name, department, dept_name, position, username 
         FROM users 
         WHERE full_name LIKE ? OR username LIKE ? 
         ORDER BY full_name ASC 
         LIMIT 15`,
        [`%${rawQuery}%`, `%${rawQuery}%`]
      );
      results = (localUsers || []).map(u => {
        const d1 = (u.department || '').trim();
        const d2 = (u.dept_name || '').trim();
        const displayDept = (d2 && d2 !== d1 && !d1.includes(d2)) ? `${d2} (${d1})` : d1;
        return {
          full_name: u.full_name,
          position: u.position || '',
          department: d1,
          sub_department: d2,
          dept_name: d2,
          display_department: displayDept,
          username: u.username || ''
        };
      });
    }

    res.json({ results });
  } catch (err) {
    console.error('PM search general error:', err);
    res.json({ results: [] });
  }
});

// ----- Update User Specialties API (Supports both PUT and POST for IIS compatibility) -----
const updateSpecialtiesHandler = async (req, res) => {
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
};
app.put('/api/users/specialties', requireAuth, updateSpecialtiesHandler);
app.post('/api/users/specialties', requireAuth, updateSpecialtiesHandler);

// ----- Conversations List API -----
app.get('/api/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [rows] = await db.execute(`
      SELECT
        c.id AS conversation_id,
        CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END AS other_user_id,
        u.full_name, u.department, u.dept_name, u.position, u.initials, u.avatar_color, u.is_online, u.last_seen,
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

    const convList = (rows || []).map(c => {
      const d1 = (c.department || '').trim();
      const d2 = (c.dept_name || '').trim();
      const formattedDept = (d2 && d2 !== d1 && !d1.includes(d2)) ? `${d2} (${d1})` : d1;
      return {
        ...c,
        department: formattedDept,
        parent_department: d1,
        sub_department: d2
      };
    });

    res.json({ conversations: convList });
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
    const userRole = req.session.user.role || 'staff';
    if (userRole !== 'it' && userRole !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะเจ้าหน้าที่ศูนย์คอมพิวเตอร์เท่านั้น' });
    }

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

// ============================================
// REPORT REQUESTS — Hospital Data Query & Report Ledger
// ============================================

// ----- List Report Requests (with optional filters) -----
app.get('/api/report-requests', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT r.*,
             u.full_name AS submitter_name,
             u.username AS requester_username, u.initials AS requester_initials, u.avatar_color AS requester_avatar_color,
             o.full_name AS owner_full_name, o.initials AS owner_initials, o.avatar_color AS owner_avatar_color, o.department AS owner_dept
      FROM report_requests r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN users o ON o.id = r.owner_id
      WHERE r.status != 'deleted'
      ORDER BY r.created_at DESC
    `);
    res.json({ requests: rows });
  } catch (err) {
    console.error('List report requests error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงรายการคำขอรายงานได้' });
  }
});

// Helper: Normalize incoming date strings (converts Buddhist Era years >= 2400 or DD/MM/YYYY to standard ISO YYYY-MM-DD)
function normalizeDateValue(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s) return null;

  // Match YYYY-MM-DD (with optional time HH:mm:ss)
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/);
  if (isoMatch) {
    let y = parseInt(isoMatch[1], 10);
    const m = String(isoMatch[2]).padStart(2, '0');
    const d = String(isoMatch[3]).padStart(2, '0');
    const timePart = isoMatch[4] ? ` ${isoMatch[4]}` : '';
    while (y >= 2400) y -= 543;
    return `${y}-${m}-${d}${timePart}`;
  }

  // Match DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmyMatch) {
    const d = String(dmyMatch[1]).padStart(2, '0');
    const m = String(dmyMatch[2]).padStart(2, '0');
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y = (y >= 40 ? 2500 + y : 2000 + y);
    while (y >= 2400) y -= 543;
    return `${y}-${m}-${d}`;
  }

  return s;
}

// ----- Create Report Request (Staff or IT submits a request) -----
app.post('/api/report-requests', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const {
      requester_name,
      requester_position,
      report_title,
      department,
      phone,
      purposes,
      purpose_other,
      frequency,
      frequency_other,
      details,
      delivery_channel,
      due_date,
      urgency,
      urgent_reason
    } = req.body;

    if (!requester_name || !requester_position || !report_title || !department || !phone || !details) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน' });
    }

    const urgencyStr = String(urgency || 'ปกติ ภายใน 10 วัน').trim().slice(0, 100);
    if (urgencyStr.includes('ด่วน') && (!urgent_reason || !String(urgent_reason).trim())) {
      return res.status(400).json({ error: 'กรุณาระบุเหตุผลในการขอด่วน' });
    }

    const purposesJson = Array.isArray(purposes) ? JSON.stringify(purposes) : (purposes || '[]');

    const [result] = await db.execute(
      `INSERT INTO report_requests (
        user_id, requester_name, requester_position, report_title, department, phone,
        purposes, purpose_other, frequency, frequency_other, details, delivery_channel,
        due_date, urgency, urgent_reason, status, percent_complete
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ยังไม่ดำเนินการ', 0)`,
      [
        userId,
        String(requester_name).trim().slice(0, 150),
        String(requester_position).trim().slice(0, 150),
        String(report_title).trim().slice(0, 300),
        String(department).trim().slice(0, 150),
        String(phone).trim().slice(0, 60),
        purposesJson,
        purpose_other ? String(purpose_other).trim().slice(0, 255) : null,
        String(frequency || 'ใช้ครั้งเดียว').trim().slice(0, 100),
        frequency_other ? String(frequency_other).trim().slice(0, 255) : null,
        String(details).trim().slice(0, 5000),
        delivery_channel ? String(delivery_channel).trim().slice(0, 255) : null,
        normalizeDateValue(due_date),
        urgencyStr,
        urgent_reason ? String(urgent_reason).trim().slice(0, 500) : null
      ]
    );

    const [inserted] = await db.execute(`
      SELECT r.*,
             u.full_name AS submitter_name,
             u.username AS requester_username, u.initials AS requester_initials, u.avatar_color AS requester_avatar_color
      FROM report_requests r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.id = ?
    `, [result.insertId]);

    const newReq = inserted[0];
    io.emit('new_report_request', newReq);

    res.json({ success: true, request: newReq });
  } catch (err) {
    console.error('Create report request error:', err);
    res.status(500).json({ error: 'ไม่สามารถบันทึกคำขอข้อมูลได้' });
  }
});

// ----- Claim / Accept Report Request (IT Staff claims ownership & opens chat) -----
app.post('/api/report-requests/:id/claim', requireAuth, async (req, res) => {
  try {
    const reqId = parseInt(req.params.id, 10);
    if (!Number.isFinite(reqId) || reqId <= 0) {
      return res.status(400).json({ error: 'รหัสคำขอไม่ถูกต้อง' });
    }
    const itUser = req.session.user;
    const userRole = itUser.role || 'staff';

    if (userRole !== 'it' && userRole !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะเจ้าหน้าที่ศูนย์คอมพิวเตอร์เท่านั้น' });
    }

    const [rows] = await db.execute('SELECT * FROM report_requests WHERE id = ?', [reqId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบรายการคำขอนี้' });
    }

    const reportReq = rows[0];
    if (reportReq.owner_id && reportReq.owner_id !== itUser.id && reportReq.status !== 'ยังไม่ดำเนินการ') {
      return res.status(409).json({
        error: `รายการนี้มีผู้รับผิดชอบแล้ว (${reportReq.owner_name || 'เจ้าหน้าที่ศูนย์คอมฯ'})`
      });
    }
    let conversationId = reportReq.conversation_id;

    // Create or link 1:1 conversation if requester is a different user
    if (reportReq.user_id && reportReq.user_id !== itUser.id) {
      const uid1 = Math.min(itUser.id, reportReq.user_id);
      const uid2 = Math.max(itUser.id, reportReq.user_id);

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

      // Send automated greeting into chat
      const greeting = `[รับงานขอรายงาน #REP-${String(reqId).padStart(4, '0')}] สวัสดีครับ/ค่ะ ${itUser.full_name} รับดำเนินการคิวรี่ข้อมูลเรื่อง "${reportReq.report_title}" แล้วครับ/ค่ะ หากต้องการส่งเงื่อนไขเพิ่มเติมแจ้งในแชทนี้ได้เลยครับ`;
      await db.execute(
        'INSERT INTO messages (conversation_id, sender_id, message_text, created_at) VALUES (?, ?, ?, NOW())',
        [conversationId, itUser.id, greeting]
      );
      await db.execute('UPDATE conversations SET last_message_at = NOW() WHERE id = ?', [conversationId]);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const startDate = reportReq.start_date || todayStr;
    const newStatus = reportReq.status === 'ยังไม่ดำเนินการ' ? 'กำลังดำเนินการ' : reportReq.status;
    const newPct = reportReq.percent_complete === 0 ? 25 : reportReq.percent_complete;

    await db.execute(
      `UPDATE report_requests
       SET owner_id = ?, owner_name = ?, status = ?, start_date = ?, accepted_at = COALESCE(accepted_at, NOW()), percent_complete = ?, conversation_id = ?
       WHERE id = ?`,
      [itUser.id, itUser.full_name, newStatus, startDate, newPct, conversationId || null, reqId]
    );

    const [updatedRows] = await db.execute(`
      SELECT r.*,
             u.full_name AS submitter_name,
             u.username AS requester_username, u.initials AS requester_initials, u.avatar_color AS requester_avatar_color,
             o.full_name AS owner_full_name, o.initials AS owner_initials, o.avatar_color AS owner_avatar_color
      FROM report_requests r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN users o ON o.id = r.owner_id
      WHERE r.id = ?
    `, [reqId]);

    const updated = updatedRows[0];
    io.emit('report_request_updated', updated);

    res.json({ success: true, request: updated, conversation_id: conversationId });
  } catch (err) {
    console.error('Claim report request error:', err);
    res.status(500).json({ error: 'ไม่สามารถรับงานขอข้อมูลได้' });
  }
});

// ----- Update Report Request IT Fields / Close Job Log (IT/Admin) (Supports PUT & POST for IIS) -----
const updateReportRequestHandler = async (req, res) => {
  try {
    const reqId = parseInt(req.params.id);
    const itUser = req.session.user;
    const userRole = itUser.role || 'staff';

    if (userRole !== 'it' && userRole !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะเจ้าหน้าที่ศูนย์คอมพิวเตอร์เท่านั้นที่อัปเดตสถานะได้' });
    }

    const {
      status,
      owner_id,
      owner_name,
      start_date,
      completed_date,
      percent_complete,
      it_notes
    } = req.body;

    const [rows] = await db.execute('SELECT * FROM report_requests WHERE id = ?', [reqId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบรายการคำขอนี้' });
    }

    const current = rows[0];
    let finalPct = percent_complete !== undefined ? parseInt(percent_complete) : current.percent_complete;
    if (isNaN(finalPct)) finalPct = 0;
    finalPct = Math.max(0, Math.min(100, finalPct));

    let finalStatus = status || current.status;
    let finalCompletedDate = completed_date !== undefined ? normalizeDateValue(completed_date) : current.completed_date;
    let finalStartDate = start_date !== undefined ? normalizeDateValue(start_date) : current.start_date;

    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const nowTimeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    const nowDateTimeStr = `${todayStr} ${nowTimeStr}`;

    if (finalStatus === 'เสร็จ' || finalStatus === 'เสร็จสิ้น' || finalPct === 100) {
      finalStatus = 'เสร็จ';
      finalPct = 100;
      if (!finalStartDate) finalStartDate = todayStr;

      if (!finalCompletedDate) {
        finalCompletedDate = nowDateTimeStr;
      } else if (typeof finalCompletedDate === 'string' && finalCompletedDate.trim().length === 10) {
        const pickedDate = finalCompletedDate.trim();
        // If already completed on the same date with a recorded time, preserve that time; otherwise attach current time
        const prevComp = current.completed_date ? new Date(current.completed_date) : null;
        if (prevComp && !isNaN(prevComp.getTime())) {
          const prevDateStr = `${prevComp.getFullYear()}-${pad2(prevComp.getMonth() + 1)}-${pad2(prevComp.getDate())}`;
          const prevTimeStr = `${pad2(prevComp.getHours())}:${pad2(prevComp.getMinutes())}:${pad2(prevComp.getSeconds())}`;
          if (prevDateStr === pickedDate && prevTimeStr !== '00:00:00') {
            finalCompletedDate = `${pickedDate} ${prevTimeStr}`;
          } else {
            finalCompletedDate = `${pickedDate} ${nowTimeStr}`;
          }
        } else {
          finalCompletedDate = `${pickedDate} ${nowTimeStr}`;
        }
      }
    }

    const finalOwnerId = owner_id !== undefined ? (owner_id || null) : (current.owner_id || itUser.id);
    const finalOwnerName = owner_name !== undefined ? owner_name : (current.owner_name || itUser.full_name);

    let finalAcceptedAt = current.accepted_at;
    if (!finalAcceptedAt && (finalOwnerId || (finalStatus && finalStatus !== 'ยังไม่ดำเนินการ'))) {
      finalAcceptedAt = `${todayStr} ${nowTimeStr}`;
    }

    await db.execute(
      `UPDATE report_requests
       SET status = ?, owner_id = ?, owner_name = ?, start_date = ?, accepted_at = ?, completed_date = ?, percent_complete = ?, it_notes = ?
       WHERE id = ?`,
      [
        finalStatus,
        finalOwnerId,
        finalOwnerName,
        finalStartDate,
        finalAcceptedAt,
        finalCompletedDate,
        finalPct,
        it_notes !== undefined ? it_notes : current.it_notes,
        reqId
      ]
    );

    const [updatedRows] = await db.execute(`
      SELECT r.*,
             u.full_name AS submitter_name,
             u.username AS requester_username, u.initials AS requester_initials, u.avatar_color AS requester_avatar_color,
             o.full_name AS owner_full_name, o.initials AS owner_initials, o.avatar_color AS owner_avatar_color
      FROM report_requests r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN users o ON o.id = r.owner_id
      WHERE r.id = ?
    `, [reqId]);

    const updated = updatedRows[0];
    io.emit('report_request_updated', updated);

    res.json({ success: true, request: updated });
  } catch (err) {
    console.error('Update report request error:', err);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะรายงานได้' });
  }
};
app.put('/api/report-requests/:id', requireAuth, updateReportRequestHandler);
app.post('/api/report-requests/:id', requireAuth, updateReportRequestHandler);

// ----- Requester Edit Report Request (Owner can edit while pending or in-progress) (Supports PUT & POST for IIS) -----
const requesterEditHandler = async (req, res) => {
  try {
    const reqId = parseInt(req.params.id, 10);
    if (!Number.isFinite(reqId) || reqId <= 0) {
      return res.status(400).json({ error: 'รหัสคำขอไม่ถูกต้อง' });
    }

    const currentUser = req.session.user;
    const userId = currentUser.id;
    const userRole = currentUser.role || 'staff';

    const [rows] = await db.execute('SELECT * FROM report_requests WHERE id = ?', [reqId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบรายการคำขอนี้' });
    }

    const existing = rows[0];
    if (existing.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'เฉพาะผู้ยื่นคำขอเท่านั้นที่สามารถแก้ไขใบคำขอนี้ได้' });
    }

    if (existing.status === 'เสร็จ' || existing.status === 'เสร็จสิ้น') {
      return res.status(400).json({ error: 'ไม่สามารถแก้ไขคำขอที่ดำเนินการเสร็จสิ้นแล้วได้' });
    }

    const {
      requester_name,
      requester_position,
      report_title,
      department,
      phone,
      purposes,
      purpose_other,
      frequency,
      frequency_other,
      details,
      delivery_channel,
      due_date,
      urgency,
      urgent_reason
    } = req.body;

    if (!requester_name || !requester_position || !report_title || !department || !phone || !details) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน' });
    }

    const urgencyStr = String(urgency || 'ปกติ ภายใน 10 วัน').trim().slice(0, 100);
    if (urgencyStr.includes('ด่วน') && (!urgent_reason || !String(urgent_reason).trim())) {
      return res.status(400).json({ error: 'กรุณาระบุเหตุผลในการขอด่วน' });
    }

    const cleanName = String(requester_name).trim().slice(0, 150);
    const cleanPos = String(requester_position).trim().slice(0, 150);
    const cleanTitle = String(report_title).trim().slice(0, 300);
    const cleanDept = String(department).trim().slice(0, 150);
    const cleanPhone = String(phone).trim().slice(0, 60);
    const purposesJson = Array.isArray(purposes) ? JSON.stringify(purposes) : (purposes || '[]');
    const cleanPurposeOther = purpose_other ? String(purpose_other).trim().slice(0, 255) : null;
    const cleanFreq = String(frequency || 'ใช้ครั้งเดียว').trim().slice(0, 100);
    const cleanFreqOther = frequency_other ? String(frequency_other).trim().slice(0, 255) : null;
    const cleanDetails = String(details).trim().slice(0, 5000);
    const cleanChannel = delivery_channel ? String(delivery_channel).trim().slice(0, 255) : null;
    const cleanDueDate = normalizeDateValue(due_date);
    const cleanUrgentReason = urgent_reason ? String(urgent_reason).trim().slice(0, 500) : null;

    // Detect changed fields for automatic chat notification
    const changedFields = [];
    if (cleanTitle !== (existing.report_title || '')) changedFields.push('ชื่องาน');
    if (cleanDetails !== (existing.details || '')) changedFields.push('รายละเอียดเงื่อนไข');
    if ((cleanChannel || '') !== (existing.delivery_channel || '')) changedFields.push('ช่องทางรับข้อมูล');
    const existingDueStr = existing.due_date ? new Date(existing.due_date).toISOString().slice(0, 10) : null;
    if (cleanDueDate !== existingDueStr) changedFields.push('วันที่ต้องการใช้ข้อมูล');
    if (urgencyStr !== (existing.urgency || '')) changedFields.push('ความเร่งด่วน');
    if (cleanFreq !== (existing.frequency || '') || (cleanFreqOther || '') !== (existing.frequency_other || '')) changedFields.push('ความถี่');
    if (cleanPhone !== (existing.phone || '') || cleanName !== (existing.requester_name || '') || cleanDept !== (existing.department || '')) changedFields.push('ข้อมูลผู้ขอ/เบอร์ติดต่อ');

    await db.execute(
      `UPDATE report_requests
       SET requester_name = ?, requester_position = ?, report_title = ?, department = ?, phone = ?,
           purposes = ?, purpose_other = ?, frequency = ?, frequency_other = ?, details = ?,
           delivery_channel = ?, due_date = ?, urgency = ?, urgent_reason = ?
       WHERE id = ?`,
      [
        cleanName,
        cleanPos,
        cleanTitle,
        cleanDept,
        cleanPhone,
        purposesJson,
        cleanPurposeOther,
        cleanFreq,
        cleanFreqOther,
        cleanDetails,
        cleanChannel,
        cleanDueDate,
        urgencyStr,
        cleanUrgentReason,
        reqId
      ]
    );

    let notifiedOwner = false;
    // If an IT officer has already claimed this request, notify them automatically in 1:1 chat
    if (existing.owner_id && existing.owner_id !== userId) {
      const uid1 = Math.min(userId, existing.owner_id);
      const uid2 = Math.max(userId, existing.owner_id);

      let conversationId = existing.conversation_id;
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
        await db.execute('UPDATE report_requests SET conversation_id = ? WHERE id = ?', [conversationId, reqId]);
      }

      const changeSummaryText = changedFields.length > 0
        ? ` (แก้ไข: ${changedFields.join(', ')})`
        : '';
      const notifyText = `[แก้ไขใบคำขอ #REP-${String(reqId).padStart(4, '0')}] ผู้ขอ (${cleanName}) ได้แก้ไขข้อมูลใบคำขอเรื่อง "${cleanTitle}"${changeSummaryText} กรุณาตรวจสอบรายละเอียดล่าสุดในใบคำขอครับ/ค่ะ`;

      const [msgResult] = await db.execute(
        'INSERT INTO messages (conversation_id, sender_id, message_text, created_at) VALUES (?, ?, ?, NOW())',
        [conversationId, userId, notifyText]
      );
      await db.execute('UPDATE conversations SET last_message_at = NOW() WHERE id = ?', [conversationId]);

      const messageData = {
        id: msgResult.insertId,
        conversation_id: conversationId,
        sender_id: userId,
        sender_name: currentUser.full_name,
        sender_initials: currentUser.initials,
        sender_color: currentUser.avatar_color,
        message_text: notifyText,
        file_url: null,
        file_name: null,
        file_size: null,
        file_type: null,
        is_read: 0,
        created_at: new Date().toISOString()
      };

      const ownerSockets = onlineUsers.get(existing.owner_id);
      if (ownerSockets) {
        ownerSockets.forEach(sid => {
          io.to(sid).emit('new_message', messageData);
        });
      }
      const senderSockets = onlineUsers.get(userId);
      if (senderSockets) {
        senderSockets.forEach(sid => {
          io.to(sid).emit('message_sent', messageData);
        });
      }
      notifiedOwner = true;
    }

    const [updatedRows] = await db.execute(`
      SELECT r.*,
             u.full_name AS submitter_name,
             u.username AS requester_username, u.initials AS requester_initials, u.avatar_color AS requester_avatar_color,
             o.full_name AS owner_full_name, o.initials AS owner_initials, o.avatar_color AS owner_avatar_color
      FROM report_requests r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN users o ON o.id = r.owner_id
      WHERE r.id = ?
    `, [reqId]);

    const updated = updatedRows[0];
    io.emit('report_request_updated', updated);

    res.json({ success: true, request: updated, notified_owner: notifiedOwner });
  } catch (err) {
    console.error('Requester edit report request error:', err);
    res.status(500).json({ error: 'ไม่สามารถบันทึกการแก้ไขคำขอข้อมูลได้' });
  }
};
app.put('/api/report-requests/:id/requester-edit', requireAuth, requesterEditHandler);
app.post('/api/report-requests/:id/requester-edit', requireAuth, requesterEditHandler);



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

      // Security: Validate user is an actual participant of this conversation
      const [conv] = await db.execute(
        'SELECT user1_id, user2_id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
        [conversation_id, user.id, user.id]
      );

      if (conv.length === 0) {
        socket.emit('message_error', { error: 'คุณไม่มีสิทธิ์ส่งข้อความในห้องแชทนี้' });
        return;
      }

      const otherUserId = conv[0].user1_id === user.id ? conv[0].user2_id : conv[0].user1_id;

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
  socket.on('typing_start', async (data) => {
    try {
      const { conversation_id, to_user_id } = data;
      // Security: Validate user is in conversation with to_user_id
      const [conv] = await db.execute(
        'SELECT user1_id, user2_id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
        [conversation_id, user.id, user.id]
      );
      if (conv.length === 0) return;
      const expectedOther = conv[0].user1_id === user.id ? conv[0].user2_id : conv[0].user1_id;
      if (parseInt(to_user_id, 10) !== expectedOther) return;

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
    } catch (err) {}
  });

  socket.on('typing_stop', async (data) => {
    try {
      const { conversation_id, to_user_id } = data;
      // Security: Validate user is in conversation with to_user_id
      const [conv] = await db.execute(
        'SELECT user1_id, user2_id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
        [conversation_id, user.id, user.id]
      );
      if (conv.length === 0) return;
      const expectedOther = conv[0].user1_id === user.id ? conv[0].user2_id : conv[0].user1_id;
      if (parseInt(to_user_id, 10) !== expectedOther) return;

      const recipientSockets = onlineUsers.get(to_user_id);
      if (recipientSockets) {
        recipientSockets.forEach(sid => {
          io.to(sid).emit('typing_stop', {
            conversation_id,
            user_id: user.id
          });
        });
      }
    } catch (err) {}
  });

  // ---------- Mark Read ----------
  socket.on('mark_read', async (data) => {
    try {
      const { conversation_id } = data;

      // Security: Validate user belongs to this conversation before marking as read
      const [conv] = await db.execute(
        'SELECT user1_id, user2_id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
        [conversation_id, user.id, user.id]
      );
      if (conv.length === 0) return;

      await db.execute(
        'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0',
        [conversation_id, user.id]
      );

      // Notify sender their messages were read
      const otherUserId = conv[0].user1_id === user.id ? conv[0].user2_id : conv[0].user1_id;
      const recipientSockets = onlineUsers.get(otherUserId);
      if (recipientSockets) {
        recipientSockets.forEach(sid => {
          io.to(sid).emit('messages_read', { conversation_id, read_by: user.id });
        });
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
// Function to handle database startup resets & migrations
async function onServerStartup() {
  try {
    // Reset all users to offline on server startup (since all sockets are disconnected on startup)
    await db.execute('UPDATE users SET is_online = 0');
    console.log('🔄 Offline status reset for all users on startup.');

    // Auto-create report_requests table if it doesn't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS report_requests (
        id                 INT AUTO_INCREMENT PRIMARY KEY,
        user_id            INT NOT NULL,
        requester_name     VARCHAR(150) NOT NULL,
        requester_position VARCHAR(150) NOT NULL,
        report_title       VARCHAR(255) NOT NULL,
        department         VARCHAR(150) NOT NULL,
        phone              VARCHAR(100) NOT NULL,
        purposes           TEXT,
        purpose_other      VARCHAR(255) DEFAULT NULL,
        frequency          VARCHAR(100) NOT NULL,
        frequency_other    VARCHAR(255) DEFAULT NULL,
        details            TEXT NOT NULL,
        delivery_channel   VARCHAR(255) DEFAULT NULL,
        due_date           DATE DEFAULT NULL,
        urgency            VARCHAR(100) DEFAULT 'ปกติ ภายใน 10 วัน',
        urgent_reason      VARCHAR(255) DEFAULT NULL,
        status             VARCHAR(50) DEFAULT 'ยังไม่ดำเนินการ',
        owner_id           INT DEFAULT NULL,
        owner_name         VARCHAR(150) DEFAULT NULL,
        start_date         DATE DEFAULT NULL,
        accepted_at        DATETIME DEFAULT NULL,
        completed_date     DATETIME DEFAULT NULL,
        percent_complete   INT DEFAULT 0,
        it_notes           TEXT DEFAULT NULL,
        conversation_id    INT DEFAULT NULL,
        created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    try {
      await db.execute("ALTER TABLE report_requests ADD COLUMN accepted_at DATETIME DEFAULT NULL AFTER start_date");
    } catch (e) {
      // Column already exists
    }
    await db.execute("ALTER TABLE report_requests MODIFY COLUMN completed_date DATETIME DEFAULT NULL");
    console.log('📊 report_requests table verified/ready.');
    await db.execute("UPDATE report_requests SET status = 'เสร็จ' WHERE status = 'เสร็จสิ้น'");
    // Auto-heal dates where user typed Buddhist Era year (e.g. 2569) into native browser date input
    await db.execute("UPDATE report_requests SET due_date = DATE_SUB(due_date, INTERVAL 543 YEAR) WHERE due_date IS NOT NULL AND YEAR(due_date) >= 2400");
    await db.execute("UPDATE report_requests SET start_date = DATE_SUB(start_date, INTERVAL 543 YEAR) WHERE start_date IS NOT NULL AND YEAR(start_date) >= 2400");
    await db.execute("UPDATE report_requests SET completed_date = DATE_SUB(completed_date, INTERVAL 543 YEAR) WHERE completed_date IS NOT NULL AND YEAR(completed_date) >= 2400");
    try {
      await db.execute("ALTER TABLE users MODIFY COLUMN department VARCHAR(150) NOT NULL");
      await db.execute("ALTER TABLE users ADD COLUMN position VARCHAR(150) NULL AFTER department");
      await db.execute("ALTER TABLE users ADD COLUMN dept_name VARCHAR(150) NULL AFTER department");
      console.log('👤 users table schema (department, dept_name, position) verified/ready.');
    } catch (e) {
      // Column already exists, safe to ignore
    }
  } catch (err) {
    console.error('❌ Failed to run startup DB tasks:', err.message);
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

