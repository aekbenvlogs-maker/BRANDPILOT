"use client";

import useSWR from "swr";
import { apiFetch } from "@/utils/api";

interface ServiceStatus {
  service: string;
  status: "ok" | "error" | "degraded";
}

const SERVICES = [
  { label: "Backend", url: "/api/v1/health" },
  { label: "AI Text", url: "/bs-ai-text/health" },
  { label: "AI Image", url: "/bs-ai-image/health" },
  { label: "AI Video", url: "/bs-ai-video/health" },
  { label: "Email", url: "/bs-email/health" },
  { label: "Scoring", url: "/bs-scoring/health" },
];

function StatusDot({
  status,
}: {
  status: "ok" | "error" | "degraded" | undefined;
}) {
  const color =
    status === "ok"
      ? "bg-green-500"
      : status === "degraded"
        ? "bg-yellow-400"
        : status === "error"
          ? "bg-red-500"
          : "bg-neutral-300 animate-pulse";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

function ServiceChip({ label, url }: { label: string; url: string }) {
  const { data, error } = useSWR<ServiceStatus>(
    url,
    (u: string) => apiFetch(u),
    { refreshInterval: 30_000 },
  );
  const status = error ? "error" : data?.status;
  return (
    <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <StatusDot status={status} />
      <span className="text-neutral-700 dark:text-neutral-300">{label}</span>
    </div>
  );
}

export function ServiceStatusBar() {
  return (
    <div className="flex flex-wrap gap-2">
      {SERVICES.map((s) => (
        <ServiceChip key={s.label} label={s.label} url={s.url} />
      ))}
    </div>
  );
}
