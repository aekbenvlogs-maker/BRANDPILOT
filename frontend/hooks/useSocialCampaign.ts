// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/hooks/useSocialCampaign.ts
// ============================================================
import useSWR, { useSWRConfig } from "swr";
import { useCallback } from "react";
import { apiFetch, apiPost } from "@/utils/api";

// ──────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────
export type PostStatus = "draft" | "scheduled" | "published" | "failed";
export type PostPlatform = "instagram" | "tiktok" | "youtube" | "x" | "linkedin";

export interface ScheduledPost {
  id: string;
  campaign_id: string;
  platform: PostPlatform;
  text: string;
  hashtags: string[];
  media_url?: string;
  scheduled_at: string; // ISO 8601
  status: PostStatus;
  engagement_preview?: {
    estimated_reach: number;
    score: number;
  };
}

export interface SocialCampaign {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: "active" | "draft" | "completed" | "paused";
  posts: ScheduledPost[];
  total_posts: number;
  published_posts: number;
  created_at: string;
}

// ──────────────────────────────────────────────────────────────
// useSocialCampaigns
// ──────────────────────────────────────────────────────────────
export function useSocialCampaigns(projectId: string | null) {
  const { data, isLoading, error, mutate } = useSWR<SocialCampaign[]>(
    projectId ? `/api/v1/planner/campaigns?project_id=${projectId}` : null,
    (url: string) => apiFetch<SocialCampaign[]>(url)
  );

  return {
    campaigns: data ?? [],
    isLoading,
    error: error instanceof Error ? error.message : null,
    mutate,
  };
}

// ──────────────────────────────────────────────────────────────
// useSocialCampaign
// ──────────────────────────────────────────────────────────────
export function useSocialCampaign(campaignId: string | null) {
  const { data, isLoading, error, mutate } = useSWR<SocialCampaign>(
    campaignId ? `/api/v1/planner/campaigns/${campaignId}` : null,
    (url: string) => apiFetch<SocialCampaign>(url)
  );

  return {
    campaign: data ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    mutate,
  };
}

// ──────────────────────────────────────────────────────────────
// useMovePost — drag & drop reschedule
// ──────────────────────────────────────────────────────────────
export function useMovePost(campaignId: string | null) {
  const { mutate: globalMutate } = useSWRConfig();

  const movePost = useCallback(
    async (postId: string, newScheduledAt: string) => {
      await apiPost<ScheduledPost>(`/api/v1/planner/posts/${postId}/reschedule`, {
        scheduled_at: newScheduledAt,
      });
      await globalMutate(`/api/v1/planner/campaigns/${campaignId}`);
    },
    [campaignId, globalMutate]
  );

  return { movePost };
}

// ──────────────────────────────────────────────────────────────
// useCreatePost
// ──────────────────────────────────────────────────────────────
export function useCreatePost(campaignId: string | null) {
  const { mutate: globalMutate } = useSWRConfig();

  const createPost = useCallback(
    async (data: Partial<ScheduledPost>) => {
      const post = await apiPost<ScheduledPost>("/api/v1/planner/posts", {
        ...data,
        campaign_id: campaignId,
      });
      await globalMutate(`/api/v1/planner/campaigns/${campaignId}`);
      return post;
    },
    [campaignId, globalMutate]
  );

  return { createPost };
}
