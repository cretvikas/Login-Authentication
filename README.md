# Login Authentication System — Integration Guide

> **Version:** 1.0 · **Stack:** Node.js / Express · MongoDB Atlas · React · JWT · Passport.js

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Project Structure](#3-project-structure)
4. [Environment Setup](#4-environment-setup)
5. [Database Initialization](#5-database-initialization)
6. [MongoDB Collections & Schema](#6-mongodb-collections--schema)
7. [API Reference](#7-api-reference)
8. [Authentication Flows](#8-authentication-flows)
9. [Token Strategy](#9-token-strategy)
10. [IP Whitelisting & Geo-Shielding](#10-ip-whitelisting--geo-shielding)
11. [Frontend Integration](#11-frontend-integration)
12. [Running the System](#12-running-the-system)
13. [Security Notes](#13-security-notes)

---

## 1. Architecture Overview

This is a **multi-application, configurable authentication service**. A single backend instance serves multiple client applications. Each application (registered in MongoDB) declares which authentication methods it supports.

```
┌─────────────────────────────────────────────────┐
│              Client Application                  │
│  (passes ?clientId=<id> in every auth request)  │
└────────────────────┬────────────────────────────┘
                     │ HTTP
┌────────────────────▼────────────────────────────┐
│           Auth Backend  (Express :5000)          │
│                                                  │
│  /auth/app-config  → GET enabled methods        │
│  /auth/login       → Local (email + password)   │
│  /auth/verify-otp  → MFA OTP verification       │
│  /auth/google      → Google OAuth2 SSO          │
│  /auth/logout      → Session revocation         │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│          MongoDB Atlas  (AuthenticationConfig)   │
│  collections: applications, users, sessions,     │
│               otps, auditLogs                   │
└─────────────────────────────────────────────────┘
```

**Supported auth methods per app:** `local` | `oauth2` | `saml2` | `oidc`

---

## 2. Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| MongoDB Atlas | Any (M0+ free tier works) |
| Google Cloud Console App | OAuth 2.0 credentials |
| Gmail App Password | For OTP email delivery |
| HashiCorp Vault *(optional)* | For secret management |

---

## 3. Project Structure

```
Login-Authentication/
├── backend/
│   ├── server.js                  # Entry point
│   ├── passport.js                # Google OAuth strategy
│   ├── config.env                 # Environment variables (DO NOT commit)
│   ├── routes/
│   │   └── auth.js                # All auth endpoints
│   ├── middleware/
│   │   └── authMiddleware.js      # JWT verify + auto-refresh
│   ├── utils/
│   │   ├── generateToken.js       # JWT access + refresh token generation
│   │   ├── sendEmail.js           # Nodemailer / Gmail SMTP
│   │   ├── ipValidator.js         # CIDR IP range check
│   │   └── vault.js               # HashiCorp Vault secret loader
│   └── server/
│       └── connect1.cjs           # DB schema initializer (run once)
└── login_page/                    # React frontend
    └── src/
        ├── App.js
        └── page/
            ├── login_page.js      # Login + OTP UI
            └── home_page.js       # App selector UI
```

---

## 4. Environment Setup

Create `backend/config.env` with the following keys:

```env
# ── Google OAuth2 ──────────────────────────────────
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# ── Session ────────────────────────────────────────
SESSION_SECRET=<any-long-random-string>

# ── CORS (React dev server) ────────────────────────
CLIENT_URL=http://localhost:3000

# ── MongoDB Atlas ──────────────────────────────────
ATLAS_PASS=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=<app>

# ── JWT ────────────────────────────────────────────
JWT_ACCESS_SECRET=<strong-secret-1>
JWT_REFRESH_SECRET=<strong-secret-2>

# ── Email (Gmail App Password) ─────────────────────
EMAIL_USER=your@gmail.com
EMAIL_PASS=<16-char-gmail-app-password>

# ── HashiCorp Vault (optional) ─────────────────────
# VAULT_ADDR=http://127.0.0.1:8200
# VAULT_TOKEN=hvs.xxxxxxxxxx
```

> [!IMPORTANT]
> **JWT secrets** must be different strings and kept secret. **Never** commit `config.env`.

> [!NOTE]
> If `VAULT_TOKEN` is absent, the server falls back to `config.env` automatically.

### Getting a Gmail App Password
1. Enable **2-Step Verification** on your Google account.
2. Go to **Google Account → Security → App passwords**.
3. Generate a password for "Mail" → use it as `EMAIL_PASS`.

### Getting Google OAuth2 Credentials
1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**.
2. Create **OAuth 2.0 Client ID** (Web application).
3. Add Authorized redirect URI: `http://localhost:5000/auth/google/callback`.
4. Copy Client ID and Secret into `config.env`.

---

## 5. Database Initialization

Run **once** to create all collections, validators, and indexes in MongoDB:

```bash
cd backend
node server/connect1.cjs
```

Expected output:
```
🔗 Connected to MongoDB Atlas
✅ Created: applications
✅ Created: users
✅ Created: sessions
✅ Created: auditLogs
✅ Created: otps
🎉 Database initialization complete!
```

> [!NOTE]
> Safe to re-run — existing collections are skipped (`⚠️ Exists: <name>`).

---

## 6. MongoDB Collections & Schema

### `applications`
Registers each client app and configures its auth methods.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `appName` | string | ✅ | Human-readable name |
| `clientId` | string | ✅ | Unique public identifier passed by the frontend |
| `clientSecret` | string | — | Reserved for future OIDC/SAML flows |
| `enabledAuthMethods` | `["local","oauth2","saml2","oidc"]` | ✅ | Which methods this app allows |
| `destinationUrls.loginSuccess` | string | ✅ | Redirect URL after successful login |
| `destinationUrls.loginFailure` | string | — | Redirect URL on failure |
| `destinationUrls.logout` | string | — | Post-logout redirect |
| `isActive` | bool | — | Soft-disable flag |
| `createdAt` | date | ✅ | |

**Example document to insert:**
```js
db.applications.insertOne({
  appName: "My App",
  clientId: "client-app-1",
  enabledAuthMethods: ["local", "oauth2"],
  destinationUrls: {
    loginSuccess: "http://localhost:3000/dashboard",
    loginFailure: "http://localhost:3000/login?error=1"
  },
  isActive: true,
  createdAt: new Date()
});
```

---

### `users`
Global user store shared across all apps.

| Field | Type | Description |
|-------|------|-------------|
| `email` | string | Primary identity (unique) |
| `passwordHash` | string \| null | bcrypt hash for local login |
| `roles` | `["admin","end_user","auditor","integrator"]` | Controls IP restriction |
| `mfaEnabled` | bool | Whether MFA is active |
| `mfaMethods` | `["TOTP","SMS","EMAIL"]` | Active MFA channels |
| `accountLocked` | bool | Locked-out state |
| `failedLoginAttempts` | number | Incremented on bad password |
| `linkedProviders` | array | OAuth provider links (e.g. Google) |

> [!IMPORTANT]
> Passwords must be **bcrypt-hashed** before insertion. The backend never stores plaintext.

```js
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash('userpassword', 10);
db.users.insertOne({
  email: "user@example.com",
  passwordHash: hash,
  roles: ["end_user"],
  mfaEnabled: true,
  mfaMethods: ["EMAIL"],
  createdAt: new Date()
});
```

---

### `sessions`
One document per active login session.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | ObjectId | Ref to `users` |
| `appId` | ObjectId \| null | Ref to `applications` |
| `authMethod` | string | `"local"` or `"oauth2"` |
| `refreshToken` | string | JWT refresh token (stored for rotation) |
| `isRevoked` | bool | Set to `true` on logout |
| `expiresAt` | date | TTL — MongoDB auto-deletes expired docs |

---

### `otps`
Short-lived email verification codes (TTL auto-expire).

| Field | Type | Description |
|-------|------|-------------|
| `userId` | ObjectId | Owner |
| `otpCode` | string | HMAC-SHA256 hash of the 6-digit code |
| `otpType` | `"EMAIL"` \| `"SMS"` \| `"TOTP"` | Channel |
| `expiryTime` | date | 5 minutes from creation |
| `isUsed` | bool | Prevents replay attacks |
| `attempts` | number | Reserved for rate limiting |

---

### `auditLogs`
Capped, immutable security event log (5 GB / 5M docs).

**Event types:** `LOGIN_SUCCESS` · `LOGIN_FAILURE` · `LOGOUT` · `TOKEN_ISSUED` · `TOKEN_REVOKED` · `TOKEN_REFRESHED` · `MFA_SUCCESS` · `MFA_FAILURE` · `MFA_ENROLLED` · `OAUTH_CALLBACK` · `PASSWORD_RESET` · `ACCOUNT_LOCKED` · `ACCOUNT_UNLOCKED`

---

## 7. API Reference

Base URL: `http://localhost:5000`

All endpoints expect/return `application/json` unless noted.

---

### `GET /auth/app-config`

Returns the enabled auth methods for a given application. Called by the frontend on page load.

**Query params:**

| Param | Required | Description |
|-------|----------|-------------|
| `clientId` | ✅ | The app's `clientId` from MongoDB |

**Response 200:**
```json
{
  "appName": "My App",
  "enabledAuthMethods": ["local", "oauth2"]
}
```

**Errors:** `400` missing clientId · `404` app not found

---

### `POST /auth/login`

**Step 1 of local login.** Validates email + password. 
- If the user's IP is located in **Hyderabad**, it bypasses MFA (Geo-Shielding) and issues tokens immediately.
- For all other locations, it generates a 6-digit OTP, emails it, and does **not** issue tokens yet.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "plaintextpassword",
  "clientId": "client-app-1"
}
```

> `clientId` can also be sent as header `x-client-id`.

**Response 200 (Non-Hyderabad User - MFA Required):**
```json
{
  "mfaRequired": true,
  "userId": "<mongo-user-id>",
  "message": "OTP sent to your email. Please verify to complete login."
}
```

**Response 200 (Hyderabad User - Direct Login):**
```json
{
  "message": "Login successful",
  "user": {
    "userId": "...",
    "email": "user@example.com",
    "roles": ["end_user"]
  },
  "redirectUrl": "http://localhost:3000/dashboard",
  "otpSkipped": true
}
```

**Errors:**

| Code | Meaning |
|------|---------|
| `400` | Missing email/password or invalid clientId |
| `403` | `local` auth not enabled for this app |
| `404` | User not found |
| `401` | Wrong password |
| `500` | Server error |

---

### `POST /auth/verify-otp`

**Step 2 of local login.** Verifies the emailed OTP, validates IP, then issues JWT tokens as HTTP-only cookies and creates a session.

**Request body:**
```json
{
  "userId": "<mongo-user-id>",
  "otpCode": "482910",
  "clientId": "client-app-1"
}
```

**Response 200:**
```json
{
  "message": "Login successful",
  "user": {
    "userId": "...",
    "email": "user@example.com",
    "roles": ["end_user"]
  },
  "redirectUrl": "http://localhost:3000/dashboard"
}
```

**Cookies set (HTTP-only):**

| Cookie | Lifetime | Content |
|--------|----------|---------|
| `access_token` | 15 min | Base64-encoded JWT access token |
| `refresh_token` | 7 days | JWT refresh token |

**Errors:** `400` missing fields · `401` invalid/expired OTP · `403` IP not whitelisted · `500` server error

---

### `GET /auth/google`

**Step 1 of SSO.** Redirects the browser to Google's OAuth consent screen.

**Query params:**

| Param | Description |
|-------|-------------|
| `clientId` | *(optional)* Passed through as OAuth `state` to identify the app after callback |

**Usage from frontend:**
```js
window.location.href = `http://localhost:5000/auth/google?clientId=client-app-1`;
```

---

### `GET /auth/google/callback`

**Step 2 of SSO (handled by Google redirect — do not call directly).** Validates the Google profile against the `users` collection, issues tokens as HTTP-only cookies, saves the session, and redirects to `destinationUrls.loginSuccess`.

- If the Google email is **not** in the `users` collection → redirect to `/login`.
- On IP violation → `403`.

---

### `POST /auth/logout`

Revokes the active session in MongoDB and clears the `access_token` cookie.

**Request body:**
```json
{
  "appId": "<mongo-app-id>",
  "userId": "<mongo-user-id>"
}
```

**Response 200:**
```json
{ "message": "Logged out successfully." }
```

---

## 8. Authentication Flows

### Flow A — Local Login with Email OTP (MFA)

```
Browser                Backend              MongoDB          Gmail
  │                       │                    │               │
  │─ POST /auth/login ────►│                    │               │
  │   {email, password,    │─ find user ───────►│               │
  │    clientId}           │◄──────────────────│               │
  │                        │─ bcrypt.compare()  │               │
  │                        │─ geo-shield check  │               │
  │                        │─ generate OTP ────►│ insert otps   │
  │                        │─ sendEmail ────────┼───────────────►│
  │◄─ {mfaRequired:true,   │                    │               │
  │    userId}             │                    │               │
  │   (or tokens if skipped)                    │               │
  │                        │                    │               │
  │─ POST /auth/verify-otp►│                    │               │
  │   {userId, otpCode,    │─ hash+find OTP ───►│               │
  │    clientId}           │─ check expiry      │               │
  │                        │─ IP validation     │               │
  │                        │─ generateTokens()  │               │
  │                        │─ insert session ──►│               │
  │                        │─ write auditLog ──►│               │
  │◄─ {user, redirectUrl}  │                    │               │
  │   Set-Cookie: tokens   │                    │               │
```

### Flow B — Google OAuth2 SSO

```
Browser                Backend              Google           MongoDB
  │                       │                    │               │
  │─ GET /auth/google ───►│                    │               │
  │◄── 302 redirect ──────┼────────────────────►               │
  │                       │         Google consent screen      │
  │◄── redirect with code─┼────────────────────               │
  │─ GET /auth/google/    │                    │               │
  │   callback?code=... ─►│─ exchange code ───►│               │
  │                        │◄─ profile          │               │
  │                        │─ find user by email┼──────────────►│
  │                        │─ generateTokens()  │               │
  │                        │─ insert session ──►│               │
  │◄── 302 to loginSuccess │                    │               │
  │   Set-Cookie: token    │                    │               │
```

---

## 9. Token Strategy

| Token | Algorithm | Expiry | Storage | Payload |
|-------|-----------|--------|---------|---------|
| Access Token | HS256 (JWT) | 15 min | HTTP-only cookie (`access_token`) | `userId`, `email`, `roles` |
| Refresh Token | HS256 (JWT) | 7 days | HTTP-only cookie (`refresh_token`) + MongoDB sessions | `userId` |

### Auto-Refresh (`authMiddleware.js`)

When a protected route is hit with an **expired** access token:

1. Middleware decodes (without verify) to extract `userId`.
2. Finds a non-revoked, non-expired session in MongoDB.
3. Verifies the stored refresh token.
4. Fetches the user and signs a **new access token**.
5. Sets the new `access_token` cookie.
6. Continues the request transparently.

If no valid refresh session exists → clears cookie → redirects to `/login`.

### Protecting Your Own Routes

Apply `authMiddleware` to any route that requires authentication:

```js
const authMiddleware = require('./middleware/authMiddleware');

app.get('/your-protected-route', authMiddleware, (req, res) => {
  // req.user = { userId, email, roles }
  res.json({ data: 'secret', user: req.user });
});
```

---

## 10. IP Whitelisting & Geo-Shielding

Non-`end_user` roles (admin, auditor, integrator) are **blocked** unless their IP falls within the configured CIDR ranges. **Change the ALLOWED_IP_RANGES with allowed IP ranges of IITH** 

**Current ranges** (`routes/auth.js`):
```js
const ALLOWED_IP_RANGES = [
  '192.0.2.0/24',
  '198.51.100.0/24'
];
```

> [!IMPORTANT]
> Update these ranges to match your actual corporate network before deploying.

**Role behaviour:**

| Role | IP Check |
|------|----------|
| `end_user` | ✅ Exempt — allowed from any IP |
| `admin` | ❌ Must be in whitelist |
| `auditor` | ❌ Must be in whitelist |
| `integrator` | ❌ Must be in whitelist |

IP enforcement runs at the end of both `/auth/verify-otp` and the Google OAuth callback.

### Geo-Shielding (Location-Based MFA Bypass)

The system includes a smart location-based feature using `geoip-lite` and coordinate distance checking. If a user attempts to login locally and their IP address resolves to within a configured radius of **Hyderabad** (default 40km), the system automatically:
- Skips the Email OTP requirement.
- Issues tokens immediately, providing a seamless "direct login" experience.
- Logs a `LOGIN_SUCCESS` audit event with `otpSkipped: true`.

Users logging in from any other city will still require the 6-digit OTP to complete their login.

---

## 11. Frontend Integration

### Registering a New Application

To add a new app to the portal, insert a document into `applications` (see §6) then add a card to `home_page.js`:

```js
// login_page/src/page/home_page.js
const applications = [
  {
    id: "your-new-client-id",   // must match applications.clientId in MongoDB
    name: "My New App",
    description: "Short description here",
    icon: (<svg>...</svg>)
  },
  // ...existing apps
];
```

### Login Page URL

The login page reads `?clientId=` from the query string to fetch which methods are enabled:

```
http://localhost:3000/?clientId=client-app-1
```

- If `local` is enabled → shows email/password form.
- If `oauth2` is enabled → shows "Sign in with Google" button.
- If only `oauth2` → shows SSO-only screen (no password form).
- If `clientId` is missing → shows nothing (empty methods).

### Making Authenticated API Calls from the Frontend

All requests to the backend **must** include credentials so the cookie is sent:

```js
const res = await fetch('http://localhost:5000/dashboard', {
  method: 'GET',
  credentials: 'include',   // ← required for cookie-based auth
});
```

### Logout

```js
await fetch('http://localhost:5000/auth/logout', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ appId: '<mongo-app-id>', userId: '<user-id>' })
});
window.location.href = '/';
```

---

## 12. Running the System

### Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../login_page
npm install
```

### Start Backend

```bash
cd backend
npm start
# → Server running on http://localhost:5000
```

### Start Frontend

```bash
cd login_page
npm start
# → React app on http://localhost:3000
```

### Quick Verification

```bash
# Should return app config
curl "http://localhost:5000/auth/app-config?clientId=client-app-1"
```

---

## 13. Security Notes

> [!WARNING]
> The following items **must** be addressed before any production deployment.

| Item | Current State | Action Required |
|------|--------------|-----------------|
| JWT secrets | Hardcoded sample values in `config.env` | Replace with ≥ 32-char random secrets |
| OTP HMAC key | Hardcoded `'vikas'` string in `auth.js` | Move to `config.env` as `OTP_HMAC_SECRET` |
| Google credentials | Real credentials in `config.env` | Rotate before sharing repo |
| IP whitelist | Uses example RFC ranges | Update to real corporate CIDRs |
| `NODE_ENV` | Not set | Set to `production` to enable `Secure` cookies |
| `sameSite` cookie | `lax` | Consider `strict` for same-origin only |
| Refresh token | Stored as plaintext in MongoDB | Consider hashing before storage |
| OTP brute force | No attempt limit enforced | Implement `attempts` counter check |
| CORS | Locked to `CLIENT_URL` | Verify this is set correctly in prod |
| Vault integration | Optional/commented out | Enable in production for secret rotation |

> [!TIP]
> Use `crypto.randomBytes(32).toString('hex')` to generate strong JWT secrets.
