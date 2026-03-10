// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/app/(app)/studio/page.tsx
// ============================================================
"use client";

import React, { useState } from "react";
import { Sparkles, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useFormatContent } from "@/hooks/useContentFormatter";
import { MultiPlatformEditor } from "@/components/features/studio/MultiPlatformEditor";
import { PlatformPreview } from "@/components/features/studio/PlatformPreview";
import { useProjects } from "@/hooks/useProjects";
import type { ContentPlatform } from "@/hooks/useContentFormatter";

const PLATFORMS: { value: ContentPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X" },
  { value: "linkedin", label: "LinkedIn" },
];

const TONES = ["Professionnel", "Casual", "Inspirant", "Humoristique", "Informatif", "Urgent"];
const PREVIEW_PLATFORM_ORDER: ContentPlatform[] = ["instagram", "tiktok", "youtube", "x", "linkedin"];

export default function StudioPage() {
  const { projects } = useProjects();
  const projectId = projects?.[0]?.id ?? null;
  const { format, isFormatting, result, error, updatePlatformText, updatePlatformHashtags } = useFormatContent();

  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState("Professionnel");
  const [selectedPlatforms, setSelectedPlatforms] = useState<ContentPlatform[]>(["instagram", "tiktok"]);
  const [previewPlatform, setPreviewPlatform] = useState<ContentPlatform>("instagram");

  const togglePlatform = (p: ContentPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brief.trim()) return;
    format({
      brief: brief.trim(),
      tone,
      target_platforms: selectedPlatforms,
      project_id: projectId ?? undefined,
    });
  };

  const handleGenerateAll = () => {
    if (!brief.trim()) return;
    format({
      brief: brief.trim(),
      tone,
      target_platforms: PLATFORMS.map((p) => p.value),
      project_id: projectId ?? undefined,
    });
  };

  // Preview platform — must be in result
  const activePlatforms = result
    ? PREVIEW_PLATFORM_ORDER.filter((p) => result.platforms[p])
    : [];
  const displayPreview = activePlatforms.includes(previewPlatform)
    ? previewPlatform
    : activePlatforms[0] ?? "instagram";
  const previewContent = result?.platforms[displayPreview];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-50">
          <Sparkles className="h-6 w-6 text-indigo-500" />
          Content Studio
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Générez et personnalisez du contenu adapté à chaque plateforme en quelques secondes.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* LEFT: Brief form + Editor (60%) */}
        <div className="space-y-6 lg:col-span-3">
          {/* Brief form */}
          <form
            onSubmit={handleGenerate}
            className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            aria-label="Formulaire de génération de contenu"
          >
            <div>
              <label htmlFor="studio-brief" className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">
                Brief / Idée de contenu <span className="text-red-400">*</span>
              </label>
              <textarea
                id="studio-brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={4}
                placeholder="Ex : Annoncer le lancement de notre nouvelle collection printemps avec un ton inspirant et des visuels colorés…"
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="studio-tone" className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">
                  Ton
                </label>
                <select
                  id="studio-tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">Plateformes cibles</p>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      aria-pressed={selectedPlatforms.includes(p.value)}
                      onClick={() => togglePlatform(p.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        selectedPlatforms.includes(p.value)
                          ? "border-indigo-400 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"
                          : "border-gray-200 text-gray-500 hover:border-indigo-200 dark:border-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400" role="alert">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isFormatting || !brief.trim() || selectedPlatforms.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isFormatting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isFormatting ? "Génération…" : "Générer le contenu"}
              </button>
              <button
                type="button"
                onClick={handleGenerateAll}
                disabled={isFormatting || !brief.trim()}
                title="Générer pour toutes les plateformes"
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tout générer
              </button>
            </div>
          </form>

          {/* Editor */}
          {result && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-200">Éditeur multi-plateforme</h2>
              <MultiPlatformEditor
                platforms={result.platforms}
                onTextChange={updatePlatformText}
                onHashtagsChange={updatePlatformHashtags}
              />
            </div>
          )}
        </div>

        {/* RIGHT: Preview (40%) */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {result && activePlatforms.length > 0 ? (
              <>
                {/* Preview tab switcher */}
                {activePlatforms.length > 1 && (
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {activePlatforms.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPreviewPlatform(p)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          displayPreview === p
                            ? "border-indigo-400 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"
                            : "border-gray-200 text-gray-400 hover:border-indigo-200 dark:border-gray-700"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
                {previewContent && (
                  <PlatformPreview
                    platform={displayPreview}
                    text={previewContent.text}
                    hashtags={previewContent.hashtags}
                  />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Sparkles className="h-10 w-10 text-gray-200" />
                <p className="text-sm text-gray-400">L'aperçu apparaîtra ici après la génération.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
