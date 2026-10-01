const { query, queryOne, beginTransaction, commit, rollback } = require('../config/database');
const moment = require('moment');
const { logActivity } = require('../helpers/adminHelper');
const { getSetting } = require('../helpers/settingsHelper');

/**
 * Identify Student by Barcode (Ad No)
 */
const identifyStudent = async (req, res) => {
    try {
        const { ad_no } = req.params;

        const student = await queryOne(`
            SELECT id, full_name as name, ad_no as admission_no, section as class, profile_photo, status
            FROM users 
            WHERE ad_no = ?
        `, [ad_no]);

        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found in database.' });
        }

        if (student.status !== 'active') {
            return res.status(403).json({ success: false, message: 'Student account is inactive.' });
        }

        // Get active transactions count
        const activeCount = await queryOne(
            'SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND status IN ("Borrowed", "Overdue")',
            [student.id]
        );

        student.active_count = activeCount.count;
        // Format photo URL
        student.photo_url = student.profile_photo ? `/uploads/student_photos/${student.profile_photo}` : '/assets/img/default-student.png';

        res.json({ success: true, student });
    } catch (error) {
        console.error('Identify student error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

/**
 * Get Active Count for Student
 */
const getActiveCount = async (req, res) => {
    try {
        const { student_id } = req.params;
        const result = await queryOne(
            'SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND status IN ("Borrowed", "Overdue")',
            [student_id]
        );
        res.json({ success: true, count: result.count });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

/**
 * Identify Book & Check Status
 */
const identifyBook = async (req, res) => {
    try {
        const { accession_no } = req.params;
        const { student_id } = req.query;

        const book = await queryOne(`
            SELECT id, title, accession_number as accession_no, count as copies_left, cover_image as cover_url, status
            FROM books 
            WHERE accession_number = ?
        `, [accession_no]);

        if (!book) {
            return res.status(404).json({ success: false, message: 'Book not found.' });
        }

        // Check if book is currently issued to anyone
        const activeTx = await queryOne(`
            SELECT t.*, u.full_name as current_holder, u.ad_no
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            WHERE t.book_id = ? AND t.status IN ("Borrowed", "Overdue")
        `, [book.id]);

        let suggestedAction = 'CHECKOUT';
        let currentTransaction = null;

        if (activeTx) {
            currentTransaction = activeTx; // Always include active transaction for return logic
            if (student_id && activeTx.user_id == student_id) {
                // Current holder wants to RENEW
                if (book.status === 'Reserved') {
                    suggestedAction = 'BLOCK';
                    book.message = 'BOOK RESERVED: This book cannot be renewed as it is reserved for another purpose.';
                } else if (book.status === 'Lost') {
                    suggestedAction = 'BLOCK';
                    book.message = 'BOOK LOST: This record is marked as lost.';
                } else {
                    // Get max renewals from settings (dynamic)
                    const maxRenewals = await getSetting('max_renewals', 2);

                    if (activeTx.renewed >= maxRenewals) {
                        // Check renewal limit
                        suggestedAction = 'BLOCK';
                        book.message = `RENEWAL LIMIT REACHED: This book has already been renewed ${maxRenewals} times. Please return the book.`;
                    } else {
                        suggestedAction = 'RENEW';
                        book.renewals_left = maxRenewals - activeTx.renewed;
                    }
                }
            } else {
                // Issued to someone else - allow the frontend to handle "Return on Scan 2"
                suggestedAction = 'BLOCK';
                book.message = `Book is already issued to ${activeTx.current_holder} (Ad No: ${activeTx.ad_no})`;
            }
        } else {
            // Not currently issued - Check status for CHECKOUT
            if (book.status === 'Reserved') {
                suggestedAction = 'BLOCK';
                book.message = 'BOOK RESERVED: This book is held for another purpose.';
            } else if (book.status === 'Lost') {
                suggestedAction = 'BLOCK';
                book.message = 'BOOK LOST: This record is marked as lost.';
            } else if (book.status === 'Unavailable') {
                suggestedAction = 'BLOCK';
                book.message = 'BOOK UNAVAILABLE: This book is currently not in service.';
            } else if (book.count <= 0) {
                suggestedAction = 'BLOCK';
                book.message = 'No copies left in library.';
            }
        }

        // Check borrowing limit if student_id is provided and it's still a checkout attempt
        if (student_id && suggestedAction === 'CHECKOUT') {
            const activeCount = await queryOne(
                'SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND status IN ("Borrowed", "Overdue")',
                [student_id]
            );
            if (activeCount && activeCount.count >= 2) {
                suggestedAction = 'BLOCK';
                book.message = 'BORROWING LIMIT REACHED (Max 2 books per student)';
            }
        }

        // Format cover URL
        book.cover_url = book.cover_url ? `/uploads/covers/${book.cover_url}` : '/assets/default-book-cover.png';

        res.json({
            success: true,
            book,
            suggestedAction,
            currentTransaction
        });
    } catch (error) {
        console.error('Identify book error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

/**
 * Get Book by Accession (Specifically for Return Page)
 */
const getBookByAccession = async (req, res) => {
    try {
        const { accession_no } = req.params;

        // Get book
        const book = await queryOne(`
            SELECT id, title, accession_number as accession_no, count as copies_left, cover_image as cover_url
            FROM books 
            WHERE accession_number = ?
        `, [accession_no]);

        if (!book) {
            return res.status(404).json({ success: false, message: 'Book not found in database.' });
        }

        // Get current active transaction
        const activeTx = await queryOne(`
            SELECT t.*, u.full_name as student_name, u.ad_no as admission_no
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            WHERE t.book_id = ? AND t.status IN ("Borrowed", "Overdue")
        `, [book.id]);

        // Format cover URL
        book.cover_url = book.cover_url ? `/uploads/covers/${book.cover_url}` : '/assets/default-book-cover.png';

        res.json({
            success: true,
            book,
            is_issued: !!activeTx,
            transaction: activeTx
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

/**
 * Perform standalone Check-In
 */
const performCheckIn = async (req, res) => {
    const connection = await beginTransaction();
    try {
        const { transaction_id, book_id } = req.body;
        const now = moment().format('YYYY-MM-DD');

        if (!transaction_id || !book_id) {
            await rollback(connection);
            return res.status(400).json({ success: false, message: 'Transaction ID and Book ID required' });
        }

        // Update transaction
        await connection.execute(
            `UPDATE transactions 
             SET status = 'Returned', return_date = ?, fine = 0, fine_status = 'None' 
             WHERE id = ?`,
            [now, transaction_id]
        );

        // Update book count
        await connection.execute('UPDATE books SET count = count + 1 WHERE id = ?', [book_id]);

        // Audit Log
        const info = await queryOne(`
            SELECT b.id as book_id, b.title, b.accession_number, b.isbn, u.id as user_id, u.full_name, u.ad_no 
            FROM transactions t
            JOIN books b ON t.book_id = b.id
            JOIN users u ON t.user_id = u.id
            WHERE t.id = ?
        `, [transaction_id]);

        const adminId = req.user?.id || 0;
        const adminName = req.user?.username || 'System';
        const adminRole = req.user?.role || 'admin';

        await connection.execute(`
            INSERT INTO book_issue_audit 
            (transaction_id, book_id, user_id, admin_id, action_type, action_source, book_title, accession_number, book_isbn, student_name, student_ad_no, admin_name, admin_role, returned_at, current_status, ip_address, user_agent)
            VALUES (?, ?, ?, ?, 'return', 'standalone_checkin', ?, ?, ?, ?, ?, ?, ?, NOW(), 'Returned', ?, ?)
        `, [transaction_id, info.book_id, info.user_id, adminId, info.title, info.accession_number, info.isbn || 'N/A', info.full_name, info.ad_no, adminName, adminRole, req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown']);

        await logActivity({
            action: 'BOOK_RETURN_AUTO',
            category: 'circulation',
            targetId: book_id,
            targetType: 'book',
            targetName: info?.title,
            description: `Auto-returned book "${info?.title}" from ${info?.full_name} (${info?.ad_no})`,
            metadata: { transaction_id, ad_no: info?.ad_no, source: 'standalone_checkin' },
            severity: 'medium'
        }, req);

        await commit(connection);
        res.json({ success: true, message: 'Book successfully returned to library.' });

    } catch (error) {
        await rollback(connection);
        console.error('Check-in error:', error);
        res.status(500).json({ success: false, error: 'Database error during check-in' });
    }
};

/**
 * Process Circulation (Checkout / Renew / Checkin)
 */
const processCirculation = async (req, res) => {
    const connection = await beginTransaction();
    try {
        const { action, student_id, book_id, transaction_id } = req.body;
        const adminId = req.user.id;
        const adminName = req.user.username || 'Admin';
        const now = moment().format('YYYY-MM-DD');

        if (action === 'RENEW' || action === 'CHECKIN') {
            if (!transaction_id) {
                await rollback(connection);
                return res.status(400).json({ success: false, message: `Transaction ID is required for ${action}.` });
            }
        }

        if (action === 'CHECKOUT') {
            // Re-verify limit
            const activeCount = await queryOne(
                'SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND status IN ("Borrowed", "Overdue")',
                [student_id]
            );
            // Get max books allowed from settings
            const maxBooks = await getSetting('borrow_max_books_student', 2);

            if (activeCount.count >= maxBooks) {
                await rollback(connection);
                return res.status(400).json({ success: false, message: `Student already has ${maxBooks} issued books.` });
            }

            // Get loan period from settings
            const loanPeriod = await getSetting('loan_period_days', 7);
            const due_date = moment().add(loanPeriod, 'days').format('YYYY-MM-DD');
            const [result] = await connection.execute(
                `INSERT INTO transactions (user_id, book_id, borrow_date, due_date, status, issued_by_admin_id, issued_by_admin_name, action_source) 
                 VALUES (?, ?, ?, ?, 'Borrowed', ?, ?, 'smart_circulation')`,
                [student_id, book_id, now, due_date, adminId, adminName]
            );
            const transaction_id = result.insertId;

            await connection.execute('UPDATE books SET count = count - 1 WHERE id = ?', [book_id]);

            // Audit Log
            const bookInfo = await queryOne('SELECT title, accession_number, isbn FROM books WHERE id = ?', [book_id]);
            const userInfo = await queryOne('SELECT full_name, ad_no FROM users WHERE id = ?', [student_id]);
            const adminRole = req.user?.role || 'admin';

            // Insert into book_issue_audit
            await connection.execute(`
                INSERT INTO book_issue_audit 
                (transaction_id, book_id, user_id, admin_id, action_type, action_source, book_title, accession_number, book_isbn, student_name, student_ad_no, admin_name, admin_role, due_date, current_status, ip_address, user_agent)
                VALUES (?, ?, ?, ?, 'issue', 'smart_circulation', ?, ?, ?, ?, ?, ?, ?, ?, 'Borrowed', ?, ?)
            `, [transaction_id, book_id, student_id, adminId, bookInfo.title, bookInfo.accession_number, bookInfo.isbn || 'N/A', userInfo.full_name, userInfo.ad_no, adminName, adminRole, due_date, req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown']);

            await logActivity({
                action: 'BOOK_ISSUE',
                category: 'circulation',
                targetId: book_id,
                targetType: 'book',
                targetName: bookInfo?.title,
                description: `Issued book "${bookInfo?.title}" to ${userInfo?.full_name} (${userInfo?.ad_no})`,
                metadata: { student_id, ad_no: userInfo?.ad_no, due_date },
                severity: 'medium'
            }, req);

            await commit(connection);
            return res.json({ success: true, message: 'Check Out successful! Due date: ' + due_date });
        }

        if (action === 'RENEW') {
            // Check current renewal count - Max 2 renewals allowed
            const currentTx = await queryOne(
                'SELECT renewed FROM transactions WHERE id = ?',
                [transaction_id]
            );

            if (!currentTx) {
                await rollback(connection);
                return res.status(404).json({ success: false, message: 'Transaction not found.' });
            }

            // Get max renewals from settings
            const maxRenewals = await getSetting('max_renewals', 2);

            if (currentTx.renewed >= maxRenewals) {
                await rollback(connection);
                return res.status(400).json({
                    success: false,
                    message: `Maximum renewal limit reached! This book has already been renewed ${maxRenewals} times. Please return the book.`
                });
            }

            // Get loan period from settings
            const loanPeriod = await getSetting('loan_period_days', 7);
            const new_due_date = moment().add(loanPeriod, 'days').format('YYYY-MM-DD');
            await connection.execute(
                `UPDATE transactions 
                 SET due_date = ?, renewed = renewed + 1, status = 'Borrowed' 
                 WHERE id = ?`,
                [new_due_date, transaction_id]
            );

            // Audit Log
            const txInfo = await queryOne(`
                SELECT t.book_id, b.title, b.accession_number, b.isbn, u.id as user_id, u.full_name, u.ad_no 
                FROM transactions t
                JOIN books b ON t.book_id = b.id
                JOIN users u ON t.user_id = u.id
                WHERE t.id = ?
            `, [transaction_id]);
            const adminRole = req.user?.role || 'admin';

            await connection.execute(`
                INSERT INTO book_issue_audit 
                (transaction_id, book_id, user_id, admin_id, action_type, action_source, book_title, accession_number, book_isbn, student_name, student_ad_no, admin_name, admin_role, due_date, current_status, ip_address, user_agent)
                VALUES (?, ?, ?, ?, 'renew', 'smart_circulation', ?, ?, ?, ?, ?, ?, ?, ?, 'Borrowed', ?, ?)
            `, [transaction_id, txInfo.book_id, txInfo.user_id, adminId, txInfo.title, txInfo.accession_number, txInfo.isbn || 'N/A', txInfo.full_name, txInfo.ad_no, adminName, adminRole, new_due_date, req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown']);

            await logActivity({
                action: 'BOOK_RENEW',
                category: 'circulation',
                targetId: txInfo?.book_id,
                targetType: 'book',
                targetName: txInfo?.title,
                description: `Renewed book "${txInfo?.title}" for ${txInfo?.full_name} (${txInfo?.ad_no})`,
                metadata: { transaction_id, new_due_date },
                severity: 'low'
            }, req);

            await commit(connection);

            const renewalsLeft = maxRenewals - (currentTx.renewed + 1);
            const renewalMessage = renewalsLeft > 0
                ? `Book Renewed! New due date: ${new_due_date}. You have ${renewalsLeft} renewal(s) left.`
                : `Book Renewed! New due date: ${new_due_date}. This is your final renewal.`;

            return res.json({
                success: true,
                message: renewalMessage,
                renewals_left: renewalsLeft,
                new_due_date: new_due_date
            });
        }

        if (action === 'CHECKIN') {
            await connection.execute(
                `UPDATE transactions 
                 SET status = 'Returned', return_date = ?, fine = 0, fine_status = 'None' 
                 WHERE id = ?`,
                [now, transaction_id]
            );

            await connection.execute('UPDATE books SET count = count + 1 WHERE id = ?', [book_id]);

            // Audit Log
            const bookInfo = await queryOne('SELECT title, accession_number, isbn FROM books WHERE id = ?', [book_id]);
            const userInfo = await queryOne('SELECT full_name, ad_no FROM users WHERE id = ?', [student_id]);
            const adminRole = req.user?.role || 'admin';

            await connection.execute(`
                INSERT INTO book_issue_audit 
                (transaction_id, book_id, user_id, admin_id, action_type, action_source, book_title, accession_number, book_isbn, student_name, student_ad_no, admin_name, admin_role, returned_at, current_status, ip_address, user_agent)
                VALUES (?, ?, ?, ?, 'return', 'smart_circulation', ?, ?, ?, ?, ?, ?, ?, NOW(), 'Returned', ?, ?)
            `, [transaction_id, book_id, student_id, adminId, bookInfo.title, bookInfo.accession_number, bookInfo.isbn || 'N/A', userInfo.full_name, userInfo.ad_no, adminName, adminRole, req.ip || '0.0.0.0', req.get('User-Agent') || 'Unknown']);

            await logActivity({
                action: 'BOOK_CHECKIN',
                category: 'circulation',
                targetId: book_id,
                targetType: 'book',
                targetName: bookInfo?.title,
                description: `Checked in book "${bookInfo?.title}" from ${userInfo?.full_name} (${userInfo?.ad_no})`,
                metadata: { transaction_id, student_id, ad_no: userInfo?.ad_no },
                severity: 'medium'
            }, req);

            await commit(connection);
            return res.json({ success: true, message: 'Check In successful! Book returned to shelf.' });
        }

        await rollback(connection);
        res.status(400).json({ success: false, message: 'Invalid action.' });

    } catch (error) {
        if (connection) await rollback(connection);
        console.error('Process circulation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process transaction.',
            error: error.message
        });
    }
};

module.exports = {
    identifyStudent,
    getActiveCount,
    identifyBook,
    processCirculation,
    getBookByAccession,
    performCheckIn
};
