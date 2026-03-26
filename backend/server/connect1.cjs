// ============================================================
// connect1.cjs - Authentication DB Framework
// Configurable multi-app auth system with per-URL audit logs
// Run with: node connect1.cjs
// ============================================================

const { MongoClient } = require("mongodb");
require("dotenv").config({ path: "./config.env" });

const MONGO_URI = process.env.ATLAS_PASS;
const DB_NAME   = "AuthenticationConfig";

// ─── Helpers ─────────────────────────────────────────────────
async function createCollection(db, name, options = {}) {
  try {
    await db.createCollection(name, options);
    console.log(`  ✅ Created   : ${name}`);
  } catch (err) {
    if (err.codeName === "NamespaceExists") {
      console.log(`  ⚠️  Exists    : ${name} (skipped)`);
    } else {
      throw err;
    }
  }
}

async function createIndexes(db, name, indexes) {
  for (const [spec, opts] of indexes) {
    await db.collection(name).createIndex(spec, opts);
  }
  console.log(`  📌 Indexed   : ${name}`);
}

// ─── Main ─────────────────────────────────────────────────────
async function initDB() {
  if (!MONGO_URI) {
    console.error("❌ ATLAS_PASS not found in config.env");
    process.exit(1);
  }

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log("\n🔗 Connected to MongoDB Atlas");
    console.log(`📂 Database   : ${DB_NAME}\n`);

    const db = client.db(DB_NAME);

    // ══════════════════════════════════════════════════════════
    // 1. APPLICATIONS
    //    Each registered destination URL/app. Stores configurable
    //    auth methods (local, OAuth2, SAML, OIDC), redirect URLs,
    //    and per-provider OAuth credentials.
    // ══════════════════════════════════════════════════════════
    await createCollection(db, "applications", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["appName", "clientId", "destinationUrls", "enabledAuthMethods", "createdAt"],
          properties: {
            appName:      { bsonType: "string" },
            clientId:     { bsonType: "string" },
            clientSecret: { bsonType: "string" },
            destinationUrls: {
              bsonType: "object",
              required: ["loginSuccess"],
              properties: {
                loginSuccess:  { bsonType: "string" },
                loginFailure:  { bsonType: "string" },
                logout:        { bsonType: "string" },
                mfaChallenge:  { bsonType: "string" },
                passwordReset: { bsonType: "string" },
              },
            },
            enabledAuthMethods: {
              bsonType: "array",
              items: {
                bsonType: "string",
                enum: ["local", "oauth2", "saml2", "oidc"],
              },
            },
            oauthConfig: {
              bsonType: "object",
              additionalProperties: true,
            },
            isActive:   { bsonType: "bool" },
            createdAt:  { bsonType: "date" },
            updatedAt:  { bsonType: "date" },
          },
        },
      },
    });

    await createIndexes(db, "applications", [
      [{ clientId: 1 },    { unique: true }],
      [{ appName: 1 },     { unique: true }],
      [{ isActive: 1 },    {}],
    ]);

    // ══════════════════════════════════════════════════════════
    // 2. USERS
    //    Global user identity store. One user can log into
    //    multiple apps. Stores credentials, MFA config, linked
    //    OAuth providers, lockout state, and password policy.
    // ══════════════════════════════════════════════════════════
    await createCollection(db, "users", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["email", "createdAt"],
          properties: {
            email: {
              bsonType: "string",
              pattern: "^.+@.+\\..+$",
            },
            displayName:    { bsonType: "string" },
            phone:          { bsonType: ["string", "null"] },
            avatarUrl:      { bsonType: ["string", "null"] },
            passwordHash:   { bsonType: ["string", "null"] },
            passwordHistory: {
              bsonType: "array",
              items: { bsonType: "string" },
            },
            passwordExpiresAt: { bsonType: ["date", "null"] },
            mfaEnabled:     { bsonType: "bool" },
            mfaSecret:      { bsonType: ["string", "null"] },
            mfaMethods: {
              bsonType: "array",
              items: {
                bsonType: "string",
                enum: ["TOTP", "SMS", "EMAIL"],
              },
            },
            linkedProviders: {
              bsonType: "array",
              items: {
                bsonType: "object",
                required: ["provider", "providerId"],
                properties: {
                  provider:      { bsonType: "string" },
                  providerId:    { bsonType: "string" },
                  providerEmail: { bsonType: "string" },
                },
              },
            },
            accountLocked:       { bsonType: "bool" },
            failedLoginAttempts: { bsonType: "number" },
            lockoutUntil:        { bsonType: ["date", "null"] },
            roles: {
              bsonType: "array",
              items: {
                bsonType: "string",
                enum: ["admin", "end_user", "auditor", "integrator"],
              },
            },
            createdAt:    { bsonType: "date" },
            updatedAt:    { bsonType: "date" },
            lastLoginAt:  { bsonType: ["date", "null"] },
          },
        },
      },
    });

    await createIndexes(db, "users", [
      [{ email: 1 },                                        { unique: true }],
      [{ "linkedProviders.provider": 1, "linkedProviders.providerId": 1 }, { sparse: true }],
      [{ accountLocked: 1 },                                {}],
      [{ roles: 1 },                                        {}],
    ]);

    // ══════════════════════════════════════════════════════════
    // 3. SESSIONS
    //    Per-app login sessions. Tracks which app the user
    //    logged into and which auth method was used.
    // ══════════════════════════════════════════════════════════
    await createCollection(db, "sessions", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["userId", "appId", "authMethod", "createdAt", "expiresAt"],
          properties: {
            userId:       { bsonType: "objectId" },
            appId:        { bsonType: "objectId" },
            authMethod:   { bsonType: "string" },
            refreshToken: { bsonType: "string" },
            ipAddress:    { bsonType: "string" },
            geoLocation: {
              bsonType: "object",
              properties: {
                country:   { bsonType: "string" },
                region:    { bsonType: "string" },
                city:      { bsonType: "string" },
                latitude:  { bsonType: "double" },
                longitude: { bsonType: "double" },
              },
            },
            deviceInfo: { bsonType: "string" },
            userAgent:  { bsonType: "string" },
            isRevoked:  { bsonType: "bool" },
            revokedAt:  { bsonType: ["date", "null"] },
            createdAt:  { bsonType: "date" },
            expiresAt:  { bsonType: "date" },
          },
        },
      },
    });

    await createIndexes(db, "sessions", [
      [{ expiresAt: 1 },             { expireAfterSeconds: 0 }],
      [{ userId: 1, appId: 1 },      {}],
      [{ appId: 1 },                  {}],
      [{ isRevoked: 1 },             {}],
      [{ ipAddress: 1 },             {}],
    ]);

    // ══════════════════════════════════════════════════════════
    // 4. AUDIT LOGS
    //    Per-app security event log. Every event is tagged with
    //    appId so you can query logs for a specific URL/app.
    //    Capped collection for immutability.
    // ══════════════════════════════════════════════════════════
    await createCollection(db, "auditLogs", {
      capped: true,
      size: 5 * 1024 * 1024 * 1024,
      max:  5_000_000,
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["appId", "eventType", "timestamp"],
          properties: {
            appId:    { bsonType: "objectId" },
            userId:   { bsonType: ["objectId", "null"] },
            eventType: {
              bsonType: "string",
              enum: [
                "LOGIN_SUCCESS",
                "LOGIN_FAILURE",
                "LOGOUT",
                "TOKEN_ISSUED",
                "TOKEN_REVOKED",
                "TOKEN_REFRESHED",
                "OAUTH_CALLBACK",
                "OAUTH_LINK",
                "OAUTH_UNLINK",
                "MFA_SUCCESS",
                "MFA_FAILURE",
                "MFA_ENROLLED",
                "MFA_REMOVED",
                "PASSWORD_RESET",
                "PASSWORD_CHANGED",
                "ACCOUNT_LOCKED",
                "ACCOUNT_UNLOCKED",
              ],
            },
            authMethod: { bsonType: "string" },
            ipAddress:  { bsonType: "string" },
            geoLocation: {
              bsonType: "object",
              properties: {
                country: { bsonType: "string" },
                region:  { bsonType: "string" },
                city:    { bsonType: "string" },
              },
            },
            userAgent: { bsonType: "string" },
            metadata:  { bsonType: "object" },
            timestamp: { bsonType: "date" },
          },
        },
      },
    });

    await createIndexes(db, "auditLogs", [
      [{ appId: 1, timestamp: -1 },      {}],
      [{ appId: 1, eventType: 1 },        {}],
      [{ userId: 1, timestamp: -1 },      {}],
      [{ ipAddress: 1 },                  {}],
    ]);

    // ══════════════════════════════════════════════════════════
    // 5. OTPs
    //    Short-lived verification codes for SMS / Email / TOTP.
    //    TTL index auto-expires stale codes.
    // ══════════════════════════════════════════════════════════
    await createCollection(db, "otps", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["userId", "appId", "otpCode", "otpType", "expiryTime"],
          properties: {
            userId:     { bsonType: "objectId" },
            appId:      { bsonType: "objectId" },
            otpCode:    { bsonType: "string" },
            otpType: {
              bsonType: "string",
              enum: ["SMS", "EMAIL", "TOTP"],
            },
            expiryTime: { bsonType: "date" },
            isUsed:     { bsonType: "bool" },
            attempts:   { bsonType: "number" },
            createdAt:  { bsonType: "date" },
          },
        },
      },
    });

    await createIndexes(db, "otps", [
      [{ expiryTime: 1 },    { expireAfterSeconds: 0 }],
      [{ userId: 1 },        {}],
      [{ appId: 1 },         {}],
      [{ isUsed: 1 },        {}],
    ]);

    // ══════════════════════════════════════════════════════════
    // SUMMARY
    // ══════════════════════════════════════════════════════════
    const collections = await db.listCollections().toArray();
    console.log(`\n${"─".repeat(45)}`);
    console.log(`📦 Collections in "${DB_NAME}":`);
    collections.forEach((c) => console.log(`   • ${c.name}`));
    console.log(`${"─".repeat(45)}`);
    console.log("🎉 Database initialization complete!\n");

  } catch (err) {
    console.error("\n❌ Fatal Error:", err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

initDB();