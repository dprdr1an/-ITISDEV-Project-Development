const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({

    destination(req, file, cb) {

        cb(null, "uploads/");
    },

    filename(req, file, cb) {

        const unique =
            Date.now() + "-" + Math.round(Math.random() * 1e9);

        cb(
            null,
            unique + path.extname(file.originalname)
        );
    }

});

const fileFilter = (req, file, cb) => {

    const allowed = [

        "image/jpeg",
        "image/png",
        "application/pdf",

        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

        "application/vnd.openxmlformats-officedocument.presentationml.presentation",

        "text/plain"

    ];

    if (allowed.includes(file.mimetype)) {

        cb(null, true);

    } else {

        cb(new Error("Unsupported file type."));
    }

};

module.exports = multer({

    storage,

    fileFilter,

    limits: {

        fileSize: 10 * 1024 * 1024

    }

});
