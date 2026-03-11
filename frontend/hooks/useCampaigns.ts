// ============================================================
// PROJECT      : BRANDSCALE
// FILE         : frontend/hooks/useCampaigns.ts
// ============================================================
import useSWR from "swr";
import type { KeyedMutator } from "swr";
import { apiFetch } from "@/utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// useCampaigns — list
// ---------------------------------------------------------------------------

export function useCampaigns(projectId?: string): {
  data: CampaignsResponse | null;
  campaigns: Campaign[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<CampaignsResponse>;
} {
  const url = projectId
    ? `/api/v1/campaigns?project_id=${encodeURIComponent(projectId)}`
    : "/api/v1/campaigns";

  const { data, error, isLoading, mutate } = useSWR<CampaignsResponse>(
    url,
    (u: string) => apiFetch<CampaignsResponse>(u),
    { revalidateOnFocus: true },
  );

  return {
    data:      data ?? null,
    campaigns: data?.items ?? [],
    total:     data?.total ?? 0,
    isLoading,
    isError:   !!error,
    error:     error as Error | undefined,
    mutate,
  };
}

// Default export — keeps all existing `import useCampaigns from "@/hooks/useCampaigns"` working
export default useCampaigns;

// ---------------------------------------------------------------------------
// useCampaign — single campaign by id
// ---------------------------------------------------------------------------

export function useCampaign(id: string): {
  data: Campaign | null;
  campaign: Campaign | null;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<Campaign>;
} {
  const { data, error, isLoading, mutate } = useSWR<Campaign>(
    id ? `/api/v1/campaigns/${id}` : null,
    (url: string) => apiFetch<Campaign>(url),
  );

  return {
    data:     data ?? null,
    campaign: data ?? null,
    isLoading,
    error:    error as Error | undefined,
    mutate,
  };
}
