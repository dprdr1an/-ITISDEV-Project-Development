const express = require('express');

const {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask
} = require('../controllers/taskController');

const {
    requireAuth,
    requireRole,
    ROLES
} = require('../middleware/authMiddleware');

const router = express.Router();

// Everything below requires a signed-in user
router.use(requireAuth);

// ── Task Assignment (Chairperson only) ──────────────────────
// Creating, editing/reassigning and deleting are chairperson actions.
router.post('/', requireRole(ROLES.CHAIRPERSON), createTask);
router.delete('/:id', requireRole(ROLES.CHAIRPERSON), deleteTask);

// ── Shared reads ────────────────────────────────────────────
// The controller scopes executives to their own tasks.
router.get('/', getTasks);
router.get('/:id', getTaskById);

// ── Update ──────────────────────────────────────────────────
// Chairpersons may edit any field; assignees may only change status.
// That split is enforced inside updateTask.
router.put('/:id', updateTask);

module.exports = router;
