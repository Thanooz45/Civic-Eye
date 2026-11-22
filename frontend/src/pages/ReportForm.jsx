import React, { useEffect, useRef, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { API_BASE, api } from "../services/api.js";
import { pretty, iconFor } from "../utils/format.js";
import { WorkflowPanel } from "../components/IssueDetail.jsx";

function LocationPicker({ location, onPickLocation }) {
  useMapEvents({
    click(e) {
      onPickLocation(e.latlng.lat, e.latlng.lng);
    },
  });
  return location ? (
    <CircleMarker
      center={[location.latitude, location.longitude]}
      radius={10}
      pathOptions={{ color: "#fff", weight: 2, fillColor: "#216c50", fillOpacity: 0.9 }}
    />
  ) : null;
}

export function ReportForm({ notify, onViewQueue }) {
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [videos, setVideos] = useState([]);
  const [videoPreviews, setVideoPreviews] = useState([]);
  const [audios, setAudios] = useState([]);
  const [audioPreviews, setAudioPreviews] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Pollution specific fields
  const [isPollution, setIsPollution] = useState(false);
  const [pollutionSubtype, setPollutionSubtype] = useState("AIR");
  const [pollutionTime, setPollutionTime] = useState("");
  const [pollutionOngoing, setPollutionOngoing] = useState(true);

  // Location fields
  const [city, setCity] = useState("");
  const [location, setLocation] = useState(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [locationMessage, setLocationMessage] = useState(
    "Share GPS or place a pin on the map before submitting."
  );

  const [phase, setPhase] = useState("describe");
  const [analysis, setAnalysis] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [selectedMergeId, setSelectedMergeId] = useState(null);
  const [created, setCreated] = useState(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const inputRef = useRef(null);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const audioInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    const urls = photos.map((p) => URL.createObjectURL(p));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  useEffect(() => {
    const urls = videos.map((v) => URL.createObjectURL(v));
    setVideoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [videos]);

  useEffect(() => {
    const urls = audios.map((a) => URL.createObjectURL(a));
    setAudioPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [audios]);

  const choosePhoto = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    setFormError("");
    if (!selected.length) return;
    if (selected.some((p) => !["image/jpeg", "image/png", "image/webp"].includes(p.type))) {
      return setFormError("Choose JPG, PNG, or WEBP images.");
    }
    if (photos.length + selected.length > 5) return setFormError("Choose up to 5 photos total.");
    if (
      [...photos, ...selected].some((p) => p.size > 10 * 1024 * 1024) ||
      [...photos, ...selected].reduce((sum, p) => sum + p.size, 0) > 20 * 1024 * 1024
    ) {
      return setFormError("Each photo must be under 10 MB and all photos together under 20 MB.");
    }
    setPhotos((cur) => [...cur, ...selected]);
  };

  const chooseVideos = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    setFormError("");
    if (!selected.length) return;
    if (videos.length + selected.length > 3) return setFormError("Attach up to 3 videos.");
    if (selected.some((v) => !["video/mp4", "video/webm"].includes(v.type))) {
      return setFormError("Choose MP4 or WEBM videos.");
    }
    if (
      selected.some((v) => v.size > 12 * 1024 * 1024) ||
      [...videos, ...selected].reduce((sum, v) => sum + v.size, 0) > 24 * 1024 * 1024
    ) {
      return setFormError("Each video must be under 12 MB and all videos together under 24 MB.");
    }
    setVideos((cur) => [...cur, ...selected]);
  };

  const chooseAudios = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    setFormError("");
    if (!selected.length) return;
    if (audios.length + selected.length > 2) return setFormError("Attach up to 2 audio files.");
    const allowed = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/webm", "audio/x-m4a"];
    if (selected.some((a) => !allowed.some((type) => a.type.includes(type) || a.name.match(/\.(mp3|wav|ogg|m4a|webm)$/i)))) {
      return setFormError("Choose valid audio files (MP3, WAV, OGG, M4A, or WEBM).");
    }
    if (selected.some((a) => a.size > 10 * 1024 * 1024)) {
      return setFormError("Each audio file must be under 10 MB.");
    }
    setAudios((cur) => [...cur, ...selected]);
  };

  const startAudioRecording = async () => {
    setFormError("");
    if (audios.length >= 2) return setFormError("Maximum 2 audio files allowed.");
    if (!navigator.mediaDevices?.getUserMedia) {
      return setFormError("Audio recording is not supported in this browser.");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-recording-${Date.now()}.webm`, { type: "audio/webm" });
        setAudios((cur) => [...cur, file]);
        setIsRecording(false);
        setRecordingSeconds(0);
        clearInterval(timerRef.current);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((sec) => {
          if (sec >= 59) {
            stopAudioRecording();
            return 60;
          }
          return sec + 1;
        });
      }, 1000);
    } catch (err) {
      setFormError("Microphone permission was denied or microphone is unavailable.");
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const useLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage("GPS not supported. Use manual pin placement below.");
      setShowMapPicker(true);
      return;
    }
    setLocationMessage("Waiting for GPS location permission…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setLocationMessage(`GPS located: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
        notify("GPS location added to your report.");
      },
      () => {
        setLocationMessage("GPS permission denied. Place pin manually on map.");
        setShowMapPicker(true);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleManualMapPick = (lat, lng) => {
    setLocation({ latitude: lat, longitude: lng });
    setLocationMessage(`Pin selected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    notify("Location pin set.");
  };

  const reviewReport = async (event) => {
    event.preventDefault();
    setFormError("");
    const trimmed = description.trim();
    if (!trimmed || trimmed.length < 10) {
      return notify("Add at least 10 characters describing the issue.");
    }
    setBusy(true);
    try {
      let fullDescription = trimmed;
      if (isPollution) {
        fullDescription = `[Pollution - ${pollutionSubtype}] ${trimmed}${
          pollutionTime ? ` | Occurred: ${pollutionTime}` : ""
        } | ${pollutionOngoing ? "Ongoing incident" : "Past incident"}`;
      }
      const result = await api("/api/reports/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: fullDescription, input_language: "en" }),
      });
      // Override category to POLLUTION if user explicitly checked pollution
      if (isPollution && result?.analysis) {
        result.analysis.category = "POLLUTION";
        result.analysis.pollution_subtype = pollutionSubtype;
      }
      setAnalysis(result);

      // Check for nearby duplicates if location is known
      if (location) {
        try {
          const category = isPollution ? "POLLUTION" : result.analysis.category;
          const candidateList = await api(
            `/api/reports/duplicates?category=${encodeURIComponent(category)}&latitude=${location.latitude}&longitude=${location.longitude}`
          );
          setDuplicates(candidateList || []);
        } catch {
          setDuplicates([]);
        }
      }
      setPhase("review");
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async () => {
    if (!analysis) return;
    if (!location) {
      return notify("Please share GPS or place a pin on the map so the department can find the issue.");
    }
    if (!city.trim()) {
      return notify("Add your city, street, or nearest landmark.");
    }
    setBusy(true);
    setFormError("");
    try {
      const category = isPollution ? "POLLUTION" : analysis.analysis.category;
      let finalDescription = description.trim();
      if (isPollution) {
        finalDescription = `[Pollution Subtype: ${pollutionSubtype}] ${description.trim()}${
          pollutionTime ? ` (Time: ${pollutionTime})` : ""
        } (${pollutionOngoing ? "Status: Ongoing" : "Status: Not ongoing"})`;
      }

      const payloadObj = {
        category,
        title: analysis.analysis.title || `${pretty(category)} reported`,
        description_en: finalDescription,
        latitude: location.latitude,
        longitude: location.longitude,
        city: city.trim(),
        input_language: "en",
        pollution_subtype: isPollution ? pollutionSubtype : null,
        merge_incident_id: selectedMergeId || null,
      };

      const body = new FormData();
      body.set("payload", JSON.stringify(payloadObj));
      photos.forEach((photo) => body.append("photos", photo));
      videos.forEach((video) => body.append("videos", video));
      audios.forEach((audio) => body.append("audios", audio));

      const result = await api("/api/reports/submit-with-evidence", { method: "POST", body });
      let incident = {};
      try {
        incident = await api(`/api/incidents/${encodeURIComponent(result.incident_id)}`);
      } catch {
        /* details refresh optional */
      }

      setCreated({
        ...result,
        ...incident,
        photoUrls: (result.photo_urls || []).map((url) => `${API_BASE}${url}`),
        videoUrls: (result.video_urls || []).map((url) => `${API_BASE}${url}`),
        audioUrls: (result.audio_urls || []).map((url) => `${API_BASE}${url}`),
      });
      setPhase("success");
    } catch (error) {
      const msg = error.message || "An error occurred during submission.";
      setFormError(`${msg} (Your report was NOT submitted. Please check the inputs and retry.)`);
      notify(`Submission failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setDescription("");
    setPhotos([]);
    setVideos([]);
    setAudios([]);
    setCity("");
    setLocation(null);
    setShowMapPicker(false);
    setIsPollution(false);
    setPollutionSubtype("AIR");
    setPollutionTime("");
    setPollutionOngoing(true);
    setFormError("");
    setAnalysis(null);
    setDuplicates([]);
    setSelectedMergeId(null);
    setCreated(null);
    setPhase("describe");
  };

  if (phase === "success") {
    return (
      <section className="view report-view">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <small>OFFICIAL SUBMISSION RECEIPT</small>
          <h2>Report Logged: {created?.incident_code}</h2>
          <div className="receipt-summary" style={{ margin: "16px 0", padding: "16px", background: "#f8faf7", borderRadius: "8px", border: "1px solid #e3e9e0", textAlign: "left" }}>
            <p style={{ margin: "4px 0" }}><strong>Incident Code:</strong> <code>{created?.incident_code}</code></p>
            <p style={{ margin: "4px 0" }}><strong>Category:</strong> {pretty(created?.category)} {created?.pollution_subtype && `(${pretty(created?.pollution_subtype)} Pollution)`}</p>
            <p style={{ margin: "4px 0" }}><strong>Status:</strong> <span className="status-badge" style={{ padding: "2px 8px", background: "#d9ede3", borderRadius: "4px", fontWeight: "bold" }}>{pretty(created?.status || "SUBMITTED")}</span></p>
            <p style={{ margin: "4px 0" }}><strong>Location:</strong> {created?.city} ({Number(created?.latitude || location?.latitude).toFixed(4)}, {Number(created?.longitude || location?.longitude).toFixed(4)})</p>
            <p style={{ margin: "4px 0" }}><strong>Next Steps:</strong> Your report is queued for municipal triage. An authorized officer will inspect the evidence, schedule repair, and record completion.</p>
          </div>

          {created && <WorkflowPanel item={created} />}

          {created?.photoUrls?.length > 0 && (
            <div style={{ margin: "12px 0" }}>
              <small style={{ display: "block", marginBottom: "6px" }}>Submitted Photos</small>
              {created.photoUrls.map((url) => (
                <img key={url} className="receipt-photo" src={url} alt="Photo attached to report" style={{ maxWidth: "160px", maxHeight: "120px", margin: "4px", borderRadius: "6px" }} />
              ))}
            </div>
          )}

          {created?.audioUrls?.length > 0 && (
            <div style={{ margin: "12px 0", textAlign: "left" }}>
              <small style={{ display: "block", marginBottom: "4px", color: "#56655a" }}>Citizen-Submitted Audio Evidence (Playback Verification)</small>
              {created.audioUrls.map((url, i) => (
                <audio key={url} controls src={url} style={{ display: "block", margin: "6px 0", width: "100%", maxWidth: "360px" }} />
              ))}
            </div>
          )}

          <div className="success-actions" style={{ marginTop: "24px" }}>
            <button className="button button-dark" onClick={onViewQueue}>
              Track in city queue <span>→</span>
            </button>
            <button className="button button-outline" onClick={reset}>
              Report another issue
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="view report-view">
      <div className="view-intro">
        <div>
          <small>TRANSPARENT CIVIC TRIAGE</small>
          <h2>Report a community problem</h2>
          <p>
            Report roads, pollution, water leaks, or drainage problems with photos, videos, or audio.
            The system rates seriousness and routes your report directly to the right municipal authority.
          </p>
        </div>
        <div className="privacy-note">
          <span>◎</span>
          <b>Evidence first · People decide
            <small>Audited triage. Triage decisions are made and approved by human officers.</small>
          </b>
        </div>
      </div>

      <div className="report-layout">
        <div className="step-list">
          <div className={phase === "describe" ? "step active" : "step done"}>
            <i>01</i> Describe & Evidence
          </div>
          <div className={phase === "review" ? "step active" : "step"}>
            <i>02</i> Review & Confirm
          </div>
          <div className="step">
            <i>03</i> Track Outcome
          </div>
        </div>

        <form className="report-card" onSubmit={reviewReport} noValidate>
          <div className="form-title">
            <span>↗</span>
            <div>
              <h3>Tell us what needs attention</h3>
              <p>Provide a specific description, context, and optional photo/video/audio evidence.</p>
            </div>
          </div>

          {/* Pollution category selector toggle */}
          <div style={{ margin: "12px 0 18px", padding: "12px", background: "#f1f6f1", borderRadius: "8px", border: "1px solid #dce7db" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "600" }}>
              <input
                type="checkbox"
                checked={isPollution}
                onChange={(e) => setIsPollution(e.target.checked)}
              />
              <span>This report concerns Pollution (Air, Water, Noise, or Industrial)</span>
            </label>
            {isPollution && (
              <div style={{ marginTop: "12px", paddingLeft: "24px" }}>
                <label className="field-label" htmlFor="pollution-subtype" style={{ fontSize: "13px" }}>
                  Pollution Subtype
                </label>
                <select
                  id="pollution-subtype"
                  value={pollutionSubtype}
                  onChange={(e) => setPollutionSubtype(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #ccc", marginBottom: "8px" }}
                >
                  <option value="AIR">Air Pollution (Smoke, Toxic Fumes, Dust, Odor)</option>
                  <option value="WATER">Water Pollution (Effluent, Chemical, Canal Contamination)</option>
                  <option value="NOISE">Noise Pollution (Loud Machinery, Night Works, Horns)</option>
                  <option value="OTHER">Other Environmental Pollution</option>
                </select>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
                  <div>
                    <label style={{ fontSize: "12px", color: "#56655a", display: "block" }}>When did it occur / start?</label>
                    <input
                      type="text"
                      placeholder="e.g. This morning at 8:00 AM"
                      value={pollutionTime}
                      onChange={(e) => setPollutionTime(e.target.value)}
                      style={{ width: "100%", padding: "6px 8px", fontSize: "13px", borderRadius: "4px", border: "1px solid #ccc" }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", paddingTop: "16px" }}>
                    <label style={{ fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                      <input
                        type="checkbox"
                        checked={pollutionOngoing}
                        onChange={(e) => setPollutionOngoing(e.target.checked)}
                      />
                      <span>Is this problem ongoing?</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <label className="field-label" htmlFor="issue-description">
            Describe the issue
          </label>
          <textarea
            id="issue-description"
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 1000))}
            placeholder={
              isPollution
                ? "Describe the pollution source, visible smoke/color, odor, or noise level..."
                : "For example: A deep pothole is blocking the main lane near Benz Circle..."
            }
            maxLength={1000}
            rows={4}
          />
          <div className="field-meta">
            <span>Include specifics like nearby landmarks or hazards.</span>
            <span>{description.length} / 1000</span>
          </div>

          {/* Photos Upload */}
          <div
            className={`photo-drop${photos.length ? " has-photo" : ""}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const dropped = Array.from(event.dataTransfer.files || []);
              if (dropped.length) choosePhoto({ target: { files: dropped, value: "" } });
            }}
          >
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} multiple hidden />
            <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={choosePhoto} multiple hidden />
            {photos.length ? (
              <>
                <div className="report-photo-previews">
                  {photos.map((photo, index) => (
                    <div key={`${photo.name}-${index}`}>
                      <img src={photoPreviews[index]} alt={`Selected photo ${index + 1}`} />
                      <small>{photo.name}</small>
                      <button className="remove-photo" type="button" onClick={() => setPhotos((cur) => cur.filter((_, i) => i !== index))} aria-label={`Remove ${photo.name}`}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button className="browse-link" type="button" onClick={() => inputRef.current?.click()}>
                  Add more photos
                </button>
              </>
            ) : (
              <>
                <span className="photo-plus">＋</span>
                <span className="photo-copy">
                  <b>Add photo evidence <small>(optional)</small></b>
                  <small>Up to 5 photos · JPG, PNG, WEBP · Max 10 MB each</small>
                </span>
                <span className="photo-action-group">
                  <button className="camera-link" type="button" onClick={() => cameraRef.current?.click()}>
                    Take photo
                  </button>
                  <button className="browse-link" type="button" onClick={() => inputRef.current?.click()}>
                    Browse files
                  </button>
                </span>
              </>
            )}
          </div>

          {/* Videos Upload */}
          <div className="video-upload" style={{ margin: "14px 0" }}>
            <label className="field-label" htmlFor="report-videos">
              Reference videos <small>(optional)</small>
            </label>
            <p style={{ margin: "2px 0 6px", fontSize: "13px", color: "#607267" }}>
              MP4 or WEBM · Up to 3 clips · 12 MB each
            </p>
            <input ref={videoRef} id="report-videos" type="file" accept="video/mp4,video/webm" multiple onChange={chooseVideos} />
            {videoPreviews.map((url, index) => (
              <div className="video-preview" key={`${videos[index]?.name}-${index}`}>
                <video src={url} controls playsInline preload="metadata" />
                <span>{videos[index]?.name}</span>
                <button type="button" onClick={() => setVideos((cur) => cur.filter((_, i) => i !== index))}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Audio Evidence (Recording & Upload) - No AI, Citizen Evidence */}
          <div className="audio-upload" style={{ margin: "14px 0", padding: "14px", background: "#f8faf7", border: "1px solid #dce7db", borderRadius: "8px" }}>
            <label className="field-label" style={{ display: "block", marginBottom: "4px" }}>
              Audio evidence <small>(optional · voice recording or sound file)</small>
            </label>
            <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#607267" }}>
              Citizen-submitted audio evidence. Formats: MP3, WAV, OGG, M4A, WEBM. Up to 2 files · Max 10 MB each · Max 60s recording.
              <br />
              <strong style={{ color: "#216c50" }}>Private to city staff. Not analyzed or transcribed by AI.</strong>
            </p>

            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" }}>
              {!isRecording ? (
                <button
                  type="button"
                  className="button button-outline"
                  style={{ padding: "8px 14px", fontSize: "13px" }}
                  onClick={startAudioRecording}
                >
                  🎙️ Record audio (60s max)
                </button>
              ) : (
                <button
                  type="button"
                  className="button"
                  style={{ background: "#d94a38", color: "#fff", padding: "8px 14px", fontSize: "13px" }}
                  onClick={stopAudioRecording}
                >
                  ⏹️ Stop recording ({recordingSeconds}s / 60s)
                </button>
              )}

              <input
                ref={audioInputRef}
                type="file"
                accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm"
                multiple
                hidden
                onChange={chooseAudios}
              />
              <button
                type="button"
                className="browse-link"
                style={{ fontSize: "13px" }}
                onClick={() => audioInputRef.current?.click()}
              >
                Upload audio file
              </button>
            </div>

            {audioPreviews.length > 0 && (
              <div className="audio-previews" style={{ marginTop: "8px" }}>
                {audioPreviews.map((url, index) => (
                  <div key={url} style={{ display: "flex", alignItems: "center", gap: "10px", margin: "6px 0" }}>
                    <audio controls src={url} style={{ height: "36px" }} />
                    <span style={{ fontSize: "12px", color: "#333" }}>{audios[index]?.name}</span>
                    <button
                      type="button"
                      style={{ fontSize: "12px", color: "#b94a48", background: "none", border: "none", cursor: "pointer" }}
                      onClick={() => setAudios((cur) => cur.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Location Section with GPS & Manual Fallback Map Pin */}
          <label className="field-label" htmlFor="report-city">
            City, neighborhood, or nearby landmark
          </label>
          <input
            className="report-city-input"
            id="report-city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="For example: Benz Circle, MG Road near SBI branch"
            maxLength={120}
          />

          <div className="location-row" style={{ marginTop: "10px" }}>
            <span className="location-icon">⌖</span>
            <span>
              <b>Selected Location:</b>
              <small>{locationMessage}</small>
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="location-button" type="button" onClick={useLocation}>
                Use GPS
              </button>
              <button
                type="button"
                className="button button-outline"
                style={{ padding: "8px 12px", fontSize: "13px" }}
                onClick={() => setShowMapPicker(!showMapPicker)}
              >
                {showMapPicker ? "Hide map pin" : "Place map pin manually"}
              </button>
            </div>
          </div>

          {/* Interactive manual map pin placement */}
          {showMapPicker && (
            <div style={{ margin: "12px 0", border: "1px solid #dce7db", borderRadius: "8px", overflow: "hidden" }}>
              <p style={{ margin: "6px 12px", fontSize: "12px", color: "#56655a" }}>
                Click anywhere on the map to set or adjust the problem location:
              </p>
              <div style={{ height: "240px", width: "100%" }}>
                <MapContainer
                  center={location ? [location.latitude, location.longitude] : [16.5062, 80.6480]}
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <LocationPicker location={location} onPickLocation={handleManualMapPick} />
                </MapContainer>
              </div>
              {location && (
                <div style={{ padding: "6px 12px", background: "#f8faf7", fontSize: "12px", color: "#216c50" }}>
                  Selected Coordinates: <strong>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</strong>
                </div>
              )}
            </div>
          )}

          {formError && <p className="inline-error" style={{ margin: "12px 0" }}>{formError}</p>}

          {/* Review & Triage Preview Step */}
          {phase === "review" && analysis && (
            <div className="analysis-card" style={{ marginTop: "20px" }}>
              <div className="analysis-top">
                <span>{iconFor(analysis.analysis.category)}</span>
                <div>
                  <small>PROPOSED TRIAGE & ROUTING · RULE-BASED SUGGESTION · HUMAN DECISION REQUIRED</small>
                  <h3>{analysis.analysis.title}</h3>
                </div>
              </div>
              <p>{analysis.analysis.description_en}</p>

              <div className="analysis-meta">
                <span>
                  <small>Suggested Department</small>
                  <b>{pretty(analysis.analysis.department)}</b>
                </span>
                <span>
                  <small>Priority Proposal</small>
                  <b>{pretty(analysis.severity.priority)}</b>
                </span>
                <span>
                  <small>Estimated Service Target</small>
                  <b>~{analysis.severity.sla_hours} hours (estimate)</b>
                </span>
              </div>

              {analysis.analysis.routing_rationale && (
                <p style={{ fontSize: "13px", color: "#173d31", background: "#e8f2ea", padding: "8px 12px", borderRadius: "6px", margin: "8px 0" }}>
                  <strong>Routing Rationale:</strong> {analysis.analysis.routing_rationale}
                </p>
              )}

              <p className="analysis-reason">{analysis.severity.plain_language_reason}</p>

              {/* Duplicate Detection Check */}
              {duplicates.length > 0 && (
                <div style={{ margin: "14px 0", padding: "12px", background: "#fff9e6", border: "1px solid #fae19c", borderRadius: "8px" }}>
                  <b style={{ color: "#8a6d1c" }}>Nearby existing reports found ({duplicates.length})</b>
                  <p style={{ fontSize: "12px", color: "#665115", margin: "4px 0 8px" }}>
                    Other residents have already reported similar issues nearby. You can link your report to strengthen priority, or submit a separate incident:
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <input
                        type="radio"
                        name="dupChoice"
                        checked={selectedMergeId === null}
                        onChange={() => setSelectedMergeId(null)}
                      />
                      <span><strong>Create new incident</strong> (independent record)</span>
                    </label>
                    {duplicates.map((dup) => (
                      <label key={dup.incident_id} style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <input
                          type="radio"
                          name="dupChoice"
                          checked={selectedMergeId === dup.incident_id}
                          onChange={() => setSelectedMergeId(dup.incident_id)}
                        />
                        <span>
                          <strong>Link to {dup.incident_code}</strong>: {dup.title} (~{dup.distance_m}m away)
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <p className="review-notice">{analysis.notice}</p>
              {!analysis.analysis.is_valid_civic_issue && (
                <p className="inline-warning">
                  This description needs clarification or manual review before routing.
                </p>
              )}

              <button
                className="button button-dark submit-button"
                disabled={busy}
                type="button"
                onClick={submitReport}
              >
                {busy ? "Submitting your report…" : selectedMergeId ? "Confirm and link report →" : "Confirm and submit report →"}
              </button>
              <button className="text-button" type="button" onClick={() => setPhase("describe")}>
                ← Edit description & evidence
              </button>
            </div>
          )}

          {phase === "describe" && (
            <button
              className="button button-dark submit-button"
              disabled={busy}
              type="submit"
              aria-live="polite"
            >
              {busy ? "Checking report rules…" : "Review my report →"}
            </button>
          )}

          <p className="form-footnote">
            Civic Eye is a public interest triage system. Photos and audio are attached as evidence.
            Triage suggestions are recommendations; authorized municipal teams review and act on them.
          </p>
        </form>
      </div>
    </section>
  );
}
