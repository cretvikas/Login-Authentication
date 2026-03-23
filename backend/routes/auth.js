// routes/auth.js

const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const generateTokens = require('../utils/generateToken');
const { MongoClient, ObjectId } = require('mongodb');

// DB helper (reuse connection from passport.js)
const client = new MongoClient(process.env.ATLAS_PASS);
let db;
async function getDB() {
  if (!db) {
    await client.connect();
    db = client.db('AuthenticationConfig');
  }
  return db;
}

// Step 1 — redirect to Google
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// Step 2 — Google redirects back here
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const { accessToken, refreshToken } = generateTokens(req.user);

      // Save refreshToken to your sessions collection (from db_init.js)
      const db = await getDB();
      await db.collection('sessions').insertOne({
        userId:        new ObjectId(req.user.userId),
        accessTokenId: getJtiFromToken(accessToken),
        refreshToken:  refreshToken,
        ipAddress:     req.ip,
        deviceInfo:    req.headers['user-agent'],
        userAgent:     req.headers['user-agent'],
        isRevoked:     false,
        createdAt:     new Date(),
        expiresAt:     new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      // Encode the access token in Base64 and set it as an HTTP-only cookie
      const encodedToken = Buffer.from(accessToken).toString('base64');

      res.cookie('access_token', encodedToken, {
        httpOnly: true,                             // not accessible via JS
        secure:   process.env.NODE_ENV === 'production', // HTTPS only in prod
        sameSite: 'lax',
        maxAge:   15 * 60 * 1000,                  // 15 min — matches JWT expiry
      });

      // Redirect to dashboard
      res.redirect('/dashboard');

    } catch (err) {
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Helper — extract jti from token
function getJtiFromToken(token) {
  const decoded = jwt.decode(token);
  return decoded.jti ?? decoded.userId + Date.now(); // fallback if no jti
}

module.exports = router;