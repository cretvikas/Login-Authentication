require('dotenv').config({ path: './config.env' });
const { loadSecrets } = require('./utils/vault');

(async () => {
  try {
    // ── 1. Fetch Vault Secrets Before Anything Else ──
    await loadSecrets();

    // ── 2. Require App Modules (Now they see Vault secrets) ──
    const express = require('express');
    const session = require('express-session');
    const cookieParser = require('cookie-parser');
    const cors = require('cors');
    
    // These internal modules might read process.env immediately on require,
    // which is why they are required *after* loadSecrets().
    const passport = require('./passport');
    const authRoutes = require('./routes/auth');
    const authMiddleware = require('./middleware/authMiddleware');

    const app = express();

    // ── Core middleware ─────────────────────────────────────────────────────────
    app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
    app.use(express.json());
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

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();