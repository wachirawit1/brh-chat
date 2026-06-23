// ============================================
// BRH Chat — File Upload Routes
// ============================================
const express = require('express');
const multer = require('multer');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const fs = require('fs');

// Max file size from env (default 25 MB)
const maxSize = (parseInt(process.env.MAX_FILE_SIZE_MB) || 25) * 1024 * 1024;

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'others';
    if (file.mimetype.startsWith('image/')) {
      folder = 'images';
    } else if (file.mimetype.startsWith('video/')) {
      folder = 'videos';
    } else if (file.mimetype.startsWith('audio/')) {
      folder = 'audio';
    } else if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet') || file.mimetype === 'text/csv' || file.mimetype.includes('document')) {
      folder = 'documents';
    }
    
    const dir = path.join(__dirname, '..', 'public', 'uploads', folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    req.uploadSubFolder = folder;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    cb(null, unique + ext);
  }
});

// File filter — images, videos, audio & documents only
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/m4a',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ];
  if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('ประเภทไฟล์ไม่รองรับ — รองรับเฉพาะรูปภาพ, วิดีโอ, เสียง และไฟล์ Excel/CSV'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter
});

// ---------- Upload Endpoint ----------
router.post('/', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: `ไฟล์มีขนาดเกิน ${process.env.MAX_FILE_SIZE_MB || 25} MB`
        });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'ไม่พบไฟล์ที่อัพโหลด' });
    }

    // Determine media type
    let mediaType = 'file';
    if (req.file.mimetype.startsWith('video/')) {
      mediaType = 'video';
    } else if (req.file.mimetype.startsWith('image/')) {
      mediaType = 'image';
    } else if (req.file.mimetype.startsWith('audio/')) {
      mediaType = 'audio';
    }

    // Decode originalname from Latin1 to UTF-8 to fix Thai characters encoding
    let originalName = req.file.originalname;
    try {
      originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    } catch (err) {
      console.error('Failed to decode filename:', err);
    }

    return res.json({
      success: true,
      path: `/uploads/${req.uploadSubFolder}/${req.file.filename}`,
      type: mediaType,
      originalName: originalName,
      size: req.file.size
    });
  });
});

module.exports = router;
