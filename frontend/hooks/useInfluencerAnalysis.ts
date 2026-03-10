// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/hooks/useInfluencerAnalysis.ts
// ============================================================
import useSWR, { useSWRConfig } from "swr";
import { useCallback, useState } from "react";
import { apiFetch, apiPost } from "@/utils/api";

// ──────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────
export type InfluencerPlatform = "instagram" | "tiktok" | "youtube" | "x" | "linkedin";
export type ContentType = "post" | "reel" | "story" | "video" | "carousel";

export interface PriceRange {
  min: number;
  max: number;
  currency: string;
}

export interface InfluencerProfile {
  id: string;
  username: string;
  platform: InfluencerPlatform;
  display_name: string;
  avatar_url?: string;
  followers: number;
  engagement_rate: number;
  avg_views?: number;
  niche: string[];
  audience_quality_score: number; // 0–100
  authenticity_score: number; // 0–100
  best_times: string[];
  price_range: PriceRange;
  recent_posts_count: number;
  analyzed_at: string;
}

export interface PricingInput {
  platform: InfluencerPlatform;
  followers: number;
  engagement_rate: number;
  niche: string;
  content_type: ContentType;
}

export interface PricingResult {
  price_range: PriceRange;
  breakdown: { label: string; factor: number; note: string }[];
  confidence: "high" | "medium" | "low";
  benchmarks: { label: string; value: string }[];
}

interface TaskResponse {
  task_id: string;
  status: "pending" | "processing" | "done" | "error";
  result?: InfluencerProfile;
  error?: string;
}

// ──────────────────────────────────────────────────────────────
// POLL TASK
// ──────────────────────────────────────────────────────────────
async function pollInfluencerTask(taskId: string): Promise<InfluencerProfile> {
  const MAX_RETRIES = 30;
  const INTERVAL = 2000;

  for (let i = 0; i < MAX_RETRIES; i++) {
    await new Promise((r) => setTimeout(r, INTERVAL));
    const task = await apiFetch<TaskResponse>(`/api/v1/audience/influencer/tasks/${taskId}`);
    if (task.status === "done" && task.result) return task.result;
    if (task.status === "error") throw new Error(task.error ?? "Analyse échouée");
  }
  throw new Error("Timeout — l'analyse a pris trop de temps");
}

// ──────────────────────────────────────────────────────────────
// useAnalyzeInfluencer
// ──────────────────────────────────────────────────────────────
export function useAnalyzeInfluencer() {
  const { mutate: globalMutate } = useSWRConfig();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<InfluencerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (username: string, platform: InfluencerPlatform) => {
      setIsAnalyzing(true);
      setError(null);
      setResult(null);
      try {
        const task = await apiPost<TaskResponse>("/api/v1/audience/influencer/analyze", {
          username,
          platform,
        });
        const profile = await pollInfluencerTask(task.task_id);
        setResult(profile);
        await globalMutate(`/api/v1/audience/influencer/history`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inattendue");
      } finally {
        setIsAnalyzing(false);
      }
    },
    [globalMutate]
  );

  return { analyze, isAnalyzing, result, error };
}

// ──────────────────────────────────────────────────────────────
// useInfluencerHistory
// ──────────────────────────────────────────────────────────────
export function useInfluencerHistory(projectId: string | null) {
  const { data, isLoading, error } = useSWR<InfluencerProfile[]>(
    projectId ? `/api/v1/audience/influencer/history?project_id=${projectId}` : null,
    (url: string) => apiFetch<InfluencerProfile[]>(url)
  );

  return {
    history: data ?? [],
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
}

// ──────────────────────────────────────────────────────────────
// useCalculatePricing
// ──────────────────────────────────────────────────────────────
export function useCalculatePricing() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<PricingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(async (input: PricingInput) => {
    setIsCalculating(true);
    setError(null);
    try {
      const data = await apiPost<PricingResult>("/api/v1/audience/influencer/pricing", input);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de calcul");
    } finally {
      setIsCalculating(false);
    }
  }, []);

  return { calculate, isCalculating, result, error };
}
