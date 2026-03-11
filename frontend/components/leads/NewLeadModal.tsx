"use client";
// ============================================================
// PROJECT      : BRANDSCALE
// FILE         : frontend/components/leads/NewLeadModal.tsx
// DESCRIPTION  : Create lead modal with RGPD checkbox + auto-scoring trigger
// ============================================================

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { apiPost } from "@/utils/api";
import { scoringApi } from "@/utils/api";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const newLeadSchema = z.object({
  first_name: z.string().optional(),
  last_name:  z.string().optional(),
  email:      z.string().email("Email invalide"),
  phone:      z.string().optional(),
  company:    z.string().optional(),
  source:     z.string().optional(),
  budget:     z.string().optional(),
  notes:      z.string().optional(),
  opt_in: z
    .boolean()
    .refine((v) => v === true, {
      message: "Vous devez accepter pour créer ce lead",
    }),
});

type NewLeadFormData = z.infer<typeof newLeadSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeadCreatedResponse {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  source: string | null;
  opt_in: boolean;
  score: number | null;
  score_tier: "hot" | "warm" | "cold" | null;
  project_id: string;
  created_at: string;
}

export interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Required by the backend to associate the lead with a project */
  projectId: string;
  /** Called with the newly created lead's id right after creation */
  onCreated: (leadId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewLeadModal({
  isOpen,
  onClose,
  projectId,
  onCreated,
}: NewLeadModalProps) {
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NewLeadFormData>({
    resolver: zodResolver(newLeadSchema),
    defaultValues: { opt_in: false },
  });

  const optIn = watch("opt_in");

  async function onSubmit(data: NewLeadFormData) {
    setApiError(null);
    try {
      // Only send fields the backend knows about
      const payload = {
        project_id: projectId,
        email:      data.email,
        first_name: data.first_name ?? null,
        last_name:  data.last_name  ?? null,
        company:    data.company    ?? null,
        source:     data.source     ?? null,
        opt_in:     data.opt_in,
        consent_source: "manual_form",
      };

      const created = await apiPost<LeadCreatedResponse>(
        "/api/v1/leads",
        payload,
      );

      // Trigger scoring asynchronously — don't block the modal close
      scoringApi
        .post<{ task_id: string }>(`/score/${created.id}`)
        .catch(() => {
          /* scoring endpoint may not exist yet — silent fail */
        });

      onCreated(created.id);
      reset();
      onClose();
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : "Erreur lors de la création",
      );
    }
  }

  function handleClose() {
    reset();
    setApiError(null);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Ajouter un lead"
      maxWidth="max-w-xl"
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="md" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={isSubmitting}
            disabled={!optIn || isSubmitting}
            title={!optIn ? "Cochez le consentement RGPD pour activer" : undefined}
            onClick={() => void handleSubmit(onSubmit)()}
          >
            Créer
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => { e.preventDefault(); void handleSubmit(onSubmit)(); }}
        noValidate
        className="flex flex-col gap-4"
      >
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" register={register("first_name")} />
          <Input label="Nom"    register={register("last_name")} />
        </div>

        {/* Email */}
        <Input
          label="Email *"
          type="email"
          error={errors.email?.message}
          register={register("email")}
        />

        {/* Phone + Company */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Téléphone" type="tel"  register={register("phone")} />
          <Input label="Entreprise"             register={register("company")} />
        </div>

        {/* Source + Budget */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Source"   register={register("source")} />
          <Input label="Budget €" type="text"  register={register("budget")} />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="new-lead-notes"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Notes
          </label>
          <textarea
            id="new-lead-notes"
            rows={3}
            {...register("notes")}
            className="resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* RGPD opt-in — required */}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <input
            type="checkbox"
            {...register("opt_in")}
            className="mt-0.5 h-4 w-4 accent-indigo-500"
            aria-describedby="opt-in-text"
          />
          <span
            id="opt-in-text"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            J&apos;accepte d&apos;être contacté par email{" "}
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              (RGPD obligatoire)
            </span>
          </span>
        </label>
        {errors.opt_in && (
          <p role="alert" className="text-xs text-red-500">
            {errors.opt_in.message}
          </p>
        )}

        {/* API error */}
        {apiError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {apiError}
          </p>
        )}
      </form>
    </Modal>
  );
}

export default NewLeadModal;
