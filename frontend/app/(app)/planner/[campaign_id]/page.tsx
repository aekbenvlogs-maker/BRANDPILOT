// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/app/(app)/planner/[campaign_id]/page.tsx
// ============================================================
"use client";

import React, { useState } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, CalendarDays } from "lucide-react";
import { useSocialCampaign, useMovePost } from "@/hooks/useSocialCampaign";
import { EditorialCalendar } from "@/components/features/planner/EditorialCalendar";
import { PlatformFilter } from "@/components/features/planner/PlatformFilter";
import { PostCard } from "@/components/features/planner/PostCard";
import type { PostPlatform, ScheduledPost } from "@/hooks/useSocialCampaign";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
  draft: "bg-gray-100 text-gray-500 dark:bg-gray-800",
  completed: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  paused: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
};

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = typeof params.campaign_id === "string" ? params.campaign_id : null;
  const { campaign, isLoading, error } = useSocialCampaign(campaignId);
  const { movePost } = useMovePost(campaignId);
  const [filteredPlatforms, setFilteredPlatforms] = useState<PostPlatform[]>([]);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);

  if (isLoading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" aria-label="Chargement" />
      </main>
    );
  }

  if (error || !campaign) {
    return notFound();
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      {/* Back + Header */}
      <div>
        <Link
          href="/planner"
          className="mb-3 flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux campagnes
        </Link>
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
              <CalendarDays className="h-6 w-6 text-indigo-500" />
              {campaign.name}
            </h1>
            {campaign.description && (
              <p className="mt-1 text-sm text-gray-500">{campaign.description}</p>
            )}
          </div>
          <span className={`mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[campaign.status] ?? STATUS_STYLES.draft}`}>
            {campaign.status}
          </span>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
          <span>
            {new Date(campaign.start_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
            {" → "}
            {new Date(campaign.end_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
          <span>{campaign.total_posts} publications planifiées</span>
          <span>{campaign.published_posts} publiées</span>
        </div>
      </div>

      {/* Platform filter */}
      <PlatformFilter selected={filteredPlatforms} onChange={setFilteredPlatforms} />

      {/* Calendar */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <EditorialCalendar
          posts={campaign.posts}
          filteredPlatforms={filteredPlatforms}
          onMovePost={movePost}
          onPostClick={setSelectedPost}
        />
      </div>

      {/* Post detail drawer (slide panel) */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-40 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Détails du post"
        >
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setSelectedPost(null)}
          />
          <div className="relative z-50 flex w-full max-w-sm flex-col gap-4 overflow-y-auto bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Détails du post</h2>
              <button
                onClick={() => setSelectedPost(null)}
                aria-label="Fermer"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                ✕
              </button>
            </div>
            <PostCard post={selectedPost} />
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <p><span className="font-medium">Plateforme :</span> {selectedPost.platform}</p>
              <p><span className="font-medium">Planifié :</span> {new Date(selectedPost.scheduled_at).toLocaleString("fr-FR")}</p>
              <p><span className="font-medium">Statut :</span> {selectedPost.status}</p>
              {selectedPost.hashtags.length > 0 && (
                <div>
                  <p className="font-medium">Hashtags :</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedPost.hashtags.map((h) => (
                      <span key={h} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                        #{h.replace(/^#/, "")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedPost.engagement_preview && (
                <p>
                  <span className="font-medium">Reach estimé :</span>{" "}
                  {selectedPost.engagement_preview.estimated_reach.toLocaleString("fr-FR")} — Score{" "}
                  {selectedPost.engagement_preview.score}/100
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
