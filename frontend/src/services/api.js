// Vercel environment values are often pasted with a trailing slash. API paths
// below begin with `/`, so normalize the base to prevent requests like `//api`.
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

async function api(path, options = {}) {
  let response;
  const headers = new Headers(options.headers || {});
  const token = sessionStorage.getItem("civic-eye-token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  try { response = await fetch(`${API_BASE}${path}`, { ...options, headers }); }
  catch { throw new Error("Civic Eye could not reach the backend. Start the backend and check its MongoDB connection, then try again."); }
  const type = response.headers.get("content-type") || "";
  const body = await response.text();
  let result = {};
  if (body && type.includes("application/json")) { try { result = JSON.parse(body); } catch { /* show the status below */ } }
  if (!response.ok) {
    const detail = result.detail;
    const message = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((entry) => entry.msg).filter(Boolean).join(". ") : "";
    throw new Error(message || `The request failed (${response.status}). Check the backend and try again.`);
  }
  return result;
}

export { API_BASE, api };
