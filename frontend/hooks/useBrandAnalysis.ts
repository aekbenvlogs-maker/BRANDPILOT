// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/hooks/useBrandAnalysis.ts
// DESCRIPTION  : SWR hooks for Brand Analyzer feature
// ============================================================
"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { apiFetch, apiPost } from "@/utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Competitor {
  name: string;
  url: string;
  niche: string;
  tone: string;
  strengths: string[];
}

export interface BrandAnalysis {
  id: string;
  project_id: string;
  source_url: string;
  tone: string;
  keywords: string[];
  target_audience: string;
  style_notes: string;
  primary_colors: string[];
  secondary_colors: string[];
  visual_style: string;
  visual_mood: string;
  competitors: Competitor[];
  consistency_score: number;
  created_at: string;
}

interface TaskResponse {
  task_id: string;
  status: string;
}

interface UseAnalyzeBrandReturn {
  analyze: (projectId: string, sourceUrl: string) => Promise<void>;
  isAnalyzing: boolean;
  analysis: BrandAnalysis | null;
  error: string | null;
}

interface UseBrandAnalysisReturn {
  analysis: BrandAnalysis | null;
  isLoading: boolean;
  error: unknown;
}

// ---------------------------------------------------------------------------
// Polling helper
// ---------------------------------------------------------------------------

async function pollTaskResult(taskId: string, maxWaitMs = 60_000): Promise<BrandAnalysis> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 2500));
    const result = await apiFetch<{ status: string; result?: BrandAnalysis }>(
      `/api/v1/brand-analysis/tasks/${taskId}`
    );
    if (result.status === "SUCCESS" && result.result) return result.result;
    if (result.status === "FAILURE") throw new Error("Brand analysis task failed");
  }
  throw new Error("Brand analysis timed out");
}

// ---------------------------------------------------------------------------
// useAnalyzeBrand — trigger a new analysis
// ---------------------------------------------------------------------------

export function useAnalyzeBrand(): UseAnalyzeBrandReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<BrandAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (projectId: string, sourceUrl: string) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    try {
      const task = await apiPost<TaskResponse>("/api/v1/brand-analysis/analyze", {
        project_id: projectId,
        source_url: sourceUrl,
      });
      const result = await pollTaskResult(task.task_id);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analyse échouée");
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return { analyze, isAnalyzing, analysis, error };
}

// ---------------------------------------------------------------------------
// useBrandAnalysis — fetch latest existing analysis via SWR
// ---------------------------------------------------------------------------

export function useBrandAnalysis(projectId: string | null): UseBrandAnalysisReturn {
  const { data, isLoading, error } = useSWR<BrandAnalysis>(
    projectId ? `/api/v1/brand-analysis/${projectId}/latest` : null,
    apiFetch
  );
  return { analysis: data ?? null, isLoading, error };
}
