import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";
import { pretty, iconFor, statusTone } from "../utils/format.js";
import { Kpi } from "../components/Kpi.jsx";
import { IssueDetail } from "../components/IssueDetail.jsx";

export function IssueQueue({ notify, onOpen, department = "", isHead = false }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const load = async (quiet = false) => {
    if (!quiet) setLoading(true); setError("");
    try {
      const result = await api("/api/incidents");
      setItems(result.items || []);
      setStats({ open: (result.items || []).filter((i) => i.status !== "CLOSED").length, critical: (result.items || []).filter((i) => ["HIGH", "CRITICAL"].includes(i.priority) && i.status !== "CLOSED").length, progress: (result.items || []).filter((i) => ["ASSIGNED", "IN_PROGRESS", "REPAIR_SUBMITTED"].includes(i.status)).length, closed: (result.items || []).filter((i) => i.status === "CLOSED").length });
    } catch (e) { setError(e.message); }
    finally { if (!quiet) setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { const interval = window.setInterval(() => load(true), 15000); return () => window.clearInterval(interval); }, []);
  const visible = useMemo(() => items.filter((item) => (!status || item.status === status) && (!query || [item.incident_code, item.title, item.description, item.category, item.department, item.pollution_subtype].some((value) => String(value || "").toLowerCase().includes(query.toLowerCase())))), [items, status, query]);
  const openIssue = (item) => { setSelected(item); onOpen(item); };
  const filteredStatuses = [...new Set(items.map((item) => item.status))].sort();
  const departmentStats = Object.entries(items.reduce((totals, item) => { const name = item.department || "Unassigned"; totals[name] ||= { total: 0, open: 0, community: 0 }; totals[name].total += 1; totals[name].community += Number(item.report_count || 1); if (item.status !== "CLOSED") totals[name].open += 1; return totals; }, {})).sort((a, b) => b[1].open - a[1].open);
  const reviewer = sessionStorage.getItem("civic-eye-role") === "reviewer";
  const refreshSelected = async () => {
    await load();
    if (selected?.id) {
      try { setSelected(await api(`/api/incidents/${encodeURIComponent(selected.id)}`)); }
      catch { /* retain the current issue detail if refresh fails */ }
    }
  };
  return <section className="view queue-view"><div className="view-intro"><div><small>{isHead ? "CITYWIDE ISSUE OVERVIEW" : `${pretty(department).toUpperCase()} · TEAM WORKQUEUE`}</small><h2>{isHead ? "Issues across every department" : `${pretty(department)} issue queue`}</h2><p>{isHead ? "A citywide view of reports and team follow-through." : `Reports routed to ${pretty(department)}, ready for review and follow-through.`}</p></div><div className="queue-live"><i/> LIVE QUEUE <button onClick={refreshSelected} aria-label="Refresh issue queue">↻</button></div></div>{stats && <div className="kpi-grid"><Kpi label="OPEN ISSUES" value={stats.open} caption="Awaiting resolution"/><Kpi label="HIGH PRIORITY" value={stats.critical} caption="Needs closer attention" tone="red"/><Kpi label="IN PROGRESS" value={stats.progress} caption="Being worked on" tone="amber"/><Kpi label="CLOSED" value={stats.closed} caption="Human-reviewed closures" tone="green"/></div>}<div className="queue-layout"><div className="queue-card"><div className="queue-head"><div><small>{isHead ? "REPORTS FROM THE COMMUNITY" : `${pretty(department).toUpperCase()} · COMMUNITY REPORTS`}</small><h3>{isHead ? "All reported issues" : `${pretty(department)} reports`}</h3></div><div className="queue-tools"><input type="search" aria-label="Search reports" placeholder="Search reports" value={query} onChange={(e) => setQuery(e.target.value)}/><select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{filteredStatuses.map((s) => <option key={s} value={s}>{pretty(s)}</option>)}</select></div></div><div className="issue-list">{loading ? <div className="loading-box">Loading community reports…</div> : error ? <div className="empty-box"><h3>Couldn’t load the issue queue</h3><p>{error}. Check that MongoDB and the backend are running.</p><button className="text-button" onClick={load}>Try again</button></div> : visible.length ? visible.map((item) => <button className={`issue-row ${selected?.id === item.id ? "selected" : ""}`} key={item.id} onClick={() => openIssue(item)}><span className="category-icon">{iconFor(item.category)}</span><span className="issue-copy"><b>{item.incident_code} · {item.title}</b><small>{item.description || pretty(item.category)}</small><small className="issue-extra">{pretty(item.department)} · {item.report_count} {item.report_count === 1 ? "report" : "reports"}</small></span><span className="issue-badges"><i className={`priority ${item.priority}`}>{pretty(item.priority)}</i><i className={`status ${statusTone(item.status)}`}>{pretty(item.status)}</i></span></button>) : <div className="empty-box"><h3>No matching reports</h3><p>Try a different search or status filter.</p></div>}</div></div><aside className="issue-detail">{selected ? <IssueDetail item={selected} reviewer={reviewer} notify={notify} reload={refreshSelected} /> : <div className="empty-box detail-empty"><span>▤</span><h3>Every issue has a story</h3><p>Select a report to see its status, location, priority and recent activity.</p></div>}</aside></div>{isHead && <section className="department-load"><header><div><small>TEAM WORKLOAD</small><h3>Open requests by department</h3></div><span>Live assignments</span></header><div>{departmentStats.map(([name, count]) => <article key={name}><span>{pretty(name)}</span><b>{count.open} open</b><small>{count.total} issues · {count.community} community complaints</small></article>)}</div></section>}<p className="demo-footnote">{isHead ? "Reports and status updates are shared across the city issue queue." : `${pretty(department)} reports and status updates stay connected to this team queue.`}</p></section>;
}
