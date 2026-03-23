const express        = require('express');
const session        = require('express-session');
const cookieParser   = require('cookie-parser');
const passport       = require('./passport');
const authRoutes     = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');
require('dotenv').config({ path: './config.env' });

const app = express();

// ── Core middleware ─────────────────────────────────────────────────────────
app.use(cookieParser());   // must come before authMiddleware so req.cookies is populated
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Auth routes (public) ────────────────────────────────────────────────────
app.use('/auth', authRoutes);

// ── Protected routes (guarded by authMiddleware) ────────────────────────────
app.get('/dashboard', authMiddleware, (req, res) => {
  // req.user is populated by the middleware
  res.json({
    message: `Welcome to your dashboard, ${req.user.email}!`,
    user: req.user,
  });
});

// ── Login page (placeholder) ────────────────────────────────────────────────
app.get('/login', (req, res) => {
  res.send('<a href="/auth/google">Login with Google</a>');
});

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});