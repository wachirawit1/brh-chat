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
      const localPasswordHash = passwordHash.toLowerCase(); // MySQL stores lower-case MD5 hash

      // 1. Query PM Database (SQL Server with Detailed Sub-Department)
      let pmUser = null;
      let pmUsernameExists = false;
      try {
        const request = mssqlPool.request();
        request.input('username', uppercaseUsername);
        
        let result;
        try {
          result = await request.query(`
            SELECT * FROM OPENQUERY(MYSQL_PM, '
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
                  u.birthday,
                  u.mail,
                  u.username,
                  u.password
              FROM hr_work_experience w
              JOIN erp_user_profile u ON u.user_id = w.user_id 
              LEFT JOIN hr_titlename t ON t.tname_id = u.tname_id
              LEFT JOIN hr_position_level2 p2 ON p2.position_level2_id = w.position_level2_id
              LEFT JOIN hr_position_level3 p3 ON p3.position_level3_id = w.position_level3_id
              LEFT JOIN hr_dept d ON d.dept_id = w.parent_dept_id
              LEFT JOIN hr_dept d2 ON d2.dept_id = w.dept_id
              WHERE w.position_active = ''Y''
            ') WHERE UPPER(RTRIM(LTRIM(username))) = @username
          `);
        } catch (detailErr) {
          console.error('Detailed PM query error, falling back to vwUserinfo:', detailErr.message);
          result = await request.query(
            'SELECT userid, fname, lname, position, position2, department, username, password FROM vwUserinfo WHERE UPPER(RTRIM(LTRIM(username))) = @username'
          );
        }

        if (result && result.recordset && result.recordset.length > 0) {
          pmUsernameExists = true;
          const matched = result.recordset.find(
            row => row.password && String(row.password).trim().toUpperCase() === passwordHash
          );
          if (matched) {
            pmUser = matched;
          }
        }
      } catch (sqlErr) {
        console.error('SQL Server Query Error, checking local fallback:', sqlErr.message);
      }

      let finalUser = null;

      if (pmUser) {
        // Authenticated successfully via SQL Server! Now Sync with Local MySQL users table (including latest password_md5)
        const fullName = `${pmUser.fname.trim()} ${pmUser.lname.trim()}`;
        const parentDept = pmUser.department ? pmUser.department.trim() : 'ไม่ระบุแผนก';
        const subDept = pmUser.dept_name ? pmUser.dept_name.trim() : null;
        let finalDept = parentDept;
        if (subDept && subDept !== parentDept && !parentDept.includes(subDept)) {
          finalDept = `${subDept} (${parentDept})`;
        }
        const cleanUsername = pmUser.username.trim();

        // Combine position + position2 (e.g. "นายแพทย์" + "ชำนาญการ" = "นายแพทย์ชำนาญการ")
        const pos1 = pmUser.position ? String(pmUser.position).trim() : '';
        const pos2 = pmUser.position2 ? String(pmUser.position2).trim() : '';
        const userPosition = (pos1 + pos2) || pos1 || null;

        // Auto-detect IT role based on department keywords (checking both parentDept and subDept)
        const detectedRole = (isITDepartment(parentDept) || (subDept && isITDepartment(subDept))) ? 'it' : 'staff';

        // Check if user exists in local MySQL database
        const [existing] = await db.execute(
          'SELECT id, username, full_name, department, dept_name, position, initials, avatar_color, role, specialties FROM users WHERE username = ?',
          [cleanUsername]
        );

        if (existing.length > 0) {
          // User exists: sync latest password_md5, department, dept_name, position, and name from PM, and set online
          const user = existing[0];
          const newRole = (user.role === 'staff' && detectedRole === 'it') ? 'it' : user.role;
          const finalPos = userPosition || user.position || null;

          await db.execute(
            'UPDATE users SET password_md5 = ?, full_name = ?, department = ?, dept_name = ?, position = ?, role = ?, is_online = 1, last_seen = NOW() WHERE id = ?',
            [localPasswordHash, fullName, parentDept, subDept, finalPos, newRole, user.id]
          );
          finalUser = {
            id: user.id,
            username: cleanUsername,
            full_name: fullName,
            department: finalDept,
            dept_name: subDept,
            sub_department: subDept,
            position: finalPos || '',
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
            `INSERT INTO users (username, password_md5, full_name, department, dept_name, position, initials, avatar_color, role, is_online, last_seen) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
            [cleanUsername, localPasswordHash, fullName, parentDept, subDept, userPosition, initials, avatarColor, detectedRole]
          );
          
          finalUser = {
            id: insertResult.insertId,
            username: cleanUsername,
            full_name: fullName,
            department: finalDept,
            dept_name: subDept,
            sub_department: subDept,
            position: userPosition || '',
            initials: initials,
            avatar_color: avatarColor,
            role: detectedRole,
            specialties: null
          };
        }
      } else {
        // If username exists in PM but password did NOT match PM, reject immediately (do not allow old local password!)
        if (pmUsernameExists) {
          return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        // 2. Fallback to Local MySQL users table (for local test users or when SQL Server is unreachable)
        const [rows] = await db.execute(
          'SELECT id, username, full_name, department, dept_name, position, initials, avatar_color, role, specialties FROM users WHERE UPPER(username) = ? AND LOWER(password_md5) = ?',
          [uppercaseUsername, localPasswordHash]
        );

        if (rows.length === 0) {
          return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        const user = rows[0];
        await db.execute('UPDATE users SET is_online = 1, last_seen = NOW() WHERE id = ?', [user.id]);
        
        const d1 = (user.department || '').trim();
        const d2 = (user.dept_name || '').trim();
        const fallbackDept = (d2 && d2 !== d1 && !d1.includes(d2)) ? `${d2} (${d1})` : d1;

        finalUser = {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          department: fallbackDept,
          dept_name: d2,
          sub_department: d2,
          position: user.position || '',
          initials: user.initials,
          avatar_color: user.avatar_color,
          role: user.role || 'staff',
          specialties: user.specialties
        };
      }

      // Regenerate session to prevent session fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regenerate error:', err);
          return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างเซสชัน' });
        }
        req.session.user = finalUser;
        return res.json({ success: true, user: finalUser });
      });
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
