// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/app/(app)/studio/grid/page.tsx
// ============================================================
"use client";

import { Layers } from "lucide-react";
import { GridMakerCanvas } from "@/components/features/studio/GridMakerCanvas";

export default function GridPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
          <Layers className="h-6 w-6 text-indigo-500" />
          Grid Maker Instagram
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Découpez une image en grille pour créer des profils Instagram esthétiques.
        </p>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <GridMakerCanvas />
      </div>
    </main>
  );
}
