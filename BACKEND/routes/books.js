const express = require('express');
const router = express.Router();
const booksController = require('../controllers/booksController');
const { requireAdmin, authenticate } = require('../middleware/auth');
const { uploadBookFiles } = require('../middleware/upload');
const multer = require('multer');

// Public routes
router.get('/search', booksController.searchBooks);
router.get('/stats', booksController.getBookStats);
router.get('/filters', booksController.getFilterOptions);
router.get('/:id', booksController.getBookById);
router.get('/', booksController.getBooks);

// Admin routes
router.post('/add', requireAdmin, uploadBookFiles, booksController.addBook);
router.put('/:id', requireAdmin, uploadBookFiles, booksController.updateBook);
router.delete('/bulk', requireAdmin, booksController.bulkDeleteBooks);
router.delete('/:id', requireAdmin, booksController.deleteBook);

module.exports = router;
