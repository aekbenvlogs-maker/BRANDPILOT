// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/hooks/useContentGeneration.ts
// DESCRIPTION  : SWR hooks for AI text generation with task polling
// ============================================================
"use client";

import { useCallback, useState } from "react";
import useSWR, { type KeyedMutator } from "swr";
import { apiFetch, apiPost } from "@/utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input consumed by the UI. `brief` maps to `custom_instructions` on the backend. */
export interface GenerateTextInput {
  campaign_id: string;
  platform:    "instagram" | "tiktok" | "youtube" | "x" | "email" | "linkedin";
  brief:       string;
  tone?:       string;
  lead_id?:    string | null;
  language?:   string;
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [result,       setResult]       = useState<GenerationResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  const generate = useCallback(
    async (input: GenerateTextInput): Promise<void> => {
      setIsGenerating(true);
      setError(null);
      setResult(null);

      try {
        // ✅ URL correcte : POST /api/v1/content/generate (synchrone — retourne le texte directement)
        // ✅ Body aligné sur ContentGenerateRequest (Pydantic backend)
        // ✅ brief → custom_instructions
        // ✅ platform → content_type via mapper local
        const PLATFORM_TO_TYPE: Record<GenerateTextInput["platform"], string> = {
          instagram: "post",
          tiktok:    "post",
          youtube:   "video_script",
          x:         "post",
          linkedin:  "post",
          email:     "email",
        };

        interface ContentGenerateApiResponse {
          content_id:    string;
          body_text:     string | null;
          tokens_used:   number | null;
          cost_usd:      number | null;
          from_fallback: boolean;
        }

        const resp = await apiPost<ContentGenerateApiResponse>(
          "/api/v1/content/generate",
          {
            content_type:        PLATFORM_TO_TYPE[input.platform],
            campaign_id:         input.campaign_id,
            lead_id:             input.lead_id ?? null,
            platform:            input.platform,
            tone:                input.tone     ?? "professional",
            language:            input.language ?? "fr",
            custom_instructions: input.brief,
          },
        );

        setResult({
          text:        resp.body_text ?? "",
          hashtags:    [],
          platform:    input.platform,
          tokens_used: resp.tokens_used ?? 0,
          cost_usd:    resp.cost_usd   ?? 0,
        });
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de démarrer la génération.",
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  return { generate, isGenerating, result, error, taskId: null };
}

// ---------------------------------------------------------------------------
// useContentHistory
// ---------------------------------------------------------------------------

export function useContentHistory(campaignId: string | undefined): {
  data: ContentHistoryItem[] | null;
  history: ContentHistoryItem[];
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<ContentHistoryItem[]>;
} {
  // ✅ URL correcte : GET /api/v1/content/:campaign_id (path param)
  // ✅ SWR key = null si campaignId absent → 0 appel réseau
  const { data, error, isLoading, mutate } = useSWR<ContentHistoryItem[]>(
    campaignId ? `/api/v1/content/${campaignId}` : null,
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
