// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/campaigns/CampaignPromptInput.tsx
// DESCRIPTION  : Natural-language prompt input for AI campaign generation.
//                Displays clarification questions when the prompt is too
//                vague, shows a character counter, and fires onSubmit.
// ============================================================
"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CampaignPromptInputProps {
  /** Called when the user submits a non-empty prompt. */
  onSubmit: (prompt: string) => void;
  /** Whether the parent is in-flight (disables the form). */
  isLoading: boolean;
  /** Clarification questions returned from the API for an ambiguous prompt. */
  clarificationQuestions?: string[] | null;
  /** Generic error message (non-ambiguity errors). */
  errorMessage?: string | null;
  /** Reset clarification / error state when the prompt changes. */
  onPromptChange?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CHARS = 1000;
const MIN_CHARS = 10;

const PLACEHOLDER_EXAMPLES: ReadonlyArray<string> = [
  "Campagne Instagram pour mon sac en cuir premium, cible femmes 25-35 CSP+, budget 500 €, objectif notoriété…",
  "TikTok 30 jours, étudiants 18-25, ton dynamique, lancement boisson énergisante naturelle…",
  "Multi-plateforme (Instagram + YouTube), hommes 30-45, engagement communauté outdoor, 2 semaines…",
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Prompt textarea with character counter, clarification display and submit.
 *
 * The component auto-resizes the textarea up to a maximum height and cycles
 * through placeholder examples every 4 seconds to inspire the user.
 */
export function CampaignPromptInput({
  onSubmit,
  isLoading,
  clarificationQuestions,
  errorMessage,
  onPromptChange,
}: CampaignPromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Rotate placeholder examples ──────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 4_000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-resize textarea ────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  }, [prompt]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value.slice(0, MAX_CHARS);
      setPrompt(value);
      onPromptChange?.();
    },
    [onPromptChange],
  );

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = prompt.trim();
      if (trimmed.length >= MIN_CHARS) {
        onSubmit(trimmed);
      }
    },
    [prompt, onSubmit],
  );

  // Allow Ctrl/Cmd+Enter to submit
  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        const trimmed = prompt.trim();
        if (trimmed.length >= MIN_CHARS && !isLoading) {
          onSubmit(trimmed);
        }
      }
    },
    [prompt, isLoading, onSubmit],
  );

  const isSubmittable = prompt.trim().length >= MIN_CHARS && !isLoading;
  const charCount = prompt.length;
  const isNearLimit = charCount > MAX_CHARS * 0.85;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Formulaire de création de campagne"
      className="flex flex-col gap-4"
    >
      {/* ── Textarea ─────────────────────────────────────────────────── */}
      <div className="relative">
        <label htmlFor="campaign-prompt" className="sr-only">
          Décrivez votre campagne en langage naturel
        </label>
        <textarea
          id="campaign-prompt"
          ref={textareaRef}
          value={prompt}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={PLACEHOLDER_EXAMPLES[placeholderIdx]}
          aria-describedby={
            clarificationQuestions
              ? "clarification-questions"
              : errorMessage
                ? "prompt-error"
                : undefined
          }
          aria-invalid={
            !!clarificationQuestions || !!errorMessage ? "true" : undefined
          }
          rows={4}
          className={[
            "w-full resize-none rounded-2xl border px-5 py-4 text-sm leading-relaxed",
            "bg-white dark:bg-neutral-900",
            "text-neutral-900 dark:text-white",
            "placeholder:text-neutral-400 dark:placeholder:text-neutral-600",
            "shadow-sm transition-all duration-150",
            "focus:outline-none focus:ring-2",
            isLoading ? "cursor-not-allowed opacity-60" : "",
            clarificationQuestions || errorMessage
              ? "border-amber-400 focus:ring-amber-400/40 dark:border-amber-500"
              : "border-neutral-200 focus:ring-violet-500/40 dark:border-neutral-700",
          ]
            .filter(Boolean)
            .join(" ")}
        />

        {/* Character counter */}
        <span
          aria-live="polite"
          className={[
            "absolute bottom-3 right-4 text-xs tabular-nums",
            isNearLimit
              ? "text-amber-500 dark:text-amber-400"
              : "text-neutral-400 dark:text-neutral-600",
          ].join(" ")}
        >
          {charCount}/{MAX_CHARS}
        </span>
      </div>

      {/* ── Clarification questions ───────────────────────────────────── */}
      {clarificationQuestions && clarificationQuestions.length > 0 && (
        <div
          id="clarification-questions"
          role="status"
          aria-live="polite"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40"
        >
          <p className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            💡 Votre brief est un peu vague. Précisez :
          </p>
          <ul className="flex flex-col gap-1.5">
            {clarificationQuestions.map((q, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400"
              >
                <span aria-hidden="true" className="mt-px shrink-0">
                  →
                </span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Generic error ─────────────────────────────────────────────── */}
      {errorMessage && !clarificationQuestions && (
        <p
          id="prompt-error"
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
        >
          ❌ {errorMessage}
        </p>
      )}

      {/* ── Tip ───────────────────────────────────────────────────────── */}
      <p className="text-xs text-neutral-400 dark:text-neutral-600">
        💡 Incluez : plateforme, audience, budget, objectif, durée, description
        produit.{" "}
        <span className="hidden sm:inline">
          Raccourci clavier : <kbd className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[10px] dark:bg-neutral-800">⌘↵</kbd>
        </span>
      </p>

      {/* ── Submit button ─────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={!isSubmittable}
        aria-label="Lancer la génération de la campagne"
        className={[
          "flex items-center justify-center gap-2 rounded-2xl px-8 py-3.5",
          "text-sm font-semibold transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
          isSubmittable
            ? "bg-violet-600 text-white shadow-md hover:bg-violet-700 active:scale-[0.98]"
            : "cursor-not-allowed bg-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600",
        ].join(" ")}
      >
        {isLoading ? (
          <>
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
            />
            Génération en cours…
          </>
        ) : (
          <>
            <span aria-hidden="true">✨</span>
            Générer la campagne
          </>
        )}
      </button>
    </form>
  );
}
