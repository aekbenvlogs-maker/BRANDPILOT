// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/app/(app)/planner/page.tsx
// ============================================================
"use client";

import React from "react";
import Link from "next/link";
import { CalendarDays, Plus, Loader2 } from "lucide-react";
import { useSocialCampaigns } from "@/hooks/useSocialCampaign";
import { useProjects } from "@/hooks/useProjects";

function CampaignStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    draft: "bg-gray-100 text-gray-500 dark:bg-gray-800",
    completed: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    paused: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  };
  const labels: Record<string, string> = {
    active: "Active",
    draft: "Brouillon",
    completed: "Terminée",
    paused: "En pause",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.draft}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function PlannerPage() {
  const { projects } = useProjects();
  const projectId = projects?.[0]?.id ?? null;
  const { campaigns, isLoading } = useSocialCampaigns(projectId);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
            <CalendarDays className="h-6 w-6 text-indigo-500" />
            Planificateur de campagnes
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez vos campagnes sociales et planifiez vos publications.
          </p>
        </div>
        <button
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          aria-label="Créer une nouvelle campagne"
        >
          <Plus className="h-4 w-4" />
          Nouvelle campagne
        </button>
      </div>

      {/* Campaigns list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" aria-label="Chargement des campagnes" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-200 py-16 text-center dark:border-gray-700">
          <CalendarDays className="h-12 w-12 text-gray-300" />
          <div>
            <h2 className="font-semibold text-gray-700 dark:text-gray-200">Aucune campagne</h2>
            <p className="mt-1 text-sm text-gray-400">Créez votre première campagne pour commencer à planifier.</p>
          </div>
          <button className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            <Plus className="h-4 w-4" />
            Créer une campagne
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/planner/${c.id}`}
              className="group flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-gray-900 group-hover:text-indigo-600 dark:text-gray-100 dark:group-hover:text-indigo-400">
                  {c.name}
                </h2>
                <CampaignStatusBadge status={c.status} />
              </div>
              {c.description && (
                <p className="text-sm text-gray-500 line-clamp-2">{c.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {new Date(c.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  {" → "}
                  {new Date(c.end_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span>
                  {c.published_posts}/{c.total_posts} publiés
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: c.total_posts > 0 ? `${(c.published_posts / c.total_posts) * 100}%` : "0%" }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
