"use client";
// ============================================================
// PROJECT      : BRANDSCALE
// FILE         : frontend/components/leads/ImportCsvModal.tsx
// DESCRIPTION  : CSV import modal — dropzone, column mapping, preview, progress
// ============================================================

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/utils/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPECTED_FIELDS: {
  key: string;
  label: string;
  required: boolean;
}[] = [
  { key: "email",      label: "Email",        required: true  },
  { key: "first_name", label: "Prénom",        required: false },
  { key: "last_name",  label: "Nom",           required: false },
  { key: "company",    label: "Entreprise",    required: false },
  { key: "sector",     label: "Secteur",       required: false },
  { key: "source",     label: "Source",        required: false },
  { key: "opt_in",     label: "Consentement",  required: false },
];

const IGNORE_VALUE = "__ignore__";

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

/** Naive but functional CSV parser — handles quoted fields */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectHeaders(content: string): {
  headers: string[];
  rows: string[][];
} {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const headers = parseCsvLine(lines[0] ?? "");
  const rows = lines.slice(1, 4).map(parseCsvLine);
  return { headers, rows };
}

/** Auto-map CSV headers to expected fields by fuzzy match */
function autoMap(
  csvHeaders: string[],
): Record<string, string> {
  const map: Record<string, string> = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");
  const aliases: Record<string, string[]> = {
    email:      ["email", "mail", "courriel", "emailaddress"],
    first_name: ["firstname", "prenom", "prénom", "givenname", "name"],
    last_name:  ["lastname", "nom", "familyname", "surname"],
    company:    ["company", "entreprise", "societe", "société", "organization"],
    sector:     ["sector", "secteur", "industry"],
    source:     ["source", "provenance", "origin"],
    opt_in:     ["optin", "opt_in", "consent", "consentement", "gdpr"],
  };

  for (const [field, aliasList] of Object.entries(aliases)) {
    const matched = csvHeaders.find((h) =>
      aliasList.some((a) => normalize(h).includes(a)),
    );
    if (matched) map[field] = matched;
  }
  return map;
}

/** Apply column mapping: rename CSV header row */
function applyMapping(
  csvContent: string,
  csvHeaders: string[],
  fieldMap: Record<string, string>,
): string {
  const lines = csvContent.split(/\r?\n/);
  if (lines.length === 0) return csvContent;

  // Build: "csv header" → "standard field name"
  const renameMap: Record<string, string> = {};
  for (const [field, csvHeader] of Object.entries(fieldMap)) {
    if (csvHeader && csvHeader !== IGNORE_VALUE) {
      renameMap[csvHeader] = field;
    }
  }

  const newHeaders = csvHeaders.map((h) => renameMap[h] ?? h);
  lines[0] = newHeaders.join(",");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Import response
// ---------------------------------------------------------------------------

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  total_processed: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Required by the backend as a query param */
  projectId: string;
  onImported: (result: ImportResult) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportCsvModal({
  isOpen,
  onClose,
  projectId,
  onImported,
}: ImportCsvModalProps) {
  const [file,    setFile]    = useState<File | null>(null);
  const [rawCsv,  setRawCsv]  = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<string[][]>([]);
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [result,  setResult]  = useState<ImportResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // ── Dropzone ──────────────────────────────────────────────────────────────
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setApiError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRawCsv(text);
      const { headers: h, rows: r } = detectHeaders(text);
      setHeaders(h);
      setPreview(r);
      setFieldMap(autoMap(h));
    };
    reader.readAsText(f, "utf-8");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "text/plain": [".csv"] },
    maxFiles: 1,
    noClick: false,
  });

  // ── Mapping change ────────────────────────────────────────────────────────
  function setMapping(field: string, csvHeader: string) {
    setFieldMap((prev) => ({ ...prev, [field]: csvHeader }));
  }

  // ── Import ────────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!file || !rawCsv) return;
    setIsImporting(true);
    setProgress(0);
    setApiError(null);

    // Simulated progress bar animation
    const progressInterval = setInterval(() => {
      setProgress((p) => (p < 85 ? p + 5 : p));
    }, 200);

    try {
      // Transform CSV with column mapping applied
      const transformedCsv = applyMapping(rawCsv, headers, fieldMap);
      const blob = new Blob([transformedCsv], { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", blob, file.name);

      const url = `/api/v1/leads/import?project_id=${encodeURIComponent(projectId)}`;
      const importResult = await apiFetch<ImportResult>(url, {
        method: "POST",
        body: formData,
      });

      setProgress(100);
      setResult(importResult);
      onImported(importResult);
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : "Erreur lors de l'import",
      );
    } finally {
      clearInterval(progressInterval);
      setIsImporting(false);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function handleClose() {
    setFile(null);
    setRawCsv("");
    setHeaders([]);
    setPreview([]);
    setFieldMap({});
    setProgress(0);
    setResult(null);
    setApiError(null);
    onClose();
  }

  /** true only when email is mapped to a real CSV column (not ignored/blank) */
  const emailMapped =
    !!fieldMap["email"] && fieldMap["email"] !== IGNORE_VALUE;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Importer des leads (CSV)"
      maxWidth="max-w-2xl"
      footer={
        result ? (
          <Button variant="primary" size="md" onClick={handleClose}>
            Fermer
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={handleClose}>
              Annuler
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={isImporting}
              disabled={!file || !emailMapped || isImporting}
              onClick={() => void handleImport()}
            >
              Importer
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-5">

        {/* ── Success result ──────────────────────────────────────────────── */}
        {result && (
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-900/20">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                Import terminé
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-gray-900">
                <p className="text-2xl font-bold text-emerald-600">
                  {result.imported}
                </p>
                <p className="text-xs text-gray-500">Importés</p>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-gray-900">
                <p className="text-2xl font-bold text-amber-500">
                  {result.skipped}
                </p>
                <p className="text-xs text-gray-500">Ignorés</p>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-gray-900">
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                  {result.total_processed}
                </p>
                <p className="text-xs text-gray-500">Total traités</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                <p className="mb-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Erreurs ({result.errors.length}) :
                </p>
                <ul className="space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>…et {result.errors.length - 5} autres</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {!result && (
          <>
            {/* ── Drop zone ─────────────────────────────────────────────── */}
            <div
              {...getRootProps()}
              className={[
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                isDragActive
                  ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950"
                  : "border-gray-300 hover:border-indigo-400 dark:border-gray-600 dark:hover:border-indigo-500",
              ].join(" ")}
              aria-label="Zone de dépôt CSV"
            >
              <input {...getInputProps()} aria-label="Fichier CSV" />
              {file ? (
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                  {file.name}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setRawCsv("");
                      setHeaders([]);
                      setPreview([]);
                      setFieldMap({});
                    }}
                    className="ml-1 rounded text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="mb-2 h-8 w-8 text-gray-400" aria-hidden="true" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {isDragActive
                      ? "Relâchez pour charger le fichier…"
                      : "Glissez votre fichier CSV ici ou"}
                  </p>
                  {!isDragActive && (
                    <span className="mt-1 cursor-pointer text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                      Parcourir
                    </span>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    Colonnes acceptées : email (requis), first_name, last_name,
                    company, sector, source, opt_in
                  </p>
                </>
              )}
            </div>

            {/* ── Column mapping ────────────────────────────────────────── */}
            {headers.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Correspondance des colonnes
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {EXPECTED_FIELDS.map(({ key, label, required }) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label
                        htmlFor={`mapping-${key}`}
                        className="text-xs font-medium text-gray-700 dark:text-gray-300"
                      >
                        {label}
                        {required && (
                          <span className="ml-1 text-red-500">*</span>
                        )}
                      </label>
                      <select
                        id={`mapping-${key}`}
                        value={fieldMap[key] ?? IGNORE_VALUE}
                        onChange={(e) => setMapping(key, e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      >
                        <option value={IGNORE_VALUE}>— Ignorer —</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {!emailMapped && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    La colonne Email est obligatoire pour l&apos;import.
                  </p>
                )}
              </div>
            )}

            {/* ── Preview table ─────────────────────────────────────────── */}
            {preview.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Aperçu (3 premières lignes)
                </h3>
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        {headers.map((h) => (
                          <th
                            key={h}
                            className="border-r border-gray-200 px-3 py-2 text-left font-semibold text-gray-600 last:border-r-0 dark:border-gray-700 dark:text-gray-400"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                      {preview.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td
                              key={j}
                              className="border-r border-gray-100 px-3 py-1.5 text-gray-700 last:border-r-0 dark:border-gray-800 dark:text-gray-300"
                            >
                              {cell || (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Progress bar ──────────────────────────────────────────── */}
            {isImporting && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Import en cours…</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-indigo-500 transition-all duration-200"
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            )}

            {/* ── API error ─────────────────────────────────────────────── */}
            {apiError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 flex-shrink-0"
                  aria-hidden="true"
                />
                {apiError}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export default ImportCsvModal;
