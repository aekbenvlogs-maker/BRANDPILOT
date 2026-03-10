// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/features/studio/GridMakerCanvas.tsx
// ============================================================
"use client";

import React, { useCallback, useState } from "react";
import { Upload, Download, Grid, Loader2, X as XIcon, AlertCircle } from "lucide-react";
import { apiPost } from "@/utils/api";

// ──────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────
type GridType = "3x3" | "2x2" | "4x4" | "3x1" | "1x3";

interface GridResult {
  tiles: { index: number; url: string }[];
  zip_url: string;
  grid_type: GridType;
  preview_url?: string;
}

const GRID_TYPES: { value: GridType; label: string; cols: number }[] = [
  { value: "3x3", label: "3×3 (9 tuiles)", cols: 3 },
  { value: "2x2", label: "2×2 (4 tuiles)", cols: 2 },
  { value: "4x4", label: "4×4 (16 tuiles)", cols: 4 },
  { value: "3x1", label: "3×1 (panorama lignes)", cols: 3 },
  { value: "1x3", label: "1×3 (panorama colonnes)", cols: 1 },
];

// ──────────────────────────────────────────────────────────────
// GRID MAKER CANVAS
// ──────────────────────────────────────────────────────────────
export function GridMakerCanvas() {
  const [isDragging, setIsDragging] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [gridType, setGridType] = useState<GridType>("3x3");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<GridResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("L'image ne doit pas dépasser 20 Mo.");
      return;
    }
    setError(null);
    setImageFile(file);
    setResult(null);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleGenerate = async () => {
    if (!imageFile) return;
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("grid_type", gridType);
      const data = await apiPost<GridResult>("/api/v1/content/format/grid", formData);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la génération de la grille");
    } finally {
      setIsProcessing(false);
    }
  };

  const currentGridConfig = GRID_TYPES.find((g) => g.value === gridType) ?? GRID_TYPES[0];

  return (
    <div className="space-y-6">
      {/* Grid type selector */}
      <div className="flex flex-wrap gap-2">
        {GRID_TYPES.map((gt) => (
          <button
            key={gt.value}
            onClick={() => setGridType(gt.value)}
            aria-pressed={gridType === gt.value}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              gridType === gt.value
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                : "border-gray-200 text-gray-500 hover:border-indigo-200 dark:border-gray-700 dark:text-gray-400"
            }`}
          >
            {gt.label}
          </button>
        ))}
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragging
            ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/10"
            : "border-gray-200 hover:border-indigo-300 dark:border-gray-700"
        }`}
        aria-label="Zone de dépôt d'image"
        role="region"
      >
        {imagePreview ? (
          <div className="relative">
            <img src={imagePreview} alt="Aperçu de l'image" className="max-h-48 rounded-lg object-cover" />
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
            <Upload className="h-10 w-10 text-gray-300" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Glissez-déposez une image ici
              </p>
              <p className="mt-0.5 text-xs text-gray-400">JPG, PNG, WEBP · 20 Mo max</p>
            </div>
          </>
        )}
        <label className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700">
          {imageFile ? "Changer l'image" : "Choisir un fichier"}
          <input type="file" accept="image/*" onChange={handleInputChange} className="sr-only" />
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!imageFile || isProcessing}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Grid className="h-4 w-4" />
        )}
        {isProcessing ? "Génération de la grille…" : "Générer la grille"}
      </button>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Aperçu du profil Instagram
            </h3>
            <a
              href={result.zip_url}
              download="grid.zip"
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              aria-label="Télécharger toutes les tuiles en ZIP"
            >
              <Download className="h-3.5 w-3.5" /> Télécharger tout (.zip)
            </a>
          </div>

          {/* IG profile grid preview */}
          <div
            className={`grid gap-0.5`}
            style={{ gridTemplateColumns: `repeat(${currentGridConfig.cols}, 1fr)` }}
            aria-label={`Grille ${result.grid_type}`}
          >
            {result.tiles.map((tile) => (
              <div key={tile.index} className="group relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img
                  src={tile.url}
                  alt={`Tuile ${tile.index + 1}`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <a
                    href={tile.url}
                    download={`tile_${tile.index + 1}.jpg`}
                    aria-label={`Télécharger la tuile ${tile.index + 1}`}
                    className="rounded-full bg-white/20 p-2 text-white backdrop-blur-sm hover:bg-white/40"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
