const { query, queryOne } = require('../config/database');

/**
 * Get simple admin dashboard statistics for widgets
 */
const getStats = async (req, res) => {
  try {
    const [
      totalBooks,
      totalUsers,
      totalBorrowed,
      totalFine
    ] = await Promise.all([
      queryOne('SELECT COUNT(*) as count FROM books').catch(() => ({ count: 0 })),
      queryOne('SELECT COUNT(*) as count FROM users WHERE status = ?', ['active']).catch(() => ({ count: 0 })),
      queryOne('SELECT COUNT(*) as count FROM transactions WHERE status = ?', ['Borrowed']).catch(() => ({ count: 0 })),
      queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM fine_payments WHERE status NOT IN ('Rejected', 'Pending', 'Cancelled')").catch(() => ({ total: 0 }))
    ]);

    res.json({
      success: true,
      stats: {
        totalBooks: totalBooks?.count || 0,
        totalUsers: totalUsers?.count || 0,
        totalBorrowed: totalBorrowed?.count || 0,
        totalFine: Number(totalFine?.total || 0).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

/**
 * Get notification counts for admin sidebar
 */
const getNotificationCounts = async (req, res) => {
  try {
    const [
      pendingPayments,
      pendingRequests,
      pendingRegistrations,
      pendingReservations,
      pendingSuggestions
    ] = await Promise.all([
      queryOne("SELECT COUNT(*) as count FROM fine_payments WHERE status = 'Pending'").catch(() => ({ count: 0 })),
      queryOne("SELECT COUNT(*) as count FROM borrow_requests WHERE status = 'pending'").catch(() => ({ count: 0 })),
      queryOne("SELECT COUNT(*) as count FROM student_registrations WHERE status = 'pending'").catch(() => ({ count: 0 })),
      queryOne("SELECT COUNT(*) as count FROM reservations WHERE status = 'Pending'").catch(() => ({ count: 0 })),
      queryOne("SELECT COUNT(*) as count FROM book_suggestions WHERE status = 'Pending'").catch(() => ({ count: 0 }))
    ]);

    res.json({
      success: true,
      notifications: {
        payments: pendingPayments?.count || 0,
        requests: pendingRequests?.count || 0,
        registrations: pendingRegistrations?.count || 0,
        reservations: pendingReservations?.count || 0,
        suggestions: pendingSuggestions?.count || 0,
        total: (pendingPayments?.count || 0) + (pendingRequests?.count || 0) + (pendingRegistrations?.count || 0) + (pendingReservations?.count || 0) + (pendingSuggestions?.count || 0)
      }
    });
  } catch (error) {
    console.error('Get notification counts error:', error);
    res.status(500).json({ error: 'Failed to fetch notification counts' });
  }
};

/**
 * Get recent transactions for the dashboard
 */
const getRecentTransactions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const transactions = await query(`
      SELECT t.id, u.full_name, b.title, t.borrow_date, t.status
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      JOIN books b ON t.book_id = b.id
      ORDER BY t.borrow_date DESC
      LIMIT ?
    `, [limit]);

    res.json({
      success: true,
      transactions: transactions || []
    });
  } catch (error) {
    console.error('Get recent transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch recent transactions' });
  }
};

/**
 * Get top issuing admins (Fixed for missing columns)
 */
const getTopIssuingAdmins = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const admins = await query(`
      SELECT 
        a.full_name as admin_name,
        a.role as role,
        COUNT(t.id) as issue_count
      FROM transactions t
      JOIN admin a ON t.issued_by_admin_id = a.id
      WHERE t.created_at >= (CURRENT_TIMESTAMP - INTERVAL '30 DAY')
      GROUP BY a.id, a.full_name, a.role
      ORDER BY issue_count DESC
      LIMIT ?
    `, [limit]);

    res.json({
      success: true,
      admins: admins || []
    });
  } catch (error) {
    console.error('Get top issuing admins error:', error);
    res.json({ success: true, admins: [] });
  }
};

/**
 * Get most active students
 */
const getMostActiveStudents = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const students = await query(`
      SELECT 
        u.full_name as student_name,
        u.ad_no,
        COUNT(t.id) as books_received
      FROM users u
      INNER JOIN transactions t ON u.id = t.user_id
      WHERE u.status = 'active'
      GROUP BY u.id, u.full_name, u.ad_no
      HAVING books_received > 0
      ORDER BY books_received DESC
      LIMIT ?
    `, [limit]);

    res.json({
      success: true,
      students: students || []
    });
  } catch (error) {
    console.error('Get most active students error:', error);
    res.json({ success: true, students: [] });
  }
};

const getAdminDashboard = async (req, res) => {
  try {
    const [stats, recentTransactions] = await Promise.all([
      getStatsData(),
      getRecentTransactionsData(5)
    ]);
    res.json({ success: true, stats, recent_transactions: recentTransactions });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

async function getStatsData() {
  const [totalBooks, totalUsers, totalBorrowed, totalFine] = await Promise.all([
    queryOne('SELECT COUNT(*) as count FROM books').catch(() => ({ count: 0 })),
    queryOne('SELECT COUNT(*) as count FROM users WHERE status = ?', ['active']).catch(() => ({ count: 0 })),
    queryOne('SELECT COUNT(*) as count FROM transactions WHERE status = ?', ['Borrowed']).catch(() => ({ count: 0 })),
    queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM fine_payments WHERE status NOT IN ('Rejected', 'Pending', 'Cancelled')").catch(() => ({ total: 0 }))
  ]);
  return {
    totalBooks: totalBooks?.count || 0,
    totalUsers: totalUsers?.count || 0,
    totalBorrowed: totalBorrowed?.count || 0,
    totalFine: Number(totalFine?.total || 0).toFixed(2)
  };
}

async function getRecentTransactionsData(limit = 5) {
  return await query(`
    SELECT t.id, u.full_name, b.title, t.borrow_date, t.status
    FROM transactions t
    JOIN users u ON t.user_id = u.id
    JOIN books b ON t.book_id = b.id
    ORDER BY t.borrow_date DESC
    LIMIT ?
  `, [limit]);
}

const getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user.id;
    const [borrowedBooks, overdueBooks, transFines, customFines] = await Promise.all([
      query("SELECT t.*, b.title FROM transactions t JOIN books b ON t.book_id = b.id WHERE t.user_id = ? AND t.status IN ('Borrowed', 'Overdue')", [studentId]).catch(() => []),
      query("SELECT t.*, b.title FROM transactions t JOIN books b ON t.book_id = b.id WHERE t.user_id = ? AND t.status = 'Overdue'", [studentId]).catch(() => []),
      queryOne("SELECT SUM(fine - COALESCE(fine_paid, 0)) as total FROM transactions WHERE user_id = ? AND status = 'Returned' AND fine_status != 'Paid'", [studentId]).catch(() => ({ total: 0 })),
      queryOne("SELECT SUM(fine_amount) as total FROM custom_fines WHERE student_id = ? AND status IN ('approved', 'pending_approval')", [studentId]).catch(() => ({ total: 0 }))
    ]);

    const totalFineAmount = parseFloat(transFines?.total || 0) + parseFloat(customFines?.total || 0);

    // Get unread notification count
    const unreadRes = await queryOne(
      'SELECT COUNT(*) as count FROM user_notifications WHERE user_id = ? AND is_read = FALSE',
      [studentId]
    ).catch(() => ({ count: 0 }));

    res.json({
      success: true,
      stats: {
        currentlyBorrowed: borrowedBooks?.length || 0,
        overdueCount: overdueBooks?.length || 0,
        totalFine: totalFineAmount.toFixed(2),
        unreadNotifications: unreadRes?.count || 0
      }
    });
  } catch (error) {
    console.error('Get student dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

module.exports = {
  getStats,
  getRecentTransactions,
  getTopIssuingAdmins,
  getMostActiveStudents,
  getNotificationCounts,
  getAdminDashboard,
  getStudentDashboard
};
