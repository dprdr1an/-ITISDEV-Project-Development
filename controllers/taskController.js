const mongoose = require('mongoose');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const User = require('../models/User');

const {
    matchAnyField,
    addClause,
    dateRange
} = require('./utils/queryHelpers');

const { TASK_STATUSES, normaliseStatus } = Task;

const CHAIRPERSON = 'Chairperson';

function isChairperson(user) {
    return Boolean(user && user.position === CHAIRPERSON);
}

/** True when the signed-in user is one of the task's assignees. */
function isAssignee(task, user) {
    if (!task || !user) return false;

    return (task.assignedMembers || []).some(
        (member) => String(member._id || member) === String(user.id)
    );
}

// Create task
exports.createTask = async (req, res) => {
    try {
        const {
            project,
            title,
            description,
            assignedMembers,
            deadline,
            priority
        } = req.body;

        if (
            !project ||
            !title ||
            !description ||
            !deadline ||
            !Array.isArray(assignedMembers) ||
            assignedMembers.length === 0
        ) {
            return res.status(400).json({
                message: 'Please complete all required task fields.'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(project)) {
            return res.status(400).json({
                message: 'Invalid project ID.'
            });
        }

        const invalidMember = assignedMembers.some(
            (id) => !mongoose.Types.ObjectId.isValid(id)
        );

        if (invalidMember) {
            return res.status(400).json({
                message: 'One or more assigned member IDs are invalid.'
            });
        }

        const task = await Task.create({
            project,
            title,
            description,
            assignedMembers,
            deadline,
            priority: priority || 'Medium',
            // Taken from the session, never from the request body
            createdBy: req.currentUser.id
        });

        for (const memberId of assignedMembers) {
            await Notification.create({
                recipient: memberId,
                title: 'New Task Assigned',
                message: `You were assigned the task "${title}".`,
                type: 'TASK_ASSIGNED',
                relatedProject: project,
                relatedTask: task._id
            });
        }

        const populatedTask = await Task.findById(task._id)
            .populate('project', 'projectName title status')
            .populate(
                'assignedMembers',
                'name email committee position'
            )
            .populate('createdBy', 'name email');

        return res.status(201).json({
            message: 'Task assigned successfully.',
            task: populatedTask
        });
    } catch (error) {
        console.error('Create task error:', error);

        return res.status(500).json({
            message: 'Unable to create task.',
            error: error.message
        });
    }
};

// Get all tasks
// GET /api/tasks — list, search & filter tasks
//
// Query params (all optional, all combinable — AND'd together):
//   mine           — 'true' scopes to the signed-in user (My Tasks)
//   project        — exact project id
//   member         — exact assignee id (Task Assignment "filter by assignee")
//   status         — exact match
//   priority       — exact match
//   search         — partial, case-insensitive match on title or description
//   assignee       — partial, case-insensitive match on an assigned
//                    member's name or email (Task Assignment)
//   deadlineFrom   — deadline >= this date (ISO string)
//   deadlineTo     — deadline <= end of this date (ISO string)
exports.getTasks = async (req, res) => {
    try {
        const query = {};

        if (req.query.project) {
            query.project = req.query.project;
        }

        if (req.query.member) {
            query.assignedMembers = req.query.member;
        }

        if (req.query.status) {
            query.status = req.query.status;
        }

        if (req.query.priority) {
            query.priority = req.query.priority;
        }

        addClause(
            query,
            matchAnyField(req.query.search, ['title', 'description'])
        );

        addClause(
            query,
            dateRange('deadline', req.query.deadlineFrom, req.query.deadlineTo)
        );

        // Searching by assignee name means resolving names to ids first,
        // since assignedMembers stores references rather than text.
        if (req.query.assignee && String(req.query.assignee).trim()) {
            const nameClause = matchAnyField(req.query.assignee, [
                'name',
                'email'
            ]);

            const matches = await User.find(nameClause).select('_id').lean();

            // No matching member means no matching tasks, so short-circuit
            // rather than letting an empty $in match nothing silently.
            query.assignedMembers = query.assignedMembers
                ? query.assignedMembers
                : { $in: matches.map((u) => u._id) };

            if (!matches.length) {
                return res.status(200).json({ count: 0, tasks: [] });
            }
        }

        // Executives may only ever read their own tasks, regardless of the
        // query string they send. Chairpersons may read everything.
        if (!isChairperson(req.currentUser)) {
            query.assignedMembers = req.currentUser.id;
        }

        // Explicit opt-in used by the My Tasks page
        if (req.query.mine === 'true') {
            query.assignedMembers = req.currentUser.id;
        }

        const tasks = await Task.find(query)
            .populate('project', 'projectName title status')
            .populate(
                'assignedMembers',
                'name email committee position'
            )
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            count: tasks.length,
            tasks
        });
    } catch (error) {
        console.error('Get tasks error:', error);

        return res.status(500).json({
            message: 'Unable to retrieve tasks.',
            error: error.message
        });
    }
};

// Get one task
exports.getTaskById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: 'Invalid task ID.'
            });
        }

        const task = await Task.findById(req.params.id)
            .populate('project', 'projectName title status')
            .populate(
                'assignedMembers',
                'name email committee position'
            )
            .populate('createdBy', 'name email');

        if (!task) {
            return res.status(404).json({
                message: 'Task not found.'
            });
        }

        if (!isChairperson(req.currentUser) && !isAssignee(task, req.currentUser)) {
            return res.status(403).json({
                message: 'You do not have access to this task.'
            });
        }

        return res.status(200).json({
            task
        });
    } catch (error) {
        console.error('Get task error:', error);

        return res.status(500).json({
            message: 'Unable to retrieve task.',
            error: error.message
        });
    }
};

// Update task
exports.updateTask = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: 'Invalid task ID.'
            });
        }

        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({
                message: 'Task not found.'
            });
        }

        const chairperson = isChairperson(req.currentUser);
        const assignee = isAssignee(task, req.currentUser);

        if (!chairperson && !assignee) {
            return res.status(403).json({
                message: 'You do not have access to this task.'
            });
        }

        // Chairpersons may edit and reassign. Assignees may only move their
        // own task along the workflow — nothing else.
        const allowedFields = chairperson
            ? [
                  'project',
                  'title',
                  'description',
                  'assignedMembers',
                  'deadline',
                  'priority',
                  'status'
              ]
            : ['status'];

        const rejected = Object.keys(req.body).filter(
            (field) =>
                !allowedFields.includes(field) &&
                req.body[field] !== undefined
        );

        if (!chairperson && rejected.length) {
            return res.status(403).json({
                message:
                    'You may only update the status of a task assigned to you.'
            });
        }

        if (req.body.status !== undefined) {
            const nextStatus = normaliseStatus(req.body.status);

            if (!TASK_STATUSES.includes(nextStatus)) {
                return res.status(400).json({
                    message: 'Invalid task status.'
                });
            }

            req.body.status = nextStatus;
        }

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                task[field] = req.body[field];
            }
        });

        await task.save();

        // Tell the chairperson who raised the task when it moves
        if (
            req.body.status !== undefined &&
            task.createdBy &&
            String(task.createdBy) !== String(req.currentUser.id)
        ) {
            await Notification.create({
                recipient: task.createdBy,
                title: 'Task status updated',
                message:
                    req.currentUser.name +
                    ' moved "' +
                    task.title +
                    '" to ' +
                    task.status +
                    '.',
                type: 'TASK_UPDATED',
                relatedProject: task.project,
                relatedTask: task._id
            }).catch(() => undefined);
        }

        const updatedTask = await Task.findById(task._id)
            .populate('project', 'projectName title status')
            .populate(
                'assignedMembers',
                'name email committee position'
            )
            .populate('createdBy', 'name email');

        return res.status(200).json({
            message: 'Task updated successfully.',
            task: updatedTask
        });
    } catch (error) {
        console.error('Update task error:', error);

        return res.status(500).json({
            message: 'Unable to update task.',
            error: error.message
        });
    }
};

// Delete task
exports.deleteTask = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: 'Invalid task ID.'
            });
        }

        const task = await Task.findByIdAndDelete(req.params.id);

        if (!task) {
            return res.status(404).json({
                message: 'Task not found.'
            });
        }

        return res.status(200).json({
            message: 'Task deleted successfully.'
        });
    } catch (error) {
        console.error('Delete task error:', error);

        return res.status(500).json({
            message: 'Unable to delete task.',
            error: error.message
        });
    }
};
