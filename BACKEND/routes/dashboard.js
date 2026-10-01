const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken, requireAdmin, requireStudent, requireAssistant } = require('../middleware/rbac');

router.get('/stats', verifyToken, requireAssistant, dashboardController.getStats);
router.get('/recent-transactions', verifyToken, requireAssistant, dashboardController.getRecentTransactions);
router.get('/top-admins', verifyToken, requireAssistant, dashboardController.getTopIssuingAdmins);
router.get('/most-active-students', verifyToken, requireAssistant, dashboardController.getMostActiveStudents);
router.get('/notifications', verifyToken, requireAssistant, dashboardController.getNotificationCounts);
router.get('/admin', verifyToken, requireAssistant, dashboardController.getAdminDashboard);
router.get('/student', verifyToken, requireStudent, dashboardController.getStudentDashboard);

module.exports = router;
