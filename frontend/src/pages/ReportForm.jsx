import React, { useEffect, useRef, useState } from "react";
import { API_BASE, api } from "../services/api.js";
import { pretty, iconFor } from "../utils/format.js";
import { WorkflowPanel } from "../components/IssueDetail.jsx";

export function ReportForm({ notify, onViewQueue }) {
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [videos, setVideos] = useState([]);
  const [videoPreviews, setVideoPreviews] = useState([]);
  const [city, setCity] = useState("");
  const [location, setLocation] = useState(null);
  const [locationMessage, setLocationMessage] = useState("Required to route your request. Share your location before submitting.");
  const [phase, setPhase] = useState("describe");
  const [analysis, setAnalysis] = useState(null);
  const [created, setCreated] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const urls = photos.map((photo) => URL.createObjectURL(photo));
    setPhotoPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);
  useEffect(() => { const urls = videos.map((video) => URL.createObjectURL(video)); setVideoPreviews(urls); return () => urls.forEach((url) => URL.revokeObjectURL(url)); }, [videos]);

  const choosePhoto = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    setPhotoError("");
    if (!selected.length) return;
    if (selected.some((photo) => !["image/jpeg", "image/png", "image/webp"].includes(photo.type))) return setPhotoError("Choose JPG, PNG, or WEBP images.");
    if (photos.length + selected.length > 5) return setPhotoError("Choose up to 5 photos total.");
    if ([...photos, ...selected].some((photo) => photo.size > 10 * 1024 * 1024) || [...photos, ...selected].reduce((sum, photo) => sum + photo.size, 0) > 20 * 1024 * 1024) return setPhotoError("Each photo must be under 10 MB and all photos together under 20 MB.");
    setPhotos((current) => [...current, ...selected]);
  };


  const chooseVideos = (event) => {
    const selected = Array.from(event.target.files || []); event.target.value = "";
    if (videos.length + selected.length > 3) return setPhotoError("Attach up to 3 reference videos.");
    if (selected.some((video) => !["video/mp4", "video/webm"].includes(video.type))) return setPhotoError("Choose MP4 or WEBM videos.");
    if (selected.some((video) => video.size > 12 * 1024 * 1024) || [...videos, ...selected].reduce((sum, video) => sum + video.size, 0) > 24 * 1024 * 1024) return setPhotoError("Each video must be under 12 MB and all videos together under 24 MB.");
    setVideos((current) => [...current, ...selected]); setPhotoError("");
  };

  const useLocation = () => {
    if (!navigator.geolocation) { setLocationMessage("This device cannot share its location. Enable location access to submit."); return; }
    setLocationMessage("Waiting for location permission…");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocation({ latitude: coords.latitude, longitude: coords.longitude });
      setLocationMessage(`Location added · ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
      notify("Location added to your report.");
    }, () => setLocationMessage("Location permission was not granted. Enable it in your browser settings and try again."), { enableHighAccuracy: true, timeout: 15000 });
  };

  const reviewReport = async (event) => {
    event.preventDefault();
    if (!description.trim() || description.trim().length < 10) return notify("Add at least 10 characters describing the issue.");
    setBusy(true);
    try {
      const result = await api("/api/reports/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: description.trim(), input_language: "en" }) });
      setAnalysis(result);
      setPhase("review");
    } catch (error) { notify(error.message); }
    finally { setBusy(false); }
  };

  const submitReport = async () => {
    if (!analysis) return;
    if (!location) return notify("Share your location before submitting so the city team can find the issue.");
    if (!city.trim()) return notify("Add your city or neighborhood so this report can be filtered correctly.");
    setBusy(true);
    try {
      const body = new FormData(); body.set("payload", JSON.stringify({ category: analysis.analysis.category, title: analysis.analysis.title, description_en: description.trim(), latitude: location.latitude, longitude: location.longitude, city: city.trim(), input_language: "en" })); photos.forEach((photo) => body.append("photos", photo)); videos.forEach((video) => body.append("videos", video));
      const result = await api("/api/reports/submit-with-evidence", { method: "POST", body });
      let incident = {};
      try { incident = await api(`/api/incidents/${encodeURIComponent(result.incident_id)}`); } catch { /* the request receipt remains available if details refresh fails */ }
      setCreated({ ...result, ...incident, photoUrls: (result.photo_urls || []).map((url) => `${API_BASE}${url}`), videoUrls: (result.video_urls || []).map((url) => `${API_BASE}${url}`) });
      setPhase("success");
    } catch (error) { notify(`${error.message} Your report was not submitted.`); }
    finally { setBusy(false); }
  };

  const reset = () => { setDescription(""); setPhotos([]); setVideos([]); setCity(""); setPhotoError(""); setAnalysis(null); setCreated(null); setPhase("describe"); };

  if (phase === "success") return <section className="view report-view"><div className="success-card"><div className="success-icon">✓</div><small>REQUEST RECEIVED</small><h2>We’ve logged your request.</h2><p>Request <strong>{created?.incident_code}</strong> is in the city issue queue. Follow its route and status below.</p>{created && <WorkflowPanel item={created} />}{created?.photoUrls?.map((url) => <img key={url} className="receipt-photo" src={url} alt="Photo attached to your report" />)}{created?.videoUrls?.map((url) => <video key={url} className="receipt-video" src={url} controls playsInline preload="metadata" />)}<div className="success-actions"><button className="button button-dark" onClick={onViewQueue}>Open request queue <span>→</span></button><button className="button button-outline" onClick={reset}>Report another issue</button></div>{photoError && <p className="inline-error">{photoError}</p>}</div></section>;

  return <section className="view report-view"><div className="view-intro"><div><small>MAKE YOURSELF HEARD</small><h2>What needs attention?</h2><p>Share what you noticed. The more context you provide, the easier it is for a team to act.</p></div><div className="privacy-note"><span>◎</span><b>Your report matters<small>People review every recommendation before action.</small></b></div></div><div className="report-layout"><div className="step-list"><div className={phase === "describe" ? "step active" : "step done"}><i>01</i> Describe</div><div className={phase === "review" ? "step active" : "step"}><i>02</i> Review</div><div className="step"><i>03</i> Follow up</div></div><form className="report-card" onSubmit={reviewReport} noValidate><div className="form-title"><span>↗</span><div><h3>Tell us what’s going on</h3><p>Start with a short, specific description.</p></div></div><label className="field-label" htmlFor="issue-description">Describe the issue</label><textarea id="issue-description" value={description} onChange={(event) => setDescription(event.target.value.slice(0, 1000))} placeholder="For example: A deep pothole is blocking the road near Benz Circle…" maxLength={1000} aria-describedby="description-hint"/><div className="field-meta" id="description-hint"><span>Include a nearby landmark if you can.</span><span>{description.length} / 1000</span></div>
    <div className={`photo-drop${photos.length ? " has-photo" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const dropped = Array.from(event.dataTransfer.files || []); if (dropped.length) choosePhoto({ target: { files: dropped, value: "" } }); }}>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} multiple hidden /><input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={choosePhoto} multiple hidden />{photos.length ? <><div className="report-photo-previews">{photos.map((photo, index) => <div key={`${photo.name}-${index}`}><img src={photoPreviews[index]} alt={`Selected issue photo ${index + 1}`} /><small>{photo.name}</small><button className="remove-photo" type="button" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))} aria-label={`Remove ${photo.name}`}>×</button></div>)}</div><button className="browse-link" type="button" onClick={() => inputRef.current?.click()}>Add more photos</button></> : <><span className="photo-plus">＋</span><span className="photo-copy"><b>Add a photo <small>(optional)</small></b><small>Up to 5 photos · 20 MB total · JPG, PNG or WEBP</small></span><span className="photo-action-group"><button className="camera-link" type="button" onClick={() => cameraRef.current?.click()}>Take photo</button><button className="browse-link" type="button" onClick={() => inputRef.current?.click()}>Browse files</button></span></>}
    </div>{photoError && <p className="inline-error">{photoError}</p>}<div className="video-upload"><label className="field-label" htmlFor="report-videos">Reference videos <small>(optional)</small></label><p>MP4 or WEBM · up to 3 clips · 12 MB each</p><input ref={videoRef} id="report-videos" type="file" accept="video/mp4,video/webm" multiple onChange={chooseVideos}/>{videoPreviews.map((url,index)=><div className="video-preview" key={`${videos[index]?.name}-${index}`}><video src={url} controls playsInline preload="metadata"/><span>{videos[index]?.name}</span><button type="button" onClick={() => setVideos((current)=>current.filter((_,i)=>i!==index))} aria-label={`Remove ${videos[index]?.name}`}>Remove</button></div>)}</div>
    <label className="field-label" htmlFor="report-city">City or neighborhood</label><input className="report-city-input" id="report-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="For example: your city, nearby street, or landmark" maxLength={120}/><div className="location-row"><span className="location-icon">⌖</span><span><b>Where is it?</b><small>{locationMessage}</small></span><button className="location-button" type="button" onClick={useLocation}>Use my location</button></div>
    {phase === "review" && analysis && <div className="analysis-card"><div className="analysis-top"><span>{iconFor(analysis.analysis.category)}</span><div><small>ISSUE REVIEW · {pretty(analysis.provider)} · HUMAN CONFIRMATION REQUIRED</small><h3>{analysis.analysis.title}</h3></div></div><p>{analysis.analysis.description_en}</p><div className="analysis-meta"><span><small>Suggested team</small><b>{pretty(analysis.analysis.department)}</b></span><span><small>Suggested priority</small><b>{pretty(analysis.severity.priority)}</b></span></div><p className="analysis-reason">{analysis.severity.plain_language_reason}</p><p className="review-notice">{analysis.notice}</p>{!analysis.analysis.is_valid_civic_issue && <p className="inline-warning">This description needs clarification or manual review before routing.</p>}<button className="button button-dark submit-button" disabled={busy} type="button" onClick={submitReport}>{busy ? "Submitting your report…" : "Confirm and submit report →"}</button><button className="text-button" type="button" onClick={() => setPhase("describe")}>← Edit description</button></div>}
    {phase === "describe" && <button className="button button-dark submit-button" disabled={busy} type="submit" aria-live="polite">{busy ? "Reviewing your report with AI…" : "Review my report →"}</button>}
    <p className="form-footnote">Your report is added to the city issue queue. Photos are attached to the report. Add your city and location so teams can find and filter it.</p></form></div></section>;
}
