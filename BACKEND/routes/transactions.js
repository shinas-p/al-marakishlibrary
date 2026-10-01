const express = require('express');
const router = express.Router();
const transactionsController = require('../controllers/transactionsController');
const {
    verifyToken,
    requirePermission,
    requireAssistant,
    requireAdmin
} = require('../middleware/rbac');

// Student routes
const { requireStudent } = require('../middleware/auth');
router.get('/student', requireStudent, transactionsController.getStudentBooks);

// Admin & Staff routes (using RBAC)
router.get('/stats', verifyToken, requirePermission('view_reports'), transactionsController.getTransactionStats);
router.get('/overdue', verifyToken, requirePermission('view_reports'), transactionsController.getOverdueBooks);
router.get('/:id', verifyToken, requirePermission('view_reports'), transactionsController.getTransactionById);
router.get('/', verifyToken, requirePermission('view_reports'), transactionsController.getTransactions);

router.post('/borrow', verifyToken, requirePermission('issue_books'), transactionsController.borrowBook);
router.post('/return', verifyToken, requirePermission('return_books'), transactionsController.returnBook);

module.exports = router;
