// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/hooks/useCampaignValidation.ts
// DESCRIPTION  : SWR-based hook for the Campaign Agent validation flow.
//                Handles status polling, HITL approval, post editing,
//                regeneration and cancellation.
// ============================================================
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { apiFetch } from "@/utils/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SocialPost {
  id: string;
  platform: string;
  content_text: string;
  media_urls: string[];
  hashtags: string[];
  scheduled_at: string;
  status: string;
}

export interface CampaignStatusResponse {
  campaign_id: string;
  agent_status: string;
  current_step: string | null;
  created_at: string | null;
}

export interface CampaignPreviewResponse {
  campaign_id: string;
  agent_status: string;
  posts: SocialPost[];
  total_posts: number;
}

export interface UseCampaignValidationReturn {
  /** Lifecycle status from the backend WorkflowJob (e.g. "pending_validation"). */
  agentStatus: string;
  /** Human-readable name of the current pipeline step, or null if done. */
  currentStep: string | null;
  isStatusLoading: boolean;
  /** Generated posts — empty while still generating. */
  posts: SocialPost[];
  isPreviewLoading: boolean;
  /** The post currently displayed in the PostPreviewCard. */
  selectedPost: SocialPost | null;
  selectPost: (post: SocialPost) => void;
  /** Optimistic caption update (auto-saves via debounce in the component). */
  updatePostText: (postId: string, text: string) => Promise<void>;
  regeneratePost: (postId: string, feedback: string) => Promise<void>;
  regeneratingPostId: string | null;
  approve: () => Promise<void>;
  isApproving: boolean;
  cancel: () => Promise<void>;
  isCancelling: boolean;
  error: string | null;
  clearError: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2_000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCampaignValidation(
  campaignId: string,
  onApproved: (id: string) => void,
): UseCampaignValidationReturn {
  // ── Local UI state (not remote data → useState is OK here) ──────────────────
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [regeneratingPostId, setRegeneratingPostId] = useState<string | null>(
    null,
  );
  const [isApproving, setIsApproving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable ref for onApproved callback — prevents stale closure in effects
  const onApprovedRef = useRef(onApproved);
  useEffect(() => {
    onApprovedRef.current = onApproved;
  }, [onApproved]);

  // Ref for polling interval — useRef ensures no memory leak on unmount
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const statusKey = `/api/v1/campaigns/agent/${campaignId}/status`;
  const previewKey = `/api/v1/campaigns/agent/${campaignId}/preview`;

  // ── Remote data: status ─────────────────────────────────────────────────────
  const { data: statusData, isLoading: isStatusLoading } =
    useSWR<CampaignStatusResponse>(
      statusKey,
      (url: string) => apiFetch<CampaignStatusResponse>(url),
      { revalidateOnFocus: false, dedupingInterval: 500 },
    );

  const agentStatus = statusData?.agent_status ?? "unknown";
  const currentStep = statusData?.current_step ?? null;

  // ── Remote data: preview (conditional on status + posts loaded) ─────────────
  const { data: previewData, isLoading: isPreviewLoading } =
    useSWR<CampaignPreviewResponse>(
      agentStatus === "pending_validation" ? previewKey : null,
      (url: string) => apiFetch<CampaignPreviewResponse>(url),
      { revalidateOnFocus: false },
    );

  const posts = previewData?.posts ?? [];

  // ── Polling: ref-based setInterval for explicit cleanup ─────────────────────
  // Poll while: status is unknown OR pending_validation with no posts yet
  useEffect(() => {
    const isGenerating =
      agentStatus === "unknown" ||
      (agentStatus === "pending_validation" && posts.length === 0);

    if (!isGenerating) {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    pollIntervalRef.current = setInterval(() => {
      void globalMutate(statusKey);
      void globalMutate(previewKey);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [agentStatus, posts.length, statusKey, previewKey]);

  // ── Auto-select first post once loaded ──────────────────────────────────────
  useEffect(() => {
    if (posts.length > 0 && selectedPost === null) {
      setSelectedPost(posts[0]);
    }
  }, [posts, selectedPost]);

  // ── Sync selected post after regeneration (update reference in place) ───────
  useEffect(() => {
    if (selectedPost === null || posts.length === 0) return;
    const refreshed = posts.find((p) => p.id === selectedPost.id);
    if (refreshed && refreshed.content_text !== selectedPost.content_text) {
      setSelectedPost(refreshed);
    }
  }, [posts, selectedPost]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const selectPost = useCallback((post: SocialPost) => {
    setSelectedPost(post);
  }, []);

  const updatePostText = useCallback(
    async (postId: string, text: string) => {
      if (!previewData) return;

      // Optimistic UI update via SWR mutate (no revalidation)
      const optimistic: CampaignPreviewResponse = {
        ...previewData,
        posts: previewData.posts.map((p) =>
          p.id === postId ? { ...p, content_text: text } : p,
        ),
      };
      await globalMutate(previewKey, optimistic, false);
      setSelectedPost((prev) =>
        prev?.id === postId ? { ...prev, content_text: text } : prev,
      );

      // TODO: uncomment when PATCH /api/v1/campaigns/agent/{id}/posts/{postId}
      // is added to the backend:
      // try {
      //   await apiFetch(
      //     `/api/v1/campaigns/agent/${campaignId}/posts/${postId}`,
      //     { method: "PATCH", body: JSON.stringify({ content_text: text }) },
      //   );
      // } catch {
      //   await globalMutate(previewKey); // rollback
      //   setError("Impossible de sauvegarder les modifications.");
      // }
    },
    [previewData, previewKey],
  );

  const regeneratePost = useCallback(
    async (postId: string, feedback: string) => {
      setRegeneratingPostId(postId);
      setError(null);
      try {
        await apiFetch(
          `/api/v1/campaigns/agent/${campaignId}/posts/${postId}/regenerate`,
          { method: "POST", body: JSON.stringify({ feedback }) },
        );
        await globalMutate(previewKey);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "La régénération a échoué.",
        );
      } finally {
        setRegeneratingPostId(null);
      }
    },
    [campaignId, previewKey],
  );

  const approve = useCallback(async () => {
    setIsApproving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/campaigns/agent/${campaignId}/approve`, {
        method: "POST",
        body: JSON.stringify({ approved_post_ids: [] }),
      });
      await globalMutate(statusKey);
      onApprovedRef.current(campaignId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "L'approbation a échoué.",
      );
    } finally {
      setIsApproving(false);
    }
  }, [campaignId, statusKey]);

  const cancel = useCallback(async () => {
    setIsCancelling(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/campaigns/agent/${campaignId}`, {
        method: "DELETE",
      });
      await globalMutate(statusKey);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "L'annulation a échoué.",
      );
    } finally {
      setIsCancelling(false);
    }
  }, [campaignId, statusKey]);

  const clearError = useCallback(() => setError(null), []);

  return {
    agentStatus,
    currentStep,
    isStatusLoading,
    posts,
    isPreviewLoading,
    selectedPost,
    selectPost,
    updatePostText,
    regeneratePost,
    regeneratingPostId,
    approve,
    isApproving,
    cancel,
    isCancelling,
    error,
    clearError,
  };
}
