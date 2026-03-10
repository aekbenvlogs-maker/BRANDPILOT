// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/app/(app)/analytics/social/page.tsx
// ============================================================
"use client";

import React, { useState } from "react";
import { BarChart2, Sparkles, TrendingUp, Users, Eye, MousePointerClick, RefreshCw } from "lucide-react";
import { useGlobalSocialStats } from "@/hooks/useSocialAnalytics";
import { EngagementChart } from "@/components/features/analytics/EngagementChart";
import { useProjects } from "@/hooks/useProjects";
import type { AnalyticsPlatform } from "@/hooks/useSocialAnalytics";

// ──────────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────────
const PERIODS = [
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
];

const PLATFORM_COLORS: Record<AnalyticsPlatform, string> = {
  instagram: "#a855f7",
  tiktok: "#374151",
  youtube: "#ef4444",
  x: "#6b7280",
  linkedin: "#1d4ed8",
};

// ──────────────────────────────────────────────────────────────
// KPI CARD
// ──────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  change?: string;
  positive?: boolean;
}
function KpiCard({ label, value, icon, change, positive }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
        <span className="text-indigo-400">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{value}</p>
      {change && (
        <p className={`text-xs font-medium ${positive ? "text-green-600" : "text-red-500"}`}>
          {positive ? "+" : ""}{change} vs période précédente
        </p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// SKELETON
// ──────────────────────────────────────────────────────────────
function AnalyticsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
      </div>
      <div className="h-56 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      <div className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// PAGE
// ──────────────────────────────────────────────────────────────
export default function SocialAnalyticsPage() {
  const { projects } = useProjects();
  const projectId = projects?.[0]?.id ?? null;
  const [period, setPeriod] = useState("30d");
  const { stats, isLoading, error } = useGlobalSocialStats(projectId, period);

  const formatNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString("fr-FR");
  };

  // Build growth chart series from stats
  const growthSeries = stats?.growth_chart
    ? [{ platform: "instagram" as AnalyticsPlatform, data: stats.growth_chart, color: "#6366f1" }]
    : [];

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
            <BarChart2 className="h-6 w-6 text-indigo-500" />
            Analytics Social
          </h1>
          <p className="mt-1 text-sm text-gray-500">Vue globale de vos performances sur tous les réseaux.</p>
        </div>
        {/* Period selector */}
        <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              aria-pressed={period === p.value}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                period === p.value
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"
                  : "bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <AnalyticsSkeleton />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400" role="alert">
          {error}
        </div>
      ) : !stats ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 py-16 text-center dark:border-gray-700">
          <BarChart2 className="h-12 w-12 text-gray-300" />
          <p className="text-sm text-gray-400">Aucune donnée analytics disponible pour ce projet.</p>
        </div>
      ) : (
        <>
          {/* 1. KPIs */}
          <section aria-labelledby="kpi-heading">
            <h2 id="kpi-heading" className="sr-only">Indicateurs clés</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <KpiCard
                label="Abonnés total"
                value={formatNum(stats.total_followers)}
                icon={<Users className="h-4 w-4" />}
              />
              <KpiCard
                label="Publications"
                value={formatNum(stats.total_posts)}
                icon={<RefreshCw className="h-4 w-4" />}
              />
              <KpiCard
                label="Taux d'engagement"
                value={`${(stats.avg_engagement_rate * 100).toFixed(2)}%`}
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <KpiCard
                label="Portée totale"
                value={formatNum(stats.total_reach)}
                icon={<Eye className="h-4 w-4" />}
              />
              <KpiCard
                label="Insights IA"
                value={`${stats.ai_insights.length} conseils`}
                icon={<Sparkles className="h-4 w-4" />}
              />
            </div>
          </section>

          {/* 2. Campaign table by platform */}
          <section aria-labelledby="platform-heading">
            <h2 id="platform-heading" className="mb-3 text-base font-semibold text-gray-800 dark:text-gray-100">
              Performance par plateforme
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    {["Plateforme", "Abonnés", "Publications", "Engagement", "Portée"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Object.entries(stats.by_platform) as [AnalyticsPlatform, typeof stats.by_platform[AnalyticsPlatform]][]).map(([platform, data], i) => (
                    <tr key={platform} className={`border-b border-gray-50 dark:border-gray-800 ${i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/30"}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[platform] }} aria-hidden="true" />
                          <span className="font-medium capitalize text-gray-700 dark:text-gray-200">{platform}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatNum(data.followers)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatNum(data.posts)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{(data.engagement_rate * 100).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatNum(data.reach)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. Top posts */}
          {/* (would require campaign analytics — skipped at global level, shown via placeholder) */}

          {/* 4. Growth Chart */}
          {growthSeries.length > 0 && (
            <section aria-labelledby="chart-heading" className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 id="chart-heading" className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-100">
                Évolution de la portée
              </h2>
              <EngagementChart series={growthSeries} yLabel="Portée journalière" />
            </section>
          )}

          {/* 5. AI Suggestions */}
          {stats.ai_insights.length > 0 && (
            <section aria-labelledby="ai-heading" className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 dark:border-indigo-900/30 dark:bg-indigo-900/10">
              <h2 id="ai-heading" className="mb-3 flex items-center gap-2 text-base font-semibold text-indigo-700 dark:text-indigo-300">
                <Sparkles className="h-4 w-4" />
                Recommandations IA
              </h2>
              <ul className="space-y-2">
                {stats.ai_insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-indigo-700 dark:text-indigo-300">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-200 text-[10px] font-bold text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200">
                      {i + 1}
                    </span>
                    {insight}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
