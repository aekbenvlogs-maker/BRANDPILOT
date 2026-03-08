"use client";

import { useState } from "react";
import { mutate } from "swr";
import useLeads from "@/hooks/useLeads";
import { apiFetch } from "@/utils/api";

interface Lead {
  id: string;
  company: string | null;
  sector: string | null;
  score: number | null;
  score_tier: "hot" | "warm" | "cold" | null;
  opt_in: boolean;
  source: string | null;
}

const TIER_COLORS: Record<string, string> = {
  hot: "bg-red-100 text-red-700",
  warm: "bg-orange-100 text-orange-700",
  cold: "bg-blue-100 text-blue-700",
};

function LeadRow({ lead }: { lead: Lead }) {
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-800">
      <td className="py-3 pr-4 font-medium text-neutral-900 dark:text-white">
        {lead.company ?? "—"}
      </td>
      <td className="py-3 pr-4 text-sm text-neutral-500">{lead.sector ?? "—"}</td>
      <td className="py-3 pr-4 text-sm">
        {lead.score != null ? (
          <span className="font-semibold">{lead.score}</span>
        ) : (
          "—"
        )}
      </td>
      <td className="py-3 pr-4">
        {lead.score_tier ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[lead.score_tier] ?? ""}`}
          >
            {lead.score_tier}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="py-3 pr-4 text-sm text-neutral-500">{lead.source ?? "—"}</td>
      <td className="py-3 text-xs">
        {lead.opt_in ? (
          <span className="text-green-600">✓ Opted in</span>
        ) : (
          <span className="text-neutral-400">No consent</span>
        )}
      </td>
    </tr>
  );
}

export function LeadIntelligencePanel() {
  const { leads, isLoading } = useLeads();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiFetch("/api/v1/leads/import", {
        method: "POST",
        body: formData,
        headers: {},
      });
      await mutate("/api/v1/leads");
      setFile(null);
    } finally {
      setImporting(false);
    }
  }

  const hot = leads?.filter((l) => l.score_tier === "hot").length ?? 0;
  const warm = leads?.filter((l) => l.score_tier === "warm").length ?? 0;
  const cold = leads?.filter((l) => l.score_tier === "cold").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3">
        {[
          { label: "🔥 Hot", count: hot, color: "border-red-200 bg-red-50" },
          { label: "🌤 Warm", count: warm, color: "border-orange-200 bg-orange-50" },
          { label: "❄️ Cold", count: cold, color: "border-blue-200 bg-blue-50" },
        ].map((t) => (
          <div
            key={t.label}
            className={`rounded-xl border ${t.color} px-5 py-3 text-sm font-medium`}
          >
            {t.label} — {t.count}
          </div>
        ))}
      </div>

      <form
        onSubmit={handleImport}
        className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button
          type="submit"
          disabled={!file || importing}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {importing ? "Importing…" : "Import CSV"}
        </button>
      </form>

      {isLoading && <p className="text-sm text-neutral-400">Loading leads…</p>}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500 dark:border-neutral-800">
              <th className="pb-2 pl-4 pr-4 pt-4">Company</th>
              <th className="pb-2 pr-4">Sector</th>
              <th className="pb-2 pr-4">Score</th>
              <th className="pb-2 pr-4">Tier</th>
              <th className="pb-2 pr-4">Source</th>
              <th className="pb-2 pr-4">Consent</th>
            </tr>
          </thead>
          <tbody>
            {leads?.map((l) => <LeadRow key={l.id} lead={l} />)}
          </tbody>
        </table>
        {!isLoading && !leads?.length && (
          <p className="p-4 text-sm text-neutral-400">No leads yet.</p>
        )}
      </div>
    </div>
  );
}
