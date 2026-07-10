const ProjectFile = require("../models/ProjectFile");

exports.uploadFile = async (req, res) => {
    try {
        const file = await ProjectFile.create({
            project: req.body.project,
            category: req.body.category,
            folder: req.body.folder,
            originalName: req.file.originalname,
            storedName: req.file.filename,
            filePath: req.file.path,
            mimeType: req.file.mimetype,
            size: req.file.size
        });

        res.status(201).json(file);
    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
};

exports.getFiles = async (req, res) => {
    res.send("getFiles");
};

exports.getFile = async (req, res) => {
    res.send("getFile");
};

exports.updateCategory = async (req, res) => {
    res.send("updateCategory");
};

exports.deleteFile = async (req, res) => {
    res.send("deleteFile");
};

exports.downloadFile = async (req, res) => {
    res.send("downloadFile");
};