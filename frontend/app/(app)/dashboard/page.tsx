"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Sparkles,
  Mail,
  TrendingUp,
  Plus,
  ArrowRight,
  Activity,
  CheckCircle2,
  Star,
  SendHorizontal,
} from "lucide-react";
import { useDashboardStats } from "@/hooks/useAnalytics";
import type { ActivityItem } from "@/hooks/useAnalytics";
import { useProjects } from "@/hooks/useProjects";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days}j`;
}

const ACTIVITY_ICON_MAP: Record<string, React.ElementType> = {
  lead_created:      Users,
  content_generated: Sparkles,
  campaign_started:  SendHorizontal,
  campaign_ended:    CheckCircle2,
  lead_scored:       Star,
};

function activityIcon(type: string): React.ElementType {
  return ACTIVITY_ICON_MAP[type] ?? Activity;
}

// ---------------------------------------------------------------------------
// KpiCard — valeur + badge de variation mensuelle
// ---------------------------------------------------------------------------

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  /** bg-* color class for the icon chip */
  color: string;
  /** Month-over-month delta in %; green if ≥ 0, red if negative */
  delta?: number;
}

function KpiCard({ icon: Icon, label, value, color, delta }: KpiCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div
        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${color}`}
        aria-hidden="true"
      >
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {delta !== undefined && (
            <span
              className={`text-xs font-semibold ${
                delta >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-500 dark:text-red-400"
              }`}
              title="Variation vs mois précédent"
            >
              {delta >= 0 ? "▲" : "▼"}&nbsp;{Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivitySkeletonRow — placeholder during loading
// ---------------------------------------------------------------------------

function ActivitySkeletonRow() {
  return (
    <li className="flex items-center gap-3 py-3" aria-hidden="true">
      <Skeleton variant="circle" className="h-8 w-8 flex-shrink-0" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton variant="text" width="65%" />
        <Skeleton variant="text" width="25%" />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const { stats, isLoading: statsLoading } = useDashboardStats();
  const { projects, isLoading: projectsLoading } = useProjects();

  const noProjects = !projectsLoading && projects.length === 0;

  const kpis: KpiCardProps[] = [
    {
      icon:  Users,
      label: "Leads ce mois",
      value: statsLoading ? "…" : (stats?.total_leads ?? 0),
      color: "bg-indigo-500",
      delta: stats?.delta_leads,
    },
    {
      icon:  Sparkles,
      label: "Contenu généré",
      value: statsLoading ? "…" : (stats?.content_generated ?? stats?.total_emails_sent ?? 0),
      color: "bg-violet-500",
      delta: stats?.delta_content,
    },
    {
      icon:  Mail,
      label: "Campagnes actives",
      value: statsLoading ? "…" : (stats?.active_campaigns ?? 0),
      color: "bg-emerald-500",
      delta: stats?.delta_campaigns,
    },
    {
      icon:  TrendingUp,
      label: "Taux de conversion",
      value: statsLoading ? "…" : `${(stats?.avg_ctr ?? 0).toFixed(1)}%`,
      color: "bg-amber-500",
      delta: stats?.delta_conversion,
    },
  ];

  const activity: ActivityItem[] = stats?.recent_activity ?? [];

  // ── Empty state — no projects yet ──────────────────────────────────────────
  if (noProjects) {
    return (
      <main className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            BRANDSCALE — AI Brand Scaling Platform
          </p>
        </div>

        <div className="flex items-center justify-center py-24">
          <div className="max-w-sm rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <Sparkles
              className="mx-auto mb-4 h-12 w-12 text-indigo-400"
              aria-hidden="true"
            />
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Créez votre premier projet
            </h2>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Commencez à générer des leads, du contenu et des campagnes personnalisées.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={() => router.push("/onboarding")}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Démarrer l&apos;onboarding
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <main className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          BRANDSCALE — AI Brand Scaling Platform
        </p>
      </div>

      {/* ── KPI grid: 4 cols desktop / 2 tablet / 1 mobile ── */}
      <section
        aria-label="Indicateurs clés de performance"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </section>

      {/* ── Activité récente (2/3) + Quick actions (1/3) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Activité récente — col-span-2 */}
        <section
          aria-label="Activité récente"
          className="col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">
            Activité récente
          </h2>

          {/* Skeleton — 10 rows */}
          {statsLoading && (
            <ul aria-busy="true" className="divide-y divide-gray-100 dark:divide-gray-800">
              {Array.from({ length: 10 }).map((_, i) => (
                <ActivitySkeletonRow key={i} />
              ))}
            </ul>
          )}

          {/* Empty state */}
          {!statsLoading && activity.length === 0 && (
            <EmptyState
              icon={<Activity className="h-10 w-10" />}
              title="Aucune activité récente"
              description="Vos dernières actions apparaîtront ici dès que vous commencerez à travailler."
            />
          )}

          {/* Activity list */}
          {!statsLoading && activity.length > 0 && (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {activity.slice(0, 10).map((ev) => {
                const EvIcon = activityIcon(ev.type);
                return (
                  <li key={ev.id} className="flex items-center gap-3 py-3">
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
                      aria-hidden="true"
                    >
                      <EvIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </span>
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                      {ev.label}
                    </span>
                    <time
                      dateTime={ev.created_at}
                      className="whitespace-nowrap text-xs text-gray-400"
                    >
                      {timeAgo(ev.created_at)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Quick Actions — col-span-1 */}
        <section
          aria-label="Actions rapides"
          className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <h2 className="font-semibold text-gray-900 dark:text-white">Actions rapides</h2>

          <Link href="/content/new" className="block">
            <Button variant="primary" size="md" className="w-full justify-start gap-2">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Générer du contenu
            </Button>
          </Link>

          <Link href="/leads/new" className="block">
            <Button variant="secondary" size="md" className="w-full justify-start gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Ajouter un lead
            </Button>
          </Link>

          <Link href="/campaigns/new" className="block">
            <Button variant="ghost" size="md" className="w-full justify-start gap-2">
              <Mail className="h-4 w-4" aria-hidden="true" />
              Nouvelle campagne
            </Button>
          </Link>

          <hr className="my-1 border-gray-100 dark:border-gray-800" />

          <Link
            href="/analytics"
            className="flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Voir les analytics
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </main>
  );
}
