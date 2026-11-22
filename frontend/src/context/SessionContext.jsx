import React, { createContext, useContext, useState } from "react";
import { api } from "../services/api.js";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const savedRole = sessionStorage.getItem("civic-eye-role");
  const [role, setRole] = useState(() => savedRole === "reviewer" && !sessionStorage.getItem("civic-eye-token") ? "resident" : savedRole || "resident");
  const signIn = async ({ name, accessCode } = {}) => {
    if (role === "reviewer") {
      const auth = await api("/api/auth/city-team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, access_code: accessCode }) });
      sessionStorage.setItem("civic-eye-token", auth.access_token);
      sessionStorage.setItem("civic-eye-name", auth.name);
      sessionStorage.setItem("civic-eye-staff-role", auth.role);
      sessionStorage.setItem("civic-eye-department", auth.department || "");
    } else {
      for (const key of ["civic-eye-token", "civic-eye-name", "civic-eye-staff-role", "civic-eye-department"]) sessionStorage.removeItem(key);
    }
    sessionStorage.setItem("civic-eye-role", role);
  };
  const signOut = () => {
    for (const key of ["civic-eye-token", "civic-eye-name", "civic-eye-staff-role", "civic-eye-department", "civic-eye-role", "civic-eye-view"]) sessionStorage.removeItem(key);
    setRole("resident");
  };
  return <SessionContext.Provider value={{ role, setRole, signIn, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
