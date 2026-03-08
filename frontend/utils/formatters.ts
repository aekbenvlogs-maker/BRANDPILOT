// ============================================================
// PROJECT      : BRANDSCALE — AI Brand Scaling Tool
// FILE         : frontend/utils/formatters.ts
// DESCRIPTION  : Display formatting utilities
// ============================================================

/**
 * Format a decimal ratio as a percentage string.
 * e.g. 0.245 → "24.5%"
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format an integer with locale thousands separator.
 * e.g. 12345 → "12,345"
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US");
}

/**
 * Truncate a string to maxLength characters and append ellipsis.
 */
export function truncate(str: string, maxLength = 80): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}…`;
}

/**
 * Capitalise the first letter of a string.
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Map a score_tier key to a human-friendly label with emoji.
 */
export function tierLabel(tier: "hot" | "warm" | "cold" | null | undefined): string {
  switch (tier) {
    case "hot":
      return "🔥 Hot";
    case "warm":
      return "🌤 Warm";
    case "cold":
      return "❄️ Cold";
    default:
      return "—";
  }
}
