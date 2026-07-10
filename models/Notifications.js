const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        message: {
            type: String,
            required: true,
            trim: true
        },

        type: {
            type: String,
            enum: [
                'TASK_ASSIGNED',
                'TASK_UPDATED',
                'TASK_OVERDUE',
                'DEADLINE_REMINDER',
                'PROJECT_STATUS_CHANGED',
                'ROLLOUT_UPDATED',
                'APPROVAL_REQUIRED',
                'PROJECT_APPROVED'
            ],
            required: true
        },

        relatedProject: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            default: null
        },

        relatedTask: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task',
            default: null
        },

        isRead: {
            type: Boolean,
            default: false
        },

        readAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    'Notification',
    notificationSchema
);
