// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/hooks/useAudienceInsights.ts
// ============================================================
"use client";

import { useCallback, useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { apiFetch, apiPost } from "@/utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeSlot {
  day: string;
  window_start: string;
  window_end: string;
  score: number;
}

export interface BestTimesData {
  platform: string;
  top_times: TimeSlot[];
  heatmap: Record<string, Record<string, number>>;
  confidence: "high" | "medium" | "low";
  note: string;
}

export interface AudienceInsights {
  social_account_id: string;
  platform: string;
  stats: {
    followers: number;
    following: number;
    posts_count: number;
    avg_likes: number;
    avg_comments: number;
    avg_views: number;
    engagement_rate: number;
    growth_rate?: number;
    avg_reach?: number;
  };
  engagement_rate: number;
  engagement_tier: "excellent" | "good" | "low";
  price_estimate: {
    min_price: number;
    max_price: number;
    currency: string;
    breakdown: Record<string, number>;
  };
  best_times: BestTimesData;
  confidence: string;
}

interface UseAudienceInsightsReturn {
  insights: AudienceInsights | null;
  isLoading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
  lastUpdated: Date | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAudienceInsights(accountId: string | null): UseAudienceInsightsReturn {
  const key = accountId
    ? `/api/v1/audience-insights/accounts/${accountId}/latest`
    : null;

  const { data, isLoading, error } = useSWR<AudienceInsights>(key, apiFetch);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastUpdatedRef = useRef<Date | null>(null);

  // Update lastUpdated whenever data changes
  if (data && !lastUpdatedRef.current) {
    lastUpdatedRef.current = new Date();
  }

  const refresh = useCallback(async () => {
    if (!accountId) return;
    setIsRefreshing(true);
    try {
      const task = await apiPost<{ task_id: string }>(
        "/api/v1/audience-insights/accounts/analyze",
        { social_account_id: accountId }
      );
      // Poll for result then revalidate
      await pollTask(task.task_id);
      lastUpdatedRef.current = new Date();
      await globalMutate(key);
    } finally {
      setIsRefreshing(false);
    }
  }, [accountId, key]);

  return {
    insights: data ?? null,
    isLoading,
    error,
    refresh,
    isRefreshing,
    lastUpdated: lastUpdatedRef.current,
  };
}

async function pollTask(taskId: string, maxMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await apiFetch<{ status: string }>(
      `/api/v1/audience-insights/tasks/${taskId}`
    );
    if (res.status === "SUCCESS") return;
    if (res.status === "FAILURE") throw new Error("Audience analysis failed");
  }
  throw new Error("Audience analysis timed out");
}
