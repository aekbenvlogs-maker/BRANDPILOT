"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/components/ui/Badge.tsx
// ============================================================

import React from "react";

interface BadgeProps {
  variant?: "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  error:   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  info:    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  neutral: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const sizeClasses: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

export function Badge({
  variant = "neutral",
  size = "sm",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full font-medium",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tier badge — compact solid A / B / C pills with colored dot
// ---------------------------------------------------------------------------

const TIER_BADGE_CFG: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  hot: {
    bg:    "bg-emerald-500 dark:bg-emerald-600",
    text:  "text-white",
    dot:   "bg-emerald-200",
    label: "A",
  },
  warm: {
    bg:    "bg-amber-400 dark:bg-amber-500",
    text:  "text-white",
    dot:   "bg-amber-100",
    label: "B",
  },
  cold: {
    bg:    "bg-rose-500 dark:bg-rose-600",
    text:  "text-white",
    dot:   "bg-rose-200",
    label: "C",
  },
};

export function TierBadge({
  tier,
}: {
  tier: "hot" | "warm" | "cold" | string | null;
}) {
  if (!tier) return null;
  const cfg = TIER_BADGE_CFG[tier];
  if (!cfg) {
    // Fallback for unknown tiers
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
        {tier}
      </span>
    );
  }
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold",
        cfg.bg,
        cfg.text,
      ].join(" ")}
    >
      <span
        className={["h-1.5 w-1.5 rounded-full", cfg.dot].join(" ")}
        aria-hidden="true"
      />
      {cfg.label}
    </span>
  );
}

export default Badge;
