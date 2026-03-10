// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/planner/PostCard.tsx
// ============================================================
"use client";

import React, { useState } from "react";
import type { ScheduledPost, PostPlatform } from "@/hooks/useSocialCampaign";

// ──────────────────────────────────────────────────────────────
// PLATFORM COLORS
// ──────────────────────────────────────────────────────────────
const PLATFORM_STYLES: Record<PostPlatform, { dot: string; badge: string }> = {
  instagram: { dot: "bg-purple-500", badge: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  tiktok: { dot: "bg-gray-800", badge: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  youtube: { dot: "bg-red-500", badge: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  x: { dot: "bg-gray-700", badge: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  linkedin: { dot: "bg-blue-700", badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500 dark:bg-gray-800",
  scheduled: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  published: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
  failed: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  scheduled: "Planifié",
  published: "Publié",
  failed: "Échec",
};

// ──────────────────────────────────────────────────────────────
// POST CARD
// ──────────────────────────────────────────────────────────────
interface PostCardProps {
  post: ScheduledPost;
  compact?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, post: ScheduledPost) => void;
  onClick?: (post: ScheduledPost) => void;
}

export function PostCard({ post, compact = false, isDragging = false, onDragStart, onClick }: PostCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const pStyle = PLATFORM_STYLES[post.platform];
  const time = new Date(post.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const preview = post.text.slice(0, compact ? 30 : 80);

  if (compact) {
    return (
      <div
        draggable
        onDragStart={onDragStart ? (e) => onDragStart(e, post) : undefined}
        onClick={() => onClick?.(post)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        tabIndex={0}
        aria-label={`Post ${post.platform} planifié à ${time}: ${preview}`}
        className={`relative cursor-grab select-none rounded-lg px-2 py-1.5 text-xs transition-transform ${
          isDragging ? "scale-95 opacity-60" : ""
        } ${pStyle.badge}`}
        role="button"
      >
        <div className="flex items-center gap-1">
          <span className={`h-2 w-2 shrink-0 rounded-full ${pStyle.dot}`} />
          <span className="font-medium">{time}</span>
          <span className="truncate text-[10px] opacity-70">{preview}{post.text.length > 30 ? "…" : ""}</span>
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div
            role="tooltip"
            className="absolute bottom-full left-0 z-20 mb-1 w-48 rounded-lg bg-gray-900 p-2 text-xs text-white shadow-lg"
          >
            <p className="font-semibold capitalize">{post.platform} · {time}</p>
            <p className="mt-0.5 text-gray-300 line-clamp-2">{post.text}</p>
            <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[post.status]}`}>
              {STATUS_LABELS[post.status]}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={onDragStart ? (e) => onDragStart(e, post) : undefined}
      onClick={() => onClick?.(post)}
      className={`cursor-pointer rounded-xl border p-3 transition-all hover:border-indigo-200 hover:shadow-sm dark:hover:border-indigo-800 ${
        isDragging ? "scale-95 opacity-50 border-indigo-400" : "border-gray-100 dark:border-gray-800"
      } bg-white dark:bg-gray-900`}
      tabIndex={0}
      aria-label={`Post ${post.platform}`}
      role="button"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pStyle.badge}`}>
          {post.platform}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[post.status]}`}>
          {STATUS_LABELS[post.status]}
        </span>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-2">{post.text}</p>
      <p className="mt-1.5 text-xs text-gray-400">{time}</p>
    </div>
  );
}
