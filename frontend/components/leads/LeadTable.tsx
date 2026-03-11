"use client";
// ============================================================
// PROJECT      : BRANDSCALE
// FILE         : frontend/components/leads/LeadTable.tsx
// DESCRIPTION  : Full-featured leads table — sort, filter, search, actions
// ============================================================

import { useState, useMemo, useEffect } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  RefreshCw,
  Trash2,
  Loader2,
  Search,
} from "lucide-react";
import { TierBadge } from "@/components/ui/Badge";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Lead } from "@/hooks/useLeads";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey =
  | "name"
  | "email"
  | "company"
  | "source"
  | "tier"
  | "score"
  | "created_at";

type SortDir = "asc" | "desc";
type TierFilter = "all" | "hot" | "warm" | "cold";

const TIER_WEIGHT: Record<string, number> = { hot: 3, warm: 2, cold: 1 };

const TIER_BTNS: {
  key: TierFilter;
  label: string;
  activeClass: string;
}[] = [
  { key: "all",  label: "Tous", activeClass: "bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900" },
  { key: "hot",  label: "A",    activeClass: "bg-emerald-600 text-white" },
  { key: "warm", label: "B",    activeClass: "bg-amber-500 text-white" },
  { key: "cold", label: "C",    activeClass: "bg-red-500 text-white" },
];

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LeadTableProps {
  leads: Lead[];
  isLoading: boolean;
  /** IDs currently being scored — shows spinner on the row */
  scoringIds?: Set<string>;
  onViewDetail?: (id: string) => void;
  onRescore?: (id: string) => void;
  onDelete?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeadTable({
  leads,
  isLoading,
  scoringIds = new Set(),
  onViewDetail,
  onRescore,
  onDelete,
}: LeadTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let items = leads;
    if (tierFilter !== "all") {
      items = items.filter((l) => l.score_tier === tierFilter);
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter((l) => {
        const name = `${l.first_name ?? ""} ${l.last_name ?? ""}`.toLowerCase();
        const email = (l.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    }
    return items;
  }, [leads, tierFilter, debouncedSearch]);

  // ── Sort ─────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = `${a.first_name ?? ""}${a.last_name ?? ""}`.localeCompare(
            `${b.first_name ?? ""}${b.last_name ?? ""}`,
          );
          break;
        case "email":
          cmp = (a.email ?? "").localeCompare(b.email ?? "");
          break;
        case "company":
          cmp = (a.company ?? "").localeCompare(b.company ?? "");
          break;
        case "source":
          cmp = (a.source ?? "").localeCompare(b.source ?? "");
          break;
        case "tier":
          cmp =
            (TIER_WEIGHT[a.score_tier ?? ""] ?? 0) -
            (TIER_WEIGHT[b.score_tier ?? ""] ?? 0);
          break;
        case "score":
          cmp = (a.score ?? -1) - (b.score ?? -1);
          break;
        case "created_at":
          cmp =
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // ── Sort header renderer ─────────────────────────────────────────────────
  function sortTh(key: SortKey, label: string) {
    const isActive = sortKey === key;
    return (
      <th
        scope="col"
        onClick={() => toggleSort(key)}
        aria-sort={
          isActive ? (sortDir === "asc" ? "ascending" : "descending") : "none"
        }
        className={[
          "cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide transition-colors",
          isActive
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/40 dark:hover:text-white",
        ].join(" ")}
      >
        <span className="flex items-center gap-1">
          {label}
          {isActive ? (
            sortDir === "asc" ? (
              <ChevronUp className="h-3 w-3 text-indigo-500" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3 w-3 text-indigo-500" aria-hidden="true" />
            )
          ) : (
            <ChevronsUpDown className="h-3 w-3 opacity-25" aria-hidden="true" />
          )}
        </span>
      </th>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Tier filter pills */}
        <div
          className="flex items-center gap-1.5"
          role="group"
          aria-label="Filtrer par tier"
        >
          {TIER_BTNS.map(({ key, label, activeClass }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTierFilter(key)}
              aria-pressed={tierFilter === key}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                tierFilter === key
                  ? activeClass
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              {sortTh("name",       "Nom")}
              {sortTh("email",      "Email")}
              {sortTh("company",    "Entreprise")}
              {sortTh("source",     "Source")}
              {sortTh("tier",       "Tier")}
              {sortTh("score",      "Score")}
              {sortTh("created_at", "Date")}
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
            {/* Loading skeletons */}
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} cols={8} />
              ))}

            {/* Empty state */}
            {!isLoading && sorted.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    icon="👥"
                    title="Aucun lead"
                    description={
                      search || tierFilter !== "all"
                        ? "Aucun résultat pour ces filtres."
                        : "Ajoutez ou importez des leads pour commencer."
                    }
                  />
                </td>
              </tr>
            )}

            {/* Data rows */}
            {!isLoading &&
              sorted.map((lead) => {
                const isScoring =
                  lead.score === null || scoringIds.has(lead.id);

                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    {/* Nom */}
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {[lead.first_name, lead.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {lead.email}
                    </td>

                    {/* Entreprise */}
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {lead.company ?? "—"}
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3 text-gray-500">
                      {lead.source ?? "—"}
                    </td>

                    {/* Tier — spinner if scoring */}
                    <td className="px-4 py-3">
                      {isScoring ? (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden="true"
                          />
                          Scoring…
                        </span>
                      ) : (
                        <TierBadge tier={lead.score_tier} />
                      )}
                    </td>

                    {/* Score — spinner if scoring */}
                    <td className="px-4 py-3">
                      {isScoring ? (
                        <Loader2
                          className="h-4 w-4 animate-spin text-gray-400"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {lead.score ?? "—"}
                          {lead.score !== null && (
                            <span className="ml-0.5 text-xs font-normal text-gray-400">
                              /100
                            </span>
                          )}
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(lead.created_at).toLocaleDateString("fr-FR")}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {onViewDetail && (
                          <button
                            type="button"
                            onClick={() => onViewDetail(lead.id)}
                            title="Voir le détail"
                            aria-label="Voir le détail du lead"
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-gray-700"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                        {onRescore && (
                          <button
                            type="button"
                            onClick={() => onRescore(lead.id)}
                            disabled={scoringIds.has(lead.id)}
                            title="Déclencher un rescore"
                            aria-label="Rescorer ce lead"
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-40 dark:hover:bg-gray-700"
                          >
                            <RefreshCw
                              className={[
                                "h-4 w-4",
                                scoringIds.has(lead.id) ? "animate-spin" : "",
                              ].join(" ")}
                              aria-hidden="true"
                            />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(lead.id)}
                            title="Supprimer ce lead"
                            aria-label="Supprimer ce lead"
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Result count */}
      {!isLoading && sorted.length > 0 && (
        <p className="text-right text-xs text-gray-400">
          {sorted.length} lead{sorted.length !== 1 ? "s" : ""}
          {tierFilter !== "all" &&
            ` · Tier ${
              tierFilter === "hot" ? "A" : tierFilter === "warm" ? "B" : "C"
            }`}
          {debouncedSearch && ` · "${debouncedSearch}"`}
        </p>
      )}
    </div>
  );
}

export default LeadTable;
