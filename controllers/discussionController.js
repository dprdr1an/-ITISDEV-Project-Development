const Discussion = require("../models/Discussion");
const ProjectRequest = require("../models/ProjectRequest");

const createDiscussion = async (req, res) => {

    try {
        const { projectId, update } = req.body;
        if (!projectId || !update) {
            return res.status(400).json({
                success: false,
                message: "Project and update are required."
            });
        }

        const project = await ProjectRequest.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        const discussion = await Discussion.create({
            project: projectId,
            author: req.currentUser.id,
            update
        });
        res.status(201).json({
            success: true,
            message: "Project update posted.",
            data: discussion
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }

};

const getDiscussionByProject = async (req, res) => {
    try {
        const discussions = await Discussion.find({
            project: req.params.projectId
        })
        .populate("author", "name committee position")
        .populate("comments.author", "name")
        .sort({ createdAt: -1 });
        res.json({
            success: true,
            data: discussions
        });

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const addComment = async (req, res) => {

    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Comment cannot be empty."
            });
        }

        const discussion = await Discussion.findById(req.params.id);

        if (!discussion) {
            return res.status(404).json({
                success: false,
                message: "Discussion not found."
            });
        }

        discussion.comments.push({
            author: req.currentUser.id,
            message
        });

        await discussion.save();
        res.json({
            success: true,
            message: "Comment added."
        });
    }

    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {

    createDiscussion,
    getDiscussionByProject,
    addComment
};