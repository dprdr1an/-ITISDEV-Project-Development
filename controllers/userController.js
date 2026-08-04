const mongoose = require('mongoose');
const User = require('../models/User');

// GET /api/users — list members (passwords never returned)
exports.getUsers = async (req, res) => {
    try {
        const filter = {};

        if (req.query.committee) {
            filter.committee = req.query.committee;
        }

        if (req.query.position) {
            filter.position = req.query.position;
        }

        const users = await User.find(filter)
            .select('name firstName lastName email committee position avatarUrl createdAt')
            .sort({ name: 1 });

        return res.status(200).json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        console.error('Get users error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve members.'
        });
    }
};

// GET /api/users/:id — single member
exports.getUserById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID.'
            });
        }

        const user = await User.findById(req.params.id)
            .select('name firstName lastName email committee position avatarUrl createdAt');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        return res.status(200).json({ success: true, user });
    } catch (error) {
        console.error('Get user error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve user.'
        });
    }
};

/* ==========================================================
   Profile management
   Guarded by requireSelfOrRole in the routes, so a user can only
   reach their own record (chairpersons may also assist).
========================================================== */

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

/** Keep the session copy aligned after a profile change. */
function syncSession(req, user) {
    if (req.session && req.session.user &&
        String(req.session.user.id) === String(user._id)) {
        req.session.user = user.toPublic();
    }
}

// PUT /api/users/:id/profile
exports.updateProfile = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID.'
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        const { firstName, lastName, email } = req.body;

        if (firstName !== undefined) {
            if (!String(firstName).trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'First name cannot be empty.'
                });
            }

            user.firstName = String(firstName).trim();
        }

        if (lastName !== undefined) {
            user.lastName = String(lastName).trim();
        }

        if (email !== undefined) {
            const nextEmail = String(email).toLowerCase().trim();

            if (!nextEmail.endsWith('@dlsu.edu.ph')) {
                return res.status(400).json({
                    success: false,
                    message: 'Only DLSU email addresses are allowed.'
                });
            }

            if (nextEmail !== user.email) {
                const taken = await User.findOne({ email: nextEmail });

                if (taken) {
                    return res.status(409).json({
                        success: false,
                        message: 'That email is already registered.'
                    });
                }

                user.email = nextEmail;
            }
        }

        // Committee and position are organisational facts, not self-service.
        // They are returned for display but never written here.

        await user.save();
        syncSession(req, user);

        return res.status(200).json({
            success: true,
            message: 'Profile updated.',
            user: user.toPublic()
        });
    } catch (error) {
        console.error('Update profile error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to update profile.'
        });
    }
};

// PUT /api/users/:id/password
exports.changePassword = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID.'
            });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please enter your current and new password.'
            });
        }

        if (String(newPassword).length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters.'
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        // Always require the current password, even for a chairperson
        const matches = await bcrypt.compare(currentPassword, user.password);

        if (!matches) {
            return res.status(401).json({
                success: false,
                message: 'Your current password is incorrect.'
            });
        }

        user.password = await bcrypt.hash(String(newPassword), 10);
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Password changed.'
        });
    } catch (error) {
        console.error('Change password error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to change password.'
        });
    }
};

// POST /api/users/:id/avatar
exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image was received.'
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        // Remove the previous avatar so the folder does not grow forever
        if (user.avatarUrl) {
            const previous = path.join(
                __dirname,
                '..',
                user.avatarUrl.replace(/^\//, '')
            );

            fs.promises.unlink(previous).catch(() => undefined);
        }

        user.avatarUrl = '/uploads/avatars/' + req.file.filename;

        await user.save();
        syncSession(req, user);

        return res.status(200).json({
            success: true,
            message: 'Profile picture updated.',
            user: user.toPublic()
        });
    } catch (error) {
        console.error('Upload avatar error:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to upload profile picture.'
        });
    }
};
