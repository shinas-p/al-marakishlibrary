const { query, queryOne } = require('../config/database');
const { logAdminActivity } = require('../helpers/adminHelper');

/**
 * Get all admins
 */
const getAdmins = async (req, res) => {
    try {
        const { search, status } = req.query;
        let sql = "SELECT id, username, full_name, role, status, email, position, profile_photo, created_at FROM admin WHERE status != 'deleted'";
        const params = [];

        if (search) {
            const pattern = `%${search}%`;
            sql += ' AND (full_name LIKE ? OR username LIKE ? OR email LIKE ?)';
            params.push(pattern, pattern, pattern);
        }

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += " ORDER BY (CASE WHEN role = 'owner' THEN 1 ELSE 2 END), created_at DESC";

        const admins = await query(sql, params);
        res.json({ success: true, admins });
    } catch (error) {
        console.error('Get admins error:', error);
        res.status(500).json({ error: 'Failed to fetch admins' });
    }
};

/**
 * Add new admin
 */
const addAdmin = async (req, res) => {
    try {
        const { username, password, full_name, email, role, position } = req.body;

        if (!username || !password || !full_name) {
            return res.status(400).json({ error: 'Username, password, and full name are required' });
        }

        // Check duplicate
        const existing = await queryOne('SELECT id FROM admin WHERE username = ?', [username]);
        if (existing) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = password;

        const result = await query(`
            INSERT INTO admin (username, password, full_name, email, role, position, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())
        `, [username, hashedPassword, full_name, email || null, role || 'admin', position || null]);

        await logAdminActivity(req.user.id, 'admin_add', `Added new admin: ${full_name} (@${username})`);

        res.json({ success: true, message: 'Admin added successfully', id: result.insertId });
    } catch (error) {
        console.error('Add admin error:', error);
        res.status(500).json({ error: 'Failed to add admin' });
    }
};

/**
 * Update admin status (suspend, activate, delete)
 */
const updateAdminStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body;

        if (id == req.user.id) {
            return res.status(400).json({ error: 'You cannot modify your own status' });
        }

        const target = await queryOne('SELECT full_name, username, role FROM admin WHERE id = ?', [id]);
        if (!target || target.role === 'owner') {
            return res.status(400).json({ error: 'Cannot modify owner or invalid admin' });
        }

        const statusMap = {
            'suspend': 'suspended',
            'activate': 'active',
            'delete': 'deleted'
        };

        const newStatus = statusMap[action];
        if (!newStatus) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        await query('UPDATE admin SET status = ? WHERE id = ?', [newStatus, id]);

        await logAdminActivity(req.user.id, `admin_${action}`, `${action.charAt(0).toUpperCase() + action.slice(1)}d admin: ${target.full_name} (@${target.username})`);

        res.json({ success: true, message: `Admin ${action}d successfully` });
    } catch (error) {
        console.error('Update admin status error:', error);
        res.status(500).json({ error: 'Failed to update admin status' });
    }
};

/**
 * Update current admin's profile
 */
const updateOwnProfile = async (req, res) => {
    try {
        const { full_name, email, phone, position } = req.body;
        const adminId = req.user.id;

        if (!full_name) {
            return res.status(400).json({ error: 'Full name is required' });
        }

        await query(
            'UPDATE admin SET full_name = ?, email = ?, phone = ?, position = ? WHERE id = ?',
            [full_name, email || null, phone || null, position || null, adminId]
        );

        await logAdminActivity(adminId, 'profile_update', `Updated own profile details`);

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update own profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

/**
 * Update current admin's profile photo
 */
const updateOwnPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const adminId = req.user.id;
        const photoPath = req.file.filename;

        await query('UPDATE admin SET profile_photo = ? WHERE id = ?', [photoPath, adminId]);

        await logAdminActivity(adminId, 'photo_update', `Updated own profile photo`);

        res.json({
            success: true,
            message: 'Profile photo updated successfully',
            photo: photoPath
        });
    } catch (error) {
        console.error('Update admin photo error:', error);
        res.status(500).json({ error: 'Failed to update profile photo' });
    }
};

/**
 * Update current admin's password
 */
const updateOwnPassword = async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        const adminId = req.user.id;

        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }

        // Verify current password
        const admin = await queryOne('SELECT password FROM admin WHERE id = ?', [adminId]);
        if (!admin || admin.password !== current_password) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        // Update password (plain text for consistency with current system)
        await query('UPDATE admin SET password = ? WHERE id = ?', [new_password, adminId]);

        await logAdminActivity(adminId, 'password_change', `Changed own password`);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Update own password error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
};

module.exports = {
    getAdmins,
    addAdmin,
    updateAdminStatus,
    updateOwnProfile,
    updateOwnPhoto,
    updateOwnPassword
};
