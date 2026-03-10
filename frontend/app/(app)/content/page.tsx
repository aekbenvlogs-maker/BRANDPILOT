"use client";

import { ContentGenerator } from "@/components/features/content/ContentGenerator";

export default function ContentPage() {
  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contenu IA</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Générez du contenu optimisé pour chaque plateforme</p>
      </div>
      <ContentGenerator />
    </main>
  );
}
