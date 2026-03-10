// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/brand/CompetitorCard.tsx
// ============================================================
"use client";

import React from "react";
import type { Competitor } from "@/hooks/useBrandAnalysis";

interface CompetitorCardProps {
  competitor: Competitor;
}

export function CompetitorCard({ competitor }: CompetitorCardProps) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {competitor.name}
          </h3>
          {competitor.url && (
            <a
              href={competitor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block truncate text-xs text-indigo-500 hover:underline"
            >
              {competitor.url}
            </a>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
          {competitor.tone}
        </span>
      </div>

      {competitor.niche && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Niche : <span className="font-medium text-gray-700 dark:text-gray-200">{competitor.niche}</span>
        </p>
      )}

      {competitor.strengths.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Forces
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {competitor.strengths.map((s, i) => (
              <li
                key={i}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
