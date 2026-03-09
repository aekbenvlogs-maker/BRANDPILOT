"use client";

import { AutomationMonitor } from "@/components/AutomationMonitor";

export default function AutomationPage() {
  return (
    <main className="flex min-h-screen flex-col gap-8 p-8">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
        Automation
      </h1>
      <AutomationMonitor />
    </main>
  );
}
