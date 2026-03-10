// ============================================================
// PROJECT      : BRANDSCALE — AI Brand Scaling Tool
// FILE         : frontend/hooks/useLeads.ts
// DESCRIPTION  : SWR hook for leads list
// ============================================================
import useSWR from "swr";
import { apiFetch } from "@/utils/api";

export interface Lead {
  id: string;
  company: string | null;
  sector: string | null;
  score: number | null;
  score_tier: "hot" | "warm" | "cold" | null;
  opt_in: boolean;
  source: string | null;
  created_at: string;
}

interface LeadsResponse {
  items: Lead[];
  total: number;
}

export default function useLeads(projectId?: string) {
  // Don't fetch without a project_id — backend requires it
  const url = projectId ? `/api/v1/leads?project_id=${projectId}` : null;

  const { data, error, isLoading, mutate } = useSWR<LeadsResponse>(
    url,
    (u: string) => apiFetch<LeadsResponse>(u),
  );

  return {
    leads: data?.items,
    total: data?.total ?? 0,
    isLoading,
    isError: !!error,
    mutate,
  };
}
