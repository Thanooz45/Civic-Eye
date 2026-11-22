import React, { useState } from "react";
import { API_BASE, api } from "../services/api.js";
import { pretty, formatWhen } from "../utils/format.js";

export function WorkflowPanel({ item }) {
  const events = item.timeline || [];
  const routed = events.find((entry) => entry.event === "ROUTED");
  const accepted = events.find((entry) => entry.event === "ACCEPTED" || entry.to === "ASSIGNED");
  const started = events.find((entry) => entry.event === "WORK_STARTED" || entry.to === "IN_PROGRESS");
  const completed = events.find((entry) => entry.to === "CLOSED" || entry.event === "WORK_COMPLETED");
  const reopened = events.find((entry) => entry.event === "REOPENED");

  const steps = [
    {
      title: "Complaint registered",
      detail: formatWhen(item.created_at || events.find((entry) => entry.event === "RECEIVED")?.timestamp),
      actor: "Resident report",
      complete: true,
    },
    {
      title: `Routed to ${pretty(item.department || routed?.department || "City team")}`,
      detail: formatWhen(routed?.timestamp || item.created_at),
      actor: "Department routing",
      complete: Boolean(routed || item.department),
    },
    {
      title: accepted ? `Accepted by ${accepted.actor || "City team"}` : "Department acceptance",
      detail: accepted ? formatWhen(accepted.timestamp) : "Awaiting an officer",
      actor: accepted ? "Assigned officer" : "Not recorded",
      complete: Boolean(accepted),
    },
    {
      title: started
        ? "Work started"
        : completed
        ? "Work start · time not recorded"
        : "Work start",
      detail: started
        ? formatWhen(started.timestamp)
        : completed
        ? "Work was completed."
        : "Awaiting department update",
      actor: started?.actor || (started ? "Department team" : "Not recorded"),
      complete: Boolean(started || completed),
    },
    {
      title: completed
        ? "Work completed (human approved)"
        : reopened
        ? "Reopened for additional work"
        : "Estimated service target",
      detail: completed
        ? formatWhen(completed.timestamp)
        : formatWhen(item.sla_due_at),
      actor: completed?.actor || (completed ? "City team lead" : "Target estimate only"),
      complete: Boolean(completed),
      target: !completed,
    },
  ];

  return (
    <section className="workflow-panel" aria-label="Request progress">
      <div className="workflow-heading">
        <div>
          <small>REQUEST TRACKING & AUDIT TRAIL</small>
          <h3>Where your request is</h3>
        </div>
        <span className="workflow-status">{pretty(item.status || "SUBMITTED")}</span>
      </div>
      <div className="workflow-steps">
        {steps.map((step, index) => (
          <div
            className={`workflow-step${step.complete ? " complete" : ""}${step.target ? " target" : ""}`}
            key={step.title}
          >
            <span className="workflow-node">{step.complete ? "✓" : String(index + 1).padStart(2, "0")}</span>
            <div>
              <b>{step.title}</b>
              <small>{step.detail}</small>
              <small className="workflow-actor">{step.actor}</small>
            </div>
          </div>
        ))}
      </div>
      {!completed && (
        <p className="workflow-note">
          Service targets are estimates based on priority rating. Actual completion dates depend on inspection and crew scheduling.
        </p>
      )}
      {events.length > 0 && (
        <details className="workflow-history">
          <summary>View request audit history ({events.length} events)</summary>
          <ol>
            {events
              .slice()
              .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
              .map((event, index) => (
                <li key={`${event.timestamp || "event"}-${index}`}>
                  <b>{pretty(event.event || event.to || "UPDATE")}</b>
                  <small>{event.reason || "Request status updated."}</small>
                  <span>
                    {event.actor || "System"} · {formatWhen(event.timestamp)}
                  </span>
                </li>
              ))}
          </ol>
        </details>
      )}
    </section>
  );
}

export function IssueDetail({ item, reviewer, notify, reload }) {
  const [repair, setRepair] = useState("");
  const [repairPhotos, setRepairPhotos] = useState([]);
  const [repairVideos, setRepairVideos] = useState([]);
  const [officer, setOfficer] = useState(() => sessionStorage.getItem("civic-eye-name") || "");
  const [busy, setBusy] = useState(false);

  // Triage correction state
  const [showTriageForm, setShowTriageForm] = useState(false);
  const [newCategory, setNewCategory] = useState(item.category || "");
  const [newDepartment, setNewDepartment] = useState(item.department || "");
  const [newPriority, setNewPriority] = useState(item.priority || "");
  const [triageReason, setTriageReason] = useState("");

  // Reopen state
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const accepted = (item.timeline || []).some(
    (entry) => entry.event === "ACCEPTED" || entry.to === "ASSIGNED"
  );
  const workStarted = (item.timeline || []).some(
    (entry) => entry.event === "WORK_STARTED" || entry.to === "IN_PROGRESS"
  );

  const acceptRequest = async () => {
    if (officer.trim().length < 2) return notify("Enter the accepting officer’s name.");
    setBusy(true);
    try {
      await api(`/api/incidents/${encodeURIComponent(item.id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ASSIGNED",
          reason: "Department accepted the request for action.",
          actor: officer.trim(),
        }),
      });
      notify("Request acceptance recorded.");
      setOfficer("");
      await reload();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startWork = async () => {
    const actor = sessionStorage.getItem("civic-eye-name") || "City team";
    setBusy(true);
    try {
      await api(`/api/incidents/${encodeURIComponent(item.id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "IN_PROGRESS",
          reason: "Department began work on this request.",
          actor,
        }),
      });
      notify("Work start time recorded.");
      await reload();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitEvidence = async () => {
    if (repair.trim().length < 10) {
      return notify("Describe the repair evidence in at least 10 characters.");
    }
    if (!repairPhotos.length && !repairVideos.length) {
      return notify("Attach at least one repair photo or video before submitting evidence.");
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("after_description", repair.trim());
      repairPhotos.forEach((photo) => form.append("photos", photo));
      repairVideos.forEach((video) => form.append("videos", video));
      const result = await api(`/api/incidents/${encodeURIComponent(item.id)}/repair-evidence`, {
        method: "POST",
        body: form,
      });
      notify(`${pretty(result.status)}. A supervisor must inspect and approve before closure.`);
      setRepair("");
      setRepairPhotos([]);
      setRepairVideos([]);
      await reload();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    setBusy(true);
    try {
      await api(`/api/incidents/${encodeURIComponent(item.id)}/approve-resolution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved_by: sessionStorage.getItem("civic-eye-name") || "CITY_TEAM_SUPERVISOR",
          reason: "Reviewed after-repair visual evidence and confirmed work meets standards.",
        }),
      });
      notify("Resolution approved and published to public outcomes.");
      await reload();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleTriageCorrection = async (e) => {
    e.preventDefault();
    if (triageReason.trim().length < 5) {
      return notify("Add a reason for the triage correction (at least 5 characters).");
    }
    const actor = sessionStorage.getItem("civic-eye-name") || "Triage Officer";
    setBusy(true);
    try {
      await api(`/api/incidents/${encodeURIComponent(item.id)}/triage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newCategory !== item.category ? newCategory : undefined,
          department: newDepartment !== item.department ? newDepartment : undefined,
          priority: newPriority !== item.priority ? newPriority : undefined,
          reason: triageReason.trim(),
          actor,
        }),
      });
      notify("Triage correction recorded in timeline.");
      setShowTriageForm(false);
      setTriageReason("");
      await reload();
    } catch (err) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReopen = async (e) => {
    e.preventDefault();
    if (reopenReason.trim().length < 10) {
      return notify("State why this incident is being reopened (at least 10 characters).");
    }
    const actor = sessionStorage.getItem("civic-eye-name") || "Auditor";
    setBusy(true);
    try {
      await api(`/api/incidents/${encodeURIComponent(item.id)}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reopenReason.trim(),
          actor,
        }),
      });
      notify("Incident reopened. Timeline history preserved.");
      setShowReopenForm(false);
      setReopenReason("");
      await reload();
    } catch (err) {
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  const originalImages = item.photos || [];
  const originalVideos = item.videos || [];
  const repairImages =
    item.repair_evidence?.photos ||
    (item.repair_evidence?.photo_url ? [item.repair_evidence.photo_url] : []);
  const repairVideoUrls = item.repair_evidence?.videos || [];
  const audios = item.audios || [];

  return (
    <div className="detail-content">
      <small>
        {item.incident_code} · {pretty(item.priority)} PRIORITY
      </small>
      <h3>{item.title}</h3>
      <p>{item.description}</p>

      {item.pollution_subtype && (
        <div style={{ margin: "8px 0", padding: "6px 12px", background: "#eaf3ec", borderRadius: "4px", fontSize: "13px", color: "#173d31" }}>
          <strong>Pollution Subtype:</strong> {pretty(item.pollution_subtype)} Pollution
        </div>
      )}

      <div className="detail-grid">
        <span>
          <small>Status</small>
          <b>{pretty(item.status)}</b>
        </span>
        <span>
          <small>Department</small>
          <b>{pretty(item.department)}</b>
        </span>
        <span>
          <small>City / Landmark</small>
          <b>{item.city || "Not specified"}</b>
        </span>
        <span>
          <small>Community Reports</small>
          <b>{item.report_count}</b>
        </span>
        <span>
          <small>Priority Score</small>
          <b>{item.severity_score}/10</b>
        </span>
        <span>
          <small>Approx. Coordinates</small>
          <b>
            {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
          </b>
        </span>
      </div>

      {/* Transparent Score Breakdown */}
      {item.score_breakdown && (
        <div style={{ margin: "14px 0", padding: "12px", background: "#f8faf7", border: "1px solid #dce7db", borderRadius: "8px" }}>
          <small style={{ fontWeight: "bold", color: "#216c50", display: "block", marginBottom: "6px" }}>
            TRIAGE SCORING TRANSPARENCY (FORMULA: 0.40·H + 0.25·E + 0.20·L + 0.15·R)
          </small>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "13px" }}>
            <span>
              <strong>Hazard (H):</strong> {item.score_breakdown.H?.value !== null ? `${item.score_breakdown.H?.value}/10` : "Unavailable"}
            </span>
            <span>
              <strong>Exposure (E):</strong> {item.score_breakdown.E?.value !== null ? `${item.score_breakdown.E?.value}/10` : "Unavailable"}
            </span>
            <span>
              <strong>Location (L):</strong> {item.score_breakdown.L?.value !== null ? `${item.score_breakdown.L?.value}/10` : "Unavailable"}
            </span>
            <span>
              <strong>Corroboration (R):</strong> {item.score_breakdown.R?.value !== null ? `${item.score_breakdown.R?.value}/10` : "Unavailable"}
            </span>
          </div>
          {item.score_breakdown.plain_language_reason && (
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#607267" }}>
              {item.score_breakdown.plain_language_reason}
            </p>
          )}
        </div>
      )}

      <WorkflowPanel item={item} />

      {/* Authorized Staff Audio Playback */}
      {audios.length > 0 && (
        <div style={{ margin: "16px 0", padding: "14px", background: "#f2f7f3", border: "1px solid #c9decb", borderRadius: "8px" }}>
          <small style={{ color: "#216c50", fontWeight: "bold", display: "block", marginBottom: "4px" }}>
            CITIZEN AUDIO EVIDENCE ({audios.length}) · PRIVATE TO CITY STAFF
          </small>
          <p style={{ fontSize: "12px", color: "#56655a", margin: "0 0 8px" }}>
            Citizen-recorded sound or voice description. Listen directly; no automated AI transcription was performed.
          </p>
          {audios.map((url, i) => (
            <div key={url} style={{ margin: "6px 0" }}>
              <audio controls src={`${API_BASE}${url}`} style={{ width: "100%", maxWidth: "380px" }} />
            </div>
          ))}
        </div>
      )}

      {/* Side-by-side Evidence Comparison (Before vs After) */}
      {(originalImages.length > 0 || repairImages.length > 0) && (
        <div style={{ margin: "20px 0" }}>
          <small style={{ display: "block", fontWeight: "bold", marginBottom: "8px", color: "#173d31" }}>
            RESOLUTION VERIFICATION: BEFORE VS. AFTER EVIDENCE
          </small>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ padding: "12px", background: "#fcf8f2", border: "1px solid #ebd9c0", borderRadius: "8px" }}>
              <strong style={{ fontSize: "13px", color: "#8a5814" }}>BEFORE (ORIGINAL CITIZEN REPORT)</strong>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                {originalImages.map((url) => (
                  <a key={url} href={`${API_BASE}${url}`} target="_blank" rel="noreferrer">
                    <img src={`${API_BASE}${url}`} alt="Before repair" style={{ maxWidth: "100%", maxHeight: "160px", borderRadius: "6px" }} />
                  </a>
                ))}
                {originalVideos.map((url) => (
                  <video key={url} src={`${API_BASE}${url}`} controls playsInline preload="metadata" style={{ maxWidth: "100%", maxHeight: "160px" }} />
                ))}
                {!originalImages.length && !originalVideos.length && (
                  <span style={{ fontSize: "12px", color: "#888" }}>No citizen media attached.</span>
                )}
              </div>
            </div>

            <div style={{ padding: "12px", background: "#f2f8f4", border: "1px solid #cce5d5", borderRadius: "8px" }}>
              <strong style={{ fontSize: "13px", color: "#216c50" }}>AFTER (DEPARTMENT REPAIR EVIDENCE)</strong>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                {repairImages.map((url) => (
                  <a key={url} href={`${API_BASE}${url}`} target="_blank" rel="noreferrer">
                    <img src={`${API_BASE}${url}`} alt="After repair" style={{ maxWidth: "100%", maxHeight: "160px", borderRadius: "6px" }} />
                  </a>
                ))}
                {repairVideoUrls.map((url) => (
                  <video key={url} src={`${API_BASE}${url}`} controls playsInline preload="metadata" style={{ maxWidth: "100%", maxHeight: "160px" }} />
                ))}
                {!repairImages.length && !repairVideoUrls.length && (
                  <span style={{ fontSize: "12px", color: "#888" }}>Pending department repair submission.</span>
                )}
              </div>
              {item.repair_evidence?.after_description && (
                <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#294436" }}>
                  <strong>Repair note:</strong> {item.repair_evidence.after_description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {item.repair_reason && <p className="analysis-reason">{item.repair_reason}</p>}

      {/* Staff Actions */}
      {reviewer && (
        <div className="review-actions">
          <div className="review-section-heading">
            <small>DEPARTMENT ACTIONS & TRIAGE AUDIT</small>
            <p>Authorized officers can accept work, correct triage, submit proof, or approve closure.</p>
          </div>

          {/* Triage Correction Section */}
          <div style={{ margin: "10px 0 16px" }}>
            <button
              type="button"
              className="button button-outline"
              style={{ padding: "6px 12px", fontSize: "13px" }}
              onClick={() => setShowTriageForm(!showTriageForm)}
            >
              {showTriageForm ? "Cancel triage correction" : "⚙️ Correct triage (category/dept/priority)"}
            </button>
            {showTriageForm && (
              <form onSubmit={handleTriageCorrection} style={{ marginTop: "10px", padding: "12px", background: "#fff", border: "1px solid #ccc", borderRadius: "6px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: "bold" }}>Category</label>
                    <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ width: "100%", padding: "6px" }}>
                      <option value="POTHOLE">Pothole</option>
                      <option value="DAMAGED_ROAD">Damaged Road</option>
                      <option value="GARBAGE">Garbage</option>
                      <option value="WATER_LEAKAGE">Water Leakage</option>
                      <option value="OPEN_DRAIN">Open Drain</option>
                      <option value="OPEN_MANHOLE">Open Manhole</option>
                      <option value="STREETLIGHT">Streetlight</option>
                      <option value="POLLUTION">Pollution</option>
                      <option value="OTHER">Other / General</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: "bold" }}>Department</label>
                    <select value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} style={{ width: "100%", padding: "6px" }}>
                      <option value="ROAD_MAINTENANCE">Road Maintenance</option>
                      <option value="ROADS_ENGINEERING">Roads Engineering</option>
                      <option value="MUNICIPAL_SANITATION">Municipal Sanitation</option>
                      <option value="WATER_SUPPLY">Water Supply</option>
                      <option value="DRAINAGE">Drainage</option>
                      <option value="ELECTRICAL_MAINTENANCE">Electrical</option>
                      <option value="POLLUTION_CONTROL">Pollution Control</option>
                      <option value="GENERAL">General Services</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: "bold" }}>Priority</label>
                    <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} style={{ width: "100%", padding: "6px" }}>
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: "10px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold" }}>Reason for adjustment (required for audit)</label>
                  <input
                    type="text"
                    value={triageReason}
                    onChange={(e) => setTriageReason(e.target.value)}
                    placeholder="e.g. Field inspection confirmed industrial smoke, reclassified to Pollution Control"
                    style={{ width: "100%", padding: "6px 8px", fontSize: "13px" }}
                  />
                </div>
                <button type="submit" disabled={busy} className="button button-dark" style={{ marginTop: "10px", padding: "6px 14px", fontSize: "13px" }}>
                  Save Triage Correction
                </button>
              </form>
            )}
          </div>

          {/* Accept and Start Work */}
          {item.status !== "CLOSED" && (
            <>
              {!accepted && (
                <div className="accept-request">
                  <label htmlFor="accepting-officer">Accept this request</label>
                  <input
                    id="accepting-officer"
                    value={officer}
                    onChange={(e) => setOfficer(e.target.value)}
                    placeholder="Officer name"
                  />
                  <button disabled={busy} onClick={acceptRequest}>
                    Record acceptance
                  </button>
                  <small>Records the officer and acceptance time in the request history.</small>
                </div>
              )}
              {accepted && !workStarted && (
                <button disabled={busy} className="start-work-button" onClick={startWork}>
                  Start work · record time
                </button>
              )}

              {/* Submit Repair Evidence */}
              <label htmlFor="repair-description">Repair description</label>
              <textarea
                id="repair-description"
                value={repair}
                onChange={(e) => setRepair(e.target.value)}
                placeholder="Describe what was repaired and materials used (at least 10 characters)"
              />
              <label htmlFor="repair-photo">After-repair photos</label>
              <input
                id="repair-photo"
                className="repair-photo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 5) notify("Choose up to 5 repair photos.");
                  else if (files.some((p) => !["image/jpeg", "image/png", "image/webp"].includes(p.type)))
                    notify("Choose JPG, PNG, or WEBP photos.");
                  else if (files.some((p) => p.size > 10 * 1024 * 1024))
                    notify("Each photo must be under 10 MB.");
                  else setRepairPhotos(files);
                  e.target.value = "";
                }}
              />
              <small>Up to 5 JPG, PNG, or WEBP images · 20 MB combined</small>

              {repairPhotos.length > 0 && (
                <div className="report-photo-previews">
                  {repairPhotos.map((photo, index) => (
                    <div key={`${photo.name}-${index}`}>
                      <img src={URL.createObjectURL(photo)} alt={`Repair evidence ${index + 1}`} />
                      <small>{photo.name}</small>
                      <button type="button" onClick={() => setRepairPhotos((cur) => cur.filter((_, i) => i !== index))}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button disabled={busy} onClick={submitEvidence}>
                {busy ? "Submitting evidence…" : "Submit repair evidence"}
              </button>
              <button
                className="approve-button"
                disabled={busy || (!repairImages.length && !repairVideoUrls.length)}
                onClick={approve}
              >
                Approve verified closure
              </button>
              <small>Closure requires explicit human approval of uploaded visual evidence.</small>
            </>
          )}

          {/* Reopen Action when CLOSED */}
          {item.status === "CLOSED" && (
            <div style={{ marginTop: "16px", padding: "14px", background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: "8px" }}>
              <b>Issue Closed & Verified</b>
              <p style={{ margin: "4px 0 8px", fontSize: "13px", color: "#666" }}>
                If citizen feedback or follow-up inspection reveals the repair was incomplete or the issue recurred, you can reopen it:
              </p>
              {!showReopenForm ? (
                <button
                  type="button"
                  className="button button-outline"
                  style={{ padding: "6px 14px", fontSize: "13px", color: "#c53030", borderColor: "#feb2b2" }}
                  onClick={() => setShowReopenForm(true)}
                >
                  ↺ Reopen Incident
                </button>
              ) : (
                <form onSubmit={handleReopen} style={{ marginTop: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", display: "block" }}>
                    Reason for reopening (required for accountability)
                  </label>
                  <input
                    type="text"
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="e.g. Incomplete bitumen leveling; problem persisted during rain"
                    style={{ width: "100%", padding: "6px 8px", fontSize: "13px", margin: "6px 0" }}
                  />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button type="submit" disabled={busy} className="button button-dark" style={{ padding: "6px 14px", fontSize: "13px" }}>
                      Confirm Reopen
                    </button>
                    <button type="button" className="button button-outline" style={{ padding: "6px 14px", fontSize: "13px" }} onClick={() => setShowReopenForm(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
