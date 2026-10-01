const { query, queryOne } = require('../config/database');
const { logAdminActivity } = require('../helpers/adminHelper');

/**
 * OPAC: Suggest a new book
 */
const suggestBook = async (req, res) => {
    try {
        const { title, author, category, description, reason } = req.body;
        const studentId = req.user.id;

        if (!title) {
            return res.status(400).json({ success: false, message: 'Book title is required' });
        }

        // Check for duplicate recent suggestion from same student
        const existing = await queryOne(
            "SELECT id FROM book_suggestions WHERE student_id = ? AND title = ? AND status = 'Pending'",
            [studentId, title]
        );
        if (existing) {
            return res.status(400).json({ success: false, message: 'You have already suggested this book' });
        }

        await query(
            'INSERT INTO book_suggestions (student_id, title, author, category, description, reason) VALUES (?, ?, ?, ?, ?, ?)',
            [studentId, title, author || null, category || null, description || null, reason || null]
        );

        // Notify Admins
        const student = await queryOne('SELECT full_name FROM users WHERE id = ?', [studentId]);
        const userName = student ? student.full_name : 'A student';
        const notifTitle = 'New Book Suggestion';
        const notifMsg = `${userName} suggested: "${title}"`;

        await query(
            'INSERT INTO announcements (title, message, target_role, created_by) VALUES (?, ?, ?, ?)',
            [notifTitle, notifMsg, 'admin', studentId]
        );

        res.json({ success: true, message: 'Thank you! Your suggestion has been submitted.' });
    } catch (error) {
        console.error('Suggest book error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit suggestion' });
    }
};

/**
 * OPAC: Get student suggestions
 */
const getMySuggestions = async (req, res) => {
    try {
        const studentId = req.user.id;
        const suggestions = await query(
            'SELECT * FROM book_suggestions WHERE student_id = ? ORDER BY created_at DESC',
            [studentId]
        );
        res.json({ success: true, suggestions });
    } catch (error) {
        console.error('Get my suggestions error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch suggestions' });
    }
};

/**
 * Admin: Get all suggestions
 */
const getAllSuggestions = async (req, res) => {
    try {
        const { status } = req.query;
        let sql = `
            SELECT s.*, u.full_name, u.ad_no, u.profile_photo
            FROM book_suggestions s
            JOIN users u ON s.student_id = u.id
        `;
        let params = [];

        if (status) {
            sql += ' WHERE s.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY s.created_at DESC';

        const suggestions = await query(sql, params);
        res.json({ success: true, suggestions });
    } catch (error) {
        console.error('Get all suggestions error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch suggestions' });
    }
};

/**
 * Admin: Update suggestion status
 */
const updateSuggestionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;
        const adminId = req.user.id;

        const result = await query(
            'UPDATE book_suggestions SET status = ?, admin_notes = ? WHERE id = ?',
            [status, admin_notes || null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Suggestion not found' });
        }

        await logAdminActivity(adminId, 'update_suggestion', `Marked suggestion ID ${id} as ${status}`);

        // Notify Student
        const suggestion = await queryOne('SELECT student_id, title FROM book_suggestions WHERE id = ?', [id]);
        if (suggestion) {
            const notifType = status === 'Approved' ? 'success' : 'info'; // or error for rejected? 'info' is safe.
            const notifMsg = `Your suggestion for "${suggestion.title}" has been ${status}. ${admin_notes ? `Note: ${admin_notes}` : ''}`;

            await query(
                'INSERT INTO user_notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
                [suggestion.student_id, 'Suggestion Update', notifMsg, notifType]
            );
        }

        res.json({ success: true, message: `Suggestion status updated to ${status}` });
    } catch (error) {
        console.error('Update suggestion error:', error);
        res.status(500).json({ success: false, message: 'Failed to update suggestion' });
    }
};

module.exports = {
    suggestBook,
    getMySuggestions,
    getAllSuggestions,
    updateSuggestionStatus
};
