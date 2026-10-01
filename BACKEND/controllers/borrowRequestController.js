const { query, queryOne, beginTransaction, commit, rollback } = require('../config/database');
const { logAdminActivity, logBookIssueAudit } = require('../helpers/adminHelper');
const moment = require('moment');

/**
 * Get all borrow requests for admin
 */
const getAllRequests = async (req, res) => {
    try {
        const { status = 'pending' } = req.query;
        const requests = await query(`
            SELECT br.*, u.full_name, u.ad_no, b.title, b.author, b.cover_image, b.accession_number
            FROM borrow_requests br
            JOIN users u ON br.user_id = u.id
            JOIN books b ON br.book_id = b.id
            WHERE br.status = ?
            ORDER BY br.request_date DESC
        `, [status]);

        res.json({ success: true, requests });
    } catch (error) {
        console.error('Get all requests error:', error);
        res.status(500).json({ error: 'Failed to fetch borrow requests' });
    }
};

/**
 * Approve borrow request
 */
const approveRequest = async (req, res) => {
    const connection = await beginTransaction();
    try {
        const { id } = req.params;
        const { due_date } = req.body;

        const request = await queryOne('SELECT * FROM borrow_requests WHERE id = ? AND status = ?', [id, 'pending']);
        if (!request) {
            await rollback(connection);
            return res.status(404).json({ error: 'Request not found or already processed' });
        }

        const book = await queryOne('SELECT id, count, title FROM books WHERE id = ?', [request.book_id]);
        if (!book || book.count <= 0) {
            await rollback(connection);
            return res.status(400).json({ error: 'Book is no longer available' });
        }

        const borrow_date = moment().format('YYYY-MM-DD');
        const final_due_date = due_date || moment().add(14, 'days').format('YYYY-MM-DD');

        // Create transaction
        const [result] = await connection.execute(
            `INSERT INTO transactions (user_id, book_id, borrow_date, due_date, status, action_source) 
             VALUES (?, ?, ?, ?, 'Borrowed', 'request')`,
            [request.user_id, request.book_id, borrow_date, final_due_date]
        );

        const transactionId = result.insertId;

        // Update book count
        await connection.execute('UPDATE books SET count = count - 1 WHERE id = ?', [request.book_id]);

        // Update request status
        await connection.execute('UPDATE borrow_requests SET status = ?, processed_at = NOW(), transaction_id = ? WHERE id = ?',
            ['Approved', transactionId, id]
        );

        await commit(connection);

        await logAdminActivity(req.user.id, 'approve_borrow_request', `Approved borrow request for book: ${book.title}`);
        await logBookIssueAudit(transactionId, request.book_id, request.user_id, req.user.id, 'request', 'issue');

        // Notify Student
        await query(
            'INSERT INTO user_notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
            [request.user_id, 'Request Approved', `Your request for "${book.title}" has been approved. Book issued until ${final_due_date}.`, 'success']
        );

        res.json({ success: true, message: 'Request approved and book issued' });
    } catch (error) {
        await rollback(connection);
        console.error('Approve request error:', error);
        res.status(500).json({ error: 'Failed to approve request' });
    }
};

/**
 * Reject borrow request
 */
const rejectRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Fetch request details for notification
        const request = await queryOne(`
            SELECT br.user_id, b.title 
            FROM borrow_requests br
            JOIN books b ON br.book_id = b.id
            WHERE br.id = ? AND br.status = 'pending'
        `, [id]);

        if (!request) {
            return res.status(404).json({ error: 'Request not found or already processed' });
        }

        const result = await query('UPDATE borrow_requests SET status = ?, rejection_reason = ?, processed_at = NOW() WHERE id = ? AND status = ?',
            ['Rejected', reason || 'Not specified', id, 'pending']
        );

        await logAdminActivity(req.user.id, 'reject_borrow_request', `Rejected borrow request ID: ${id}`);

        // Notify Student
        await query(
            'INSERT INTO user_notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
            [request.user_id, 'Request Rejected', `Your request for "${request.title}" was rejected. Reason: ${reason || 'Admin decision'}`, 'error']
        );

        res.json({ success: true, message: 'Request rejected' });
    } catch (error) {
        console.error('Reject request error:', error);
        res.status(500).json({ error: 'Failed to reject request' });
    }
};

module.exports = {
    getAllRequests,
    approveRequest,
    rejectRequest
};
