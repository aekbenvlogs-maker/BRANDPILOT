// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/hooks/useCampaignAgent.ts
// DESCRIPTION  : Hook encapsulating campaign creation logic via the
//                Campaign Agent API. Handles prompt submission, error
//                classification (ambiguous / server) and JWT 401 redirect.
// ============================================================
"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "@/utils/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateCampaignResponseBody {
  campaign_id: string;
  status: string;
  message?: string;
}

interface AmbiguousErrorBody {
  error: string;
  questions: string[];
}

export interface UseCampaignAgentReturn {
  /**
   * Submit a natural-language prompt to start campaign generation.
   * Resolves to the new campaign UUID string on 202 success.
   * Resolves to null when the prompt is ambiguous (clarification questions
   * are populated instead).
   */
  createCampaign: (prompt: string, projectId: string) => Promise<string | null>;
  /** True while the POST /create request is in-flight. */
  isCreating: boolean;
  /** Non-null error message when a non-ambiguous error occurred. */
  createError: string | null;
  /**
   * Non-null array of clarification questions when the server returned 400
   * with error code AMBIGUOUS_PROMPT. Display these to the user and let them
   * refine the prompt before retrying.
   */
  clarificationQuestions: string[] | null;
  /** Reset error and clarification state (e.g. when prompt input changes). */
  resetState: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Encapsulates the campaign creation API call and all derived state.
 *
 * @example
 * ```tsx
 * const { createCampaign, isCreating, createError, clarificationQuestions } =
 *   useCampaignAgent();
 *
 * const handleSubmit = async () => {
 *   const campaignId = await createCampaign(prompt, projectId);
 *   if (campaignId) router.push(`/campaigns/${campaignId}/validate`);
 * };
 * ```
 */
export function useCampaignAgent(): UseCampaignAgentReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [clarificationQuestions, setClarificationQuestions] = useState<
    string[] | null
  >(null);

  // ─── resetState ──────────────────────────────────────────────────────────

  const resetState = useCallback(() => {
    setCreateError(null);
    setClarificationQuestions(null);
  }, []);

  // ─── createCampaign ──────────────────────────────────────────────────────

  const createCampaign = useCallback(
    async (prompt: string, projectId: string): Promise<string | null> => {
      // Reset previous state on each new attempt
      setCreateError(null);
      setClarificationQuestions(null);
      setIsCreating(true);

      try {
        const body = await apiFetch<CreateCampaignResponseBody>(
          "/api/v1/campaigns/agent/create",
          {
            method: "POST",
            body: JSON.stringify({ prompt, project_id: projectId }),
          },
        );

        return body.campaign_id;
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));

        // ── 400 Ambiguous Prompt ─────────────────────────────────────────
        // apiFetch throws with the raw response text in the message when
        // status is non-2xx. We parse it to extract clarification questions.
        if (error.message.includes("400")) {
          const jsonMatch = error.message.match(/\{.*\}/s);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]) as Partial<AmbiguousErrorBody>;
              if (
                parsed.error === "AMBIGUOUS_PROMPT" &&
                Array.isArray(parsed.questions)
              ) {
                setClarificationQuestions(parsed.questions);
                return null;
              }
            } catch {
              // JSON parse failed — fall through to generic error
            }
          }
          setClarificationQuestions([
            "Quel produit ou service souhaitez-vous promouvoir ?",
            "Sur quelle(s) plateforme(s) souhaitez-vous diffuser ?",
            "Quel est votre objectif principal ?",
          ]);
          return null;
        }

        // ── 401 Unauthorized ─────────────────────────────────────────────
        // apiFetch already redirects to /login on 401; we still set the
        // error for component-level handling in case the redirect is blocked.
        if (error.message.includes("401") || error.message === "Unauthorized") {
          setCreateError("Session expirée. Redirection vers la connexion…");
          return null;
        }

        // ── 429 Rate Limit ───────────────────────────────────────────────
        if (error.message.includes("429")) {
          setCreateError(
            "Vous avez atteint la limite de 5 campagnes par heure. " +
              "Veuillez patienter avant de réessayer.",
          );
          return null;
        }

        // ── Other errors ─────────────────────────────────────────────────
        setCreateError(
          error.message ||
            "Une erreur inattendue est survenue. Veuillez réessayer.",
        );
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [],
  );

  return {
    createCampaign,
    isCreating,
    createError,
    clarificationQuestions,
    resetState,
  };
}
