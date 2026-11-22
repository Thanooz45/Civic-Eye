import React, { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { pretty, statusTone } from "../utils/format.js";
import { Brand } from "../components/Brand.jsx";
import { StaffMessages, StaffChatNotifier } from "../components/StaffMessages.jsx";
import { HelpChat } from "../components/HelpChat.jsx";
import { IncidentPage } from "./IncidentPage.jsx";
import { ReportForm } from "./ReportForm.jsx";
import { IssueQueue } from "./IssueQueue.jsx";
import { PreviousComplaints } from "./PreviousComplaints.jsx";
import { LiveMap } from "./LiveMap.jsx";
import { Outcomes } from "./Outcomes.jsx";
import { useToast } from "../hooks/useToast.js";

export function Workspace({ role, onExit, initialView }) {
  const [view, setView] = useState(initialView || (role === "reviewer" ? "queue" : "report"));
  const [toast, notify] = useToast();
  const [staffUnread, setStaffUnread] = useState(0);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [messagePopup, setMessagePopup] = useState(null);
  const [openChatId, setOpenChatId] = useState("");
  const [openedIncident, setOpenedIncident] = useState(null);
  const navigate = (next) => { setOpenedIncident(null); if (next === "messages") setMessagePopup(null); sessionStorage.removeItem("civic-eye-open-incident"); sessionStorage.removeItem("civic-eye-return-view"); setView(next); sessionStorage.setItem("civic-eye-view", next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openIncident = async (item) => {
    sessionStorage.setItem("civic-eye-return-view", view);
    sessionStorage.setItem("civic-eye-open-incident", item.id);
    setOpenedIncident({ ...item, detail_loading: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
    try { setOpenedIncident(await api(`/api/incidents/${encodeURIComponent(item.id)}`)); }
    catch { setOpenedIncident({ ...item, detail_loading: false }); }
  };
  const refreshIncident = async () => {
    if (!openedIncident?.id) return;
    try { setOpenedIncident(await api(`/api/incidents/${encodeURIComponent(openedIncident.id)}`)); }
    catch (error) { notify(error.message); }
  };
  const closeIncident = () => { sessionStorage.removeItem("civic-eye-open-incident"); sessionStorage.removeItem("civic-eye-return-view"); setOpenedIncident(null); };
  useEffect(() => {
    const savedId = sessionStorage.getItem("civic-eye-open-incident");
    if (savedId) openIncident({ id: savedId, detail_loading: true });
  }, []);
  const staffRole = sessionStorage.getItem("civic-eye-staff-role") || "DEPARTMENT_HEAD";
  const department = sessionStorage.getItem("civic-eye-department") || "";
  const isHead = staffRole === "DEPARTMENT_HEAD" || staffRole === "CITY_TEAM";
  const title = openedIncident ? "Complaint details" : { report: "Report an issue", queue: role === "reviewer" ? (isHead ? "Head of all departments" : `${pretty(department)} workspace`) : "Department workspace", messages: role === "reviewer" ? (isHead ? "Head of all departments · messages" : `${pretty(department)} messages`) : "Department messages", map: "Live city map", outcomes: "Public outcomes", previous: "Previous complaints" }[view];
  const section = openedIncident ? "REQUEST TRACKING" : { report: "RESIDENT SERVICES", queue: role === "reviewer" && !isHead ? pretty(department).toUpperCase() : "CITY OPERATIONS", messages: "STAFF COORDINATION", map: "LIVE INCIDENT MAP", outcomes: "PUBLIC ACCOUNTABILITY", previous: "COMMUNITY HISTORY" }[view];
  const nav = role === "reviewer" ? [["queue", "▤", isHead ? "All department issues" : pretty(department)], ["messages", "✉", "Messages"], ["map", "⌖", "Live city map"], ["previous", "◷", "Previous complaints"], ["outcomes", "↗", "Public outcomes"]] : [["report", "＋", "Report an issue"], ["previous", "◷", "Previous complaints"], ["map", "⌖", "Live city map"], ["outcomes", "↗", "Public outcomes"]];
  const goTrack = () => navigate(role === "reviewer" ? "queue" : "previous");
  const returnLabel = { queue: "department queue", map: "city map", previous: "previous complaints", report: "report form", outcomes: "public outcomes" }[sessionStorage.getItem("civic-eye-return-view") || view];
  return <div className={`app-shell ${role === "reviewer" ? "team-shell" : "resident-shell"}`}><aside className="sidebar"><Brand onClick={() => navigate(role === "reviewer" ? "queue" : "report")} light /><small className="side-label">{role === "reviewer" ? (isHead ? "HEAD OF ALL DEPARTMENTS" : pretty(department)) : "YOUR NEIGHBORHOOD"}</small><nav className="side-nav">{nav.map(([id, icon, label]) => <button key={id} className={!openedIncident && view === id ? "active" : ""} onClick={() => navigate(id)}><span>{icon}</span>{label}{id === "messages" && staffUnread > 0 && <i className="message-nav-badge">{staffUnread > 99 ? "99+" : staffUnread}</i>}</button>)}</nav><div className="sidebar-spacer"/><div className="demo-card"><i/><span><b>{role === "reviewer" ? (isHead ? "Head of all departments" : `${pretty(department)} console`) : "Community workspace"}</b><small>{role === "reviewer" ? `Signed in · ${sessionStorage.getItem("civic-eye-name") || "City team"}` : "Connected · updates every 15 seconds"}</small></span></div><button className="sidebar-home" onClick={() => role === "reviewer" ? setConfirmSignOut(true) : onExit()}>{role === "reviewer" ? "↪ Sign out" : "← Back to overview"}</button></aside>{role === "reviewer" && <StaffChatNotifier view={view} onUnread={setStaffUnread} onIncoming={setMessagePopup}/>}<main className="workspace-main"><header className="topbar"><div><small>CIVIC EYE &nbsp;/&nbsp; {section}</small><h1>{title}</h1></div><div className="topbar-right"><span className="demo-badge"><i/> LIVE DATA</span><span className="role-label">{role === "reviewer" ? (isHead ? "HEAD OF ALL DEPARTMENTS" : pretty(department)) : "RESIDENT PORTAL"}</span><button className="avatar" onClick={() => role === "reviewer" ? setConfirmSignOut(true) : onExit()} aria-label={role === "reviewer" ? "Sign out" : "Return to overview"}>{(sessionStorage.getItem("civic-eye-name") || (role === "reviewer" ? "D" : "R"))[0].toUpperCase()}</button></div></header>{openedIncident ? <IncidentPage item={openedIncident} reviewer={role === "reviewer"} notify={notify} reload={refreshIncident} onBack={closeIncident} returnLabel={returnLabel}/> : view === "report" ? <ReportForm notify={notify} onViewQueue={goTrack} /> : view === "queue" ? <IssueQueue notify={notify} onOpen={openIncident} department={department} isHead={isHead}/> : view === "messages" ? <StaffMessages isHead={isHead} department={department} notify={notify} openConversation={openChatId} onConversationOpened={() => setOpenChatId("")}/> : view === "map" ? <LiveMap onOpen={openIncident}/> : view === "previous" ? <PreviousComplaints onOpen={openIncident}/> : <Outcomes />}</main>{toast && <div className="toast" role="status">{toast}</div>}{messagePopup && <div className="incoming-message-popup" role="status"><span className="messenger-avatar">✉</span><div><b>New message · {messagePopup.person}</b><p>{messagePopup.message || "Sent an attachment"}</p></div><button type="button" onClick={() => setMessagePopup(null)} aria-label="Dismiss message notification">×</button><button type="button" onClick={() => { setOpenChatId(messagePopup.id); setMessagePopup(null); navigate("messages"); }}>Open chat</button></div>}{confirmSignOut && <div className="signout-backdrop" role="presentation" onMouseDown={(event) => {if(event.target === event.currentTarget) setConfirmSignOut(false);}}><section className="signout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="signout-title" aria-describedby="signout-description"><span className="signout-icon">↪</span><small>DEPARTMENT SESSION</small><h2 id="signout-title">Sign out of Civic Eye?</h2><p id="signout-description">You can sign back in with your department access code whenever you need to.</p><div><button type="button" className="button button-outline" onClick={() => setConfirmSignOut(false)}>Stay signed in</button><button type="button" className="button button-dark" onClick={onExit}>Sign out</button></div></section></div>}<HelpChat role={role}/></div>;
}
