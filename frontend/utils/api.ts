// ============================================================
// PROJECT      : BRANDSCALE
// FILE         : frontend/utils/api.ts
// DESCRIPTION  : Production API client — typed errors, refresh-retry,
//                named instances per domain + backward-compat helpers
// ============================================================

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? ""; // "" → Next.js rewrites proxy

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Base typed error for all API failures.
 * `code`  — machine-readable identifier (e.g. "UNAUTHORIZED", "NETWORK_ERROR")
 * `field` — populated for 422 single-field errors
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "API_ERROR",
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Accès refusé.") {
    super(403, message, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export interface ValidationFieldError {
  field: string;
  message: string;
}

export class ValidationError extends ApiError {
  constructor(public readonly errors: ValidationFieldError[]) {
    super(422, "Données invalides.", "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class ServerError extends ApiError {
  constructor(status: number) {
    super(status, `Erreur serveur (${status}). Réessayez plus tard.`, "SERVER_ERROR");
    this.name = "ServerError";
  }
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

const TOKEN_KEY = "bs_token";
const REFRESH_KEY = "bs_refresh_token";

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** @deprecated Use utils/auth.ts setAccessToken instead */
export function setToken(token: string): void {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
}

/** @deprecated Use utils/auth.ts clearAccessToken instead */
export function clearToken(): void {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Response parser — shared between apiFetch and ApiClient
// ---------------------------------------------------------------------------

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 403) {
    const detail = await response.text().catch(() => "Accès refusé.");
    throw new ForbiddenError(detail);
  }

  if (response.status === 422) {
    const body = await response.json().catch(() => ({ detail: [] })) as {
      detail?: Array<{ loc: string[]; msg: string }>;
    };
    const errors: ValidationFieldError[] = (body.detail ?? []).map((e) => ({
      field: e.loc?.slice(-1)[0] ?? "unknown",
      message: e.msg,
    }));
    throw new ValidationError(errors);
  }

  if (response.status >= 500) {
    throw new ServerError(response.status);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "Erreur inconnue.");
    throw new ApiError(response.status, detail);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (response.status === 204 || contentType === "") {
    return undefined as unknown as T;
  }
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }
  return response.text() as unknown as T;
}

// ---------------------------------------------------------------------------
// Refresh mutex — prevents concurrent refresh storms
// ---------------------------------------------------------------------------

let _refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async (): Promise<string> => {
    const refresh =
      typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;
    if (!refresh) throw new ApiError(401, "Pas de refresh token.", "NO_REFRESH_TOKEN");

    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!res.ok) {
      throw new ApiError(401, "Refresh expiré.", "REFRESH_FAILED");
    }

    // Backend rotates refresh tokens — store both
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
    }
    return data.access_token;
  })().finally(() => {
    _refreshPromise = null;
  });

  return _refreshPromise;
}

function expireSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }
}

// ---------------------------------------------------------------------------
// ApiClient — domain-scoped, refresh-retry, strict TypeScript
// ---------------------------------------------------------------------------

export class ApiClient {
  constructor(private readonly prefix: string) {}

  // ── Internal fetch with refresh-retry ────────────────────────────────────

  private buildHeaders(
    extra?: Record<string, string>,
    isFormData = false,
  ): Record<string, string> {
    const token = readToken();
    return {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extra ?? {}),
    };
  }

  private url(path: string): string {
    if (path && !path.startsWith("/")) path = `/${path}`;
    return `${BASE_URL}${this.prefix}${path}`;
  }

  private async _fetch<T>(
    path: string,
    options: RequestInit,
    isRetry = false,
  ): Promise<T> {
    const isFormData = options.body instanceof FormData;
    const headers = this.buildHeaders(
      options.headers as Record<string, string> | undefined,
      isFormData,
    );

    let response: Response;
    try {
      response = await fetch(this.url(path), { ...options, headers });
    } catch (err) {
      throw new ApiError(
        0,
        err instanceof Error ? err.message : "Erreur réseau.",
        "NETWORK_ERROR",
      );
    }

    // 401 → try refresh once, then replay
    if (response.status === 401 && !isRetry) {
      try {
        await doRefresh();
        return this._fetch<T>(path, options, true);
      } catch {
        expireSession();
        throw new ApiError(
          401,
          "Session expirée. Veuillez vous reconnecter.",
          "UNAUTHORIZED",
        );
      }
    }

    // 401 on retry → give up
    if (response.status === 401) {
      expireSession();
      throw new ApiError(401, "Session expirée. Veuillez vous reconnecter.", "UNAUTHORIZED");
    }

    return parseResponse<T>(response);
  }

  // ── Public HTTP methods ───────────────────────────────────────────────────

  get<T = unknown>(path = "", params?: Record<string, string>): Promise<T> {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
    return this._fetch<T>(`${path}${qs}`, { method: "GET" });
  }

  post<T = unknown>(path = "", body?: unknown): Promise<T> {
    const isFormData = body instanceof FormData;
    return this._fetch<T>(path, {
      method: "POST",
      body: isFormData
        ? (body as FormData)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
    });
  }

  put<T = unknown>(path = "", body?: unknown): Promise<T> {
    return this._fetch<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T = unknown>(path = "", body?: unknown): Promise<T> {
    return this._fetch<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = unknown>(path = ""): Promise<T> {
    return this._fetch<T>(path, { method: "DELETE" });
  }
}

// ---------------------------------------------------------------------------
// Pre-configured domain instances
// ---------------------------------------------------------------------------

export const authApi      = new ApiClient("/api/v1/auth");
export const projectsApi  = new ApiClient("/api/v1/projects");
export const leadsApi     = new ApiClient("/api/v1/leads");
export const contentApi   = new ApiClient("/api/v1/content");
export const campaignsApi = new ApiClient("/api/v1/campaigns");
export const analyticsApi = new ApiClient("/api/v1/analytics");
export const scoringApi   = new ApiClient("/api/v1/scoring");

/**
 * Refresh the access token using the stored refresh token.
 * Shares the singleton mutex in api.ts — safe to call concurrently.
 * Also stores the new refresh_token from token rotation.
 * Throws ApiError on failure (caller must handle).
 */
export { doRefresh as refreshAccessToken };

// ---------------------------------------------------------------------------
// Backward-compat standalone helpers (used by 28+ existing files)
// Keep these — do NOT remove.
// ---------------------------------------------------------------------------

/**
 * Low-level fetch wrapper (no refresh-retry).
 * 401 → dispatches "auth:expired" and throws immediately.
 * New code should prefer the domain ApiClient instances above.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = readToken();
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    expireSession();
    throw new ApiError(401, "Non autorisé.", "UNAUTHORIZED");
  }

  return parseResponse<T>(response);
}

export function apiGet<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "GET" });
}

export function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T = unknown>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE" });
}
