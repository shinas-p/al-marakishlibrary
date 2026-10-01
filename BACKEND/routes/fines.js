const express = require('express');
const router = express.Router();
const finesController = require('../controllers/finesController');
const {
    verifyToken,
    requirePermission,
    requireAdmin
} = require('../middleware/rbac');

// Student routes
router.get('/student', verifyToken, finesController.getStudentFines);
router.post('/student/pay', verifyToken, finesController.submitFinePayment);
router.get('/student/payments', verifyToken, finesController.getMyPayments);
router.post('/student/payment/:id/proof', verifyToken, finesController.uploadPaymentProof);

// Admin & Staff routes (RBAC protected)
router.get('/', verifyToken, requirePermission('view_reports'), finesController.getFines);
router.get('/:id', verifyToken, requirePermission('view_reports'), finesController.getFineById);
router.post('/', verifyToken, requirePermission('manage_users'), finesController.addCustomFine);
router.put('/:id/approve', verifyToken, requirePermission('manage_users'), finesController.approveFine);
router.put('/:id/reject', verifyToken, requirePermission('manage_users'), finesController.rejectFine);
router.put('/payment/:id/approve', verifyToken, requirePermission('manage_users'), finesController.approvePayment);
router.put('/payment/:id/reject', verifyToken, requirePermission('manage_users'), finesController.rejectPayment);
router.post('/cash-payment', verifyToken, requireAdmin, finesController.recordCashFinePayment);

// Payment Receipt (Student & Admin)
const paymentController = require('../controllers/paymentController');
router.get('/payment/:id/receipt', verifyToken, paymentController.getPaymentReceiptData);

module.exports = router;
