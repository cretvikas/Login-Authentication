// middleware/authMiddleware.js

const jwt            = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const generateTokens = require('../utils/generateToken');

// ─── DB Connection ─────────────────────────────────────────────────────────
const client = new MongoClient(process.env.ATLAS_PASS);
let db;

async function getDB() {
  if (!db) {
    await client.connect();
    db = client.db('AuthenticationConfig');
  }
  return db;
}

// ─── Middleware ─────────────────────────────────────────────────────────────
async function authMiddleware(req, res, next) {
  try {
    const encodedToken = req.cookies?.access_token;

    // 1. No cookie at all → not logged in
    if (!encodedToken) {
      return res.redirect('/login');
    }

    // 2. Decode Base64 back to the raw JWT string
    const accessToken = Buffer.from(encodedToken, 'base64').toString('utf8');

    // 3. Try to verify the access token
    try {
      const payload = jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET);
      req.user = payload;   // attach user info for downstream handlers
      return next();        // token is valid — proceed
    } catch (err) {
      // Only attempt a refresh if the token is specifically expired
      if (err.name !== 'TokenExpiredError') {
        return res.redirect('/login');
      }
    }

    // ── Access token is expired — try to refresh ─────────────────────────

    // 4. Decode (don't verify) the expired token to get userId
    const expiredPayload = jwt.decode(accessToken);
    if (!expiredPayload?.userId) {
      return res.redirect('/login');
    }

    // 5. Look up a valid (non-revoked, non-expired) session in the DB
    const database = await getDB();
    const session  = await database.collection('sessions').findOne({
      userId:    new ObjectId(expiredPayload.userId),
      isRevoked: false,
      expiresAt: { $gt: new Date() },   // refresh token itself must not be expired
    });

    if (!session) {
      // No valid refresh token — force re-login
      res.clearCookie('access_token');
      return res.redirect('/login');
    }

    // 6. Verify the stored refresh token
    let refreshPayload;
    try {
      refreshPayload = jwt.verify(session.refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (_) {
      // Refresh token is invalid/tampered — revoke and redirect
      await database.collection('sessions').updateOne(
        { _id: session._id },
        { $set: { isRevoked: true } }
      );
      res.clearCookie('access_token');
      return res.redirect('/login');
    }

    // 7. Fetch the user details needed to sign a fresh access token
    const user = await database.collection('users').findOne(
      { _id: new ObjectId(refreshPayload.userId) },
      { projection: { _id: 1, email: 1, roles: 1 } }
    );

    if (!user) {
      res.clearCookie('access_token');
      return res.redirect('/login');
    }

    // 8. Generate a new access token (refresh token stays the same)
    const { accessToken: newAccessToken } = generateTokens({
      userId: user._id.toString(),
      email:  user.email,
      roles:  user.roles ?? [],
    });

    // 9. Record that the session was refreshed
    await database.collection('sessions').updateOne(
      { _id: session._id },
      { $set: { revokedAt: null } }   // ensure revokedAt stays null (schema field)
    );

    // 10. Set the refreshed token as an updated cookie
    const newEncodedToken = Buffer.from(newAccessToken).toString('base64');

    res.cookie('access_token', newEncodedToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   15 * 60 * 1000,   // 15 min
    });

    // 11. Attach user to request and continue
    req.user = jwt.decode(newAccessToken);
    return next();

  } catch (err) {
    console.error('[authMiddleware] Unexpected error:', err);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

module.exports = authMiddleware;