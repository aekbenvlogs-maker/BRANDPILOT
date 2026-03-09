"use client";

import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { useRouter } from "next/navigation";
import { clearToken } from "@/utils/api";
import { apiFetch } from "@/utils/api";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "⬛" },
  { href: "/leads", label: "Leads", icon: "👥" },
  { href: "/campaigns", label: "Campaigns", icon: "📣" },
  { href: "/content", label: "Content", icon: "✍️" },
  { href: "/analytics", label: "Analytics", icon: "📊" },
  { href: "/automation", label: "Automation", icon: "⚙️" },
  { href: "/projects", label: "Projects", icon: "🗂️" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function handleLogout() {
    try {
      const refresh = localStorage.getItem("bs_refresh_token");
      if (refresh) {
        await apiFetch("/api/v1/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refresh }),
        });
      }
    } catch {
      // ignore
    } finally {
      clearToken();
      localStorage.removeItem("bs_refresh_token");
      router.replace("/login");
    }
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="flex w-56 flex-shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex h-16 items-center px-5">
            <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
              BRAND<span className="text-blue-600">SCALE</span>
            </span>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
            {NAV_ITEMS.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
              >
                <span>{icon}</span>
                {label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-neutral-200 px-4 dark:border-neutral-800">
            <button
              onClick={handleLogout}
              className="w-full py-3 text-left text-xs text-neutral-400 hover:text-red-500"
            >
              Déconnexion
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-auto">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}
