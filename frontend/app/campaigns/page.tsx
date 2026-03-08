"use client";

import { CampaignManager } from "@/components/CampaignManager";

export default function CampaignsPage() {
  return (
    <main className="flex min-h-screen flex-col gap-8 p-8">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
        Campaigns
      </h1>
      <CampaignManager />
    </main>
  );
}
