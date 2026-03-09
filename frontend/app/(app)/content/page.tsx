"use client";

import { ContentGeneratorUI } from "@/components/ContentGeneratorUI";

export default function ContentPage() {
  return (
    <main className="flex min-h-screen flex-col gap-8 p-8">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
        Content Generator
      </h1>
      <ContentGeneratorUI />
    </main>
  );
}
