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
        {children}
      </body>
    </html>
  );
}
