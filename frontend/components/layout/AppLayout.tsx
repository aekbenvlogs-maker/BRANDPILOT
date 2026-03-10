"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/components/layout/AppLayout.tsx
// ============================================================

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { Skeleton } from "@/components/ui/Skeleton";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // While checking auth state, render a loading skeleton
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <Skeleton variant="text" width="200px" height="24px" />
        <Skeleton variant="text" width="320px" height="16px" />
      </div>
    );
  }

  // Not authenticated → redirect
  if (!isAuthenticated) {
    router.replace("/login");
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <Navbar onMenuClick={() => setSidebarOpen((v) => !v)} />

      <div className="flex flex-1">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main
          id="main-content"
          className="flex-1 overflow-x-hidden p-6 lg:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
