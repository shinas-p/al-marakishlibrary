const { query, queryOne } = require('../config/database');
const { logAdminActivity } = require('../helpers/adminHelper');

/**
 * Get all users (students)
 */
const getAllUsers = async (req, res) => {
    try {
        const { search } = req.query;
        let sql = 'SELECT * FROM users WHERE 1=1';
        let params = [];

        if (search) {
            const searchTerm = `%${search}%`;
            sql += ' AND (full_name LIKE ? OR ad_no LIKE ? OR contact LIKE ? OR section LIKE ?)';
            params = [searchTerm, searchTerm, searchTerm, searchTerm];
        }

        sql += ' ORDER BY id ASC';

        const users = await query(sql, params);
        res.json({ success: true, users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to load students' });
    }
};

/**
 * Delete a user
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Get name for logging
        const user = await queryOne('SELECT full_name FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'Student not found' });
        }

        await query('DELETE FROM users WHERE id = ?', [id]);

        await logAdminActivity(req.user.id, 'delete_user', `Deleted student: ${user.full_name} (ID: ${id})`);

        res.json({ success: true, message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete student' });
    }
};

/**
 * Search users (for autocomplete)
 */
const searchUsers = async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;
        if (!q || q.length < 1) {
            return res.json({ success: true, users: [], total: 0 });
        }

        const searchPattern = `%${q}%`;
        const users = await query(`
            SELECT id, full_name, ad_no, contact, section, profile_photo
            FROM users
            WHERE full_name LIKE ? OR ad_no LIKE ?
            ORDER BY full_name ASC
            LIMIT ?
        `, [searchPattern, searchPattern, parseInt(limit)]);

        res.json({ success: true, users, total: users.length });
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
};
/**
 * Add new user/student
 */
const addUser = async (req, res) => {
    try {
        const {
            ad_no,
            full_name,
            email,
            phone,
            date_of_birth,
            address,
            contact,
            blood_group,
            section,
            password
        } = req.body;

        // Validation
        if (!ad_no || !full_name || !password) {
            return res.status(400).json({ error: 'Admission Number, Full Name, and Password are required' });
        }

        // Check for duplicate admission number
        const existing = await queryOne('SELECT id FROM users WHERE ad_no = ?', [ad_no]);
        if (existing) {
            return res.status(400).json({ error: 'Admission number already exists' });
        }

        // Store password in plain text
        const hashedPassword = password; // Keeping variable name same for minimal change or renaming it

        // Handle profile photo upload
        const profile_photo = req.file ? req.file.filename : null;

        const sql = `
            INSERT INTO users
                (ad_no, full_name, email, phone, date_of_birth, address, contact, 
                 blood_group, section, profile_photo, password, status, user_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'student')
        `;

        const result = await query(sql, [
            ad_no,
            full_name,
            email || null,
            phone || null,
            date_of_birth || null,
            address || null,
            contact || null,
            blood_group || null,
            section || null,
            profile_photo,
            hashedPassword
        ]);

        // Log activity
        if (req.user && req.user.type === 'admin') {
            await logAdminActivity(
                req.user.id,
                'add_student',
                `Added new student: ${full_name} (Admission No: ${ad_no})`
            );
        }

        res.json({
            success: true,
            message: 'Student added successfully',
            user: { id: result.insertId, ad_no, full_name }
        });
    } catch (error) {
        console.error('Add user error:', error);
        res.status(500).json({ error: 'Failed to add student: ' + error.message });
    }
};

/**
 * Get student by ID
 */
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await queryOne('SELECT * FROM users WHERE id = ?', [id]);

        if (!user) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Get student's borrow history
        const history = await query(`
            SELECT t.*, b.title, b.accession_number
            FROM transactions t
            JOIN books b ON t.book_id = b.id
            WHERE t.user_id = ?
            ORDER BY t.borrow_date DESC
            LIMIT 50
        `, [id]);

        // Get student's fines (all pending)
        const [transFines, customFines] = await Promise.all([
            queryOne("SELECT SUM(fine - COALESCE(fine_paid, 0)) as total FROM transactions WHERE user_id = ? AND status = 'Returned' AND fine_status != 'Paid'", [id]).catch(() => ({ total: 0 })),
            queryOne("SELECT SUM(fine_amount) as total FROM custom_fines WHERE student_id = ? AND status IN ('approved', 'pending_approval')", [id]).catch(() => ({ total: 0 }))
        ]);

        const totalFine = parseFloat(transFines?.total || 0) + parseFloat(customFines?.total || 0);

        res.json({ success: true, user, history, totalFine });
    } catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json({ error: 'Failed to load student details' });
    }
};

/**
 * Update student details
 */
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            ad_no,
            full_name,
            email,
            phone,
            date_of_birth,
            address,
            contact,
            blood_group,
            section,
            status,
            password
        } = req.body;

        // Validation
        if (!full_name) {
            return res.status(400).json({ error: 'Full Name is required' });
        }

        // Check if user exists
        const existing = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Check for duplicate admission number if it's being changed
        if (ad_no && ad_no !== existing.ad_no) {
            const duplicate = await queryOne('SELECT id FROM users WHERE ad_no = ? AND id != ?', [ad_no, id]);
            if (duplicate) {
                return res.status(400).json({ error: 'Admission number already exists for another student' });
            }
        }

        let sql = `
            UPDATE users SET 
                full_name = ?, 
                email = ?, 
                phone = ?, 
                date_of_birth = ?, 
                address = ?, 
                contact = ?, 
                blood_group = ?, 
                section = ?, 
                status = ?
        `;
        let params = [
            full_name,
            email || null,
            phone || null,
            date_of_birth || null,
            address || null,
            contact || null,
            blood_group || null,
            section || null,
            status || existing.status
        ];

        if (ad_no) {
            sql += `, ad_no = ?`;
            params.push(ad_no);
        }

        if (password && password.trim() !== '') {
            sql += `, password = ?`;
            params.push(password);
        }

        sql += ` WHERE id = ?`;
        params.push(id);

        await query(sql, params);

        // Handle profile photo update if provided
        if (req.file) {
            await query('UPDATE users SET profile_photo = ? WHERE id = ?', [req.file.filename, id]);
        }

        await logAdminActivity(req.user.id, 'update_user', `Updated student: ${full_name} (ID: ${id})`);

        res.json({ success: true, message: 'Student updated successfully' });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update student: ' + error.message });
    }
};

/**
 * Get student statistics
 */
const getUserStats = async (req, res) => {
    try {
        const total = await queryOne("SELECT COUNT(*) as count FROM users WHERE user_type = 'student'");
        const active = await queryOne("SELECT COUNT(*) as count FROM users WHERE user_type = 'student' AND status = 'active'");
        const inactive = await queryOne("SELECT COUNT(*) as count FROM users WHERE user_type = 'student' AND status != 'active'");
        const newThisMonth = await queryOne(`
            SELECT COUNT(*) as count FROM users 
            WHERE user_type = 'student' 
            AND created_at >= (NOW() - INTERVAL '1 MONTH')
        `);

        res.json({
            success: true,
            stats: {
                total: total.count,
                active: active.count,
                inactive: inactive.count,
                newStudents: newThisMonth.count
            }
        });
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({ error: 'Failed to load student statistics' });
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    searchUsers,
    addUser,
    getUserStats
};
