const express = require('express');

const router = express.Router();

const {
    registerUser,
    loginUser,
    getCurrentUser,
    logoutUser
} = require('../controllers/authController');

// Register
router.post('/register', registerUser);

// Login — establishes the session
router.post('/login', loginUser);

// Who am I (used to rehydrate / verify the session)
router.get('/me', getCurrentUser);

// Logout — destroys the session
router.post('/logout', logoutUser);

module.exports = router;
