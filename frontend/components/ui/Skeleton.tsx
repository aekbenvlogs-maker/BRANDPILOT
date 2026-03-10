"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/components/ui/Skeleton.tsx
// ============================================================

import React from "react";

interface SkeletonProps {
  variant?: "text" | "circle" | "rect";
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  className = "",
}: SkeletonProps) {
  const baseClasses =
    "animate-pulse bg-gray-200 dark:bg-gray-700";

  const variantClasses: Record<NonNullable<SkeletonProps["variant"]>, string> = {
    text:   "rounded h-4 w-full",
    circle: "rounded-full h-10 w-10",
    rect:   "rounded-lg",
  };

  return (
    <span
      aria-hidden="true"
      style={{ width, height }}
      className={[
        baseClasses,
        variantClasses[variant],
        "block",
        className,
      ].join(" ")}
    />
  );
}

// Pre-built row skeleton for tables
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton variant="text" />
        </td>
      ))}
    </tr>
  );
}

// Pre-built card skeleton
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3 dark:border-gray-700 dark:bg-gray-900">
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="text" />
      <Skeleton variant="text" width="80%" />
    </div>
  );
}

export default Skeleton;
