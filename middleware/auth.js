// ============================================
// BRH Chat — Auth Middleware
// ============================================

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
}

module.exports = { requireAuth };
