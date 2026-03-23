// ============================================================
// db_init.js - Authentication Configuration System (G-20)
// Indian Institute of Technology Hyderabad
// Sprint-1 | Feb 2026
// Run with: node db_init.js
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
    // 1. USERS
    //    Core identity store. Supports MFA, roles, geo allowlist,
    //    password history, and account lockout (FR-1, FR-5, FR-11,
    //    FR-12–FR-16, FR-24).
    // ══════════════════════════════════════════════════════════
    await createCollection(db, "users", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["email", "passwordHash", "createdAt"],
          properties: {
            email: {
              bsonType: "string",
              pattern: "^.+@.+\\..+$",
              description: "User email address - required, unique",
            },
            passwordHash: {
              bsonType: "string",
              description: "bcrypt / argon2 hash of the password",
            },
            passwordHistory: {
              bsonType: "array",
              description: "Array of previous password hashes (FR-15)",
              items: { bsonType: "string" },
            },
            mfaEnabled: {
              bsonType: "bool",
              description: "Whether MFA is active for this user",
            },
            mfaSecret: {
              bsonType: ["string", "null"],
              description: "TOTP secret key (FR-7)",
            },
            mfaMethods: {
              bsonType: "array",
              description: "Enrolled MFA methods: TOTP | SMS | EMAIL (FR-7–9)",
              items: {
                bsonType: "string",
                enum: ["TOTP", "SMS", "EMAIL"],
              },
            },
            passwordExpiresAt: {
              bsonType: ["date", "null"],
              description: "Password expiry timestamp (FR-16)",
            },
            accountLocked: {
              bsonType: "bool",
              description: "Account lockout flag (FR-5)",
            },
            failedLoginAttempts: {
              bsonType: "number",
              description: "Consecutive failed login count (FR-5)",
            },
            lockoutUntil: {
              bsonType: ["date", "null"],
              description: "Temporary lockout expiry timestamp",
            },
            allowedCountries: {
              bsonType: "array",
              description: "Per-user geo allowlist (FR-24)",
              items: { bsonType: "string" },
            },
            roles: {
              bsonType: "array",
              description: "Assigned roles: admin | end_user | auditor | integrator",
              items: {
                bsonType: "string",
                enum: ["admin", "end_user", "auditor", "integrator"],
              },
            },
            providerType: {
              bsonType: "string",
              enum: ["local", "oauth2", "saml2", "oidc"],
              description: "Identity provider type (FR-2–4)",
            },
            providerId: {
              bsonType: ["string", "null"],
              description: "External provider subject/ID",
            },
            createdAt:  { bsonType: "date" },
            updatedAt:  { bsonType: "date" },
            lastLoginAt: { bsonType: ["date", "null"] },
          },
        },
      },
    });

    await createIndexes(db, "users", [
      [{ email: 1 },                    { unique: true }],
      [{ accountLocked: 1 },            {}],
      [{ roles: 1 },                    {}],
      [{ providerId: 1, providerType: 1 }, { sparse: true }],
    ]);

    // ══════════════════════════════════════════════════════════
    // 2. SESSIONS
    //    JWT access + refresh token lifecycle. Tracks device,
    //    IP, and geo per session (FR-18–23).
    // ══════════════════════════════════════════════════════════
    await createCollection(db, "sessions", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["userId", "accessTokenId", "createdAt", "expiresAt"],
          properties: {
            userId:        { bsonType: "objectId" },
            accessTokenId: { bsonType: "string", description: "JWT jti claim" },
            refreshToken:  { bsonType: "string" },
            ipAddress:     { bsonType: "string" },
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
            deviceInfo:  { bsonType: "string" },
            userAgent:   { bsonType: "string" },
            isRevoked:   { bsonType: "bool" },
            revokedAt:   { bsonType: ["date", "null"] },
            createdAt:   { bsonType: "date" },
            expiresAt:   { bsonType: "date" },
          },
        },
      },
    });

    await createIndexes(db, "sessions", [
      [{ expiresAt: 1 },        { expireAfterSeconds: 0 }],  // TTL auto-delete
      [{ userId: 1 },           {}],
      [{ accessTokenId: 1 },    { unique: true }],
      [{ isRevoked: 1 },        {}],
      [{ ipAddress: 1 },        {}],
    ]);

    // ══════════════════════════════════════════════════════════
    // 3. AUDIT LOGS
    //    Immutable append-only log of all security events.
    //    Capped collection enforces immutability (FR-34–39).
    // ══════════════════════════════════════════════════════════
    await createCollection(db, "auditLogs", {
      capped: true,
      size: 5 * 1024 * 1024 * 1024,  // 5 GB
      max:  5_000_000,                 // 5M documents max
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["eventType", "timestamp"],
          properties: {
            userId:    { bsonType: ["objectId", "null"] },
            eventType: {
              bsonType: "string",
              enum: [
                // Auth events (FR-34)
                "LOGIN_SUCCESS",
                "LOGIN_FAILURE",
                "LOGOUT",
                // Token events (FR-35)
                "TOKEN_ISSUED",
                "TOKEN_REVOKED",
                "TOKEN_REFRESHED",
                // MFA events
                "MFA_SUCCESS",
                "MFA_FAILURE",
                "MFA_ENROLLED",
                "MFA_REMOVED",
                // Account events
                "PASSWORD_RESET",
                "PASSWORD_CHANGED",
                "ACCOUNT_LOCKED",
                "ACCOUNT_UNLOCKED",
                "STEP_UP_AUTH",
                // Security events (FR-36, FR-37)
                "IP_BANNED",
                "IP_WHITELISTED",
                "GEO_BLOCKED",
                "IMPOSSIBLE_TRAVEL",
                "SUSPICIOUS_IP",
              ],
            },
            ipAddress:   { bsonType: "string" },
            geoLocation: { bsonType: "object" },
            riskScore:   { bsonType: "double" },
            userAgent:   { bsonType: "string" },
            metadata:    { bsonType: "object" },
            timestamp:   { bsonType: "date" },
          },
        },
      },
    });

    await createIndexes(db, "auditLogs", [
      [{ userId: 1, timestamp: -1 },    {}],
      [{ eventType: 1, timestamp: -1 }, {}],
      [{ ipAddress: 1 },                {}],
      [{ riskScore: -1 },               {}],
    ]);

    // ══════════════════════════════════════════════════════════
    // 4. OTP
    //    Short-lived codes for SMS / Email / TOTP flows.
    //    TTL index auto-expires used or stale codes (FR-7–9).
    // ══════════════════════════════════════════════════════════
    await createCollection(db, "otps", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["userId", "otpCode", "otpType", "expiryTime"],
          properties: {
            userId:    { bsonType: "objectId" },
            otpCode:   { bsonType: "string" },
            otpType:   { bsonType: "string", enum: ["SMS", "EMAIL", "TOTP"] },
            expiryTime: { bsonType: "date" },
            isUsed:    { bsonType: "bool" },
            attempts:  { bsonType: "number", description: "Verification attempt count" },
            createdAt: { bsonType: "date" },
          },
        },
      },
    });

    await createIndexes(db, "otps", [
      [{ expiryTime: 1 }, { expireAfterSeconds: 0 }],  // TTL auto-delete
      [{ userId: 1 },     {}],
      [{ isUsed: 1 },     {}],
    ]);

    // ══════════════════════════════════════════════════════════
    // 5. IP RULES  (IP Shield Module)
    //    Whitelist / blacklist by IP or CIDR range.
    //    Supports temporary bans after threshold (FR-29–33).
    // ══════════════════════════════════════════════════════════
    await createCollection(db, "ipRules", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["ipRange", "ruleType", "createdAt"],
          properties: {
            ipRange:   { bsonType: "string", description: "Single IP or CIDR e.g. 192.168.1.0/24" },
            ruleType:  { bsonType: "string", enum: ["WHITELIST", "BLACKLIST", "TEMP_BAN"] },
            reason:    { bsonType: "string" },
            hitCount:  { bsonType: "number", description: "Rate-limit hit counter (FR-31)" },
            expiresAt: { bsonType: ["date", "null"], description: "Temp ban expiry (FR-33)" },
            createdAt: { bsonType: "date" },
            createdBy: { bsonType: ["objectId", "null"] },
          },
        },
      },
    });

    await createIndexes(db, "ipRules", [
      [{ ipRange: 1 },              { unique: true }],
      [{ ruleType: 1 },             {}],
      [{ expiresAt: 1 },            { expireAfterSeconds: 0, sparse: true }], // TTL for temp bans
    ]);

    // ══════════════════════════════════════════════════════════
    // 6. GEO RULES  (Geo Shield Module)
    //    Country / region level allow, block, or step-up MFA
    //    rules. Also stores impossible travel events (FR-24–28).
    // ══════════════════════════════════════════════════════════
    await createCollection(db, "geoRules", {
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["ruleType", "createdAt"],
          properties: {
            country:   { bsonType: "string", description: "ISO 3166-1 alpha-2 country code" },
            region:    { bsonType: "string" },
            ruleType:  { bsonType: "string", enum: ["ALLOW", "BLOCK", "STEP_UP_MFA"] },
            riskScore: { bsonType: "double", description: "0.0 – 1.0 risk weight (FR-28)" },
            createdAt: { bsonType: "date" },
            createdBy: { bsonType: ["objectId", "null"] },
          },
        },
      },
    });

    await createIndexes(db, "geoRules", [
      [{ country: 1, region: 1 }, { unique: true, sparse: true }],
      [{ ruleType: 1 },           {}],
      [{ riskScore: -1 },         {}],
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