"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/hooks/useAuth.ts
// DESCRIPTION  : Auth hook + withAuth HOC
// ============================================================

import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "@/contexts/AuthContext";

/**
 * Returns the current authentication context value.
 * Throws if called outside of <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

export default useAuth;
