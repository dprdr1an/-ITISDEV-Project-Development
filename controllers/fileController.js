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

    }

    catch(err){

        res.status(500).json({

            message: err.message

        });

    }

};
