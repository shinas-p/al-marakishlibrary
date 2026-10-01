const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const registrationController = require('../controllers/registrationController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/admin/login', authController.adminLogin);
router.post('/student/login', authController.studentLogin);
router.post('/student/register', registrationController.submitRegistration);

// Protected routes
router.get('/verify', authenticate, authController.verifyToken);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
