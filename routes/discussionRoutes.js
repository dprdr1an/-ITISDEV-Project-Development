const express = require("express");

const router = express.Router();

const { requireAuth } = require("../middleware/authMiddleware");

const {
    createDiscussion,
    getDiscussionByProject,
    addComment
} = require("../controllers/discussionController");

router.use(requireAuth);

router.get("/project/:projectId", getDiscussionByProject);

router.post("/", createDiscussion);

router.post("/:id/comment", addComment);

module.exports = router;