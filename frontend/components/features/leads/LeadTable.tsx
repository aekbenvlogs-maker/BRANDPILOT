"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/components/features/leads/LeadTable.tsx
// ============================================================

import React, { useState } from "react";
import { ChevronUp, ChevronDown, RefreshCw, Eye } from "lucide-react";
import { TierBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Lead } from "@/hooks/useLeads";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey = "score" | "created_at";
type SortDir = "asc" | "desc";
type TierFilter = "hot" | "warm" | "cold";

interface LeadTableProps {
  leads: Lead[];
  isLoading: boolean;
  onRescore?: (leadId: string) => void;
  onViewDetail?: (leadId: string) => void;
  onAddToCampaign?: (leadIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  return `${user[0]}***@${domain}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeadTable({
  leads,
  isLoading,
  onRescore,
  onViewDetail,
  onAddToCampaign,
}: LeadTableProps) {
  const [sortKey, setSortKey]     = useState<SortKey>("created_at");
  const [sortDir, setSortDir]     = useState<SortDir>("desc");
  const [tierFilter, setTierFilter] = useState<Set<TierFilter>>(
    new Set<TierFilter>(["hot", "warm", "cold"]),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- Filtering ---
  const filtered = leads.filter((l) => {
    const tier = l.score_tier ?? "cold";
    return tierFilter.has(tier as TierFilter);
  });

  // --- Sorting ---
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "score") {
      const diff = (a.score ?? 0) - (b.score ?? 0);
      return sortDir === "asc" ? diff : -diff;
    }
    const diff =
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortDir === "asc" ? diff : -diff;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function toggleTierFilter(tier: TierFilter) {
    setTierFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((l) => l.id)));
    }
  }

  const SortIcon = ({ key: k }: { key: SortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? (
        <ChevronUp className="inline h-3 w-3" aria-hidden="true" />
      ) : (
        <ChevronDown className="inline h-3 w-3" aria-hidden="true" />
      )
    ) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Tier filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Tier :</span>
          {(["hot", "warm", "cold"] as TierFilter[]).map((tier) => (
            <label key={tier} className="flex cursor-pointer items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={tierFilter.has(tier)}
                onChange={() => toggleTierFilter(tier)}
                className="accent-indigo-500"
                aria-label={`Filtrer tier ${tier}`}
              />
              <TierBadge tier={tier} />
            </label>
          ))}
        </div>

        {/* Batch action */}
        {selected.size > 0 && onAddToCampaign && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAddToCampaign(Array.from(selected))}
          >
            Ajouter à une campagne ({selected.size})
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={sorted.length > 0 && selected.size === sorted.length}
                  onChange={toggleAll}
                  aria-label="Sélectionner tout"
                  className="accent-indigo-500"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                Nom
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                Email
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300"
                onClick={() => toggleSort("score")}
                aria-sort={sortKey === "score" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                Score <SortIcon key="score" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                Tier
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                Source
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300"
                onClick={() => toggleSort("created_at")}
                aria-sort={sortKey === "created_at" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
              >
                Date <SortIcon key="created_at" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} cols={8} />
              ))}
            {!isLoading && sorted.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    icon="👥"
                    title="Aucun lead"
                    description="Ajoutez ou importez des leads pour commencer."
                  />
                </td>
              </tr>
            )}
            {!isLoading &&
              sorted.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      aria-label={`Sélectionner lead ${lead.id}`}
                      className="accent-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {lead.company ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {maskEmail(null)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{lead.score ?? "—"}</span>
                    <span className="text-gray-400">/100</span>
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={lead.score_tier} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">{lead.source ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(lead.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {onViewDetail && (
                        <button
                          type="button"
                          onClick={() => onViewDetail(lead.id)}
                          aria-label={`Voir détail lead ${lead.id}`}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                      {onRescore && (
                        <button
                          type="button"
                          onClick={() => onRescore(lead.id)}
                          aria-label={`Rescorer le lead ${lead.id}`}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        >
                          <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LeadTable;
