// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/analytics/EngagementChart.tsx
// ============================================================
"use client";

import React, { useState, useRef } from "react";
import type { PlatformSeries, DataPoint } from "@/hooks/useSocialAnalytics";

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
function normalizeData(series: PlatformSeries[]): {
  dates: string[];
  minY: number;
  maxY: number;
} {
  const allDates = new Set<string>();
  series.forEach((s) => s.data.forEach((d) => allDates.add(d.date)));
  const dates = Array.from(allDates).sort();
  const allValues = series.flatMap((s) => s.data.map((d) => d.value));
  return {
    dates,
    minY: Math.min(0, ...allValues),
    maxY: Math.max(1, ...allValues),
  };
}

function getValueForDate(series: DataPoint[], date: string): number | null {
  return series.find((d) => d.date === date)?.value ?? null;
}

function mapToSVG(value: number, minY: number, maxY: number, height: number): number {
  if (maxY === minY) return height / 2;
  return height - ((value - minY) / (maxY - minY)) * height;
}

// ──────────────────────────────────────────────────────────────
// ENGAGEMENT CHART (SVG pure)
// ──────────────────────────────────────────────────────────────
interface TooltipState {
  x: number;
  y: number;
  date: string;
  values: { platform: string; value: number | null; color: string }[];
}

interface EngagementChartProps {
  series: PlatformSeries[];
  title?: string;
  yLabel?: string;
}

const SVG_WIDTH = 700;
const SVG_HEIGHT = 200;
const PADDING = { top: 12, right: 20, bottom: 30, left: 48 };
const INNER_W = SVG_WIDTH - PADDING.left - PADDING.right;
const INNER_H = SVG_HEIGHT - PADDING.top - PADDING.bottom;

export function EngagementChart({ series, title, yLabel }: EngagementChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

  if (series.length === 0 || series.every((s) => s.data.length === 0)) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        Aucune donnée disponible
      </div>
    );
  }

  const { dates, minY, maxY } = normalizeData(series);
  const xStep = dates.length > 1 ? INNER_W / (dates.length - 1) : INNER_W;

  const buildPath = (s: PlatformSeries): string => {
    const points: string[] = [];
    dates.forEach((date, i) => {
      const val = getValueForDate(s.data, date);
      if (val === null) return;
      const x = PADDING.left + i * xStep;
      const y = PADDING.top + mapToSVG(val, minY, maxY, INNER_H);
      points.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    });
    return points.join(" ");
  };

  const handleSVGMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left - PADDING.left;
    const normX = relX / INNER_W;
    const idx = Math.round(normX * (dates.length - 1));
    if (idx < 0 || idx >= dates.length) { setTooltip(null); return; }
    const date = dates[idx];
    const values = series.map((s) => ({
      platform: s.platform,
      value: getValueForDate(s.data, date),
      color: s.color,
    }));
    setTooltip({
      x: PADDING.left + idx * xStep,
      y: e.clientY - rect.top,
      date,
      values,
    });
  };

  const yLabels = Array.from({ length: 5 }, (_, i) => {
    const val = minY + (i / 4) * (maxY - minY);
    const y = PADDING.top + mapToSVG(val, minY, maxY, INNER_H);
    return { val, y };
  });

  // Show ~6 date labels max
  const xLabelStep = Math.max(1, Math.floor(dates.length / 6));

  return (
    <div>
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h3>
      )}

      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-3" role="list" aria-label="Légende">
        {series.map((s) => (
          <div key={s.platform} className="flex items-center gap-1.5 text-xs text-gray-500" role="listitem">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
            {s.platform}
          </div>
        ))}
      </div>

      {/* SVG Chart */}
      <div className="relative overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full"
          onMouseMove={handleSVGMouseMove}
          onMouseLeave={() => setTooltip(null)}
          role="img"
          aria-label={title ?? "Graphique d'engagement"}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setFocusedIdx((i) => Math.min((i ?? -1) + 1, dates.length - 1));
            if (e.key === "ArrowLeft") setFocusedIdx((i) => Math.max((i ?? 1) - 1, 0));
            if (e.key === "Escape") setFocusedIdx(null);
          }}
          aria-activedescendant={focusedIdx !== null ? `chart-point-${focusedIdx}` : undefined}
        >
          {/* Y grid lines + labels */}
          {yLabels.map(({ val, y }, i) => (
            <g key={i}>
              <line
                x1={PADDING.left}
                x2={PADDING.left + INNER_W}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text x={PADDING.left - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
                {val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val.toFixed(0)}
              </text>
            </g>
          ))}

          {/* X axis labels */}
          {dates.map((date, i) => {
            if (i % xLabelStep !== 0) return null;
            const x = PADDING.left + i * xStep;
            const d = new Date(date);
            const label = `${d.getDate()}/${d.getMonth() + 1}`;
            return (
              <text key={i} x={x} y={SVG_HEIGHT - 6} textAnchor="middle" fontSize="9" fill="#9ca3af">
                {label}
              </text>
            );
          })}

          {/* Series lines */}
          {series.map((s) => (
            <path
              key={s.platform}
              d={buildPath(s)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* Focus vertical line */}
          {focusedIdx !== null && (
            <line
              x1={PADDING.left + focusedIdx * xStep}
              x2={PADDING.left + focusedIdx * xStep}
              y1={PADDING.top}
              y2={PADDING.top + INNER_H}
              stroke="#6366f1"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* Tooltip vertical line */}
          {tooltip && (
            <line
              x1={tooltip.x}
              x2={tooltip.x}
              y1={PADDING.top}
              y2={PADDING.top + INNER_H}
              stroke="#6366f1"
              strokeWidth="1"
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          )}

          {/* Accessible data points (invisible, keyboard) */}
          {dates.map((date, i) => (
            <circle
              key={i}
              id={`chart-point-${i}`}
              cx={PADDING.left + i * xStep}
              cy={PADDING.top + INNER_H / 2}
              r="0"
              aria-label={`${date}: ${series.map((s) => `${s.platform} ${getValueForDate(s.data, date) ?? 0}`).join(", ")}`}
            />
          ))}
        </svg>

        {/* Tooltip overlay */}
        {tooltip && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 min-w-[120px] rounded-lg bg-gray-900 p-2 text-xs text-white shadow-lg"
            style={{
              left: `${Math.min(tooltip.x + 10, SVG_WIDTH - 130)}px`,
              top: `${Math.max(tooltip.y - 40, 0)}px`,
            }}
          >
            <p className="mb-1 font-semibold">{new Date(tooltip.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
            {tooltip.values.map((v) => (
              <div key={v.platform} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: v.color }} />
                <span className="capitalize">{v.platform}:</span>
                <span className="font-medium">{v.value?.toLocaleString("fr-FR") ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {yLabel && <p className="mt-1 text-right text-[10px] text-gray-400">{yLabel}</p>}
    </div>
  );
}
