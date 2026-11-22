import React, { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { pretty } from "../utils/format.js";
import { Kpi } from "../components/Kpi.jsx";
import { IncidentMap } from "./LiveMap.jsx";

export function Outcomes() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const refresh = async () => {
    try { const [stats, incidents] = await Promise.all([api("/api/public/stats"), api("/api/incidents")]); setData({ stats, items: (incidents.items || []).filter((item) => item.status === "CLOSED") }); setError(""); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 15000); return () => window.clearInterval(timer); }, []);
  return <section className="view outcome-view"><div className="view-intro"><div><small>OUTCOMES IN THE OPEN</small><h2>See what got done.</h2><p>Only issues approved for closure appear here. Changes show up automatically as the queue updates.</p></div><span className="principle">Evidence first · People decide</span></div>{data && <div className="kpi-grid outcome-stats"><Kpi label="OPEN ISSUES" value={data.stats.open} caption="Awaiting resolution"/><Kpi label="RESOLVED" value={data.stats.closed} caption="Human-reviewed outcomes"/><Kpi label="COMMUNITY REPORTS" value={data.stats.total} caption="Across the city queue"/></div>}{error ? <div className="empty-box">Couldn’t load outcomes: {error}</div> : <div className="outcome-layout"><div className="map-panel"><div className="map-head"><b>VERIFIED RESOLUTIONS</b><span>{data?.items.length || 0} CLOSED REPORTS</span></div><IncidentMap items={data?.items || []} closed/></div><aside className="outcome-list"><small>VERIFIED IN THE COMMUNITY</small><h3>Recent outcomes</h3>{data?.items.length ? data.items.map((item) => <article key={item.id}><small>{item.incident_code}</small><b>{item.title}</b><p>{pretty(item.category)} · {item.report_count} community report{item.report_count === 1 ? "" : "s"}</p><span>● Human-approved closure</span></article>) : <div className="empty-box"><h3>No verified outcomes yet</h3><p>Approved resolutions will appear here.</p></div>}</aside></div>}<p className="demo-footnote">Map markers use the issue coordinates. Tiles © OpenStreetMap contributors.</p></section>;
}
