const express = require('express');
const router = express.Router();
const { requireAdmin, authenticate } = require('../middleware/auth');
const { uploadCover, uploadEbook, uploadUserPhoto, uploadStudentPhoto } = require('../middleware/upload');

// Upload routes
router.post('/cover', requireAdmin, uploadCover, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    path: `/uploads/covers/${req.file.filename}`
  });
});

router.post('/ebook', requireAdmin, uploadEbook, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    path: `/uploads/ebooks/${req.file.filename}`
  });
});

router.post('/user-photo', requireAdmin, uploadUserPhoto, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    path: `/uploads/users/${req.file.filename}`
  });
});

router.post('/student-photo', authenticate, uploadStudentPhoto, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    path: `/uploads/student_photos/${req.file.filename}`
  });
});

router.post('/payment-proof', authenticate, require('../middleware/upload').uploadPaymentProof, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    path: `/uploads/payment_proofs/${req.file.filename}`
  });
});

module.exports = router;
