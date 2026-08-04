const express = require('express');

const {
    createNotification,
    getNotifications,
    getNotificationById,
    markAsRead,
    markAllAsRead,
    deleteNotification
} = require('../controllers/notificationController');

const router = express.Router();

const { requireAuth, requireRole, ROLES } = require('../middleware/authMiddleware');

// Every endpoint in this router requires a signed-in user
router.use(requireAuth);

// Create notification — addressed to another user, so chairperson only.
// Task assignment creates its notifications internally, not through this route.
router.post('/', requireRole(ROLES.CHAIRPERSON), createNotification);

// Get all notifications
// Example:
// /api/notifications?recipient=USER_ID
// /api/notifications?recipient=USER_ID&isRead=false
router.get('/', getNotifications);

// Mark all notifications as read
// This must be before /:id
router.put('/read-all', markAllAsRead);

// Get one notification
router.get('/:id', getNotificationById);

// Mark one notification as read
router.put('/:id/read', markAsRead);

// Delete notification
router.delete('/:id', deleteNotification);

module.exports = router;
