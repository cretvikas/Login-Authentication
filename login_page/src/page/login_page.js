import React, { useState, useEffect } from "react";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .login-root {
    background: #0b0b0e;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'DM Sans', sans-serif;
    color: #f0ece4;
    position: relative;
    overflow: hidden;
  }

  .orb-a {
    position: fixed;
    top: -15%;
    left: -10%;
    width: 560px;
    height: 560px;
    background: radial-gradient(circle, rgba(200,169,110,0.07) 0%, transparent 70%);
    pointer-events: none;
    animation: driftA 14s ease-in-out infinite alternate;
  }
  .orb-b {
    position: fixed;
    bottom: -20%;
    right: -5%;
    width: 480px;
    height: 480px;
    background: radial-gradient(circle, rgba(100,130,200,0.05) 0%, transparent 70%);
    pointer-events: none;
    animation: driftB 18s ease-in-out infinite alternate;
  }

  @keyframes driftA { from { transform: translate(0,0); } to { transform: translate(40px,30px); } }
  @keyframes driftB { from { transform: translate(0,0); } to { transform: translate(-30px,-40px); } }

  .card {
    background: #111114;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 22px;
    padding: 52px 48px 48px;
    width: 100%;
    max-width: 420px;
    position: relative;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.03),
      0 40px 80px rgba(0,0,0,0.65),
      0 0 60px rgba(200,169,110,0.04);
    animation: fadeUp 0.65s cubic-bezier(0.22,1,0.36,1) both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(26px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)   scale(1); }
  }

  .card-topline {
    position: absolute;
    top: 0; left: 50%;
    transform: translateX(-50%);
    width: 58%;
    height: 1px;
    background: linear-gradient(90deg, transparent, #c8a96e, transparent);
    border-radius: 99px;
  }

  .logo {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(200,169,110,0.12);
    border: 1px solid rgba(200,169,110,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    margin-bottom: 28px;
  }

  .card h1 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 30px;
    font-weight: 600;
    letter-spacing: -0.3px;
    line-height: 1.2;
    margin-bottom: 6px;
  }

  .subtitle {
    font-size: 13.5px;
    color: #6b6760;
    font-weight: 300;
    margin-bottom: 36px;
  }

  .field { margin-bottom: 18px; }

  .field label {
    display: block;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.9px;
    text-transform: uppercase;
    color: #6b6760;
    margin-bottom: 8px;
  }

  .input-wrap { position: relative; }

  .input-icon {
    position: absolute;
    left: 13px;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0.35;
    pointer-events: none;
    transition: opacity 0.2s;
    color: #f0ece4;
    display: flex;
    align-items: center;
  }

  .input-wrap input:focus ~ .input-icon { opacity: 0.7; }

  .input-wrap input {
    width: 100%;
    background: #18181b;
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    padding: 13px 14px 13px 42px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: #f0ece4;
    outline: none;
    transition: border-color 0.25s, box-shadow 0.25s, background 0.2s;
  }
  .input-wrap input::placeholder { color: #6b6760; opacity: 0.7; }
  .input-wrap input:focus {
    border-color: rgba(200,169,110,0.5);
    box-shadow: 0 0 0 3px rgba(200,169,110,0.08);
    background: #1d1d21;
  }

  .eye-btn {
    position: absolute;
    right: 11px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: #6b6760;
    padding: 4px;
    display: flex;
    align-items: center;
    opacity: 0.55;
    transition: opacity 0.2s;
  }
  .eye-btn:hover { opacity: 1; }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 6px 0 28px;
  }

  .remember {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #6b6760;
    cursor: pointer;
    user-select: none;
  }
  .remember input[type="checkbox"] {
    width: 15px; height: 15px;
    accent-color: #c8a96e;
    cursor: pointer;
  }

  .forgot {
    font-size: 13px;
    color: #c8a96e;
    text-decoration: none;
    opacity: 0.8;
    transition: opacity 0.2s;
    background: none;
    border: none;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
  }
  .forgot:hover { opacity: 1; }

  .btn {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 10px;
    background: #c8a96e;
    color: #0b0b0e;
    font-family: 'DM Sans', sans-serif;
    font-size: 14.5px;
    font-weight: 500;
    letter-spacing: 0.3px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: transform 0.15s, box-shadow 0.2s, filter 0.2s;
    box-shadow: 0 4px 20px rgba(200,169,110,0.25);
  }
  .btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 28px rgba(200,169,110,0.35);
    filter: brightness(1.07);
  }
  .btn:active { transform: translateY(0); }
  .btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 60%);
    pointer-events: none;
  }
  .btn-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
    z-index: 1;
  }

  .error-msg {
    background: rgba(220,60,60,0.1);
    border: 1px solid rgba(220,60,60,0.25);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    color: #e07070;
    margin-bottom: 18px;
    animation: fadeUp 0.3s ease both;
  }

  .footer-note {
    text-align: center;
    font-size: 13px;
    color: #6b6760;
    margin-top: 24px;
  }
  .footer-note a {
    color: #c8a96e;
    text-decoration: none;
    opacity: 0.85;
    transition: opacity 0.2s;
  }
  .footer-note a:hover { opacity: 1; }
`;

export default function Login({ setUser }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  // App config — which auth methods are enabled
  const [appMethods, setAppMethods] = useState(null); // null = loading
  const [appName, setAppName]       = useState("");

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId]     = useState(null);
  const [otpCode, setOtpCode]         = useState("");

  // ── Fetch app config on mount ─────────────────────────────
  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const clientId = params.get("clientId");
    if (!clientId) {
      setAppMethods([]);   // no clientId → show nothing / error
      return;
    }
    fetch(`http://localhost:5000/auth/app-config?clientId=${clientId}`)
      .then(r => r.json())
      .then(data => {
        setAppMethods(data.enabledAuthMethods ?? []);
        setAppName(data.appName ?? "");
      })
      .catch(() => setAppMethods([]));
  }, []);

  const localEnabled  = appMethods?.includes("local");
  const ssoEnabled    = appMethods?.includes("oauth2");


  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const clientId = params.get("clientId");

      const res = await fetch("http://localhost:5000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: username, password, clientId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }

      // If MFA is required, switch to OTP screen
      if (data.mfaRequired) {
        setMfaRequired(true);
        setMfaUserId(data.userId);
        return;
      }

      setUser(data.user);
    } catch (err) {
      setError("Unable to connect to server.");
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (!otpCode.trim()) {
      setError("Please enter the verification code.");
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const clientId = params.get("clientId");

      const res = await fetch("http://localhost:5000/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: mfaUserId, otpCode, clientId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed.");
        return;
      }

      setUser(data.user);
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch (err) {
      setError("Unable to connect to server.");
    }
  };

  // ── Loading screen ────────────────────────────────────────
  if (appMethods === null) {
    return (
      <>
        <style>{styles}</style>
        <div className="login-root">
          <div className="orb-a" /><div className="orb-b" />
          <div className="card" style={{ textAlign: "center", padding: "60px 48px" }}>
            <div className="card-topline" />
            <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
            <p className="subtitle">Loading application config…</p>
          </div>
        </div>
      </>
    );
  }

  // ── OTP Verification Screen ───────────────────────────────────
  if (mfaRequired) {
    return (
      <>
        <style>{styles}</style>
        <div className="login-root">
          <div className="orb-a" />
          <div className="orb-b" />

          <div className="card">
            <div className="card-topline" />

            <div className="logo">🔐</div>
            <h1>Verify Your Identity</h1>
            <p className="subtitle">
              We've sent a 6-digit code to your email. Enter it below.
            </p>

            {error && <div className="error-msg">{error}</div>}

            <div className="field">
              <label htmlFor="otp-code">Verification Code</label>
              <div className="input-wrap">
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp(e)}
                  style={{ letterSpacing: "8px", textAlign: "center", paddingLeft: "14px", fontSize: "22px" }}
                />
                <span className="input-icon">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                </span>
              </div>
            </div>

            <button className="btn" onClick={handleVerifyOtp} style={{ marginTop: "12px" }}>
              <div className="btn-inner">
                <span>Verify & Sign In</span>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
            </button>

            <p className="footer-note" style={{ marginTop: "20px" }}>
              <button
                style={{ background: "none", border: "none", color: "#c8a96e", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: "13px" }}
                onClick={() => { setMfaRequired(false); setOtpCode(""); setError(""); }}
              >
                ← Back to Sign In
              </button>
            </p>
          </div>
        </div>
      </>
    );
  }

  // ── SSO-Only Screen (no local form at all) ─────────────────
  if (!localEnabled && ssoEnabled) {
    return (
      <>
        <style>{styles}</style>
        <div className="login-root">
          <div className="orb-a" /><div className="orb-b" />
          <div className="card">
            <div className="card-topline" />
            <div className="logo">🔐</div>
            <h1>Welcome</h1>
            <p className="subtitle">
              {appName ? `Sign in to ${appName}` : "Sign in to continue"}
            </p>
            {error && <div className="error-msg">{error}</div>}
            <button
              className="btn"
              style={{ marginTop: "8px" }}
              onClick={() => {
                const params   = new URLSearchParams(window.location.search);
                const clientId = params.get("clientId");
                const url = new URL("http://localhost:5000/auth/google");
                if (clientId) url.searchParams.append("clientId", clientId);
                window.location.href = url.toString();
              }}
            >
              <div className="btn-inner">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Sign in with Google</span>
              </div>
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Password Login Screen ────────────────────────────────────
  return (
    <>
      <style>{styles}</style>
      <div className="login-root">
        <div className="orb-a" />
        <div className="orb-b" />

        <div className="card">
          <div className="card-topline" />

          <h1>Welcome</h1>
          <p className="subtitle">Sign in to continue to your account</p>

          {error && <div className="error-msg">{error}</div>}

          <div className="field">
            <label htmlFor="username">Username</label>
            <div className="input-wrap">
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <span className="input-icon">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
                </svg>
              </span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <input
                id="password"
                type={showPass ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin(e)}
              />
              <span className="input-icon">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </span>
              <button className="eye-btn" type="button" onClick={() => setShowPass(!showPass)} aria-label="Toggle password">
                {showPass ? (
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="row">
            <label className="remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>
            <button className="forgot" type="button">Forgot password?</button>
          </div>

          <button className="btn" onClick={handleLogin}>
            <div className="btn-inner">
              <span>Sign In →</span>
            </div>
          </button>

          {/* SSO option — only shown if oauth2 is enabled for this app */}
          {ssoEnabled && (
            <p className="footer-note">
              <button
                style={{background:"none",border:"none",color:"#c8a96e",cursor:"pointer",fontFamily:"'DM Sans', sans-serif",fontSize:"13px"}}
                onClick={() => {
                  const params   = new URLSearchParams(window.location.search);
                  const clientId = params.get("clientId");
                  const url = new URL('http://localhost:5000/auth/google');
                  if (clientId) url.searchParams.append('clientId', clientId);
                  window.location.href = url.toString();
                }}
              >
                Sign in with other options
              </button>
            </p>
          )}
        </div>
      </div>
    </>
  );
}