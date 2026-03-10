// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/campaigns/EditorialCalendar.tsx
// DESCRIPTION  : Scrollable editorial calendar listing all campaign posts
//                grouped by day, with selection and status indicators.
// ============================================================
"use client";

import { useCallback, useMemo } from "react";
import type { SocialPost } from "@/hooks/useCampaignValidation";

// ─── Platform icons (lightweight — no extra dependency) ───────────────────────

const PLATFORM_ICONS: Readonly<Record<string, string>> = {
  instagram: "📸",
  tiktok: "🎵",
  youtube: "▶",
  x: "✕",
  linkedin: "in",
  facebook: "f",
};

function getPlatformIcon(platform: string): string {
  return PLATFORM_ICONS[platform.toLowerCase()] ?? "📣";
}

const STATUS_DOT: Readonly<Record<string, string>> = {
  pending_validation: "bg-amber-400",
  approved: "bg-green-500",
  scheduled: "bg-blue-500",
  published: "bg-violet-500",
  failed: "bg-red-500",
  cancelled: "bg-neutral-400",
  draft: "bg-neutral-300",
};

function getStatusDotClass(status: string): string {
  return STATUS_DOT[status] ?? "bg-neutral-300";
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EditorialCalendarProps {
  posts: SocialPost[];
  selectedPostId: string | null;
  onSelect: (post: SocialPost) => void;
  /** Post ID currently being regenerated (shown with spinner). */
  regeneratingPostId: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateKey(isoString: string): string {
  // Returns "YYYY-MM-DD" in local time
  return new Date(isoString).toLocaleDateString("fr-CA"); // ISO format
}

function formatDayHeader(isoDateKey: string): string {
  const d = new Date(isoDateKey + "T12:00:00");
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Displays campaign posts grouped by publication day.
 * Clicking a post selects it in the parent (displays in PostPreviewCard).
 */
export function EditorialCalendar({
  posts,
  selectedPostId,
  onSelect,
  regeneratingPostId,
}: EditorialCalendarProps) {
  // Group posts by calendar day
  const groupedByDay = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    const sorted = [...posts].sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    );
    for (const post of sorted) {
      const key = post.scheduled_at ? toDateKey(post.scheduled_at) : "unknown";
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    return map;
  }, [posts]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, post: SocialPost) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(post);
      }
    },
    [onSelect],
  );

  if (posts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-neutral-400 dark:text-neutral-600">
        Aucun post généré pour le moment.
      </div>
    );
  }

  return (
    <nav
      aria-label="Calendrier éditorial"
      className="flex flex-col gap-4 overflow-y-auto"
    >
      {Array.from(groupedByDay.entries()).map(([day, dayPosts]) => (
        <section key={day} aria-label={formatDayHeader(day)}>
          {/* Day header */}
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {formatDayHeader(day)}
            <span className="ml-2 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              {dayPosts.length}
            </span>
          </h3>

          {/* Posts for this day */}
          <ul className="flex flex-col gap-1.5">
            {dayPosts.map((post) => {
              const isSelected = post.id === selectedPostId;
              const isRegen = post.id === regeneratingPostId;
              const platformIcon = getPlatformIcon(post.platform);
              const statusDot = getStatusDotClass(post.status);
              const timeLabel = post.scheduled_at
                ? formatTime(post.scheduled_at)
                : "—";

              return (
                <li key={post.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(post)}
                    onKeyDown={(e) => handleKeyDown(e, post)}
                    aria-pressed={isSelected}
                    aria-label={`${platformIcon} ${post.platform} à ${timeLabel} — ${post.status}`}
                    className={[
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-100",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                      isSelected
                        ? "bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:text-white"
                        : "hover:bg-neutral-50 text-neutral-700 dark:hover:bg-neutral-800 dark:text-neutral-300",
                    ].join(" ")}
                  >
                    {/* Platform icon */}
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-sm dark:bg-neutral-800"
                    >
                      {isRegen ? (
                        <span
                          aria-hidden="true"
                          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-500"
                        />
                      ) : (
                        platformIcon
                      )}
                    </span>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium leading-tight">
                        {post.content_text
                          ? post.content_text.slice(0, 60) +
                            (post.content_text.length > 60 ? "…" : "")
                          : "Post sans contenu"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-neutral-400 dark:text-neutral-600">
                        <time dateTime={post.scheduled_at}>{timeLabel}</time>
                        {" · "}
                        {post.platform}
                      </p>
                    </div>

                    {/* Status dot */}
                    <span
                      aria-label={`Statut : ${post.status}`}
                      className={`h-2 w-2 shrink-0 rounded-full ${statusDot}`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
