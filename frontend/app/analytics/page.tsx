"use client";

import { Suspense } from "react";
import { AnalyticsCharts } from "@/components/AnalyticsCharts";
import useAnalytics from "@/hooks/useAnalytics";
import { formatPercent, formatNumber } from "@/utils/formatters";

export default function AnalyticsPage() {
  const { summary, isLoading } = useAnalytics();

  return (
    <main className="flex min-h-screen flex-col gap-8 p-8">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
        Analytics
      </h1>

      {isLoading && (
        <p className="text-sm text-neutral-400">Loading analytics…</p>
      )}

      {summary && (
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <p className="text-sm text-neutral-500">Emails sent</p>
            <p className="mt-1 text-3xl font-bold">
              {formatNumber(summary.total_emails_sent)}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <p className="text-sm text-neutral-500">Open rate</p>
            <p className="mt-1 text-3xl font-bold">
              {formatPercent(summary.avg_open_rate)}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <p className="text-sm text-neutral-500">Click rate</p>
            <p className="mt-1 text-3xl font-bold">
              {formatPercent(summary.avg_click_rate)}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <p className="text-sm text-neutral-500">Conversion rate</p>
            <p className="mt-1 text-3xl font-bold">
              {formatPercent(summary.avg_conversion_rate)}
            </p>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-4 text-lg font-semibold">All campaigns</h2>
        <Suspense
          fallback={<p className="text-sm text-neutral-400">Loading charts…</p>}
        >
          <AnalyticsCharts />
        </Suspense>
      </section>
    </main>
  );
}
