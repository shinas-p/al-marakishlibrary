const { query } = require('../config/database');

/**
 * Unified Activity Logging Function
 * @param {Object} data - Log data
 * @param {Object} req - Express request object (optional, for IP/UA/User info)
 */
const logActivity = async (data, req = null) => {
  try {
    const {
      userId,
      userName,
      userRole,
      action,
      category = 'general',
      targetId = null,
      targetType = null,
      targetName = null,
      description,
      metadata = null,
      severity = 'low',
      status = 'success'
    } = data;

    // Extract user info from req if available
    const finalUserId = userId || req?.user?.id || null;
    const finalUserName = userName || req?.user?.full_name || req?.user?.username || null;
    const finalUserRole = userRole || req?.user?.role || null;
    const finalUserType = req?.user?.type || 'admin';

    // Extract network info
    const ip = req?.ip || req?.connection?.remoteAddress || '0.0.0.0';
    const userAgent = req?.get?.('user-agent') || null;

    await query(
      `INSERT INTO activity_logs 
       (user_id, user_name, user_role, user_type, action_type, action_category, 
        target_id, target_type, target_name, action_description, metadata, 
        ip_address, user_agent, status, severity) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalUserId,
        finalUserName,
        finalUserRole,
        finalUserType,
        action,
        category,
        targetId,
        targetType,
        targetName,
        description,
        metadata ? JSON.stringify(metadata) : null,
        ip,
        userAgent,
        status,
        severity
      ]
    );
  } catch (error) {
    // Log to console but don't crash the application
    console.error('CRITICAL ERROR: Failed to write audit log:', error);
  }
};

/**
 * Legacy compatibility wrappers
 */
const logAdminActivity = async (adminId, actionType, description, metadata = null, req = null) => {
  return logActivity({
    userId: adminId,
    action: actionType,
    description: description,
    metadata: metadata
  }, req);
};

const logBookIssueAudit = async (transactionId, bookId, userId, adminId, source = 'manual', actionType = 'issue') => {
  // Fetch names for robust logging
  try {
    const [book, student, admin] = await Promise.all([
      query('SELECT title FROM books WHERE id = ?', [bookId]),
      query('SELECT full_name, ad_no FROM users WHERE id = ?', [userId]),
      query('SELECT full_name, role FROM admin WHERE id = ?', [adminId])
    ]);

    return logActivity({
      userId: adminId,
      userName: admin[0]?.full_name,
      userRole: admin[0]?.role,
      action: actionType === 'issue' ? 'BOOK_ISSUE' : (actionType === 'return' ? 'BOOK_RETURN' : 'BOOK_RENEW'),
      category: 'circulation',
      targetId: bookId,
      targetType: 'book',
      targetName: book[0]?.title,
      description: `${actionType === 'issue' ? 'Issued' : 'Returned'} book "${book[0]?.title}" to student ${student[0]?.full_name}`,
      metadata: { transactionId, studentAdNo: student[0]?.ad_no, source },
      severity: 'medium'
    });
  } catch (e) {
    console.error('Audit compatibility error:', e);
  }
};

/**
 * Check admin role hierarchy
 */
const checkAdminRole = (userRole, requiredRole) => {
  const roleHierarchy = {
    'owner': 3,
    'admin': 2,
    'assistant': 1
  };

  const userRoleWeight = roleHierarchy[userRole] || 0;
  const requiredRoleWeight = roleHierarchy[requiredRole] || 0;

  return userRoleWeight >= requiredRoleWeight;
};

module.exports = {
  logActivity,
  logAdminActivity,
  checkAdminRole,
  logBookIssueAudit
};
