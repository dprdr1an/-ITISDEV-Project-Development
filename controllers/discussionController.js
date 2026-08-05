/* ==========================================================
   Discussions — project-scoped message threads.

   Migrated from the Project Discussion and Updates branch and adapted
   to the current architecture: identity comes from the session, and
   every read/write is gated on project membership so one committee
   cannot read another's thread.
========================================================== */

const mongoose = require("mongoose");

const Discussion = require("../models/Discussion");
const ProjectRequest = require("../models/ProjectRequest");

const { canAccessProject, accessibleProjects } =
    require("./utils/projectAccess");

const AUTHOR_FIELDS = "name committee position avatarUrl";

/** Loads a project and confirms the signed-in user may open it. */
async function loadPermittedProject(projectId, user, res) {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        res.status(400).json({
            success: false,
            message: "Invalid project ID."
        });
        return null;
    }

    const project = await ProjectRequest.findById(projectId);

    if (!project) {
        res.status(404).json({
            success: false,
            message: "Project not found."
        });
        return null;
    }

    if (!(await canAccessProject(project, user))) {
        res.status(403).json({
            success: false,
            message: "You do not have access to this project's discussion."
        });
        return null;
    }

    return project;
}

// GET /api/discussions/projects — projects the user may discuss
const getMyProjects = async (req, res) => {
    try {
        const projects = await ProjectRequest.find()
            .select("projectName committee status submittedBy requestingHead pointPersons")
            .sort({ createdAt: -1 })
            .lean();

        const permitted = await accessibleProjects(projects, req.currentUser);

        return res.status(200).json({ success: true, data: permitted });
    } catch (error) {
        console.error("Get discussion projects error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load your projects."
        });
    }
};

// GET /api/discussions/project/:projectId — the thread, oldest first
const getDiscussionByProject = async (req, res) => {
    try {
        const project = await loadPermittedProject(
            req.params.projectId,
            req.currentUser,
            res
        );

        if (!project) return undefined;

        // Ascending: a chat thread reads top-to-bottom, newest at the end
        const discussions = await Discussion.find({ project: project._id })
            .populate("author", AUTHOR_FIELDS)
            .populate("comments.author", AUTHOR_FIELDS)
            .sort({ createdAt: 1 });

        return res.status(200).json({
            success: true,
            project: {
                _id: project._id,
                projectName: project.projectName,
                committee: project.committee,
                status: project.status
            },
            data: discussions
        });
    } catch (error) {
        console.error("Get discussion error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to load this discussion."
        });
    }
};

// POST /api/discussions — post a message to a project thread
const createDiscussion = async (req, res) => {
    try {
        const { projectId } = req.body;

        // Reject whitespace-only posts before touching the database
        const update = String(req.body.update || "").trim();

        if (!projectId || !update) {
            return res.status(400).json({
                success: false,
                message: "Project and message are required."
            });
        }

        if (update.length > 2000) {
            return res.status(400).json({
                success: false,
                message: "Message is too long (2000 characters max)."
            });
        }

        const project = await loadPermittedProject(
            projectId,
            req.currentUser,
            res
        );

        if (!project) return undefined;

        const discussion = await Discussion.create({
            project: project._id,
            // Author comes from the session, never the request body
            author: req.currentUser.id,
            update
        });

        const populated = await Discussion.findById(discussion._id)
            .populate("author", AUTHOR_FIELDS);

        return res.status(201).json({
            success: true,
            message: "Message posted.",
            data: populated
        });
    } catch (error) {
        console.error("Create discussion error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to post your message."
        });
    }
};

// POST /api/discussions/:id/comment — reply to a message
const addComment = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid discussion ID."
            });
        }

        const message = String(req.body.message || "").trim();

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

        // Commenting requires the same access as reading the thread
        const project = await loadPermittedProject(
            discussion.project,
            req.currentUser,
            res
        );

        if (!project) return undefined;

        discussion.comments.push({
            author: req.currentUser.id,
            message
        });

        await discussion.save();

        const populated = await Discussion.findById(discussion._id)
            .populate("author", AUTHOR_FIELDS)
            .populate("comments.author", AUTHOR_FIELDS);

        return res.status(200).json({
            success: true,
            message: "Comment added.",
            data: populated
        });
    } catch (error) {
        console.error("Add comment error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to add your comment."
        });
    }
};

module.exports = {
    getMyProjects,
    getDiscussionByProject,
    createDiscussion,
    addComment
};
