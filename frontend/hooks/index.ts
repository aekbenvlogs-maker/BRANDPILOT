// ============================================================
// PROJECT      : BRANDSCALE
// FILE         : frontend/hooks/index.ts
// DESCRIPTION  : Barrel export — import any hook from "@/hooks"
// ============================================================

// --- Projects ---------------------------------------------------------------
export { useProjects, useProject } from "./useProjects";
export type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  UseProjectsReturn,
  UseProjectReturn,
} from "./useProjects";

// --- Leads ------------------------------------------------------------------
export { useLeads, useLead } from "./useLeads";
export type { Lead, LeadsFilters } from "./useLeads";

// --- Campaigns --------------------------------------------------------------
export { useCampaigns, useCampaign } from "./useCampaigns";
export type { Campaign } from "./useCampaigns";

// --- Analytics --------------------------------------------------------------
export { useDashboardStats, useAnalytics } from "./useAnalytics";
export type { DashboardStats, AnalyticsSummary, CampaignAnalytics, ActivityItem } from "./useAnalytics";

// --- Content generation + polling -------------------------------------------
export { useGenerateText, useContentHistory, usePolling } from "./useContentGeneration";
export type {
  GenerateTextInput,
  GenerationResult,
  TaskStatus,
  ContentHistoryItem,
  PollStatusResponse,
} from "./useContentGeneration";

// --- Auth -------------------------------------------------------------------
export { useAuth } from "./useAuth";
