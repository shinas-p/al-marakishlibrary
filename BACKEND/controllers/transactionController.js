const { query, queryOne } = require('../config/database');
const { logAdminActivity } = require('../helpers/adminHelper');

/**
 * Get all transactions
 */
const getAllTransactions = async (req, res) => {
    try {
        const { search, status } = req.query;

        let sql = `
      SELECT t.id, t.user_id, t.book_id, u.full_name, b.title, t.borrow_date, t.due_date, 
             t.return_date, t.status, t.fine, t.renewed
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      JOIN books b ON t.book_id = b.id
      WHERE 1=1
    `;
        let params = [];

        if (search) {
            const searchTerm = `%${search}%`;
            sql += ' AND (u.full_name LIKE ? OR b.title LIKE ?)';
            params.push(searchTerm, searchTerm);
        }

        if (status) {
            sql += ' AND t.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY t.id DESC';

        const transactions = await query(sql, params);

        // Calculate live fines for borrowed books
        const processedTransactions = transactions.map(row => {
            let liveFine = row.fine || 0;
            if (row.status === 'Borrowed') {
                const dueDate = new Date(row.due_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (today > dueDate) {
                    const diffTime = Math.abs(today - dueDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    liveFine = diffDays * 5; // ₹5 per day
                }
            }
            return { ...row, liveFine };
        });

        res.json({ success: true, transactions: processedTransactions });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Failed to load transactions' });
    }
};

module.exports = {
    getAllTransactions
};
