"use client";

import { Suspense } from "react";
import { ServiceStatusBar } from "@/components/ServiceStatusBar";
import { AnalyticsCharts } from "@/components/AnalyticsCharts";
import useAnalytics from "@/hooks/useAnalytics";
import useCampaigns from "@/hooks/useCampaigns";
import useLeads from "@/hooks/useLeads";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-neutral-900 dark:text-white">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { summary } = useAnalytics();
  const { campaigns } = useCampaigns();
  const { leads } = useLeads();

  const activeCampaigns =
    campaigns?.filter((c) => c.status === "active").length ?? 0;
  const hotLeads = leads?.filter((l) => l.score_tier === "hot").length ?? 0;

  return (
    <main className="flex min-h-screen flex-col gap-8 p-8">
      <header>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-sm text-neutral-500">
          BRANDSCALE — AI Brand Scaling Platform
        </p>
      </header>

      <ServiceStatusBar />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total leads"
          value={leads?.length ?? "—"}
          sub="All imported leads"
        />
        <StatCard label="Hot leads" value={hotLeads} sub="Score ≥ 70" />
        <StatCard
          label="Active campaigns"
          value={activeCampaigns}
          sub="Currently running"
        />
        <StatCard
          label="Avg open rate"
          value={
            summary?.avg_open_rate != null
              ? `${(summary.avg_open_rate * 100).toFixed(1)}%`
              : "—"
          }
          sub="All campaigns"
        />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-4 text-lg font-semibold">Campaign performance</h2>
        <Suspense
          fallback={<p className="text-sm text-neutral-400">Loading charts…</p>}
        >
          <AnalyticsCharts />
        </Suspense>
      </section>
    </main>
  );
}
