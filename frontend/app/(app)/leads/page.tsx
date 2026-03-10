"use client";

import { Suspense, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Upload, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import useLeads from "@/hooks/useLeads";
import { apiFetch, apiPost } from "@/utils/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { LeadTable } from "@/components/features/leads/LeadTable";

const addLeadSchema = z.object({
  first_name: z.string().optional(),
  last_name:  z.string().optional(),
  email:      z.string().email("Email invalide"),
  company:    z.string().optional(),
  sector:     z.string().optional(),
});
type AddLeadFormData = z.infer<typeof addLeadSchema>;

const PAGE_SIZE = 20;

function LeadsContent() {
  const searchParams = useSearchParams();
  const autoAdd = searchParams.get("action") === "add";

  const [page, setPage]               = useState(1);
  const [addModal, setAddModal]       = useState(autoAdd);
  const [csvModal, setCsvModal]       = useState(false);
  const [csvFile,  setCsvFile]        = useState<File | null>(null);
  const [csvPreview, setCsvPreview]   = useState<string[][]>([]);
  const [uploading, setUploading]     = useState(false);
  const [dragOver, setDragOver]       = useState(false);

  const { leads, total, isLoading, mutate } = useLeads(undefined);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AddLeadFormData>({
    resolver: zodResolver(addLeadSchema),
  });

  async function onAddLead(data: AddLeadFormData) {
    await apiPost("/api/v1/leads", data);
    reset();
    setAddModal(false);
    await mutate();
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "text/csv" || file?.name.endsWith(".csv")) {
      processCsvFile(file);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processCsvFile(file);
  }

  function processCsvFile(file: File) {
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = text.split("\n").slice(0, 4).map((r) => r.split(",").map((c) => c.trim()));
      setCsvPreview(rows);
    };
    reader.readAsText(file);
  }

  async function handleCsvUpload() {
    if (!csvFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      await apiFetch("/api/v1/leads/import", { method: "POST", body: formData });
      setCsvModal(false);
      setCsvFile(null);
      setCsvPreview([]);
      await mutate();
    } finally {
      setUploading(false);
    }
  }

  const paginatedLeads = (leads ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil((leads?.length ?? 0) / PAGE_SIZE));

  return (
    <main className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leads</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{total} lead{total !== 1 ? "s" : ""} au total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCsvModal(true)}>
            <Upload className="h-4 w-4" aria-hidden="true" /> Importer CSV
          </Button>
          <Button variant="primary" size="sm" onClick={() => setAddModal(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter un lead
          </Button>
        </div>
      </div>

      {/* Lead table */}
      <LeadTable leads={paginatedLeads} isLoading={isLoading} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Précédent</Button>
          <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Suivant</Button>
        </div>
      )}

      {/* Add lead modal */}
      <Modal
        isOpen={addModal}
        onClose={() => { setAddModal(false); reset(); }}
        title="Ajouter un lead"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => { setAddModal(false); reset(); }}>Annuler</Button>
            <Button variant="primary" size="md" loading={isSubmitting} onClick={handleSubmit(onAddLead)}>Ajouter</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prénom" register={register("first_name")} />
            <Input label="Nom" register={register("last_name")} />
          </div>
          <Input label="Email *" type="email" error={errors.email?.message} register={register("email")} />
          <Input label="Entreprise" register={register("company")} />
          <Input label="Secteur" register={register("sector")} />
        </div>
      </Modal>

      {/* CSV import modal */}
      <Modal
        isOpen={csvModal}
        onClose={() => { setCsvModal(false); setCsvFile(null); setCsvPreview([]); }}
        title="Importer des leads (CSV)"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => { setCsvModal(false); setCsvFile(null); setCsvPreview([]); }}>Annuler</Button>
            <Button variant="primary" size="md" loading={uploading} disabled={!csvFile} onClick={handleCsvUpload}>Importer</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Colonnes attendues : <code className="text-xs">email</code> (requis), <code className="text-xs">first_name</code>, <code className="text-xs">last_name</code>
          </p>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            className={[
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors",
              dragOver ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950" : "border-gray-300 hover:border-indigo-400 dark:border-gray-600",
            ].join(" ")}
          >
            <Upload className="h-8 w-8 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            <p className="mt-2 text-sm text-gray-500">Glissez votre fichier CSV ici ou</p>
            <label className="mt-1 cursor-pointer text-sm text-indigo-600 hover:underline dark:text-indigo-400">
              parcourir
              <input type="file" accept=".csv" className="sr-only" onChange={handleFileInput} />
            </label>
            {csvFile && (
              <div className="mt-2 flex items-center gap-1 text-sm font-medium text-green-600">
                {csvFile.name}
                <button type="button" onClick={() => { setCsvFile(null); setCsvPreview([]); }}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
          {/* Preview */}
          {csvPreview.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-xs">
                <tbody>
                  {csvPreview.map((row, i) => (
                    <tr key={i} className={i === 0 ? "bg-gray-50 font-semibold dark:bg-gray-800" : ""}>
                      {row.map((cell, j) => (
                        <td key={j} className="border-r border-gray-200 px-3 py-1.5 last:border-r-0 dark:border-gray-700">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {(leads?.length ?? 0) > 3 && <p className="px-3 pb-2 text-xs text-gray-400">… et plus de lignes</p>}
            </div>
          )}
        </div>
      </Modal>
    </main>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-8 w-40 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    }>
      <LeadsContent />
    </Suspense>
  );
}
