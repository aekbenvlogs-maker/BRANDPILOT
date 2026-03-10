// ============================================================
// PROJECT      : BRANDSCALE — AI Brand Scaling Tool
// FILE         : frontend/hooks/useCampaigns.ts
// DESCRIPTION  : SWR hook for campaigns list
// ============================================================
import useSWR from "swr";
import { apiFetch } from "@/utils/api";

export interface Campaign {
  id: string;
  name: string;
  status: string;
  channel: string;
  launched_at: string | null;
  created_at: string;
}

interface CampaignsResponse {
  items: Campaign[];
  total: number;
}

export default function useCampaigns(projectId?: string) {
  // Don't fetch without a project_id — backend requires it
  const url = projectId ? `/api/v1/campaigns?project_id=${projectId}` : null;

  const { data, error, isLoading, mutate } = useSWR<CampaignsResponse>(
    url,
    (u: string) => apiFetch<CampaignsResponse>(u),
  );

  return {
    campaigns: data?.items,
    total: data?.total ?? 0,
    isLoading,
    isError: !!error,
    mutate,
  };
}
