require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const session = require('express-session');

const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB
connectDB();

// multer writes to ./uploads and will not create the folder itself
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Profile pictures live in their own subfolder
const avatarsDir = path.join(uploadsDir, 'avatars');

if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
}

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Server-side session — the source of truth for authorization.
// The client's localStorage copy only drives the UI.
app.use(session({
    name: 'imc.sid',
    secret: process.env.SESSION_SECRET || 'imc-dev-session-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
}));

// Serve uploaded files.
// `fallthrough: false` makes express.static answer a missing file with a real
// 404 instead of calling next(). Without it the request reached the SPA
// catch-all below and came back as index.html with status 200, so the browser
// tried to decode HTML as an image and every avatar silently fell back to
// initials.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    fallthrough: false,
    maxAge: '7d',
    setHeaders(res) {
        // Cached copies must be revalidated so a re-uploaded picture with the
        // same URL is picked up immediately.
        res.setHeader('Cache-Control', 'public, max-age=604800, must-revalidate');
    }
}));

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ──────────────────────────────────────────
app.use('/auth', require('./routes/authRoutes'));

app.use('/api/projects', require('./routes/projectRoutes'));

app.use('/api/rollouts', require('./routes/rolloutRoutes'));

app.use('/api/files', require('./routes/fileRoutes'));

app.use('/api/notifications', require('./routes/notificationRoutes'));

app.use('/api/tasks', require('./routes/taskRoutes'));

app.use('/api/users', require('./routes/userRoutes'));

app.use('/api/dashboard', require('./routes/dashboardRoutes'));

// Unknown API routes must fail as JSON, not as the landing page
app.use('/api', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found.'
    });
});

// Catch-all: serve index.html for unmatched *page* routes only.
// Anything that looks like an asset (has a file extension) must 404 rather
// than silently returning HTML, which hides missing-file bugs.
app.get('/{*path}', (req, res) => {
    if (path.extname(req.path)) {
        return res.status(404).json({
            success: false,
            message: 'Not found.'
        });
    }

    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Surface upload/static errors as JSON rather than an HTML error page
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    const status = err.status || err.statusCode || 500;

    if (status === 404) {
        return res.status(404).json({
            success: false,
            message: 'File not found.'
        });
    }

    console.error('Unhandled error:', err);

    return res.status(status).json({
        success: false,
        message: err.message || 'Server error.'
    });
});

// ── Start server ─────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
