"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/app/onboarding/page.tsx
// DESCRIPTION  : Multi-step onboarding — brand setup, style, first content
// ============================================================

import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  ChevronLeft,
  Copy,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { usePolling } from "@/hooks/useContentGeneration";
import { apiPost, apiPatch } from "@/utils/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTORS = [
  "Mode & Beauté",
  "Alimentation & Restauration",
  "Tech & Digital",
  "Santé & Bien-être",
  "Finance & Immobilier",
  "Éducation & Formation",
  "Sport & Lifestyle",
  "Voyage & Tourisme",
  "Art & Culture",
  "Commerce & Retail",
];

const TONES: { id: string; emoji: string; label: string; example: string }[] = [
  {
    id: "Professionnel",
    emoji: "💼",
    label: "Professionnel",
    example: "Nous vous accompagnons vers l'excellence avec rigueur et expertise.",
  },
  {
    id: "Décontracté",
    emoji: "😎",
    label: "Décontracté",
    example: "Salut ! On est là pour rendre ta vie plus simple, et un peu plus fun.",
  },
  {
    id: "Inspirant",
    emoji: "✨",
    label: "Inspirant",
    example: "Chaque jour est une nouvelle occasion de dépasser vos limites.",
  },
  {
    id: "Informatif",
    emoji: "📊",
    label: "Informatif",
    example: "Selon les dernières études, 78 % des consommateurs préfèrent…",
  },
  {
    id: "Humoristique",
    emoji: "😄",
    label: "Humoristique",
    example: "On ne sait pas tout faire, mais le café on maîtrise. ☕",
  },
];

const PLATFORMS: { id: string; label: string; emoji: string }[] = [
  { id: "instagram", label: "Instagram", emoji: "📸" },
  { id: "tiktok",    label: "TikTok",    emoji: "🎵" },
  { id: "youtube",   label: "YouTube",   emoji: "▶️" },
  { id: "x",         label: "X",         emoji: "𝕏" },
  { id: "linkedin",  label: "LinkedIn",  emoji: "💼" },
  { id: "email",     label: "Email",     emoji: "📧" },
];

const LOGO_MAX_BYTES  = 2 * 1024 * 1024;
const LOGO_ACCEPT     = ["image/png", "image/jpeg", "image/webp"];
const LOGO_ACCEPT_ATTR = ".png,.jpg,.jpeg,.webp";

// ── Wizard state ──────────────────────────────────────────────────────────────

interface WizardState {
  step:         1 | 2 | 3;
  projectId:    string | null;
  brandName:    string;
  sector:       string;
  description:  string;
  logoPreview:  string | null;
  logoFile:     File | null;
  tone:         string | null;
  platforms:    string[];
  brief:        string;
  generationOk: boolean;
}

type WizardAction =
  | { type: "SET_STEP";     step: 1 | 2 | 3 }
  | { type: "SET_PROJECT";  projectId: string; brandName: string; sector: string; description: string }
  | { type: "SET_LOGO";     preview: string; file: File }
  | { type: "CLEAR_LOGO" }
  | { type: "SET_TONE";     tone: string }
  | { type: "TOGGLE_PLAT";  platform: string }
  | { type: "SET_BRIEF";    brief: string }
  | { type: "GEN_OK" };

const initialState: WizardState = {
  step: 1,
  projectId:   null,
  brandName:   "",
  sector:      "",
  description: "",
  logoPreview: null,
  logoFile:    null,
  tone:        null,
  platforms:   [],
  brief:       "",
  generationOk: false,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_PROJECT":
      return {
        ...state,
        step:        2,
        projectId:   action.projectId,
        brandName:   action.brandName,
        sector:      action.sector,
        description: action.description,
      };
    case "SET_LOGO":
      return { ...state, logoPreview: action.preview, logoFile: action.file };
    case "CLEAR_LOGO":
      return { ...state, logoPreview: null, logoFile: null };
    case "SET_TONE":
      return { ...state, tone: action.tone };
    case "TOGGLE_PLAT": {
      const has = state.platforms.includes(action.platform);
      return {
        ...state,
        platforms: has
          ? state.platforms.filter((p) => p !== action.platform)
          : [...state.platforms, action.platform],
      };
    }
    case "SET_BRIEF":
      return { ...state, brief: action.brief };
    case "GEN_OK":
      return { ...state, generationOk: true };
    default:
      return state;
  }
}

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1 as const, label: "Votre marque" },
    { n: 2 as const, label: "Votre style" },
    { n: 3 as const, label: "Premier contenu" },
  ];

  return (
    <div
      className="mb-8 flex items-start"
      role="list"
      aria-label="Étapes d'onboarding"
    >
      {steps.map((s, i) => {
        const done   = s.n < current;
        const active = s.n === current;
        return (
          <div key={s.n} className="flex flex-1 items-start">
            <div className="flex flex-col items-center" role="listitem">
              <div
                aria-current={active ? "step" : undefined}
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all",
                  done
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : active
                    ? "border-indigo-500 bg-white text-indigo-600 shadow-sm dark:bg-gray-900 dark:text-indigo-400"
                    : "border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-900",
                ].join(" ")}
              >
                {done ? <CheckCircle className="h-5 w-5" /> : s.n}
              </div>
              <span
                className={[
                  "mt-1.5 text-center text-xs font-medium leading-tight",
                  active
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-gray-400 dark:text-gray-500",
                ].join(" ")}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={[
                  "mt-4 h-0.5 flex-1",
                  done ? "bg-indigo-500" : "bg-gray-200 dark:bg-gray-700",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── LogoUpload ────────────────────────────────────────────────────────────────

interface LogoUploadProps {
  preview: string | null;
  onSelect: (preview: string, file: File) => void;
  onClear: () => void;
}

function LogoUpload({ preview, onSelect, onClear }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);

  function handleFile(file: File) {
    setErr(null);
    if (!LOGO_ACCEPT.includes(file.type)) {
      setErr("Format non supporté (PNG, JPG ou WebP uniquement)");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setErr("Fichier trop lourd (max 2 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) onSelect(e.target.result as string, file);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Logo{" "}
        <span className="font-normal text-gray-400">(optionnel)</span>
      </label>

      {preview ? (
        <div className="flex items-center gap-3">
          <img
            src={preview}
            alt="Logo preview"
            className="h-16 w-16 rounded-lg border border-gray-200 bg-gray-50 object-contain p-1 dark:border-gray-700 dark:bg-gray-800"
          />
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" /> Supprimer
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500 transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-indigo-500"
        >
          <Upload className="h-6 w-6" />
          <span>Cliquer pour uploader votre logo</span>
          <span className="text-xs text-gray-400">PNG, JPG, WebP — max 2 Mo</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={LOGO_ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {err && <p className="text-xs text-red-500">{err}</p>}
    </div>
  );
}

// ── Step 1 schema ─────────────────────────────────────────────────────────────

const step1Schema = z.object({
  brand_name:  z.string().min(1, "Le nom est requis").max(100),
  sector:      z.string().min(1, "Le secteur est requis"),
  description: z
    .string()
    .max(200, "200 caractères maximum")
    .optional()
    .or(z.literal("")),
});

type Step1Data = z.infer<typeof step1Schema>;

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoading: authLoading }                    = useAuth();
  const { projects, isLoading: projectsLoading }      = useProjects();
  const { showToast }                                  = useToast();

  // Step 3: polling task state
  const [taskId,          setTaskId]          = useState<string | null>(null);
  const [isSubmittingGen, setIsSubmittingGen]  = useState(false);

  const {
    result:     pollResult,
    status:     pollStatus,
    isComplete: pollDone,
    error:      pollError,
  } = usePolling(taskId);

  // Derived helpers consumed by the render
  const isGenerating = isSubmittingGen || (taskId !== null && !pollDone);
  const genResult =
    pollDone && pollStatus !== "failed"
      ? (pollResult as { text: string; hashtags: string[] } | undefined)
      : null;
  const genError =
    pollDone && pollStatus === "failed"
      ? (pollError?.message ?? "La génération a échoué.")
      : null;

  const [wiz, dispatch]       = useReducer(wizardReducer, initialState);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const [copied,     setCopied]     = useState(false);

  // Guard: redirect if user already has a project
  useEffect(() => {
    if (!authLoading && !projectsLoading && projects.length > 0) {
      router.replace("/dashboard");
    }
  }, [authLoading, projectsLoading, projects, router]);

  // Mark generation as successful when polling reaches a terminal success status
  useEffect(() => {
    if (pollDone && pollStatus !== "failed" && pollResult) {
      dispatch({ type: "GEN_OK" });
    }
  }, [pollDone, pollStatus, pollResult]);

  // Step 1 form
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });

  const descValue = watch("description") ?? "";

  // ── Step handlers ────────────────────────────────────────────────────────

  async function onStep1(data: Step1Data) {
    setIsCreating(true);
    try {
      const body: Record<string, string> = {
        name:   data.brand_name,
        sector: data.sector,
      };
      if (data.description) body.description = data.description;

      let res: { id: string };
      if (wiz.logoFile) {
        const fd = new FormData();
        Object.entries(body).forEach(([k, v]) => fd.append(k, v));
        fd.append("logo", wiz.logoFile);
        res = await apiPost<{ id: string }>("/api/v1/projects", fd);
      } else {
        res = await apiPost<{ id: string }>("/api/v1/projects", body);
      }

      dispatch({
        type:        "SET_PROJECT",
        projectId:   res.id,
        brandName:   data.brand_name,
        sector:      data.sector,
        description: data.description ?? "",
      });
    } catch {
      showToast("Erreur lors de la création du projet.", "error");
    } finally {
      setIsCreating(false);
    }
  }

  async function onStep2() {
    if (!wiz.tone || wiz.platforms.length === 0 || !wiz.projectId) return;
    setIsSaving(true);
    try {
      await apiPatch(`/api/v1/projects/${wiz.projectId}`, {
        tone:      wiz.tone,
        platforms: wiz.platforms,
      });
      dispatch({ type: "SET_STEP", step: 3 });
    } catch {
      showToast("Erreur lors de la sauvegarde.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function onGenerate() {
    if (!wiz.brief.trim() || !wiz.projectId) return;
    // Reset any previous task so polling doesn't flash stale data
    setTaskId(null);
    setIsSubmittingGen(true);
    try {
      const platform = wiz.platforms[0] as
        | "instagram"
        | "tiktok"
        | "youtube"
        | "x"
        | "email"
        | "linkedin";
      const res = await apiPost<{ task_id: string }>(
        "/api/v1/content/text/generate",
        {
          platform,
          brief:      wiz.brief,
          tone:       wiz.tone ?? undefined,
          project_id: wiz.projectId,
        },
      );
      setTaskId(res.task_id);
      // SWR usePolling takes over from here
    } catch {
      showToast("Erreur lors du lancement de la génération.", "error");
    } finally {
      setIsSubmittingGen(false);
    }
  }

  function handleCopy() {
    const text = genResult?.text;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Loading splash
  if (authLoading || projectsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-12 dark:bg-gray-950">
      <div className="w-full max-w-xl">
        {/* Brand mark */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400">
            BRAND
            <span className="text-gray-900 dark:text-white">PILOT</span>
          </span>
          <p className="mt-1 text-sm text-gray-500">
            Configurons votre espace en 3 étapes.
          </p>
        </div>

        {/* Stepper */}
        <Stepper current={wiz.step} />

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-900">

          {/* ── ÉTAPE 1 — Votre marque ────────────────────────────────── */}
          {wiz.step === 1 && (
            <form
              onSubmit={handleSubmit(onStep1)}
              className="flex flex-col gap-5"
            >
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Votre marque
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Décrivez votre marque pour que l'IA s'adapte à votre univers.
                </p>
              </div>

              <Input
                label="Nom de la marque *"
                placeholder="ex: Ma Boutique Bio"
                error={errors.brand_name?.message}
                register={register("brand_name")}
              />

              {/* Sector select */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Secteur d'activité *
                </label>
                <select
                  {...register("sector")}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">Choisir un secteur…</option>
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {errors.sector && (
                  <p className="text-xs text-red-500">{errors.sector.message}</p>
                )}
              </div>

              {/* Description textarea */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Description{" "}
                    <span className="font-normal text-gray-400">(optionnel)</span>
                  </label>
                  <span
                    className={[
                      "text-xs tabular-nums",
                      descValue.length > 180
                        ? "text-red-500"
                        : descValue.length > 140
                        ? "text-amber-500"
                        : "text-gray-400",
                    ].join(" ")}
                  >
                    {descValue.length}/200
                  </span>
                </div>
                <textarea
                  {...register("description")}
                  rows={3}
                  maxLength={200}
                  placeholder="Décrivez votre marque, votre mission, vos valeurs…"
                  className="resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                {errors.description && (
                  <p className="text-xs text-red-500">
                    {errors.description.message}
                  </p>
                )}
              </div>

              {/* Logo upload */}
              <LogoUpload
                preview={wiz.logoPreview}
                onSelect={(preview, file) =>
                  dispatch({ type: "SET_LOGO", preview, file })
                }
                onClear={() => dispatch({ type: "CLEAR_LOGO" })}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isCreating}
                className="mt-2"
              >
                Créer mon espace →
              </Button>
            </form>
          )}

          {/* ── ÉTAPE 2 — Votre style ─────────────────────────────────── */}
          {wiz.step === 2 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Votre style
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Définissez le ton et les plateformes que vous utilisez.
                </p>
              </div>

              {/* Tone selector */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Ton de communication
                </h3>
                <div className="flex flex-col gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => dispatch({ type: "SET_TONE", tone: t.id })}
                      className={[
                        "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                        wiz.tone === t.id
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50"
                          : "border-gray-200 hover:border-indigo-300 dark:border-gray-700",
                      ].join(" ")}
                    >
                      <span className="mt-0.5 shrink-0 text-xl">{t.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {t.label}
                        </p>
                        <p className="mt-0.5 text-xs italic text-gray-500 dark:text-gray-400">
                          « {t.example} »
                        </p>
                      </div>
                      {wiz.tone === t.id && (
                        <CheckCircle className="ml-auto h-5 w-5 shrink-0 text-indigo-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform toggles */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Plateformes{" "}
                  <span className="font-normal text-gray-400">(minimum 1)</span>
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map((p) => {
                    const selected = wiz.platforms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() =>
                          dispatch({ type: "TOGGLE_PLAT", platform: p.id })
                        }
                        className={[
                          "flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition-all",
                          selected
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50"
                            : "border-gray-200 hover:border-indigo-300 dark:border-gray-700",
                        ].join(" ")}
                      >
                        <span className="text-xl">{p.emoji}</span>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {p.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {wiz.platforms.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Sélectionnez au moins une plateforme.
                  </p>
                )}
              </div>

              {/* Navigation */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => dispatch({ type: "SET_STEP", step: 1 })}
                  className="flex-1 gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Précédent
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  loading={isSaving}
                  disabled={!wiz.tone || wiz.platforms.length === 0}
                  onClick={onStep2}
                  className="flex-1"
                >
                  Suivant →
                </Button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 3 — Premier contenu ─────────────────────────────── */}
          {wiz.step === 3 && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Premier contenu
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Générez un post pour{" "}
                  <strong className="capitalize text-gray-700 dark:text-gray-300">
                    {wiz.platforms[0]}
                  </strong>{" "}
                  avec un ton{" "}
                  <strong className="text-gray-700 dark:text-gray-300">
                    {wiz.tone}
                  </strong>
                  .
                </p>
              </div>

              {/* Brief textarea */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  De quoi voulez-vous parler ? *
                </label>
                <textarea
                  value={wiz.brief}
                  onChange={(e) =>
                    dispatch({ type: "SET_BRIEF", brief: e.target.value })
                  }
                  rows={4}
                  placeholder="ex: Notre nouvelle collection printemps vient de sortir…"
                  className="resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* Action row */}
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => dispatch({ type: "SET_STEP", step: 2 })}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Précédent
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  loading={isGenerating}
                  disabled={!wiz.brief.trim() || isGenerating}
                  onClick={onGenerate}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Génération…
                    </>
                  ) : (
                    "Générer ✨"
                  )}
                </Button>
              </div>

              {/* Polling indicator */}
              {isGenerating && !genResult && (
                <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  L'IA rédige votre contenu…
                </div>
              )}

              {/* Error */}
              {genError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50">
                  Erreur : {genError}
                </div>
              )}

              {/* Result */}
              {genResult && (
                <div className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                  <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {genResult.text}
                  </p>
                  {genResult.hashtags?.length > 0 && (
                    <p className="mt-2 text-sm text-indigo-600 dark:text-indigo-400">
                      {genResult.hashtags.map((h) => `#${h}`).join(" ")}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-500 shadow hover:text-indigo-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    <Copy className="h-3 w-3" />
                    {copied ? "Copié !" : "Copier"}
                  </button>
                </div>
              )}

              {/* Dashboard CTA — visible only after successful generation */}
              {wiz.generationOk && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => router.push("/dashboard")}
                  className="mt-2"
                >
                  Accéder au tableau de bord 🚀
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
