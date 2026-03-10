// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/hooks/useSocialAccounts.ts
// DESCRIPTION  : SWR hooks for social account OAuth management
// ============================================================
"use client";

import { useCallback } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { apiFetch, apiDelete } from "@/utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SocialPlatform = "instagram" | "tiktok" | "youtube" | "x" | "linkedin";

export interface SocialAccount {
  id: string;
  project_id: string;
  platform: SocialPlatform;
  token_expires_at: string | null;
  created_at: string;
  // enriched by audience insights
  username?: string;
  followers?: number;
  engagement_rate?: number;
  last_synced_at?: string;
}

interface UseSocialAccountsReturn {
  accounts: SocialAccount[];
  isLoading: boolean;
  error: unknown;
  connectAccount: (platform: SocialPlatform) => Promise<void>;
  disconnectAccount: (accountId: string) => Promise<void>;
}

const REDIRECT_URI =
  typeof window !== "undefined"
    ? `${window.location.origin}/social/oauth/callback`
    : "";

// ---------------------------------------------------------------------------
// useSocialAccounts
// ---------------------------------------------------------------------------

export function useSocialAccounts(projectId: string | null): UseSocialAccountsReturn {
  const key = projectId ? `/api/v1/social/accounts?project_id=${projectId}` : null;
  const { data, isLoading, error } = useSWR<SocialAccount[]>(key, apiFetch);

  const connectAccount = useCallback(
    async (platform: SocialPlatform) => {
      if (!projectId) return;
      const res = await apiFetch<{ authorization_url: string }>(
        `/api/v1/social/oauth/${platform}/authorize?project_id=${projectId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
      );
      // Redirect user to OAuth provider
      window.location.href = res.authorization_url;
    },
    [projectId]
  );

  const disconnectAccount = useCallback(
    async (accountId: string) => {
      await apiDelete(`/api/v1/social/accounts/${accountId}`);
      await globalMutate(key);
    },
    [key]
  );

  return {
    accounts: data ?? [],
    isLoading,
    error,
    connectAccount,
    disconnectAccount,
  };
}
