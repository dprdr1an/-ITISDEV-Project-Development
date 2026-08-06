const mongoose = require('mongoose');

const ProjectRequest = require('../models/ProjectRequest');
const User = require('../models/User');
const { diffFields, summariseChanges } = require('./utils/diffRevision');
const {
    containsRegex,
    matchAnyField,
    addClause,
    dateRange
} = require('./utils/queryHelpers');

/**
 * Resolves who the project is being requested for.
 *
 * `requestingHeadUser` is an optional member id sent when the submitter used
 * "on behalf of another Executive". It is verified against the database here
 * rather than trusted, and the display name is taken from that record so the
 * stored name and reference can never disagree.
 *
 * Falls back to the free-text `requestingHead` so existing clients and legacy
 * records keep working unchanged.
 */
async function resolveRequestingHead(body, currentUser) {
    const id = body.requestingHeadUser;

    if (id) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            const error = new Error('Invalid requesting head selected.');
            error.status = 400;
            throw error;
        }

        const member = await User.findById(id).select('name position');

        if (!member) {
            const error = new Error('The selected requesting head no longer exists.');
            error.status = 400;
            throw error;
        }

        return {
            requestingHead: member.name,
            requestingHeadUser: member._id,
            onBehalf: String(member._id) !== String(currentUser.id)
        };
    }

    // No member selected: keep whatever name was typed, unlinked.
    return {
        requestingHead: String(body.requestingHead || '').trim(),
        requestingHeadUser: null,
        onBehalf: false
    };
}

// POST /api/projects — Submit a new project request
const submitProject = async (req, res) => {
    try {
        const head = await resolveRequestingHead(req.body, req.currentUser);

        const project = new ProjectRequest(req.body);

        // Both are set from trusted sources, never the raw body:
        //   submittedBy    — whoever is signed in and clicked Submit
        //   requestingHead — the Executive responsible for the project
        project.submittedBy = req.currentUser.id;
        project.requestingHead = head.requestingHead;
        project.requestingHeadUser = head.requestingHeadUser;

        // Revision & Update Log — first entry records creation. The user
        // comes from the signed-in session, never from the request body.
        project.revisions.push({
            action: 'Project request submitted',
            madeBy: req.currentUser.name,
            userId: req.currentUser.id,
            note: head.onBehalf
                ? 'Project request created on behalf of ' +
                  head.requestingHead + '.'
                : 'Project request created.'
        });

        await project.save();

        res.status(201).json({
            success: true,
            message: 'Project request submitted successfully.',
            refNumber: project.refNumber,
            id: project._id
        });
    } catch (error) {
        res.status(error.status || 400).json({
            success: false,
            message: error.message
        });
    }
};

// GET /api/projects — Search & filter project requests (for dashboard / status page)
//
// Query params (all optional, all combinable — AND'd together):
//   search          — partial, case-insensitive match on projectName
//                      or description (the "objective" field in the UI)
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

        // Title or objective. addClause keeps this AND'd with the
        // assignedMember search below instead of one $or clobbering the other.
        addClause(filter, matchAnyField(search, ['projectName', 'description']));

        if (assignedMember) {
            const re = containsRegex(assignedMember);
            addClause(filter, {
                $or: [{ pointPersons: re }, { requestingHead: re }]
            });
        }

        addClause(filter, dateRange('eventDate', deadlineFrom, deadlineTo));

        const projects = await ProjectRequest.find(filter)
            .populate('submittedBy', 'name email committee position')
            .populate('requestingHeadUser', 'name email committee position')
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
            .populate('submittedBy', 'name email committee position')
            .populate('requestingHeadUser', 'name email committee position');

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

        // submittedBy records who originally filed the request — it is part of
        // the audit trail and is never rewritten by an edit.
        delete updateData.submittedBy;

        // Re-resolve the requesting head so the stored name and reference
        // stay in step when an editor changes who it is assigned to.
        if (
            updateData.requestingHeadUser !== undefined ||
            updateData.requestingHead !== undefined
        ) {
            const head = await resolveRequestingHead(updateData, req.currentUser);

            updateData.requestingHead = head.requestingHead;
            updateData.requestingHeadUser = head.requestingHeadUser;
        }

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
        res.status(error.status || 400).json({ success: false, message: error.message });
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
