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

// Tier badge helpers
export function TierBadge({ tier }: { tier: "hot" | "warm" | "cold" | string | null }) {
  if (!tier) return null;
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    hot:  { variant: "success", label: "Tier A" },
    warm: { variant: "warning", label: "Tier B" },
    cold: { variant: "error",   label: "Tier C" },
  };
  const config = map[tier] ?? { variant: "neutral", label: tier };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default Badge;
