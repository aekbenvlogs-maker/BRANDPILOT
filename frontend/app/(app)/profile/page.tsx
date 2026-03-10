"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch, apiPatch } from "@/utils/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

// ── Schemas ──────────────────────────────────────────────────
const profileSchema = z.object({
  first_name: z.string().optional(),
  last_name:  z.string().optional(),
  email:      z.string().email("Email invalide"),
});
type ProfileData = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  old_password:     z.string().min(1, "Requis"),
  new_password:     z.string().min(8, "8 caractères minimum").regex(/[A-Z]/, "1 majuscule").regex(/[0-9]/, "1 chiffre"),
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, {
  path: ["confirm_password"],
  message: "Les mots de passe ne correspondent pas",
});
type PasswordData = z.infer<typeof passwordSchema>;

// ── Section card ─────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h2 className="mb-5 text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      {children}
    </section>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { showToast }    = useToast();
  const [deleteModal, setDeleteModal]   = useState(false);
  const [deleteInput, setDeleteInput]   = useState("");
  const [isDeleting,  setIsDeleting]    = useState(false);
  const [emailNotif,  setEmailNotif]    = useState(true);

  // Profile form
  const {
    register: regProfile,
    handleSubmit: submitProfile,
    formState: { errors: errProfile, isSubmitting: savingProfile },
  } = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name ?? "",
      last_name:  user?.last_name  ?? "",
      email:      user?.email      ?? "",
    },
  });

  // Password form
  const {
    register: regPassword,
    handleSubmit: submitPassword,
    reset: resetPassword,
    formState: { errors: errPassword, isSubmitting: savingPassword },
  } = useForm<PasswordData>({ resolver: zodResolver(passwordSchema) });

  async function onSaveProfile(data: ProfileData) {
    try {
      await apiPatch("/api/v1/auth/me", data);
      showToast("Profil mis à jour.", "success");
    } catch {
      showToast("Erreur lors de la mise à jour.", "error");
    }
  }

  async function onChangePassword(data: PasswordData) {
    try {
      await apiFetch("/api/v1/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ old_password: data.old_password, new_password: data.new_password }),
      });
      showToast("Mot de passe modifié.", "success");
      resetPassword();
    } catch {
      showToast("Erreur lors du changement de mot de passe.", "error");
    }
  }

  async function handleExportData() {
    try {
      const blob = await apiFetch<Blob>("/api/v1/auth/me/export", { responseType: "blob" } as RequestInit);
      const url  = URL.createObjectURL(blob as unknown as Blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "brandpilot_mes_donnees.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast("Erreur lors de l'export.", "error");
    }
  }

  async function handleDeleteAccount() {
    if (deleteInput !== "SUPPRIMER") return;
    setIsDeleting(true);
    try {
      await apiFetch("/api/v1/auth/me", { method: "DELETE" });
      await logout();
    } catch {
      showToast("Erreur lors de la suppression.", "error");
      setIsDeleting(false);
    }
  }

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profil</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
      </div>

      {/* 1. Personal info */}
      <Section title="Informations personnelles">
        <form onSubmit={submitProfile(onSaveProfile)} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Prénom"  register={regProfile("first_name")} />
            <Input label="Nom"     register={regProfile("last_name")}  />
          </div>
          <Input
            label="Email *"
            type="email"
            error={errProfile.email?.message}
            register={regProfile("email")}
          />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="md" loading={savingProfile}>
              Sauvegarder
            </Button>
          </div>
        </form>
      </Section>

      {/* 2. Password */}
      <Section title="Sécurité — Changer le mot de passe">
        <form onSubmit={submitPassword(onChangePassword)} className="flex flex-col gap-4">
          <Input
            label="Mot de passe actuel *"
            type="password"
            error={errPassword.old_password?.message}
            register={regPassword("old_password")}
          />
          <Input
            label="Nouveau mot de passe *"
            type="password"
            helperText="Min. 8 caractères, 1 majuscule, 1 chiffre"
            error={errPassword.new_password?.message}
            register={regPassword("new_password")}
          />
          <Input
            label="Confirmer le mot de passe *"
            type="password"
            error={errPassword.confirm_password?.message}
            register={regPassword("confirm_password")}
          />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="md" loading={savingPassword}>
              Modifier le mot de passe
            </Button>
          </div>
        </form>
      </Section>

      {/* 3. Preferences */}
      <Section title="Préférences">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Notifications par email</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Recevoir les alertes de campagnes et leads</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={emailNotif}
            onClick={() => setEmailNotif((v) => !v)}
            className={[
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
              emailNotif ? "bg-indigo-500" : "bg-gray-300 dark:bg-gray-600",
            ].join(" ")}
          >
            <span
              className={[
                "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                emailNotif ? "translate-x-6" : "translate-x-1",
              ].join(" ")}
            />
          </button>
        </div>
      </Section>

      {/* 4. RGPD */}
      <Section title="RGPD — Vos données">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Exporter mes données</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Télécharger toutes vos données au format JSON</p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleExportData}>
              Exporter
            </Button>
          </div>
          <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-red-600">Supprimer mon compte</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Action irréversible — toutes vos données seront effacées</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setDeleteModal(true)}>
                Supprimer mon compte
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Delete account confirmation modal */}
      <Modal
        isOpen={deleteModal}
        onClose={() => { setDeleteModal(false); setDeleteInput(""); }}
        title="Supprimer mon compte"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => { setDeleteModal(false); setDeleteInput(""); }}>
              Annuler
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={isDeleting}
              disabled={deleteInput !== "SUPPRIMER"}
              onClick={handleDeleteAccount}
            >
              Supprimer définitivement
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Cette action est <strong className="text-red-600">irréversible</strong>. Toutes vos données,
            projets, leads et campagnes seront supprimés définitivement.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tapez <code className="rounded bg-gray-100 px-1 text-red-600 dark:bg-gray-800">SUPPRIMER</code> pour confirmer
            </span>
            <input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </label>
        </div>
      </Modal>
    </main>
  );
}
