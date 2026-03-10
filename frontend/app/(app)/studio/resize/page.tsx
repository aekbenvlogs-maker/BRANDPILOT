// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/app/(app)/studio/resize/page.tsx
// ============================================================
"use client";

import { Maximize2 } from "lucide-react";
import { ImageResizerTool } from "@/components/features/studio/ImageResizerTool";

export default function ResizePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
          <Maximize2 className="h-6 w-6 text-indigo-500" />
          Redimensionneur d&apos;images
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Adaptez vos visuels aux formats optimaux pour chaque réseau social en un clic.
        </p>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <ImageResizerTool />
      </div>
    </main>
  );
}
