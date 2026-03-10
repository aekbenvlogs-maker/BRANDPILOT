// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/social/PricingCalculator.tsx
// ============================================================
"use client";

import React, { useEffect } from "react";
import { Calculator, TrendingUp, AlertCircle } from "lucide-react";
import { useCalculatePricing } from "@/hooks/useInfluencerAnalysis";
import type { InfluencerPlatform, ContentType, PricingInput } from "@/hooks/useInfluencerAnalysis";

const PLATFORMS: { value: InfluencerPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X (Twitter)" },
  { value: "linkedin", label: "LinkedIn" },
];

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "post", label: "Post statique" },
  { value: "reel", label: "Reel / Short" },
  { value: "story", label: "Story" },
  { value: "video", label: "Vidéo longue" },
  { value: "carousel", label: "Carrousel" },
];

const NICHES = [
  "Mode", "Beauté", "Fitness", "Tech", "Gaming", "Voyage",
  "Food", "Finance", "Business", "Éducation", "Lifestyle", "Autre",
];

interface FormState {
  platform: InfluencerPlatform;
  followers: string;
  engagement_rate: string;
  niche: string;
  content_type: ContentType;
}

const INITIAL_FORM: FormState = {
  platform: "instagram",
  followers: "50000",
  engagement_rate: "3",
  niche: "Lifestyle",
  content_type: "post",
};

function formatPrice(val: number, currency: string): string {
  const sym = currency === "EUR" ? "€" : "$";
  return `${sym}${val.toLocaleString("fr-FR")}`;
}

export function PricingCalculator() {
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const { calculate, isCalculating, result, error } = useCalculatePricing();

  // Auto-recalc when form changes (debounced)
  useEffect(() => {
    const followers = parseInt(form.followers, 10);
    const er = parseFloat(form.engagement_rate);
    if (isNaN(followers) || isNaN(er) || followers <= 0 || er <= 0) return;

    const timeout = setTimeout(() => {
      const input: PricingInput = {
        platform: form.platform,
        followers,
        engagement_rate: er / 100,
        niche: form.niche,
        content_type: form.content_type,
      };
      calculate(input);
    }, 600);

    return () => clearTimeout(timeout);
  }, [form, calculate]);

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Form */}
      <div className="space-y-4 lg:col-span-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-gray-100">
          <Calculator className="h-4 w-4 text-indigo-500" />
          Paramètres
        </h2>

        <div>
          <label htmlFor="pricing-platform" className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">
            Plateforme
          </label>
          <select
            id="pricing-platform"
            value={form.platform}
            onChange={set("platform")}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pricing-followers" className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">
            Nombre d'abonnés
          </label>
          <input
            id="pricing-followers"
            type="number"
            min="1000"
            max="50000000"
            value={form.followers}
            onChange={set("followers")}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        <div>
          <label htmlFor="pricing-er" className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">
            Taux d'engagement (%)
          </label>
          <input
            id="pricing-er"
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            value={form.engagement_rate}
            onChange={set("engagement_rate")}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        <div>
          <label htmlFor="pricing-niche" className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">
            Niche
          </label>
          <select
            id="pricing-niche"
            value={form.niche}
            onChange={set("niche")}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {NICHES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pricing-content" className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">
            Type de contenu
          </label>
          <select
            id="pricing-content"
            value={form.content_type}
            onChange={set("content_type")}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {CONTENT_TYPES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Result */}
      <div className="lg:col-span-3">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-gray-100">
          <TrendingUp className="h-4 w-4 text-indigo-500" />
          Résultat estimé
        </h2>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {isCalculating && !result && (
          <div className="animate-pulse space-y-3">
            <div className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800" />
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Price range hero */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white">
              <p className="text-sm font-medium opacity-80">Fourchette de prix estimée</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">
                {formatPrice(result.price_range.min, result.price_range.currency)}
                <span className="mx-2 text-2xl font-light opacity-60">–</span>
                {formatPrice(result.price_range.max, result.price_range.currency)}
              </p>
              <span className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                result.confidence === "high"
                  ? "bg-green-400/20 text-green-100"
                  : result.confidence === "medium"
                  ? "bg-yellow-400/20 text-yellow-100"
                  : "bg-red-400/20 text-red-100"
              }`}>
                Fiabilité : {result.confidence === "high" ? "haute" : result.confidence === "medium" ? "moyenne" : "faible"}
              </span>
            </div>

            {/* Breakdown */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Facteurs de calcul</h3>
              <ul className="space-y-2">
                {result.breakdown.map((item) => (
                  <li key={item.label} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{item.label}</span>
                    <span className="shrink-0 font-medium text-indigo-600 dark:text-indigo-300">×{item.factor.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Benchmarks */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Benchmarks du marché</h3>
              <ul className="space-y-1">
                {result.benchmarks.map((b) => (
                  <li key={b.label} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                    <span>{b.label}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-100">{b.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {!result && !isCalculating && !error && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 py-12 text-center dark:border-gray-700">
            <Calculator className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-400">Remplissez le formulaire pour obtenir une estimation automatique.</p>
          </div>
        )}
      </div>
    </div>
  );
}
