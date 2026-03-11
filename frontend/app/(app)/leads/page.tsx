"use client";
// ============================================================
// PROJECT      : BRANDSCALE
// FILE         : frontend/app/(app)/leads/page.tsx
// DESCRIPTION  : Leads list page — table, modals, pagination
// ============================================================

import { Suspense, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { useProjects } from "@/hooks/useProjects";
import { apiDelete, apiPost, scoringApi } from "@/utils/api";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { LeadTable } from "@/components/leads/LeadTable";
import { NewLeadModal } from "@/components/leads/NewLeadModal";
import { ImportCsvModal } from "@/components/leads/ImportCsvModal";

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Inner component (needs useSearchParams — must be inside Suspense)
// ---------------------------------------------------------------------------

function LeadsContent() {
  const router  = useRouter();
  const params  = useSearchParams();
  const autoAdd = params.get("action") === "add";

  // ── Project selection ─────────────────────────────────────────────────────
  const { projects, isLoading: projectsLoading } = useProjects();
  const [projectId, setProjectId] = useState<string>("");

  const activeProject =
    projectId || (projects.length === 1 ? projects[0].id : "");

  // ── Leads data ────────────────────────────────────────────────────────────
  const { leads, total, isLoading, mutate } = useLeads(
    activeProject ? { project_id: activeProject, page_size: PAGE_SIZE } : undefined,
  );

  // ── UI state ──────────────────────────────────────────────────────────────
  const [addModal,   setAddModal]   = useState(autoAdd);
  const [csvModal,   setCsvModal]   = useState(false);
  const [scoringIds, setScoringIds] = useState<Set<string>>(new Set());

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLeadCreated = useCallback(
    (leadId: string) => {
      setScoringIds((prev) => new Set(prev).add(leadId));
      void mutate();
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        void mutate().then((resp) => {
          // Use the fresh response from mutate — never the stale closure value
          const found = resp?.items.find((l) => l.id === leadId);
          if ((found !== undefined && found.score !== null) || attempts >= 15) {
            clearInterval(poll);
            setScoringIds((prev) => {
              const next = new Set(prev);
              next.delete(leadId);
              return next;
            });
          }
        });
      }, 2000);
    },
    [mutate], // `leads` removed — we read from mutate's return value
  );

  const handleRescore = useCallback(
    async (leadId: string) => {
      setScoringIds((prev) => new Set(prev).add(leadId));
      try {
        await scoringApi.post<{ task_id: string }>(`/score/${leadId}`);
      } catch {
        await apiPost(`/api/v1/leads/${leadId}/rescore`, {}).catch(() => null);
      }
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        void mutate().then(() => {
          if (attempts >= 15) {
            clearInterval(poll);
            setScoringIds((prev) => {
              const next = new Set(prev);
              next.delete(leadId);
              return next;
            });
          }
        });
      }, 2000);
    },
    [mutate],
  );

  const handleDelete = useCallback(
    async (leadId: string) => {
      if (!window.confirm("Supprimer ce lead définitivement ?")) return;
      await apiDelete(`/api/v1/leads/${leadId}`);
      await mutate();
    },
    [mutate],
  );

  const handleViewDetail = useCallback(
    (leadId: string) => router.push(`/leads/${leadId}`),
    [router],
  );

  // ── No projects ────────────────────────────────────────────────────────────
  if (!projectsLoading && projects.length === 0) {
    return (
      <main className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leads</h1>
        <EmptyState
          icon="🗂️"
          title="Aucun projet"
          description="Créez un projet pour commencer à gérer vos leads."
          action={{ label: "Démarrer l'onboarding", onClick: () => router.push("/onboarding") }}
        />
      </main>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leads</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} lead{total !== 1 ? "s" : ""} au total
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Project selector */}
          {projects.length > 1 && (
            projectsLoading ? (
              <Skeleton variant="rect" width="180px" height="36px" className="rounded-lg" />
            ) : (
              <select
                value={activeProject}
                onChange={(e) => setProjectId(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                aria-label="Sélectionner un projet"
              >
                <option value="">Tous les projets</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )
          )}
          <Button variant="ghost" size="sm" onClick={() => setCsvModal(true)}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Importer CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setAddModal(true)}
            disabled={!activeProject}
            title={!activeProject ? "Sélectionnez un projet d'abord" : undefined}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ajouter un lead
          </Button>
        </div>
      </div>

      {/* Table */}
      <LeadTable
        leads={leads}
        isLoading={isLoading}
        scoringIds={scoringIds}
        onViewDetail={handleViewDetail}
        onRescore={handleRescore}
        onDelete={handleDelete}
      />

      {/* Modals */}
      {activeProject && (
        <>
          <NewLeadModal
            isOpen={addModal}
            onClose={() => setAddModal(false)}
            projectId={activeProject}
            onCreated={handleLeadCreated}
          />
          <ImportCsvModal
            isOpen={csvModal}
            onClose={() => setCsvModal(false)}
            projectId={activeProject}
            onImported={() => void mutate()}
          />
        </>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Page shell — Suspense boundary for useSearchParams
// ---------------------------------------------------------------------------

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex animate-pulse flex-col gap-6">
          <div className="h-8 w-40 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800" />
        </div>
      }
    >
      <LeadsContent />
    </Suspense>
  );
}
