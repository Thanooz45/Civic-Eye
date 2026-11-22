import React, { useState } from "react";
import { API_BASE, api } from "../services/api.js";
import { pretty, formatWhen } from "../utils/format.js";

export function WorkflowPanel({ item }) {
  const events = item.timeline || [];
  const routed = events.find((entry) => entry.event === "ROUTED");
  const accepted = events.find((entry) => entry.event === "ACCEPTED" || entry.to === "ASSIGNED");
  const started = events.find((entry) => entry.event === "WORK_STARTED" || entry.to === "IN_PROGRESS");
  const completed = events.find((entry) => entry.to === "CLOSED");
  const steps = [
    { title: "Complaint registered", detail: formatWhen(item.created_at || events.find((entry) => entry.event === "RECEIVED")?.timestamp), actor: "Resident report", complete: true },
    { title: `Sent to ${pretty(item.department || routed?.department || "City team")}`, detail: formatWhen(routed?.timestamp || item.created_at), actor: "Department routing", complete: Boolean(routed || item.department) },
    { title: accepted ? `Accepted by ${accepted.actor || "City team"}` : "Department acceptance", detail: accepted ? formatWhen(accepted.timestamp) : "Awaiting an officer", actor: accepted ? "Assigned officer" : "Not recorded", complete: Boolean(accepted) },
    { title: started ? "Work started" : completed ? "Work start · time not recorded" : "Work start", detail: started ? formatWhen(started.timestamp) : completed ? "Work was completed, but no start time was recorded." : "Awaiting department update", actor: started?.actor || (started ? "Department team" : "Not recorded"), complete: Boolean(started || completed) },
    { title: completed ? "Work completed" : "Target completion", detail: completed ? formatWhen(completed.timestamp) : formatWhen(item.sla_due_at), actor: completed?.actor || (completed ? "City team" : "Service target"), complete: Boolean(completed), target: !completed },
  ];
  return <section className="workflow-panel" aria-label="Request progress">
    <div className="workflow-heading"><div><small>REQUEST TRACKING</small><h3>Where your request is</h3></div><span className="workflow-status">{pretty(item.status || "SUBMITTED")}</span></div>
    <div className="workflow-steps">{steps.map((step, index) => <div className={`workflow-step${step.complete ? " complete" : ""}${step.target ? " target" : ""}`} key={step.title}><span className="workflow-node">{step.complete ? "✓" : String(index + 1).padStart(2, "0")}</span><div><b>{step.title}</b><small>{step.detail}</small><small className="workflow-actor">{step.actor}</small></div></div>)}</div>
    {!completed && <p className="workflow-note">The completion date is a service target based on issue priority. Any department updates will appear in the activity history.</p>}
    {events.length > 0 && <details className="workflow-history"><summary>View request activity ({events.length})</summary><ol>{events.slice().sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)).map((event, index) => <li key={`${event.timestamp || "event"}-${index}`}><b>{pretty(event.event || event.to || "UPDATE")}</b><small>{event.reason || "Request status updated."}</small><span>{event.actor || "System"} · {formatWhen(event.timestamp)}</span></li>)}</ol></details>}
  </section>;
}

export function IssueDetail({ item, reviewer, notify, reload }) {
  const [repair, setRepair] = useState("");
  const [repairPhotos, setRepairPhotos] = useState([]);
  const [repairVideos, setRepairVideos] = useState([]);
  const [officer, setOfficer] = useState(() => sessionStorage.getItem("civic-eye-name") || "");
  const [busy, setBusy] = useState(false);
  const accepted = (item.timeline || []).some((entry) => entry.event === "ACCEPTED" || entry.to === "ASSIGNED");
  const workStarted = (item.timeline || []).some((entry) => entry.event === "WORK_STARTED" || entry.to === "IN_PROGRESS");
  const acceptRequest = async () => {
    if (officer.trim().length < 2) return notify("Enter the accepting officer’s name.");
    setBusy(true);
    try {
      await api(`/api/incidents/${encodeURIComponent(item.id)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ASSIGNED", reason: "Department accepted the request for action.", actor: officer.trim() }) });
      notify("Request acceptance recorded."); setOfficer(""); await reload();
    } catch (e) { notify(e.message); } finally { setBusy(false); }
  };
  const startWork = async () => {
    const actor = sessionStorage.getItem("civic-eye-name") || "City team";
    setBusy(true);
    try {
      await api(`/api/incidents/${encodeURIComponent(item.id)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "IN_PROGRESS", reason: "Department began work on this request.", actor }) });
      notify("Work start time recorded."); await reload();
    } catch (e) { notify(e.message); } finally { setBusy(false); }
  };
  const submitEvidence = async () => {
    if (repair.trim().length < 10) return notify("Describe the repair evidence in at least 10 characters.");
    if (!repairPhotos.length && !repairVideos.length) return notify("Attach at least one repair photo or video before submitting evidence.");
    setBusy(true);
    try { const form = new FormData(); form.set("after_description", repair.trim()); repairPhotos.forEach((photo) => form.append("photos", photo)); repairVideos.forEach((video) => form.append("videos", video)); const result = await api(`/api/incidents/${encodeURIComponent(item.id)}/repair-evidence`, { method: "POST", body: form }); notify(`${pretty(result.status)}. Human approval is still required.`); setRepair(""); setRepairPhotos([]); setRepairVideos([]); await reload(); }
    catch (e) { notify(e.message); } finally { setBusy(false); }
  };
  const approve = async () => {
    setBusy(true);
    try { await api(`/api/incidents/${encodeURIComponent(item.id)}/approve-resolution`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved_by: sessionStorage.getItem("civic-eye-name") || "CITY_TEAM", reason: "A city team member approved the repair evidence." }) }); notify("Resolution approved and published to public outcomes."); await reload(); }
    catch (e) { notify(e.message); } finally { setBusy(false); }
  };
  const repairImages = item.repair_evidence?.photos || (item.repair_evidence?.photo_url ? [item.repair_evidence.photo_url] : []);
  const repairVideoUrls = item.repair_evidence?.videos || [];
  return <div className="detail-content"><small>{item.incident_code} · {pretty(item.priority)} PRIORITY</small><h3>{item.title}</h3><p>{item.description}</p><div className="detail-grid"><span><small>Status</small><b>{pretty(item.status)}</b></span><span><small>Department</small><b>{pretty(item.department)}</b></span><span><small>City / neighborhood</small><b>{item.city || "Not specified"}</b></span><span><small>Community reports</small><b>{item.report_count}</b></span><span><small>Priority score</small><b>{item.severity_score}/10</b></span><span><small>Approx. location</small><b>{Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}</b></span></div><WorkflowPanel item={item}/>{(item.photos?.length > 0 || item.videos?.length > 0) && <div className="evidence-photos"><small>COMMUNITY REFERENCE MEDIA</small><div>{item.photos?.map((url) => <a key={url} href={`${API_BASE}${url}`} target="_blank" rel="noreferrer"><img src={`${API_BASE}${url}`} alt="Photo submitted with this community issue"/></a>)}{item.videos?.map((url) => <video key={url} src={`${API_BASE}${url}`} controls playsInline preload="metadata"/>)}</div></div>}{(repairImages.length > 0 || repairVideoUrls.length > 0) && <div className="evidence-photos"><small>AFTER REPAIR EVIDENCE</small><div>{repairImages.map((url) => <a key={url} href={`${API_BASE}${url}`} target="_blank" rel="noreferrer"><img src={`${API_BASE}${url}`} alt="Photo showing completed repair"/></a>)}{repairVideoUrls.map((url) => <video key={url} src={`${API_BASE}${url}`} controls playsInline preload="metadata"/>)}</div></div>}{item.repair_reason && <p className="analysis-reason">{item.repair_reason}</p>}{item.status !== "CLOSED" && reviewer && <div className="review-actions"><div className="review-section-heading"><small>DEPARTMENT ACTIONS</small><p>Record acceptance and start times, then attach clear evidence of completed work.</p></div>{!accepted && <div className="accept-request"><label htmlFor="accepting-officer">Accept this request</label><input id="accepting-officer" value={officer} onChange={(e) => setOfficer(e.target.value)} placeholder="Officer name"/><button disabled={busy} onClick={acceptRequest}>Record acceptance</button><small>This records the officer and acceptance time in the request history.</small></div>}{accepted && !workStarted && <button disabled={busy} className="start-work-button" onClick={startWork}>Start work · record time</button>}<label htmlFor="repair-description">Repair description</label><textarea id="repair-description" value={repair} onChange={(e) => setRepair(e.target.value)} placeholder="Describe what was repaired (at least 10 characters)"/><label htmlFor="repair-photo">After-repair photos</label><input id="repair-photo" className="repair-photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length > 5) notify("Choose up to 5 repair photos."); else if (files.some((photo) => !["image/jpeg", "image/png", "image/webp"].includes(photo.type))) notify("Choose JPG, PNG, or WEBP photos."); else if (files.some((photo) => photo.size > 10 * 1024 * 1024) || files.reduce((sum, photo) => sum + photo.size, 0) > 20 * 1024 * 1024) notify("Each photo must be under 10 MB and all photos together under 20 MB."); else setRepairPhotos(files); e.target.value = ""; }}/><small>Up to 5 JPG, PNG, or WEBP images · 20 MB combined</small>{repairPhotos.length > 0 && <div className="report-photo-previews">{repairPhotos.map((photo, index) => <div key={`${photo.name}-${index}`}><img src={URL.createObjectURL(photo)} alt={`Repair evidence ${index + 1}`}/><small>{photo.name}</small><button type="button" onClick={() => setRepairPhotos((current)=>current.filter((_,i)=>i!==index))}>Remove</button></div>)}</div>}<label htmlFor="repair-video">After-repair videos</label><input id="repair-video" className="repair-photo-input" type="file" accept="video/mp4,video/webm" multiple onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length > 3) notify("Choose up to 3 repair videos."); else if (files.some((video) => !["video/mp4", "video/webm"].includes(video.type))) notify("Choose MP4 or WEBM videos."); else if (files.some((video) => video.size > 12 * 1024 * 1024) || files.reduce((sum, video) => sum + video.size, 0) > 24 * 1024 * 1024) notify("Each video must be under 12 MB and all videos together under 24 MB."); else setRepairVideos(files); e.target.value = ""; }}/><small>Up to 3 MP4 or WEBM clips · 12 MB each</small>{repairVideos.map((video,index)=><div className="video-preview" key={`${video.name}-${index}`}><video src={URL.createObjectURL(video)} controls playsInline preload="metadata"/><span>{video.name}</span></div>)}<button disabled={busy} onClick={submitEvidence}>{busy ? "Submitting evidence…" : "Submit repair evidence"}</button><button className="approve-button" disabled={busy || (!repairImages.length && !repairVideoUrls.length)} onClick={approve}>Approve verified closure</button><small>Review the uploaded photo or video before approving closure.</small></div>}{item.status !== "CLOSED" && !reviewer && <p className="analysis-reason">The assigned department can record acceptance and progress updates.</p>}</div>;
}
