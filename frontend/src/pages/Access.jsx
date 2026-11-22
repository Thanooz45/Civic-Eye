import React, { useState } from "react";
import { Brand } from "../components/Brand.jsx";

export function Access({ onEnter, onBack, role, setRole }) {
  const [cityName, setCityName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [codesOpen, setCodesOpen] = useState(false);

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
    ["Road Maintenance", "roadmaintenance101", "CIVIC_DEPT_ROAD_MAINTENANCE_ACCESS_CODE"],
    ["Roads Engineering", "roadsengineering101", "CIVIC_DEPT_ROADS_ENGINEERING_ACCESS_CODE"],
    ["Municipal Sanitation", "municipalsanitation101", "CIVIC_DEPT_MUNICIPAL_SANITATION_ACCESS_CODE"],
    ["Water Supply", "watersupplyaccess101", "CIVIC_DEPT_WATER_SUPPLY_ACCESS_CODE"],
    ["Drainage", "drainageaccess101", "CIVIC_DEPT_DRAINAGE_ACCESS_CODE"],
    ["Electrical Maintenance", "electricalmaintenance101", "CIVIC_DEPT_ELECTRICAL_MAINTENANCE_ACCESS_CODE"],
    ["General Services", "generalservices101", "CIVIC_DEPT_GENERAL_ACCESS_CODE"],
    ["Pollution Control Board", "pollutioncontrol101", "CIVIC_DEPT_POLLUTION_CONTROL_ACCESS_CODE"],
    ["Head of all departments", "cityteamaccess101", "CITY_TEAM_ACCESS_CODE"],
  ];

  const handleSelectCode = (code) => {
    setAccessCode(code);
    setCodesOpen(false);
  };

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

              {/* View reference access codes button below input */}
              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <button
                  type="button"
                  className="code-reference-link"
                  onClick={() => setCodesOpen(true)}
                  style={{ alignSelf: "flex-start", fontWeight: "600", fontSize: "13px" }}
                >
                  🔑 View reference access codes
                </button>

                {/* Red highlight notice */}
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#fff5f5",
                    border: "1px solid #fed7d7",
                    borderLeft: "4px solid #e53e3e",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "#9b2c2c",
                    lineHeight: "1.5",
                  }}
                >
                  <strong>⚠️ Reference Only:</strong> These codes are provided for demonstration and reference. In real government deployment, confidential access codes will be directly sent to the respective departments.
                </div>
              </div>

              {loginError && (
                <p className="inline-error" role="alert" style={{ marginTop: "10px" }}>
                  {loginError}
                </p>
              )}
            </div>
          ) : (
            <div className="demo-hint">
              <span>ⓘ</span>You can report a public issue without creating an account.
            </div>
          )}

          <button className="button button-dark enter-button" onClick={enter} disabled={busy} style={{ marginTop: "16px" }}>
            {busy ? "Signing in…" : role === "reviewer" ? "Sign in to city team" : "Continue to Civic Eye"} <span>→</span>
          </button>
        </div>

        <div className="access-footer">
          <span>PUBLIC INTEREST TECHNOLOGY</span>
          <span>COMMUNITY ACCESS <i /></span>
        </div>

        {/* Modal Pop-up with red highlight notice and all department codes */}
        {codesOpen && (
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
              <small>DEPARTMENT ACCESS CODES</small>
              <h2 id="codes-title">Reference Access Codes</h2>
              <p>Reference codes for demonstration and testing of municipal department queues.</p>

              {/* Prominent Red Highlight Notice */}
              <div
                style={{
                  margin: "12px 0 16px",
                  padding: "12px 14px",
                  background: "#fff5f5",
                  border: "1px solid #feb2b2",
                  borderLeft: "5px solid #e53e3e",
                  borderRadius: "8px",
                  color: "#9b2c2c",
                  fontSize: "12px",
                  lineHeight: "1.6",
                }}
              >
                <b style={{ color: "#c53030", display: "block", marginBottom: "4px", fontSize: "11px", letterSpacing: "0.08em" }}>
                  ⚠️ CONFIDENTIALITY & REAL-WORLD USE NOTICE
                </b>
                <span>
                  These access codes are for <strong>reference and demonstration only</strong>. In real-world government deployment, confidential access credentials will be <strong>directly sent to the respective departments</strong> and are never published publicly.
                </span>
              </div>

              <ul style={{ maxHeight: "380px", overflowY: "auto" }}>
                {demoCodes.map(([name, code, envKey]) => (
                  <li key={code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
                    <div>
                      <strong style={{ display: "block", fontSize: "13px" }}>{name}</strong>
                      <small style={{ color: "#78867d", fontSize: "11px" }}>{envKey}</small>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <code style={{ fontSize: "11px", padding: "3px 6px", background: "#f4f7f1", borderRadius: "4px" }}>
                        {code}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleSelectCode(code)}
                        style={{
                          padding: "4px 10px",
                          fontSize: "12px",
                          fontWeight: "bold",
                          color: "#216c50",
                          background: "#e4f0e3",
                          border: "1px solid #c9decb",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Use
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <button className="button button-dark" onClick={() => setCodesOpen(false)} style={{ width: "100%", marginTop: "12px" }}>
                Close
              </button>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
