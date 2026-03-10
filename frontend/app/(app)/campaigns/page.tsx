"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Mail, Users, MousePointerClick, FolderOpen } from "lucide-react";
import useCampaigns from "@/hooks/useCampaigns";
import useLeads from "@/hooks/useLeads";
import { useProjects } from "@/hooks/useProjects";
import { apiFetch } from "@/utils/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CampaignForm, type CampaignFormData } from "@/components/features/campaigns/CampaignForm";

function statusVariant(status: string): "success" | "warning" | "neutral" | "error" {
  if (status === "active")    return "success";
  if (status === "completed") return "neutral";
  if (status === "failed")    return "error";
  return "warning"; // draft / pending
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "Brouillon", active: "Active", completed: "Terminée", failed: "Échouée",
  };
  return map[status] ?? status;
}

function CampaignsContent() {
  const searchParams = useSearchParams();
  const autoNew = searchParams.get("action") === "new";

  const { projects, isLoading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Resolve: if only one project exists, auto-select it
  const effectiveProjectId = selectedProjectId || (projects.length === 1 ? projects[0].id : "");

  const { campaigns, isLoading, mutate } = useCampaigns(effectiveProjectId || undefined);
  const { leads, isLoading: leadsLoading } = useLeads(effectiveProjectId || undefined);
  const [modal, setModal] = useState(autoNew);

  async function onCreateCampaign(data: CampaignFormData) {
    if (!effectiveProjectId) return;
    await apiFetch("/api/v1/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        project_id: effectiveProjectId,
        channel: "email",
      }),
    });
    setModal(false);
    await mutate();
  }

  return (
    <main className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campagnes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{campaigns?.length ?? 0} campagne{(campaigns?.length ?? 0) !== 1 ? "s" : ""}</p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setModal(true)}
          disabled={!effectiveProjectId}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Nouvelle campagne
        </Button>
      </div>

      {/* Project selector (shown when multiple projects exist) */}
      {!projectsLoading && projects.length > 1 && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <FolderOpen className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <label htmlFor="project-select" className="shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
            Projet
          </label>
          <select
            id="project-select"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="">— Sélectionner un projet —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* No projects at all */}
      {!projectsLoading && projects.length === 0 && (
        <EmptyState
          icon="📁"
          title="Aucun projet"
          description="Créez d'abord un projet pour pouvoir gérer des campagnes."
        />
      )}

      {/* Multiple projects but none selected */}
      {!projectsLoading && projects.length > 1 && !effectiveProjectId && (
        <p className="py-8 text-center text-sm text-gray-400">
          Sélectionnez un projet pour voir ses campagnes.
        </p>
      )}
      {effectiveProjectId && (
        <>
      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="text" height="72px" />)}
        </div>
      )}
      {!isLoading && (campaigns ?? []).length === 0 && (
        <EmptyState
          icon="📧"
          title="Aucune campagne"
          description="Créez votre première campagne email pour engager vos leads."
          action={{ label: "Nouvelle campagne", onClick: () => setModal(true) }}
        />
      )}
      {!isLoading && (campaigns ?? []).map((c) => (
        <div
          key={c.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex flex-col gap-0.5">
            <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
            <p className="text-xs text-gray-400">
              {c.launched_at ? `Lancée le ${new Date(c.launched_at).toLocaleDateString("fr-FR")}` : `Créée le ${new Date(c.created_at).toLocaleDateString("fr-FR")}`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Inline stats placeholders */}
            <div className="hidden items-center gap-1 text-xs text-gray-500 sm:flex">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              <span>—</span>
            </div>
            <div className="hidden items-center gap-1 text-xs text-gray-500 sm:flex">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>—</span>
            </div>
            <div className="hidden items-center gap-1 text-xs text-gray-500 sm:flex">
              <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" />
              <span>—</span>
            </div>
            <Badge variant={statusVariant(c.status)}>{statusLabel(c.status)}</Badge>
          </div>
        </div>
      ))}

        </>
      )}

      {/* New campaign modal */}
      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title="Nouvelle campagne"
        maxWidth="max-w-2xl"
      >
        <CampaignForm
          projectId={effectiveProjectId}
          leads={leads ?? []}
          isLoading={leadsLoading}
          onSubmit={onCreateCampaign}
          onCancel={() => setModal(false)}
        />
      </Modal>
    </main>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    }>
      <CampaignsContent />
    </Suspense>
  );
}
