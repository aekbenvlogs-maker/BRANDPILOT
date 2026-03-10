// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/studio/MultiPlatformEditor.tsx
// ============================================================
"use client";

import React, { useState, KeyboardEvent } from "react";
import { Copy, RefreshCw, Save, Hash, X as XIcon, Check } from "lucide-react";
import { useGenerateHashtags } from "@/hooks/useContentFormatter";
import type { ContentPlatform, PlatformContent } from "@/hooks/useContentFormatter";

// ──────────────────────────────────────────────────────────────
// PLATFORM CONFIG
// ──────────────────────────────────────────────────────────────
const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  linkedin: "LinkedIn",
};

const PLATFORM_COLORS: Record<ContentPlatform, string> = {
  instagram: "from-purple-500 to-pink-500",
  tiktok: "from-gray-900 to-gray-700",
  youtube: "from-red-600 to-red-500",
  x: "from-gray-900 to-gray-800",
  linkedin: "from-blue-700 to-blue-600",
};

// ──────────────────────────────────────────────────────────────
// HASHTAG CHIP
// ──────────────────────────────────────────────────────────────
interface HashtagChipProps {
  tag: string;
  onRemove: (tag: string) => void;
}
function HashtagChip({ tag, onRemove }: HashtagChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
      #{tag.replace(/^#/, "")}
      <button
        onClick={() => onRemove(tag)}
        aria-label={`Supprimer #${tag}`}
        className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-800"
      >
        <XIcon className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ──────────────────────────────────────────────────────────────
// PLATFORM EDITOR TAB
// ──────────────────────────────────────────────────────────────
interface PlatformTabProps {
  content: PlatformContent;
  onTextChange: (text: string) => void;
  onHashtagsChange: (hashtags: string[]) => void;
  onCopy: () => void;
  onSave?: () => void;
}

function PlatformTabContent({ content, onTextChange, onHashtagsChange, onCopy, onSave }: PlatformTabProps) {
  const { generate, isGenerating } = useGenerateHashtags();
  const [hashtagInput, setHashtagInput] = useState("");
  const [copied, setCopied] = useState(false);
  const isOver = content.char_count > content.char_limit;

  const handleCopy = async () => {
    const full = `${content.text}\n\n${content.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddHashtag = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = hashtagInput.trim().replace(/^#/, "");
      if (tag && !content.hashtags.includes(tag)) {
        onHashtagsChange([...content.hashtags, tag]);
      }
      setHashtagInput("");
    }
  };

  const handleRemoveHashtag = (tag: string) => {
    onHashtagsChange(content.hashtags.filter((h) => h !== tag));
  };

  const handleRegenerateHashtags = async () => {
    const newTags = await generate({ text: content.text, platform: content.platform, count: 15 });
    if (newTags.length > 0) onHashtagsChange(newTags);
  };

  return (
    <div className="space-y-3">
      {/* Textarea */}
      <div className="relative">
        <textarea
          value={content.text}
          onChange={(e) => onTextChange(e.target.value)}
          rows={6}
          aria-label={`Contenu pour ${PLATFORM_LABELS[content.platform]}`}
          className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        />
        {/* Char counter */}
        <span
          className={`absolute bottom-2 right-3 text-xs font-medium ${
            isOver ? "text-red-500" : "text-gray-400"
          }`}
          aria-live="polite"
          aria-label={`${content.char_count} caractères sur ${content.char_limit} maximum`}
        >
          {content.char_count}/{content.char_limit}
        </span>
      </div>

      {isOver && (
        <p className="text-xs text-red-500" role="alert">
          Dépassement de {content.char_count - content.char_limit} caractères.
        </p>
      )}

      {/* Hashtags */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Hashtags</span>
          <button
            onClick={handleRegenerateHashtags}
            disabled={isGenerating}
            aria-label="Régénérer les hashtags"
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isGenerating ? "animate-spin" : ""}`} />
            Régénérer
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-gray-100 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/50">
          {content.hashtags.map((tag) => (
            <HashtagChip key={tag} tag={tag} onRemove={handleRemoveHashtag} />
          ))}
          <input
            type="text"
            value={hashtagInput}
            onChange={(e) => setHashtagInput(e.target.value)}
            onKeyDown={handleAddHashtag}
            placeholder="Ajouter un hashtag…"
            aria-label="Ajouter un hashtag, appuyer sur Entrée"
            className="min-w-[120px] flex-1 bg-transparent text-xs text-gray-600 placeholder-gray-300 focus:outline-none dark:text-gray-300"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copié !" : "Copier"}
        </button>
        {onSave && (
          <button
            onClick={onSave}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Save className="h-3.5 w-3.5" />
            Enregistrer
          </button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// MULTI-PLATFORM EDITOR
// ──────────────────────────────────────────────────────────────
interface MultiPlatformEditorProps {
  platforms: Partial<Record<ContentPlatform, PlatformContent>>;
  onTextChange: (platform: ContentPlatform, text: string) => void;
  onHashtagsChange: (platform: ContentPlatform, hashtags: string[]) => void;
  onSave?: (platform: ContentPlatform) => void;
}

const TAB_ORDER: ContentPlatform[] = ["instagram", "tiktok", "youtube", "x", "linkedin"];

export function MultiPlatformEditor({
  platforms,
  onTextChange,
  onHashtagsChange,
  onSave,
}: MultiPlatformEditorProps) {
  const activePlatforms = TAB_ORDER.filter((p) => platforms[p]);
  const [activeTab, setActiveTab] = useState<ContentPlatform>(activePlatforms[0] ?? "instagram");

  if (activePlatforms.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 py-10 text-center dark:border-gray-700">
        <Hash className="h-10 w-10 text-gray-300" />
        <p className="text-sm text-gray-400">Générez du contenu pour voir l'éditeur.</p>
      </div>
    );
  }

  const activeContent = platforms[activeTab];

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Plateformes">
        {activePlatforms.map((p) => {
          const content = platforms[p];
          const isOver = content ? content.char_count > content.char_limit : false;
          return (
            <button
              key={p}
              role="tab"
              aria-selected={activeTab === p}
              onClick={() => setActiveTab(p)}
              className={`relative flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === p
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                  : "border-gray-200 bg-white text-gray-600 hover:border-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {PLATFORM_LABELS[p]}
              {isOver && (
                <span className="flex h-2 w-2 rounded-full bg-red-500" aria-label="Dépassement" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      {activeContent && (
        <div
          role="tabpanel"
          aria-label={`Éditeur ${PLATFORM_LABELS[activeTab]}`}
          className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className={`mb-3 h-1 w-10 rounded-full bg-gradient-to-r ${PLATFORM_COLORS[activeTab]}`} aria-hidden="true" />
          <PlatformTabContent
            content={activeContent}
            onTextChange={(text) => onTextChange(activeTab, text)}
            onHashtagsChange={(hashtags) => onHashtagsChange(activeTab, hashtags)}
            onCopy={() => {}}
            onSave={onSave ? () => onSave(activeTab) : undefined}
          />
        </div>
      )}
    </div>
  );
}
