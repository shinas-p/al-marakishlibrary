const { query, queryOne, beginTransaction, commit, rollback } = require('../config/database');
const { logAdminActivity } = require('../helpers/adminHelper');
const { calculateFine, getSetting } = require('../helpers/fineCalculator');

/**
 * Get all fines with filters
 */
const getFines = async (req, res) => {
  try {
    const { status, user_id, type, page = 1, limit = 50 } = req.query;

    let sql = `
      SELECT f.*, 
             u.full_name as student_name, 
             u.ad_no as student_ad_no,
             b.title as book_title
      FROM fines f
      LEFT JOIN users u ON f.user_id = u.id
      LEFT JOIN books b ON f.book_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND f.status = ?`;
      params.push(status);
    }

    if (user_id) {
      sql += ` AND f.user_id = ?`;
      params.push(user_id);
    }

    if (type) {
      sql += ` AND f.reason = ?`;
      params.push(type);
    }

    sql += ` ORDER BY f.created_at DESC`;

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const fines = await query(sql, params);

    res.json({ success: true, fines });
  } catch (error) {
    console.error('Get fines error:', error);
    res.status(500).json({ error: 'Failed to fetch fines' });
  }
};

/**
 * Get student's fines
 */
const getStudentFines = async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    if (!studentId) {
      return res.status(401).json({ error: 'User identification failed' });
    }

    // Get fine rate
    const fineRate = await getSetting('fine_per_day_student', 5);

    // Get transaction fines (Including currently late books)
    const transactionFines = await query(`
      SELECT 
        t.id,
        CASE 
          WHEN t.status = 'Returned' THEN (t.fine - COALESCE(t.fine_paid, 0))
          ELSE (GREATEST(0, (CURRENT_DATE - t.due_date)) * ? - COALESCE(t.fine_paid, 0)) 
        END as amount,
        t.fine_status as status,
        t.due_date,
        t.return_date,
        b.title as book_title,
        b.accession_number,
        'late_return' as reason,
        t.created_at
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      WHERE t.user_id = ? 
        AND (
          (t.status = 'Returned' AND t.fine > COALESCE(t.fine_paid, 0) AND t.fine_status != 'Paid')
          OR (t.status IN ('Borrowed', 'Overdue') AND (CURRENT_DATE - t.due_date) > 0)
        )
      ORDER BY t.created_at DESC
    `, [fineRate, studentId]);

    // Get custom fines
    const customFines = await query(`
      SELECT 
        cf.id,
        cf.fine_amount as amount,
        cf.status,
        cf.fine_type as reason,
        cf.reason as description,
        b.title as book_title,
        b.accession_number,
        cf.created_at
      FROM custom_fines cf
      LEFT JOIN books b ON cf.book_id = b.id
      WHERE cf.student_id = ? AND cf.status IN ('approved', 'pending_approval')
      ORDER BY cf.created_at DESC
    `, [studentId]);

    const totalPending = [...transactionFines, ...customFines]
      .reduce((sum, f) => sum + parseFloat(f.amount || 0), 0);

    res.json({
      success: true,
      fines: {
        transaction_fines: transactionFines,
        custom_fines: customFines,
        total_pending: totalPending
      }
    });
  } catch (error) {
    console.error('Get student fines error:', error);
    res.status(500).json({ error: 'Failed to fetch fines' });
  }
};

/**
 * Submit fine payment
 */
const submitFinePayment = async (req, res) => {
  try {
    const { transaction_id, fine_id, amount, payment_method, payment_reference, payment_screenshot } = req.body;
    const studentId = req.student?.id || req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const connection = await beginTransaction();

    try {
      // Create payment record
      const [result] = await connection.execute(
        `INSERT INTO fine_payments 
         (user_id, transaction_id, fine_id, amount, payment_method, payment_reference, payment_screenshot, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
        [studentId, transaction_id || null, fine_id || null, amount, payment_method || 'upi', payment_reference || null, payment_screenshot || null]
      );

      await commit(connection);

      // Notify Admins
      const student = await queryOne('SELECT full_name, ad_no FROM users WHERE id = ?', [studentId]);
      const notifTitle = 'New Payment Submitted';
      const notifMsg = `Student ${student.full_name} (${student.ad_no}) paid ₹${amount}`;
      await query(
        'INSERT INTO announcements (title, message, target_role, created_by) VALUES (?, ?, ?, ?)',
        [notifTitle, notifMsg, 'admin', studentId]
      );

      res.json({
        success: true,
        message: 'Payment submitted successfully. Waiting for admin approval.',
        payment_id: result.insertId
      });
    } catch (error) {
      await rollback(connection);
      throw error;
    }
  } catch (error) {
    console.error('Submit payment error:', error);
    res.status(500).json({ error: 'Failed to submit payment' });
  }
};

/**
 * Add custom fine
 */
const addCustomFine = async (req, res) => {
  try {
    const { student_id, book_id, transaction_id, fine_type, fine_amount, reason, admin_remarks } = req.body;
    const adminId = req.user.id;

    if (!student_id || !fine_type || !fine_amount || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const connection = await beginTransaction();

    try {
      const [result] = await connection.execute(
        `INSERT INTO custom_fines 
         (student_id, book_id, transaction_id, fine_type, fine_amount, reason, admin_remarks, status, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?)`,
        [student_id, book_id || null, transaction_id || null, fine_type, fine_amount, reason, admin_remarks || null, adminId]
      );

      await commit(connection);

      await logAdminActivity(adminId, 'add_custom_fine', `Added custom fine: ${fine_type} - ₹${fine_amount} for student ID ${student_id}`);

      // Notify Student
      await query(
        'INSERT INTO user_notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
        [student_id, 'New Fine Added', `A fine of ₹${fine_amount} has been added to your account for: ${fine_type}`, 'warning']
      );

      res.json({
        success: true,
        message: 'Custom fine added successfully. Waiting for approval.',
        fine_id: result.insertId
      });
    } catch (error) {
      await rollback(connection);
      throw error;
    }
  } catch (error) {
    console.error('Add custom fine error:', error);
    res.status(500).json({ error: 'Failed to add custom fine' });
  }
};

/**
 * Approve fine
 */
const approveFine = async (req, res) => {
  try {
    const { id } = req.params;
    const { review_remarks } = req.body;
    const adminId = req.user.id;

    await query(
      `UPDATE custom_fines 
       SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_remarks = ? 
       WHERE id = ?`,
      [adminId, review_remarks || null, id]
    );

    await logAdminActivity(adminId, 'approve_fine', `Approved custom fine ID ${id}`);

    res.json({ success: true, message: 'Fine approved successfully' });
  } catch (error) {
    console.error('Approve fine error:', error);
    res.status(500).json({ error: 'Failed to approve fine' });
  }
};

/**
 * Reject fine
 */
const rejectFine = async (req, res) => {
  try {
    const { id } = req.params;
    const { review_remarks } = req.body;
    const adminId = req.user.id;

    await query(
      `UPDATE custom_fines 
       SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), review_remarks = ? 
       WHERE id = ?`,
      [adminId, review_remarks || null, id]
    );

    await logAdminActivity(adminId, 'reject_fine', `Rejected custom fine ID ${id}`);

    res.json({ success: true, message: 'Fine rejected successfully' });
  } catch (error) {
    console.error('Reject fine error:', error);
    res.status(500).json({ error: 'Failed to reject fine' });
  }
};

/**
 * Approve payment
 */
const approvePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_remarks } = req.body;
    const adminId = req.user.id;

    const connection = await beginTransaction();

    try {
      // Get payment details
      const payment = await queryOne(
        'SELECT * FROM fine_payments WHERE id = ?',
        [id]
      );

      if (!payment) {
        await rollback(connection);
        return res.status(404).json({ error: 'Payment not found' });
      }

      // Update payment status
      await connection.execute(
        `UPDATE fine_payments 
         SET status = 'Approved', reviewed_by = ?, reviewed_at = NOW(), admin_remarks = ? 
         WHERE id = ?`,
        [adminId, admin_remarks || null, id]
      );

      // Update transaction fine status if applicable
      if (payment.transaction_id) {
        await connection.execute(
          `UPDATE transactions 
           SET fine_status = 'Paid', fine_paid = fine_paid + ? 
           WHERE id = ?`,
          [payment.amount, payment.transaction_id]
        );
      }

      // Update custom fine status if applicable
      if (payment.fine_id) {
        await connection.execute(
          `UPDATE custom_fines 
           SET status = 'paid', paid_at = NOW() 
           WHERE id = ?`,
          [payment.fine_id]
        );
      }

      await commit(connection);

      await logAdminActivity(adminId, 'approve_payment', `Approved payment ID ${id} - ₹${payment.amount}`);

      // Notify Student
      await query(
        'INSERT INTO user_notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
        [payment.user_id, 'Payment Approved', `Your payment of ₹${payment.amount} has been verified and approved.`, 'success']
      );

      res.json({ success: true, message: 'Payment approved successfully' });
    } catch (error) {
      await rollback(connection);
      throw error;
    }
  } catch (error) {
    console.error('Approve payment error:', error);
    res.status(500).json({ error: 'Failed to approve payment' });
  }
};

/**
 * Reject payment
 */
const rejectPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_remarks } = req.body;
    const adminId = req.user.id;

    // Get payment details for notification
    const payment = await queryOne('SELECT user_id, amount FROM fine_payments WHERE id = ?', [id]);

    await query(
      `UPDATE fine_payments 
       SET status = 'Rejected', reviewed_by = ?, reviewed_at = NOW(), admin_remarks = ? 
       WHERE id = ?`,
      [adminId, admin_remarks || null, id]
    );

    await logAdminActivity(adminId, 'reject_payment', `Rejected payment ID ${id}`);

    // Notify Student
    if (payment) {
      await query(
        'INSERT INTO user_notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
        [payment.user_id, 'Payment Rejected', `Your payment of ₹${payment.amount} was rejected. Note: ${admin_remarks || 'Contact admin'}`, 'error']
      );
    }

    res.json({ success: true, message: 'Payment rejected successfully' });
  } catch (error) {
    console.error('Reject payment error:', error);
    res.status(500).json({ error: 'Failed to reject payment' });
  }
};

/**
 * Get fine by ID
 */
const getFineById = async (req, res) => {
  try {
    const { id } = req.params;
    const fine = await queryOne('SELECT * FROM fines WHERE id = ?', [id]);

    if (!fine) {
      return res.status(404).json({ error: 'Fine not found' });
    }

    res.json({ success: true, fine });
  } catch (error) {
    console.error('Get fine error:', error);
    res.status(500).json({ error: 'Failed to fetch fine' });
  }
};

/**
 * Get logged-in student's payment history
 */
const getMyPayments = async (req, res) => {
  try {
    const studentId = req.student?.id || req.user?.id;
    const payments = await query(
      'SELECT * FROM fine_payments WHERE user_id = ? ORDER BY submitted_at DESC',
      [studentId]
    );
    res.json({ success: true, payments });
  } catch (error) {
    console.error('Get my payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

/**
 * Upload payment proof (Screenshot) for an existing payment
 */
const uploadPaymentProof = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_screenshot } = req.body;
    const studentId = req.student?.id || req.user?.id;

    // Verify ownership
    const payment = await queryOne('SELECT id FROM fine_payments WHERE id = ? AND user_id = ?', [id, studentId]);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (!payment_screenshot) {
      return res.status(400).json({ error: 'No screenshot provided' });
    }

    await query(
      'UPDATE fine_payments SET payment_screenshot = ?, is_screenshot_requested = 0 WHERE id = ?',
      [payment_screenshot, id]
    );

    // Notify Admin that screenshot is uploaded? Optional but good.
    const student = await queryOne('SELECT full_name, ad_no FROM users WHERE id = ?', [studentId]);
    const notifTitle = 'Screenshot Uploaded';
    const notifMsg = `Student ${student.full_name} uploaded payment proof for Payment ID #${id}`;
    await query(
      'INSERT INTO announcements (title, message, target_role, created_by) VALUES (?, ?, ?, ?)',
      [notifTitle, notifMsg, 'admin', studentId]
    );

    res.json({ success: true, message: 'Screenshot uploaded successfully' });
  } catch (error) {
    console.error('Upload proof error:', error);
    res.status(500).json({ error: 'Failed to upload proof' });
  }
};

/**
 * Record a cash fine payment (Admin action)
 */
const recordCashFinePayment = async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const logFile = path.join(process.cwd(), 'PAYMENT_DEBUG.log');

  const log = (msg) => {
    try {
      const ts = new Date().toISOString();
      fs.appendFileSync(logFile, `[${ts}] ${msg}\n`);
    } catch (e) { }
  };

  log('--- STARTING PAYMENT ---');
  let connection;
  try {
    connection = await beginTransaction();
    if (!connection) throw new Error('Could not establish database connection');

    // Extract and Safely Cast Inputs
    const student_id = parseInt(req.body.student_id);
    const transaction_id = req.body.transaction_id ? parseInt(req.body.transaction_id) : null;
    const book_id = req.body.book_id ? parseInt(req.body.book_id) : null;
    const amount = parseFloat(req.body.amount) || 0;
    const reason = req.body.reason || 'Manual Fine Payment';
    const notes = req.body.notes || '';
    const adminId = req.user ? parseInt(req.user.id) : 1; // Fallback to 1 if no user

    log(`Payload: stud=${student_id}, trans=${transaction_id}, amt=${amount}, admin=${adminId}`);

    if (isNaN(student_id) || amount <= 0) {
      log('Validation Failed: invalid student_id or amount');
      await rollback(connection);
      return res.status(400).json({ error: 'Valid Student ID and Amount are required' });
    }

    // 1. Create payment record
    log('1. Inserting into fine_payments...');
    const [payResult] = await connection.query(
      `INSERT INTO fine_payments 
       (user_id, transaction_id, amount, payment_method, payment_reference, status, reviewed_by, reviewed_at, admin_remarks, submitted_at) 
       VALUES (?, ?, ?, 'Cash', 'CASH-SETTLEMENT', 'Approved', ?, NOW(), ?, NOW())`,
      [student_id, transaction_id, amount, adminId, notes || reason]
    );
    const newPaymentId = payResult.insertId;
    log(`Success: payment_id=${newPaymentId}`);

    // 2. Update status in transactions
    if (transaction_id) {
      log(`2a. Updating single transaction: ${transaction_id}`);
      // Update fine_paid and recalculate fine_status
      await connection.query(
        `UPDATE transactions 
         SET fine_paid = COALESCE(fine_paid, 0) + ?,
             fine_status = CASE 
               WHEN status = 'Returned' AND (COALESCE(fine_paid, 0) + ?) >= COALESCE(fine, 0) THEN 'Paid'
               WHEN status IN ('Borrowed', 'Overdue') THEN 'Paid'
               ELSE fine_status
             END
         WHERE id = ?`,
        [amount, amount, transaction_id]
      );
    } else {
      log(`2b. General payment: settlement for student ${student_id}`);
      // Mark all currently overdue/returned-unpaid books as 'Paid' to settle current fines
      // And for overdue books, we'll assume the current accrued fine is covered by fine_paid
      // We'll update fine_paid to match current fine for returned books
      await connection.query(
        `UPDATE transactions 
         SET fine_paid = CASE WHEN status = 'Returned' THEN fine ELSE COALESCE(fine_paid, 0) END,
             fine_status = 'Paid' 
         WHERE user_id = ? 
           AND (status IN ('Borrowed', 'Overdue') OR (status = 'Returned' AND fine > 0))
           AND (fine_status IS NULL OR fine_status != 'Paid')`,
        [student_id]
      );
    }

    // 3. Update fines table (if applicable)
    log('3. Updating main fines table...');
    await connection.query(
      "UPDATE fines SET status = 'Paid', amount_paid = COALESCE(amount_paid, 0) + ?, updated_at = NOW() WHERE user_id = ? AND status != 'Paid'",
      [amount, student_id]
    );

    // 4. Update custom_fines
    if (book_id && !transaction_id) {
      log('4. Updating custom_fines...');
      await connection.query(
        "UPDATE custom_fines SET status = 'paid', paid_at = NOW() WHERE student_id = ? AND book_id = ? AND status = 'approved' ORDER BY id DESC LIMIT 1",
        [student_id, book_id]
      );
    }

    await commit(connection);
    log('--- COMMITTED SUCCESSFULLY ---');

    await logAdminActivity(adminId, 'cash_fine_payment', `Recorded cash payment of ₹${amount} for student ID ${student_id}`);

    res.json({
      success: true,
      message: 'Cash payment recorded successfully',
      payment_id: newPaymentId,
      receipt_data: {
        receipt_no: `CSH-${newPaymentId.toString().padStart(6, '0')}`,
        date: new Date().toISOString()
      }
    });

  } catch (error) {
    if (connection) await rollback(connection);
    log(`FATAL ERROR: ${error.message} \n ${error.stack}`);
    console.error('PAYMENT ERROR:', error);
    res.status(500).json({
      error: 'Transaction failed',
      details: error.message,
      code: error.code || 'ERR_DATABASE'
    });
  }
};

module.exports = {
  getFines,
  getStudentFines,
  submitFinePayment,
  addCustomFine,
  approveFine,
  rejectFine,
  approvePayment,
  rejectPayment,
  getFineById,
  getMyPayments,
  uploadPaymentProof,
  recordCashFinePayment
};
