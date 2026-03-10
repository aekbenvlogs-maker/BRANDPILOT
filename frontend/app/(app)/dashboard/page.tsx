"use client";

import useSWR from "swr";
import Link from "next/link";
import { Users, FolderOpen, Mail, TrendingUp, ArrowRight, Plus, BarChart2 } from "lucide-react";
import { apiFetch } from "@/utils/api";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

interface DashboardStats {
  active_projects: number;
  total_leads: number;
  active_campaigns: number;
  avg_open_rate: number;
}

interface ActivityEvent {
  id: string;
  type: string;
  label: string;
  created_at: string;
}

interface RecentProject {
  id: string;
  name: string;
  sector?: string;
  created_at: string;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-6 w-6 text-white" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useSWR<DashboardStats>(
    "/api/v1/dashboard/stats",
    (url: string) => apiFetch<DashboardStats>(url),
    { revalidateOnFocus: true },
  );
  const { data: activity, isLoading: activityLoading } = useSWR<{ items: ActivityEvent[] }>(
    "/api/v1/dashboard/activity",
    (url: string) => apiFetch<{ items: ActivityEvent[] }>(url),
    { revalidateOnFocus: true },
  );
  const { data: projectsData, isLoading: projectsLoading } = useSWR<{ items: RecentProject[] }>(
    "/api/v1/projects?limit=3&order=desc",
    (url: string) => apiFetch<{ items: RecentProject[] }>(url),
  );

  const kpis = [
    { icon: FolderOpen, label: "Projets actifs",         value: statsLoading ? "…" : (stats?.active_projects ?? 0),                     color: "bg-indigo-500" },
    { icon: Users,      label: "Total Leads",             value: statsLoading ? "…" : (stats?.total_leads ?? 0),                          color: "bg-violet-500" },
    { icon: Mail,       label: "Campagnes actives",       value: statsLoading ? "…" : (stats?.active_campaigns ?? 0),                     color: "bg-emerald-500" },
    { icon: TrendingUp, label: "Taux d'ouverture moyen", value: statsLoading ? "…" : `${((stats?.avg_open_rate ?? 0) * 100).toFixed(1)}%`, color: "bg-amber-500" },
  ];

  return (
    <main className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">BRANDPILOT — AI Brand Scaling Platform</p>
      </div>

      {/* KPI cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : kpis.map((k) => <KpiCard key={k.label} {...k} />)
        }
      </section>

      {/* Recent projects + Quick actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent projects (2/3) */}
        <section className="col-span-2 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Projets récents</h2>
            <Link href="/projects" className="flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400">
              Voir tous <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {projectsLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="text" />)}
          {!projectsLoading && (projectsData?.items ?? []).length === 0 && (
            <EmptyState icon="📁" title="Aucun projet" description="Créez votre premier projet." />
          )}
          {!projectsLoading && (projectsData?.items ?? []).map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</p>
                {p.sector && <p className="text-xs text-gray-400">{p.sector}</p>}
              </div>
              <span className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString("fr-FR")}</span>
            </Link>
          ))}
        </section>

        {/* Quick actions (1/3) */}
        <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h2 className="font-semibold text-gray-900 dark:text-white">Actions rapides</h2>
          <Link href="/content">
            <Button variant="primary" size="md" className="w-full justify-start gap-2">
              <BarChart2 className="h-4 w-4" aria-hidden="true" /> Générer du contenu
            </Button>
          </Link>
          <Link href="/leads?action=add">
            <Button variant="secondary" size="md" className="w-full justify-start gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter un lead
            </Button>
          </Link>
          <Link href="/campaigns?action=new">
            <Button variant="ghost" size="md" className="w-full justify-start gap-2">
              <Mail className="h-4 w-4" aria-hidden="true" /> Nouvelle campagne
            </Button>
          </Link>
        </section>
      </div>

      {/* Activity */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">Activité récente</h2>
        {activityLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="text" />)}
          </div>
        )}
        {!activityLoading && (activity?.items ?? []).length === 0 && (
          <EmptyState icon="📋" title="Aucune activité" description="Votre historique d'activité apparaîtra ici." />
        )}
        {!activityLoading && (activity?.items ?? []).length > 0 && (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {(activity?.items ?? []).slice(0, 10).map((ev) => (
              <li key={ev.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-gray-700 dark:text-gray-300">{ev.label}</span>
                <span className="text-xs text-gray-400">{new Date(ev.created_at).toLocaleString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

