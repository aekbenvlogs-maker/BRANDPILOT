// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/social/AudienceMetricsCard.tsx
// ============================================================
"use client";

import React, { useState } from "react";

type Benchmark = "excellent" | "good" | "low";

interface AudienceMetricsCardProps {
  label: string;
  value: string | number;
  unit?: string;
  benchmark?: Benchmark;
  tooltip?: string;
}

const BENCHMARK_STYLES: Record<Benchmark, { dot: string; badge: string; label: string }> = {
  excellent: {
    dot: "bg-green-500",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    label: "Excellent",
  },
  good: {
    dot: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    label: "Bon",
  },
  low: {
    dot: "bg-red-400",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    label: "Faible",
  },
};

export function AudienceMetricsCard({
  label,
  value,
  unit,
  benchmark,
  tooltip,
}: AudienceMetricsCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const bm = benchmark ? BENCHMARK_STYLES[benchmark] : null;

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {label}
        </p>
        {tooltip && (
          <div className="relative">
            <button
              type="button"
              aria-label={`Explication : ${label}`}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-xs text-gray-400 hover:border-gray-400 dark:border-gray-600"
            >
              ?
            </button>
            {showTooltip && (
              <div
                role="tooltip"
                className="absolute right-0 top-6 z-10 w-52 rounded-lg border border-gray-200 bg-white p-2.5 text-xs text-gray-600 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-end gap-1">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
        </span>
        {unit && (
          <span className="mb-0.5 text-sm text-gray-400">{unit}</span>
        )}
      </div>

      {bm && (
        <div className="mt-3 flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${bm.dot}`} aria-hidden="true" />
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${bm.badge}`}>
            {bm.label}
          </span>
        </div>
      )}
    </div>
  );
}
