const express = require("express");

const router = express.Router();

const upload = require("../middleware/uploadMiddleware");

const fileController = require("../controllers/fileController");

router.post(

    "/upload",

    upload.single("file"),

    fileController.uploadFile

);

router.get("/", fileController.getFiles);

router.get("/:id", fileController.getFile);

router.put("/:id", fileController.updateCategory);

router.delete("/:id", fileController.deleteFile);

router.get("/download/:id", fileController.downloadFile);

module.exports = router;
