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
  const url = projectId
    ? `/api/v1/leads?project_id=${projectId}`
    : "/api/v1/leads";

  const { data, error, isLoading, mutate } = useSWR<LeadsResponse>(
    url,
    (u: string) => apiFetch(u),
  );

  return {
    leads: data?.items,
    total: data?.total ?? 0,
    isLoading,
    isError: !!error,
    mutate,
  };
}
