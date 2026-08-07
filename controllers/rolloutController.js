const mongoose = require('mongoose');

const RolloutForm = require('../models/RolloutForm');
const ProjectRequest = require('../models/ProjectRequest');
const ProjectFile = require('../models/ProjectFile');
const Notification = require('../models/Notification');
const User = require('../models/User');

const { diffFields, summariseChanges } = require('./utils/diffRevision');
const { generateRolloutPdf } = require('../services/rolloutPdfService');

/** Folder the generated PDFs are filed under in the File Repository. */
const ROLLOUT_FOLDER = 'Rollout Forms';

/** Keeps only member ids that exist, preserving order and removing duplicates. */
async function resolveMemberIds(ids) {
    if (!Array.isArray(ids) || !ids.length) return [];

    const valid = ids
        .map(String)
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .filter((id, i, all) => all.indexOf(id) === i);

    if (!valid.length) return [];

    const found = await User.find({ _id: { $in: valid } }).select('_id').lean();
    const existing = new Set(found.map((u) => String(u._id)));

    return valid.filter((id) => existing.has(id));
}

/**
 * Rollout forms historically stored only a project name. Resolve that to a
 * real ProjectRequest so the generated PDF has something to attach to.
 * Returns null when no project matches — the rollout still saves.
 */
async function resolveProject(rollout) {
    // An explicit reference from the project selector is authoritative,
    // but still verified so a stale client cannot store a dangling id.
    if (rollout.project && mongoose.Types.ObjectId.isValid(rollout.project)) {
        const chosen = await ProjectRequest.findById(rollout.project)
            .select('_id')
            .lean();

        if (chosen) return chosen._id;
    }

    // An absent, malformed, or stale id falls through to matching on name
    // rather than failing outright.

    const name = String(rollout.projectName || '').trim();
    if (!name) return null;

    // Exact match first, then case-insensitive, so near-misses still link
    const exact = await ProjectRequest.findOne({ projectName: name })
        .select('_id')
        .lean();

    if (exact) return exact._id;

    const loose = await ProjectRequest.findOne({
        projectName: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')
    }).select('_id').lean();

    return loose ? loose._id : null;
}

/**
 * Everything that happens after a rollout is submitted: render the PDF,
 * file it in the repository, and notify the point persons.
 *
 * Deliberately non-fatal. A submitted rollout is already saved by the
 * time this runs, so a PDF or mail failure is logged and reported in the
 * response rather than rolled back — the officer should not be told the
 * submission failed when it did not.
 */
async function publishRollout(rollout, currentUser) {
    const result = { pdf: null, notified: 0, warnings: [] };

    const projectId = await resolveProject(rollout);

    if (projectId && !rollout.project) {
        rollout.project = projectId;
        await rollout.save();
    }

    // ── Generate and file the PDF ──
    if (!projectId) {
        result.warnings.push(
            'No matching project was found, so the PDF was not filed in the repository.'
        );
    } else {
        try {
            const meta = await generateRolloutPdf(rollout, {
                submitterName: currentUser.name,
                projectName: rollout.projectName
            });

            const file = await ProjectFile.create({
                project: projectId,
                originalName: meta.originalName,
                storedName: meta.storedName,
                filePath: meta.filePath,
                category: 'Rollout Form',
                // The folder is created implicitly: it is a field on the
                // record, so filing the first PDF makes the folder exist.
                folder: ROLLOUT_FOLDER,
                mimeType: meta.mimeType,
                size: meta.size,
                uploadedBy: currentUser.id
            });

            result.pdf = {
                id: file._id,
                name: meta.originalName,
                folder: ROLLOUT_FOLDER
            };
        } catch (err) {
            console.error('Rollout PDF generation failed:', err.message);
            result.warnings.push('The rollout PDF could not be generated.');
        }
    }

    // ── Notify the point persons ──
    const recipients = (rollout.pointPersonUsers || [])
        .map(String)
        .filter((id, i, all) => all.indexOf(id) === i)
        .filter((id) => String(id) !== String(currentUser.id));

    if (!recipients.length && (rollout.pointPersons || []).length) {
        result.warnings.push(
            'Point persons were named but not linked to member accounts, so no notification was sent.'
        );
    }

    for (const recipient of recipients) {
        try {
            await Notification.create({
                recipient,
                title: 'Rollout form submitted',
                message:
                    currentUser.name +
                    ' submitted the rollout form for "' +
                    rollout.projectName + '". ' +
                    (result.pdf
                        ? 'The generated PDF has been added to the Rollout Forms folder and is ready for your review.'
                        : 'It is ready for your review.'),
                type: 'ROLLOUT_UPDATED',
                relatedProject: projectId || null
            });

            result.notified += 1;
        } catch (err) {
            console.error('Rollout notification failed:', err.message);
        }
    }

    return result;
}

// POST /api/rollouts — Save or submit a rollout form
const saveRollout = async (req, res) => {
    try {
        const { submit, ...formData } = req.body;

        // If submitting (not just saving draft), change status
        if (submit) {
            formData.status = 'Submitted';
        }

        const rollout = new RolloutForm(formData);

        // Only ids that resolve to real members are stored, so a stale
        // client value cannot write a dangling reference or misdirect a
        // notification.
        rollout.pointPersonUsers = await resolveMemberIds(formData.pointPersonUsers);

        // Requesting head resolved the same way Project Requests do it: the
        // display name comes from the member record, so the stored name and
        // the stored reference can never disagree.
        const headIds = await resolveMemberIds(
            formData.requestingHeadUser ? [formData.requestingHeadUser] : []
        );

        if (headIds.length) {
            const head = await User.findById(headIds[0]).select('name').lean();

            rollout.requestingHeadUser = head ? head._id : null;
            if (head) rollout.requestingHead = head.name;
        } else {
            rollout.requestingHeadUser = null;
        }

        // Add initial revision log entry. Identity comes from the signed-in
        // session, not from client input.
        rollout.revisions.push({
            action: submit ? 'Rollout submitted for review' : 'Draft saved',
            madeBy: req.currentUser.name,
            userId: req.currentUser.id,
            note: submit
                ? 'Sent to chairpersons for review and approval.'
                : 'Form progress saved as draft.'
        });

        await rollout.save();

        // Drafts stop here. Only a submitted rollout produces a PDF and
        // notifies anyone.
        const published = submit
            ? await publishRollout(rollout, req.currentUser)
            : null;

        res.status(201).json({
            success: true,
            message: submit ? 'Rollout submitted successfully.' : 'Draft saved.',
            id: rollout._id,
            revision: rollout.revisions[rollout.revisions.length - 1],
            pdf: published ? published.pdf : null,
            notified: published ? published.notified : 0,
            warnings: published ? published.warnings : []
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// GET /api/rollouts — Get all rollout forms
const getAllRollouts = async (req, res) => {
    try {
        const { status, committee } = req.query;
        const filter = {};

        if (status)    filter.status    = status;
        if (committee) filter.committee = committee;

        const rollouts = await RolloutForm.find(filter)
            .populate('submittedBy', 'name email committee position')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: rollouts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/rollouts/:id — Get a single rollout form
const getRolloutById = async (req, res) => {
    try {
        const rollout = await RolloutForm.findById(req.params.id)
            .populate('submittedBy', 'name email committee position');

        if (!rollout) {
            return res.status(404).json({ success: false, message: 'Rollout not found.' });
        }

        res.json({ success: true, data: rollout });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/rollouts/:id/revisions — Full revision/update log for a rollout
const getRolloutRevisions = async (req, res) => {
    try {
        const rollout = await RolloutForm.findById(req.params.id).select('revisions projectName');

        if (!rollout) {
            return res.status(404).json({ success: false, message: 'Rollout not found.' });
        }

        const revisions = [...rollout.revisions].sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );

        res.json({ success: true, data: revisions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /api/rollouts/:id — Update a rollout (edit draft or add revision)
const updateRollout = async (req, res) => {
    try {
        const { revisionNote, ...updateData } = req.body;

        const rollout = await RolloutForm.findById(req.params.id);

        if (!rollout) {
            return res.status(404).json({ success: false, message: 'Rollout not found.' });
        }

        const before = rollout.toObject();
        const changes = diffFields(before, updateData);

        // Apply updates
        Object.assign(rollout, updateData);

        // Log the revision — identity from the session, content from the diff
        rollout.revisions.push({
            action: 'Rollout updated',
            madeBy: req.currentUser.name,
            userId: req.currentUser.id,
            changes,
            note: revisionNote || summariseChanges(changes) || 'Fields updated.'
        });

        await rollout.save();

        res.json({ success: true, data: rollout });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// PATCH /api/rollouts/:id/status — Approve or reject a rollout
const updateRolloutStatus = async (req, res) => {
    try {
        const { status, note } = req.body;

        const rollout = await RolloutForm.findById(req.params.id);

        if (!rollout) {
            return res.status(404).json({ success: false, message: 'Rollout not found.' });
        }

        const previousStatus = rollout.status;
        rollout.status = status;

        rollout.revisions.push({
            action: `Status changed to "${status}"`,
            madeBy: req.currentUser.name,
            userId: req.currentUser.id,
            changes: [{ field: 'status', from: previousStatus, to: status }],
            note: note || `status: ${previousStatus} \u2192 ${status}`
        });

        await rollout.save();

        res.json({ success: true, data: rollout });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    saveRollout,
    getAllRollouts,
    getRolloutById,
    getRolloutRevisions,
    updateRollout,
    updateRolloutStatus
};
