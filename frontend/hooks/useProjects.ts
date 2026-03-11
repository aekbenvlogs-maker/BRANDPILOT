// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/hooks/useProjects.ts
// DESCRIPTION  : SWR hooks for project CRUD
// ============================================================
import useSWR, { mutate as globalMutate, type KeyedMutator } from "swr";
import { apiFetch, apiDelete, apiPatch, apiPost } from "@/utils/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  name: string;
  sector: string | null;
  tone: string | null;
  brand_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreateProjectInput {
  name: string;
  sector?: string;
  tone?: string;
  brand_url?: string;
}

export interface UpdateProjectInput {
  name?: string;
  sector?: string;
  tone?: string;
  brand_url?: string;
}

interface ProjectsResponse {
  items: Project[];
  total: number;
}

// ---------------------------------------------------------------------------
// Return types (exported for consumers that want the full shape)
// ---------------------------------------------------------------------------

export interface UseProjectsReturn {
  data: ProjectsResponse | null;
  projects: Project[];
  total: number;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<ProjectsResponse>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  updateProject: (id: string, input: UpdateProjectInput) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
}

export interface UseProjectReturn {
  data: Project | null;
  project: Project | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<Project>;
}

// ---------------------------------------------------------------------------
// useProjects — list
// ---------------------------------------------------------------------------

const PROJECTS_KEY = "/api/v1/projects";

export function useProjects(): UseProjectsReturn {
  const { data, error, isLoading, mutate } = useSWR<ProjectsResponse>(
    PROJECTS_KEY,
    (url: string) => apiFetch<ProjectsResponse>(url),
    { revalidateOnFocus: true },
  );

  async function createProject(input: CreateProjectInput): Promise<Project> {
    // Optimistic insert — add a placeholder with temp id
    const tempId = `temp-${Date.now()}`;
    const optimistic: Project = {
      id: tempId,
      name: input.name,
      sector: input.sector ?? null,
      tone: input.tone ?? null,
      brand_url: input.brand_url ?? null,
      description: null,
      created_at: new Date().toISOString(),
      updated_at: null,
    };

    await mutate(
      (current) =>
        current
          ? { ...current, items: [optimistic, ...current.items], total: current.total + 1 }
          : { items: [optimistic], total: 1 },
      false,
    );

    const created = await apiPost<Project>(PROJECTS_KEY, input);
    await mutate();
    return created;
  }

  async function updateProject(
    id: string,
    input: UpdateProjectInput,
  ): Promise<Project> {
    // Optimistic update
    await mutate(
      (current) =>
        current
          ? {
              ...current,
              items: current.items.map((p) =>
                p.id === id ? { ...p, ...input } : p,
              ),
            }
          : current,
      false,
    );

    const updated = await apiPatch<Project>(`${PROJECTS_KEY}/${id}`, input);
    await mutate();
    return updated;
  }

  async function deleteProject(id: string): Promise<void> {
    // Optimistic remove
    await mutate(
      (current) =>
        current
          ? {
              ...current,
              items: current.items.filter((p) => p.id !== id),
              total: Math.max(0, current.total - 1),
            }
          : current,
      false,
    );

    await apiDelete(`${PROJECTS_KEY}/${id}`);
    await mutate();
  }

  return {
    data:     data ?? null,
    projects: data?.items ?? [],
    total:    data?.total ?? 0,
    isLoading,
    error:    error as Error | undefined,
    createProject,
    updateProject,
    deleteProject,
    mutate,
  };
}

// ---------------------------------------------------------------------------
// useProject — single project
// ---------------------------------------------------------------------------

export function useProject(id: string | null): UseProjectReturn {
  const { data, error, isLoading, mutate } = useSWR<Project>(
    id ? `${PROJECTS_KEY}/${id}` : null,
    (url: string) => apiFetch<Project>(url),
  );

  return {
    data:     data ?? null,
    project:  data,
    isLoading,
    error:    error as Error | undefined,
    mutate,
  };
}
