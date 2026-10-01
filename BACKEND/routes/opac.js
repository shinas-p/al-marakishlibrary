const express = require('express');
const router = express.Router();
const opacController = require('../controllers/opacController');
const { authenticate } = require('../middleware/auth');

// Public OPAC routes
router.get('/search', opacController.search);
router.get('/book/:id', opacController.getBookDetails);
router.get('/popular', opacController.getPopularBooks);
router.get('/recent', opacController.getRecentBooks);
router.get('/filters', opacController.getFilters);
router.get('/autocomplete', opacController.getAutocomplete);

const reservationController = require('../controllers/reservationController');
const bookSuggestionController = require('../controllers/bookSuggestionController');

// Authenticated routes
router.post('/reserve/:bookId', authenticate, reservationController.reserveBook);
router.get('/reservations', authenticate, reservationController.getMyReservations);
router.post('/suggest-book', authenticate, bookSuggestionController.suggestBook);
router.get('/suggestions', authenticate, bookSuggestionController.getMySuggestions);

module.exports = router;
