"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";

const TONES = ["Formel", "Créatif", "Inspirant", "Énergique", "Professionnel", "Humour"] as const;

const projectSchema = z.object({
  name:      z.string().min(1, "Le nom est requis").max(100),
  sector:    z.string().optional(),
  tone:      z.string().optional(),
  brand_url: z.string().url("URL invalide").optional().or(z.literal("")),
});
type ProjectFormData = z.infer<typeof projectSchema>;

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, isLoading, createProject } = useProjects();
  const [modal, setModal] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
  });

  async function onSubmit(data: ProjectFormData) {
    await createProject({
      name:      data.name,
      sector:    data.sector || undefined,
      tone:      data.tone   || undefined,
      brand_url: data.brand_url || undefined,
    });
    reset();
    setModal(false);
  }

  return (
    <main className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {projects?.length ?? 0} projet{(projects?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setModal(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nouveau projet
        </Button>
      </div>

      {/* Grid */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
      {!isLoading && (projects ?? []).length === 0 && (
        <EmptyState
          icon="📁"
          title="Aucun projet"
          description="Créez votre premier projet pour commencer à générer du contenu."
          action={{ label: "Nouveau projet", onClick: () => setModal(true) }}
        />
      )}
      {!isLoading && (projects ?? []).length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects!.map((p) => (
            <div
              key={p.id}
              className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex flex-col gap-2">
                <p className="font-semibold text-gray-900 dark:text-white">{p.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.sector && <Badge variant="info">{p.sector}</Badge>}
                  {p.tone   && <Badge variant="neutral">{p.tone}</Badge>}
                </div>
                <p className="text-xs text-gray-400">
                  Créé le {new Date(p.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex w-full items-center justify-center gap-1"
                  onClick={() => router.push(`/projects/${p.id}`)}
                >
                  Ouvrir <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create project modal */}
      <Modal
        isOpen={modal}
        onClose={() => { setModal(false); reset(); }}
        title="Nouveau projet"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => { setModal(false); reset(); }}>
              Annuler
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={isSubmitting}
              onClick={handleSubmit(onSubmit)}
            >
              Créer le projet
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Nom du projet *"
            placeholder="ex: Campagne printemps 2025"
            error={errors.name?.message}
            register={register("name")}
          />
          <Input
            label="Secteur"
            placeholder="ex: Mode, Tech, Alimentation..."
            register={register("sector")}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tonalité
            </label>
            <select
              {...register("tone")}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">Sélectionner une tonalité</option>
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Input
            label="URL de la marque"
            type="url"
            placeholder="https://example.com"
            error={errors.brand_url?.message}
            register={register("brand_url")}
          />
        </div>
      </Modal>
    </main>
  );
}
