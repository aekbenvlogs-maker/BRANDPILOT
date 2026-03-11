"use client";
// ============================================================
// PROJECT      : BRANDSCALE
// FILE         : frontend/app/(app)/content/new/page.tsx
// DESCRIPTION  : 3-step AI content generator — Form → Generating → Result
// ============================================================

import { useEffect, useRef, useState } from "react";
import {
  Instagram,
  Youtube,
  Linkedin,
  Twitter,
  Mail,
  Music,
  Hash,
  Copy,
  RefreshCw,
  Save,
  Loader2,
  CheckCircle2,
  X as XIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiPost } from "@/utils/api";
import { usePolling } from "@/hooks/useContentGeneration";
import type { GenerationResult } from "@/hooks/useContentGeneration";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

type Platform = "instagram" | "tiktok" | "youtube" | "x" | "linkedin" | "email";
type ToneValue = "professionnel" | "décontracté" | "inspirant" | "humoristique";

type PlatformConfig = {
  label: string;
  icon: React.ElementType;
  constraint: string;
  charLimit: number;
  hashtagLimit: number;
  color: string;
  activeBg: string;
};

const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  instagram: {
    label: "Instagram",
    icon: Instagram,
    constraint: "Max 2 200 car. · 30 hashtags",
    charLimit: 2200,
    hashtagLimit: 30,
    color: "text-pink-600 dark:text-pink-400",
    activeBg: "border-pink-400 bg-pink-50 dark:bg-pink-900/20 dark:border-pink-600",
  },
  tiktok: {
    label: "TikTok",
    icon: Music,
    constraint: "Max 300 car. · 10 hashtags",
    charLimit: 300,
    hashtagLimit: 10,
    color: "text-slate-800 dark:text-slate-300",
    activeBg: "border-slate-500 bg-slate-100 dark:bg-slate-800/60 dark:border-slate-500",
  },
  youtube: {
    label: "YouTube",
    icon: Youtube,
    constraint: "Max 5 000 car.",
    charLimit: 5000,
    hashtagLimit: 0,
    color: "text-red-600 dark:text-red-400",
    activeBg: "border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-600",
  },
  x: {
    label: "X (Twitter)",
    icon: Twitter,
    constraint: "Max 280 car.",
    charLimit: 280,
    hashtagLimit: 0,
    color: "text-sky-600 dark:text-sky-400",
    activeBg: "border-sky-400 bg-sky-50 dark:bg-sky-900/20 dark:border-sky-600",
  },
  linkedin: {
    label: "LinkedIn",
    icon: Linkedin,
    constraint: "Max 3 000 car. · 30 hashtags",
    charLimit: 3000,
    hashtagLimit: 30,
    color: "text-blue-700 dark:text-blue-400",
    activeBg: "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600",
  },
  email: {
    label: "Email",
    icon: Mail,
    constraint: "Illimité",
    charLimit: 0,
    hashtagLimit: 0,
    color: "text-emerald-600 dark:text-emerald-400",
    activeBg: "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-600",
  },
};

const TONE_OPTIONS: { value: ToneValue; label: string }[] = [
  { value: "professionnel", label: "💼 Professionnel" },
  { value: "décontracté",   label: "😎 Décontracté" },
  { value: "inspirant",     label: "✨ Inspirant" },
  { value: "humoristique",  label: "😄 Humoristique" },
];

const ROTATING_MESSAGES = [
  "Analyse du brief…",
  "Génération en cours…",
  "Optimisation pour la plateforme…",
  "Finalisation…",
];

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const generateSchema = z.object({
  platform:   z.enum(["instagram", "tiktok", "youtube", "x", "linkedin", "email"]),
  brief:      z.string().min(20, "Le brief doit faire au moins 20 caractères"),
  project_id: z.string().uuid("Sélectionnez un projet valide"),
  tone:       z
    .enum(["professionnel", "décontracté", "inspirant", "humoristique"])
    .optional(),
});

type GenerateFormData = z.infer<typeof generateSchema>;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Live character counter — green / orange / red relative to platform limit */
function CharCounter({ count, limit }: { count: number; limit: number }) {
  if (limit === 0)
    return <span className="text-right text-xs text-gray-400">{count} car.</span>;
  const ratio = count / limit;
  const colorCls =
    count > limit
      ? "text-red-500"
      : ratio > 0.85
      ? "text-amber-500"
      : "text-gray-400";
  return (
    <span className={`text-right text-xs font-medium ${colorCls}`}>
      {count}&thinsp;/&thinsp;{limit} car.
    </span>
  );
}

/** Simulated platform preview frame */
function PlatformPreview({
  platform,
  text,
  hashtags,
}: {
  platform: Platform;
  text: string;
  hashtags: string[];
}) {
  const tagsLine =
    hashtags.length > 0
      ? "\n\n" + hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
      : "";
  const fullText = text + tagsLine;

  if (platform === "instagram") {
    return (
      <div className="mx-auto w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 p-3 dark:border-gray-800">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-violet-600" />
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
            votre_compte
          </span>
        </div>
        <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-pink-100 to-violet-100 dark:from-pink-900/30 dark:to-violet-900/30">
          <Instagram className="h-12 w-12 text-pink-300" aria-hidden="true" />
        </div>
        <div className="p-3">
          <p className="line-clamp-4 whitespace-pre-line text-xs text-gray-700 dark:text-gray-300">
            {fullText}
          </p>
        </div>
      </div>
    );
  }

  if (platform === "tiktok") {
    return (
      <div className="relative mx-auto flex h-96 w-56 flex-col justify-end overflow-hidden rounded-2xl border-2 border-gray-800 bg-black p-4 shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="relative mb-2 flex items-center gap-2">
          <Music className="h-4 w-4 text-white" aria-hidden="true" />
          <span className="truncate text-xs text-white/80">Son original</span>
        </div>
        <p className="relative line-clamp-5 whitespace-pre-line text-xs text-white">
          {fullText}
        </p>
      </div>
    );
  }

  if (platform === "linkedin") {
    return (
      <div className="mx-auto w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700">
            <Linkedin className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-900 dark:text-white">Votre Nom</p>
            <p className="text-xs text-gray-400">Votre poste · maintenant</p>
          </div>
        </div>
        <div className="p-4">
          <p className="line-clamp-6 whitespace-pre-line text-xs text-gray-700 dark:text-gray-300">
            {fullText}
          </p>
        </div>
      </div>
    );
  }

  if (platform === "x") {
    return (
      <div className="mx-auto w-80 rounded-xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-900">
        <div className="flex gap-3 p-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sky-400">
            <Twitter className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-semibold text-gray-900 dark:text-white">Votre Nom</span>
              <span className="text-xs text-gray-400">@handle · maintenant</span>
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-800 dark:text-gray-200">
              {text}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "youtube") {
    return (
      <div className="mx-auto w-80 overflow-hidden rounded-xl border border-gray-200 shadow dark:border-gray-700">
        <div className="flex aspect-video items-center justify-center bg-gray-900">
          <Youtube className="h-12 w-12 text-red-500" aria-hidden="true" />
        </div>
        <div className="bg-white p-3 dark:bg-gray-900">
          <p className="line-clamp-2 text-xs font-semibold text-gray-900 dark:text-white">
            {text.split("\n")[0] || "Titre de la vidéo"}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">Votre chaîne · 0 vues</p>
          <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs text-gray-600 dark:text-gray-400">
            {text}
          </p>
        </div>
      </div>
    );
  }

  // email
  return (
    <div className="mx-auto w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-100 p-3 dark:border-gray-800">
        <p className="text-xs text-gray-400">De : votre@email.com</p>
        <p className="mt-0.5 text-xs font-semibold text-gray-800 dark:text-gray-200">
          {text.split("\n")[0] || "Objet du mail"}
        </p>
      </div>
      <div className="p-4">
        <p className="line-clamp-8 whitespace-pre-line text-xs text-gray-700 dark:text-gray-300">
          {text}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ContentNewPage() {
  const { projects, isLoading: projectsLoading } = useProjects();

  // ── State machine ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<"form" | "generating" | "result">("form");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Result state
  const [savedResult, setSavedResult] = useState<GenerationResult | null>(null);
  const [editedText, setEditedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Rotating status messages
  const [msgIndex, setMsgIndex] = useState(0);

  // Prevent double-transition (StrictMode double-effect)
  const transitionedRef = useRef(false);

  // ── Polling ────────────────────────────────────────────────────────────────
  const activeTaskId = step === "generating" ? taskId : null;
  const {
    status: pollStatus,
    result: pollResult,
    isComplete,
    error: pollError,
  } = usePolling(activeTaskId);

  // ── Form ───────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GenerateFormData>({
    resolver: zodResolver(generateSchema),
    defaultValues: { platform: "instagram" },
  });

  const selectedPlatform = watch("platform") as Platform;
  const toneValue = watch("tone") as ToneValue | undefined;
  const briefValue = watch("brief") ?? "";
  const config = PLATFORM_CONFIG[selectedPlatform];

  // ── Rotate status messages during generation ───────────────────────────────
  useEffect(() => {
    if (step !== "generating") return;
    const id = setInterval(
      () => setMsgIndex((i) => (i + 1) % ROTATING_MESSAGES.length),
      3000,
    );
    return () => clearInterval(id);
  }, [step]);

  // ── Transition to result / error when polling terminates ───────────────────
  useEffect(() => {
    if (!isComplete || step !== "generating" || transitionedRef.current) return;
    transitionedRef.current = true;

    if (pollResult) {
      const r = pollResult as GenerationResult;
      setSavedResult(r);
      setEditedText(r.text);
      setStep("result");
    } else {
      setSubmitError("La génération a échoué. Veuillez réessayer.");
      setStep("form");
    }
    setTaskId(null);
  }, [isComplete, pollResult, step]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const onSubmit = async (data: GenerateFormData) => {
    setSubmitError(null);
    setIsPosting(true);
    setMsgIndex(0);
    transitionedRef.current = false;
    try {
      const { task_id } = await apiPost<{ task_id: string }>(
        "/api/v1/content/text/generate",
        {
          platform:   data.platform,
          brief:      data.brief,
          tone:       data.tone,
          project_id: data.project_id,
        },
      );
      setTaskId(task_id);
      setStep("generating");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Erreur lors de la génération",
      );
    } finally {
      setIsPosting(false);
    }
  };

  const handleCancel = () => {
    setTaskId(null);
    setStep("form");
    transitionedRef.current = false;
  };

  const handleCopy = async () => {
    const text = editedText || savedResult?.text || "";
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    setSavedResult(null);
    setEditedText("");
    setCopied(false);
    setSavedMsg(null);
    setTaskId(null);
    setStep("form");
    transitionedRef.current = false;
  };

  const handleSave = async () => {
    const text = editedText || savedResult?.text || "";
    if (!text) return;
    try {
      await apiPost("/api/v1/content/save", {
        text,
        platform:  selectedPlatform,
        hashtags:  savedResult?.hashtags ?? [],
      });
      setSavedMsg("Sauvegardé ✓");
    } catch {
      // Endpoint not available — fallback to clipboard
      await navigator.clipboard.writeText(text);
      setSavedMsg("Copié dans le presse-papier ✓");
    }
    setTimeout(() => setSavedMsg(null), 3000);
  };

  const displayText = editedText || savedResult?.text || "";
  const hashtags    = savedResult?.hashtags ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Keyframe animations — indeterminate bar + message fade */}
      <style>{`
        @keyframes bs-indeterminate {
          0%   { transform: translateX(-110%); }
          60%  { transform: translateX(0%); }
          100% { transform: translateX(110%); }
        }
        @keyframes bs-fadein {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <main className="flex flex-col gap-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Générer du contenu
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Créez du contenu IA optimisé pour chaque plateforme
            </p>
          </div>
          {step !== "form" && (
            <button
              type="button"
              onClick={handleRegenerate}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Nouveau contenu
            </button>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            STEP 1 — FORM
        ════════════════════════════════════════════════════════════════════ */}
        {step === "form" && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="grid grid-cols-1 gap-8 lg:grid-cols-2"
          >
            {/* ── Left column ────────────────────────────────────────────── */}
            <div className="flex flex-col gap-6">

              {/* Platform cards */}
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Plateforme
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(
                    Object.entries(PLATFORM_CONFIG) as Array<[Platform, PlatformConfig]>
                  ).map(([key, cfg]) => {
                    const isSelected = selectedPlatform === key;
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setValue("platform", key)}
                        aria-pressed={isSelected}
                        className={[
                          "flex flex-col items-start gap-1.5 rounded-xl border-2 p-3 text-left transition-all",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                          isSelected
                            ? cfg.activeBg
                            : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600",
                        ].join(" ")}
                      >
                        <Icon
                          className={`h-5 w-5 ${isSelected ? cfg.color : "text-gray-400"}`}
                          aria-hidden="true"
                        />
                        <span
                          className={`text-xs font-semibold ${isSelected ? cfg.color : "text-gray-700 dark:text-gray-300"}`}
                        >
                          {cfg.label}
                        </span>
                        <span className="text-[10px] leading-tight text-gray-400 dark:text-gray-500">
                          {cfg.constraint}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {/* Hidden input to register field */}
                <input type="hidden" {...register("platform")} />
                {errors.platform && (
                  <p role="alert" className="text-xs text-red-500">
                    {errors.platform.message}
                  </p>
                )}
              </fieldset>

              {/* Brief textarea */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="brief"
                    className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Brief
                  </label>
                  <CharCounter count={briefValue.length} limit={500} />
                </div>
                <textarea
                  id="brief"
                  {...register("brief")}
                  rows={5}
                  placeholder="Décrivez votre message, produit ou objectif en 20–500 caractères…"
                  className="resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                {errors.brief && (
                  <p role="alert" className="text-xs text-red-500">
                    {errors.brief.message}
                  </p>
                )}
              </div>

              {/* Project selector */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="project_id"
                  className="text-sm font-semibold text-gray-700 dark:text-gray-300"
                >
                  Projet
                </label>
                {projectsLoading ? (
                  <Skeleton variant="rect" height="42px" className="rounded-xl" />
                ) : (
                  <select
                    id="project_id"
                    {...register("project_id")}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">Sélectionner un projet…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                {errors.project_id && (
                  <p role="alert" className="text-xs text-red-500">
                    {errors.project_id.message}
                  </p>
                )}
              </div>

              {/* Tone toggle pills */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Ton{" "}
                  <span className="font-normal text-gray-400">(optionnel)</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {TONE_OPTIONS.map((opt) => {
                    const isSelected = toneValue === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setValue(
                            "tone",
                            isSelected ? undefined : opt.value,
                          )
                        }
                        aria-pressed={isSelected}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300",
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Right column — preview placeholder + CTA ─────────────── */}
            <div className="flex flex-col gap-4">
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 dark:border-gray-700 dark:bg-gray-900/40">
                {(() => {
                  const Icon = config.icon;
                  return (
                    <>
                      <Icon
                        className={`mb-3 h-14 w-14 opacity-20 ${config.color}`}
                        aria-hidden="true"
                      />
                      <p className="text-sm font-medium text-gray-400">
                        {config.label}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {config.constraint}
                      </p>
                    </>
                  );
                })()}
              </div>

              {submitError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                >
                  {submitError}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isPosting}
                className="w-full"
              >
                ✨ Générer
              </Button>
            </div>
          </form>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 2 — GENERATING
        ════════════════════════════════════════════════════════════════════ */}
        {step === "generating" && (
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 py-20 text-center">
            {/* Indeterminate progress bar */}
            <div
              role="progressbar"
              aria-label="Génération en cours"
              className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
            >
              <div
                className="absolute h-full w-1/2 rounded-full bg-indigo-500"
                style={{ animation: "bs-indeterminate 1.8s ease-in-out infinite" }}
              />
            </div>

            {/* Spinner */}
            <Loader2
              className="h-10 w-10 animate-spin text-indigo-500"
              aria-hidden="true"
            />

            {/* Rotating message */}
            <div className="flex flex-col gap-1" aria-live="polite" aria-atomic="true">
              <p
                key={msgIndex}
                className="text-base font-semibold text-gray-900 dark:text-white"
                style={{ animation: "bs-fadein 0.4s ease" }}
              >
                {ROTATING_MESSAGES[msgIndex]}
              </p>
              {pollStatus && (
                <p className="text-xs text-gray-400">
                  État : <span className="font-medium">{pollStatus}</span>
                </p>
              )}
            </div>

            {/* Poll error */}
            {pollError && (
              <p role="alert" className="text-sm text-red-500">
                {pollError.message}
              </p>
            )}

            <Button variant="ghost" size="md" onClick={handleCancel}>
              Annuler
            </Button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 3 — RESULT
        ════════════════════════════════════════════════════════════════════ */}
        {step === "result" && savedResult && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* ── Left — editable content ───────────────────────────────── */}
            <div className="flex flex-col gap-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Contenu généré
              </h2>

              {/* Editable text block */}
              <div className="flex flex-col gap-1.5">
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  rows={9}
                  aria-label="Texte généré (éditable)"
                  className="resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <div className="flex justify-end">
                  <CharCounter
                    count={editedText.length}
                    limit={config.charLimit}
                  />
                </div>
              </div>

              {/* Hashtag badges */}
              {hashtags.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Hashtags — cliquer pour copier
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {hashtags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            tag.startsWith("#") ? tag : `#${tag}`,
                          )
                        }
                        title="Copier ce hashtag"
                        className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                      >
                        <Hash className="h-3 w-3" aria-hidden="true" />
                        {tag.replace(/^#/, "")}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleCopy()}
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {copied ? "Copié !" : "Copier"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRegenerate}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Régénérer
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleSave()}
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Sauvegarder
                </Button>
              </div>

              {/* Saved confirmation */}
              {savedMsg && (
                <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {savedMsg}
                </p>
              )}

              {/* Token/cost info */}
              {(savedResult.tokens_used > 0 || savedResult.cost_usd > 0) && (
                <p className="text-xs text-gray-400">
                  {savedResult.tokens_used} tokens ·{" "}
                  <span className="font-mono">${savedResult.cost_usd.toFixed(4)}</span>
                </p>
              )}
            </div>

            {/* ── Right — platform preview ───────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Aperçu{" "}
                <span className={config.color}>{config.label}</span>
              </h2>
              <div className="flex min-h-[360px] items-center justify-center rounded-2xl bg-gray-50 p-6 dark:bg-gray-900/50">
                <PlatformPreview
                  platform={selectedPlatform}
                  text={displayText}
                  hashtags={hashtags}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
