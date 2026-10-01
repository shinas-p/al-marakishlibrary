const { query, queryOne } = require('../config/database');
const { logAdminActivity } = require('../helpers/adminHelper');

/**
 * Get all notifications for the current user
 */
const getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role; // 'owner', 'admin', 'assistant', 'student'

        // 1. Fetch User Specific Notifications
        const validRole = (role === 'owner') ? 'admin' : role; // Owner sees admin announcements

        const userNotifs = await query(
            'SELECT *, "personal" as source FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        // 2. Fetch Announcements
        // Role matching: 'all', or exact match. 
        // Admin/Owner sees 'admin' or 'all'. Student sees 'student' or 'all'.
        let roleParams = ['all', validRole];
        if (role === 'owner') roleParams.push('owner'); // Just in case we target owner specifically

        const announcements = await query(
            `SELECT *, "announcement" as source, "info" as type FROM announcements 
             WHERE (target_role IN (?) OR target_role = 'all') 
             AND (expires_at IS NULL OR expires_at > NOW())
             ORDER BY created_at DESC`,
            [roleParams]
        );

        // Combine
        const all = [...userNotifs, ...announcements].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({ success: true, notifications: all });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
};

/**
 * Get count of unread notifications
 */
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`🔍 Checking unread notifications for User ID: ${userId}`);

        // Count unread personal notifications
        const result = await queryOne(
            'SELECT COUNT(*) as count FROM user_notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );

        console.log(`📢 Unread count for User ${userId}: ${result.count || 0}`);
        res.json({ success: true, count: result.count || 0 });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ success: false, count: 0 });
    }
};

/**
 * Create a new announcement (Admin/Owner)
 */
const createAnnouncement = async (req, res) => {
    try {
        const { title, message, target_role, expires_at } = req.body;
        const creatorId = req.user.id;

        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'Title and message are required' });
        }

        await query(
            'INSERT INTO announcements (title, message, target_role, created_by, expires_at) VALUES (?, ?, ?, ?, ?)',
            [title, message, target_role || 'all', creatorId, expires_at || null]
        );

        await logAdminActivity(creatorId, 'create_announcement', `Posted announcement: ${title} to ${target_role}`);

        res.json({ success: true, message: 'Announcement posted successfully' });
    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({ success: false, message: 'Failed to create announcement' });
    }
};

/**
 * Mark personal notification as read
 */
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        await query(
            'UPDATE user_notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

/**
 * Mark all personal notifications as read for current user
 */
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;

        await query(
            'UPDATE user_notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ success: false, message: 'Failed to mark notifications' });
    }
};

/**
 * Delete a notification (Personal or Announcement if owner)
 */
const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query; // 'personal' or 'announcement'
        const userId = req.user.id;
        const role = req.user.role;

        if (type === 'announcement') {
            if (role !== 'owner' && role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Permission denied' });
            }
            await query('DELETE FROM announcements WHERE id = ?', [id]);
            await logAdminActivity(userId, 'delete_announcement', `Deleted announcement ID ${id}`);
        } else {
            await query('DELETE FROM user_notifications WHERE id = ? AND user_id = ?', [id, userId]);
        }

        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete' });
    }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    createAnnouncement,
    markAsRead,
    markAllAsRead,
    deleteNotification
};
