// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/brand/BrandAnalysisReport.tsx
// ============================================================
"use client";

import React from "react";
import type { BrandAnalysis } from "@/hooks/useBrandAnalysis";
import { CompetitorCard } from "./CompetitorCard";

interface BrandAnalysisReportProps {
  analysis: BrandAnalysis;
}

// ---------------------------------------------------------------------------
// Circular score gauge (CSS-only, no lib)
// ---------------------------------------------------------------------------
function ScoreGauge({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const color =
    score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-2" role="img" aria-label={`Score de cohérence : ${score}/100`}>
      <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
        {/* Background track */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
        />
        {/* Progress arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          x="50"
          y="50"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize="18"
          fontWeight="700"
          fill={color}
        >
          {score}
        </text>
      </svg>
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
        Score de cohérence
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color swatch
// ---------------------------------------------------------------------------
function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="h-8 w-8 rounded-full border border-gray-200 shadow-sm dark:border-gray-600"
        style={{ backgroundColor: color }}
        title={color}
        aria-label={`${label}: ${color}`}
      />
      <span className="text-xs text-gray-500 dark:text-gray-400">{color}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main report
// ---------------------------------------------------------------------------
export function BrandAnalysisReport({ analysis }: BrandAnalysisReportProps) {
  return (
    <div className="space-y-8">
      {/* Header row: score + tone + url */}
      <div className="flex flex-wrap items-center gap-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <ScoreGauge score={analysis.consistency_score} />

        <div className="flex-1 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">URL analysée</p>
            <a
              href={analysis.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-500 hover:underline"
            >
              {analysis.source_url}
            </a>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              Ton : {analysis.tone}
            </span>
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              Style : {analysis.visual_style}
            </span>
            <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-semibold text-pink-700 dark:bg-pink-900/40 dark:text-pink-300">
              Mood : {analysis.visual_mood}
            </span>
          </div>

          {analysis.target_audience && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium">Audience cible :</span> {analysis.target_audience}
            </p>
          )}
        </div>
      </div>

      {/* Palette */}
      <section aria-labelledby="palette-heading">
        <h2 id="palette-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Palette de couleurs détectée
        </h2>
        <div className="flex flex-wrap gap-4">
          {analysis.primary_colors.map((c, i) => (
            <ColorSwatch key={`p-${i}`} color={c} label="Primaire" />
          ))}
          {analysis.secondary_colors.map((c, i) => (
            <ColorSwatch key={`s-${i}`} color={c} label="Secondaire" />
          ))}
          {analysis.primary_colors.length === 0 && analysis.secondary_colors.length === 0 && (
            <p className="text-sm text-gray-400">Aucune couleur détectée</p>
          )}
        </div>
      </section>

      {/* Keywords */}
      {analysis.keywords.length > 0 && (
        <section aria-labelledby="kw-heading">
          <h2 id="kw-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Mots-clés
          </h2>
          <div className="flex flex-wrap gap-2">
            {analysis.keywords.map((kw, i) => (
              <span
                key={i}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
              >
                {kw}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Style notes / AI recommendations */}
      {analysis.style_notes && (
        <section aria-labelledby="reco-heading" className="rounded-xl border border-indigo-100 bg-indigo-50 p-5 dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <h2 id="reco-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            <span aria-hidden="true">✨</span> Recommandations IA
          </h2>
          <p className="text-sm leading-relaxed text-indigo-800 dark:text-indigo-200">
            {analysis.style_notes}
          </p>
        </section>
      )}

      {/* Competitors */}
      {analysis.competitors.length > 0 && (
        <section aria-labelledby="comp-heading">
          <h2 id="comp-heading" className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Concurrents identifiés
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analysis.competitors.map((c, i) => (
              <CompetitorCard key={i} competitor={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
