const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Register User
const registerUser = async (req, res) => {
    try {
        const { name, committee, position, email, password } = req.body;

        // Check required fields
        if (!name || !committee || !position || !email || !password) {
            return res.status(400).json({
                message: 'Please fill in all fields.'
            });
        }

        // Allow only DLSU emails
        if (!email.toLowerCase().endsWith('@dlsu.edu.ph')) {
            return res.status(400).json({
                message: 'Only DLSU email addresses are allowed.'
            });
        }

        // Check if email already exists
        const existingUser = await User.findOne({
            email: email.toLowerCase()
        });

        if (existingUser) {
            return res.status(409).json({
                message: 'Email is already registered.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Only these two roles exist in the system
        if (!['Chairperson', 'Executive'].includes(position)) {
            return res.status(400).json({
                message: 'Please select a valid position.'
            });
        }

        // Create user (the model derives firstName/lastName from name)
        const user = new User({
            name,
            committee,
            position,
            email: email.toLowerCase(),
            password: hashedPassword
        });

        await user.save();

        res.status(201).json({
            message: 'Registration successful.'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server error.'
        });
    }
};

const loginUser = async (req, res) => {
    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Please enter your email and password.'
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        const publicUser = user.toPublic();

        // Establish the server-side session used for API authorization
        req.session.user = publicUser;

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);

                return res.status(500).json({
                    message: 'Could not start your session. Please try again.'
                });
            }

            return res.status(200).json({
                message: 'Login successful.',
                user: publicUser
            });
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: 'Server error.'
        });

    }
};

// GET /auth/me — rehydrate the client from the session
const getCurrentUser = async (req, res) => {
    const sessionUser = req.session && req.session.user;

    if (!sessionUser) {
        return res.status(401).json({
            message: 'Not signed in.'
        });
    }

    try {
        // Re-read so role or profile changes take effect without re-login
        const user = await User.findById(sessionUser.id);

        if (!user) {
            req.session.destroy(() => undefined);

            return res.status(401).json({
                message: 'Account no longer exists.'
            });
        }

        const publicUser = user.toPublic();
        req.session.user = publicUser;

        return res.status(200).json({ user: publicUser });
    } catch (error) {
        console.error('Get current user error:', error);

        return res.status(500).json({ message: 'Server error.' });
    }
};

// POST /auth/logout — destroy the session
const logoutUser = (req, res) => {
    if (!req.session) {
        return res.status(200).json({ message: 'Logged out.' });
    }

    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);

            return res.status(500).json({
                message: 'Could not end the session.'
            });
        }

        res.clearCookie('imc.sid');

        return res.status(200).json({ message: 'Logged out.' });
    });
};

module.exports = {
    registerUser,
    loginUser,
    getCurrentUser,
    logoutUser
};