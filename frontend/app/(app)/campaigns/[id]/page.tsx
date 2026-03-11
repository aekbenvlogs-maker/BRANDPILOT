"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Play, XCircle } from "lucide-react";
import { apiFetch, apiPost } from "@/utils/api";
import { Button } from "@/components/ui/Button";
import { Badge, CampaignStatusBadge, TierBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  channel: string;
  launched_at: string | null;
  created_at: string;
  open_rate: number | null;
  click_rate: number | null;
  unsubscribe_rate: number | null;
  leads: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    score_tier?: "hot" | "warm" | "cold" | null;
    email_status?: string;
  }[];
}

function StatBar({ label, value }: { label: string; value: number | null }) {
  const pct = value !== null ? Math.round(value * 100) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-semibold text-gray-900 dark:text-white">{pct !== null ? `${pct}%` : "—"}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

// Per-lead email delivery status — 5 distinct states
const EMAIL_STATUS_CFG: Record<
  string,
  { variant: "success" | "warning" | "error" | "info" | "neutral"; label: string }
> = {
  pending:      { variant: "neutral", label: "En attente" },
  sent:         { variant: "info",    label: "Envoyé"    },
  opened:       { variant: "success", label: "Ouvert"    },
  clicked:      { variant: "warning", label: "Cliqué"    },
  bounced:      { variant: "error",   label: "Rebondi"   },
  unsubscribed: { variant: "error",   label: "Désabonné" },
};

function EmailStatusBadge({ status }: { status: string }) {
  const cfg = EMAIL_STATUS_CFG[status];
  return (
    <Badge variant={cfg?.variant ?? "neutral"}>
      {cfg?.label ?? status}
    </Badge>
  );
}

export default function CampaignDetailPage() {
  const params     = useParams<{ id: string }>();
  const router     = useRouter();
  const campaignId = params.id;

  const { data: campaign, isLoading, mutate } = useSWR<CampaignDetail>(
    `/api/v1/campaigns/${campaignId}`,
    (url: string) => apiFetch<CampaignDetail>(url),
    { revalidateOnFocus: true },
  );

  async function handleLaunch() {
    await apiPost(`/api/v1/campaigns/${campaignId}/launch`, {});
    await mutate();
  }

  async function handleCancel() {
    await apiFetch(`/api/v1/campaigns/${campaignId}/cancel`, { method: "POST" });
    await mutate();
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton variant="text" width="250px" height="28px" />
        <Skeleton variant="rect" height="120px" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <EmptyState
        icon="🔍"
        title="Campagne introuvable"
        description="Cette campagne n'existe pas ou a été supprimée."
        action={{ label: "Retour aux campagnes", onClick: () => router.push("/campaigns") }}
      />
    );
  }

  return (
    <main className="flex flex-col gap-6">
      {/* Back */}
      <button
        type="button"
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        onClick={() => router.push("/campaigns")}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Retour
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{campaign.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <span className="text-xs text-gray-400 capitalize">{campaign.channel}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === "draft" && (
            <Button variant="primary" size="sm" onClick={handleLaunch}>
              <Play className="h-4 w-4" aria-hidden="true" /> Lancer
            </Button>
          )}
          {campaign.status === "active" && (
            <Button variant="danger" size="sm" onClick={handleCancel}>
              <XCircle className="h-4 w-4" aria-hidden="true" /> Annuler
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">Statistiques</h2>
        <div className="flex flex-col gap-4">
          <StatBar label="Taux d'ouverture"  value={campaign.open_rate} />
          <StatBar label="Taux de clic"       value={campaign.click_rate} />
          <StatBar label="Désabonnements"     value={campaign.unsubscribe_rate} />
        </div>
      </section>

      {/* Leads list */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Leads ciblés ({(campaign.leads ?? []).length})
          </h2>
        </div>
        {(campaign.leads ?? []).length === 0 ? (
          <div className="p-6">
            <EmptyState icon="👥" title="Aucun lead" description="Cette campagne ne cible aucun lead." />
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {campaign.leads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.email}
                  </p>
                  <p className="text-xs text-gray-400">{lead.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {lead.score_tier && <TierBadge tier={lead.score_tier} />}
                  {lead.email_status && (
                    <EmailStatusBadge status={lead.email_status} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
