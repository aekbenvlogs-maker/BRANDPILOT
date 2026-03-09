import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRANDSCALE — AI Brand Scaling Platform",
  description: "AI-powered brand scaling: leads, campaigns, content, analytics.",
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "⬛" },
  { href: "/leads", label: "Leads", icon: "👥" },
  { href: "/campaigns", label: "Campaigns", icon: "📣" },
  { href: "/content", label: "Content", icon: "✍️" },
  { href: "/analytics", label: "Analytics", icon: "📊" },
  { href: "/automation", label: "Automation", icon: "⚙️" },
  { href: "/projects", label: "Projects", icon: "🗂️" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
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
            <div className="border-t border-neutral-200 px-4 py-3 text-xs text-neutral-400 dark:border-neutral-800">
              v1.0.0
            </div>
          </aside>

          {/* Main content */}
          <div className="flex flex-1 flex-col overflow-auto">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
