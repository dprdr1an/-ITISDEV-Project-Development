const mongoose = require('mongoose');
const Notification = require('../models/Notification');

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
        const query = {};

        if (req.query.recipient) {
            if (
                !mongoose.Types.ObjectId.isValid(
                    req.query.recipient
                )
            ) {
                return res.status(400).json({
                    message: 'Invalid recipient ID.'
                });
            }

            query.recipient = req.query.recipient;
        }

        if (req.query.type) {
            query.type = req.query.type;
        }

        if (req.query.isRead !== undefined) {
            query.isRead = req.query.isRead === 'true';
        }

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

        const notification =
            await Notification.findByIdAndUpdate(
                req.params.id,
                {
                    isRead: true,
                    readAt: new Date()
                },
                {
                    new: true,
                    runValidators: true
                }
            );

        if (!notification) {
            return res.status(404).json({
                message: 'Notification not found.'
            });
        }

        return res.status(200).json({
            message: 'Notification marked as read.',
            notification
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
        const { recipient } = req.body;

        if (!recipient) {
            return res.status(400).json({
                message: 'Recipient ID is required.'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(recipient)) {
            return res.status(400).json({
                message: 'Invalid recipient ID.'
            });
        }

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

        const notification =
            await Notification.findByIdAndDelete(
                req.params.id
            );

        if (!notification) {
            return res.status(404).json({
                message: 'Notification not found.'
            });
        }

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
