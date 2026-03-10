"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/app/(app)/projects/[id]/page.tsx
// ============================================================

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useProject, useProjects } from "@/hooks/useProjects";
import useLeads from "@/hooks/useLeads";
import useCampaigns from "@/hooks/useCampaigns";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { LeadTable } from "@/components/features/leads/LeadTable";
import { EmptyState } from "@/components/ui/EmptyState";

type Tab = "leads" | "content" | "campaigns";

export default function ProjectDetailPage() {
  const params   = useParams<{ id: string }>();
  const router   = useRouter();
  const projectId = params.id;

  const { project, isLoading }        = useProject(projectId);
  const { deleteProject, updateProject } = useProjects();
  const { leads, isLoading: leadsLoading } = useLeads(projectId);
  const { campaigns, isLoading: campsLoading } = useCampaigns(projectId);

  const [activeTab, setActiveTab] = useState<Tab>("leads");
  const [deleteModal, setDeleteModal] = useState(false);
  const [editModal,   setEditModal]   = useState(false);
  const [editName,    setEditName]    = useState("");
  const [isDeleting,  setIsDeleting]  = useState(false);
  const [isUpdating,  setIsUpdating]  = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <Skeleton variant="text" width="300px" height="28px" />
        <Skeleton variant="text" width="200px" />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        icon="🔍"
        title="Projet introuvable"
        description="Ce projet n'existe pas ou a été supprimé."
        action={{ label: "Retour aux projets", onClick: () => router.push("/projects") }}
      />
    );
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteProject(projectId);
      router.replace("/projects");
    } finally {
      setIsDeleting(false);
      setDeleteModal(false);
    }
  }

  async function handleEdit() {
    if (!editName.trim()) return;
    setIsUpdating(true);
    try {
      await updateProject(projectId, { name: editName });
      setEditModal(false);
    } finally {
      setIsUpdating(false);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "leads",     label: "Leads" },
    { key: "content",   label: "Contenu" },
    { key: "campaigns", label: "Campagnes" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {project.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {project.sector && (
              <Badge variant="info">{project.sector}</Badge>
            )}
            {project.tone && (
              <Badge variant="neutral">{project.tone}</Badge>
            )}
            <span className="text-xs text-gray-400">
              Créé le {new Date(project.created_at).toLocaleDateString("fr-FR")}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEditName(project.name); setEditModal(true); }}
            aria-label="Modifier le projet"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Modifier
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeleteModal(true)}
            aria-label="Supprimer le projet"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div role="tablist" className="flex gap-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={[
                "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === key
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panels */}
      <div role="tabpanel">
        {activeTab === "leads" && (
          <LeadTable
            leads={leads ?? []}
            isLoading={leadsLoading}
          />
        )}
        {activeTab === "content" && (
          <EmptyState
            icon="✨"
            title="Contenu généré"
            description="Accédez au générateur de contenu pour ce projet."
            action={{ label: "Générer du contenu", onClick: () => router.push("/content") }}
          />
        )}
        {activeTab === "campaigns" && (
          <div className="flex flex-col gap-3">
            {campsLoading && <Skeleton variant="text" />}
            {!campsLoading && (campaigns ?? []).length === 0 && (
              <EmptyState
                icon="📧"
                title="Aucune campagne"
                description="Créez votre première campagne email pour ce projet."
                action={{ label: "Nouvelle campagne", onClick: () => router.push("/campaigns") }}
              />
            )}
            {!campsLoading && (campaigns ?? []).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
              >
                <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                <Badge
                  variant={
                    c.status === "active" ? "success"
                    : c.status === "completed" ? "neutral"
                    : "warning"
                  }
                >
                  {c.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Modal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        title="Modifier le projet"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setEditModal(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={isUpdating}
              onClick={handleEdit}
            >
              Sauvegarder
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Nom du projet
          </span>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Supprimer le projet"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setDeleteModal(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={isDeleting}
              onClick={handleDelete}
            >
              Supprimer définitivement
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Êtes-vous sûr de vouloir supprimer{" "}
          <strong className="text-gray-900 dark:text-white">{project.name}</strong> ?
          Cette action est irréversible.
        </p>
      </Modal>
    </div>
  );
}
