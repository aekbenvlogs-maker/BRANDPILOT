"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/components/layout/Sidebar.tsx — V2
// ============================================================

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Sparkles,
  Mail,
  UserCircle,
  X,
  ChevronDown,
  // V2 icons
  Search,
  BarChart2,
  CalendarDays,
  Layers,
  Maximize2,
  DollarSign,
  Globe,
  PenSquare,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────
interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  isNew?: boolean;
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
  collapsible?: boolean;
}

// ──────────────────────────────────────────────────────────────
// NAV CONFIG
// ──────────────────────────────────────────────────────────────
const NAV_SECTIONS: NavSection[] = [
  {
    id: "principal",
    title: "Principal",
    collapsible: false,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> },
      { href: "/projects",  label: "Projets",   icon: <FolderOpen      className="h-4 w-4" aria-hidden="true" /> },
      { href: "/leads",     label: "Leads",     icon: <Users           className="h-4 w-4" aria-hidden="true" /> },
      { href: "/content",   label: "Contenu IA",icon: <Sparkles        className="h-4 w-4" aria-hidden="true" /> },
      { href: "/campaigns", label: "Campagnes", icon: <Mail            className="h-4 w-4" aria-hidden="true" /> },
    ],
  },
  {
    id: "social",
    title: "Social Media",
    collapsible: true,
    items: [
      { href: "/brand",              label: "Brand Analyzer",   icon: <Search      className="h-4 w-4" aria-hidden="true" />, isNew: true },
      { href: "/social/accounts",    label: "Comptes sociaux",  icon: <Globe       className="h-4 w-4" aria-hidden="true" />, isNew: true },
      { href: "/social/audience",    label: "Audience",         icon: <BarChart2   className="h-4 w-4" aria-hidden="true" />, isNew: true },
      { href: "/social/influencers", label: "Influenceurs",     icon: <Users       className="h-4 w-4" aria-hidden="true" />, isNew: true },
      { href: "/social/pricing",     label: "Tarifs",           icon: <DollarSign  className="h-4 w-4" aria-hidden="true" />, isNew: true },
    ],
  },
  {
    id: "studio",
    title: "Studio",
    collapsible: true,
    items: [
      { href: "/studio",         label: "Content Studio", icon: <PenSquare   className="h-4 w-4" aria-hidden="true" />, isNew: true },
      { href: "/studio/grid",    label: "Grid Maker",     icon: <Layers      className="h-4 w-4" aria-hidden="true" />, isNew: true },
      { href: "/studio/resize",  label: "Redimensionner", icon: <Maximize2   className="h-4 w-4" aria-hidden="true" />, isNew: true },
    ],
  },
  {
    id: "campagnes",
    title: "Campagnes",
    collapsible: true,
    items: [
      { href: "/planner",          label: "Planificateur",   icon: <CalendarDays className="h-4 w-4" aria-hidden="true" />, isNew: true },
      { href: "/analytics/social", label: "Analytics Social",icon: <BarChart2    className="h-4 w-4" aria-hidden="true" />, isNew: true },
    ],
  },
  {
    id: "compte",
    title: "Compte",
    collapsible: false,
    items: [
      { href: "/profile", label: "Profil", icon: <UserCircle className="h-4 w-4" aria-hidden="true" /> },
    ],
  },
];

// ──────────────────────────────────────────────────────────────
// NAV LINK
// ──────────────────────────────────────────────────────────────
function NavLink({ href, label, icon, isNew, isActive }: NavItem & { isActive: boolean }) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white",
      ].join(" ")}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {isNew && (
        <span className="rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-white">
          NEW
        </span>
      )}
    </Link>
  );
}

// ──────────────────────────────────────────────────────────────
// NAV SECTION
// ──────────────────────────────────────────────────────────────
function NavSectionBlock({ section, pathname }: { section: NavSection; pathname: string }) {
  const hasActive = section.items.some((item) =>
    item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href)
  );
  const [open, setOpen] = useState(!section.collapsible || hasActive);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {section.title}
        </p>
        {section.collapsible && (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={`${open ? "Réduire" : "Développer"} la section ${section.title}`}
            className="rounded p-0.5 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
          </button>
        )}
      </div>

      {/* Items */}
      {open && (
        <div className="space-y-0.5">
          {section.items.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <NavLink key={item.href} {...item} isActive={isActive} />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// SIDEBAR
// ──────────────────────────────────────────────────────────────
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        aria-label="Navigation principale"
        className={[
          "fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-gray-200",
          "bg-white transition-transform duration-200 dark:border-gray-700 dark:bg-gray-900",
          "lg:sticky lg:top-16 lg:z-auto lg:h-[calc(100vh-4rem)] lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Mobile header */}
        <div className="flex h-16 items-center justify-between px-4 lg:hidden">
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            BRAND<span className="text-indigo-500">PILOT</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Nav sections */}
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4" aria-label="Menu principal">
          {NAV_SECTIONS.map((section) => (
            <NavSectionBlock key={section.id} section={section} pathname={pathname} />
          ))}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
