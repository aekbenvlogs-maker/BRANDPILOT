// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/app/(app)/social/influencers/page.tsx
// ============================================================
"use client";

import React, { useState } from "react";
import { Search, Loader2, AlertCircle, History } from "lucide-react";
import { useAnalyzeInfluencer, useInfluencerHistory } from "@/hooks/useInfluencerAnalysis";
import { InfluencerCard } from "@/components/features/social/InfluencerCard";
import { useProjects } from "@/hooks/useProjects";
import type { InfluencerPlatform, InfluencerProfile } from "@/hooks/useInfluencerAnalysis";

const PLATFORMS: { value: InfluencerPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X" },
  { value: "linkedin", label: "LinkedIn" },
];

export default function InfluencersPage() {
  const { projects } = useProjects();
  const projectId = projects?.[0]?.id ?? null;
  const [username, setUsername] = useState("");
  const [platform, setPlatform] = useState<InfluencerPlatform>("instagram");
  const { analyze, isAnalyzing, result, error } = useAnalyzeInfluencer();
  const { history, isLoading: historyLoading } = useInfluencerHistory(projectId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username.replace(/^@/, "").trim();
    if (clean) analyze(clean, platform);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Analyse d'influenceurs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Analysez n'importe quel influenceur pour évaluer sa pertinence et estimer le prix d'une collaboration.
        </p>
      </div>

      {/* Search form */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row dark:border-gray-800 dark:bg-gray-900"
        aria-label="Rechercher un influenceur"
      >
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
          <input
            type="text"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-label="Nom d'utilisateur"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-7 pr-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as InfluencerPlatform)}
          aria-label="Plateforme"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isAnalyzing || !username.trim()}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4" aria-hidden="true" />
          )}
          {isAnalyzing ? "Analyse en cours…" : "Analyser"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Résultat de l'analyse</h2>
          <div className="max-w-sm">
            <InfluencerCard profile={result} />
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          <History className="h-4 w-4" /> Analyses récentes
        </h2>
        {historyLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune analyse enregistrée pour ce projet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((profile: InfluencerProfile) => (
              <InfluencerCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
