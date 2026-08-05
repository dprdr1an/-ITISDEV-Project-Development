const RolloutForm = require('../models/RolloutForm');
const { diffFields, summariseChanges } = require('./utils/diffRevision');

// POST /api/rollouts — Save or submit a rollout form
const saveRollout = async (req, res) => {
    try {
        const { submit, ...formData } = req.body;

        // If submitting (not just saving draft), change status
        if (submit) {
            formData.status = 'Submitted';
        }

        const rollout = new RolloutForm(formData);

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

        res.status(201).json({
            success: true,
            message: submit ? 'Rollout submitted successfully.' : 'Draft saved.',
            id: rollout._id,
            revision: rollout.revisions[rollout.revisions.length - 1]
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
