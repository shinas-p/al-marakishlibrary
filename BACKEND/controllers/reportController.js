const { query } = require('../config/database');

/**
 * Get library statistics and reports
 */
const getReports = async (req, res) => {
    try {
        // Most Borrowed Books
        const mostBorrowed = await query(`
            SELECT b.title, b.author, COUNT(t.id) AS borrow_count
            FROM transactions t
            JOIN books b ON t.book_id = b.id
            GROUP BY t.book_id, b.title, b.author
            ORDER BY borrow_count DESC
            LIMIT 10
        `);

        // Best Readers
        const bestReaders = await query(`
            SELECT u.full_name, u.ad_no, COUNT(t.id) AS borrow_count
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            GROUP BY t.user_id, u.full_name, u.ad_no
            ORDER BY borrow_count DESC
            LIMIT 10
        `);

        // Category-wise distribution
        const categoryStats = await query(`
            SELECT category, COUNT(*) as count 
            FROM books 
            WHERE category IS NOT NULL AND category != ''
            GROUP BY category 
            ORDER BY count DESC
        `);

        // Monthly Transactions (Last 6 months)
        const monthlyStats = await query(`
            SELECT TO_CHAR(borrow_date, 'Mon YYYY') as month, COUNT(*) as count
            FROM transactions
            WHERE borrow_date >= (CURRENT_DATE - INTERVAL '6 MONTH')
            GROUP BY TO_CHAR(borrow_date, 'Mon YYYY'), DATE_TRUNC('month', borrow_date)
            ORDER BY DATE_TRUNC('month', borrow_date)
        `);

        res.json({
            success: true,
            mostBorrowed,
            bestReaders,
            categoryStats,
            monthlyStats
        });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Failed to fetch report data' });
    }
};

module.exports = {
    getReports
};
