const { query, queryOne, beginTransaction, commit, rollback } = require('../config/database');
const { logAdminActivity } = require('../helpers/adminHelper');
const moment = require('moment');

/**
 * OPAC: Create a reservation
 */
const reserveBook = async (req, res) => {
    try {
        const { bookId } = req.params;
        const studentId = req.user.id;

        // 1. Check if book exists and is available
        const book = await queryOne('SELECT id, title, count, status FROM books WHERE id = ?', [bookId]);
        if (!book) {
            return res.status(404).json({ success: false, message: 'Book not found' });
        }

        if (book.count < 1) {
            return res.status(400).json({ success: false, message: 'No available copies for reservation' });
        }

        if (book.status !== 'Available') {
            return res.status(400).json({ success: false, message: `Book is currently ${book.status}` });
        }

        // 2. Check if student already has a pending/ready reservation for this book
        const existingRes = await queryOne(
            "SELECT id FROM reservations WHERE student_id = ? AND book_id = ? AND status IN ('Pending', 'Ready')",
            [studentId, bookId]
        );
        if (existingRes) {
            return res.status(400).json({ success: false, message: 'You already have an active reservation for this book' });
        }

        // 3. Check if student already has the book borrowed
        const existingTx = await queryOne(
            "SELECT id FROM transactions WHERE user_id = ? AND book_id = ? AND status IN ('Borrowed', 'Overdue')",
            [studentId, bookId]
        );
        if (existingTx) {
            return res.status(400).json({ success: false, message: 'You already have this book issued' });
        }

        // 4. Create reservation
        await query(
            "INSERT INTO reservations (student_id, book_id, status) VALUES (?, ?, 'Pending')",
            [studentId, bookId]
        );

        // Notify Admins
        const student = await queryOne('SELECT full_name, ad_no FROM users WHERE id = ?', [studentId]);
        const notifTitle = 'New Reservation';
        const notifMsg = `Student ${student.full_name} reserved "${book.title}"`;
        await query(
            'INSERT INTO announcements (title, message, target_role, created_by) VALUES (?, ?, ?, ?)',
            [notifTitle, notifMsg, 'admin', studentId]
        );

        res.json({ success: true, message: 'Reservation placed successfully. Please wait for approval.' });

    } catch (error) {
        console.error('Reserve book error:', error);
        res.status(500).json({ success: false, message: 'Failed to place reservation' });
    }
};

/**
 * OPAC: Get student reservations
 */
const getMyReservations = async (req, res) => {
    try {
        const studentId = req.user.id;
        const reservations = await query(`
            SELECT r.*, b.title, b.author, b.cover_image, b.accession_number
            FROM reservations r
            JOIN books b ON r.book_id = b.id
            WHERE r.student_id = ?
            ORDER BY r.reservation_date DESC
        `, [studentId]);

        res.json({ success: true, reservations });
    } catch (error) {
        console.error('Get my reservations error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reservations' });
    }
};

/**
 * Admin: Get all reservations
 */
const getAllReservations = async (req, res) => {
    try {
        const { status } = req.query;
        let sql = `
            SELECT r.*, u.full_name, u.ad_no, u.profile_photo, b.title, b.accession_number, b.count as available_copies
            FROM reservations r
            JOIN users u ON r.student_id = u.id
            JOIN books b ON r.book_id = b.id
        `;
        let params = [];

        if (status) {
            sql += ' WHERE r.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY r.reservation_date DESC';

        const reservations = await query(sql, params);
        res.json({ success: true, reservations });
    } catch (error) {
        console.error('Get all reservations error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reservations' });
    }
};

/**
 * Admin: Update reservation status
 */
const updateReservationStatus = async (req, res) => {
    const connection = await beginTransaction();
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const adminId = req.user.id;

        const resv = await queryOne('SELECT * FROM reservations WHERE id = ?', [id]);
        if (!resv) {
            await rollback(connection);
            return res.status(404).json({ success: false, message: 'Reservation not found' });
        }

        // Handle specific logic for transitions
        if (status === 'Completed') {
            // Convert to Borrowed (Transaction)
            const book = await queryOne('SELECT count FROM books WHERE id = ?', [resv.book_id]);
            if (book.count < 1) {
                await rollback(connection);
                return res.status(400).json({ success: false, message: 'Cannot complete: Book out of stock' });
            }

            const due_date = moment().add(7, 'days').format('YYYY-MM-DD');
            await connection.execute(
                `INSERT INTO transactions (user_id, book_id, borrow_date, due_date, status, action_source) 
                 VALUES (?, ?, NOW(), ?, 'Borrowed', 'reservation')`,
                [resv.student_id, resv.book_id, due_date]
            );

            await connection.execute('UPDATE books SET count = count - 1 WHERE id = ?', [resv.book_id]);
        }

        let readyDateSql = '';
        if (status === 'Ready') {
            readyDateSql = ", ready_date = NOW(), expiration_date = (NOW() + INTERVAL '2 DAY')";
            // Mark book as Reserved to prevent others from borrowing
            await connection.execute("UPDATE books SET status = 'Reserved' WHERE id = ?", [resv.book_id]);
        } else if (status === 'Cancelled' || status === 'Completed') {
            // Revert book status to Available if no other active Ready reservations exist
            const otherReady = await connection.execute(
                "SELECT id FROM reservations WHERE book_id = ? AND status = 'Ready' AND id != ?",
                [resv.book_id, id]
            );
            if (!otherReady[0].length) {
                await connection.execute("UPDATE books SET status = 'Available' WHERE id = ?", [resv.book_id]);
            }
        }

        await connection.execute(
            `UPDATE reservations SET status = ?, notes = ? ${readyDateSql} WHERE id = ?`,
            [status, notes || null, id]
        );

        await commit(connection);

        await logAdminActivity(adminId, 'update_reservation', `Updated reservation ID ${id} to ${status}`);

        // Notify Student
        const bookInfo = await queryOne('SELECT title FROM books WHERE id = ?', [resv.book_id]);
        const msg = status === 'Ready' ? `Your reservation for "${bookInfo?.title}" is ready for pickup!` :
            status === 'Cancelled' ? `Your reservation for "${bookInfo?.title}" was cancelled.` :
                `Your reservation status updated to: ${status}`;

        await query(
            'INSERT INTO user_notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
            [resv.student_id, 'Reservation Update', msg, status === 'Ready' ? 'success' : 'info']
        );

        res.json({ success: true, message: `Reservation marked as ${status}` });

    } catch (error) {
        await rollback(connection);
        console.error('Update reservation error:', error);
        res.status(500).json({ success: false, message: 'Failed to update reservation' });
    }
};

module.exports = {
    reserveBook,
    getMyReservations,
    getAllReservations,
    updateReservationStatus
};
