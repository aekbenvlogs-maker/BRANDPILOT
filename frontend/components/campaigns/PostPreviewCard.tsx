// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/campaigns/PostPreviewCard.tsx
// DESCRIPTION  : Card displaying a single social post with inline editing,
//                regeneration trigger, delete action and mobile preview toggle.
// ============================================================
"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SocialPost } from "@/hooks/useCampaignValidation";

// ─── Platform config ─────────────────────────────────────────────────────────

interface PlatformStyle {
  icon: string;
  label: string;
  pillBg: string;
  pillText: string;
  gradient: string;
}

const PLATFORM_STYLES: Readonly<Record<string, PlatformStyle>> = {
  instagram: {
    icon: "📸",
    label: "Instagram",
    pillBg: "bg-pink-50 dark:bg-pink-950",
    pillText: "text-pink-600 dark:text-pink-400",
    gradient: "from-purple-500 via-pink-500 to-orange-400",
  },
  tiktok: {
    icon: "🎵",
    label: "TikTok",
    pillBg: "bg-neutral-100 dark:bg-neutral-800",
    pillText: "text-neutral-900 dark:text-white",
    gradient: "from-neutral-900 to-neutral-700",
  },
  youtube: {
    icon: "▶",
    label: "YouTube",
    pillBg: "bg-red-50 dark:bg-red-950",
    pillText: "text-red-600 dark:text-red-400",
    gradient: "from-red-600 to-red-500",
  },
  x: {
    icon: "✕",
    label: "X",
    pillBg: "bg-neutral-100 dark:bg-neutral-800",
    pillText: "text-neutral-900 dark:text-white",
    gradient: "from-neutral-900 to-neutral-800",
  },
  linkedin: {
    icon: "in",
    label: "LinkedIn",
    pillBg: "bg-blue-50 dark:bg-blue-950",
    pillText: "text-blue-700 dark:text-blue-400",
    gradient: "from-blue-700 to-blue-600",
  },
  facebook: {
    icon: "f",
    label: "Facebook",
    pillBg: "bg-blue-50 dark:bg-blue-950",
    pillText: "text-blue-600 dark:text-blue-400",
    gradient: "from-blue-600 to-blue-500",
  },
};

const DEFAULT_PLATFORM_STYLE: PlatformStyle = {
  icon: "📣",
  label: "Social",
  pillBg: "bg-neutral-100 dark:bg-neutral-800",
  pillText: "text-neutral-700 dark:text-neutral-300",
  gradient: "from-neutral-500 to-neutral-400",
};

function getPlatformStyle(platform: string): PlatformStyle {
  return PLATFORM_STYLES[platform.toLowerCase()] ?? DEFAULT_PLATFORM_STYLE;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PostPreviewCardProps {
  post: SocialPost;
  /** Whether ANY post is currently being regenerated (locks actions). */
  isRegenerating: boolean;
  /** Whether this specific post is being regenerated. */
  isThisPostRegenerating: boolean;
  /** Called with new caption text (debounced in parent). */
  onTextChange: (postId: string, text: string) => Promise<void>;
  /** Open feedback modal then call this to regenerate. */
  onRegenerate: (postId: string, feedback: string) => Promise<void>;
  /** Preview this post in the mobile overlay. */
  onPreviewMobile: () => void;
}

// ─── Feedback modal ───────────────────────────────────────────────────────────

interface FeedbackModalProps {
  onConfirm: (feedback: string) => void;
  onCancel: () => void;
}

function FeedbackModal({ onConfirm, onCancel }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="regen-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
        <h2
          id="regen-modal-title"
          className="mb-3 text-base font-semibold text-neutral-900 dark:text-white"
        >
          🔄 Régénérer ce post
        </h2>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          Feedback optionnel — indiquez ce que vous souhaitez modifier.
        </p>
        <textarea
          ref={inputRef}
          value={feedback}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            setFeedback(e.target.value.slice(0, 500))
          }
          placeholder="Ex. : Rendre le ton plus jeune et dynamique, ajouter un appel à l'action…"
          rows={3}
          className="w-full resize-none rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(feedback)}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Régénérer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Displays a single social post with inline caption editing,
 * regeneration modal, and mobile preview trigger.
 */
export function PostPreviewCard({
  post,
  isRegenerating,
  isThisPostRegenerating,
  onTextChange,
  onRegenerate,
  onPreviewMobile,
}: PostPreviewCardProps) {
  const platformStyle = getPlatformStyle(post.platform);

  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(post.content_text);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep draft in sync with incoming prop changes (e.g. post regenerated)
  useEffect(() => {
    setDraftText(post.content_text);
  }, [post.content_text]);

  // ── Caption edit with 1-second debounce auto-save ─────────────────────
  const handleCaptionChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setDraftText(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void onTextChange(post.id, value);
      }, 1_000);
    },
    [post.id, onTextChange],
  );

  // Flush on blur
  const handleCaptionBlur = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    void onTextChange(post.id, draftText);
    setIsEditing(false);
  }, [post.id, draftText, onTextChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Regenerate ─────────────────────────────────────────────────────────
  const handleRegenConfirm = useCallback(
    async (feedback: string) => {
      setShowFeedbackModal(false);
      await onRegenerate(post.id, feedback);
    },
    [post.id, onRegenerate],
  );

  // ── Scheduled date label ────────────────────────────────────────────────
  const scheduledLabel = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

  const actionsDisabled = isRegenerating;

  // ─── Render ─────────────────────────────────────────────────────────────

  if (isThisPostRegenerating) {
    return (
      <div
        aria-busy="true"
        aria-label="Régénération du post en cours"
        className="flex h-full flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
      >
        {/* Skeleton header */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        </div>
        {/* Skeleton body */}
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`h-3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700 ${i === 3 ? "w-2/3" : "w-full"}`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-neutral-400">
          Génération en cours…
        </p>
      </div>
    );
  }

  return (
    <>
      <article
        aria-label={`Post ${platformStyle.label} programmé le ${scheduledLabel}`}
        className="flex h-full flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Platform pill */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${platformStyle.pillBg} ${platformStyle.pillText}`}
            >
              <span aria-hidden="true">{platformStyle.icon}</span>
              {platformStyle.label}
            </span>
            {/* Status badge */}
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              {post.status}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              disabled={actionsDisabled}
              aria-label="Modifier la caption"
              title="Modifier"
              className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              ✏️
            </button>
            <button
              type="button"
              onClick={() => setShowFeedbackModal(true)}
              disabled={actionsDisabled}
              aria-label="Régénérer ce post avec l'IA"
              title="Régénérer"
              className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              🔄
            </button>
            <button
              type="button"
              onClick={onPreviewMobile}
              disabled={actionsDisabled}
              aria-label="Voir la prévisualisation mobile"
              title="Voir sur mobile"
              className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              📱
            </button>
          </div>
        </div>

        {/* ── Media placeholder ─────────────────────────────────────── */}
        {post.media_urls.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.media_urls[0]}
            alt={`Visuel ${platformStyle.label}`}
            className={`h-48 w-full rounded-xl object-cover bg-gradient-to-br ${platformStyle.gradient}`}
          />
        ) : (
          <div
            aria-hidden="true"
            className={`flex h-48 w-full items-center justify-center rounded-xl bg-gradient-to-br ${platformStyle.gradient} text-4xl`}
          >
            {platformStyle.icon}
          </div>
        )}

        {/* ── Caption ───────────────────────────────────────────────── */}
        <div className="flex-1">
          {isEditing ? (
            <textarea
              value={draftText}
              onChange={handleCaptionChange}
              onBlur={handleCaptionBlur}
              aria-label="Éditer la caption"
              autoFocus
              rows={5}
              className="w-full resize-none rounded-xl border border-violet-300 bg-violet-50/50 px-3 py-2 text-sm leading-relaxed text-neutral-800 focus:outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-violet-700 dark:bg-violet-950/30 dark:text-white"
            />
          ) : (
            <p
              className="cursor-text text-sm leading-relaxed text-neutral-700 dark:text-neutral-300"
              onClick={() => setIsEditing(true)}
              title="Cliquer pour éditer"
            >
              {post.content_text || (
                <span className="italic text-neutral-400">Aucun contenu</span>
              )}
            </p>
          )}
        </div>

        {/* ── Hashtags ──────────────────────────────────────────────── */}
        {post.hashtags.length > 0 && (
          <div
            aria-label="Hashtags"
            className="flex flex-wrap gap-1.5"
          >
            {post.hashtags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-400"
              >
                {tag.startsWith("#") ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}

        {/* ── Scheduled date ────────────────────────────────────────── */}
        <p className="text-xs text-neutral-400 dark:text-neutral-600">
          <span aria-hidden="true">🕐 </span>
          Programmé le{" "}
          <time dateTime={post.scheduled_at}>{scheduledLabel}</time>
        </p>
      </article>

      {/* ── Feedback modal ─────────────────────────────────────────── */}
      {showFeedbackModal && (
        <FeedbackModal
          onConfirm={handleRegenConfirm}
          onCancel={() => setShowFeedbackModal(false)}
        />
      )}
    </>
  );
}
