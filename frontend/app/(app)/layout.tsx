"use client";

// AuthProvider is mounted at root (app/layout.tsx).
// This layout adds an explicit redirect guard so unauthenticated users
// are always bounced to /login before any (app) route renders.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/Skeleton";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Keep showing the skeleton:
  //   • while the initial GET /auth/me is in flight (isLoading)
  //   • after loadUser resolves to unauthenticated, until router.replace fires
  // This eliminates the one-frame blank screen ("flash") between the two states.
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8">
        <Skeleton variant="rect" width="240px" height="20px" />
        <Skeleton variant="rect" width="320px" height="16px" />
        <Skeleton variant="rect" width="280px" height="16px" />
      </div>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}
