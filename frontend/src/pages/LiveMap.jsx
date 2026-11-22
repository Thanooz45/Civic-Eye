import React, { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../services/api.js";
import { pretty, iconFor } from "../utils/format.js";

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => window.cancelAnimationFrame(frame);
  }, [map]);
  return null;
}

function coordinatesFor(item) {
  const { latitude, longitude } = item;
  if (latitude === null || latitude === undefined || latitude === "" || longitude === null || longitude === undefined || longitude === "") return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

function FitMapToIncidents({ items }) {
  const map = useMap();
  const fitted = useRef("");
  const signature = items.map((item) => `${item.id || item.incident_code}:${item.latitude}:${item.longitude}`).join("|");
  useEffect(() => {
    if (!signature || signature === fitted.current) return;
    fitted.current = signature;
    const points = items.map(coordinatesFor).filter(Boolean);
    if (points.length === 1) map.setView(points[0], 13);
    else if (points.length > 1) map.fitBounds(points, { padding: [32, 32], maxZoom: 13 });
  }, [items, map, signature]);
  return null;
}

export function IncidentMap({ items, closed = false, selectedId, onSelect }) {
  return <MapContainer center={[20.5937, 78.9629]} zoom={5} scrollWheelZoom className="leaflet-map">
    <MapResizer />
    <FitMapToIncidents items={items}/>
    <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' />
    {items.filter((item) => coordinatesFor(item)).map((item) => {
      const color = closed ? "#3a9b72" : item.priority === "CRITICAL" || item.priority === "HIGH" ? "#ed785f" : item.priority === "MEDIUM" ? "#e9b75b" : "#48a985";
      return <CircleMarker key={item.id || item.incident_code} center={coordinatesFor(item)} radius={selectedId === item.id ? 11 : 8} pathOptions={{ color: "#fff", weight: 2, fillColor: color, fillOpacity: .95 }} eventHandlers={{ click: () => onSelect?.(item) }}>
        <Popup><div className="map-popup"><small>{item.incident_code} · {pretty(item.priority)}</small><b>{item.title}</b><span>{pretty(item.status)} · {pretty(item.category)}</span>{item.report_count && <span>{item.report_count} community report{item.report_count === 1 ? "" : "s"}</span>}</div></Popup>
      </CircleMarker>;
    })}
  </MapContainer>;
}

export function LiveMap({ onOpen }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = async (quiet = false) => {
    try { const result = await api("/api/incidents"); setItems(result.items || []); setError(""); setUpdatedAt(new Date()); }
    catch (e) { setError(e.message); }
    finally { if (!quiet) setLoading(false); }
  };
  useEffect(() => { refresh(); const timer = window.setInterval(() => refresh(true), 15000); return () => window.clearInterval(timer); }, []);
  const statuses = [...new Set(items.filter((item) => item.status !== "CLOSED").map((item) => item.status))].sort();
  const visible = items.filter((item) => item.status !== "CLOSED" && (!status || item.status === status));
  return <section className="view map-view"><div className="view-intro"><div><small>INCIDENTS ON THE GROUND</small><h2>See your city, issue by issue.</h2><p>Pan and zoom the street map. Select a marker to see its current report details.</p></div><div className="map-live-status"><i/> AUTO-REFRESH · 15 SEC <span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting…"}</span></div></div><div className="map-controls"><label>Show reports<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{pretty(s)}</option>)}</select></label><span><i className="legend-dot urgent"/>High priority <i className="legend-dot medium"/>Medium <i className="legend-dot normal"/>Other</span><button onClick={() => refresh()} aria-label="Refresh map reports">↻ Refresh</button></div><div className="live-map-layout"><div className="live-map-frame"><IncidentMap items={visible} selectedId={selected?.id} onSelect={setSelected}/><div className="map-counter"><b>{visible.length}</b> {visible.length === 1 ? "issue" : "issues"} shown</div></div><aside className="map-side-panel"><div className="map-side-head"><small>COMMUNITY SIGNAL</small><h3>{selected ? "Selected issue" : "Reported nearby"}</h3><p>{selected ? "Issue details from the live report queue." : `${visible.length} issue${visible.length === 1 ? "" : "s"} in the current view`}</p></div>{error && <div className="inline-error">Could not refresh reports: {error}</div>}{loading ? <div className="loading-box">Loading map reports…</div> : selected ? <div className="map-selected"><span className={`map-priority ${selected.priority}`}>{pretty(selected.priority)}</span><h4>{selected.title}</h4><p>{selected.description}</p><dl><div><dt>Status</dt><dd>{pretty(selected.status)}</dd></div><div><dt>Department</dt><dd>{pretty(selected.department)}</dd></div><div><dt>Community reports</dt><dd>{selected.report_count}</dd></div><div><dt>Location</dt><dd>{Number(selected.latitude).toFixed(4)}, {Number(selected.longitude).toFixed(4)}</dd></div></dl><button className="button button-dark" onClick={() => onOpen(selected)}>Open full complaint details →</button><button className="text-button" onClick={() => setSelected(null)}>Show all issues</button></div> : visible.slice(0, 20).map((item) => <button className="map-list-row" key={item.id} onClick={() => setSelected(item)}><i style={{ background: item.priority === "CRITICAL" || item.priority === "HIGH" ? "#ed785f" : item.priority === "MEDIUM" ? "#e9b75b" : "#48a985" }}/><span><b>{item.title}</b><small>{item.incident_code} · {pretty(item.status)}</small></span><span>↗</span></button>)}{!loading && !visible.length && !error && <div className="empty-box"><h3>No reports in this filter</h3><p>Choose another status or report an issue.</p></div>}<div className="map-source-note">Map tiles © OpenStreetMap contributors. Markers use the coordinates attached to each report.</div></aside></div>{error && !items.length && <div className="map-connection-warning">The map is available, but incident data is not connected yet. {error}</div>}</section>;
}
