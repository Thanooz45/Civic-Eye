import React, { useState } from "react";
import { api } from "../services/api.js";

export function HelpChat({ role }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([{ from: "assistant", text: "Hi! I can help you find a complaint, explain its status, or answer questions about the reporting process." }]);
  const send = async (event) => {
    event?.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    setMessages((items) => [...items, { from: "user", text }]); setQuestion(""); setBusy(true);
    try { const response = await api("/api/public/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }) }); setMessages((items) => [...items, { from: "assistant", text: response.answer }]); }
    catch (error) { setMessages((items) => [...items, { from: "assistant", text: `${error.message} You can also search the request code or department in Previous complaints.` }]); }
    finally { setBusy(false); }
  };
  return <div className={`help-chat ${open ? "open" : ""}`}><button className="help-chat-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Close Civic Eye help" : "Open Civic Eye help"}>{open ? "×" : "?"}<span>{open ? "Close" : "Civic help"}</span></button>{open && <section className="help-chat-panel" aria-label={`${role === "reviewer" ? "Department" : "Resident"} help chat`}><header><span className="help-chat-mark">C</span><div><b>Civic Eye help</b><small>Complaint guidance and lookup</small></div><button onClick={() => setOpen(false)} aria-label="Close help chat">×</button></header><div className="help-chat-messages" aria-live="polite">{messages.map((message,index)=><p className={`chat-message ${message.from}`} key={`${index}-${message.from}`}>{message.text}</p>)}{busy && <p className="chat-message assistant">Checking complaint information…</p>}</div><div className="help-chat-suggestions"><button onClick={() => {setQuestion("How do I track my complaint?");}}>How do I track a complaint?</button><button onClick={() => {setQuestion("How many open complaints are in each department?");}}>Department totals</button></div><form onSubmit={send}><input value={question} onChange={(e)=>setQuestion(e.target.value)} placeholder="Ask a question or enter a request code" maxLength={500} aria-label="Ask Civic Eye help"/><button disabled={busy || question.trim().length < 3}>Send</button></form></section>}</div>;
}
