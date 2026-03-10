// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/app/(app)/social/pricing/page.tsx
// ============================================================
"use client";

import { DollarSign, Info } from "lucide-react";
import { PricingCalculator } from "@/components/features/social/PricingCalculator";

const COMPARISON_DATA = [
  {
    tier: "Nano (1K–10K)",
    instagram: "€50–€200",
    tiktok: "€40–€150",
    youtube: "€80–€400",
    linkedin: "€100–€300",
  },
  {
    tier: "Micro (10K–100K)",
    instagram: "€200–€2 000",
    tiktok: "€150–€1 500",
    youtube: "€400–€4 000",
    linkedin: "€300–€2 000",
  },
  {
    tier: "Mid (100K–500K)",
    instagram: "€2 000–€8 000",
    tiktok: "€1 500–€6 000",
    youtube: "€4 000–€15 000",
    linkedin: "€2 000–€8 000",
  },
  {
    tier: "Macro (500K–1M)",
    instagram: "€8 000–€20 000",
    tiktok: "€6 000–€15 000",
    youtube: "€15 000–€40 000",
    linkedin: "€8 000–€20 000",
  },
  {
    tier: "Mega (1M+)",
    instagram: "€20 000+",
    tiktok: "€15 000+",
    youtube: "€40 000+",
    linkedin: "€20 000+",
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-8">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
          <DollarSign className="h-6 w-6 text-indigo-500" />
          Calculateur de tarifs influenceurs
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Estimez le juste prix d'une collaboration en fonction du profil et du type de contenu.
        </p>
      </div>

      {/* Calculator */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <PricingCalculator />
      </div>

      {/* Comparison table */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Grille tarifaire de référence</h2>
          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
            <Info className="h-3 w-3" /> Estimations moyennes du marché (post unique)
          </span>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Segment</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Instagram</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">TikTok</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">YouTube</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">LinkedIn</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_DATA.map((row, i) => (
                <tr
                  key={row.tier}
                  className={`border-b border-gray-50 dark:border-gray-800 ${
                    i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/30"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-200">{row.tier}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.instagram}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.tiktok}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.youtube}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.linkedin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          * Ces fourchettes sont indicatives. Les prix réels varient selon la niche, la qualité de l'audience et la notoriété du créateur.
        </p>
      </div>
    </main>
  );
}
