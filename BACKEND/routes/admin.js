/**
 * ================================================
 * ADMIN ROUTES - WITH RBAC PROTECTION
 * ================================================
 * All routes protected with role-based access control
 */

const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });


// RBAC Middleware
const {
  verifyToken,
  requireOwner,
  requireAdmin,
  requireAssistant,
  requirePermission,
  logActivity
} = require('../middleware/rbac');

// Legacy auth middleware (for backwards compatibility during transition)
const { requireAdmin: legacyRequireAdmin } = require('../middleware/auth');

// File Upload Middleware
const { uploadBookFiles, uploadStudentPhoto, uploadBranding, uploadUserPhoto } = require('../middleware/upload');

// Controllers
const userController = require('../controllers/userController');
const registrationController = require('../controllers/registrationController');
const paymentController = require('../controllers/paymentController');
const activityController = require('../controllers/activityController');
const importController = require('../controllers/importController');
const labelController = require('../controllers/labelController');
const reportController = require('../controllers/reportController');
const borrowRequestController = require('../controllers/borrowRequestController');
const bookController = require('../controllers/booksController');
const dashboardController = require('../controllers/dashboardController');
const ownerController = require('../controllers/ownerController');
const adminController = require('../controllers/adminController');
const { queryOne, query } = require('../config/database');

// ================================================
// OWNER-ONLY ROUTES 👑
// ================================================

// System Settings Management
router.get('/owner/settings', verifyToken, requireOwner, ownerController.getAllSettings);
router.get('/owner/settings/:category', verifyToken, requireOwner, ownerController.getSettingsByCategory);
router.put('/owner/settings', verifyToken, requireOwner, ownerController.updateSetting);
router.put('/owner/settings/bulk', verifyToken, requireOwner, logActivity('bulk_update_settings', 'system'), ownerController.updateBulkSettings);
router.post('/owner/upload', verifyToken, requireOwner, uploadBranding, ownerController.uploadBrandingAsset);

// System Health & Monitoring
router.get('/owner/health', verifyToken, requireOwner, ownerController.getSystemHealth);

// Backup & Maintenance
router.post('/owner/backup', verifyToken, requireOwner, logActivity('create_backup', 'maintenance'), ownerController.createBackup);
router.get('/owner/backups', verifyToken, requireOwner, ownerController.listBackups);
router.post('/owner/optimize', verifyToken, requireOwner, logActivity('optimize_database', 'maintenance'), ownerController.optimizeDatabase);
router.delete('/owner/logs/clean', verifyToken, requireOwner, logActivity('clean_logs', 'maintenance'), ownerController.cleanOldLogs);

// Admin User Management (Owner Only)
router.get('/owner/admins', verifyToken, requireOwner, async (req, res) => {
  try {
    const admins = await query(
      'SELECT id, username, full_name, email, phone, role, status, permissions, created_at, last_login FROM admin ORDER BY created_at DESC'
    );
    res.json({ success: true, admins });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

router.post('/owner/admins', verifyToken, requireOwner, logActivity('create_admin', 'admins'), async (req, res) => {
  try {
    const { username, password, full_name, email, phone, role } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      'INSERT INTO admin (username, password, full_name, email, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, full_name, email, phone, role, 'active']
    );

    res.json({ success: true, message: 'Admin created successfully', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: (error.code === 'ER_DUP_ENTRY' || error.code === '23505') ? 'Username already exists' : 'Failed to create admin' });
  }
});

router.put('/owner/admins/:id/role', verifyToken, requireOwner, logActivity('change_role', 'admins'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    await query('UPDATE admin SET role = ? WHERE id = ?', [role, id]);
    res.json({ success: true, message: 'Role updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

router.put('/owner/admins/:id/status', verifyToken, requireOwner, logActivity('change_status', 'admins'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await query('UPDATE admin SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Comprehensive Admin Update
router.put('/owner/admins/:id', verifyToken, requireOwner, logActivity('update_admin', 'admins'), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, role, status } = req.body;

    await query(
      'UPDATE admin SET full_name = ?, email = ?, role = ?, status = ? WHERE id = ?',
      [full_name, email, role, status, id]
    );
    res.json({ success: true, message: 'Admin profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update admin profile' });
  }
});

// Force Password Reset
router.put('/owner/admins/:id/password', verifyToken, requireOwner, logActivity('reset_password_forced', 'admins'), async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await query('UPDATE admin SET password = ? WHERE id = ?', [hashedPassword, id]);
    res.json({ success: true, message: 'Password reset executed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Update Granular Permissions
router.put('/owner/admins/:id/permissions', verifyToken, requireOwner, logActivity('update_permissions', 'admins'), async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    await query('UPDATE admin SET permissions = ? WHERE id = ?', [JSON.stringify(permissions), id]);
    res.json({ success: true, message: 'Permission matrix deployed successfully' });
  } catch (error) {
    console.error('Permission update error:', error);
    res.status(500).json({ error: 'Failed to deploy permission matrix' });
  }
});

router.delete('/owner/admins/:id', verifyToken, requireOwner, logActivity('delete_admin', 'admins'), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await query('UPDATE admin SET status = ?, deleted_at = NOW() WHERE id = ?', ['deleted', id]);
    res.json({ success: true, message: 'Admin deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete admin' });
  }
});

// Activity & Security Logs (Owner Only)
router.get('/owner/logs/activity', verifyToken, requireOwner, activityController.getActivityLogs);
router.get('/owner/logs/stats', verifyToken, requireOwner, activityController.getAuditStats);
router.get('/owner/logs/book-issue-audit', verifyToken, requireOwner, activityController.getBookIssueAudit);
router.post('/owner/logs/book-issue-audit/:id/rollback', verifyToken, requireOwner, activityController.rollbackTransaction);
router.get('/owner/logs/security', verifyToken, requireOwner, async (req, res) => {
  try {
    const { limit = 100, event_type } = req.query;

    let sql = 'SELECT * FROM security_logs WHERE 1=1';
    const params = [];

    if (event_type) {
      sql += ' AND event_type = ?';
      params.push(event_type);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = await query(sql, params);
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch security logs' });
  }
});

// ================================================
// ADMIN ROUTES (Admin + Owner)
// ================================================

// Admin Profile
router.get('/profile', verifyToken, requireAssistant, async (req, res) => {
  try {
    const admin = await queryOne(
      'SELECT id, username, full_name, role, email, phone, position, profile_photo, status, created_at, last_login FROM admin WHERE id = ?',
      [req.user.id]
    );
    res.json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin profile' });
  }
});

router.put('/profile', verifyToken, requireAssistant, adminController.updateOwnProfile);
router.put('/profile/photo', verifyToken, requireAssistant, uploadUserPhoto, adminController.updateOwnPhoto);
router.put('/profile/password', verifyToken, requireAssistant, adminController.updateOwnPassword);

// Dashboard Stats
router.get('/dashboard/stats', verifyToken, requireAdmin, dashboardController.getStats);
router.get('/dashboard/transactions', verifyToken, requireAdmin, dashboardController.getRecentTransactions);
router.get('/dashboard/top-admins', verifyToken, requireAdmin, dashboardController.getTopIssuingAdmins);
router.get('/dashboard/most-active-students', verifyToken, requireAdmin, dashboardController.getMostActiveStudents);

// Student Management (Admin + Owner can manage, Assistant can only view)
router.get('/users/stats', verifyToken, requirePermission('view_users'), userController.getUserStats);
router.get('/users/search', verifyToken, requirePermission('view_users'), userController.searchUsers);
router.get('/users', verifyToken, requirePermission('view_users'), userController.getAllUsers);
router.get('/users/:id', verifyToken, requirePermission('view_users'), userController.getUserById);
router.post('/users/add', verifyToken, requirePermission('manage_users'), uploadStudentPhoto, logActivity('add_user', 'users'), userController.addUser);
router.put('/users/:id', verifyToken, requirePermission('manage_users'), uploadStudentPhoto, logActivity('update_user', 'users'), userController.updateUser);
router.delete('/users/:id', verifyToken, requirePermission('delete_users'), logActivity('delete_user', 'users'), userController.deleteUser);

// Book Management (Admin + Owner can manage, Assistant can only view)
router.get('/books/stats', verifyToken, requirePermission('view_reports'), bookController.getBookStats);
router.get('/books/filters', verifyToken, requirePermission('view_books'), bookController.getFilterOptions);
router.get('/books/search', verifyToken, requirePermission('view_books'), bookController.searchBooks);
router.get('/books', verifyToken, requirePermission('view_books'), bookController.getBooks);
router.get('/books/:id', verifyToken, requirePermission('view_books'), bookController.getBookById);
router.post('/books/add', verifyToken, requirePermission('manage_books'), uploadBookFiles, logActivity('add_book', 'books'), bookController.addBook);
router.put('/books/:id', verifyToken, requirePermission('manage_books'), uploadBookFiles, logActivity('update_book', 'books'), bookController.updateBook);
router.delete('/books/:id', verifyToken, requirePermission('delete_books'), logActivity('delete_book', 'books'), bookController.deleteBook);
router.post('/books/bulk-assets', verifyToken, requirePermission('manage_books'), upload.array('assets', 100), logActivity('bulk_upload_assets', 'books'), bookController.bulkUploadAssets);

// Registration Management (Admin + Owner)
router.get('/registrations', verifyToken, requirePermission('manage_users'), registrationController.getRegistrations);
router.post('/registrations/:id/approve', verifyToken, requirePermission('manage_users'), logActivity('approve_registration', 'users'), registrationController.approveRegistration);
router.post('/registrations/:id/reject', verifyToken, requirePermission('manage_users'), logActivity('reject_registration', 'users'), registrationController.rejectRegistration);

// Payment Management (Admin + Owner)
router.get('/payments', verifyToken, requirePermission('view_reports'), paymentController.getPayments);
router.post('/payments/:id/verify', verifyToken, requirePermission('manage_users'), logActivity('verify_payment', 'payments'), paymentController.verifyPayment);
router.post('/payments/:id/request-screenshot', verifyToken, requirePermission('manage_users'), logActivity('request_screenshot', 'payments'), paymentController.requestScreenshot);

// Activity Logs (Admin can view their own, Owner can view all)
router.get('/activity-logs', verifyToken, requirePermission('view_activity_logs'), activityController.getActivityLogs);

// Data Import/Export (Admin + Owner)
router.post('/import/users', verifyToken, requirePermission('manage_users'), upload.single('file'), logActivity('import_users', 'users'), importController.importUsers);
router.post('/import/books', verifyToken, requirePermission('manage_books'), upload.single('file'), logActivity('import_books', 'books'), importController.importBooks);
router.get('/import/sample/:type', verifyToken, requirePermission('view_books'), importController.downloadSample);

// Label Printing (Admin + Owner)
router.get('/labels/books', verifyToken, requirePermission('manage_books'), labelController.getLabelSelectionBooks);

// Reports (Admin + Owner, limited for Admin)
router.get('/reports', verifyToken, requirePermission('view_reports'), reportController.getReports);

// Borrow Requests (Admin + Owner)
router.get('/borrow-requests', verifyToken, requirePermission('view_reports'), borrowRequestController.getAllRequests);
router.post('/borrow-requests/:id/approve', verifyToken, requirePermission('issue_books'), logActivity('approve_borrow_request', 'circulation'), borrowRequestController.approveRequest);
router.post('/borrow-requests/:id/reject', verifyToken, requirePermission('issue_books'), logActivity('reject_borrow_request', 'circulation'), borrowRequestController.rejectRequest);

// ================================================
// CIRCULATION ROUTES (Assistant + Admin + Owner)
// ================================================

// These routes are accessible to all authenticated admin users (including assistants)
router.post('/circulation/issue', verifyToken, requirePermission('issue_books'), logActivity('issue_book', 'circulation'), async (req, res) => {
  // Implementation will be in circulation controller
  res.json({ message: 'Issue book endpoint - to be implemented' });
});

router.post('/circulation/return', verifyToken, requirePermission('return_books'), logActivity('return_book', 'circulation'), async (req, res) => {
  // Implementation will be in circulation controller
  res.json({ message: 'Return book endpoint - to be implemented' });
});

router.post('/circulation/renew', verifyToken, requirePermission('renew_books'), logActivity('renew_book', 'circulation'), async (req, res) => {
  // Implementation will be in circulation controller
  res.json({ message: 'Renew book endpoint - to be implemented' });
});

// ================================================
// PERMISSIONS & ROLE INFO
// ================================================

// Get current user's permissions
router.get('/permissions/me', verifyToken, async (req, res) => {
  try {
    // Owner has all permissions
    if (req.user.role === 'owner') {
      const allPermissions = await query('SELECT permission_key FROM permissions');
      return res.json({
        success: true,
        role: 'owner',
        permissions: allPermissions.map(p => p.permission_key),
        isOwner: true
      });
    }

    // Get role-specific permissions
    const permissions = await query(`
      SELECT p.permission_key, p.permission_name, p.category
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role = ?
    `, [req.user.role]);

    res.json({
      success: true,
      role: req.user.role,
      permissions: permissions.map(p => p.permission_key),
      permissionsDetail: permissions,
      isOwner: false
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Get all available permissions (Owner only)
router.get('/permissions/all', verifyToken, requireOwner, async (req, res) => {
  try {
    const permissions = await query('SELECT * FROM permissions ORDER BY category, permission_name');
    res.json({ success: true, permissions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Get role permissions mapping (Owner only)
router.get('/permissions/roles', verifyToken, requireOwner, async (req, res) => {
  try {
    const mapping = await query(`
      SELECT rp.role, p.permission_key, p.permission_name, p.category
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      ORDER BY rp.role, p.category, p.permission_name
    `);

    // Group by role
    const grouped = mapping.reduce((acc, item) => {
      if (!acc[item.role]) acc[item.role] = [];
      acc[item.role].push({
        key: item.permission_key,
        name: item.permission_name,
        category: item.category
      });
      return acc;
    }, {});

    res.json({ success: true, rolePermissions: grouped });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch role permissions' });
  }
});

const reservationController = require('../controllers/reservationController');
const bookSuggestionController = require('../controllers/bookSuggestionController');

// Reservations Management
router.get('/reservations', verifyToken, requireAssistant, reservationController.getAllReservations);
router.put('/reservations/:id/status', verifyToken, requireAdmin, reservationController.updateReservationStatus);

// Book Suggestions Management
router.get('/book-suggestions', verifyToken, requireAssistant, bookSuggestionController.getAllSuggestions);
router.put('/book-suggestions/:id/status', verifyToken, requireAdmin, bookSuggestionController.updateSuggestionStatus);

module.exports = router;
