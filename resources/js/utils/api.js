const BASE = "/api";

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiFetch(method, path, body) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const token = getCookie("XSRF-TOKEN");
    if (token) headers["X-XSRF-TOKEN"] = token;
  }

  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!r.ok) {
    const payload = await r.json().catch(() => null);
    const err = new Error(payload?.message || `HTTP ${r.status}`);
    err.status = r.status;
    err.errors = payload?.errors;
    throw err;
  }

  return r.status === 204 ? null : r.json();
}
