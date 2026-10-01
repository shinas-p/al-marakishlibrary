const { query, queryOne, beginTransaction, commit, rollback } = require('../config/database');
const { logAdminActivity } = require('../helpers/adminHelper');

/**
 * Get all payments
 */
const getPayments = async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;
        let sql = `
            SELECT DISTINCT fp.*, u.full_name, u.ad_no, u.section,
                   cf.fine_type as custom_fine_type, cf.reason as custom_fine_reason,
                   b.title as book_title
            FROM fine_payments fp
            JOIN users u ON fp.user_id = u.id
            LEFT JOIN custom_fines cf ON fp.fine_id = cf.id
            LEFT JOIN transactions t ON fp.transaction_id = t.id
            LEFT JOIN books b ON (cf.book_id = b.id OR t.book_id = b.id)
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            sql += ' AND fp.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY fp.submitted_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const payments = await query(sql, params);
        res.json({ success: true, payments });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
};

/**
 * Verify a payment (Approve or Reject)
 */
const verifyPayment = async (req, res) => {
    const connection = await beginTransaction();
    try {
        const { id } = req.params;
        const { action } = req.body; // 'Approved' or 'Rejected'

        if (!['Approved', 'Rejected'].includes(action)) {
            await rollback(connection);
            return res.status(400).json({ error: 'Invalid action' });
        }

        // Get payment details
        const payment = await queryOne('SELECT * FROM fine_payments WHERE id = ?', [id]);
        if (!payment) {
            await rollback(connection);
            return res.status(404).json({ error: 'Payment record not found' });
        }

        // Update payment status
        await connection.execute(
            'UPDATE fine_payments SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
            [action, req.user.id, id]
        );

        if (action === 'Approved') {
            // Update the specific fine record based on the payment type
            if (payment.transaction_id) {
                // It's a late return fine
                await connection.execute(
                    "UPDATE transactions SET fine_status = 'Paid', paid_at = NOW() WHERE id = ?",
                    [payment.transaction_id]
                );
            } else if (payment.fine_id) {
                // It's a custom fine
                await connection.execute(
                    "UPDATE custom_fines SET status = 'paid', paid_at = NOW() WHERE id = ?",
                    [payment.fine_id]
                );
            } else {
                // Fallback: If no specific ID is linked (legacy/error), try to clear broadly by user
                // This is risky but keeps backward compatibility if data is messy
                try {
                    await connection.execute(
                        "UPDATE custom_fines SET status = 'paid', paid_at = NOW() WHERE student_id = ? AND status = 'approved'",
                        [payment.user_id]
                    );
                    await connection.execute(
                        "UPDATE transactions SET fine_status = 'Paid', paid_at = NOW() WHERE user_id = ? AND fine_status != 'Paid' AND fine > 0",
                        [payment.user_id]
                    );
                } catch (e) { }
            }
        }

        await commit(connection);

        await logAdminActivity(req.user.id, 'verify_payment', `${action} payment ID: ${id} for user ID: ${payment.user_id}`);

        res.json({ success: true, message: `Payment ${action.toLowerCase()}ed successfully` });
    } catch (error) {
        await rollback(connection);
        console.error('Verify payment error:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
};

/**
 * Request payment screenshot
 */
const requestScreenshot = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        const payment = await queryOne('SELECT user_id, amount FROM fine_payments WHERE id = ?', [id]);
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        await query(
            'UPDATE fine_payments SET is_screenshot_requested = 1 WHERE id = ?',
            [id]
        );

        await logAdminActivity(adminId, 'request_screenshot', `Requested screenshot for payment ID ${id}`);

        // Notify Student
        await query(
            'INSERT INTO user_notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
            [payment.user_id, 'Screenshot Requested', `Admin requested a screenshot for your payment of ₹${payment.amount}. Please upload it in the payments page.`, 'warning']
        );

        res.json({ success: true, message: 'Screenshot requested successfully' });
    } catch (error) {
        console.error('Request screenshot error:', error);
        res.status(500).json({ error: 'Failed to request screenshot' });
    }
};

/**
 * Get payment receipt data
 */
const getPaymentReceiptData = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if user is student or admin
        const userId = req.student ? req.student.id : (req.user ? req.user.id : null);
        const isAdmin = req.user && req.user.role !== 'student';

        let sql = `
            SELECT fp.*, 
                   u.full_name, u.ad_no, u.section,
                   cf.fine_type as custom_fine_type, cf.reason as custom_fine_reason,
                   b.title as book_title, b.accession_number
            FROM fine_payments fp
            JOIN users u ON fp.user_id = u.id
            LEFT JOIN custom_fines cf ON fp.fine_id = cf.id
            LEFT JOIN transactions t ON fp.transaction_id = t.id
            LEFT JOIN books b ON (cf.book_id = b.id OR t.book_id = b.id)
            WHERE fp.id = ?
        `;
        const params = [id];

        // If student, restrict to own payments
        if (!isAdmin) {
            sql += ' AND fp.user_id = ?';
            params.push(userId);
        }

        const payment = await queryOne(sql, params);

        if (!payment) {
            return res.status(404).json({ error: 'Receipt not found' });
        }

        // Return structured data for receipt
        res.json({
            success: true,
            receipt: {
                receipt_no: `RCPT-${payment.id.toString().padStart(6, '0')}`,
                date: payment.submitted_at, // or reviewed_at if approved date matters more? Use submitted for now or reviewed if available
                payment_date: payment.reviewed_at || payment.submitted_at,
                student: {
                    name: payment.full_name,
                    id: payment.ad_no,
                    section: payment.section
                },
                payment: {
                    amount: payment.amount,
                    method: payment.payment_method,
                    reference: payment.payment_reference,
                    status: payment.status
                },
                items: [
                    {
                        description: payment.custom_fine_type
                            ? `Fine: ${payment.custom_fine_type}${payment.custom_fine_reason ? ' - ' + payment.custom_fine_reason : ''}`
                            : (payment.book_title ? `Late Return Fine` : 'Library Fine Payment'),
                        details: payment.book_title ? `${payment.book_title} (${payment.accession_number || 'N/A'})` : null,
                        amount: payment.amount
                    }
                ]
            }
        });
    } catch (error) {
        console.error('Get receipt data error:', error);
        res.status(500).json({ error: 'Failed to fetch receipt data' });
    }
};

module.exports = {
    getPayments,
    verifyPayment,
    requestScreenshot,
    getPaymentReceiptData
};
