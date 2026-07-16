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

        // Create user
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

        res.status(200).json({
            message: 'Login successful.',
            user: {
                id: user._id,
                name: user.name,
                committee: user.committee,
                position: user.position,
                email: user.email
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: 'Server error.'
        });

    }
};

// Get User
const getUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('name committee position email')
            .sort({ name: 1 });

        res.json({
            success: true,
            users
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            success: false,
            message: 'Unable to load users.'
        });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getUsers
};