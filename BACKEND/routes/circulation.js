const express = require('express');
const router = express.Router();
const circulationController = require('../controllers/circulationController');
const { requireAdmin } = require('../middleware/auth');

// All circulation routes require admin privileges
router.get('/student/:ad_no', requireAdmin, circulationController.identifyStudent);
router.get('/transactions/active-count/:student_id', requireAdmin, circulationController.getActiveCount);
router.get('/book/:accession_no', requireAdmin, circulationController.identifyBook);
router.get('/book-details/:accession_no', requireAdmin, circulationController.getBookByAccession);
router.post('/process', requireAdmin, circulationController.processCirculation);
router.post('/checkin-standalone', requireAdmin, circulationController.performCheckIn);

module.exports = router;
