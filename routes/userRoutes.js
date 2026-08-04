const express = require('express');

const router = express.Router();

const {
    getUsers,
    getUserById,
    updateProfile,
    changePassword,
    uploadAvatar
} = require('../controllers/userController');

const {
    requireAuth,
    requireSelfOrRole,
    ROLES
} = require('../middleware/authMiddleware');

const avatarUpload = require('../middleware/avatarUploadMiddleware');

// The member directory is not public
router.use(requireAuth);

// GET /api/users     — list members (optional ?committee=&position=)
router.get('/', getUsers);

// GET /api/users/:id — one member
router.get('/:id', getUserById);

// ── Profile: a user may only change their own record ────────
router.put(
    '/:id/profile',
    requireSelfOrRole('id', ROLES.CHAIRPERSON),
    updateProfile
);

// Password changes are always self-service, even for chairpersons
router.put(
    '/:id/password',
    requireSelfOrRole('id'),
    changePassword
);

router.post(
    '/:id/avatar',
    requireSelfOrRole('id', ROLES.CHAIRPERSON),
    avatarUpload.single('avatar'),
    uploadAvatar
);

module.exports = router;
