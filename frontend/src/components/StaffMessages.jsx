import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, api } from "../services/api.js";
import { pretty } from "../utils/format.js";

const STAFF_DEPARTMENTS = ["ROAD_MAINTENANCE", "ROADS_ENGINEERING", "MUNICIPAL_SANITATION", "WATER_SUPPLY", "DRAINAGE", "ELECTRICAL_MAINTENANCE", "GENERAL"];

async function downloadStaffFile(id, filename) {
  const token = sessionStorage.getItem("civic-eye-token");
  const response = await fetch(`${API_BASE}/api/incidents/staff-message-files/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Could not download this attachment.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ChatAttachment({ file, notify }) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file.content_type?.startsWith("image/")) return;
    let objectUrl = "";
    fetch(`${API_BASE}/api/incidents/staff-message-files/${encodeURIComponent(file.id)}`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("civic-eye-token")}` } })
      .then((response) => response.ok ? response.blob() : Promise.reject(new Error("Could not preview photo.")))
      .then((blob) => { objectUrl = URL.createObjectURL(blob); setPreview(objectUrl); })
      .catch((error) => notify(error.message));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file.id]);
  return <button type="button" className={`chat-attachment ${preview ? "image-attachment" : ""}`} onClick={() => downloadStaffFile(file.id, file.filename).catch((error) => notify(error.message))}>{preview ? <img src={preview} alt={file.filename}/> : <span>{file.content_type?.startsWith("image/") ? "▧" : "↧"}</span>}<span><b>{file.filename}</b><small>{(file.size / 1024 / 1024).toFixed(2)} MB · download</small></span></button>;
}

export function StaffMessages({ isHead, department, notify, openConversation = "", onConversationOpened }) {
  const [inbox, setInbox] = useState([]);
  const [participant, setParticipant] = useState(isHead ? "DEPARTMENT_HEAD" : department);
  const [selectedId, setSelectedId] = useState("");
  const [selectedPeer, setSelectedPeer] = useState("");
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState([]);
  const [emergency, setEmergency] = useState(false);
  const [newRecipient, setNewRecipient] = useState(isHead ? STAFF_DEPARTMENTS[0] : "DEPARTMENT_HEAD");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);
  const recipients = isHead ? STAFF_DEPARTMENTS : ["DEPARTMENT_HEAD", ...STAFF_DEPARTMENTS.filter((value) => value !== department)];
  const selectedConversation = inbox.find((item) => item.id === selectedId);

  const loadInbox = async () => {
    try {
      const result = await api("/api/incidents/staff-conversations");
      setInbox(result.items || []);
      setParticipant(result.participant || participant);

    } catch (error) { notify(error.message); }
  };
  const loadThread = async (id) => {
    if (!id) return;
    try { setThread(await api(`/api/incidents/staff-conversations/${encodeURIComponent(id)}`)); }
    catch (error) { notify(error.message); }
    loadInbox();
  };
  useEffect(() => { loadInbox(); const timer = window.setInterval(loadInbox, 7000); return () => window.clearInterval(timer); }, [isHead, department]);
  useEffect(() => {
    if (openConversation && inbox.length) {
      const item = inbox.find((conversation) => conversation.id === openConversation);
      if (item) { setSelectedId(item.id); setSelectedPeer(item.participant); onConversationOpened?.(); }
    }
  }, [openConversation, inbox]);
  useEffect(() => {
    if (!selectedId) { setThread([]); return; }
    loadThread(selectedId);
    const timer = window.setInterval(() => loadThread(selectedId), 5000);
    return () => window.clearInterval(timer);
  }, [selectedId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [thread]);

  const openNewConversation = () => { setSelectedId(""); setSelectedPeer(newRecipient); setThread([]); };
  const chooseFiles = (event) => {
    const chosen = Array.from(event.target.files || []);
    if (chosen.length + files.length > 5) notify("Attach up to five files per message.");
    else if (chosen.some((file) => file.size > 5 * 1024 * 1024)) notify("Each file must be 5 MB or smaller.");
    else setFiles((current) => [...current, ...chosen]);
    event.target.value = "";
  };
  const send = async (event) => {
    event.preventDefault();
    if (!selectedPeer || (!draft.trim() && !files.length)) return;
    setBusy(true);
    try {
      const body = new FormData(); body.append("message", draft); body.append("is_emergency", String(emergency));
      files.forEach((file) => body.append("files", file));
      const result = await api(`/api/incidents/staff-conversations/${encodeURIComponent(selectedPeer)}`, { method: "POST", body });
      setDraft(""); setFiles([]); setEmergency(false); setSelectedId(result.conversation_id);
      await loadInbox(); await loadThread(result.conversation_id);
    } catch (error) { notify(error.message); }
    finally { setBusy(false); }
  };
  const visibleInbox = inbox.filter((item) => pretty(item.participant).toLowerCase().includes(search.toLowerCase()) || item.last_message.toLowerCase().includes(search.toLowerCase()));
  const peerLabel = (value) => value === "DEPARTMENT_HEAD" ? "Department Head" : pretty(value);
  return <section className="view messenger-view">
    <div className="view-intro"><div><small>STAFF COORDINATION</small><h2>Department messages</h2><p>Private department conversations, emergency coordination, and file sharing.</p></div></div>
    <div className="messenger-shell">
      <aside className="messenger-inbox">
        <div className="messenger-inbox-head"><div><small>YOUR INBOX</small><b>Conversations</b></div><button type="button" onClick={openNewConversation} aria-label="Start a new conversation">＋</button></div>
        <label className="messenger-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations"/></label>
        <div className="messenger-conversation-list">
          {visibleInbox.map((item) => <button type="button" key={item.id} className={`messenger-conversation ${item.id === selectedId ? "active" : ""}`} onClick={() => { setSelectedId(item.id); setSelectedPeer(item.participant); }}><span className="messenger-avatar">{peerLabel(item.participant).slice(0, 1)}</span><span className="messenger-conversation-copy"><b>{peerLabel(item.participant)}</b><small>{item.urgent ? "🚨 Emergency · " : ""}{item.last_message || "Start a conversation"}</small></span><span className="messenger-conversation-meta"><time>{item.last_at ? new Date(item.last_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</time>{item.unread_count > 0 && <i>{item.unread_count > 99 ? "99+" : item.unread_count}</i>}</span></button>)}
          {!visibleInbox.length && <div className="messenger-empty">{search ? "No conversations match your search." : "No conversations yet. Start one with a department."}</div>}
        </div>
      </aside>
      <div className="messenger-chat">
        {selectedPeer ? <>
          <header className="messenger-chat-head"><span className="messenger-avatar">{peerLabel(selectedPeer).slice(0, 1)}</span><span><b>{peerLabel(selectedPeer)}</b><small>{selectedConversation?.urgent ? "Emergency coordination" : "Civic Eye staff conversation"}</small></span>{selectedConversation?.urgent && <i className="emergency-chip">URGENT</i>}</header>
          <div className="messenger-thread">
            {thread.length ? thread.map((item) => <article key={item.id} className={`chat-bubble ${item.sender_id === participant ? "mine" : "theirs"}`}><small>{item.sender_name}{item.is_emergency && <b className="urgent-label"> · EMERGENCY</b>}</small>{item.message && <p>{item.message}</p>}{item.attachments?.length > 0 && <div className="chat-attachments">{item.attachments.map((file) => <ChatAttachment key={file.id} file={file} notify={notify}/>)}</div>}<time>{new Date(item.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time></article>) : selectedId ? <div className="messenger-empty thread-empty">Loading conversation…</div> : <div className="messenger-empty thread-empty">Start a conversation with {peerLabel(selectedPeer)}.</div>}
            <div ref={bottomRef}/>
          </div>
          <form className="messenger-compose" onSubmit={send}>
            {!selectedId && <label className="messenger-recipient">To<select value={newRecipient} onChange={(event) => { setNewRecipient(event.target.value); setSelectedPeer(event.target.value); }}>{recipients.map((value) => <option key={value} value={value}>{peerLabel(value)}</option>)}</select></label>}
            {files.length > 0 && <div className="pending-files">{files.map((file, index) => <span key={`${file.name}-${index}`}>📎 {file.name}<button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`}>×</button></span>)}</div>}
            <div className="messenger-compose-row"><label className="attach-file-button" title="Attach photos or documents">＋<input type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx" onChange={chooseFiles}/></label><textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder="Write a message…" aria-label="Write a message"/><button type="submit" disabled={busy || (!draft.trim() && !files.length)}>{busy ? "Sending…" : "Send"}</button></div>
            <label className="emergency-toggle"><input type="checkbox" checked={emergency} onChange={(event) => setEmergency(event.target.checked)}/> Mark as emergency</label>
          </form>
        </> : <div className="messenger-empty messenger-welcome"><span>✉</span><h3>Your department inbox</h3><p>Select a conversation or start a new one with the department head or another department.</p><button type="button" className="button button-dark" onClick={openNewConversation}>Start a conversation</button></div>}
      </div>
    </div>
  </section>;
}

export function StaffChatNotifier({ view, onUnread, onIncoming }) {
  const previous = useRef(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await api("/api/incidents/staff-conversations");
        if (!active) return;
        const items = result.items || [];
        onUnread(items.reduce((total, item) => total + item.unread_count, 0));
        if (previous.current) {
          const old = previous.current;
          const newest = items.find((item) => item.last_message_id && item.last_message_id !== old[item.id]?.id && item.unread_count > (old[item.id]?.unread || 0));
          if (newest && view !== "messages") onIncoming({ id: newest.id, person: peerName(newest.participant), message: newest.last_message });
        }
        previous.current = Object.fromEntries(items.map((item) => [item.id, { id: item.last_message_id, unread: item.unread_count }]));
      } catch { /* Sign-out or a temporary network loss clears on the next successful refresh. */ }
    };
    refresh(); const timer = window.setInterval(refresh, 6000);
    return () => { active = false; window.clearInterval(timer); };
  }, [view]);
  return null;
}

function peerName(value) { return value === "DEPARTMENT_HEAD" ? "Department Head" : pretty(value); }
