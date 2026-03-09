"use client";

import { useState } from "react";
import { mutate } from "swr";
import useCampaigns from "@/hooks/useCampaigns";
import { apiFetch } from "@/utils/api";

interface Campaign {
  id: string;
  name: string;
  status: string;
  channel: string;
  launched_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-neutral-200 text-neutral-700",
  active: "bg-blue-100 text-blue-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
};

function CampaignRow({
  campaign,
  onLaunch,
  onDelete,
}: {
  campaign: Campaign;
  onLaunch: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-800">
      <td className="py-3 pr-4 font-medium text-neutral-900 dark:text-white">
        {campaign.name}
      </td>
      <td className="py-3 pr-4">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[campaign.status] ?? "bg-neutral-100 text-neutral-600"}`}
        >
          {campaign.status}
        </span>
      </td>
      <td className="py-3 pr-4 text-sm text-neutral-500">{campaign.channel}</td>
      <td className="py-3 pr-4 text-xs text-neutral-400">
        {campaign.launched_at
          ? new Date(campaign.launched_at).toLocaleDateString()
          : "—"}
      </td>
      <td className="flex gap-2 py-3">
        {campaign.status === "draft" && (
          <button
            onClick={() => onLaunch(campaign.id)}
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Launch
          </button>
        )}
        <button
          onClick={() => onDelete(campaign.id)}
          className="text-xs text-red-500 hover:underline"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

export function CampaignManager() {
  const { campaigns, isLoading } = useCampaigns();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("email");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/api/v1/campaigns", {
      method: "POST",
      body: JSON.stringify({ name, channel }),
    });
    setName("");
    await mutate("/api/v1/campaigns");
  }

  async function handleLaunch(id: string) {
    await apiFetch(`/api/v1/campaigns/${id}/launch`, { method: "POST" });
    await mutate("/api/v1/campaigns");
  }

  async function handleDelete(id: string) {
    await apiFetch(`/api/v1/campaigns/${id}`, { method: "DELETE" });
    await mutate("/api/v1/campaigns");
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 md:flex-row"
      >
        <input
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          placeholder="Campaign name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <select
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          <option value="email">Email</option>
          <option value="linkedin">LinkedIn</option>
          <option value="instagram">Instagram</option>
          <option value="ads">Ads</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create
        </button>
      </form>

      {isLoading && (
        <p className="text-sm text-neutral-400">Loading campaigns…</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <table className="w-full p-4 text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500 dark:border-neutral-800">
              <th className="pb-2 pr-4 pt-4 pl-4">Name</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Channel</th>
              <th className="pb-2 pr-4">Launched</th>
              <th className="pb-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="pl-4">
            {campaigns?.map((c) => (
              <CampaignRow
                key={c.id}
                campaign={c}
                onLaunch={handleLaunch}
                onDelete={handleDelete}
              />
            ))}
          </tbody>
        </table>
        {!isLoading && !campaigns?.length && (
          <p className="p-4 text-sm text-neutral-400">No campaigns yet.</p>
        )}
      </div>
    </div>
  );
}
