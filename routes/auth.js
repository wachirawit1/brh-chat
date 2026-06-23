// ============================================
// BRH Chat — Auth Routes
// ============================================
const express = require('express');
const md5 = require('md5');
const router = express.Router();

module.exports = function (db, mssqlPool) {

  // Keywords to auto-detect IT department from PM database
  const IT_DEPARTMENT_KEYWORDS = ['ศูนย์คอมพิวเตอร์', 'สารสนเทศ', 'ไอที', 'IT'];

  function isITDepartment(department) {
    if (!department) return false;
    const dept = department.trim().toLowerCase();
    return IT_DEPARTMENT_KEYWORDS.some(kw => dept.includes(kw.toLowerCase()));
  }

  // Helper to generate initials (e.g. "Somsri" -> "S", "Somsri Raksa" -> "SR")
  function getInitials(name) {
    if (!name) return '??';
    const clean = name.trim().replace(/\s+/g, ' ');
    const parts = clean.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return clean.substring(0, 2).toUpperCase();
  }

  // Helper to get random soft pastel color for avatar
  function getRandomColor() {
    const colors = [
      '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
      '#5a5c69', '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // ---------- Login ----------
  router.post('/login', async (req, res) => {
    try {
      let { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'กรุณากรอก username และ password' });
      }

      // Convert username to UPPERCASE as stored in PM database view
      const uppercaseUsername = username.trim().toUpperCase();
      const passwordHash = md5(password).toUpperCase(); // SQL Server stores upper-case MD5 hash

      // 1. Query PM Database (SQL Server vwUserinfo)
      let pmUser = null;
      try {
        const request = mssqlPool.request();
        request.input('username', uppercaseUsername);
        request.input('password', passwordHash);
        
        const result = await request.query(
          'SELECT userid, fname, lname, department, username, password FROM vwUserinfo WHERE UPPER(RTRIM(LTRIM(username))) = @username AND UPPER(password) = @password'
        );

        if (result.recordset.length > 0) {
          pmUser = result.recordset[0];
        }
      } catch (sqlErr) {
        console.error('SQL Server Query Error, checking local fallback:', sqlErr.message);
      }

      let finalUser = null;

      if (pmUser) {
        // Authenticated successfully via SQL Server! Now Sync with Local MySQL users table
        const fullName = `${pmUser.fname.trim()} ${pmUser.lname.trim()}`;
        const department = pmUser.department ? pmUser.department.trim() : 'ไม่ระบุแผนก';
        const cleanUsername = pmUser.username.trim();

        // Auto-detect IT role based on department keywords
        const detectedRole = isITDepartment(department) ? 'it' : 'staff';

        // Check if user exists in local MySQL database
        const [existing] = await db.execute(
          'SELECT id, username, full_name, department, initials, avatar_color, role, specialties FROM users WHERE username = ?',
          [cleanUsername]
        );

        if (existing.length > 0) {
          // User exists, update department and name if changed, and set online
          const user = existing[0];
          // Only auto-update role if it was 'staff' and now detected as 'it' (don't downgrade admin/it set manually)
          const newRole = (user.role === 'staff' && detectedRole === 'it') ? 'it' : user.role;
          await db.execute(
            'UPDATE users SET full_name = ?, department = ?, role = ?, is_online = 1, last_seen = NOW() WHERE id = ?',
            [fullName, department, newRole, user.id]
          );
          finalUser = {
            id: user.id,
            username: cleanUsername,
            full_name: fullName,
            department: department,
            initials: user.initials,
            avatar_color: user.avatar_color,
            role: newRole,
            specialties: user.specialties
          };
        } else {
          // New user, create them in local database
          const initials = getInitials(fullName);
          const avatarColor = getRandomColor();
          
          const [insertResult] = await db.execute(
            `INSERT INTO users (username, password_md5, full_name, department, initials, avatar_color, role, is_online, last_seen) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
            [cleanUsername, passwordHash, fullName, department, initials, avatarColor, detectedRole]
          );
          
          finalUser = {
            id: insertResult.insertId,
            username: cleanUsername,
            full_name: fullName,
            department: department,
            initials: initials,
            avatar_color: avatarColor,
            role: detectedRole,
            specialties: null
          };
        }
      } else {
        // 2. Fallback to Local MySQL users table (for test users or local admin if SQL Server is unreachable)
        const [rows] = await db.execute(
          'SELECT id, username, full_name, department, initials, avatar_color, role, specialties FROM users WHERE UPPER(username) = ? AND password_md5 = ?',
          [uppercaseUsername, passwordHash.toLowerCase()] // MySQL stores lower-case MD5
        );

        if (rows.length === 0) {
          return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        const user = rows[0];
        await db.execute('UPDATE users SET is_online = 1, last_seen = NOW() WHERE id = ?', [user.id]);
        
        finalUser = {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          department: user.department,
          initials: user.initials,
          avatar_color: user.avatar_color,
          role: user.role || 'staff',
          specialties: user.specialties
        };
      }

      // Store user in Express Session
      req.session.user = finalUser;

      return res.json({ success: true, user: finalUser });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
    }
  });

  // ---------- Get Current User ----------
  router.get('/me', (req, res) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'ไม่ได้เข้าสู่ระบบ' });
    }
    return res.json({ user: req.session.user });
  });

  // ---------- Logout ----------
  router.post('/logout', async (req, res) => {
    try {
      if (req.session && req.session.user) {
        await db.execute('UPDATE users SET is_online = 0, last_seen = NOW() WHERE id = ?', [req.session.user.id]);
      }
      req.session.destroy(() => {
        res.json({ success: true });
      });
    } catch (err) {
      console.error('Logout error:', err);
      res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
  });

  return router;
};
