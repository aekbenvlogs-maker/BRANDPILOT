// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/social/BestTimeHeatmap.tsx
// ============================================================
"use client";

import React from "react";
import type { BestTimesData, TimeSlot } from "@/hooks/useAudienceInsights";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DAY_KEYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function scoreToOpacity(score: number): string {
  if (score >= 90) return "bg-indigo-700";
  if (score >= 75) return "bg-indigo-500";
  if (score >= 50) return "bg-indigo-300";
  if (score >= 25) return "bg-indigo-100";
  return "bg-gray-100 dark:bg-gray-700";
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}h`;
}

interface BestTimeHeatmapProps {
  data: BestTimesData;
}

export function BestTimeHeatmap({ data }: BestTimeHeatmapProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Meilleurs créneaux de publication
        </h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          data.confidence === "high"
            ? "bg-green-100 text-green-700"
            : data.confidence === "medium"
            ? "bg-amber-100 text-amber-700"
            : "bg-gray-100 text-gray-600"
        }`}>
          Fiabilité : {data.confidence === "high" ? "Haute" : data.confidence === "medium" ? "Moyenne" : "Faible"}
        </span>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[640px]"
          style={{ gridTemplateColumns: "3rem repeat(24, 1fr)", gridTemplateRows: `auto repeat(7, 1fr)` }}
          role="img"
          aria-label="Heatmap des meilleurs horaires par jour de la semaine"
        >
          {/* Hour headers */}
          <div /> {/* empty corner */}
          {HOURS.filter((h) => h % 3 === 0).flatMap((h) => [
            <div
              key={`hh-${h}`}
              className="col-span-3 text-center text-xs text-gray-400"
              aria-hidden="true"
            >
              {formatHour(h)}
            </div>,
          ])}

          {/* Day rows */}
          {DAY_KEYS.map((dayKey, di) => (
            <React.Fragment key={dayKey}>
              {/* Day label */}
              <div className="flex items-center pr-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                {DAYS[di].slice(0, 3)}
              </div>
              {/* Hour cells */}
              {HOURS.map((h) => {
                const score = data.heatmap?.[dayKey]?.[h] ?? 0;
                return (
                  <div
                    key={`${dayKey}-${h}`}
                    className={`h-6 rounded-sm ${scoreToOpacity(score)}`}
                    title={`${DAYS[di]} ${formatHour(h)} — score ${score}`}
                    aria-label={`${DAYS[di]} ${formatHour(h)}, score ${score}`}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400" aria-hidden="true">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-indigo-700" /> Meilleur créneau
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-indigo-400" /> Bon
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-indigo-100" /> Moyen
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-gray-100 dark:bg-gray-700 border border-gray-200" /> Éviter
        </span>
      </div>

      {/* Note */}
      {data.note && (
        <p className="mt-2 text-xs text-gray-400">{data.note}</p>
      )}

      {/* Top 3 slots */}
      {data.top_times.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Top créneaux recommandés
          </h3>
          <ol className="space-y-2">
            {data.top_times.slice(0, 3).map((slot: TimeSlot, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {i + 1}
                </span>
                <span>
                  {slot.day} · {slot.window_start}–{slot.window_end}
                </span>
                <span className="ml-auto rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                  Score {slot.score}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
