// routes/auth.js

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const generateTokens = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const { MongoClient, ObjectId } = require('mongodb');

// ─── DB helper ────────────────────────────────────────────────
const client = new MongoClient(process.env.ATLAS_PASS);
let db;
async function getDB() {
  if (!db) {
    await client.connect();
    db = client.db('AuthenticationConfig');
  }
  return db;
}

// ─── App Resolution helper ────────────────────────────────────
// Resolves an application by either its public clientId or internal _id
async function resolveApplication(identifier) {
  if (!identifier) return null;
  const database = await getDB();
  
  let query = { clientId: identifier };
  if (ObjectId.isValid(identifier)) {
     query = { $or: [{ clientId: identifier }, { _id: new ObjectId(identifier) }] };
  }
  
  return await database.collection('applications').findOne(query);
}

// ─── Audit log helper ─────────────────────────────────────────
// Writes a document to the auditLogs collection matching the
// schema defined in connect1.cjs (appId + eventType + timestamp required).
async function writeAuditLog({ appId, userId, eventType, authMethod, ipAddress, userAgent, metadata }) {
  try {
    const database = await getDB();
    await database.collection('auditLogs').insertOne({
      appId:      new ObjectId(appId),
      userId:     userId ? new ObjectId(userId) : null,
      eventType,                           // must be one of the enum values in the schema
      authMethod: authMethod ?? null,
      ipAddress:  ipAddress  ?? null,
      userAgent:  userAgent  ?? null,
      metadata:   metadata   ?? {},
      timestamp:  new Date(),
    });
  } catch (auditErr) {
    // Audit failures must never crash the main request
    console.error('[AuditLog] Failed to write audit log:', auditErr.message);
  }
}

// ─── Local Login (email + password) ────────────────────────────
// Step 1: Verify credentials → generate OTP → email it.
// Tokens/session/cookies are NOT issued here — that happens in /verify-otp.
router.post('/login', async (req, res) => {
  const { email, password, appId, clientId } = req.body;
  const identifier = clientId || appId || req.headers['x-client-id'] || req.headers['x-app-id'];

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const appDoc = await resolveApplication(identifier);
    if (!appDoc) {
      return res.status(400).json({ error: 'Invalid or missing Client ID.' });
    }
    const resolvedAppId = appDoc._id.toString();

    const database = await getDB();
    const user = await database.collection('users').findOne(
      { email },
      { projection: { _id: 1, email: 1, roles: 1, passwordHash: 1 } }
    );

    // ── User not found ─────────────────────────────────────────
    if (!user) {
      await writeAuditLog({
        appId:      resolvedAppId,
        userId:     null,
        eventType:  'LOGIN_FAILURE',
        authMethod: 'local',
        ipAddress:  req.ip,
        userAgent:  req.headers['user-agent'],
        metadata:   { reason: 'User not found', email },
      });
      return res.status(404).json({ error: 'User not found' });
    }

    // ── Compare password hash (Bcrypt) ─────────────────────────
    const passwordMatch = await bcrypt.compare(password, user.passwordHash || '');
    
    if (!passwordMatch) {
      await writeAuditLog({
        appId:      resolvedAppId,
        userId:     user._id.toString(),
        eventType:  'LOGIN_FAILURE',
        authMethod: 'local',
        ipAddress:  req.ip,
        userAgent:  req.headers['user-agent'],
        metadata:   { reason: 'Wrong password', email },
      });
      return res.status(401).json({ error: 'Wrong password' });
    }

    // ── Password OK — generate 6-digit OTP ─────────────────────
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const OTP_TTL = 5 * 60 * 1000; // 5 minutes

    // Invalidate any previous unused OTPs for this user
    await database.collection('otps').updateMany(
      { userId: user._id, isUsed: false },
      { $set: { isUsed: true } }
    );

    // Save new OTP
    const hashedOtpCode = crypto.createHmac('sha256', 'vikas').update(otpCode).digest('hex');
    await database.collection('otps').insertOne({
      userId:     user._id,
      appId:      resolvedAppId ? new ObjectId(resolvedAppId) : null,
      otpCode:    hashedOtpCode,
      otpType:    'EMAIL',
      expiryTime: new Date(Date.now() + OTP_TTL),
      isUsed:     false,
      attempts:   0,
      createdAt:  new Date(),
    });

    // Send OTP via email
    await sendEmail({
      to:      user.email,
      subject: 'Your Login Verification Code',
      text:    `Your verification code is: ${otpCode}. It expires in 5 minutes.`,
      html:    `<div style="font-family:sans-serif;max-width:400px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
                  <h2 style="margin:0 0 8px">Verification Code</h2>
                  <p style="color:#555">Use the code below to complete your sign-in:</p>
                  <div style="font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;padding:16px;background:#f9f9f9;border-radius:8px;margin:16px 0">${otpCode}</div>
                  <p style="color:#999;font-size:13px">This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
                </div>`,
    });

    // Audit: MFA OTP sent
    await writeAuditLog({
      appId:      resolvedAppId,
      userId:     user._id.toString(),
      eventType:  'MFA_ENROLLED',
      authMethod: 'local',
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'],
      metadata:   { channel: 'EMAIL', email: user.email },
    });

    // Return MFA required — no tokens yet
    res.json({
      mfaRequired: true,
      userId:      user._id.toString(),
      message:     'OTP sent to your email. Please verify to complete login.',
    });

  } catch (err) {
    console.error('[Auth] Local login error:', err.message);
    await writeAuditLog({
      appId:      resolvedAppId,
      userId:     null,
      eventType:  'LOGIN_FAILURE',
      authMethod: 'local',
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'],
      metadata:   { error: err.message },
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Step 2: Verify OTP — completes the login flow ─────────────
// After OTP is validated, this route runs the full post-auth flow
// (session, audit logs, cookies) identical to the SSO callback.
router.post('/verify-otp', async (req, res) => {
  const { userId, otpCode, appId, clientId } = req.body;
  const identifier = clientId || appId || req.headers['x-client-id'] || req.headers['x-app-id'];

  if (!userId || !otpCode) {
    return res.status(400).json({ error: 'userId and otpCode are required.' });
  }

  try {
    const appDoc = await resolveApplication(identifier);
    if (!appDoc) {
      return res.status(400).json({ error: 'Invalid or missing Client ID.' });
    }
    const resolvedAppId = appDoc._id.toString();
    const redirectUrl = appDoc.destinationUrls?.loginSuccess || '/dashboard';

    const database = await getDB();

    // Hash the provided OTP for comparison
    const hashedOtpCode = crypto.createHmac('sha256', 'vikas').update(otpCode).digest('hex');

    // Find the OTP document
    const otpDoc = await database.collection('otps').findOne({
      userId:  new ObjectId(userId),
      otpCode: hashedOtpCode,
      isUsed:  false,
    });

    // ── OTP not found or already used ──────────────────────────
    if (!otpDoc) {
      await writeAuditLog({
        appId:      resolvedAppId,
        userId,
        eventType:  'MFA_FAILURE',
        authMethod: 'local',
        ipAddress:  req.ip,
        userAgent:  req.headers['user-agent'],
        metadata:   { reason: 'Invalid OTP code' },
      });
      return res.status(401).json({ error: 'Invalid OTP code.' });
    }

    // ── OTP expired ────────────────────────────────────────────
    if (new Date() > otpDoc.expiryTime) {
      await database.collection('otps').updateOne(
        { _id: otpDoc._id },
        { $set: { isUsed: true } }
      );
      await writeAuditLog({
        appId:      resolvedAppId,
        userId,
        eventType:  'MFA_FAILURE',
        authMethod: 'local',
        ipAddress:  req.ip,
        userAgent:  req.headers['user-agent'],
        metadata:   { reason: 'OTP expired' },
      });
      return res.status(401).json({ error: 'OTP has expired. Please login again.' });
    }

    // ── OTP valid — mark as used ───────────────────────────────
    await database.collection('otps').updateOne(
      { _id: otpDoc._id },
      { $set: { isUsed: true } }
    );

    // Audit: MFA_SUCCESS
    await writeAuditLog({
      appId:      resolvedAppId,
      userId,
      eventType:  'MFA_SUCCESS',
      authMethod: 'local',
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'],
      metadata:   { channel: 'EMAIL' },
    });

    // ── Fetch user for token payload ───────────────────────────
    const user = await database.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { _id: 1, email: 1, roles: 1 } }
    );

    const userPayload = {
      userId: user._id.toString(),
      email:  user.email,
      roles:  user.roles ?? [],
    };

    // ── Full post-auth flow (same as SSO callback) ─────────────
    const { accessToken, refreshToken } = generateTokens(userPayload);

    // Save session
    await database.collection('sessions').insertOne({
      userId:       new ObjectId(userPayload.userId),
      appId:        resolvedAppId ? new ObjectId(resolvedAppId) : null,
      authMethod:   'local',
      refreshToken: refreshToken,
      ipAddress:    req.ip,
      deviceInfo:   req.headers['user-agent'],
      userAgent:    req.headers['user-agent'],
      isRevoked:    false,
      createdAt:    new Date(),
      expiresAt:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Audit: LOGIN_SUCCESS
    await writeAuditLog({
      appId:      resolvedAppId,
      userId:     userPayload.userId,
      eventType:  'LOGIN_SUCCESS',
      authMethod: 'local',
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'],
      metadata:   { email: userPayload.email },
    });

    // Audit: TOKEN_ISSUED
    await writeAuditLog({
      appId:      resolvedAppId,
      userId:     userPayload.userId,
      eventType:  'TOKEN_ISSUED',
      authMethod: 'local',
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'],
      metadata:   { tokenType: 'access+refresh', expiresIn: '15m' },
    });

    // Set HTTP-only cookies
    const encodedToken = Buffer.from(accessToken).toString('base64');
    res.cookie('access_token', encodedToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   15 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    res.json({ message: 'Login successful', user: userPayload, redirectUrl });

  } catch (err) {
    console.error('[Auth] OTP verification error:', err.message);
    await writeAuditLog({
      appId:      resolvedAppId,
      userId:     userId ?? null,
      eventType:  'MFA_FAILURE',
      authMethod: 'local',
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'],
      metadata:   { error: err.message },
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Step 1 — redirect to Google ───────────────────────────────
router.get('/google', (req, res, next) => {
  const options = { scope: ['profile', 'email'], session: false };
  if (req.query.clientId) {
    options.state = req.query.clientId;
  }
  passport.authenticate('google', options)(req, res, next);
});

// ─── Step 2 — Google OAuth callback ───────────────────────────
router.get('/google/callback',
  // Custom authenticate call so we can catch failure and write a LOGIN_FAILURE log
  (req, res, next) => {
    const identifier = req.query.state || req.query.clientId || req.query.appId || req.headers['x-client-id'] || req.headers['x-app-id'];
    req.identifier = identifier; // save for next middleware

    passport.authenticate('google', { session: false }, async (err, user, info) => {
      if (err || !user) {
        let resolvedAppId = null;
        if (identifier) {
          const appDoc = await resolveApplication(identifier);
          resolvedAppId = appDoc ? appDoc._id.toString() : null;
        }

        // Write LOGIN_FAILURE audit log before redirecting
        await writeAuditLog({
          appId:      resolvedAppId,
          userId:     null,
          eventType:  'LOGIN_FAILURE',
          authMethod: 'oauth2',
          ipAddress:  req.ip,
          userAgent:  req.headers['user-agent'],
          metadata:   { reason: info?.message ?? err?.message ?? 'Authentication failed' },
        });
        return res.redirect('/login');
      }

      // Passport succeeded — attach user to request and continue
      req.user = user;
      next();
    })(req, res, next);
  },
  async (req, res) => {
    const identifier = req.identifier;

    try {
      const appDoc = await resolveApplication(identifier);
      if (!appDoc) {
        return res.status(400).json({ error: 'Invalid or missing Client ID.' });
      }
      const resolvedAppId = appDoc._id.toString();
      const redirectUrl = appDoc.destinationUrls?.loginSuccess || '/dashboard';

      const { accessToken, refreshToken } = generateTokens(req.user);
      const database = await getDB();

      // ── Save session (sessions schema) ──────────────────────
      await database.collection('sessions').insertOne({
        userId:       new ObjectId(req.user.userId),
        appId:        resolvedAppId ? new ObjectId(resolvedAppId) : null,
        authMethod:   'oauth2',
        refreshToken: refreshToken,
        ipAddress:    req.ip,
        deviceInfo:   req.headers['user-agent'],
        userAgent:    req.headers['user-agent'],
        isRevoked:    false,
        createdAt:    new Date(),
        expiresAt:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      // ── Audit: LOGIN_SUCCESS ────────────────────────────────
      await writeAuditLog({
        appId: resolvedAppId,
        userId:     req.user.userId,
        eventType:  'LOGIN_SUCCESS',
        authMethod: 'oauth2',
        ipAddress:  req.ip,
        userAgent:  req.headers['user-agent'],
        metadata:   { email: req.user.email },
      });

      // ── Audit: TOKEN_ISSUED ─────────────────────────────────
      await writeAuditLog({
        appId: resolvedAppId,
        userId:     req.user.userId,
        eventType:  'TOKEN_ISSUED',
        authMethod: 'oauth2',
        ipAddress:  req.ip,
        userAgent:  req.headers['user-agent'],
        metadata:   { tokenType: 'access+refresh', expiresIn: '15m' },
      });

      // ── Set HTTP-only cookie ────────────────────────────────
      const encodedToken = Buffer.from(accessToken).toString('base64');
      res.cookie('access_token', encodedToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   15 * 60 * 1000,   // 15 min — matches JWT expiry
      });

      res.redirect(redirectUrl);

    } catch (err) {
      console.error('[Auth] OAuth callback error:', err.message);

      let resolvedAppId = null;
      if (identifier) {
        const appDoc = await resolveApplication(identifier);
        resolvedAppId = appDoc ? appDoc._id.toString() : null;
      }

      // Audit the server-side failure too
      await writeAuditLog({
        appId:      resolvedAppId,
        userId:    req.user?.userId ?? null,
        eventType: 'LOGIN_FAILURE',
        authMethod: 'oauth2',
        ipAddress:  req.ip,
        userAgent:  req.headers['user-agent'],
        metadata:   { error: err.message },
      });

      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// ─── Logout ────────────────────────────────────────────────────
// Clears the access token cookie, revokes the session in DB,
// and writes a LOGOUT audit log.
router.post('/logout', async (req, res) => {
  const appId  = req.body?.appId  || req.headers['x-app-id'];
  const userId = req.body?.userId || null;

  try {
    const database = await getDB();

    // Revoke the active session for this user+app
    if (appId && userId) {
      await database.collection('sessions').updateMany(
        { userId: new ObjectId(userId), appId: new ObjectId(appId), isRevoked: false },
        { $set: { isRevoked: true, revokedAt: new Date() } }
      );
    }

    // Write LOGOUT audit log
    await writeAuditLog({
      appId,
      userId,
      eventType:  'LOGOUT',
      authMethod: 'oauth2',
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'],
      metadata:   {},
    });

    // Clear the cookie
    res.clearCookie('access_token');
    res.json({ message: 'Logged out successfully.' });

  } catch (err) {
    console.error('[Auth] Logout error:', err.message);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;