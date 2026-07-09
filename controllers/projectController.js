const ProjectRequest = require('../models/ProjectRequest');

// POST /api/projects — Submit a new project request
const submitProject = async (req, res) => {
    try {
        const project = new ProjectRequest(req.body);
        await project.save();

        res.status(201).json({
            success: true,
            message: 'Project request submitted successfully.',
            refNumber: project.refNumber,
            id: project._id
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// GET /api/projects — Get all project requests (for dashboard)
const getAllProjects = async (req, res) => {
    try {
        const { status, committee, priority } = req.query;
        const filter = {};

        if (status)    filter.status    = status;
        if (committee) filter.committee = committee;
        if (priority)  filter.priority  = priority;

        const projects = await ProjectRequest.find(filter)
            .populate('submittedBy', 'name email committee position')
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
            .populate('submittedBy', 'name email committee position');

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        res.json({ success: true, data: project });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /api/projects/:id/status — Update project status
const updateProjectStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const project = await ProjectRequest.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        res.json({ success: true, data: project });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
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
    updateProjectStatus,
    deleteProject
};
