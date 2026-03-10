// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/planner/PlatformFilter.tsx
// ============================================================
"use client";

import type { PostPlatform } from "@/hooks/useSocialCampaign";

const PLATFORMS: { value: PostPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X" },
  { value: "linkedin", label: "LinkedIn" },
];

const PLATFORM_DOT: Record<PostPlatform, string> = {
  instagram: "bg-purple-500",
  tiktok: "bg-gray-800",
  youtube: "bg-red-500",
  x: "bg-gray-700",
  linkedin: "bg-blue-700",
};

interface PlatformFilterProps {
  selected: PostPlatform[];
  onChange: (platforms: PostPlatform[]) => void;
}

export function PlatformFilter({ selected, onChange }: PlatformFilterProps) {
  const toggle = (p: PostPlatform) => {
    onChange(
      selected.includes(p) ? selected.filter((x) => x !== p) : [...selected, p]
    );
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par plateforme">
      {PLATFORMS.map((p) => (
        <label
          key={p.value}
          className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            selected.includes(p.value)
              ? "border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
              : "border-gray-200 text-gray-500 hover:border-indigo-200 dark:border-gray-700 dark:text-gray-400"
          }`}
        >
          <input
            type="checkbox"
            checked={selected.includes(p.value)}
            onChange={() => toggle(p.value)}
            className="sr-only"
            aria-label={p.label}
          />
          <span className={`h-2 w-2 rounded-full ${PLATFORM_DOT[p.value]}`} aria-hidden="true" />
          {p.label}
        </label>
      ))}
    </div>
  );
}
