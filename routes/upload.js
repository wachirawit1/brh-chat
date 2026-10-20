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
    const ext = path.extname(file.originalname).toLowerCase();
    const docExts = ['.xlsx', '.xls', '.csv', '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.zip', '.rar', '.7z', '.txt'];

    if (file.mimetype.startsWith('image/')) {
      folder = 'images';
    } else if (file.mimetype.startsWith('video/')) {
      folder = 'videos';
    } else if (file.mimetype.startsWith('audio/')) {
      folder = 'audio';
    } else if (docExts.includes(ext) || file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet') || file.mimetype === 'text/csv' || file.mimetype === 'application/pdf' || file.mimetype.includes('word') || file.mimetype.includes('presentation') || file.mimetype.includes('zip')) {
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

// File filter — images, videos, audio & documents
const fileFilter = (req, file, cb) => {
  const allowedExts = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.mp4', '.webm', '.mov',
    '.webm', '.ogg', '.mp3', '.wav', '.m4a',
    '.xlsx', '.xls', '.csv',
    '.pdf',
    '.docx', '.doc',
    '.pptx', '.ppt',
    '.zip', '.rar', '.7z',
    '.txt'
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype.startsWith('video/') ||
    file.mimetype.startsWith('audio/') ||
    file.mimetype === 'application/pdf' ||
    file.mimetype.includes('excel') ||
    file.mimetype.includes('spreadsheet') ||
    file.mimetype === 'text/csv' ||
    file.mimetype.includes('word') ||
    file.mimetype.includes('presentation') ||
    file.mimetype.includes('zip') ||
    file.mimetype === 'text/plain' ||
    allowedExts.includes(ext)
  ) {
    cb(null, true);
  } else {
    cb(new Error('ประเภทไฟล์ไม่รองรับ — รองรับรูปภาพ, วิดีโอ, เสียง, Excel, PDF, Word, PowerPoint, ZIP และ Text'), false);
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
    if (!/[ก-๙]/.test(originalName)) {
      try {
        const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
        if (/[ก-๙]/.test(decoded) || (!/[ÃÂ]/.test(decoded) && decoded.length < originalName.length)) {
          originalName = decoded;
        }
      } catch (err) {
        console.error('Failed to decode filename:', err);
      }
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

// ---------- Download Endpoint (Preserves Original Filename with UTF-8 Content-Disposition) ----------
router.get('/download', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).send('กรุณาเข้าสู่ระบบก่อนดาวน์โหลดไฟล์');
  }

  const fileRel = req.query.file;
  let fileName = req.query.name;

  if (!fileRel) {
    return res.status(400).send('Missing file parameter');
  }

  // Normalize path and prevent directory traversal outside public/uploads
  const cleanPath = path.normalize(fileRel).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(__dirname, '..', 'public', cleanPath);
  const uploadsRoot = path.join(__dirname, '..', 'public', 'uploads');

  if (!fullPath.startsWith(uploadsRoot) || !fs.existsSync(fullPath)) {
    return res.status(404).send('File not found');
  }

  if (!fileName) {
    fileName = path.basename(fullPath);
  }

  // Ensure file extension matches the stored file
  const ext = path.extname(fullPath);
  if (ext && !fileName.toLowerCase().endsWith(ext.toLowerCase())) {
    fileName += ext;
  }

  // res.download automatically formats Content-Disposition header with RFC 5987 UTF-8 encoding
  res.download(fullPath, fileName, (err) => {
    if (err && !res.headersSent) {
      console.error('Download error:', err);
      res.status(500).send('Error downloading file');
    }
  });
});

module.exports = router;
