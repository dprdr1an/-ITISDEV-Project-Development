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

module.exports = {
    registerUser
};