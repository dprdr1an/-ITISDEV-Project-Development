const mongoose = require('mongoose');

const ProjectRequest = require('../models/ProjectRequest');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const User = require('../models/User');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * GET /api/dashboard/summary
 *
 * Aggregates everything the dashboard renders into a single response so the
 * client does not have to run four separate requests and duplicate the
 * counting logic in the browser.
 *
 * `myTasks` and `notifications` are scoped to the signed-in user taken from
 * the session. The headline counters stay department-wide.
 */
exports.getSummary = async (req, res) => {
    try {
        // Identity comes from the session so a crafted ?userId= cannot be
        // used to read another member's tasks or notifications.
        const userId = req.currentUser ? String(req.currentUser.id) : null;

        const hasUser =
            userId && mongoose.Types.ObjectId.isValid(userId);

        const since = new Date(Date.now() - SEVEN_DAYS_MS);

        const [projects, tasks, users] = await Promise.all([
            ProjectRequest.find()
                .populate('submittedBy', 'name email committee position')
                .sort({ createdAt: -1 })
                .lean(),
            Task.find()
                .populate('assignedMembers', 'name email committee position')
                .sort({ deadline: 1 })
                .lean(),
            User.find().select('name committee position').lean()
        ]);

        const now = new Date();

        // ── Per-project progress, derived from its tasks ──────────────
        const tasksByProject = new Map();

        tasks.forEach((task) => {
            const key = String(task.project);

            if (!tasksByProject.has(key)) {
                tasksByProject.set(key, []);
            }

            tasksByProject.get(key).push(task);
        });

        const projectsWithProgress = projects.map((project) => {
            const related = tasksByProject.get(String(project._id)) || [];

            const done = related.filter(
                (task) => task.status === 'Completed'
            ).length;

            const progress = related.length
                ? Math.round((done / related.length) * 100)
                : 0;

            return {
                _id: project._id,
                projectName: project.projectName,
                committee: project.committee,
                status: project.status,
                priority: project.priority,
                refNumber: project.refNumber,
                requestingHead: project.requestingHead,
                postingDate: project.postingDate,
                eventDate: project.eventDate,
                createdAt: project.createdAt,
                taskCount: related.length,
                progress
            };
        });

        // ── Headline counters ─────────────────────────────────────────
        const countBy = (status) =>
            projects.filter((p) => p.status === status).length;

        const createdSince = (status) =>
            projects.filter(
                (p) =>
                    p.status === status &&
                    p.createdAt &&
                    new Date(p.createdAt) >= since
            ).length;

        const overdueTasks = tasks.filter(
            (task) =>
                task.status !== 'Completed' &&
                task.deadline &&
                new Date(task.deadline) < now
        );

        const stats = {
            activeProjects: countBy('Active'),
            activeProjectsDelta: createdSince('Active'),

            pendingApproval: countBy('For Approval'),
            pendingApprovalDelta: createdSince('For Approval'),

            overdueTasks: overdueTasks.length,

            completed: countBy('Completed'),
            completedDelta: createdSince('Completed')
        };

        // ── Status breakdown (donut) ──────────────────────────────────
        const breakdown = {
            completed: countBy('Completed'),
            active: countBy('Active'),
            pending: countBy('Pending'),
            total: projects.length
        };

        // ── Analytics ─────────────────────────────────────────────────
        const completedTasks = tasks.filter(
            (task) => task.status === 'Completed'
        );

        // Uses the real completion timestamp, falling back to updatedAt for
        // records created before completedAt existed.
        const onTimeTasks = completedTasks.filter((task) => {
            const finished = task.completedAt || task.updatedAt;

            return (
                task.deadline &&
                finished &&
                new Date(finished) <= new Date(task.deadline)
            );
        });

        const analytics = {
            completionRate: projects.length
                ? Math.round((breakdown.completed / projects.length) * 100)
                : 0,
            onTimeDelivery: completedTasks.length
                ? Math.round(
                      (onTimeTasks.length / completedTasks.length) * 100
                  )
                : 0
        };

        // ── Team workload: open tasks per member ──────────────────────
        const workloadMap = new Map();

        users.forEach((member) => {
            workloadMap.set(String(member._id), {
                _id: member._id,
                name: member.name,
                committee: member.committee,
                position: member.position,
                count: 0
            });
        });

        tasks
            .filter((task) => task.status !== 'Completed')
            .forEach((task) => {
                (task.assignedMembers || []).forEach((member) => {
                    const key = String(member._id || member);
                    const entry = workloadMap.get(key);

                    if (entry) entry.count += 1;
                });
            });

        const workload = [...workloadMap.values()]
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
            .slice(0, 5);

        // ── User-scoped slices ────────────────────────────────────────
        let myTasks = [];
        let notifications = [];

        if (hasUser) {
            myTasks = tasks
                .filter((task) =>
                    (task.assignedMembers || []).some(
                        (member) => String(member._id || member) === userId
                    )
                )
                .slice(0, 8)
                .map((task) => {
                    const project = projects.find(
                        (p) => String(p._id) === String(task.project)
                    );

                    return {
                        _id: task._id,
                        title: task.title,
                        status: task.status,
                        priority: task.priority,
                        deadline: task.deadline,
                        projectName: project
                            ? project.projectName
                            : 'Unassigned project'
                    };
                });

            notifications = await Notification.find({ recipient: userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean();
        }

        return res.status(200).json({
            success: true,
            data: {
                stats,
                breakdown,
                analytics,
                workload,
                notifications,
                myTasks,
                projects: projectsWithProgress.slice(0, 6)
            }
        });
    } catch (error) {
        console.error('Dashboard summary error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to build dashboard summary.'
        });
    }
};
