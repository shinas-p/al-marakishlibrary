const { query, queryOne, beginTransaction, commit, rollback } = require('../config/database');
const { logAdminActivity, logBookIssueAudit } = require('../helpers/adminHelper');
const { calculateFine } = require('../helpers/fineCalculator');
const moment = require('moment');

/**
 * Get all transactions with filters
 */
const getTransactions = async (req, res) => {
  try {
    const { status, user_id, book_id, search, page = 1, limit = 50 } = req.query;

    let sql = `
      SELECT t.*, 
             u.full_name as student_name, 
             u.ad_no as student_ad_no,
             b.title as book_title,
             b.accession_number,
             b.isbn
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      JOIN books b ON t.book_id = b.id
      WHERE 1=1
    `;
    const params = [];
    const { start_date, end_date } = req.query;

    if (status) {
      sql += ` AND t.status = ?`;
      params.push(status);
    }

    if (user_id) {
      sql += ` AND t.user_id = ?`;
      params.push(user_id);
    }

    if (book_id) {
      sql += ` AND t.book_id = ?`;
      params.push(book_id);
    }

    if (start_date) {
      sql += ` AND t.borrow_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      sql += ` AND t.borrow_date <= ?`;
      params.push(end_date);
    }

    if (search) {
      sql += ` AND (u.full_name LIKE ? OR u.ad_no LIKE ? OR b.title LIKE ? OR b.accession_number LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    sql += ` ORDER BY t.borrow_date DESC, t.id DESC`;

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const transactions = await query(sql, params);

    // Get total count
    let countSql = `
      SELECT COUNT(*) as total
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      JOIN books b ON t.book_id = b.id
      WHERE 1=1
    `;
    const countParams = [];
    if (status) {
      countSql += ` AND t.status = ?`;
      countParams.push(status);
    }
    if (user_id) {
      countSql += ` AND t.user_id = ?`;
      countParams.push(user_id);
    }
    if (book_id) {
      countSql += ` AND t.book_id = ?`;
      countParams.push(book_id);
    }
    if (search) {
      countSql += ` AND (u.full_name LIKE ? OR u.ad_no LIKE ? OR b.title LIKE ? OR b.accession_number LIKE ?)`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const totalResult = await queryOne(countSql, countParams);
    const total = totalResult?.total || 0;

    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

/**
 * Get single transaction
 */
const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await queryOne(`
      SELECT t.*, 
             u.full_name as student_name, 
             u.ad_no as student_ad_no,
             b.title as book_title,
             b.accession_number,
             b.isbn,
             b.count as book_count
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      JOIN books b ON t.book_id = b.id
      WHERE t.id = ?
    `, [id]);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true, transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
};

/**
 * Borrow a book (Issue)
 */
const borrowBook = async (req, res) => {
  const connection = await beginTransaction();
  try {
    const { user_id, book_id, due_date } = req.body;

    if (!user_id || !book_id) {
      await rollback(connection);
      return res.status(400).json({ error: 'User ID and Book ID are required' });
    }

    // Check if user exists
    const user = await queryOne('SELECT id, full_name FROM users WHERE id = ? AND status = ?', [user_id, 'active']);
    if (!user) {
      await rollback(connection);
      return res.status(404).json({ error: 'Student not found or inactive' });
    }

    // Check if book exists and is available
    const book = await queryOne('SELECT id, count, status, title, accession_number FROM books WHERE id = ?', [book_id]);
    if (!book) {
      await rollback(connection);
      return res.status(404).json({ error: 'Book not found' });
    }

    if (book.count <= 0) {
      await rollback(connection);
      return res.status(400).json({ error: `Book "${book.title}" is not available` });
    }

    // Check if user has reached borrow limit
    const borrowLimit = 3; // Can be from settings
    const activeBorrows = await queryOne(
      "SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND status IN ('Borrowed', 'Overdue')",
      [user_id]
    );

    if (activeBorrows.count >= borrowLimit) {
      await rollback(connection);
      return res.status(400).json({ error: `Borrow limit reached. You can only borrow ${borrowLimit} books at a time.` });
    }

    // Calculate dates
    const borrow_date = moment().format('YYYY-MM-DD');
    const final_due_date = due_date || moment().add(14, 'days').format('YYYY-MM-DD');

    // Get admin info
    const adminId = req.user.id;
    const adminName = req.user.username || 'Admin';
    const adminRole = req.user.role || 'admin';
    const ip = req.ip || '0.0.0.0';

    // Create transaction
    const [result] = await connection.execute(
      `INSERT INTO transactions 
       (user_id, book_id, borrow_date, due_date, status, issued_by_admin_id, issued_by_admin_name, issued_by_role, issued_ip, action_source) 
       VALUES (?, ?, ?, ?, 'Borrowed', ?, ?, ?, ?, ?)`,
      [user_id, book_id, borrow_date, final_due_date, adminId, adminName, adminRole, ip, 'manual']
    );

    const transaction_id = result.insertId;

    // Decrease book count
    const newCount = book.count - 1;
    const newStatus = newCount > 0 ? 'Available' : 'Unavailable';
    await connection.execute('UPDATE books SET count = ?, status = ? WHERE id = ?', [newCount, newStatus, book_id]);

    await commit(connection);

    // Log audit
    await logBookIssueAudit(transaction_id, book_id, user_id, adminId, 'manual', 'issue');
    await logAdminActivity(adminId, 'borrow_book', `Issued book: ${book.title} to ${user.full_name}`);

    res.json({
      success: true,
      message: 'Book borrowed successfully',
      transaction: {
        id: transaction_id,
        borrow_date,
        due_date: final_due_date,
        student_name: user.full_name,
        book_title: book.title
      }
    });
  } catch (error) {
    await rollback(connection);
    console.error('Borrow book error:', error);
    res.status(500).json({ error: 'Failed to borrow book: ' + error.message });
  }
};

/**
 * Return a book
 */
const returnBook = async (req, res) => {
  const connection = await beginTransaction();
  try {
    const { transaction_id } = req.body;

    if (!transaction_id) {
      await rollback(connection);
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    // Get transaction details
    const transaction = await queryOne(`
      SELECT t.*, b.id as book_id, b.count, b.title
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      WHERE t.id = ? AND t.status = 'Borrowed'
    `, [transaction_id]);

    if (!transaction) {
      await rollback(connection);
      return res.status(404).json({ error: 'Transaction not found or already returned' });
    }

    const return_date = moment().format('YYYY-MM-DD');

    // Calculate fine
    const fineResult = await calculateFine(transaction.due_date, return_date, 'student');
    const fine = fineResult.fine_amount || 0;

    // Update transaction
    await connection.execute(
      `UPDATE transactions 
       SET status = 'Returned', 
           return_date = ?, 
           fine = ?, 
           fine_status = CASE 
             WHEN ? <= COALESCE(fine_paid, 0) THEN 'Paid' 
             WHEN ? > 0 THEN 'Pending' 
             ELSE 'None' 
           END
       WHERE id = ?`,
      [return_date, fine, fine, fine, transaction_id]
    );

    // Increase book count
    const newCount = transaction.count + 1;
    const newStatus = newCount > 0 ? 'Available' : 'Unavailable';
    await connection.execute('UPDATE books SET count = ?, status = ? WHERE id = ?', [newCount, newStatus, transaction.book_id]);

    await commit(connection);

    // Log audit
    const adminId = req.user.id;
    await logBookIssueAudit(transaction_id, transaction.book_id, transaction.user_id, adminId, 'manual', 'return');
    await logAdminActivity(adminId, 'return_book', `Returned book: ${transaction.title}`);

    res.json({
      success: true,
      message: 'Book returned successfully',
      fine: fine,
      fine_details: fineResult
    });
  } catch (error) {
    await rollback(connection);
    console.error('Return book error:', error);
    res.status(500).json({ error: 'Failed to return book: ' + error.message });
  }
};

/**
 * Get student's borrowed books
 */
const getStudentBooks = async (req, res) => {
  try {
    const studentId = req.student.id;
    const { status, limit } = req.query;

    let sql = `
      SELECT t.*, 
             b.title, 
             b.author, 
             b.accession_number,
             b.cover_image,
             b.isbn
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      WHERE t.user_id = ?
    `;
    const params = [studentId];

    if (status) {
      sql += " AND t.status = ?";
      params.push(status);
    } else {
      sql += " AND t.status IN ('Borrowed', 'Overdue')";
    }

    sql += " ORDER BY t.due_date ASC, t.borrow_date DESC";

    if (limit) {
      sql += " LIMIT ?";
      params.push(parseInt(limit));
    }

    const transactions = await query(sql, params);

    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Get student books error:', error);
    res.status(500).json({ error: 'Failed to fetch student books' });
  }
};

/**
 * Get overdue books
 */
const getOverdueBooks = async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');

    const overdue = await query(`
      SELECT t.*, 
             u.full_name as student_name, 
             u.ad_no as student_ad_no,
             b.title as book_title,
             b.accession_number,
             (DATE(?) - t.due_date) as days_overdue
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      JOIN books b ON t.book_id = b.id
      WHERE t.status = 'Borrowed' AND t.due_date < ?
      ORDER BY t.due_date ASC
    `, [today, today]);

    res.json({ success: true, overdue });
  } catch (error) {
    console.error('Get overdue books error:', error);
    res.status(500).json({ error: 'Failed to fetch overdue books' });
  }
};

/**
 * Get transaction statistics
 */
const getTransactionStats = async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD');

    const totalIssuesToday = await queryOne(
      'SELECT COUNT(*) as count FROM transactions WHERE borrow_date = ?',
      [today]
    );

    const totalReturnsToday = await queryOne(
      'SELECT COUNT(*) as count FROM transactions WHERE return_date = ?',
      [today]
    );

    const overdueCount = await queryOne(
      "SELECT COUNT(*) as count FROM transactions WHERE status = 'Borrowed' AND due_date < ?",
      [today]
    );

    const totalPendingFines = await queryOne(
      "SELECT SUM(fine) as total FROM transactions WHERE fine_status = 'Pending'"
    );

    res.json({
      success: true,
      stats: {
        issuesToday: totalIssuesToday.count,
        returnsToday: totalReturnsToday.count,
        overdue: overdueCount.count,
        pendingFines: totalPendingFines.total || 0
      }
    });
  } catch (error) {
    console.error('Get transaction stats error:', error);
    res.status(500).json({ error: 'Failed to fetch transaction statistics' });
  }
};

/**
 * Get student's borrowed books (Admin version)
 */
const getStudentBorrowedBooksAdmin = async (req, res) => {
  try {
    const { studentId } = req.params;
    const today = moment().format('YYYY-MM-DD');
    const sql = `
      SELECT t.*, 
             b.title, 
             b.accession_number,
             COALESCE(t.fine_paid, 0) as fine_paid,
             CASE 
               WHEN t.status = 'Returned' THEN GREATEST(0, (t.return_date - t.due_date))
               ELSE GREATEST(0, (DATE(?) - t.due_date))
             END as days_late
      FROM transactions t
      JOIN books b ON t.book_id = b.id
      WHERE t.user_id = ? 
        AND (
          t.status IN ('Borrowed', 'Overdue') 
          OR (t.status = 'Returned' AND (t.fine_status IS NULL OR t.fine_status != 'Paid'))
        )
      ORDER BY t.due_date ASC
    `;
    const transactions = await query(sql, [today, studentId]);

    // Process to ensure days_late is calculated correctly (0 if not late)
    const processed = transactions.map(t => ({
      ...t,
      days_late: Math.max(0, t.days_late || 0)
    }));

    res.json({ success: true, transactions: processed });
  } catch (error) {
    console.error('Get student borrowed books admin error:', error);
    res.status(500).json({ error: 'Failed to fetch borrowed books' });
  }
};

module.exports = {
  getTransactions,
  getTransactionById,
  borrowBook,
  returnBook,
  getStudentBooks,
  getOverdueBooks,
  getTransactionStats,
  getStudentBorrowedBooksAdmin
};
