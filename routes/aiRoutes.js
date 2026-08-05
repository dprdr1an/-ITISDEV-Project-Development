const express = require('express');

const router = express.Router();

const { requireAuth } = require('../middleware/authMiddleware');

const { getStatus, createProposal } = require('../controllers/aiController');

// AI assistance is for signed-in officers only
router.use(requireAuth);

router.get('/status', getStatus);

router.post('/project-proposal', createProposal);

module.exports = router;
