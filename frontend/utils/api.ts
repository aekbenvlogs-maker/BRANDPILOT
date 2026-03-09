// ============================================================
// PROJECT      : BRANDSCALE — AI Brand Scaling Tool
// FILE         : frontend/utils/api.ts
// DESCRIPTION  : Typed fetch wrapper for BRANDSCALE API
// ============================================================

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/**
 * Fetch wrapper that prepends API_BASE, adds JSON headers,
 * injects the stored auth token, and throws on non-2xx.
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

  if (!response.ok) {
    const detail = await response.text().catch(() => "Unknown error");
    throw new Error(
      `[apiFetch] ${response.status} ${response.statusText}: ${detail}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }
  return response.text() as unknown as T;
}

/**
 * Store authentication token in localStorage.
 */
export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("bs_token", token);
  }
}

/**
 * Clear stored authentication token.
 */
export function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("bs_token");
  }
}
