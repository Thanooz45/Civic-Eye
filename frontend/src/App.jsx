import React, { useEffect, useState } from "react";
import { api } from "./services/api.js";
import { SessionProvider, useSession } from "./context/SessionContext.jsx";
import { Landing } from "./pages/Landing.jsx";
import { Access } from "./pages/Access.jsx";
import { Workspace } from "./pages/Workspace.jsx";

function AppRouter() {
  const { role, setRole, signIn, signOut } = useSession();
  const [page, setPage] = useState(() => {
    const savedRole = sessionStorage.getItem("civic-eye-role");
    return savedRole === "resident" || (savedRole === "reviewer" && sessionStorage.getItem("civic-eye-token")) ? "workspace" : "landing";
  });
  const [stats, setStats] = useState(null);
  const [workspaceView, setWorkspaceView] = useState(() => sessionStorage.getItem("civic-eye-view") || (role === "reviewer" ? "queue" : "report"));
  useEffect(() => { api("/api/public/stats").then(setStats).catch(() => {}); }, []);
  const enter = async (credentials) => {
    await signIn(credentials);
    const initial = role === "reviewer" ? "queue" : "report";
    sessionStorage.setItem("civic-eye-view", initial);
    setWorkspaceView(initial);
    setPage("workspace");
    window.scrollTo(0, 0);
  };
  const exit = () => { signOut(); setPage("landing"); window.scrollTo(0, 0); };
  const toAccess = () => { setPage("access"); window.scrollTo(0, 0); };
  if (page === "access") return <Access role={role} setRole={setRole} onEnter={enter} onBack={exit}/>;
  if (page === "workspace") return <Workspace role={role} onExit={exit} initialView={workspaceView}/>;
  return <Landing onEnter={toAccess} stats={stats}/>;
}

export default function App() {
  return <SessionProvider><AppRouter/></SessionProvider>;
}
