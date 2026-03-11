// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/hooks/useContentGeneration.ts
// DESCRIPTION  : SWR hooks for AI text generation with task polling
// ============================================================
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { type KeyedMutator } from "swr";
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

export function useGenerateText(): {
  generate: (input: GenerateTextInput) => Promise<void>;
  isGenerating: boolean;
  result: GenerationResult | null;
  error: string | null;
  taskId: string | null;
} {
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

export function useContentHistory(projectId: string | undefined): {
  data: ContentHistoryItem[] | null;
  history: ContentHistoryItem[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<ContentHistoryItem[]>;
} {
  const { data, error, isLoading, mutate } = useSWR<ContentHistoryItem[]>(
    projectId ? `/api/v1/content/history/${projectId}` : null,
    (u: string) => apiFetch<ContentHistoryItem[]>(u),
    { revalidateOnFocus: false },
  );

  return {
    data:     data ?? null,
    history:  data ?? [],
    isLoading,
    error:    error as Error | undefined,
    mutate,
  };
}

// ---------------------------------------------------------------------------
// usePolling — polls /api/v1/content/status/:taskId at `interval` ms
//              auto-stops when status reaches a terminal state
// ---------------------------------------------------------------------------

export interface PollStatusResponse {
  task_id: string;
  status: "pending" | "processing" | "done" | "completed" | "failed";
  result?: unknown;
  error?: string;
  progress?: number;
}

const TERMINAL_STATUSES = new Set(["done", "completed", "failed"]);

export function usePolling(
  taskId: string | null,
  interval = 2_000,
): {
  data: PollStatusResponse | undefined;
  status: PollStatusResponse["status"] | null;
  result: PollStatusResponse["result"];
  isLoading: boolean;
  isComplete: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<PollStatusResponse>;
} {
  const { data, error, isLoading, mutate } = useSWR<PollStatusResponse>(
    taskId ? `/api/v1/content/status/${taskId}` : null,
    (url: string) => apiFetch<PollStatusResponse>(url),
    {
      /**
       * refreshInterval as a function: SWR passes the latest cached data.
       * Return 0 once we hit a terminal status — SWR stops polling
       * without unmounting or clearing the last result.
       */
      refreshInterval: (latestData) => {
        if (!latestData) return interval;
        return TERMINAL_STATUSES.has(latestData.status) ? 0 : interval;
      },
      revalidateOnFocus: false,
      // Keep last result visible after polling stops
      keepPreviousData: true,
    },
  );

  const isComplete = data ? TERMINAL_STATUSES.has(data.status) : false;

  return {
    data,
    status:     data?.status ?? null,
    result:     data?.result,
    isLoading,
    isComplete,
    error:      error as Error | undefined,
    mutate,
  };
}
