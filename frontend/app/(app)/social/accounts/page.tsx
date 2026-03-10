// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/app/(app)/social/accounts/page.tsx
// ============================================================
"use client";

import React, { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSocialAccounts, type SocialPlatform } from "@/hooks/useSocialAccounts";
import { PlatformConnectCard } from "@/components/features/social/PlatformConnectCard";
import { useProjects } from "@/hooks/useProjects";

const PLATFORMS: SocialPlatform[] = ["instagram", "tiktok", "youtube", "x", "linkedin"];

function SocialAccountsContent() {
  const { projects } = useProjects();
  const projectId = projects?.[0]?.id ?? null;
  const { accounts, isLoading, connectAccount, disconnectAccount } = useSocialAccounts(projectId);

  // Detect OAuth callback success (added by the backend redirect)
  const searchParams = useSearchParams();
  const oauthStatus = searchParams.get("oauth_status");

  // ── Toast state ────────────────────────────────────────────
  const [toast, setToast] = React.useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (oauthStatus === "success") {
      setToast({ msg: "Compte connecté avec succès !", type: "success" });
      setTimeout(() => setToast(null), 4000);
    } else if (oauthStatus === "error") {
      setToast({ msg: "Échec de la connexion OAuth.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    }
  }, [oauthStatus]);

  function getAccount(platform: SocialPlatform) {
    return accounts.find((a) => a.platform === platform);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={[
            "fixed right-4 top-20 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg transition",
            toast.type === "success" ? "bg-green-500" : "bg-red-500",
          ].join(" ")}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Réseaux sociaux connectés
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Connectez vos comptes pour débloquer l&apos;analyse d&apos;audience personnalisée
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-8 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-300">
        <span aria-hidden="true">💡</span>{" "}
        Vos tokens OAuth sont chiffrés et ne sont jamais exposés. Vous pouvez déconnecter un compte à tout moment.
      </div>

      {/* Platform grid */}
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORMS.map((p) => (
            <div
              key={p}
              className="h-48 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORMS.map((platform) => {
            const account = getAccount(platform);
            return (
              <PlatformConnectCard
                key={platform}
                platform={platform}
                isConnected={!!account}
                account={account}
                onConnect={connectAccount}
                onDisconnect={disconnectAccount}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}

export default function SocialAccountsPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-5xl px-4 py-8 animate-pulse">
        <div className="h-8 w-64 rounded-lg bg-gray-200 dark:bg-gray-700 mb-6" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    }>
      <SocialAccountsContent />
    </Suspense>
  );
}
