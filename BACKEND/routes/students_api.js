const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const transactionsController = require('../controllers/transactionsController');
const { verifyToken, requirePermission } = require('../middleware/rbac');

// Support both ?query= and ?q= for compatibility
router.get('/search', verifyToken, requirePermission('view_users'), (req, res, next) => {
    if (req.query.query && !req.query.q) {
        req.query.q = req.query.query;
    }
    next();
}, userController.searchUsers);

router.get('/details/:id', verifyToken, requirePermission('view_users'), userController.getUserById);
router.get('/borrowed/:studentId', verifyToken, requirePermission('view_users'), transactionsController.getStudentBorrowedBooksAdmin);

module.exports = router;
