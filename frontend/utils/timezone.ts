// ============================================================
// PROJECT      : BRANDSCALE — AI Brand Scaling Tool
// FILE         : frontend/utils/timezone.ts
// DESCRIPTION  : Dual-timezone date formatting (UTC + Paris)
// ============================================================

/**
 * Format an ISO date string in Paris timezone.
 * Returns "DD/MM/YYYY HH:MM Paris" format.
 */
export function formatDateParis(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Format an ISO date string in UTC.
 * Returns "YYYY-MM-DD HH:MM UTC" format.
 */
export function formatDateUTC(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
  } catch {
    return iso;
  }
}

/**
 * Return dual-timezone label: "YYYY-MM-DD HH:MM UTC (HH:MM Paris)".
 */
export function formatDualTimezone(iso: string | null | undefined): string {
  if (!iso) return "—";
  const utc = formatDateUTC(iso);
  const paris = new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${utc} (${paris} Paris)`;
}

/**
 * Return a relative time string (e.g. "2 hours ago").
 */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
