// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/social/PlatformConnectCard.tsx
// ============================================================
"use client";

import React, { useState } from "react";
import type { SocialAccount, SocialPlatform } from "@/hooks/useSocialAccounts";

// ---------------------------------------------------------------------------
// Platform config
// ---------------------------------------------------------------------------

interface PlatformConfig {
  label: string;
  icon: React.ReactNode;
  accentClass: string;
}

const PLATFORM_CONFIGS: Record<SocialPlatform, PlatformConfig> = {
  instagram: {
    label: "Instagram",
    accentClass: "from-purple-500 to-orange-400",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  tiktok: {
    label: "TikTok",
    accentClass: "from-gray-900 to-gray-700",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.26 6.26 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.84 1.56V6.79a4.85 4.85 0 01-1.07-.1z" />
      </svg>
    ),
  },
  youtube: {
    label: "YouTube",
    accentClass: "from-red-600 to-red-500",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  x: {
    label: "X (Twitter)",
    accentClass: "from-gray-900 to-gray-800",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  linkedin: {
    label: "LinkedIn",
    accentClass: "from-blue-700 to-blue-600",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PlatformConnectCardProps {
  platform: SocialPlatform;
  isConnected: boolean;
  account?: SocialAccount;
  onConnect: (platform: SocialPlatform) => void;
  onDisconnect: (accountId: string) => void;
}

export function PlatformConnectCard({
  platform,
  isConnected,
  account,
  onConnect,
  onDisconnect,
}: PlatformConnectCardProps) {
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const config = PLATFORM_CONFIGS[platform];

  const formattedDate = account?.last_synced_at
    ? new Date(account.last_synced_at).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <article className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      {/* Platform icon header */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white ${config.accentClass}`}
          aria-hidden="true"
        >
          {config.icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{config.label}</h2>
          <p className={`text-xs font-medium ${isConnected ? "text-green-500" : "text-gray-400"}`}>
            {isConnected ? "Connecté" : "Non connecté"}
          </p>
        </div>
      </div>

      {/* Content */}
      {isConnected && account ? (
        <div className="flex-1 space-y-3">
          {account.username && (
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              @{account.username}
            </p>
          )}
          <div className="flex gap-4">
            {account.followers !== undefined && (
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {account.followers.toLocaleString("fr-FR")}
                </p>
                <p className="text-xs text-gray-400">Abonnés</p>
              </div>
            )}
            {account.engagement_rate !== undefined && (
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {account.engagement_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400">Taux d&apos;engagement</p>
              </div>
            )}
          </div>
          {formattedDate && (
            <p className="text-xs text-gray-400">Synchro : {formattedDate}</p>
          )}

          {/* Actions */}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onConnect(platform)}
              className="flex-1 rounded-lg border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
            >
              Synchroniser
            </button>
            {confirmDisconnect ? (
              <button
                type="button"
                onClick={() => { onDisconnect(account.id); setConfirmDisconnect(false); }}
                className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white hover:bg-red-600"
              >
                Confirmer
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDisconnect(true)}
                className="flex-1 rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
              >
                Déconnecter
              </button>
            )}
          </div>
          {confirmDisconnect && (
            <p className="text-xs text-red-500">Cette action est irréversible.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <p className="mb-4 flex-1 text-xs text-gray-500 dark:text-gray-400">
            Connectez votre compte pour activer l&apos;analyse d&apos;audience
          </p>
          <button
            type="button"
            onClick={() => onConnect(platform)}
            className={`w-full rounded-xl bg-gradient-to-r py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${config.accentClass}`}
          >
            Connecter {config.label}
          </button>
        </div>
      )}
    </article>
  );
}
