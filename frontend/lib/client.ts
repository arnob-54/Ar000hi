// Shared REST client.
//
// Every page used to hand-roll `fetch(`${API}/…`, { headers: authHeaders() })`,
// which meant the token was read in 20+ files and a 401 was silently rendered as
// an empty list. `apiFetch` centralizes authentication, error normalization and
// session expiry while staying a thin wrapper over fetch.

import { API } from "@/lib/api";

const TOKEN_KEY = "token";
const USER_KEY = "user";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* private browsing can refuse storage; the redirect below still applies */
  }
}

export type ApiRequestInit = Omit<RequestInit, "body"> & {
  /** JSON body (serialized) or a FormData/Blob body (sent as-is). */
  body?: unknown;
  /** Set false for the few unauthenticated endpoints. Default: true. */
  auth?: boolean;
  /** Set false to inspect a 401 locally instead of being redirected. */
  redirectOn401?: boolean;
};

function normalizePath(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${API}${path.startsWith("/") ? "" : "/"}${path}`;
}

function errorDetail(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      // FastAPI validation errors: [{loc, msg, type}, …]
      const parts = detail
        .map((d) => (d && typeof d === "object" ? String((d as { msg?: unknown }).msg ?? "") : ""))
        .filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
  }
  return `Request failed (${status})`;
}

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const type = res.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    return res.json().catch(() => null);
  }
  const text = await res.text().catch(() => "");
  return text || null;
}

/**
 * Fetch a backend path (e.g. `/wallet`) or an absolute URL.
 *
 * - Injects `Authorization: Bearer <token>` when a session exists.
 * - Serializes plain object bodies as JSON, leaving FormData/Blob alone.
 * - Throws `ApiError` with the backend's `detail` for non-2xx responses.
 * - On 401 with an existing session, clears it and redirects to `/login`.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: ApiRequestInit = {}
): Promise<T> {
  const { body, auth = true, redirectOn401 = true, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);

  const token = getToken();
  if (auth && token && !finalHeaders.has("Authorization")) {
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const isFormBody =
    typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormBody && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  const res = await fetch(normalizePath(path), {
    ...rest,
    headers: finalHeaders,
    body:
      body === undefined
        ? undefined
        : isFormBody || body instanceof Blob
          ? (body as BodyInit)
          : JSON.stringify(body),
  });

  const payload = await readBody(res);

  if (!res.ok) {
    if (res.status === 401 && redirectOn401 && token) {
      clearSession();
      if (typeof window !== "undefined") window.location.assign("/login");
    }
    throw new ApiError(res.status, errorDetail(payload, res.status));
  }

  return payload as T;
}
