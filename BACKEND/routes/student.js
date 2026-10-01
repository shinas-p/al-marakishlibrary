const express = require('express');
const router = express.Router();
const { requireStudent, authenticate } = require('../middleware/auth');
const { query, queryOne } = require('../config/database');

// Student profile
router.get('/profile', requireStudent, async (req, res) => {
  try {
    const studentId = req.student.id;

    // Get profile info
    const student = await queryOne(
      'SELECT id, ad_no, full_name, email, phone, contact, section, class, profile_photo, address, date_of_birth, blood_group FROM users WHERE id = ?',
      [studentId]
    );

    // Get stats
    const borrowedCount = await queryOne(
      "SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND status IN ('Borrowed', 'Overdue')",
      [studentId]
    );

    const returnedCount = await queryOne(
      "SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND status = 'Returned'",
      [studentId]
    );

    const fineInfo = await queryOne(
      'SELECT SUM(fine) as total_fine FROM transactions WHERE user_id = ?',
      [studentId]
    );

    res.json({
      success: true,
      student,
      stats: {
        borrowed: borrowedCount.count,
        returned: returnedCount.count,
        total_fine: fineInfo.total_fine || 0
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch student profile' });
  }
});

// Update student profile
router.put('/profile', requireStudent, async (req, res) => {
  try {
    const { email, phone, section, class: className } = req.body;
    const studentId = req.student.id;

    await query(
      'UPDATE users SET email = ?, phone = ?, section = ?, class = ? WHERE id = ?',
      [email, phone, section, className, studentId]
    );

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
