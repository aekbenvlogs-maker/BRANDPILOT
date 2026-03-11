"use client";

import useSWR from "swr";
import Link from "next/link";
import {
  BarChart2,
  Mail,
  TrendingUp,
  MousePointerClick,
  ArrowRight,
} from "lucide-react";
import { apiFetch } from "@/utils/api";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnalyticsCharts } from "@/components/AnalyticsCharts";
import { formatPercent, formatNumber } from "@/utils/formatters";

interface DashboardAnalytics {
  total_emails_sent: number;
  avg_open_rate: number;
  avg_ctr: number;
  total_conversions: number;
  active_campaigns: number;
  total_leads: number;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div
        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${color}`}
      >
        <Icon className="h-6 w-6 text-white" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading, error } = useSWR<DashboardAnalytics>(
    "/api/v1/analytics/summary",
    (url: string) => apiFetch<DashboardAnalytics>(url),
    { revalidateOnFocus: true },
  );

  const kpis: Array<{
    icon: React.ElementType;
    label: string;
    value: string;
    color: string;
  }> = [
    {
      icon: Mail,
      label: "Emails envoyés",
      value: formatNumber(data?.total_emails_sent),
      color: "bg-indigo-500",
    },
    {
      icon: BarChart2,
      label: "Taux d'ouverture moyen",
      value: formatPercent(data?.avg_open_rate),
      color: "bg-emerald-500",
    },
    {
      icon: MousePointerClick,
      label: "Taux de clic moyen",
      value: formatPercent(data?.avg_ctr),
      color: "bg-violet-500",
    },
    {
      icon: TrendingUp,
      label: "Taux de conversion",
      value: formatNumber(data?.total_conversions),
      color: "bg-amber-500",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Analytics
        </h1>
        <Link
          href="/analytics/social"
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Analytics Social
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
        >
          Impossible de charger les données analytics. Veuillez réessayer.
        </div>
      )}

      {/* KPI cards */}
      <section
        aria-label="Indicateurs clés"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : kpis.map(({ icon, label, value, color }) => (
              <KpiCard
                key={label}
                icon={icon}
                label={label}
                value={value}
                color={color}
              />
            ))}
      </section>

      {/* Charts */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Performance par campagne
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton variant="rect" height="280px" />
          </div>
        ) : !data ? null : (
          <AnalyticsCharts />
        )}
        {!isLoading && data?.total_emails_sent === 0 && (
          <EmptyState
            icon={<BarChart2 className="h-8 w-8" aria-hidden="true" />}
            title="Aucune donnée disponible"
            description="Lancez une campagne email pour voir les statistiques ici."
          />
        )}
      </section>
    </div>
  );
}
