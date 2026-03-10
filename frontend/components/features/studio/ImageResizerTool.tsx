// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/studio/ImageResizerTool.tsx
// ============================================================
"use client";

import React, { useCallback, useState } from "react";
import { Upload, Download, ImageIcon, Loader2, X as XIcon, AlertCircle, Check } from "lucide-react";
import { apiPost } from "@/utils/api";

// ──────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────
interface ResizeFormat {
  id: string;
  label: string;
  width: number;
  height: number;
  platform: string;
  description: string;
}

interface ResizeResult {
  resized: { format_id: string; url: string; size_bytes: number }[];
  zip_url: string;
}

const FORMATS: ResizeFormat[] = [
  { id: "ig_post", label: "Instagram Post", width: 1080, height: 1080, platform: "instagram", description: "1080×1080 carré" },
  { id: "ig_story", label: "Instagram Story", width: 1080, height: 1920, platform: "instagram", description: "1080×1920 vertical" },
  { id: "ig_reel", label: "Instagram Reel", width: 1080, height: 1920, platform: "instagram", description: "1080×1920 vertical" },
  { id: "fb_post", label: "Facebook Post", width: 1200, height: 630, platform: "facebook", description: "1200×630 paysage" },
  { id: "yt_thumbnail", label: "YouTube Thumbnail", width: 1280, height: 720, platform: "youtube", description: "1280×720 HD" },
  { id: "x_post", label: "X / Twitter Post", width: 1200, height: 675, platform: "x", description: "1200×675 16:9" },
  { id: "linkedin_post", label: "LinkedIn Post", width: 1200, height: 627, platform: "linkedin", description: "1200×627" },
  { id: "tiktok_cover", label: "TikTok Cover", width: 1080, height: 1920, platform: "tiktok", description: "1080×1920 vertical" },
];

const PLATFORM_GROUPS = [...new Set(FORMATS.map((f) => f.platform))];

// ──────────────────────────────────────────────────────────────
// IMAGE RESIZER TOOL
// ──────────────────────────────────────────────────────────────
export function ImageResizerTool() {
  const [isDragging, setIsDragging] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(["ig_post", "ig_story", "yt_thumbnail"]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ResizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image.");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setError("L'image ne doit pas dépasser 30 Mo.");
      return;
    }
    setError(null);
    setImageFile(file);
    setResult(null);
    setProgress(0);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const toggleFormat = (id: string) => {
    setSelectedFormats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const togglePlatform = (platform: string) => {
    const platformFormats = FORMATS.filter((f) => f.platform === platform).map((f) => f.id);
    const allSelected = platformFormats.every((id) => selectedFormats.includes(id));
    if (allSelected) {
      setSelectedFormats((prev) => prev.filter((id) => !platformFormats.includes(id)));
    } else {
      setSelectedFormats((prev) => [...new Set([...prev, ...platformFormats])]);
    }
  };

  const handleResize = async () => {
    if (!imageFile || selectedFormats.length === 0) return;
    setIsProcessing(true);
    setError(null);
    setProgress(10);

    // Simulate progress increments
    const progressTimer = setInterval(() => {
      setProgress((p) => Math.min(p + 8, 90));
    }, 300);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      selectedFormats.forEach((fId) => formData.append("formats", fId));
      const data = await apiPost<ResizeResult>("/api/v1/content/resize", formData);
      setResult(data);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du redimensionnement");
    } finally {
      clearInterval(progressTimer);
      setIsProcessing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/10" : "border-gray-200 hover:border-indigo-300 dark:border-gray-700"
        }`}
        role="region"
        aria-label="Zone de dépôt d'image"
      >
        {imagePreview ? (
          <div className="relative">
            <img src={imagePreview} alt="Aperçu" className="max-h-40 rounded-lg object-cover" />
            <button
              onClick={() => { setImageFile(null); setImagePreview(null); setResult(null); }}
              aria-label="Supprimer l'image"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <ImageIcon className="h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Déposez votre image ici</p>
            <p className="text-xs text-gray-400">JPG, PNG, WEBP, GIF · 30 Mo max</p>
          </>
        )}
        <label className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700">
          {imageFile ? "Changer l'image" : "Choisir un fichier"}
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="sr-only" />
        </label>
      </div>

      {/* Format selection */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Formats cibles</h3>
          <span className="text-xs text-gray-400">{selectedFormats.length} sélectionné(s)</span>
        </div>
        <div className="space-y-3">
          {PLATFORM_GROUPS.map((platform) => {
            const pFormats = FORMATS.filter((f) => f.platform === platform);
            const allPlatformSelected = pFormats.every((f) => selectedFormats.includes(f.id));
            return (
              <div key={platform} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={allPlatformSelected}
                    onChange={() => togglePlatform(platform)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                  />
                  {platform}
                </label>
                <div className="flex flex-wrap gap-2">
                  {pFormats.map((fmt) => (
                    <label
                      key={fmt.id}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selectedFormats.includes(fmt.id)
                          ? "border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                          : "border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFormats.includes(fmt.id)}
                        onChange={() => toggleFormat(fmt.id)}
                        className="sr-only"
                      />
                      {selectedFormats.includes(fmt.id) && <Check className="h-3 w-3 text-indigo-500" />}
                      <span>{fmt.label}</span>
                      <span className="text-gray-400">({fmt.description})</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Progress bar */}
      {isProcessing && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>Redimensionnement en cours…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Resize button */}
      <button
        onClick={handleResize}
        disabled={!imageFile || selectedFormats.length === 0 || isProcessing}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
        {isProcessing ? "Traitement…" : `Redimensionner (${selectedFormats.length} format${selectedFormats.length > 1 ? "s" : ""})`}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Résultats — {result.resized.length} fichier(s)
            </h3>
            <a
              href={result.zip_url}
              download="resized.zip"
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              aria-label="Télécharger tous les formats en ZIP"
            >
              <Download className="h-3.5 w-3.5" /> Tout télécharger (.zip)
            </a>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {result.resized.map((r) => {
              const fmt = FORMATS.find((f) => f.id === r.format_id);
              return (
                <div
                  key={r.format_id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
                >
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{fmt?.label ?? r.format_id}</p>
                    <p className="text-xs text-gray-400">{fmt?.description} · {formatBytes(r.size_bytes)}</p>
                  </div>
                  <a
                    href={r.url}
                    download={`${r.format_id}.jpg`}
                    aria-label={`Télécharger ${fmt?.label}`}
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 hover:text-indigo-600 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
