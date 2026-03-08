"use client";

import { LeadIntelligencePanel } from "@/components/LeadIntelligencePanel";

export default function LeadsPage() {
  return (
    <main className="flex min-h-screen flex-col gap-8 p-8">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
        Lead Intelligence
      </h1>
      <LeadIntelligencePanel />
    </main>
  );
}
