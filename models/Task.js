const mongoose = require('mongoose');

/**
 * Current task workflow, in order. Progress moves forward through this list.
 */
const TASK_STATUSES = [
    'Not Started',
    'In Progress',
    'Ready for Review',
    'Completed'
];

/**
 * Statuses used before the My Tasks module existed. Still accepted so records
 * created earlier keep loading; normaliseStatus() maps them onto the new set.
 */
const LEGACY_STATUSES = [
    'Pending',
    'Ongoing',
    'For Review',
    'Waiting for Approval'
];

const LEGACY_MAP = {
    'Pending': 'Not Started',
    'Ongoing': 'In Progress',
    'For Review': 'Ready for Review',
    'Waiting for Approval': 'Ready for Review'
};

function normaliseStatus(status) {
    if (!status) return 'Not Started';
    return LEGACY_MAP[status] || status;
}

const taskSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ProjectRequest',
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        assignedMembers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            }
        ],

        deadline: {
            type: Date,
            required: true
        },

        priority: {
            type: String,
            enum: ['Low', 'Medium', 'High'],
            default: 'Medium'
        },

        status: {
            type: String,
            enum: TASK_STATUSES.concat(LEGACY_STATUSES),
            default: 'Not Started'
        },

        // Set the first time a task reaches "Completed" so on-time delivery
        // can be measured without relying on updatedAt.
        completedAt: {
            type: Date,
            default: null
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    {
        timestamps: true
    }
);

taskSchema.pre('save', function () {
    this.status = normaliseStatus(this.status);

    if (this.status === 'Completed' && !this.completedAt) {
        this.completedAt = new Date();
    }

    if (this.status !== 'Completed') {
        this.completedAt = null;
    }
});

const Task = mongoose.model('Task', taskSchema);

Task.TASK_STATUSES = TASK_STATUSES;
Task.LEGACY_STATUSES = LEGACY_STATUSES;
Task.normaliseStatus = normaliseStatus;

module.exports = Task;
