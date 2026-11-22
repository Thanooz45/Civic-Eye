import React from "react";
import { pretty, statusTone } from "../utils/format.js";
import { IssueDetail } from "../components/IssueDetail.jsx";

export function IncidentPage({ item, reviewer, notify, reload, onBack, returnLabel }) {
  return <section className="view incident-page"><div className="incident-page-head"><button className="text-button" onClick={onBack}>← Back to {returnLabel}</button><span className={`status-pill ${statusTone(item.status)}`}>{pretty(item.status)}</span></div>{item.detail_loading ? <div className="loading-box">Loading complaint details…</div> : <IssueDetail item={item} reviewer={reviewer} notify={notify} reload={reload}/>}</section>;
}
