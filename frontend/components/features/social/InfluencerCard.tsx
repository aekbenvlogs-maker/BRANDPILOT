// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/social/InfluencerCard.tsx
// ============================================================
"use client";

import { ExternalLink, Users, TrendingUp, Clock, DollarSign } from "lucide-react";
import type { InfluencerProfile } from "@/hooks/useInfluencerAnalysis";

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function scoreBarBg(score: number): string {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-amber-400";
  return "bg-red-400";
}

// ──────────────────────────────────────────────────────────────
// SCORE BAR
// ──────────────────────────────────────────────────────────────
interface ScoreBarProps {
  label: string;
  score: number;
}
function ScoreBar({ label, score }: ScoreBarProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`font-semibold ${scoreColor(score)}`}>{score}/100</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${scoreBarBg(score)}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// INFLUENCER CARD
// ──────────────────────────────────────────────────────────────
interface InfluencerCardProps {
  profile: InfluencerProfile;
  onContact?: (profile: InfluencerProfile) => void;
}

export function InfluencerCard({ profile, onContact }: InfluencerCardProps) {
  const erPercent = (profile.engagement_rate * 100).toFixed(2);
  const priceLabel = `${profile.price_range.currency === "EUR" ? "€" : "$"}${profile.price_range.min.toLocaleString()} – ${profile.price_range.currency === "EUR" ? "€" : "$"}${profile.price_range.max.toLocaleString()}`;

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-start gap-3">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={`Avatar de ${profile.display_name}`}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold uppercase text-indigo-600 dark:bg-indigo-900/30">
            {profile.display_name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="truncate font-semibold text-gray-900 dark:text-gray-50">{profile.display_name}</p>
          <p className="text-xs text-gray-400">@{profile.username} · {profile.platform}</p>
        </div>
        <a
          href={`https://${profile.platform}.com/${profile.username}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Voir le profil ${profile.platform} de @${profile.username}`}
          className="text-gray-300 hover:text-indigo-500 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
        <div className="text-center">
          <p className="flex items-center justify-center gap-1 text-xs text-gray-400">
            <Users className="h-3 w-3" /> Abonnés
          </p>
          <p className="mt-0.5 font-bold text-gray-800 dark:text-gray-100">{formatFollowers(profile.followers)}</p>
        </div>
        <div className="text-center">
          <p className="flex items-center justify-center gap-1 text-xs text-gray-400">
            <TrendingUp className="h-3 w-3" /> Engagement
          </p>
          <p className={`mt-0.5 font-bold ${scoreColor(parseFloat(erPercent) >= 5 ? 75 : parseFloat(erPercent) >= 2 ? 55 : 30)}`}>
            {erPercent}%
          </p>
        </div>
        <div className="text-center">
          <p className="flex items-center justify-center gap-1 text-xs text-gray-400">
            <DollarSign className="h-3 w-3" /> Prix / post
          </p>
          <p className="mt-0.5 font-bold text-gray-800 dark:text-gray-100 text-xs leading-tight">{priceLabel}</p>
        </div>
      </div>

      {/* Niche badges */}
      {profile.niche.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.niche.map((n) => (
            <span key={n} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
              {n}
            </span>
          ))}
        </div>
      )}

      {/* Score bars */}
      <div className="space-y-2">
        <ScoreBar label="Authenticité de l'audience" score={profile.authenticity_score} />
        <ScoreBar label="Qualité de l'audience" score={profile.audience_quality_score} />
      </div>

      {/* Best times */}
      {profile.best_times.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>Meilleurs créneaux : {profile.best_times.slice(0, 3).join(", ")}</span>
        </div>
      )}

      {/* CTA */}
      {onContact && (
        <button
          onClick={() => onContact(profile)}
          className="mt-auto w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Contacter / Proposer une collaboration
        </button>
      )}
    </article>
  );
}
