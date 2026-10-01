const { query, queryOne, beginTransaction, commit, rollback } = require('../config/database');
const { logAdminActivity } = require('../helpers/adminHelper');

/**
 * Get all registrations
 */
const getRegistrations = async (req, res) => {
    try {
        const { status = 'pending' } = req.query;
        const registrations = await query(
            'SELECT * FROM student_registrations WHERE status = ? ORDER BY id DESC',
            [status]
        );
        res.json({ success: true, registrations });
    } catch (error) {
        console.error('Get registrations error:', error);
        res.status(500).json({ error: 'Failed to fetch registrations' });
    }
};

/**
 * Approve a registration
 */
const approveRegistration = async (req, res) => {
    const connection = await beginTransaction();
    try {
        const { id } = req.params;

        // Get registration details
        const reg = await queryOne('SELECT * FROM student_registrations WHERE id = ? AND status = ?', [id, 'pending']);
        if (!reg) {
            await rollback(connection);
            return res.status(404).json({ error: 'Registration not found or already processed' });
        }

        // Check for duplicates in users
        const existing = await queryOne('SELECT id FROM users WHERE ad_no = ? OR email = ?', [reg.ad_no, reg.email]);
        if (existing) {
            await rollback(connection);
            return res.status(400).json({ error: 'A user with this Admission No or Email already exists' });
        }

        // Create user account
        await connection.execute(`
            INSERT INTO users (ad_no, full_name, email, phone, date_of_birth, address, contact, blood_group, section, password, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `, [
            reg.ad_no, reg.full_name, reg.email, reg.phone, reg.date_of_birth,
            reg.address, reg.contact, reg.blood_group, reg.section, reg.password
        ]);

        // Update registration status
        await connection.execute('UPDATE student_registrations SET status = ?, processed_at = NOW() WHERE id = ?', ['approved', id]);

        await commit(connection);

        await logAdminActivity(req.user.id, 'approve_registration', `Approved student: ${reg.full_name} (${reg.ad_no})`);

        // Notify Student (They will see this upon first login)
        // Need to get the new user ID. Since we inserted based on ad_no, we can fetch it.
        const newUser = await queryOne('SELECT id FROM users WHERE ad_no = ?', [reg.ad_no]);
        if (newUser) {
            await query(
                'INSERT INTO user_notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
                [newUser.id, 'Welcome!', 'Your account has been approved. Welcome to the Al Marakish Library!', 'success']
            );
        }

        res.json({ success: true, message: 'Registration approved and user account created' });
    } catch (error) {
        await rollback(connection);
        console.error('Approve registration error:', error);
        res.status(500).json({ error: 'Failed to approve registration: ' + error.message });
    }
};

/**
 * Reject a registration
 */
const rejectRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const result = await query('UPDATE student_registrations SET status = ?, rejection_reason = ?, processed_at = NOW() WHERE id = ? AND status = ?',
            ['rejected', reason, id, 'pending']
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Registration not found or already processed' });
        }

        await logAdminActivity(req.user.id, 'reject_registration', `Rejected registration ID: ${id}. Reason: ${reason}`);

        res.json({ success: true, message: 'Registration rejected' });
    } catch (error) {
        console.error('Reject registration error:', error);
        res.status(500).json({ error: 'Failed to reject registration' });
    }
};

/**
 * Submit a registration request (Public)
 */
const submitRegistration = async (req, res) => {
    try {
        const { ad_no, full_name, email, phone, date_of_birth, address, contact, blood_group, section, password } = req.body;

        if (!ad_no || !full_name || !password) {
            return res.status(400).json({ error: 'Admission No, Name, and Password are required' });
        }

        // Check if already exists in users or student_registrations
        const existingUser = await queryOne('SELECT id FROM users WHERE ad_no = ?', [ad_no]);
        if (existingUser) {
            return res.status(400).json({ error: 'A student with this Admission No already exists' });
        }

        const existingReg = await queryOne("SELECT id FROM student_registrations WHERE ad_no = ? AND status = 'pending'", [ad_no]);
        if (existingReg) {
            return res.status(400).json({ error: 'Your registration request is already pending approval' });
        }

        await query(`
            INSERT INTO student_registrations (ad_no, full_name, email, phone, date_of_birth, address, contact, blood_group, section, password, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [ad_no, full_name, email, phone, date_of_birth, address, contact, blood_group, section, password]);

        // Notify Admins
        const notifTitle = 'New Student Registration';
        const notifMsg = `Student ${full_name} (${ad_no}) has requested to join.`;
        await query(
            'INSERT INTO announcements (title, message, target_role, created_by) VALUES (?, ?, ?, ?)',
            [notifTitle, notifMsg, 'admin', null] // Created by system (null) or 0
        );

        res.json({ success: true, message: 'Registration request submitted successfully! Please wait for admin approval.' });
    } catch (error) {
        console.error('Submit registration error:', error);
        res.status(500).json({ error: 'Failed to submit registration request' });
    }
};

module.exports = {
    getRegistrations,
    approveRegistration,
    rejectRegistration,
    submitRegistration
};
