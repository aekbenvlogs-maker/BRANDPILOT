// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/studio/PlatformPreview.tsx
// ============================================================
"use client";

import React, { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { ContentPlatform } from "@/hooks/useContentFormatter";

// ──────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────
interface PlatformPreviewProps {
  platform: ContentPlatform;
  text: string;
  mediaUrl?: string;
  hashtags: string[];
  username?: string;
}

type ViewMode = "mobile" | "desktop";

// ──────────────────────────────────────────────────────────────
// INSTAGRAM PREVIEW
// ──────────────────────────────────────────────────────────────
function InstagramPreview({ text, mediaUrl, hashtags, username, viewMode }: PlatformPreviewProps & { viewMode: ViewMode }) {
  const isDesktop = viewMode === "desktop";
  return (
    <div className={`mx-auto bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 ${isDesktop ? "max-w-lg" : "max-w-xs"} rounded-xl border border-gray-100 dark:border-gray-800`}>
      {/* Top bar */}
      <div className="flex items-center gap-2 p-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
        <div>
          <p className="text-xs font-semibold">@{username ?? "brandpilot"}</p>
          <p className="text-xs text-gray-400">Sponsorisé</p>
        </div>
        <span className="ml-auto text-lg leading-none text-gray-400">···</span>
      </div>
      {/* Media */}
      {mediaUrl ? (
        <img src={mediaUrl} alt="Aperçu du contenu" className="aspect-square w-full object-cover" />
      ) : (
        <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <span className="text-4xl">📸</span>
        </div>
      )}
      {/* Caption */}
      <div className="p-3">
        <div className="flex gap-3 text-xl">
          <span>🤍</span><span>💬</span><span>✈️</span>
          <span className="ml-auto">🔖</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed">
          <span className="font-semibold">@{username ?? "brandpilot"} </span>
          {text.slice(0, 125)}{text.length > 125 ? "… " : " "}
          <span className="text-blue-500">{hashtags.slice(0, 5).map((h) => `#${h.replace(/^#/, "")}`).join(" ")}</span>
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// TIKTOK PREVIEW
// ──────────────────────────────────────────────────────────────
function TikTokPreview({ text, mediaUrl, hashtags, username, viewMode }: PlatformPreviewProps & { viewMode: ViewMode }) {
  const isDesktop = viewMode === "desktop";
  return (
    <div className={`relative mx-auto overflow-hidden rounded-xl bg-gray-900 text-white ${isDesktop ? "max-w-sm" : "max-w-xs"}`} style={{ aspectRatio: "9/16" }}>
      {mediaUrl ? (
        <img src={mediaUrl} alt="Aperçu TikTok" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900">
          <span className="text-5xl">🎵</span>
        </div>
      )}
      {/* Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <p className="text-xs font-semibold">@{username ?? "brandpilot"}</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-200">
          {text.slice(0, 100)}{text.length > 100 ? "…" : ""}
        </p>
        <p className="mt-1 text-xs text-blue-300">
          {hashtags.slice(0, 4).map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
        </p>
      </div>
      {/* Right actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 text-white">
        <div className="flex flex-col items-center text-xs">
          <span className="text-xl">🤍</span>
          <span>42.1K</span>
        </div>
        <div className="flex flex-col items-center text-xs">
          <span className="text-xl">💬</span>
          <span>1.2K</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// YOUTUBE PREVIEW
// ──────────────────────────────────────────────────────────────
function YouTubePreview({ text, mediaUrl, username, viewMode }: PlatformPreviewProps & { viewMode: ViewMode }) {
  const isDesktop = viewMode === "desktop";
  return (
    <div className={`mx-auto rounded-xl overflow-hidden bg-white dark:bg-gray-900 ${isDesktop ? "max-w-lg" : "max-w-xs"}`}>
      {/* Thumbnail 16:9 */}
      {mediaUrl ? (
        <img src={mediaUrl} alt="Miniature YouTube" className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-red-500 to-red-700">
          <span className="text-5xl">▶</span>
        </div>
      )}
      <div className="flex gap-3 p-3">
        <div className="h-9 w-9 shrink-0 rounded-full bg-red-600 flex items-center justify-center text-white text-sm font-bold">
          {(username ?? "BP").charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">{text.slice(0, 80) || "Titre de la vidéo"}</p>
          <p className="mt-0.5 text-xs text-gray-500">{username ?? "brandpilot"} · 12K vues</p>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// X (TWITTER) PREVIEW
// ──────────────────────────────────────────────────────────────
function XPreview({ text, mediaUrl, hashtags, username, viewMode }: PlatformPreviewProps & { viewMode: ViewMode }) {
  const isDesktop = viewMode === "desktop";
  return (
    <div className={`mx-auto rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 ${isDesktop ? "max-w-lg" : "max-w-xs"}`}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold">
          {(username ?? "BP").charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{username ?? "BrandPilot"}</span>
            <span className="text-xs text-gray-400">@{username ?? "brandpilot"}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-gray-800 dark:text-gray-200">
            {text.slice(0, 280)}
            {" "}
            <span className="text-blue-500">{hashtags.slice(0, 3).map((h) => `#${h.replace(/^#/, "")}`).join(" ")}</span>
          </p>
          {mediaUrl && (
            <img src={mediaUrl} alt="Média" className="mt-2 w-full rounded-lg object-cover" style={{ maxHeight: 200 }} />
          )}
          <div className="mt-3 flex gap-5 text-xs text-gray-400">
            <span>💬 24</span>
            <span>🔁 48</span>
            <span>🤍 312</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// LINKEDIN PREVIEW
// ──────────────────────────────────────────────────────────────
function LinkedInPreview({ text, mediaUrl, hashtags, username, viewMode }: PlatformPreviewProps & { viewMode: ViewMode }) {
  const isDesktop = viewMode === "desktop";
  return (
    <div className={`mx-auto rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 ${isDesktop ? "max-w-lg" : "max-w-xs"}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-11 w-11 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold">
          {(username ?? "BP").charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{username ?? "BrandPilot"}</p>
          <p className="text-xs text-gray-400">Marque · Sponsorisé</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
        {text.slice(0, 300)}{text.length > 300 ? "… " : " "}
        <span className="text-blue-600">{hashtags.slice(0, 3).map((h) => `#${h.replace(/^#/, "")}`).join(" ")}</span>
      </p>
      {mediaUrl && (
        <img src={mediaUrl} alt="Média LinkedIn" className="mt-3 w-full rounded-lg object-cover" style={{ maxHeight: 200 }} />
      )}
      <div className="mt-3 flex gap-4 text-xs text-gray-400 border-t border-gray-100 pt-2 dark:border-gray-800">
        <span>👍 128</span>
        <span>💬 14 commentaires</span>
        <span>↗ Partager</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// PLATFORM PREVIEW (main export)
// ──────────────────────────────────────────────────────────────
const PREVIEW_MAP: Record<ContentPlatform, React.ComponentType<PlatformPreviewProps & { viewMode: ViewMode }>> = {
  instagram: InstagramPreview,
  tiktok: TikTokPreview,
  youtube: YouTubePreview,
  x: XPreview,
  linkedin: LinkedInPreview,
};

export function PlatformPreview(props: PlatformPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("mobile");
  const PreviewComponent = PREVIEW_MAP[props.platform];

  return (
    <div className="space-y-3">
      {/* View mode toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Aperçu {props.platform}
        </h3>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setViewMode("mobile")}
            aria-label="Vue mobile"
            aria-pressed={viewMode === "mobile"}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs transition-colors ${viewMode === "mobile" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300" : "bg-white text-gray-400 hover:bg-gray-50 dark:bg-gray-800"}`}
          >
            <Smartphone className="h-3.5 w-3.5" /> Mobile
          </button>
          <button
            onClick={() => setViewMode("desktop")}
            aria-label="Vue desktop"
            aria-pressed={viewMode === "desktop"}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs transition-colors ${viewMode === "desktop" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300" : "bg-white text-gray-400 hover:bg-gray-50 dark:bg-gray-800"}`}
          >
            <Monitor className="h-3.5 w-3.5" /> Desktop
          </button>
        </div>
      </div>

      {/* Preview */}
      <PreviewComponent {...props} viewMode={viewMode} />
    </div>
  );
}
