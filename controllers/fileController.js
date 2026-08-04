const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const ProjectFile = require("../models/ProjectFile");

// POST /api/files/upload
exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file was received."
            });
        }

        if (!mongoose.Types.ObjectId.isValid(req.body.project)) {
            return res.status(400).json({
                success: false,
                message: "A valid project must be selected."
            });
        }

        const file = await ProjectFile.create({
            project: req.body.project,
            category: req.body.category || "Other",
            folder: req.body.folder || "General",
            originalName: req.file.originalname,
            storedName: req.file.filename,
            filePath: req.file.path,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedBy: mongoose.Types.ObjectId.isValid(req.body.uploadedBy)
                ? req.body.uploadedBy
                : null
        });

        const populated = await ProjectFile.findById(file._id)
            .populate("project", "projectName status")
            .populate("uploadedBy", "name email");

        return res.status(201).json({
            success: true,
            message: "File uploaded successfully.",
            file: populated
        });
    } catch (err) {
        console.error("Upload file error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// GET /api/files?project=&category=&folder=
exports.getFiles = async (req, res) => {
    try {
        const filter = {};

        if (req.query.project) {
            if (!mongoose.Types.ObjectId.isValid(req.query.project)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid project ID."
                });
            }

            filter.project = req.query.project;
        }

        if (req.query.category) filter.category = req.query.category;
        if (req.query.folder) filter.folder = req.query.folder;

        const files = await ProjectFile.find(filter)
            .populate("project", "projectName status")
            .populate("uploadedBy", "name email")
            .sort({ createdAt: -1 });

        // Category tallies drive the repository folder cards
        const counts = await ProjectFile.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } }
        ]);

        const categoryCounts = counts.reduce((acc, row) => {
            acc[row._id] = row.count;
            return acc;
        }, {});

        return res.status(200).json({
            success: true,
            count: files.length,
            categoryCounts,
            files
        });
    } catch (err) {
        console.error("Get files error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// GET /api/files/:id
exports.getFile = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid file ID."
            });
        }

        const file = await ProjectFile.findById(req.params.id)
            .populate("project", "projectName status")
            .populate("uploadedBy", "name email");

        if (!file) {
            return res.status(404).json({
                success: false,
                message: "File not found."
            });
        }

        return res.status(200).json({ success: true, file });
    } catch (err) {
        console.error("Get file error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// PUT /api/files/:id — move between categories/folders
exports.updateCategory = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid file ID."
            });
        }

        const updates = {};

        if (req.body.category) updates.category = req.body.category;
        if (req.body.folder) updates.folder = req.body.folder;

        const file = await ProjectFile.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        ).populate("project", "projectName status");

        if (!file) {
            return res.status(404).json({
                success: false,
                message: "File not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "File updated.",
            file
        });
    } catch (err) {
        console.error("Update file error:", err);

        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
};

// DELETE /api/files/:id
exports.deleteFile = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid file ID."
            });
        }

        const file = await ProjectFile.findByIdAndDelete(req.params.id);

        if (!file) {
            return res.status(404).json({
                success: false,
                message: "File not found."
            });
        }

        // Remove the file from disk; a missing file is not a fatal error
        fs.promises
            .unlink(path.resolve(file.filePath))
            .catch(() => undefined);

        return res.status(200).json({
            success: true,
            message: "File deleted."
        });
    } catch (err) {
        console.error("Delete file error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// GET /api/files/download/:id
exports.downloadFile = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid file ID."
            });
        }

        const file = await ProjectFile.findById(req.params.id);

        if (!file) {
            return res.status(404).json({
                success: false,
                message: "File not found."
            });
        }

        const absolute = path.resolve(file.filePath);
        const uploadsRoot = path.resolve("uploads");

        // Guard against stored paths escaping the uploads directory
        if (!absolute.startsWith(uploadsRoot + path.sep)) {
            return res.status(400).json({
                success: false,
                message: "Invalid file path."
            });
        }

        if (!fs.existsSync(absolute)) {
            return res.status(404).json({
                success: false,
                message: "File is missing from storage."
            });
        }

        return res.download(absolute, file.originalName);
    } catch (err) {
        console.error("Download file error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
