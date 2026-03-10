"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/app/(auth)/login/page.tsx
// ============================================================

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/utils/api";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      router.replace("/dashboard");
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setError("root", { message: "Email ou mot de passe incorrect" });
      } else if (err instanceof Error) {
        setError("root", { message: err.message });
      } else {
        setError("root", { message: "Une erreur est survenue" });
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md dark:bg-gray-900">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            BRAND<span className="text-indigo-500">PILOT</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">Connectez-vous à votre espace</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="vous@example.com"
            autoComplete="email"
            error={errors.email?.message}
            register={register("email")}
          />
          <Input
            label="Mot de passe"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            error={errors.password?.message}
            register={register("password")}
          />

          {errors.root && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20">
              {errors.root.message}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            className="w-full mt-2"
          >
            Se connecter
          </Button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm text-gray-500">
          <Link
            href="/forgot-password"
            className="hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          >
            Mot de passe oublié ?
          </Link>
          <span>
            Pas encore de compte ?{" "}
            <Link
              href="/register"
              className="font-medium text-indigo-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
            >
              Créer un compte
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
