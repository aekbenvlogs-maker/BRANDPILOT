// ============================================================
// PROJECT      : BRANDPILOT — AI Brand Scaling Tool
// FILE         : frontend/app/(app)/campaigns/[id]/validate/page.tsx
// DESCRIPTION  : Campaign validation page — wraps ValidationBoard with
//                a route-level Error Boundary and handles post-approval
//                navigation to the campaigns dashboard.
// ============================================================
"use client";

import { Component, type ReactNode, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ValidationBoard } from "@/components/campaigns/ValidationBoard";

// ─── Error Boundary ───────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  campaignId: string;
}

class ValidationErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.";
    return { hasError: true, message };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center"
        >
          <span aria-hidden="true" className="text-5xl">
            ⚠️
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
              Une erreur est survenue
            </h1>
            <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400">
              {this.state.message}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: "" })}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Réessayer
            </button>
            <Link
              href="/campaigns"
              className="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Retour aux campagnes
            </Link>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-600">
            Campagne :{" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-neutral-800">
              {this.props.campaignId}
            </code>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * /campaigns/[id]/validate — Human-in-the-loop validation page.
 *
 * Renders the full ValidationBoard wrapped in an Error Boundary.
 * On approval success the user is redirected to /campaigns with a success query param.
 * On cancellation the user is redirected back to /campaigns.
 */
export default function CampaignValidatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campaignId = params.id ?? "";

  const handleApproved = useCallback(
    (approvedCampaignId: string) => {
      router.replace(`/campaigns?approved=${approvedCampaignId}`);
    },
    [router],
  );

  const handleCancelled = useCallback(() => {
    router.replace("/campaigns");
  }, [router]);

  if (!campaignId) {
    return (
      <div
        role="alert"
        className="flex min-h-screen items-center justify-center p-8 text-sm text-red-600 dark:text-red-400"
      >
        ❌ Identifiant de campagne manquant dans l'URL.
      </div>
    );
  }

  return (
    <ValidationErrorBoundary campaignId={campaignId}>
      {/* Breadcrumb */}
      <div className="border-b border-neutral-100 bg-white px-6 py-3 dark:border-neutral-800 dark:bg-neutral-950">
        <nav
          aria-label="Fil d'Ariane"
          className="mx-auto flex max-w-7xl items-center gap-2 text-xs text-neutral-400"
        >
          <Link
            href="/campaigns"
            className="transition hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            Campagnes
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate max-w-[160px] text-neutral-600 dark:text-neutral-300 font-mono text-[11px]">
            {campaignId}
          </span>
          <span aria-hidden="true">/</span>
          <span className="text-neutral-700 dark:text-neutral-200">
            Validation
          </span>
        </nav>
      </div>

      {/* ValidationBoard — full-width, fills remaining viewport */}
      <ValidationBoard
        campaignId={campaignId}
        onApproved={handleApproved}
        onCancelled={handleCancelled}
      />
    </ValidationErrorBoundary>
  );
}
