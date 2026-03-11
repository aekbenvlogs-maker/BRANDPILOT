"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/contexts/AuthContext.tsx
// DESCRIPTION  : Global authentication context and provider
// ============================================================

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiPost } from "@/utils/api";
import {
  clearAccessToken,
  getAccessToken,
  getUserFromToken,
  isTokenExpired,
  setAccessToken,
} from "@/utils/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  onboarding_done?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  refreshToken: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ------------------------------------------------------------------
  // Refresh token helper
  // ------------------------------------------------------------------

  const refreshToken = useCallback(async (): Promise<void> => {
    const refresh = typeof window !== "undefined"
      ? localStorage.getItem("bs_refresh_token")
      : null;
    if (!refresh) throw new Error("No refresh token");

    const data = await apiPost<{ access_token: string }>(
      "/api/v1/auth/refresh",
      { refresh_token: refresh },
    );
    setAccessToken(data.access_token);
  }, []);

  // ------------------------------------------------------------------
  // Load user from API
  // ------------------------------------------------------------------

  const loadUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    if (isTokenExpired(token)) {
      try {
        await refreshToken();
      } catch {
        clearAccessToken();
        setUser(null);
        setIsLoading(false);
        return;
      }
    }

    try {
      const me = await apiFetch<AuthUser>("/api/v1/auth/me");
      setUser(me);
    } catch {
      clearAccessToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshToken]);

  // ------------------------------------------------------------------
  // Mount effect
  // ------------------------------------------------------------------

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  // ------------------------------------------------------------------
  // Listen for auth:expired events (dispatched by api.ts on 401)
  // ------------------------------------------------------------------

  useEffect(() => {
    const handler = () => {
      clearAccessToken();
      setUser(null);
      router.replace("/login");
    };
    window.addEventListener("auth:expired", handler);
    return () => window.removeEventListener("auth:expired", handler);
  }, [router]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const data = await apiPost<{
        access_token: string;
        refresh_token: string;
      }>("/api/v1/auth/login", { email, password });

      setAccessToken(data.access_token);
      localStorage.setItem("bs_refresh_token", data.refresh_token);

      // Fetch full profile — sets user with all required fields
      try {
        const me = await apiFetch<AuthUser>("/api/v1/auth/me");
        setUser(me);
      } catch {
        // /auth/me will be retried on next mount via loadUser()
      }
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      const refresh =
        typeof window !== "undefined"
          ? localStorage.getItem("bs_refresh_token")
          : null;
      await apiPost("/api/v1/auth/logout", { refresh_token: refresh ?? "" });
    } catch {
      // best-effort — clear session regardless
    } finally {
      clearAccessToken();
      localStorage.removeItem("bs_refresh_token");
      setUser(null);
      router.replace("/login");
    }
  }, [router]);

  const register = useCallback(
    async (data: RegisterData): Promise<void> => {
      const resp = await apiPost<{
        access_token: string;
        refresh_token: string;
      }>("/api/v1/auth/register", data);

      setAccessToken(resp.access_token);
      localStorage.setItem("bs_refresh_token", resp.refresh_token);

      // Fetch full profile immediately so context is populated before redirect
      try {
        const me = await apiFetch<AuthUser>("/api/v1/auth/me");
        setUser(me);
      } catch {
        // proceed with partial user — /auth/me will be retried on next mount
      }

      router.replace("/onboarding");
    },
    [router],
  );

  // ------------------------------------------------------------------
  // Context value
  // ------------------------------------------------------------------

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      logout,
      register,
      refreshToken,
    }),
    [user, isLoading, login, logout, register, refreshToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
