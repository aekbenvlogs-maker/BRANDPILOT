// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/components/campaigns/ValidationBoard.tsx
// DESCRIPTION  : Human-in-the-loop campaign validation interface.
//                Displays generated posts, allows editing / regeneration
//                and gates publication behind explicit human approval.
//
// Layout (3 zones):
//  ┌────────────────────────────────────────────────────────┐
//  │  Header: nom campagne · statut · nb posts              │
//  ├───────────────────┬────────────────────────────────────┤
//  │ EditorialCalendar │ PostPreviewCard + actions           │
//  ├───────────────────┴────────────────────────────────────┤
//  │ InfluencerSuggestions (bandeau horizontal)             │
//  ├────────────────────────────────────────────────────────┤
//  │ Footer: [Annuler] ────────── [✅ Approuver et lancer]  │
//  └────────────────────────────────────────────────────────┘
// ============================================================
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  useCampaignValidation,
  type SocialPost,
} from "@/hooks/useCampaignValidation";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ValidationBoardProps {
  campaignId: string;
  onApproved: (campaignId: string) => void;
  onCancelled: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPELINE_STEPS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "parse_intent", label: "Analyse du brief" },
  { key: "load_context", label: "Contexte marque" },
  { key: "plan_execution", label: "Planification" },
  { key: "analyze_brand", label: "Analyse marque" },
  { key: "analyze_audience", label: "Audience" },
  { key: "generate_content", label: "Génération contenu" },
  { key: "generate_media", label: "Médias" },
  { key: "build_plan", label: "Plan final" },
] as const;

interface PlatformConfig {
  icon: string;
  gradient: string;
  textColor: string;
  pillBg: string;
  mobileBg: string;
  mobileText: string;
  handle: string;
}

const PLATFORM_CONFIG: Readonly<Record<string, PlatformConfig>> = {
  instagram: {
    icon: "📸",
    gradient: "from-purple-500 via-pink-500 to-orange-400",
    textColor: "text-pink-600 dark:text-pink-400",
    pillBg: "bg-pink-50 dark:bg-pink-950",
    mobileBg: "bg-white",
    mobileText: "text-neutral-900",
    handle: "@brandpilot",
  },
  tiktok: {
    icon: "🎵",
    gradient: "from-neutral-900 via-neutral-800 to-neutral-700",
    textColor: "text-neutral-900 dark:text-white",
    pillBg: "bg-neutral-100 dark:bg-neutral-800",
    mobileBg: "bg-black",
    mobileText: "text-white",
    handle: "@brandpilot",
  },
  youtube: {
    icon: "▶",
    gradient: "from-red-600 to-red-500",
    textColor: "text-red-600 dark:text-red-400",
    pillBg: "bg-red-50 dark:bg-red-950",
    mobileBg: "bg-white",
    mobileText: "text-neutral-900",
    handle: "BrandPilot",
  },
  x: {
    icon: "✕",
    gradient: "from-neutral-900 to-neutral-800",
    textColor: "text-neutral-900 dark:text-white",
    pillBg: "bg-neutral-100 dark:bg-neutral-800",
    mobileBg: "bg-black",
    mobileText: "text-white",
    handle: "@brandpilot",
  },
  linkedin: {
    icon: "in",
    gradient: "from-blue-700 to-blue-600",
    textColor: "text-blue-700 dark:text-blue-400",
    pillBg: "bg-blue-50 dark:bg-blue-950",
    mobileBg: "bg-white",
    mobileText: "text-neutral-900",
    handle: "BrandPilot",
  },
  facebook: {
    icon: "f",
    gradient: "from-blue-600 to-blue-500",
    textColor: "text-blue-600 dark:text-blue-400",
    pillBg: "bg-blue-50 dark:bg-blue-950",
    mobileBg: "bg-white",
    mobileText: "text-neutral-900",
    handle: "BrandPilot",
  },
};

const DEFAULT_PLATFORM_CONFIG: PlatformConfig = PLATFORM_CONFIG.instagram!;

function getPlatformConfig(platform: string): PlatformConfig {
  return PLATFORM_CONFIG[platform.toLowerCase()] ?? DEFAULT_PLATFORM_CONFIG;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timerMap.current.get(id);
    if (t !== undefined) clearTimeout(t);
    timerMap.current.delete(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: Toast["type"] = "success") => {
      const id = makeId();
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = setTimeout(() => dismiss(id), 4_000);
      timerMap.current.set(id, timer);
    },
    [dismiss],
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    const map = timerMap.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  return { toasts, show, dismiss };
}

// ─── ToastList ────────────────────────────────────────────────────────────────

interface ToastListProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToastList({ toasts, onDismiss }: ToastListProps) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={[
            "flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium",
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white",
          ].join(" ")}
        >
          <span aria-hidden="true">
            {toast.type === "success" ? "✅" : "❌"}
          </span>
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            aria-label="Fermer la notification"
            className="ml-2 rounded p-0.5 opacity-80 transition hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── PipelineProgress ─────────────────────────────────────────────────────────

interface PipelineProgressProps {
  currentStep: string | null;
}

function PipelineProgress({ currentStep }: PipelineProgressProps) {
  const activeIndex = PIPELINE_STEPS.findIndex((s) => s.key === currentStep);
  const safeIndex = activeIndex >= 0 ? activeIndex : 0;

  return (
    <section
      aria-label="Progression de la génération de campagne"
      className="flex flex-col items-center gap-8 py-16"
    >
      {/* Spinner + label */}
      <div className="flex items-center gap-3">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
          aria-hidden="true"
        />
        <p className="text-base font-semibold text-neutral-700 dark:text-neutral-200">
          Génération de la campagne en cours…
        </p>
      </div>

      {/* Step indicators */}
      <div className="w-full max-w-2xl px-4">
        <ol className="flex items-start">
          {PIPELINE_STEPS.map((step, i) => {
            const isDone = i < safeIndex;
            const isActive = i === safeIndex;
            return (
              <li
                key={step.key}
                className="flex flex-1 flex-col items-center gap-1.5"
                aria-current={isActive ? "step" : undefined}
              >
                {/* Connector + circle row */}
                <div className="flex w-full items-center">
                  {/* Left connector */}
                  {i > 0 && (
                    <div
                      className={[
                        "h-0.5 flex-1 transition-colors",
                        isDone || isActive
                          ? "bg-blue-500"
                          : "bg-neutral-200 dark:bg-neutral-700",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  )}

                  {/* Step circle */}
                  <div
                    className={[
                      "relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                      isDone
                        ? "bg-blue-500 text-white"
                        : isActive
                          ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900"
                          : "bg-neutral-200 text-neutral-400 dark:bg-neutral-700 dark:text-neutral-500",
                    ].join(" ")}
                    aria-label={`Étape ${i + 1} — ${step.label}${isDone ? " (terminée)" : isActive ? " (en cours)" : " (en attente)"}`}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>

                  {/* Right connector */}
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div
                      className={[
                        "h-0.5 flex-1 transition-colors",
                        isDone
                          ? "bg-blue-500"
                          : "bg-neutral-200 dark:bg-neutral-700",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  )}
                </div>

                {/* Label (hidden on very small screens) */}
                <span
                  className={[
                    "hidden text-center text-[10px] sm:block",
                    isActive
                      ? "font-semibold text-blue-600 dark:text-blue-400"
                      : isDone
                        ? "text-neutral-500 dark:text-neutral-400"
                        : "text-neutral-400 dark:text-neutral-600",
                  ].join(" ")}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Current step name */}
      {currentStep !== null && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Étape en cours :{" "}
          <span className="font-medium text-blue-600 dark:text-blue-400">
            {PIPELINE_STEPS.find((s) => s.key === currentStep)?.label ??
              currentStep}
          </span>
        </p>
      )}

      {/* Skeleton placeholders */}
      <div
        className="grid w-full max-w-3xl grid-cols-3 gap-4 px-4"
        aria-hidden="true"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800"
          />
        ))}
      </div>
    </section>
  );
}

// ─── PostSkeleton ─────────────────────────────────────────────────────────────

function PostSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Chargement du post…"
      className="flex animate-pulse flex-col gap-3 rounded-xl border border-neutral-100 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="h-4 w-1/3 rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="h-48 w-full rounded-lg bg-neutral-100 dark:bg-neutral-800" />
      <div className="h-3 w-full rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="h-3 w-4/5 rounded bg-neutral-200 dark:bg-neutral-700" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-5 w-14 rounded-full bg-neutral-100 dark:bg-neutral-800"
          />
        ))}
      </div>
    </div>
  );
}

// ─── EditorialCalendar ────────────────────────────────────────────────────────

type GroupedPosts = Map<string, SocialPost[]>;

function groupByDate(posts: SocialPost[]): GroupedPosts {
  const map: GroupedPosts = new Map();
  for (const post of posts) {
    const label = post.scheduled_at
      ? new Date(post.scheduled_at).toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      : "Sans date";
    const existing = map.get(label) ?? [];
    map.set(label, [...existing, post]);
  }
  return map;
}

interface EditorialCalendarProps {
  posts: SocialPost[];
  selectedPostId: string | null;
  regeneratingPostId: string | null;
  onSelect: (post: SocialPost) => void;
}

function EditorialCalendar({
  posts,
  selectedPostId,
  regeneratingPostId,
  onSelect,
}: EditorialCalendarProps) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-400 dark:text-neutral-600">
        <span className="text-4xl" aria-hidden="true">
          📅
        </span>
        <p className="mt-2 text-sm">Aucun post généré.</p>
      </div>
    );
  }

  const grouped = groupByDate(posts);

  return (
    <nav
      aria-label="Calendrier éditorial"
      className="flex flex-col gap-4 overflow-y-auto pr-1"
    >
      {Array.from(grouped.entries()).map(([date, datePosts]) => (
        <div key={date} className="flex flex-col gap-1">
          <h3 className="sticky top-0 z-10 bg-neutral-50 py-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:bg-neutral-950 dark:text-neutral-500">
            {date}
          </h3>

          {datePosts.map((post) => {
            const config = getPlatformConfig(post.platform);
            const isSelected = post.id === selectedPostId;
            const isRegen = post.id === regeneratingPostId;
            const time = post.scheduled_at
              ? new Date(post.scheduled_at).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

            return (
              <button
                key={post.id}
                type="button"
                onClick={() => onSelect(post)}
                aria-pressed={isSelected}
                aria-label={`Post ${post.platform}${time ? ` à ${time}` : ""}`}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500",
                  isSelected
                    ? "bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-950 dark:ring-blue-800"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                ].join(" ")}
              >
                <span className="text-base" aria-hidden="true">
                  {config.icon}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-800 dark:text-neutral-200">
                    {post.content_text.slice(0, 50)}
                    {post.content_text.length > 50 ? "…" : ""}
                  </p>
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                    {time}
                    {time ? " · " : ""}
                    {post.platform}
                  </p>
                </div>

                {isRegen && (
                  <span
                    className="h-3.5 w-3.5 flex-shrink-0 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
                    aria-label="Régénération en cours"
                  />
                )}

                <span
                  className={[
                    "h-2 w-2 flex-shrink-0 rounded-full",
                    post.status === "approved"
                      ? "bg-green-500"
                      : post.status === "pending_validation"
                        ? "bg-yellow-400"
                        : "bg-neutral-300 dark:bg-neutral-600",
                  ].join(" ")}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// ─── PostPreviewCard ──────────────────────────────────────────────────────────

interface PostPreviewCardProps {
  post: SocialPost;
  isRegenerating: boolean;
  onUpdateText: (postId: string, text: string) => Promise<void>;
  onRegenerate: () => void;
  onPreviewMobile: () => void;
}

function PostPreviewCard({
  post,
  isRegenerating,
  onUpdateText,
  onRegenerate,
  onPreviewMobile,
}: PostPreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(post.content_text);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const config = getPlatformConfig(post.platform);

  // Sync draft when post data changes (e.g. after regeneration)
  useEffect(() => {
    setDraftText(post.content_text);
    setIsEditing(false);
  }, [post.id, post.content_text]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleEditToggle() {
    setIsEditing(true);
    // Move focus to textarea on next tick
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleTextChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setDraftText(text);
    // 1 s debounce auto-save
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void onUpdateText(post.id, text);
    }, 1_000);
  }

  function handleTextBlur() {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    void onUpdateText(post.id, draftText);
    setIsEditing(false);
  }

  const scheduledLabel = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Non programmé";

  if (isRegenerating) {
    return <PostSkeleton />;
  }

  const platformLabel =
    post.platform.charAt(0).toUpperCase() + post.platform.slice(1);

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-neutral-100 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      {/* Platform badge + scheduled time */}
      <div className="flex items-center justify-between">
        <span
          className={[
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            config.textColor,
            config.pillBg,
          ].join(" ")}
        >
          <span aria-hidden="true">{config.icon}</span>
          {platformLabel}
        </span>
        <time
          dateTime={post.scheduled_at}
          className="text-xs text-neutral-400 dark:text-neutral-500"
        >
          {scheduledLabel}
        </time>
      </div>

      {/* Media */}
      {post.media_urls.length > 0 ? (
        <div className="overflow-hidden rounded-lg">
          <img
            src={post.media_urls[0]}
            alt={`Visuel pour le post ${platformLabel}`}
            className="h-52 w-full object-cover"
          />
        </div>
      ) : (
        <div
          className={[
            "flex h-52 items-center justify-center rounded-lg",
            `bg-gradient-to-br ${config.gradient}`,
            "opacity-20",
          ].join(" ")}
          aria-label="Aucun visuel généré"
        >
          <span className="text-5xl" aria-hidden="true">
            {config.icon}
          </span>
        </div>
      )}

      {/* Caption */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Légende
          </span>
          {!isEditing && (
            <button
              type="button"
              onClick={handleEditToggle}
              aria-label="Modifier la légende"
              className="rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              ✏️
            </button>
          )}
        </div>

        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={draftText}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            rows={4}
            aria-label="Modifier la légende du post"
            className="w-full resize-none rounded-lg border border-blue-300 bg-white p-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-blue-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {draftText}
          </p>
        )}
      </div>

      {/* Hashtags */}
      {post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Hashtags">
          {post.hashtags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-300"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Status pill */}
      <div className="flex items-center gap-2">
        <span
          className={[
            "h-2 w-2 rounded-full",
            post.status === "approved" ? "bg-green-500" : "bg-yellow-400",
          ].join(" ")}
          aria-hidden="true"
        />
        <span className="text-xs capitalize text-neutral-500 dark:text-neutral-400">
          {post.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
        <button
          type="button"
          onClick={onRegenerate}
          aria-label="Régénérer ce post avec un feedback"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          🔄 Régénérer
        </button>
        <button
          type="button"
          onClick={onPreviewMobile}
          aria-label="Voir le rendu sur mobile"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          📱 Voir sur mobile
        </button>
      </div>
    </article>
  );
}

// ─── MobilePreview ────────────────────────────────────────────────────────────

interface MobilePreviewProps {
  post: SocialPost;
  onClose: () => void;
}

function MobilePreview({ post, onClose }: MobilePreviewProps) {
  const config = getPlatformConfig(post.platform);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button and bind Escape key
  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const platformLabel =
    post.platform.charAt(0).toUpperCase() + post.platform.slice(1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Prévisualisation mobile — ${platformLabel}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Top bar */}
        <div className="flex w-full max-w-xs items-center justify-between">
          <span className="text-sm font-medium text-white">
            Rendu {platformLabel}
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer la prévisualisation mobile"
            className="rounded-full bg-white/20 p-1.5 text-white transition hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            ✕
          </button>
        </div>

        {/* Phone frame */}
        <div className="relative w-72 rounded-[3rem] bg-neutral-900 p-3 shadow-2xl ring-4 ring-neutral-700">
          {/* Notch */}
          <div
            className="absolute left-1/2 top-4 h-3 w-20 -translate-x-1/2 rounded-full bg-neutral-800"
            aria-hidden="true"
          />

          {/* Screen */}
          <div
            className={[
              "overflow-hidden rounded-[2.5rem]",
              config.mobileBg,
              "min-h-[500px]",
            ].join(" ")}
          >
            {/* Status bar */}
            <div
              className={[
                "flex justify-between px-5 pb-1 pt-8 text-[10px]",
                config.mobileText,
                "opacity-70",
              ].join(" ")}
              aria-hidden="true"
            >
              <span>9:41</span>
              <span>●●●</span>
            </div>

            {/* Platform header */}
            <div
              className={[
                "flex items-center gap-2 border-b px-4 py-3",
                config.mobileBg === "bg-black"
                  ? "border-neutral-800"
                  : "border-neutral-100",
              ].join(" ")}
            >
              <div
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  `bg-gradient-to-br ${config.gradient}`,
                  "text-xs font-bold text-white",
                ].join(" ")}
                aria-hidden="true"
              >
                {config.icon}
              </div>
              <div>
                <p className={`text-xs font-semibold ${config.mobileText}`}>
                  {config.handle}
                </p>
                <p className={`text-[10px] opacity-60 ${config.mobileText}`}>
                  {post.platform}
                </p>
              </div>
            </div>

            {/* Media */}
            {post.media_urls.length > 0 ? (
              <img
                src={post.media_urls[0]}
                alt={`Aperçu ${platformLabel}`}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div
                className={[
                  "flex aspect-square w-full items-center justify-center",
                  `bg-gradient-to-br ${config.gradient}`,
                  "opacity-30",
                ].join(" ")}
                aria-label="Aucun visuel"
              >
                <span className="text-6xl" aria-hidden="true">
                  {config.icon}
                </span>
              </div>
            )}

            {/* Caption */}
            <div className="px-4 py-3">
              <p
                className={[
                  "line-clamp-4 text-xs leading-relaxed",
                  config.mobileText,
                ].join(" ")}
              >
                {post.content_text}
              </p>
              {post.hashtags.length > 0 && (
                <p className="mt-1 text-[10px] text-blue-500">
                  {post.hashtags
                    .slice(0, 5)
                    .map((h) => `#${h}`)
                    .join(" ")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RegenerateModal ──────────────────────────────────────────────────────────

interface RegenerateModalProps {
  postId: string;
  isLoading: boolean;
  onConfirm: (postId: string, feedback: string) => Promise<void>;
  onClose: () => void;
}

function RegenerateModal({
  postId,
  isLoading,
  onConfirm,
  onClose,
}: RegenerateModalProps) {
  const [feedback, setFeedback] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isLoading) onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, isLoading]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await onConfirm(postId, feedback);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Régénérer le post"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-1 text-base font-semibold text-neutral-900 dark:text-white">
          🔄 Régénérer ce post
        </h2>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          Donnez un feedback pour guider la régénération (optionnel).
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
              Feedback
            </span>
            <textarea
              ref={textareaRef}
              value={feedback}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setFeedback(e.target.value)
              }
              placeholder="Ex : Ton plus dynamique, ajoute un call-to-action fort…"
              rows={3}
              maxLength={500}
              disabled={isLoading}
              aria-label="Feedback pour la régénération"
              className="w-full resize-none rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-800 placeholder-neutral-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500"
            />
            <span className="self-end text-[10px] text-neutral-400">
              {feedback.length}/500
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {isLoading && (
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden="true"
                />
              )}
              Régénérer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── InfluencerSuggestions ────────────────────────────────────────────────────

const MOCK_INFLUENCERS: ReadonlyArray<{
  handle: string;
  followers: string;
  niche: string;
  avatar: string;
}> = [
  { handle: "@creator_a", followers: "120K", niche: "Lifestyle", avatar: "🧑" },
  { handle: "@creator_b", followers: "85K", niche: "Tech", avatar: "👩" },
  { handle: "@creator_c", followers: "200K", niche: "Mode", avatar: "🧑‍🦱" },
  { handle: "@creator_d", followers: "50K", niche: "Fitness", avatar: "💪" },
  { handle: "@creator_e", followers: "300K", niche: "Food", avatar: "👨‍🍳" },
] as const;

interface InfluencerSuggestionsProps {
  platform: string;
}

function InfluencerSuggestions({ platform }: InfluencerSuggestionsProps) {
  return (
    <section
      aria-label="Suggestions d'influenceurs"
      className="border-t border-neutral-100 dark:border-neutral-800"
    >
      <div className="flex items-center justify-between px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Influenceurs suggérés · {platform}
        </h2>
        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          Bientôt disponible
        </span>
      </div>

      <div
        className="flex gap-3 overflow-x-auto px-5 pb-4 pt-1"
        role="list"
        aria-label="Liste des influenceurs suggérés"
      >
        {MOCK_INFLUENCERS.map((inf) => (
          <div
            key={inf.handle}
            role="listitem"
            className="flex flex-shrink-0 flex-col items-center gap-1.5 rounded-xl border border-neutral-100 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-xl dark:bg-neutral-800"
              aria-hidden="true"
            >
              {inf.avatar}
            </div>
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              {inf.handle}
            </span>
            <span className="text-[10px] text-neutral-400">{inf.followers}</span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              {inf.niche}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── ValidationBoard ──────────────────────────────────────────────────────────

export function ValidationBoard({
  campaignId,
  onApproved,
  onCancelled,
}: ValidationBoardProps) {
  const {
    agentStatus,
    currentStep,
    isStatusLoading,
    posts,
    isPreviewLoading,
    selectedPost,
    selectPost,
    updatePostText,
    regeneratePost,
    regeneratingPostId,
    approve,
    isApproving,
    cancel,
    isCancelling,
    error,
    clearError,
  } = useCampaignValidation(campaignId, onApproved);

  const { toasts, show: showToast, dismiss: dismissToast } = useToasts();

  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // Bubble domain errors to toast
  useEffect(() => {
    if (error !== null) {
      showToast(error, "error");
      clearError();
    }
  }, [error, showToast, clearError]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleApprove() {
    if (
      !window.confirm(
        "Approuver et lancer la campagne ?\n\nTous les posts seront programmés et publiés automatiquement.",
      )
    )
      return;
    await approve();
    showToast("🎉 Campagne approuvée ! Les posts sont programmés.", "success");
  }

  async function handleCancel() {
    if (
      !window.confirm(
        "Annuler cette campagne ?\n\nLes posts en attente seront supprimés et ne pourront plus être récupérés.",
      )
    )
      return;
    await cancel();
    onCancelled();
  }

  async function handleRegenerate(postId: string, feedback: string) {
    await regeneratePost(postId, feedback);
    showToast("Post régénéré avec succès.", "success");
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isStatusLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
          aria-label="Chargement…"
        />
      </div>
    );
  }

  // ── Generating state (status unknown OR no posts yet) ─────────────────────

  const isGenerating =
    agentStatus === "unknown" ||
    (agentStatus === "pending_validation" && posts.length === 0);

  if (isGenerating) {
    return (
      <>
        <PipelineProgress currentStep={currentStep} />
        <ToastList toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (agentStatus === "error") {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 p-8">
        <p className="text-5xl" aria-hidden="true">
          ⚠️
        </p>
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
          Une erreur est survenue
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          La génération de la campagne a échoué.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          Réessayer
        </button>
        <ToastList toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // ── Approved state ────────────────────────────────────────────────────────

  if (agentStatus === "approved") {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 p-8">
        <p className="text-6xl" aria-hidden="true">
          🎉
        </p>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
          Campagne lancée !
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Tous les posts sont programmés et seront publiés automatiquement.
        </p>
        <button
          type="button"
          onClick={() => onApproved(campaignId)}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          Retour au dashboard
        </button>
        <ToastList toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // ── Validation state (pending_validation + posts loaded) ──────────────────

  const platform = selectedPost?.platform ?? posts[0]?.platform ?? "instagram";

  return (
    <div
      className={[
        "flex min-h-screen flex-col transition-opacity",
        isApproving ? "pointer-events-none select-none opacity-75" : "",
      ].join(" ")}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 border-b border-neutral-100 bg-white px-6 py-5 dark:border-neutral-800 dark:bg-neutral-950 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white">
              Validation de campagne
            </h1>
            <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
              En attente de validation
            </span>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {posts.length} post{posts.length !== 1 ? "s" : ""}
            </span>
            {" · "}
            Plateforme :{" "}
            <span className="font-medium capitalize">{platform}</span>
          </p>
        </div>

        <span className="hidden text-xs text-neutral-400 sm:block">
          #{campaignId.slice(0, 8)}
        </span>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Left — Editorial calendar */}
        <aside
          className="flex w-full flex-col border-b border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950 md:w-80 md:overflow-y-auto md:border-b-0 md:border-r"
          aria-label="Calendrier éditorial"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Calendrier éditorial
          </p>

          {isPreviewLoading ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : (
            <EditorialCalendar
              posts={posts}
              selectedPostId={selectedPost?.id ?? null}
              regeneratingPostId={regeneratingPostId}
              onSelect={selectPost}
            />
          )}
        </aside>

        {/* Right — Post preview */}
        <main className="flex-1 overflow-y-auto p-5">
          {isPreviewLoading ? (
            <PostSkeleton />
          ) : selectedPost !== null ? (
            <PostPreviewCard
              post={selectedPost}
              isRegenerating={regeneratingPostId === selectedPost.id}
              onUpdateText={updatePostText}
              onRegenerate={() => setShowRegenerateModal(true)}
              onPreviewMobile={() => setShowMobilePreview(true)}
            />
          ) : (
            <div className="flex h-full min-h-52 flex-col items-center justify-center gap-2 text-neutral-400 dark:text-neutral-600">
              <span className="text-4xl" aria-hidden="true">
                👈
              </span>
              <p className="text-sm">
                Sélectionnez un post dans le calendrier.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* ── Influencer suggestions ─────────────────────────────────────── */}
      <InfluencerSuggestions platform={platform} />

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="flex items-center justify-between border-t border-neutral-100 bg-white px-6 py-4 dark:border-neutral-800 dark:bg-neutral-950">
        {/* Cancel */}
        <button
          type="button"
          onClick={handleCancel}
          disabled={isCancelling || isApproving}
          aria-label="Annuler la campagne"
          className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          {isCancelling ? (
            <span className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
              Annulation…
            </span>
          ) : (
            "Annuler"
          )}
        </button>

        {/* Approve */}
        <button
          type="button"
          onClick={handleApprove}
          disabled={isApproving || isCancelling || posts.length === 0}
          aria-label="Approuver la campagne et lancer la publication"
          aria-busy={isApproving}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
        >
          {isApproving ? (
            <>
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                aria-hidden="true"
              />
              Lancement…
            </>
          ) : (
            "✅ Approuver et lancer"
          )}
        </button>
      </footer>

      {/* ── Modals & overlays ──────────────────────────────────────────── */}
      {showRegenerateModal && selectedPost !== null && (
        <RegenerateModal
          postId={selectedPost.id}
          isLoading={regeneratingPostId === selectedPost.id}
          onConfirm={handleRegenerate}
          onClose={() => setShowRegenerateModal(false)}
        />
      )}

      {showMobilePreview && selectedPost !== null && (
        <MobilePreview
          post={selectedPost}
          onClose={() => setShowMobilePreview(false)}
        />
      )}

      <ToastList toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default ValidationBoard;
