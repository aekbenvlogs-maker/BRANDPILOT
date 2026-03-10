// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/utils/api.ts
// DESCRIPTION  : Typed fetch wrapper — production-grade, typed errors
// ============================================================

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Typed error classes
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

export interface ValidationFieldError {
  field: string;
  message: string;
}

export class ValidationError extends ApiError {
  constructor(public readonly errors: ValidationFieldError[]) {
    super(422, "Validation error");
    this.name = "ValidationError";
  }
}

export class ServerError extends ApiError {
  constructor(status: number) {
    super(status, `Server error ${status}`);
    this.name = "ServerError";
  }
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Centralised fetch wrapper.
 * - Prepends NEXT_PUBLIC_API_BASE_URL
 * - Injects Bearer token from localStorage
 * - Dispatches "auth:expired" custom event on 401
 * - Throws typed errors for 403 / 422 / 4xx / 5xx
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("bs_token") : null;

  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("bs_token");
      localStorage.removeItem("bs_refresh_token");
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    throw new ApiError(401, "Unauthorized");
  }

  if (response.status === 403) {
    const detail = await response.text().catch(() => "Forbidden");
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
    const detail = await response.text().catch(() => "Unknown error");
    throw new ApiError(response.status, detail);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }
  return response.text() as unknown as T;
}

// ---------------------------------------------------------------------------
// HTTP method helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Token helpers (kept for backwards-compatibility)
// ---------------------------------------------------------------------------

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("bs_token", token);
  }
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("bs_token");
  }
}
