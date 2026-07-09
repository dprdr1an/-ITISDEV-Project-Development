const express = require('express');
const router  = express.Router();

const {
    submitProject,
    getAllProjects,
    getProjectById,
    updateProjectStatus,
    deleteProject
} = require('../controllers/projectController');

// GET  /api/projects       — list all projects (with optional ?status=&committee= filters)
router.get('/',       getAllProjects);

// POST /api/projects       — submit a new project request
router.post('/',      submitProject);

// GET  /api/projects/:id   — get one project
router.get('/:id',    getProjectById);

// PATCH /api/projects/:id/status — update status
router.patch('/:id/status', updateProjectStatus);

// DELETE /api/projects/:id — delete project
router.delete('/:id', deleteProject);

module.exports = router;
