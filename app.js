require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');

const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ──────────────────────────────────────────
app.use('/auth', require('./routes/authRoutes'));

app.use('/api/projects', require('./routes/projectRoutes'));

app.use('/api/rollouts', require('./routes/rolloutRoutes'));

app.use('/api/files', require('./routes/fileRoutes'));

app.use('/api/notifications', require('./routes/notificationRoutes'));

app.use('/api/tasks', require('./routes/taskRoutes'));

// Catch-all: serve index.html for any unmatched route
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start server ─────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
