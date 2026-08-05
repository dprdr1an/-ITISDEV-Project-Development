const mongoose = require('mongoose');
const Notification = require('../models/Notification');

const { matchAnyField, addClause } = require('./utils/queryHelpers');

/**
 * Notifications are private to their recipient. Identity always comes from
 * the session — a ?recipient= or body value is never trusted, otherwise any
 * signed-in user could read or modify someone else's notifications.
 */
function ownsNotification(notification, user) {
    if (!notification || !user) return false;

    const recipientId =
        notification.recipient && notification.recipient._id
            ? notification.recipient._id
            : notification.recipient;

    return String(recipientId) === String(user.id);
}

// Create a notification
exports.createNotification = async (req, res) => {
    try {
        const {
            recipient,
            title,
            message,
            type,
            relatedProject,
            relatedTask
        } = req.body;

        if (!recipient || !title || !message || !type) {
            return res.status(400).json({
                message:
                    'Recipient, title, message, and notification type are required.'
            });
        }

        const notification = await Notification.create({
            recipient,
            title,
            message,
            type,
            relatedProject: relatedProject || null,
            relatedTask: relatedTask || null
        });

        const populatedNotification =
            await Notification.findById(notification._id)
                .populate('recipient', 'name email')
                .populate('relatedProject', 'projectName title status')
                .populate('relatedTask', 'title status deadline');

        return res.status(201).json({
            message: 'Notification created successfully.',
            notification: populatedNotification
        });
    } catch (error) {
        console.error('Create notification error:', error);

        return res.status(500).json({
            message: 'Unable to create notification.',
            error: error.message
        });
    }
};

// Get all notifications
exports.getNotifications = async (req, res) => {
    try {
        // Always scoped to the signed-in user. Any ?recipient= is ignored.
        const query = { recipient: req.currentUser.id };

        if (req.query.type) {
            query.type = req.query.type;
        }

        if (req.query.isRead !== undefined && req.query.isRead !== '') {
            query.isRead = req.query.isRead === 'true';
        }

        // Free-text search across the notification's own wording
        addClause(query, matchAnyField(req.query.search, ['title', 'message']));

        const notifications = await Notification.find(query)
            .populate('recipient', 'name email committee position')
            .populate(
                'relatedProject',
                'projectName title status'
            )
            .populate(
                'relatedTask',
                'title status deadline priority'
            )
            .sort({ createdAt: -1 });

        return res.status(200).json({
            count: notifications.length,
            notifications
        });
    } catch (error) {
        console.error('Get notifications error:', error);

        return res.status(500).json({
            message: 'Unable to retrieve notifications.',
            error: error.message
        });
    }
};

// Get one notification
exports.getNotificationById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: 'Invalid notification ID.'
            });
        }

        const notification = await Notification.findById(
            req.params.id
        )
            .populate('recipient', 'name email')
            .populate('relatedProject', 'projectName title status')
            .populate(
                'relatedTask',
                'title status deadline priority'
            );

        if (!notification) {
            return res.status(404).json({
                message: 'Notification not found.'
            });
        }

        if (!ownsNotification(notification, req.currentUser)) {
            return res.status(403).json({
                message: 'You do not have access to this notification.'
            });
        }

        return res.status(200).json({
            notification
        });
    } catch (error) {
        console.error('Get notification error:', error);

        return res.status(500).json({
            message: 'Unable to retrieve notification.',
            error: error.message
        });
    }
};

// Mark one notification as read
exports.markAsRead = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: 'Invalid notification ID.'
            });
        }

        // Read first so ownership is checked before anything is written
        const existing = await Notification.findById(req.params.id);

        if (!existing) {
            return res.status(404).json({
                message: 'Notification not found.'
            });
        }

        if (!ownsNotification(existing, req.currentUser)) {
            return res.status(403).json({
                message: 'You do not have access to this notification.'
            });
        }

        existing.isRead = true;
        existing.readAt = new Date();

        await existing.save();

        return res.status(200).json({
            message: 'Notification marked as read.',
            notification: existing
        });
    } catch (error) {
        console.error('Mark notification as read error:', error);

        return res.status(500).json({
            message: 'Unable to update notification.',
            error: error.message
        });
    }
};

// Mark all notifications of one user as read
exports.markAllAsRead = async (req, res) => {
    try {
        // Recipient comes from the session; a body value is ignored so one
        // user cannot clear another user's notifications.
        const recipient = req.currentUser.id;

        const result = await Notification.updateMany(
            {
                recipient,
                isRead: false
            },
            {
                $set: {
                    isRead: true,
                    readAt: new Date()
                }
            }
        );

        return res.status(200).json({
            message: 'All notifications marked as read.',
            updatedCount: result.modifiedCount
        });
    } catch (error) {
        console.error(
            'Mark all notifications as read error:',
            error
        );

        return res.status(500).json({
            message: 'Unable to update notifications.',
            error: error.message
        });
    }
};

// Delete one notification
exports.deleteNotification = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: 'Invalid notification ID.'
            });
        }

        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                message: 'Notification not found.'
            });
        }

        if (!ownsNotification(notification, req.currentUser)) {
            return res.status(403).json({
                message: 'You do not have access to this notification.'
            });
        }

        await Notification.findByIdAndDelete(req.params.id);

        return res.status(200).json({
            message: 'Notification deleted successfully.'
        });
    } catch (error) {
        console.error('Delete notification error:', error);

        return res.status(500).json({
            message: 'Unable to delete notification.',
            error: error.message
        });
    }
};
