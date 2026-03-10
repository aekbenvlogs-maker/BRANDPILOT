// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/campaigns/MobilePreview.tsx
// DESCRIPTION  : Full-screen overlay simulating a smartphone display for a
//                social post. Background and text colors adapt per platform.
// ============================================================
"use client";

import { useEffect } from "react";
import type { SocialPost } from "@/hooks/useCampaignValidation";

// ─── Platform themes ─────────────────────────────────────────────────────────

interface PlatformTheme {
  bg: string;
  text: string;
  subtext: string;
  headerBg: string;
  icon: string;
  label: string;
  handle: string;
  gradient: string;
  actionBarBg: string;
}

const PLATFORM_THEMES: Readonly<Record<string, PlatformTheme>> = {
  instagram: {
    bg: "bg-white",
    text: "text-neutral-900",
    subtext: "text-neutral-500",
    headerBg: "bg-white border-b border-neutral-200",
    icon: "📸",
    label: "Instagram",
    handle: "@brandpilot",
    gradient: "from-purple-500 via-pink-500 to-orange-400",
    actionBarBg: "bg-white border-t border-neutral-200",
  },
  tiktok: {
    bg: "bg-black",
    text: "text-white",
    subtext: "text-neutral-400",
    headerBg: "bg-black",
    icon: "🎵",
    label: "TikTok",
    handle: "@brandpilot",
    gradient: "from-neutral-900 to-neutral-800",
    actionBarBg: "bg-black border-t border-neutral-800",
  },
  youtube: {
    bg: "bg-white",
    text: "text-neutral-900",
    subtext: "text-neutral-500",
    headerBg: "bg-white border-b border-neutral-200",
    icon: "▶",
    label: "YouTube",
    handle: "BrandPilot",
    gradient: "from-red-600 to-red-500",
    actionBarBg: "bg-white border-t border-neutral-200",
  },
  x: {
    bg: "bg-black",
    text: "text-white",
    subtext: "text-neutral-400",
    headerBg: "bg-black border-b border-neutral-800",
    icon: "✕",
    label: "X (Twitter)",
    handle: "@brandpilot",
    gradient: "from-neutral-900 to-neutral-800",
    actionBarBg: "bg-black border-t border-neutral-800",
  },
  linkedin: {
    bg: "bg-white",
    text: "text-neutral-900",
    subtext: "text-neutral-500",
    headerBg: "bg-white border-b border-neutral-200",
    icon: "in",
    label: "LinkedIn",
    handle: "BrandPilot",
    gradient: "from-blue-700 to-blue-600",
    actionBarBg: "bg-white border-t border-neutral-200",
  },
  facebook: {
    bg: "bg-white",
    text: "text-neutral-900",
    subtext: "text-neutral-500",
    headerBg: "bg-white border-b border-neutral-200",
    icon: "f",
    label: "Facebook",
    handle: "BrandPilot",
    gradient: "from-blue-600 to-blue-500",
    actionBarBg: "bg-white border-t border-neutral-200",
  },
};

const DEFAULT_THEME: PlatformTheme = {
  bg: "bg-white",
  text: "text-neutral-900",
  subtext: "text-neutral-500",
  headerBg: "bg-white border-b border-neutral-200",
  icon: "📣",
  label: "Social",
  handle: "@brandpilot",
  gradient: "from-neutral-500 to-neutral-400",
  actionBarBg: "bg-white border-t border-neutral-200",
};

function getTheme(platform: string): PlatformTheme {
  return PLATFORM_THEMES[platform.toLowerCase()] ?? DEFAULT_THEME;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MobilePreviewProps {
  post: SocialPost;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full-screen overlay showing a smartphone-style preview of a social post.
 * Pressing Escape or clicking the backdrop closes the overlay.
 */
export function MobilePreview({ post, onClose }: MobilePreviewProps) {
  const theme = getTheme(post.platform);

  // ── Trap scroll + close on Escape ─────────────────────────────────────
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const scheduledLabel = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

  const captionWithHashtags =
    post.content_text +
    (post.hashtags.length > 0
      ? "\n\n" +
        post.hashtags
          .map((t) => (t.startsWith("#") ? t : `#${t}`))
          .join(" ")
      : "");

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Prévisualisation mobile — ${theme.label}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Phone frame — stop propagation so inner clicks don't close */}
      <div
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[680px] w-[360px] flex-col overflow-hidden rounded-[3rem] border-8 border-neutral-800 shadow-2xl"
        style={{ boxShadow: "0 0 0 2px #333, 0 30px 80px rgba(0,0,0,0.5)" }}
      >
        {/* Notch */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-2 z-10 h-4 w-28 -translate-x-1/2 rounded-full bg-neutral-900"
        />

        {/* App header */}
        <header className={`px-4 pb-3 pt-8 ${theme.headerBg} ${theme.text}`}>
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${theme.gradient} text-sm text-white`}
            >
              {theme.icon}
            </span>
            <div>
              <p className="text-[13px] font-semibold leading-tight">
                {theme.handle}
              </p>
              <p className={`text-[10px] ${theme.subtext}`}>{theme.label}</p>
            </div>
            <button
              type="button"
              aria-label="Options"
              className={`ml-auto text-lg ${theme.subtext}`}
            >
              ···
            </button>
          </div>
        </header>

        {/* Media area */}
        <div
          className={`relative flex-shrink-0 ${theme.bg}`}
          style={{ height: "300px" }}
        >
          {post.media_urls.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.media_urls[0]}
              alt={`Visuel ${theme.label}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${theme.gradient} text-6xl`}
            >
              {theme.icon}
            </div>
          )}
        </div>

        {/* Caption + hashtags */}
        <div className={`flex-1 overflow-y-auto px-4 py-3 ${theme.bg}`}>
          <p
            className={`whitespace-pre-line text-[12px] leading-relaxed ${theme.text}`}
          >
            {captionWithHashtags || (
              <span className={theme.subtext}>Aucun contenu</span>
            )}
          </p>
        </div>

        {/* Action bar */}
        <footer className={`flex items-center justify-around px-4 py-3 ${theme.actionBarBg} ${theme.text}`}>
          <button type="button" aria-label="J'aime" className="flex flex-col items-center gap-0.5 text-[10px]">
            <span aria-hidden="true" className="text-lg">❤️</span>
            <span className={theme.subtext}>J'aime</span>
          </button>
          <button type="button" aria-label="Commenter" className="flex flex-col items-center gap-0.5 text-[10px]">
            <span aria-hidden="true" className="text-lg">💬</span>
            <span className={theme.subtext}>Commenter</span>
          </button>
          <button type="button" aria-label="Partager" className="flex flex-col items-center gap-0.5 text-[10px]">
            <span aria-hidden="true" className="text-lg">📤</span>
            <span className={theme.subtext}>Partager</span>
          </button>
        </footer>

        {/* Scheduled badge */}
        {scheduledLabel && (
          <div
            aria-label={`Programmé le ${scheduledLabel}`}
            className="absolute bottom-20 right-3 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur-sm"
          >
            🕐 {scheduledLabel}
          </div>
        )}
      </div>

      {/* Close button outside the phone */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer la prévisualisation mobile"
        className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        ✕
      </button>

      {/* Keyboard hint */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/50">
        Appuyez sur <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono">Esc</kbd> pour fermer
      </p>
    </div>
  );
}
