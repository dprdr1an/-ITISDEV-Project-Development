const express = require("express");

const router = express.Router();

const { requireAuth } = require("../middleware/authMiddleware");

const {
    getMyProjects,
    getDiscussionByProject,
    createDiscussion,
    addComment
} = require("../controllers/discussionController");

// Discussions are never public
router.use(requireAuth);

// Projects the signed-in user may discuss (drives the project selector)
router.get("/projects", getMyProjects);

// One project's thread
router.get("/project/:projectId", getDiscussionByProject);

// Post a message
router.post("/", createDiscussion);

// Reply to a message
router.post("/:id/comment", addComment);

module.exports = router;
