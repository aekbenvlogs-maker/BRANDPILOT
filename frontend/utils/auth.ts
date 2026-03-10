// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/utils/auth.ts
// DESCRIPTION  : JWT client-side helpers (no signature verification)
// ============================================================

export interface JwtPayload {
  sub: string;       // user id
  email: string;
  exp: number;       // expiry (unix timestamp)
  iat?: number;
  [key: string]: unknown;
}

export interface AuthUser {
  id: string;
  email: string;
}

const TOKEN_KEY = "bs_token";

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

/** Read the access token from localStorage. */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** Persist an access token to localStorage. */
export function setAccessToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

/** Remove the access token from localStorage. */
export function clearAccessToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// ---------------------------------------------------------------------------
// JWT decode (no signature verification — browser-side only)
// ---------------------------------------------------------------------------

/**
 * Base64url-decode a JWT segment and parse JSON.
 * Returns null on any error.
 */
function decodeSegment(segment: string): JwtPayload | null {
  try {
    // Base64url → Base64
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const json = atob(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Decode the payload of a JWT without verifying the signature.
 * Returns null if the token is malformed.
 */
export function decodeToken(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  return decodeSegment(parts[1]);
}

/**
 * Return true if the token's `exp` claim is in the past (or the token is
 * malformed).  Uses a 30-second clock-skew buffer.
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return payload.exp < nowSec - 30;
}

/**
 * Extract `{ id, email }` from the token payload.
 * Returns null if the token is malformed or missing required claims.
 */
export function getUserFromToken(token: string): AuthUser | null {
  const payload = decodeToken(token);
  if (!payload?.sub || !payload?.email) return null;
  return { id: String(payload.sub), email: String(payload.email) };
}
