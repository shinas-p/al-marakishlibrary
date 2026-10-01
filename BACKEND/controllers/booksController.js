const { query, queryOne, beginTransaction, commit, rollback } = require('../config/database');
const { logAdminActivity } = require('../helpers/adminHelper');
const path = require('path');
const fs = require('fs');

/**
 * Get all books with filters and pagination
 */
const getBooks = async (req, res) => {
  try {
    const { search, status, category, language, sort = 'accession_number', order = 'ASC', page = 1, limit = 50, ids } = req.query;

    let sql = 'SELECT * FROM books WHERE 1=1';
    const params = [];

    // Filter by IDs if provided
    if (ids) {
      const idArray = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (idArray.length > 0) {
        sql += ` AND id IN (${idArray.map(() => '?').join(',')})`;
        params.push(...idArray);
      }
    }
    let paramIndex = 1;

    // Search filter
    if (search) {
      const searchPattern = `%${search}%`;
      sql += ` AND (accession_number LIKE ? OR title LIKE ? OR author LIKE ? OR isbn LIKE ? OR language LIKE ?)`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      paramIndex += 5;
    }

    // Status filter
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    // Category filter
    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }

    // Language filter
    if (language) {
      sql += ` AND language = ?`;
      params.push(language);
    }

    // Validate sort column
    const allowedSorts = ['id', 'accession_number', 'title', 'author', 'category', 'language', 'created_at'];
    const sortColumn = allowedSorts.includes(sort) ? sort : 'accession_number';
    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Special handling for accession_number to ensure numeric sorting
    if (sortColumn === 'accession_number') {
      sql += ` ORDER BY CAST(NULLIF(regexp_replace(accession_number, '[^0-9]', '', 'g'), '0') AS BIGINT) ${sortOrder}, accession_number ${sortOrder}`;
    } else {
      sql += ` ORDER BY ${sortColumn} ${sortOrder}`;
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const books = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM books WHERE 1=1';
    const countParams = [];

    if (ids) {
      const idArray = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (idArray.length > 0) {
        countSql += ` AND id IN (${idArray.map(() => '?').join(',')})`;
        countParams.push(...idArray);
      }
    }

    if (search) {
      const searchPattern = `%${search}%`;
      countSql += ` AND (accession_number LIKE ? OR title LIKE ? OR author LIKE ? OR isbn LIKE ? OR language LIKE ?)`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }
    if (status) {
      countSql += ` AND status = ?`;
      countParams.push(status);
    }
    if (category) {
      countSql += ` AND category = ?`;
      countParams.push(category);
    }
    if (language) {
      countSql += ` AND language = ?`;
      countParams.push(language);
    }

    const totalResult = await queryOne(countSql, countParams);
    const total = totalResult?.total || 0;

    res.json({
      success: true,
      books,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
};

/**
 * Get single book by ID
 */
const getBookById = async (req, res) => {
  try {
    const { id } = req.params;
    let book = await queryOne('SELECT * FROM books WHERE id = ?', [id]);

    // Fallback: search by accession_number if not found by primary ID
    if (!book) {
      book = await queryOne('SELECT * FROM books WHERE accession_number = ?', [id]);
    }

    if (!book) {
      return res.status(404).json({ error: 'Book record not found in system' });
    }

    res.json({ success: true, book });
  } catch (error) {
    console.error('Get book error:', error);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
};

/**
 * Search books (for autocomplete/live search)
 */
const searchBooks = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 1) {
      return res.json({ results: [], total: 0 });
    }

    const searchPattern = `%${q}%`;
    const sql = `
      SELECT 
        id,
        accession_number,
        title,
        author,
        category,
        language,
        count,
        status,
        cover_image
      FROM books
      WHERE 
        accession_number LIKE ? OR
        title LIKE ? OR
        author LIKE ? OR
        isbn LIKE ? OR
        category LIKE ?
      ORDER BY 
        CASE
          WHEN accession_number = ? THEN 1
          WHEN title = ? THEN 2
          WHEN accession_number LIKE ? THEN 3
          WHEN title LIKE ? THEN 4
          ELSE 5
        END,
        title ASC
      LIMIT ?
    `;

    const books = await query(sql, [
      searchPattern, searchPattern, searchPattern, searchPattern, searchPattern,
      q, q, searchPattern, searchPattern, parseInt(limit)
    ]);

    res.json({ success: true, books: books, total: books.length });
  } catch (error) {
    console.error('Search books error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

/**
 * Add new book
 */
const addBook = async (req, res) => {
  try {
    const {
      title,
      accession_number,
      isbn,
      author,
      category,
      publisher,
      publication_year,
      edition,
      pages,
      price,
      quantity,
      location,
      description,
      call_number,
      language = 'English',
      status = 'Available',
      volume
    } = req.body;

    // Validation
    if (!title || !accession_number || !quantity || quantity < 1) {
      return res.status(400).json({ error: 'Title, Accession Number, and Quantity (>=1) are required' });
    }

    // Check for duplicate accession number
    const existing = await queryOne(
      'SELECT id FROM books WHERE accession_number = ?',
      [accession_number]
    );

    if (existing) {
      return res.status(400).json({ error: 'Accession number already exists' });
    }

    // Handle file uploads
    const cover_image = req.files?.cover_image ? req.files.cover_image[0]?.filename : null;
    const ebook = req.files?.ebook ? req.files.ebook[0]?.filename : null;

    const book_number = accession_number; // For backward compatibility

    const sql = `
      INSERT INTO books
        (book_number, accession_number, isbn, title, author, category, publisher, 
         publication_year, edition, volume, pages, price, count, location, 
         description, call_number, language, cover_image, ebook, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [
      book_number,
      accession_number,
      isbn || null,
      title,
      author || null,
      category || null,
      publisher || null,
      publication_year || null,
      edition || null,
      volume || null,
      pages > 0 ? pages : null,
      price ? parseFloat(price) : null,
      Math.max(1, parseInt(quantity)),
      location || null,
      description || null,
      call_number || null,
      language,
      cover_image,
      ebook,
      status
    ]);

    // Log activity
    if (req.user && req.user.type === 'admin') {
      await logAdminActivity(
        req.user.id,
        'add_book',
        `Added new book: ${title} (Acc No: ${accession_number})`
      );
    }

    res.json({
      success: true,
      message: 'Book added successfully',
      book: { id: result.insertId, accession_number, title }
    });
  } catch (error) {
    console.error('Add book error:', error);
    res.status(500).json({ error: 'Failed to add book: ' + error.message });
  }
};

/**
 * Update book
 */
const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    // Check if book exists first to get current data
    const existing = await queryOne('SELECT * FROM books WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const {
      title = existing.title,
      accession_number = existing.accession_number,
      isbn = existing.isbn,
      author = existing.author,
      category = existing.category,
      publisher = existing.publisher,
      publication_year = existing.publication_year,
      edition = existing.edition,
      volume = existing.volume,
      pages = existing.pages,
      price = existing.price,
      count = existing.count,
      location = existing.location,
      description = existing.description,
      call_number = existing.call_number,
      language = existing.language,
      status = null
    } = req.body;

    // Check for duplicate accession number (excluding current book)
    if (accession_number !== existing.accession_number) {
      const duplicate = await queryOne(
        'SELECT id FROM books WHERE accession_number = ? AND id != ?',
        [accession_number, id]
      );
      if (duplicate) {
        return res.status(400).json({ error: 'Accession number already exists' });
      }
    }

    // Handle file uploads
    let cover_image = existing.cover_image;
    let ebook = existing.ebook;

    if (req.files?.cover_image) {
      // Delete old cover
      if (cover_image) {
        const oldPath = path.join(__dirname, '../uploads/covers', cover_image);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      cover_image = req.files.cover_image[0]?.filename || cover_image;
    }

    if (req.files?.ebook) {
      // Delete old ebook
      if (ebook) {
        const oldPath = path.join(__dirname, '../uploads/ebooks', ebook);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      ebook = req.files.ebook[0]?.filename || ebook;
    }

    // Determine status: 
    // 1. If explicit status provided, use it.
    // 2. If count becomes 0, force 'Unavailable'.
    // 3. Otherwise, stick with current status.
    let finalStatus = status || existing.status;
    if (parseInt(count) === 0) {
      finalStatus = 'Unavailable';
    } else if (!status && existing.status === 'Unavailable' && existing.count === 0 && parseInt(count) > 0) {
      // Auto-re-enable only if it was unavailable specifically because of 0 stock
      finalStatus = 'Available';
    }

    console.log(`[DEBUG] Updating book ${id}: count=${count}, reqStatus=${status}, existingStatus=${existing.status}, finalStatus=${finalStatus}`);

    const sql = `
      UPDATE books SET
        title = ?,
        accession_number = ?,
        isbn = ?,
        author = ?,
        category = ?,
        publisher = ?,
        publication_year = ?,
        edition = ?,
        volume = ?,
        pages = ?,
        price = ?,
        count = ?,
        location = ?,
        description = ?,
        call_number = ?,
        language = ?,
        status = ?,
        cover_image = ?,
        ebook = ?
      WHERE id = ?
    `;

    await query(sql, [
      title,
      accession_number,
      isbn || null,
      author || null,
      category || null,
      publisher || null,
      publication_year || null,
      edition || null,
      volume || null,
      pages > 0 ? pages : null,
      price ? parseFloat(price) : null,
      parseInt(count) || 0,
      location || null,
      description || null,
      call_number || null,
      language || 'English',
      finalStatus,
      cover_image,
      ebook,
      id
    ]);

    // Log activity
    if (req.user && req.user.type === 'admin') {
      await logAdminActivity(
        req.user.id,
        'update_book',
        `Updated book: ${title} (ID: ${id})`
      );
    }

    res.json({ success: true, message: 'Book updated successfully' });
  } catch (error) {
    console.error('Update book error:', error);
    res.status(500).json({ error: 'Failed to update book: ' + error.message });
  }
};

/**
 * Delete book
 */
const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;

    const book = await queryOne('SELECT * FROM books WHERE id = ?', [id]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Check if book has ANY transactions (even returned) to avoid FK constraint errors
    // If you want to allow deleting books with returned transactions, 
    // you'd need to set transaction.book_id to NULL or CASCADE.
    const transaction = await queryOne(
      'SELECT id, status FROM transactions WHERE book_id = ? LIMIT 1',
      [id]
    );

    if (transaction) {
      if (transaction.status === 'Borrowed' || transaction.status === 'Overdue') {
        return res.status(400).json({ error: 'Cannot delete book that is currently borrowed' });
      } else {
        return res.status(400).json({ error: 'Cannot delete book because it has transaction history' });
      }
    }

    // Delete associated files
    if (book.cover_image) {
      const coverPath = path.join(__dirname, '../uploads/covers', book.cover_image);
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
      }
    }

    if (book.ebook) {
      const ebookPath = path.join(__dirname, '../uploads/ebooks', book.ebook);
      if (fs.existsSync(ebookPath)) {
        fs.unlinkSync(ebookPath);
      }
    }

    await query('DELETE FROM books WHERE id = ?', [id]);

    // Log activity
    if (req.user && req.user.type === 'admin') {
      await logAdminActivity(
        req.user.id,
        'delete_book',
        `Deleted book: ${book.title} (ID: ${id})`
      );
    }

    res.json({ success: true, message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({ error: 'Failed to delete book: ' + error.message });
  }
};

/**
 * Bulk delete books
 */
const bulkDeleteBooks = async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No book IDs provided' });
  }

  const results = {
    success: [],
    failed: []
  };

  for (const id of ids) {
    try {
      const book = await queryOne('SELECT id, title, cover_image, ebook FROM books WHERE id = ?', [id]);
      if (!book) {
        results.failed.push({ id, reason: 'Not found' });
        continue;
      }

      // Check transactions
      const transaction = await queryOne('SELECT id FROM transactions WHERE book_id = ? LIMIT 1', [id]);
      if (transaction) {
        results.failed.push({ id, title: book.title, reason: 'Has transaction history' });
        continue;
      }

      // Delete files
      if (book.cover_image) {
        const p = path.join(__dirname, '../uploads/covers', book.cover_image);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      if (book.ebook) {
        const p = path.join(__dirname, '../uploads/ebooks', book.ebook);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }

      await query('DELETE FROM books WHERE id = ?', [id]);
      results.success.push({ id, title: book.title });
    } catch (err) {
      results.failed.push({ id, reason: err.message });
    }
  }

  // Log bulk activity
  if (req.user && results.success.length > 0) {
    await logAdminActivity(
      req.user.id,
      'bulk_delete_books',
      `Bulk deleted ${results.success.length} books`,
      { successCount: results.success.length, failedCount: results.failed.length }
    );
  }

  res.json({
    success: true,
    message: `Processed ${ids.length} books. ${results.success.length} deleted, ${results.failed.length} failed.`,
    results
  });
};

/**
 * Get book statistics
 */
const getBookStats = async (req, res) => {
  try {
    const stats = await queryOne(`
      SELECT 
        COUNT(*) as total_books,
        SUM(count) as total_copies,
        COUNT(DISTINCT category) as total_categories,
        COUNT(DISTINCT language) as total_languages,
        SUM(CASE WHEN status = 'Available' THEN count ELSE 0 END) as available_copies
      FROM books
    `);

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Get book stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

/**
 * Get distinct values for filters
 */
const getFilterOptions = async (req, res) => {
  try {
    const [categories, languages, statuses] = await Promise.all([
      query('SELECT DISTINCT category FROM books WHERE category IS NOT NULL AND category != "" ORDER BY category'),
      query('SELECT DISTINCT language FROM books WHERE language IS NOT NULL AND language != "" ORDER BY language'),
      query('SELECT DISTINCT status FROM books WHERE status IS NOT NULL ORDER BY status')
    ]);

    res.json({
      success: true,
      categories: categories.map(r => r.category),
      languages: languages.map(r => r.language),
      statuses: statuses.map(r => r.status)
    });
  } catch (error) {
    console.error('Get filter options error:', error);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
};

/**
 * Bulk upload assets (covers/ebooks) and match by filename (accession_number)
 */
const bulkUploadAssets = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  let processedCount = 0;
  let failedCount = 0;
  const errors = [];

  for (const file of req.files) {
    try {
      // Get accession number from filename (e.g. 1500.jpg -> 1500)
      const accession = path.parse(file.originalname).name.trim();
      const ext = path.extname(file.originalname).toLowerCase();

      // Look for book with this accession number
      const book = await queryOne('SELECT id, cover_image, ebook FROM books WHERE accession_number = ?', [accession]);

      if (!book) {
        failedCount++;
        errors.push(`No book found with Accession No: ${accession}`);
        continue;
      }

      const isImage = file.mimetype.startsWith('image/');
      const isEbook = file.mimetype === 'application/pdf' || ext === '.pdf' || ext === '.epub';

      let newFilename = `${accession}_${Date.now()}${ext}`;
      let targetDir = '';
      let dbField = '';

      if (isImage) {
        targetDir = path.join(__dirname, '../uploads/covers');
        dbField = 'cover_image';
      } else if (isEbook) {
        targetDir = path.join(__dirname, '../uploads/ebooks');
        dbField = 'ebook';
      } else {
        failedCount++;
        errors.push(`File ${file.originalname} has unsupported format`);
        continue;
      }

      // Ensure directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Save file
      const finalPath = path.join(targetDir, newFilename);
      fs.writeFileSync(finalPath, file.buffer);

      // Delete old file if exists
      const oldFile = book[dbField];
      if (oldFile) {
        const oldPath = path.join(targetDir, oldFile);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      // Update DB
      await query(`UPDATE books SET ${dbField} = ? WHERE id = ?`, [newFilename, book.id]);
      processedCount++;

    } catch (err) {
      console.error('Bulk asset error for file:', file.originalname, err);
      failedCount++;
      errors.push(`Error processing ${file.originalname}: ${err.message}`);
    }
  }

  res.json({
    success: true,
    processedCount,
    failedCount,
    errors: errors.length > 0 ? errors : null
  });
};

module.exports = {
  getBooks,
  getBookById,
  searchBooks,
  addBook,
  updateBook,
  deleteBook,
  bulkDeleteBooks,
  getBookStats,
  getFilterOptions,
  bulkUploadAssets
};
