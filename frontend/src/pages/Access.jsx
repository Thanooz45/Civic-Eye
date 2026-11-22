import React, { useState } from "react";
import { Brand } from "../components/Brand.jsx";

export function Access({ onEnter, onBack, role, setRole }) {
  const [cityName, setCityName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [codesOpen, setCodesOpen] = useState(false);

  // Demo mode check: enabled by query param ?demo=true, window flag, or env var
  const isDemoMode = Boolean(
    window.__CIVIC_EYE_DEMO_MODE__ ||
    import.meta.env?.VITE_DEMO_MODE === "true" ||
    (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "true")
  );

  const enter = async () => {
    setLoginError("");
    setBusy(true);
    try {
      await onEnter({ name: cityName, accessCode });
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const demoCodes = [
    ["Road Maintenance", "roadmaintenance101"],
    ["Roads Engineering", "roadsengineering101"],
    ["Municipal Sanitation", "municipalsanitation101"],
    ["Water Supply", "watersupplyaccess101"],
    ["Drainage", "drainageaccess101"],
    ["Electrical Maintenance", "electricalmaintenance101"],
    ["General Services", "generalservices101"],
    ["Pollution Control Board", "pollutioncontrol101"],
    ["Head of all departments", "cityteamaccess101"],
  ];

  return (
    <main className="access-page">
      <section className="access-story">
        <Brand onClick={onBack} light />
        <div>
          <small>PUBLIC INTEREST TECHNOLOGY</small>
          <h1>
            Your city works<br />
            better when <em>we all<br />show up.</em>
          </h1>
          <p>Report a concern, follow its progress and see what your community can accomplish together.</p>
          <div className="story-proof">
            <span>↗</span>
            <b>From neighborhood concern to public outcome.</b>
          </div>
        </div>
        <small>COMMUNITY-POWERED · HUMAN-REVIEWED</small>
      </section>

      <section className="access-panel">
        <button className="back-button" onClick={onBack}>← Back to Civic Eye</button>
        <div className="access-content">
          <span className="brand-mark access-mark">C</span>
          <small>STEP INTO THE CIVIC LOOP</small>
          <h2>
            See your city<br />from every side.
          </h2>
          <p>Residents can report an issue. City-team access requires an authorized sign-in.</p>

          <div className="role-options">
            <button
              className={role === "resident" ? "role-card active" : "role-card"}
              onClick={() => setRole("resident")}
            >
              <span>⌂</span>
              <b>
                Resident
                <small>Report a concern and follow its progress</small>
              </b>
              <i>{role === "resident" ? "✓" : ""}</i>
            </button>
            <button
              className={role === "reviewer" ? "role-card active" : "role-card"}
              onClick={() => setRole("reviewer")}
            >
              <span>▤</span>
              <b>
                Department / head
                <small>Department access or citywide head access</small>
              </b>
              <i>{role === "reviewer" ? "✓" : ""}</i>
            </button>
          </div>

          {role === "reviewer" ? (
            <div className="city-login">
              <label htmlFor="city-team-name">Your name</label>
              <input
                id="city-team-name"
                autoComplete="name"
                value={cityName}
                onChange={(event) => setCityName(event.target.value)}
                placeholder="Name shown in request activity"
              />
              <label htmlFor="city-team-code">Department or head access code</label>
              <input
                id="city-team-code"
                type="password"
                autoComplete="current-password"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                placeholder="Enter your confidential access code"
              />

              {isDemoMode ? (
                <button
                  type="button"
                  className="code-reference-link"
                  onClick={() => setCodesOpen(true)}
                  style={{ marginTop: "6px" }}
                >
                  View reference demo access codes
                </button>
              ) : (
                <small style={{ display: "block", marginTop: "6px", color: "#78867d", fontSize: "12px" }}>
                  Department access codes are confidential credentials issued by the municipal administration.
                </small>
              )}

              {loginError && (
                <p className="inline-error" role="alert">
                  {loginError}
                </p>
              )}
            </div>
          ) : (
            <div className="demo-hint">
              <span>ⓘ</span>You can report a public issue without creating an account.
            </div>
          )}

          <button className="button button-dark enter-button" onClick={enter} disabled={busy}>
            {busy ? "Signing in…" : role === "reviewer" ? "Sign in to city team" : "Continue to Civic Eye"} <span>→</span>
          </button>
        </div>

        <div className="access-footer">
          <span>PUBLIC INTEREST TECHNOLOGY</span>
          <span>COMMUNITY ACCESS <i /></span>
        </div>

        {codesOpen && isDemoMode && (
          <div className="code-modal-backdrop" role="presentation" onClick={() => setCodesOpen(false)}>
            <section
              className="code-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="codes-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button className="code-modal-close" onClick={() => setCodesOpen(false)} aria-label="Close">
                ×
              </button>
              <small>DEMO STAFF ACCESS (EXPLICIT DEMO MODE)</small>
              <h2 id="codes-title">Access code references</h2>
              <p>These synthetic reference codes match the local demo setup so you can test each role.</p>
              <div className="code-warning">
                <b>SYNTHETIC DEMO ONLY</b>
                <span>Real government access codes and API keys are strictly kept server-side in secure environment configuration.</span>
              </div>
              <ul>
                {demoCodes.map(([name, code]) => (
                  <li key={code}>
                    <span>{name}</span>
                    <code>{code}</code>
                  </li>
                ))}
              </ul>
              <button className="button button-dark" onClick={() => setCodesOpen(false)}>
                Got it
              </button>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
