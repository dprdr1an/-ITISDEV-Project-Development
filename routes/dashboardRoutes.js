const express = require('express');

const router = express.Router();

const { requireAuth } = require('../middleware/authMiddleware');

// Every endpoint in this router requires a signed-in user
router.use(requireAuth);

const { getSummary } = require('../controllers/dashboardController');

// GET /api/dashboard/summary?userId=<id>
router.get('/summary', getSummary);

module.exports = router;
