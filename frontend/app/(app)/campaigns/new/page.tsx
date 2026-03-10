// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/app/(app)/campaigns/new/page.tsx
// DESCRIPTION  : Campaign creation page — renders the prompt input form,
//                handles submission via useCampaignAgent, and redirects
//                to the validation board on successful campaign generation.
// ============================================================
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CampaignPromptInput } from "@/components/campaigns/CampaignPromptInput";
import { useCampaignAgent } from "@/hooks/useCampaignAgent";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPS: ReadonlyArray<{ icon: string; label: string; desc: string }> = [
  {
    icon: "🎯",
    label: "Objectif clair",
    desc: "Notoriété, conversion ou engagement ?",
  },
  {
    icon: "👤",
    label: "Audience précise",
    desc: "Âge, genre, CSP — plus c'est précis, mieux c'est.",
  },
  {
    icon: "📱",
    label: "Plateforme(s)",
    desc: "Instagram, TikTok, YouTube, X ou multi.",
  },
  {
    icon: "💰",
    label: "Budget influenceurs",
    desc: "Ex. : 500 €, 2000 €, ou zéro pour du contenu organique.",
  },
  {
    icon: "📦",
    label: "Produit / service",
    desc: "Décrivez ce que vous promouvez en une phrase.",
  },
  {
    icon: "📅",
    label: "Durée",
    desc: "7 jours, 2 semaines, 1 mois… Défaut : 14 jours.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * /campaigns/new — Prompt input page for AI campaign generation.
 *
 * Flow:
 *  1. User fills in a natural-language campaign brief.
 *  2. useCampaignAgent.createCampaign() POSTs to the backend.
 *  3. On 202  → redirect to /campaigns/{id}/validate (polling picks up there).
 *  4. On 400  → clarification questions appear below the textarea.
 *  5. On other errors → inline error banner.
 */
export default function NewCampaignPage() {
  const router = useRouter();
  const {
    createCampaign,
    isCreating,
    createError,
    clarificationQuestions,
    resetState,
  } = useCampaignAgent();

  // Hard-coded project_id from localStorage (real implementation would use a
  // project selector; this keeps the page focused on the agent UX).
  const [projectId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("bs_active_project_id") ?? "";
    }
    return "";
  });

  const [missingProject, setMissingProject] = useState(!projectId);

  const handleSubmit = useCallback(
    async (prompt: string) => {
      if (!projectId) {
        setMissingProject(true);
        return;
      }
      const campaignId = await createCampaign(prompt, projectId);
      if (campaignId) {
        router.push(`/campaigns/${campaignId}/validate`);
      }
    },
    [createCampaign, projectId, router],
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6">
      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-neutral-400">
        <Link
          href="/campaigns"
          className="transition hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          Campagnes
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-neutral-700 dark:text-neutral-200">
          Nouvelle campagne IA
        </span>
      </nav>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-4xl">
            ✨
          </span>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Créer une campagne avec l'IA
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
              Décrivez votre campagne en langage naturel — l'IA se charge du
              reste.
            </p>
          </div>
        </div>
      </header>

      {/* ── Missing project warning ─────────────────────────────────────── */}
      {missingProject && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          ⚠️ Aucun projet actif sélectionné.{" "}
          <Link
            href="/projects"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Sélectionnez un projet
          </Link>{" "}
          avant de créer une campagne.
        </div>
      )}

      {/* ── Prompt input ─────────────────────────────────────────────────── */}
      <section aria-label="Brief de campagne">
        <CampaignPromptInput
          onSubmit={handleSubmit}
          isLoading={isCreating}
          clarificationQuestions={clarificationQuestions}
          errorMessage={createError}
          onPromptChange={resetState}
        />
      </section>

      {/* ── Tips grid ────────────────────────────────────────────────────── */}
      <section aria-label="Conseils pour un bon brief">
        <h2 className="mb-4 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
          💡 Pour un meilleur résultat, incluez :
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TIPS.map((tip) => (
            <li
              key={tip.label}
              className="flex flex-col gap-1 rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <span aria-hidden="true" className="text-xl">
                {tip.icon}
              </span>
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                {tip.label}
              </span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-500">
                {tip.desc}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Generation flow explanation ─────────────────────────────────── */}
      <section
        aria-label="Comment ça marche"
        className="rounded-2xl border border-neutral-100 bg-neutral-50 px-6 py-5 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h2 className="mb-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          🚀 Ce que l'IA va générer pour vous
        </h2>
        <ol className="flex flex-col gap-2">
          {[
            "Analyse de l'intention et du contexte marque",
            "Génération de captions adaptées à chaque plateforme",
            "Création des visuels aux bons formats",
            "Calcul du planning éditorial optimal",
            "Suggestions d'influenceurs correspondant à votre budget",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-400">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-400"
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-xs text-green-700 dark:bg-green-950/40 dark:text-green-400">
          ✅ <strong>Validation humaine obligatoire</strong> — Aucune publication
          sans votre approbation explicite.
        </p>
      </section>
    </main>
  );
}
