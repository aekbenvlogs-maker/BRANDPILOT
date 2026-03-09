"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiFetch } from "@/utils/api";

interface ContentResponse {
  id: string;
  content_type: string;
  body: string;
  created_at: string;
}

interface GenerateResponse {
  content: string;
  content_type: string;
  cached: boolean;
}

const CONTENT_TYPES = [
  "post",
  "email",
  "ad",
  "newsletter",
  "video_script",
] as const;

export function ContentGeneratorUI() {
  const [campaignId, setCampaignId] = useState("");
  const [contentType, setContentType] = useState<string>("post");
  const [sector, setSector] = useState("SaaS");
  const [tone, setTone] = useState("professional");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: history } = useSWR<{ items: ContentResponse[] }>(
    campaignId ? `/api/v1/content/${campaignId}` : null,
    (url: string) => apiFetch<{ items: ContentResponse[] }>(url),
  );

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch("/api/v1/content/generate", {
        method: "POST",
        body: JSON.stringify({
          campaign_id: campaignId,
          content_type: contentType,
          sector,
          tone,
        }),
      });
      setResult(data as GenerateResponse);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleGenerate}
        className="grid gap-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 md:grid-cols-2"
      >
        <input
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          placeholder="Campaign ID"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          required
        />
        <select
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
        >
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          placeholder="Sector (e.g. SaaS)"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
        />
        <input
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          placeholder="Tone (e.g. professional)"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="col-span-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate"}
        </button>
      </form>

      {result && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-green-200 px-2 py-0.5 text-xs font-medium text-green-800">
              {result.content_type}
            </span>
            {result.cached && (
              <span className="text-xs text-neutral-400">from cache</span>
            )}
          </div>
          <pre className="whitespace-pre-wrap text-sm text-neutral-800">
            {result.content}
          </pre>
        </div>
      )}

      {history?.items?.length ? (
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <h3 className="border-b border-neutral-100 p-4 text-sm font-semibold dark:border-neutral-800">
            Previous content
          </h3>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {history.items.map((item) => (
              <li key={item.id} className="p-4">
                <p className="mb-1 text-xs text-neutral-400">
                  {item.content_type} —{" "}
                  {new Date(item.created_at).toLocaleString()}
                </p>
                <p className="line-clamp-3 text-sm text-neutral-700 dark:text-neutral-300">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
