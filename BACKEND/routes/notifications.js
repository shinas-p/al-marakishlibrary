const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Get all notifications for current user (student or admin)
router.get('/', authenticate, notificationController.getNotifications);

// Get unread count
router.get('/unread-count', authenticate, notificationController.getUnreadCount);

// Mark as read
router.put('/:id/read', authenticate, notificationController.markAsRead);

// Mark all as read
router.put('/mark-all-read', authenticate, notificationController.markAllAsRead);

// Create Announcement (Admin/Owner only)
router.post('/announce', authenticate, requireAdmin, notificationController.createAnnouncement);

// Delete Notification (Admin can delete announcements, users can delete their own personal notifs?)
// For now, allow admin to delete announcements.
router.delete('/:id', authenticate, notificationController.deleteNotification);

module.exports = router;
