import React, { useEffect, useState } from "react";
import { api, API_BASE } from "../services/api.js";
import { pretty } from "../utils/format.js";
import { Kpi } from "../components/Kpi.jsx";
import { IncidentMap } from "./LiveMap.jsx";

export function Outcomes() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  const refresh = async () => {
    try {
      let statsUrl = "/api/public/stats";
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      const queryStr = params.toString();
      if (queryStr) statsUrl += `?${queryStr}`;

      const [stats, incidents] = await Promise.all([
        api(statsUrl),
        api("/api/incidents"),
      ]);

      let closedItems = (incidents.items || []).filter((item) => item.status === "CLOSED");
      if (selectedCategory) {
        closedItems = closedItems.filter((item) => item.category === selectedCategory);
      }
      setData({ stats, items: closedItems });
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, [selectedCategory, fromDate, toDate]);

  const categories = [
    { value: "", label: "All Categories" },
    { value: "POTHOLE", label: "Pothole" },
    { value: "DAMAGED_ROAD", label: "Damaged Road" },
    { value: "GARBAGE", label: "Garbage" },
    { value: "WATER_LEAKAGE", label: "Water Leakage" },
    { value: "OPEN_DRAIN", label: "Open Drain" },
    { value: "OPEN_MANHOLE", label: "Open Manhole" },
    { value: "STREETLIGHT", label: "Streetlight" },
    { value: "POLLUTION", label: "Pollution (Air/Water/Noise)" },
  ];

  return (
    <section className="view outcome-view">
      <div className="view-intro">
        <div>
          <small>PUBLIC ACCOUNTABILITY DASHBOARD</small>
          <h2>Civic outcomes & fixes in the open</h2>
          <p>
            Real metrics calculated from municipal database records. Only issues verified and approved for closure by human supervisors appear as resolved.
          </p>
        </div>
        <span className="principle">Evidence first · People decide</span>
      </div>

      {/* Filter Toolbar */}
      <div style={{ margin: "14px 0", padding: "12px 16px", background: "#fff", border: "1px solid #e3e9e0", borderRadius: "8px", display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <label style={{ fontSize: "12px", fontWeight: "bold", display: "block", color: "#56655a" }}>Filter Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px" }}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: "12px", fontWeight: "bold", display: "block", color: "#56655a" }}>From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "12px", fontWeight: "bold", display: "block", color: "#56655a" }}>To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid #ccc", fontSize: "13px" }}
          />
        </div>

        {(selectedCategory || fromDate || toDate) && (
          <button
            type="button"
            className="text-button"
            style={{ alignSelf: "flex-end", paddingBottom: "6px", fontSize: "13px" }}
            onClick={() => {
              setSelectedCategory("");
              setFromDate("");
              setToDate("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Database KPI Cards */}
      {data && (
        <div className="kpi-grid outcome-stats">
          <Kpi label="COMMUNITY REPORTS" value={data.stats.total} caption="Total logged in database" />
          <Kpi label="OPEN / IN PROGRESS" value={data.stats.open} caption="Active municipal backlog" />
          <Kpi label="VERIFIED RESOLVED" value={data.stats.closed} caption="Human-approved repairs" />
          <Kpi label="OVERDUE SERVICE TARGETS" value={data.stats.overdue} caption="Open beyond SLA estimate" />
          <Kpi
            label="AVG. TIME TO RESOLVE"
            value={data.stats.avg_resolution_hours ? `${data.stats.avg_resolution_hours} hrs` : "N/A"}
            caption="Calculated from closure audit"
          />
        </div>
      )}

      {/* Category Breakdown Overview */}
      {data?.stats?.by_category && Object.keys(data.stats.by_category).length > 0 && (
        <div style={{ margin: "16px 0", padding: "14px", background: "#f8faf7", border: "1px solid #e3e9e0", borderRadius: "8px" }}>
          <small style={{ fontWeight: "bold", color: "#216c50", display: "block", marginBottom: "8px" }}>
            SERVICE VOLUME BY CATEGORY (REAL AUDIT RECORDS)
          </small>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            {Object.entries(data.stats.by_category).map(([cat, stats]) => (
              <div key={cat} style={{ background: "#fff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e5eae2" }}>
                <strong style={{ fontSize: "13px", display: "block" }}>{pretty(cat)}</strong>
                <span style={{ fontSize: "12px", color: "#607267" }}>
                  Total: <strong>{stats.total}</strong> · Open: {stats.open} · Closed: {stats.closed}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error ? (
        <div className="empty-box">Couldn’t load outcomes: {error}</div>
      ) : (
        <div className="outcome-layout">
          <div className="map-panel">
            <div className="map-head">
              <b>VERIFIED RESOLUTIONS MAP</b>
              <span>{data?.items.length || 0} CLOSED & AUDITED</span>
            </div>
            <IncidentMap items={data?.items || []} closed selectedId={selectedItem?.id} onSelect={(item) => setSelectedItem(item)} />
          </div>

          <aside className="outcome-list">
            <small>COMMUNITY VERIFICATIONS</small>
            <h3>Recent verified outcomes</h3>
            {data?.items.length ? (
              data.items.map((item) => (
                <article
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  style={{ cursor: "pointer", background: selectedItem?.id === item.id ? "#eef6f0" : undefined }}
                >
                  <small>{item.incident_code}</small>
                  <b>{item.title}</b>
                  <p>
                    {pretty(item.category)} {item.pollution_subtype ? `(${pretty(item.pollution_subtype)})` : ""} · {item.report_count} community report{item.report_count === 1 ? "" : "s"}
                  </p>
                  <span style={{ color: "#216c50", fontWeight: "600", fontSize: "12px" }}>
                    ● Human-approved closure ({pretty(item.department)})
                  </span>
                </article>
              ))
            ) : (
              <div className="empty-box">
                <h3>No verified outcomes yet</h3>
                <p>Approved resolutions matching current filters will appear here.</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Selected Incident Details Drawer */}
      {selectedItem && (
        <div style={{ marginTop: "16px", padding: "16px", background: "#fff", border: "1px solid #216c50", borderRadius: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4>Verified Outcome: {selectedItem.title} ({selectedItem.incident_code})</h4>
            <button className="text-button" onClick={() => setSelectedItem(null)}>✕ Close</button>
          </div>
          <p style={{ margin: "6px 0", fontSize: "14px" }}>{selectedItem.description}</p>
          <p style={{ margin: "4px 0", fontSize: "13px", color: "#607267" }}>
            Location: {selectedItem.city} (Approx: {Number(selectedItem.latitude).toFixed(3)}, {Number(selectedItem.longitude).toFixed(3)})
          </p>
          {selectedItem.repair_evidence?.after_description && (
            <p style={{ margin: "6px 0", fontSize: "13px", color: "#216c50" }}>
              <strong>Repair note:</strong> {selectedItem.repair_evidence.after_description}
            </p>
          )}
          {selectedItem.repair_evidence?.photos?.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <small style={{ display: "block", marginBottom: "4px" }}>After-repair photo evidence</small>
              {selectedItem.repair_evidence.photos.map((url) => (
                <img key={url} src={`${API_BASE}${url}`} alt="Verified repair" style={{ maxWidth: "200px", maxHeight: "150px", borderRadius: "6px", margin: "4px" }} />
              ))}
            </div>
          )}
        </div>
      )}

      <p className="demo-footnote">
        Map coordinates are rounded to 3 decimal places for public privacy. Tiles © OpenStreetMap contributors.
      </p>
    </section>
  );
}
