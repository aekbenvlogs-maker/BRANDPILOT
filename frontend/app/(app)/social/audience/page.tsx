// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/app/(app)/social/audience/page.tsx
// ============================================================
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { RefreshCw, Users, TrendingUp, BarChart2, Image as ImageIcon } from "lucide-react";
import { useSocialAccounts, SocialPlatform } from "@/hooks/useSocialAccounts";
import { useAudienceInsights } from "@/hooks/useAudienceInsights";
import { useProjects } from "@/hooks/useProjects";
import { AudienceMetricsCard } from "@/components/features/social/AudienceMetricsCard";
import { BestTimeHeatmap } from "@/components/features/social/BestTimeHeatmap";

// ──────────────────────────────────────────────────────────────
// PLATFORM BADGES
// ──────────────────────────────────────────────────────────────
const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
};

// ──────────────────────────────────────────────────────────────
// SKELETON
// ──────────────────────────────────────────────────────────────
function AudienceSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ACCOUNT TABS
// ──────────────────────────────────────────────────────────────
interface AccountTabsProps {
  accounts: { id: string; platform: SocialPlatform; username?: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
}

function AccountTabs({ accounts, selected, onSelect }: AccountTabsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Comptes connectés">
      {accounts.map((acc) => (
        <button
          key={acc.id}
          role="tab"
          aria-selected={selected === acc.id}
          onClick={() => onSelect(acc.id)}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            selected === acc.id
              ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
              : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          {PLATFORM_LABELS[acc.platform]}{acc.username ? ` · @${acc.username}` : ""}
        </button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// INSIGHTS PANEL
// ──────────────────────────────────────────────────────────────
function InsightsPanel({ accountId }: { accountId: string }) {
  const { insights, isLoading, error, refresh, isRefreshing, lastUpdated } = useAudienceInsights(accountId);

  const isStale =
    lastUpdated !== null && Date.now() - lastUpdated.getTime() > 24 * 60 * 60 * 1000;

  if (isLoading) return <AudienceSkeleton />;

  if (error) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400"
        role="alert"
      >
        Impossible de charger les insights pour ce compte. Veuillez réessayer.
        <button
          onClick={() => refresh()}
          disabled={isRefreshing}
          className="ml-3 font-medium underline"
        >
          Analyser maintenant
        </button>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 p-10 text-center dark:border-gray-700">
        <BarChart2 className="h-10 w-10 text-gray-300" />
        <p className="text-sm text-gray-500">Aucune donnée disponible pour ce compte.</p>
        <button
          onClick={() => refresh()}
          disabled={isRefreshing}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isRefreshing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Analyser maintenant
        </button>
      </div>
    );
  }

  const er = insights.stats.engagement_rate * 100;
  const erBenchmark = er >= 5 ? "excellent" : er >= 2 ? "good" : "low";
  const growthRate = insights.stats.growth_rate ?? 0;
  const avgReach = insights.stats.avg_reach ?? 0;
  const growthBenchmark =
    growthRate >= 10 ? "excellent" : growthRate >= 3 ? "good" : "low";

  return (
    <div className="space-y-6">
      {/* Refresh bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {lastUpdated
            ? `Mis à jour le ${lastUpdated.toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : "Données fraîches"}
          {isStale && (
            <span className="ml-2 font-medium text-amber-600">· Données anciennes</span>
          )}
        </p>
        {(isStale || !lastUpdated) && (
          <button
            onClick={() => refresh()}
            disabled={isRefreshing}
            aria-label="Relancer l'analyse d'audience"
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-900/20"
          >
            {isRefreshing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Analyser maintenant
          </button>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <AudienceMetricsCard
          label="Taux d'engagement"
          value={er.toFixed(2)}
          unit="%"
          benchmark={erBenchmark}
          tooltip="Engagement Rate = (Likes + Comments + Shares) / Followers × 100"
        />
        <AudienceMetricsCard
          label="Abonnés"
          value={
            insights.stats.followers >= 1_000_000
              ? `${(insights.stats.followers / 1_000_000).toFixed(1)}M`
              : insights.stats.followers >= 1_000
              ? `${(insights.stats.followers / 1_000).toFixed(1)}K`
              : String(insights.stats.followers)
          }
          benchmark={insights.stats.followers >= 10000 ? "excellent" : insights.stats.followers >= 1000 ? "good" : "low"}
          tooltip="Nombre total d'abonnés au dernier relevé"
        />
        <AudienceMetricsCard
          label="Croissance"
          value={`+${growthRate.toFixed(1)}`}
          unit="%"
          benchmark={growthBenchmark}
          tooltip="Croissance du nombre d'abonnés sur les 30 derniers jours"
        />
        <AudienceMetricsCard
          label="Reach moyen"
          value={
            avgReach >= 1_000
              ? `${(avgReach / 1_000).toFixed(1)}K`
              : String(avgReach)
          }
          benchmark={avgReach >= 5000 ? "excellent" : avgReach >= 500 ? "good" : "low"}
          tooltip="Portée moyenne par publication"
        />
      </div>

      {/* Price estimate */}
      {insights.price_estimate && (
        <div className="flex flex-col gap-2 rounded-xl border border-indigo-100 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-900/30 dark:bg-indigo-900/10">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-400">Valeur estimée par post sponsorisé</p>
            <p className="mt-0.5 text-2xl font-bold text-indigo-700 dark:text-indigo-300">
              {insights.price_estimate.currency === "EUR" ? "€" : "$"}
              {insights.price_estimate.min_price.toLocaleString()} – {insights.price_estimate.currency === "EUR" ? "€" : "$"}
              {insights.price_estimate.max_price.toLocaleString()}
            </p>
          </div>
          <p className="text-xs text-indigo-400">{insights.price_estimate.currency}</p>
        </div>
      )}

      {/* Heatmap */}
      {insights.best_times && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-800/50">
          <BestTimeHeatmap data={insights.best_times} />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// PAGE
// ──────────────────────────────────────────────────────────────
export default function AudiencePage() {
  const { projects } = useProjects();
  const projectId = projects?.[0]?.id ?? null;
  const { accounts, isLoading: accountsLoading } = useSocialAccounts(projectId);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // All returned accounts are connected (API only returns active accounts)
  const connectedAccounts = accounts;

  // Auto-select first account
  const activeId = selectedAccountId ?? connectedAccounts[0]?.id ?? null;

  if (accountsLoading) {
    return (
      <main className="px-4 py-8 sm:px-8" aria-busy="true">
        <AudienceSkeleton />
      </main>
    );
  }

  if (connectedAccounts.length === 0) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 py-16 text-center">
        <Users className="h-12 w-12 text-gray-300" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Aucun compte social connecté
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Connectez au moins un compte pour accéder aux insights d'audience.
          </p>
        </div>
        <Link
          href="/social/accounts"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Connecter un compte
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Insights d'audience</h1>
        <p className="text-sm text-gray-500">
          Analysez votre audience et identifiez les meilleurs créneaux de publication.
        </p>
      </div>

      {/* Account Tabs */}
      <AccountTabs
        accounts={connectedAccounts}
        selected={activeId}
        onSelect={setSelectedAccountId}
      />

      {/* Panel */}
      {activeId ? (
        <InsightsPanel accountId={activeId} />
      ) : (
        <p className="text-sm text-gray-400">Sélectionnez un compte ci-dessus.</p>
      )}
    </main>
  );
}
