// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/hooks/useContentGeneration.ts
// DESCRIPTION  : SWR hooks for AI text generation with task polling
// ============================================================
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { apiFetch, apiPost } from "@/utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateTextInput {
  platform: "instagram" | "tiktok" | "youtube" | "x" | "email" | "linkedin";
  brief: string;
  tone?: string;
  length?: "short" | "medium" | "long";
  project_id?: string;
}

export interface GenerationResult {
  text: string;
  hashtags: string[];
  platform: string;
  tokens_used: number;
  cost_usd: number;
}

export interface TaskStatus {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: GenerationResult;
  error?: string;
  progress?: number;
}

export interface ContentHistoryItem {
  id: string;
  platform: string;
  text: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// useGenerateText
// ---------------------------------------------------------------------------

export function useGenerateText() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollStatus = useCallback(
    async (id: string) => {
      try {
        const status = await apiFetch<TaskStatus>(
          `/api/v1/content/text/status/${id}`,
        );

        if (status.status === "completed" && status.result) {
          stopPolling();
          setResult(status.result);
          setIsGenerating(false);
          setTaskId(null);
        } else if (status.status === "failed") {
          stopPolling();
          setError(status.error ?? "Generation failed");
          setIsGenerating(false);
          setTaskId(null);
        }
      } catch (err: unknown) {
        stopPolling();
        setError(err instanceof Error ? err.message : "Polling error");
        setIsGenerating(false);
      }
    },
    [stopPolling],
  );

  const generate = useCallback(
    async (input: GenerateTextInput): Promise<void> => {
      setIsGenerating(true);
      setError(null);
      setResult(null);

      try {
        const { task_id } = await apiPost<{ task_id: string }>(
          "/api/v1/content/text/generate",
          input,
        );
        setTaskId(task_id);

        // Start polling every 2 seconds
        pollingRef.current = setInterval(() => void pollStatus(task_id), 2000);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to start generation");
        setIsGenerating(false);
      }
    },
    [pollStatus],
  );

  return { generate, isGenerating, result, error, taskId };
}

// ---------------------------------------------------------------------------
// useContentHistory
// ---------------------------------------------------------------------------

export function useContentHistory(projectId?: string) {
  const url = projectId
    ? `/api/v1/content/history?project_id=${projectId}`
    : "/api/v1/content/history";

  const { data, error, isLoading } = useSWR<ContentHistoryItem[]>(
    url,
    (u: string) => apiFetch<ContentHistoryItem[]>(u),
    { revalidateOnFocus: false },
  );

  return { history: data ?? [], isLoading, error };
}
