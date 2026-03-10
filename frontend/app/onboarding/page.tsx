"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { apiPost, apiPatch } from "@/utils/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

// ── Step schemas ──────────────────────────────────────────────
const step1Schema = z.object({
  project_name: z.string().min(1, "Le nom est requis").max(100),
  sector:       z.string().min(1, "Le secteur est requis"),
  brand_url:    z.string().url("URL invalide").optional().or(z.literal("")),
});

type Step1Data = z.infer<typeof step1Schema>;

const TONES = [
  { id: "Formel",        emoji: "🎩", desc: "Sérieux, institutionnel" },
  { id: "Créatif",       emoji: "🎨", desc: "Original, imaginatif" },
  { id: "Inspirant",     emoji: "✨", desc: "Motivant, positif" },
  { id: "Énergique",     emoji: "⚡", desc: "Dynamique, percutant" },
  { id: "Professionnel", emoji: "💼", desc: "Expert, fiable" },
  { id: "Humour",        emoji: "😄", desc: "Léger, décalé" },
] as const;

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Étape {step} sur {total}</span>
        <span>{Math.round((step / total) * 100)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router      = useRouter();
  const { user, isLoading, refreshToken } = useAuth();
  const { showToast } = useToast();

  const [step,       setStep]       = useState<1 | 2 | 3>(1);
  const [projectId,  setProjectId]  = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<string | null>(null);
  const [aiCaption,  setAiCaption]  = useState<string | null>(null);
  const [copied,     setCopied]     = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingTone, setIsSavingTone] = useState(false);
  const [isFinishing, setIsFinishing]   = useState(false);

  // Redirect if already onboarded
  useEffect(() => {
    if (!isLoading && user?.onboarding_done) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  // Step 1 form
  const { register, handleSubmit, formState: { errors } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
  });

  // ── Step 1: create project ───────────────────────────────────
  async function onStep1(data: Step1Data) {
    setIsCreating(true);
    try {
      const res = await apiPost<{ id: string }>("/api/v1/projects", {
        name:      data.project_name,
        sector:    data.sector,
        brand_url: data.brand_url || undefined,
      });
      setProjectId(res.id);
      setStep(2);
    } catch {
      showToast("Erreur lors de la création du projet.", "error");
    } finally {
      setIsCreating(false);
    }
  }

  // ── Step 2: save tone ────────────────────────────────────────
  async function onStep2() {
    if (!selectedTone || !projectId) return;
    setIsSavingTone(true);
    try {
      await apiPatch(`/api/v1/projects/${projectId}`, { tone: selectedTone });
      // Auto-generate Instagram caption
      const res = await apiPost<{ text?: string }>("/api/v1/content/text/generate", {
        platform:   "instagram",
        brief:      `Présente ma marque en mode ${selectedTone}`,
        project_id: projectId,
      });
      setAiCaption(res.text ?? null);
      setStep(3);
    } catch {
      showToast("Erreur lors de la génération du contenu.", "error");
    } finally {
      setIsSavingTone(false);
    }
  }

  // ── Step 3: finish onboarding ────────────────────────────────
  async function onFinish() {
    setIsFinishing(true);
    try {
      await apiPatch("/api/v1/auth/me", { onboarding_done: true });
      await refreshToken();
      router.push("/dashboard");
    } catch {
      showToast("Erreur lors de la finalisation.", "error");
      setIsFinishing(false);
    }
  }

  function handleCopy() {
    if (!aiCaption) return;
    navigator.clipboard.writeText(aiCaption).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (isLoading) return null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400">
            BRAND<span className="text-gray-900 dark:text-white">PILOT</span>
          </span>
          <p className="mt-1 text-sm text-gray-500">Bienvenue ! Configurons votre espace.</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-6">
            <ProgressBar step={step} total={3} />
          </div>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <form onSubmit={handleSubmit(onStep1)} className="flex flex-col gap-5">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Votre marque</h2>
              <Input
                label="Nom du projet / marque *"
                placeholder="ex: Ma Boutique Bio"
                error={errors.project_name?.message}
                register={register("project_name")}
              />
              <Input
                label="Secteur d'activité *"
                placeholder="ex: Mode, Alimentation, Tech..."
                error={errors.sector?.message}
                register={register("sector")}
              />
              <Input
                label="URL du site (optionnel)"
                type="url"
                placeholder="https://example.com"
                error={errors.brand_url?.message}
                register={register("brand_url")}
              />
              <Button type="submit" variant="primary" size="lg" loading={isCreating} className="mt-2">
                Continuer →
              </Button>
            </form>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Votre tonalité</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Choisissez le ton qui correspond à votre marque.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTone(t.id)}
                    className={[
                      "flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 text-center transition-all",
                      selectedTone === t.id
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                        : "border-gray-200 hover:border-indigo-300 dark:border-gray-700",
                    ].join(" ")}
                  >
                    <span className="text-2xl" role="img" aria-label={t.id}>{t.emoji}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{t.id}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t.desc}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" size="md" onClick={() => setStep(1)} className="flex-1">← Retour</Button>
                <Button
                  variant="primary"
                  size="md"
                  loading={isSavingTone}
                  disabled={!selectedTone}
                  onClick={onStep2}
                  className="flex-1"
                >
                  Générer mon premier contenu →
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Votre premier contenu</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Voici une caption Instagram générée pour votre marque avec un ton{" "}
                <strong className="text-gray-700 dark:text-gray-300">{selectedTone}</strong> :
              </p>
              {aiCaption ? (
                <div className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                  <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{aiCaption}</p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="absolute right-3 top-3 rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-500 shadow hover:text-indigo-600 dark:bg-gray-700 dark:text-gray-300"
                  >
                    {copied ? "✓ Copié !" : "Copier"}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800">
                  Génération du contenu…
                </div>
              )}
              <Button
                variant="primary"
                size="lg"
                loading={isFinishing}
                onClick={onFinish}
                className="mt-2"
              >
                Accéder à mon dashboard 🚀
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
