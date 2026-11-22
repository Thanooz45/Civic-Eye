import React from "react";

export function Kpi({ label, value, caption, tone = "" }) { return <article className={`kpi ${tone}`}><small>{label}</small><b>{value}</b><span>{caption}</span></article>; }
