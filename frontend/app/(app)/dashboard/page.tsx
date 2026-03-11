// ============================================================
// PROJECT      : BRANDSCALE
// FILE         : frontend/app/(app)/dashboard/page.tsx
// DESCRIPTION  : Server shell — exports Next.js metadata, renders client
// ============================================================
import type { Metadata } from "next";
import DashboardClient from "./_DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard — BRANDPILOT",
  description: "Vue d'ensemble de vos leads, campagnes et performances.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
