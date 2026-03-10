"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/app/(auth)/register/page.tsx
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
import { apiPost } from "@/utils/api";
import { setAccessToken } from "@/utils/auth";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const registerSchema = z
  .object({
    first_name: z.string().min(1, "Prénom requis"),
    last_name:  z.string().min(1, "Nom requis"),
    email:      z.string().email("Email invalide"),
    password: z
      .string()
      .min(8, "Minimum 8 caractères")
      .regex(/[A-Z]/, "Au moins une majuscule")
      .regex(/[0-9]/, "Au moins un chiffre"),
    confirm_password: z.string().min(1, "Confirmation requise"),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirm_password"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const { access_token, refresh_token } = await apiPost<{
        access_token: string;
        refresh_token: string;
      }>("/api/v1/auth/register", {
        first_name: data.first_name,
        last_name:  data.last_name,
        email:      data.email,
        password:   data.password,
      });

      setAccessToken(access_token);
      localStorage.setItem("bs_refresh_token", refresh_token);
      router.replace("/onboarding");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError("root", { message: err.message });
      } else {
        setError("root", { message: "Inscription impossible. Réessayez." });
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md dark:bg-gray-900">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            BRAND<span className="text-indigo-500">PILOT</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">Créez votre compte gratuitement</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Prénom"
              placeholder="Alice"
              autoComplete="given-name"
              error={errors.first_name?.message}
              register={register("first_name")}
            />
            <Input
              label="Nom"
              placeholder="Dupont"
              autoComplete="family-name"
              error={errors.last_name?.message}
              register={register("last_name")}
            />
          </div>

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
            placeholder="Min. 8 chars, 1 majuscule, 1 chiffre"
            autoComplete="new-password"
            error={errors.password?.message}
            register={register("password")}
          />
          <Input
            label="Confirmer le mot de passe"
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            error={errors.confirm_password?.message}
            register={register("confirm_password")}
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
            Créer mon compte
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-medium text-indigo-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
