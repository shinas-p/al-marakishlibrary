const { query, queryOne } = require('../config/database');

/**
 * OPAC search with advanced filters
 */
const search = async (req, res) => {
  try {
    const {
      q,
      query: searchQuery,
      f_title, f_author, f_subject, f_language, f_category, f_publisher,
      f_availability, f_year_from, f_year_to, f_acc_from, f_acc_to,
      page = 1, limit = 20
    } = req.query;

    const searchTerm = q || searchQuery;

    // Use a simpler base query to avoid complexity with subqueries if possible
    let whereClause = ' WHERE 1=1';
    const params = [];

    if (searchTerm) {
      whereClause += ` AND (title LIKE ? OR author LIKE ? OR isbn LIKE ? OR accession_number LIKE ? OR category LIKE ? OR language LIKE ?)`;
      const pattern = `%${searchTerm}%`;
      params.push(pattern, pattern, pattern, pattern, pattern, pattern);
    }

    if (f_title) { whereClause += ` AND title LIKE ?`; params.push(`%${f_title}%`); }
    if (f_author) { whereClause += ` AND author LIKE ?`; params.push(`%${f_author}%`); }
    if (f_category || f_subject) { whereClause += ` AND category LIKE ?`; params.push(`%${f_category || f_subject}%`); }
    if (f_language) { whereClause += ` AND language = ?`; params.push(f_language); }
    if (f_publisher) { whereClause += ` AND publisher LIKE ?`; params.push(`%${f_publisher}%`); }

    if (f_availability === 'available') {
      whereClause += ` AND count > 0 AND status = 'Available'`;
    } else if (f_availability === 'issued') {
      whereClause += ` AND (count <= 0 OR status != 'Available')`;
    }

    if (f_year_from) { whereClause += ` AND publication_year >= ?`; params.push(f_year_from); }
    if (f_year_to) { whereClause += ` AND publication_year <= ?`; params.push(f_year_to); }

    if (f_acc_from) { whereClause += ` AND CAST(NULLIF(regexp_replace(accession_number, '[^0-9]', '', 'g'), '0') AS BIGINT) >= ?`; params.push(parseInt(f_acc_from)); }
    if (f_acc_to) { whereClause += ` AND CAST(NULLIF(regexp_replace(accession_number, '[^0-9]', '', 'g'), '0') AS BIGINT) <= ?`; params.push(parseInt(f_acc_to)); }

    // Count query
    const totalResult = await queryOne(`SELECT COUNT(*) as total FROM books ${whereClause}`, params);
    const total = totalResult?.total || 0;

    // Main query
    let sql = `
      SELECT id, title, author, category, language, accession_number, 
             isbn, count, status, cover_image, description, publisher, publication_year
      FROM books
      ${whereClause}
      ORDER BY title ASC
      LIMIT ? OFFSET ?
    `;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const books = await query(sql, [...params, parseInt(limit), offset]);

    // Format books for frontend
    const formattedBooks = books.map(b => ({
      ...b,
      cover_image: b.cover_image ? `/uploads/covers/${b.cover_image}` : '/assets/default-book-cover.png',
      available: b.count > 0 && b.status === 'Available',
      status_text: (b.count > 0 && b.status === 'Available') ? 'Available' : 'Issued / Unavailable'
    }));

    res.json({
      success: true,
      books: formattedBooks,
      pagination: {
        current_page: parseInt(page),
        limit: parseInt(limit),
        total_books: total,
        total_pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('OPAC search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

/**
 * Get distinct filter options
 */
const getFilters = async (req, res) => {
  try {
    const [categories, languages, publishers] = await Promise.all([
      query("SELECT DISTINCT category FROM books WHERE category IS NOT NULL AND category != '' ORDER BY category"),
      query("SELECT DISTINCT language FROM books WHERE language IS NOT NULL AND language != '' ORDER BY language"),
      query("SELECT DISTINCT publisher FROM books WHERE publisher IS NOT NULL AND publisher != '' ORDER BY publisher")
    ]);

    res.json({
      success: true,
      categories: categories.map(c => c.category),
      languages: languages.map(l => l.language),
      publishers: publishers.map(p => p.publisher)
    });
  } catch (error) {
    console.error('Get filters error:', error);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
};

/**
 * Autocomplete for OPAC search
 */
const getAutocomplete = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const pattern = `%${q}%`;
    const results = [];

    // Search titles
    const titles = await query("SELECT DISTINCT title, 'title' as type FROM books WHERE title LIKE ? LIMIT 5", [pattern]);
    results.push(...titles.map(t => ({ text: t.title, type: 'title' })));

    // Search authors
    const authors = await query("SELECT DISTINCT author, 'author' as type FROM books WHERE author LIKE ? LIMIT 3", [pattern]);
    results.push(...authors.map(a => ({ text: a.author, type: 'author' })));

    // Search categories
    const categories = await query("SELECT DISTINCT category, 'category' as type FROM books WHERE category LIKE ? LIMIT 2", [pattern]);
    results.push(...categories.map(c => ({ text: c.category, type: 'category' })));

    res.json(results);
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
};

/**
 * Get book details for OPAC
 */
const getBookDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const book = await queryOne(`SELECT * FROM books WHERE id = ?`, [id]);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Format fields
    book.cover_image = book.cover_image ? `/uploads/covers/${book.cover_image}` : '/assets/default-book-cover.png';
    book.available = book.count > 0 && book.status === 'Available';
    book.status_text = book.available ? 'Available' : 'Issued / Unavailable';

    res.json({ success: true, book });
  } catch (error) {
    console.error('Get book details error:', error);
    res.status(500).json({ error: 'Failed to fetch book details' });
  }
};

/**
 * Get popular books
 */
const getPopularBooks = async (req, res) => {
  try {
    // Since we might not have a popular_books table yet, just use most borrowed
    const books = await query(`
            SELECT b.id, b.title, b.author, b.cover_image, COUNT(t.id) as borrow_count
            FROM books b
            LEFT JOIN transactions t ON b.id = t.book_id
            GROUP BY b.id, b.title, b.author, b.cover_image
            ORDER BY borrow_count DESC, b.id DESC
            LIMIT 10
        `);

    res.json({
      success: true,
      books: books.map(b => ({
        ...b,
        cover_image: b.cover_image ? `/uploads/covers/${b.cover_image}` : '/assets/default-book-cover.png'
      }))
    });
  } catch (error) {
    console.error('Get popular error:', error);
    res.status(500).json({ error: 'Failed to fetch popular books' });
  }
};

/**
 * Get recent arrivals
 */
const getRecentBooks = async (req, res) => {
  try {
    const books = await query(`
            SELECT id, title, author, cover_image 
            FROM books 
            ORDER BY id DESC 
            LIMIT 15
        `);

    res.json({
      success: true,
      books: books.map(b => ({
        ...b,
        cover_image: b.cover_image ? `/uploads/covers/${b.cover_image}` : '/assets/default-book-cover.png'
      }))
    });
  } catch (error) {
    console.error('Get recent error:', error);
    res.status(500).json({ error: 'Failed to fetch recent arrivals' });
  }
};

/**
 * Create borrow request
 */
const createBorrowRequest = async (req, res) => {
  try {
    const { book_id } = req.body;
    const userId = req.user.id;

    if (!book_id) return res.status(400).json({ error: 'Book ID is required' });

    // Check availability
    const book = await queryOne('SELECT id, count, status FROM books WHERE id = ?', [book_id]);
    if (!book || book.count <= 0 || book.status !== 'Available') {
      return res.status(400).json({ success: false, message: 'Book is not available' });
    }

    // Check active requests
    const existing = await queryOne(
      "SELECT id FROM borrow_requests WHERE user_id = ? AND book_id = ? AND status = 'pending'",
      [userId, book_id]
    );

    if (existing) {
      return res.status(400).json({ success: false, message: 'You already have a pending request for this book' });
    }

    await query(
      "INSERT INTO borrow_requests (user_id, book_id, status, request_date) VALUES (?, ?, 'pending', NOW())",
      [userId, book_id]
    );

    // Notify Admins
    const student = await queryOne('SELECT full_name, ad_no FROM users WHERE id = ?', [userId]);
    const bookTitle = (await queryOne('SELECT title FROM books WHERE id = ?', [book_id]))?.title || 'a book';
    const notifTitle = 'New Borrow Request';
    const notifMsg = `${student.full_name} (${student.ad_no}) requested: ${bookTitle}`;

    await query(
      'INSERT INTO announcements (title, message, target_role, created_by) VALUES (?, ?, ?, ?)',
      [notifTitle, notifMsg, 'admin', userId]
    );

    res.json({
      success: true,
      message: 'Borrow request submitted successfully!'
    });
  } catch (error) {
    console.error('Borrow request error:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
};

/**
 * Get user borrow requests
 */
const getBorrowRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await query(`
            SELECT br.*, b.title, b.author, b.cover_image
            FROM borrow_requests br
            JOIN books b ON br.book_id = b.id
            WHERE br.user_id = ?
            ORDER BY br.id DESC
        `, [userId]);

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get borrow requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
};

module.exports = {
  search,
  getFilters,
  getAutocomplete,
  getBookDetails,
  getPopularBooks,
  getRecentBooks,
  createBorrowRequest,
  getBorrowRequests
};
