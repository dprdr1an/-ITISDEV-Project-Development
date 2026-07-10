const mongoose = require('mongoose');
const Task = require('../models/Task');
const Notification = require('../models/Notification');

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
            createdBy: req.body.createdBy || null
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

        const allowedFields = [
            'project',
            'title',
            'description',
            'assignedMembers',
            'deadline',
            'priority',
            'status'
        ];

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                task[field] = req.body[field];
            }
        });

        await task.save();

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
