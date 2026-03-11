// ============================================================
// PROJECT      : BRANDSCALE
// FILE         : frontend/hooks/useAnalytics.ts
// ============================================================
import useSWR, { type KeyedMutator } from "swr";
import { apiFetch } from "@/utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityItem {
  id: string;
  type: string;
  label: string;
  created_at: string;
}

export interface AnalyticsSummary {
  // Core email metrics
  total_emails_sent: number;
  avg_open_rate: number;
  avg_ctr: number;
  total_conversions: number;
  total_ai_cost_usd: number;
  // Counts
  active_campaigns: number;
  total_leads: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  // Optional period info
  period_start?: string | null;
  period_end?: string | null;
  // Optional — future backend fields for month-over-month deltas (%)
  delta_leads?: number;
  delta_content?: number;
  delta_campaigns?: number;
  delta_conversion?: number;
  // Optional — content count + recent activity feed
  content_generated?: number;
  recent_activity?: ActivityItem[];
}

// Re-exported alias so consumers can use the more descriptive name
export type DashboardStats = AnalyticsSummary;

// ---------------------------------------------------------------------------
// useDashboardStats — GET /api/v1/analytics/summary
// ---------------------------------------------------------------------------

export function useDashboardStats(): {
  data: DashboardStats | null;
  stats: DashboardStats | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<DashboardStats>;
} {
  const { data, isLoading, error, mutate } = useSWR<DashboardStats>(
    "/api/v1/analytics/summary",
    (url: string) => apiFetch<DashboardStats>(url),
    { revalidateOnFocus: true, refreshInterval: 60_000 },
  );

  return {
    data:     data ?? null,
    stats:    data ?? null,
    isLoading,
    error:    error as Error | undefined,
    mutate,
  };
}

export interface CampaignAnalytics {
  campaign_id: string;
  campaign_name: string;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
}

export function useAnalytics(campaignId?: string): {
  data: AnalyticsSummary | null;
  summary: AnalyticsSummary | undefined;
  campaignData: CampaignAnalytics | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<AnalyticsSummary>;
} {
  const summaryKey = "/api/v1/analytics/summary";
  const campaignKey = campaignId
    ? `/api/v1/analytics/campaigns/${campaignId}/email-stats`
    : null;

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    mutate,
  } = useSWR<AnalyticsSummary, Error>(
    summaryKey,
    (url: string) => apiFetch<AnalyticsSummary>(url),
    { refreshInterval: 60_000 },
  );

  const { data: campaignData, isLoading: campaignLoading } =
    useSWR<CampaignAnalytics>(campaignKey, (url: string) => apiFetch<CampaignAnalytics>(url));

  return {
    data:      summary ?? null,
    summary,
    campaignData,
    isLoading: summaryLoading || campaignLoading,
    error:     summaryError,
    mutate,
  };
}

export default useAnalytics;
