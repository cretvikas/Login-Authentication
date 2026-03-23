const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './config.env' });

// ─── DB Connection ─────────────────────────────────────────
const client = new MongoClient(process.env.ATLAS_PASS);
let db;

async function getDB() {
  if (!db) {
    await client.connect();
    db = client.db('AuthenticationConfig');
  }
  return db;
}

// ─── Serialize / Deserialize (required for session support) ─
// passport.serializeUser((user, done) => {
//   done(null, user);
// });

// passport.deserializeUser((user, done) => {
//   done(null, user);
// });

// ─── Google Strategy ───────────────────────────────────────
passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  '/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;

      const db   = await getDB();
      const user = await db.collection('users').findOne(
        { email },
        { projection: { _id: 1, email: 1, roles: 1 } }
      );

      if (!user) {
        return done(null, false, { message: 'User not registered.' });
      }

      return done(null, {
        userId: user._id.toString(),
        email:  user.email,
        roles:  user.roles ?? [],
      });

    } catch (err) {
      return done(err);
    }
  }
));

module.exports = passport;
