// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/hooks/useSocialAnalytics.ts
// ============================================================
import useSWR from "swr";
import { apiFetch } from "@/utils/api";

// ──────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────
export type AnalyticsPlatform = "instagram" | "tiktok" | "youtube" | "x" | "linkedin";

export interface DataPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface PlatformSeries {
  platform: AnalyticsPlatform;
  data: DataPoint[];
  color: string;
}

export interface CampaignAnalytics {
  campaign_id: string;
  campaign_name: string;
  kpis: {
    total_reach: number;
    total_impressions: number;
    total_engagements: number;
    avg_engagement_rate: number;
    total_clicks: number;
    total_conversions: number;
    roi: number;
  };
  engagement_series: PlatformSeries[];
  top_posts: {
    id: string;
    platform: AnalyticsPlatform;
    text: string;
    published_at: string;
    reach: number;
    engagements: number;
    media_url?: string;
  }[];
  ai_suggestions: string[];
}

export interface GlobalSocialStats {
  project_id: string;
  period: string;
  total_followers: number;
  total_posts: number;
  avg_engagement_rate: number;
  total_reach: number;
  by_platform: Record<AnalyticsPlatform, {
    followers: number;
    posts: number;
    engagement_rate: number;
    reach: number;
  }>;
  growth_chart: DataPoint[];
  ai_insights: string[];
}

// ──────────────────────────────────────────────────────────────
// useCampaignAnalytics
// ──────────────────────────────────────────────────────────────
export function useCampaignAnalytics(campaignId: string | null) {
  const { data, isLoading, error } = useSWR<CampaignAnalytics>(
    campaignId ? `/api/v1/planner/campaigns/${campaignId}/analytics` : null,
    (url: string) => apiFetch<CampaignAnalytics>(url)
  );

  return {
    analytics: data ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
}

// ──────────────────────────────────────────────────────────────
// useGlobalSocialStats
// ──────────────────────────────────────────────────────────────
export function useGlobalSocialStats(projectId: string | null, period = "30d") {
  const { data, isLoading, error } = useSWR<GlobalSocialStats>(
    projectId ? `/api/v1/analytics/social?project_id=${projectId}&period=${period}` : null,
    (url: string) => apiFetch<GlobalSocialStats>(url)
  );

  return {
    stats: data ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
}
