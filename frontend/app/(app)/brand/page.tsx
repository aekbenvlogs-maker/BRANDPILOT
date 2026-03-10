// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/app/(app)/brand/page.tsx
// DESCRIPTION  : Brand Analyzer page
// ============================================================
"use client";

import React, { useState } from "react";
import { useAnalyzeBrand, useBrandAnalysis } from "@/hooks/useBrandAnalysis";
import { BrandAnalysisReport } from "@/components/features/brand/BrandAnalysisReport";
import { useProjects } from "@/hooks/useProjects";

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------
function ReportSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Chargement de l'analyse">
      <div className="flex gap-6 rounded-2xl border border-gray-100 bg-white p-6">
        <div className="h-24 w-24 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-1/3 rounded bg-gray-200" />
          <div className="h-4 w-1/2 rounded bg-gray-200" />
          <div className="h-4 w-1/4 rounded bg-gray-200" />
        </div>
      </div>
      <div className="h-16 rounded-xl bg-gray-100" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------
function AnalysisProgress() {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
          Analyse en cours…
        </p>
        <p className="text-xs text-indigo-500">~15 secondes</p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-200 dark:bg-indigo-900/40">
        <div
          className="h-full animate-[progress_15s_linear_forwards] rounded-full bg-indigo-500"
          style={{
            animation: "progress 15s linear forwards",
          }}
        />
      </div>
      <style>{`
        @keyframes progress {
          from { width: 0% }
          to   { width: 92% }
        }
      `}</style>
      <ul className="mt-4 space-y-1 text-xs text-indigo-600 dark:text-indigo-400">
        {[
          "Scraping du site web…",
          "Analyse du ton éditorial…",
          "Analyse visuelle & palette…",
          "Identification des concurrents…",
        ].map((step) => (
          <li key={step} className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
            {step}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function BrandPage() {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const { projects } = useProjects();
  const projectId = projects?.[0]?.id ?? null;

  const { analyze, isAnalyzing, analysis: freshAnalysis, error: analyzeError } = useAnalyzeBrand();
  const { analysis: savedAnalysis, isLoading } = useBrandAnalysis(projectId);

  const displayAnalysis = freshAnalysis ?? savedAnalysis;

  function validateUrl(raw: string): boolean {
    try {
      new URL(raw);
      return true;
    } catch {
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateUrl(url)) {
      setUrlError("Entrez une URL valide (ex: https://exemple.com)");
      return;
    }
    if (!projectId) {
      setUrlError("Aucun projet actif. Créez un projet d'abord.");
      return;
    }
    setUrlError(null);
    await analyze(projectId, url);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Analyser votre marque
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Obtenez un rapport complet : ton éditorial, palette de couleurs, concurrents et score de cohérence.
        </p>
      </div>

      {/* URL form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="brand-url" className="sr-only">
              URL du site web à analyser
            </label>
            <input
              id="brand-url"
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
              placeholder="https://votre-site.com"
              disabled={isAnalyzing}
              required
              aria-describedby={urlError ? "url-error" : undefined}
              className={[
                "w-full rounded-xl border px-4 py-3 text-sm shadow-sm transition",
                "focus:outline-none focus:ring-2 focus:ring-indigo-500",
                "dark:bg-gray-800 dark:text-white",
                urlError
                  ? "border-red-400 focus:ring-red-400"
                  : "border-gray-300 dark:border-gray-600",
                isAnalyzing ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
            />
            {urlError && (
              <p id="url-error" role="alert" className="mt-1 text-xs text-red-500">
                {urlError}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isAnalyzing || !url}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAnalyzing ? "Analyse…" : "Analyser"}
          </button>
        </div>
      </form>

      {/* API error */}
      {analyzeError && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
          {analyzeError}
        </div>
      )}

      {/* Progress */}
      {isAnalyzing && <AnalysisProgress />}

      {/* Skeleton while loading saved analysis */}
      {!isAnalyzing && isLoading && <ReportSkeleton />}

      {/* Report */}
      {!isAnalyzing && displayAnalysis && (
        <BrandAnalysisReport analysis={displayAnalysis} />
      )}

      {/* Empty state */}
      {!isAnalyzing && !isLoading && !displayAnalysis && !analyzeError && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center dark:border-gray-700 dark:bg-gray-800/30">
          <span className="mb-3 text-4xl" aria-hidden="true">🎨</span>
          <p className="text-base font-medium text-gray-700 dark:text-gray-200">
            Aucune analyse disponible
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Entrez une URL ci-dessus pour analyser votre identité de marque.
          </p>
        </div>
      )}
    </main>
  );
}
