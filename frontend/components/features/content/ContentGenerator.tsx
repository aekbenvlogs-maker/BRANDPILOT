"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/components/features/content/ContentGenerator.tsx
// ============================================================

import React, { useRef, useState } from "react";
import { Copy, RefreshCw, Save, Hash } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGenerateText, useContentHistory } from "@/hooks/useContentGeneration";
import type { GenerateTextInput } from "@/hooks/useContentGeneration";

// ---------------------------------------------------------------------------
// Types & schema
// ---------------------------------------------------------------------------

type Platform = GenerateTextInput["platform"];

const PLATFORM_LIMITS: Record<Platform, number> = {
  instagram: 2200,
  tiktok:    300,
  youtube:   5000,
  x:         240,
  linkedin:  3000,
  email:     0,
};

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok:    "TikTok",
  youtube:   "YouTube",
  x:         "X (Twitter)",
  linkedin:  "LinkedIn",
  email:     "Email",
};

const generateSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "youtube", "x", "linkedin", "email"]),
  brief:    z.string().min(10, "Brief trop court (min 10 chars)").max(500, "Brief trop long (max 500)"),
  tone:     z.string().optional(),
  length:   z.enum(["short", "medium", "long"]).optional(),
});

type GenerateFormData = z.infer<typeof generateSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ContentGeneratorProps {
  projectId?: string;
  defaultTone?: string;
}

export function ContentGenerator({ projectId, defaultTone }: ContentGeneratorProps) {
  const { generate, isGenerating, result, error } = useGenerateText();
  const { history } = useContentHistory(projectId);
  const [editedText, setEditedText] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<GenerateFormData>({
    resolver: zodResolver(generateSchema),
    defaultValues: { platform: "instagram", tone: defaultTone, length: "medium" },
  });

  const platform  = watch("platform") as Platform;
  const briefValue = watch("brief") ?? "";
  const charLimit = PLATFORM_LIMITS[platform];
  const displayText = editedText || result?.text || "";

  const onSubmit = async (data: GenerateFormData) => {
    setEditedText("");
    await generate({ ...data, campaign_id: projectId ?? "" });
  };

  const handleCopy = async () => {
    if (!displayText) return;
    await navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Génération de contenu
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          {/* Platform */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Plateforme
            </label>
            <select
              {...register("platform")}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              {(Object.entries(PLATFORM_LABELS) as [Platform, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Brief */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Brief
            </label>
            <textarea
              {...register("brief")}
              rows={4}
              placeholder="Décrivez votre message ou produit en 10–500 caractères…"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white resize-none"
            />
            {errors.brief && (
              <p role="alert" className="text-xs text-red-500">{errors.brief.message}</p>
            )}
            <span className="text-right text-xs text-gray-400">
              {briefValue.length}/500
            </span>
          </div>

          {/* Tone + Length */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ton</label>
              <input
                {...register("tone")}
                placeholder="professionnel"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Longueur</label>
              <select
                {...register("length")}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="short">Court</option>
                <option value="medium">Moyen</option>
                <option value="long">Long</option>
              </select>
            </div>
          </div>

          <Button type="submit" variant="primary" loading={isGenerating} className="w-full">
            {isGenerating ? "Génération en cours…" : "Générer"}
          </Button>

          {error && (
            <p role="alert" className="text-xs text-red-500">{error}</p>
          )}
        </form>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
              Historique récent
            </h3>
            <ul className="flex flex-col gap-1 text-xs text-gray-500">
              {history.slice(0, 5).map((item) => (
                <li key={item.id} className="truncate rounded px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <span className="font-medium text-indigo-500">{item.platform}</span>{" "}
                  · {item.text.slice(0, 60)}…
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Right — result */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Résultat
        </h2>

        {isGenerating && (
          <div className="flex flex-col gap-2" aria-busy="true">
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden dark:bg-gray-700">
              <div className="h-2 w-2/3 rounded-full bg-indigo-500 animate-pulse" />
            </div>
            <Skeleton variant="text" />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
          </div>
        )}

        {!isGenerating && result && (
          <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            {/* Editable text */}
            <textarea
              value={displayText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={6}
              aria-label="Texte généré (éditable)"
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />

            {/* Char counter */}
            {charLimit > 0 && (
              <span
                className={[
                  "text-right text-xs",
                  displayText.length > charLimit ? "text-red-500" : "text-gray-400",
                ].join(" ")}
              >
                {displayText.length}/{charLimit} chars
              </span>
            )}

            {/* Hashtags */}
            {result.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {result.hashtags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(tag)}
                    aria-label={`Copier le hashtag ${tag}`}
                    className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <Hash className="h-3 w-3" aria-hidden="true" />
                    {tag.replace(/^#/, "")}
                  </button>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                aria-label="Copier le texte dans le presse-papier"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                {copied ? "Copié !" : "Copier"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSubmit(onSubmit)()}
                aria-label="Régénérer le contenu"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Régénérer
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="Sauvegarder le contenu"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Sauvegarder
              </Button>
            </div>
          </div>
        )}

        {!isGenerating && !result && (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-400">Le contenu généré apparaîtra ici</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContentGenerator;
