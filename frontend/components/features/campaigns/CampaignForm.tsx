"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/components/features/campaigns/CampaignForm.tsx
// ============================================================

import React from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { TierBadge } from "@/components/ui/Badge";
import type { Lead } from "@/hooks/useLeads";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const campaignSchema = z.object({
  name:         z.string().min(1, "Nom requis"),
  channel:      z.enum(["email", "sms", "push", "whatsapp"]),
  lead_ids:     z.array(z.string()),
  template:     z.enum(["welcome", "promotional", "newsletter"]),
  scheduled_at: z.string().optional(),
});

export type CampaignFormData = z.infer<typeof campaignSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CampaignFormProps {
  projectId: string;
  leads: Lead[];
  isLoading?: boolean;
  onSubmit: (data: CampaignFormData) => Promise<void>;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CampaignForm({
  projectId: _projectId,
  leads,
  isLoading = false,
  onSubmit,
  onCancel,
}: CampaignFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { lead_ids: [], template: "promotional", channel: "email" },
  });

  const selectedLeadIds = watch("lead_ids");
  const [tierFilter, setTierFilter] = React.useState<string>("all");

  const filteredLeads = tierFilter === "all"
    ? leads
    : leads.filter((l) => l.score_tier === tierFilter);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* Campaign name */}
      <Input
        label="Nom de la campagne"
        placeholder="Black Friday 2026"
        error={errors.name?.message}
        register={register("name")}
      />

      {/* Lead selection */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Leads ciblés ({selectedLeadIds.length} sélectionné{selectedLeadIds.length !== 1 ? "s" : ""}) <span className="font-normal text-gray-400">— optionnel</span>
          </span>
          {/* Tier filter */}
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            aria-label="Filtrer par tier"
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="all">Tous les tiers</option>
            <option value="hot">Tier A (hot)</option>
            <option value="warm">Tier B (warm)</option>
            <option value="cold">Tier C (cold)</option>
          </select>
        </div>

        <Controller
          name="lead_ids"
          control={control}
          render={({ field }) => (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
              {filteredLeads.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-400">
                  Aucun lead trouvé pour ce filtre
                </p>
              )}
              {filteredLeads.map((lead) => (
                <label
                  key={lead.id}
                  className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={lead.id}
                      checked={field.value.includes(lead.id)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...field.value, lead.id]
                          : field.value.filter((id) => id !== lead.id);
                        field.onChange(next);
                      }}
                      aria-label={`Sélectionner le lead ${lead.company ?? lead.id}`}
                      className="accent-indigo-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {lead.company ?? lead.id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{lead.score ?? "—"}</span>
                    <TierBadge tier={lead.score_tier} />
                  </div>
                </label>
              ))}
            </div>
          )}
        />
        {errors.lead_ids && (
          <p role="alert" className="text-xs text-red-500">
            {errors.lead_ids.message}
          </p>
        )}
      </div>

      {/* Template */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Template
        </label>
        <select
          {...register("template")}
          aria-invalid={!!errors.template}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="welcome">Welcome</option>
          <option value="promotional">Promotional</option>
          <option value="newsletter">Newsletter</option>
        </select>
        {errors.template && (
          <p role="alert" className="text-xs text-red-500">{errors.template.message}</p>
        )}
      </div>

      {/* Scheduled date */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Date d&apos;envoi (optionnel)
        </label>
        <input
          type="datetime-local"
          {...register("scheduled_at")}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" size="md" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={isSubmitting || isLoading}
        >
          Créer la campagne
        </Button>
      </div>
    </form>
  );
}

export default CampaignForm;
