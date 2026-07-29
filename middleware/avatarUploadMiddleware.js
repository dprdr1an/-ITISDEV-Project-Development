const multer = require('multer');
const path = require('path');

/**
 * Separate from uploadMiddleware: profile pictures go to their own folder,
 * are images only, and are capped much smaller than project files.
 */
const storage = multer.diskStorage({
    destination(req, file, cb) {
        // Absolute: a cwd-relative path silently writes to the wrong place
        // when the server is started from another directory.
        cb(null, path.join(__dirname, '..', 'uploads', 'avatars'));
    },

    filename(req, file, cb) {
        const unique =
            Date.now() + '-' + Math.round(Math.random() * 1e9);

        cb(null, unique + path.extname(file.originalname).toLowerCase());
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Profile picture must be a JPG, PNG or WEBP image.'));
    }
};

module.exports = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2 MB
    }
});
