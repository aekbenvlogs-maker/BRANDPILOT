"use client";

import useSWR from "swr";
import { apiFetch } from "@/utils/api";
import { formatDateParis } from "@/utils/timezone";

interface WorkflowJob {
  id: string;
  job_type: string;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  updated_at: string | null;
  result: unknown;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-600",
  running: "bg-blue-100 text-blue-700 animate-pulse",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

function JobRow({ job }: { job: WorkflowJob }) {
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-800">
      <td className="py-3 pr-4 font-mono text-xs text-neutral-500">
        {job.id.slice(0, 8)}…
      </td>
      <td className="py-3 pr-4 text-sm font-medium text-neutral-900 dark:text-white">
        {job.job_type}
      </td>
      <td className="py-3 pr-4">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[job.status] ?? ""}`}
        >
          {job.status}
        </span>
      </td>
      <td className="py-3 text-xs text-neutral-400">
        {formatDateParis(job.created_at)}
      </td>
    </tr>
  );
}

export function AutomationMonitor() {
  const { data, isLoading, mutate } = useSWR<{ items: WorkflowJob[] }>(
    "/api/v1/workflows",
    (url: string) => apiFetch(url),
    { refreshInterval: 5_000 },
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Auto-refreshes every 5 seconds.
        </p>
        <button
          onClick={() => mutate()}
          className="rounded-lg border border-neutral-200 px-3 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Refresh now
        </button>
      </div>

      {isLoading && <p className="text-sm text-neutral-400">Loading jobs…</p>}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500 dark:border-neutral-800">
              <th className="pb-2 pl-4 pr-4 pt-4">Job ID</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Started</th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </tbody>
        </table>
        {!isLoading && !data?.items?.length && (
          <p className="p-4 text-sm text-neutral-400">No workflow jobs yet.</p>
        )}
      </div>
    </div>
  );
}
