"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { apiFetch } from "@/utils/api";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

function ProjectCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div>
        <p className="font-semibold text-neutral-900 dark:text-white">
          {project.name}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          {project.description ?? "No description"}
        </p>
        <p className="mt-2 text-xs text-neutral-400">
          Created {new Date(project.created_at).toLocaleDateString()}
        </p>
      </div>
      <button
        onClick={() => onDelete(project.id)}
        className="ml-4 text-xs text-red-500 hover:underline"
      >
        Delete
      </button>
    </div>
  );
}

export default function ProjectsPage() {
  const { data, isLoading } = useSWR<{ items: Project[] }>(
    "/api/v1/projects",
    (url: string) => apiFetch(url),
  );
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({ name, description: desc }),
    });
    setName("");
    setDesc("");
    await mutate("/api/v1/projects");
  }

  async function handleDelete(id: string) {
    await apiFetch(`/api/v1/projects/${id}`, { method: "DELETE" });
    await mutate("/api/v1/projects");
  }

  return (
    <main className="flex min-h-screen flex-col gap-8 p-8">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
        Projects
      </h1>

      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 md:flex-row"
      >
        <input
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          placeholder="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create
        </button>
      </form>

      {isLoading && <p className="text-sm text-neutral-400">Loading…</p>}

      <section className="flex flex-col gap-4">
        {data?.items?.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onDelete={handleDelete}
          />
        ))}
        {!isLoading && !data?.items?.length && (
          <p className="text-sm text-neutral-400">No projects yet.</p>
        )}
      </section>
    </main>
  );
}
