const express = require("express");

const router = express.Router();

const { requireAuth } = require('../middleware/authMiddleware');

// Every endpoint in this router requires a signed-in user
router.use(requireAuth);

const upload = require("../middleware/uploadMiddleware");

const fileController = require("../controllers/fileController");

router.post("/upload", upload.single("file"), fileController.uploadFile);

router.get("/", fileController.getFiles);

// Must be declared before "/:id" or "download" is read as an ID
router.get("/download/:id", fileController.downloadFile);

router.get("/:id", fileController.getFile);

router.put("/:id", fileController.updateCategory);

router.delete("/:id", fileController.deleteFile);

module.exports = router;
