const ProjectRequest = require('../models/ProjectRequest');
const { diffFields, summariseChanges } = require('./utils/diffRevision');
const { containsRegex } = require('./utils/queryHelpers');

// POST /api/projects — Submit a new project request
const submitProject = async (req, res) => {
    try {
        const project = new ProjectRequest(req.body);

        // Revision & Update Log — first entry records creation. The user
        // comes from the signed-in session, never from the request body.
        project.revisions.push({
            action: 'Project request submitted',
            madeBy: req.currentUser.name,
            userId: req.currentUser.id,
            note: 'Project request created.'
        });

        await project.save();

        res.status(201).json({
            success: true,
            message: 'Project request submitted successfully.',
            refNumber: project.refNumber,
            id: project._id
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// GET /api/projects — Search & filter project requests (for dashboard / status page)
//
// Query params (all optional, all combinable — AND'd together):
//   search          — partial, case-insensitive match on projectName
//   committee       — exact match
//   status          — exact match
//   priority        — exact match
//   assignedMember  — partial, case-insensitive match against pointPersons
//                      or requestingHead
//   deadlineFrom    — eventDate >= this date (ISO string)
//   deadlineTo      — eventDate <= this date (ISO string)
const getAllProjects = async (req, res) => {
    try {
        const {
            search,
            status,
            committee,
            priority,
            assignedMember,
            deadlineFrom,
            deadlineTo
        } = req.query;

        const filter = {};

        if (status)    filter.status    = status;
        if (committee) filter.committee = committee;
        if (priority)  filter.priority  = priority;

        if (search) {
            filter.projectName = containsRegex(search);
        }

        if (assignedMember) {
            const re = containsRegex(assignedMember);
            filter.$or = [{ pointPersons: re }, { requestingHead: re }];
        }

        if (deadlineFrom || deadlineTo) {
            filter.eventDate = {};
            if (deadlineFrom) filter.eventDate.$gte = new Date(deadlineFrom);
            if (deadlineTo)   filter.eventDate.$lte = new Date(deadlineTo);
        }

        const projects = await ProjectRequest.find(filter)
            .populate('submittedBy', 'name email committee position')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: projects });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/projects/:id — Get a single project request
const getProjectById = async (req, res) => {
    try {
        const project = await ProjectRequest.findById(req.params.id)
            .populate('submittedBy', 'name email committee position');

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        res.json({ success: true, data: project });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /api/projects/:id — Edit a project request (logs a diff-based revision)
const updateProject = async (req, res) => {
    try {
        const project = await ProjectRequest.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        const { note, ...updateData } = req.body;

        const before = project.toObject();
        const changes = diffFields(before, updateData);

        if (!changes.length) {
            return res.json({ success: true, message: 'No changes to save.', data: project });
        }

        Object.assign(project, updateData);

        project.revisions.push({
            action: 'Project details updated',
            madeBy: req.currentUser.name,
            userId: req.currentUser.id,
            changes,
            note: note || summariseChanges(changes)
        });

        await project.save();

        res.json({ success: true, data: project });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// PATCH /api/projects/:id/status — Update project status
const updateProjectStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const project = await ProjectRequest.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        const previousStatus = project.status;

        if (previousStatus !== status) {
            project.status = status;

            project.revisions.push({
                action: `Status changed to "${status}"`,
                madeBy: req.currentUser.name,
                userId: req.currentUser.id,
                changes: [{ field: 'status', from: previousStatus, to: status }],
                note: `status: ${previousStatus} \u2192 ${status}`
            });
        }

        await project.save();

        res.json({ success: true, data: project });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// GET /api/projects/:id/revisions — Full revision/update log for a project
const getProjectRevisions = async (req, res) => {
    try {
        const project = await ProjectRequest.findById(req.params.id).select('revisions projectName');

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        const revisions = [...project.revisions].sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );

        res.json({ success: true, data: revisions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/projects/:id — Delete a project request
const deleteProject = async (req, res) => {
    try {
        const project = await ProjectRequest.findByIdAndDelete(req.params.id);

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        res.json({ success: true, message: 'Project deleted.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    submitProject,
    getAllProjects,
    getProjectById,
    updateProject,
    updateProjectStatus,
    getProjectRevisions,
    deleteProject
};
