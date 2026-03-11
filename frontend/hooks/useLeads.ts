// ============================================================
// PROJECT      : BRANDSCALE
// FILE         : frontend/hooks/useLeads.ts
// ============================================================
import useSWR from "swr";
import type { KeyedMutator } from "swr";
import { apiFetch } from "@/utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

export interface LeadsFilters {
  /** Filter by project (maps to ?project_id=) */
  project_id?: string;
  /** Filter by score tier */
  tier?: "hot" | "warm" | "cold";
  /** 1-based page number */
  page?: number;
  page_size?: number;
}

interface LeadsResponse {
  items: Lead[];
  total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the SWR key URL.
 * Accepts either the new LeadsFilters object or a legacy string (project_id).
 */
function buildLeadsUrl(filters?: LeadsFilters | string): string {
  if (filters === undefined || filters === null) return "/api/v1/leads";

  // Legacy call: useLeads(projectId: string)
  if (typeof filters === "string") {
    return filters
      ? `/api/v1/leads?project_id=${encodeURIComponent(filters)}`
      : "/api/v1/leads";
  }

  const params = new URLSearchParams();
  if (filters.project_id) params.set("project_id", filters.project_id);
  if (filters.tier)       params.set("score_tier",  filters.tier);
  if (filters.page != null)      params.set("page",      String(filters.page));
  if (filters.page_size != null) params.set("page_size", String(filters.page_size));

  const qs = params.toString();
  return qs ? `/api/v1/leads?${qs}` : "/api/v1/leads";
}

// ---------------------------------------------------------------------------
// useLeads — paginated list with optional filters
// ---------------------------------------------------------------------------

export function useLeads(
  /** Accepts a LeadsFilters object OR a legacy project_id string */
  filtersOrProjectId?: LeadsFilters | string,
): {
  leads: Lead[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<LeadsResponse>;
} {
  const url = buildLeadsUrl(filtersOrProjectId);

  const { data, error, isLoading, mutate } = useSWR<LeadsResponse>(
    url,
    (u: string) => apiFetch<LeadsResponse>(u),
    { revalidateOnFocus: true },
  );

  return {
    leads:    data?.items ?? [],
    total:    data?.total ?? 0,
    isLoading,
    isError:  !!error,
    error:    error as Error | undefined,
    mutate,
  };
}

// Default export — keeps all existing `import useLeads from "@/hooks/useLeads"` working
export default useLeads;

// ---------------------------------------------------------------------------
// useLead — single lead by id
// ---------------------------------------------------------------------------

export function useLead(id: string) {
  const { data, error, isLoading, mutate } = useSWR<Lead>(
    id ? `/api/v1/leads/${id}` : null,
    (url: string) => apiFetch<Lead>(url),
  );

  return { lead: data ?? null, isLoading, error: error as Error | undefined, mutate };
}
