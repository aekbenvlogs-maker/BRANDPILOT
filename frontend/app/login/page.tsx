"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setToken } from "@/utils/api";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        await apiFetch("/api/v1/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        // Auto-login after register
      }
      const { access_token, refresh_token } = await apiFetch<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
      }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(access_token);
      localStorage.setItem("bs_refresh_token", refresh_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Try to extract FastAPI detail from message
        const match = err.message.match(/:\s*(.+)$/);
        setError(match ? match[1] : err.message);
      } else {
        setError("Erreur inconnue");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            BRAND<span className="text-blue-600">SCALE</span>
          </span>
          <p className="mt-1 text-sm text-neutral-500">AI Brand Scaling Platform</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex rounded-lg border border-neutral-200 p-1 dark:border-neutral-700">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-blue-600 text-white"
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              {m === "login" ? "Connexion" : "Inscription"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
              placeholder="vous@exemple.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Mot de passe {mode === "register" && <span className="text-neutral-400">(8 car. min.)</span>}
            </label>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "register" ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
              placeholder={mode === "register" ? "Min. 8 caractères" : "••••••••"}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading
              ? "Chargement…"
              : mode === "login"
              ? "Se connecter"
              : "Créer mon compte"}
          </button>
        </form>
      </div>
    </div>
  );
}
