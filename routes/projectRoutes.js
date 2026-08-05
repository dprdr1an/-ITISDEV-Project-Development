const express = require('express');
const router  = express.Router();

const { requireAuth } = require('../middleware/authMiddleware');

// Every endpoint in this router requires a signed-in user
router.use(requireAuth);

const {
    submitProject,
    getAllProjects,
    getProjectById,
    updateProject,
    updateProjectStatus,
    getProjectRevisions,
    deleteProject
} = require('../controllers/projectController');

// GET  /api/projects       — list all projects (with optional ?status=&committee= filters)
router.get('/',       getAllProjects);

// POST /api/projects       — submit a new project request
router.post('/',      submitProject);

// GET  /api/projects/:id   — get one project
router.get('/:id',    getProjectById);

// GET  /api/projects/:id/revisions — full revision & update log
router.get('/:id/revisions', getProjectRevisions);

// PATCH /api/projects/:id  — edit project details
router.patch('/:id',  updateProject);

// PATCH /api/projects/:id/status — update status
router.patch('/:id/status', updateProjectStatus);

// DELETE /api/projects/:id — delete project
router.delete('/:id', deleteProject);

module.exports = router;
