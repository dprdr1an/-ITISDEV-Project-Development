const express = require('express');
const router  = express.Router();

const {
    saveRollout,
    getAllRollouts,
    getRolloutById,
    updateRollout,
    updateRolloutStatus
} = require('../controllers/rolloutController');

// GET  /api/rollouts       — list all rollout forms (optional ?status=&committee=)
router.get('/',       getAllRollouts);

// POST /api/rollouts       — save draft or submit rollout
router.post('/',      saveRollout);

// GET  /api/rollouts/:id   — get one rollout form
router.get('/:id',    getRolloutById);

// PATCH /api/rollouts/:id  — update / save revisions
router.patch('/:id',  updateRollout);

// PATCH /api/rollouts/:id/status — approve or reject
router.patch('/:id/status', updateRolloutStatus);

module.exports = router;
