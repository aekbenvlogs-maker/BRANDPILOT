// ============================================================
// PROJECT      : BRANDSCALE — AI Brand Scaling Tool
// FILE         : frontend/hooks/useAnalytics.ts
// DESCRIPTION  : SWR hook for analytics summary and per-campaign data
// ============================================================
import useSWR from "swr";
import { apiFetch } from "@/utils/api";

export interface AnalyticsSummary {
  total_emails_sent: number;
  avg_open_rate: number;
  avg_click_rate: number;
  avg_conversion_rate: number;
}

export interface CampaignAnalytics {
  campaign_id: string;
  campaign_name: string;
  open_rate: number;
  click_rate: number;
  conversion_rate: number;
}

export default function useAnalytics(campaignId?: string) {
  const summaryKey = "/api/v1/analytics/summary";
  const campaignKey = campaignId ? `/api/v1/analytics/${campaignId}` : null;

  const { data: summary, isLoading: summaryLoading } = useSWR<AnalyticsSummary>(
    summaryKey,
    (url: string) => apiFetch(url),
    { refreshInterval: 60_000 },
  );

  const { data: campaignData, isLoading: campaignLoading } =
    useSWR<CampaignAnalytics>(campaignKey, (url: string) => apiFetch(url));

  return {
    summary,
    campaignData,
    isLoading: summaryLoading || campaignLoading,
  };
}
