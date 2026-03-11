"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/components/layout/Sidebar.tsx
// DESCRIPTION  : App sidebar — 9 nav items, project selector, icon-only mobile
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Sparkles,
  PenSquare,
  Clock,
  Send,
  BarChart2,
  CalendarDays,
  Search,
  UserCircle,
  ChevronDown,
  X,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { useProjects } from "@/hooks/useProjects";

// ── Nav config ────────────────────────────────────────────────────────────────

type IconComponent = React.ElementType;

interface SubItem {
  href:  string;
  label: string;
  icon:  IconComponent;
}

interface NavItemDef {
  href:      string;
  label:     string;
  icon:      IconComponent;
  children?: SubItem[];
}

// 9 top-level navigation items (Contenu is #4 and contains a collapsible sub-menu)
const NAV: NavItemDef[] = [
  { href: "/dashboard",  label: "Dashboard",      icon: LayoutDashboard },
  { href: "/projects",   label: "Projets",         icon: FolderOpen },
  { href: "/leads",      label: "Leads",           icon: Users },
  {
    href:  "/content",
    label: "Contenu",
    icon:  Sparkles,
    children: [
      { href: "/content/new", label: "Générer",    icon: PenSquare },
      { href: "/content",     label: "Historique", icon: Clock },
    ],
  },
  { href: "/campaigns",  label: "Campagnes",       icon: Send },
  { href: "/analytics",  label: "Analytics",       icon: BarChart2 },
  { href: "/planner",    label: "Planificateur",   icon: CalendarDays },
  { href: "/brand",      label: "Brand Analyzer",  icon: Search },
  { href: "/profile",    label: "Profil",          icon: UserCircle },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function routeIsActive(href: string, pathname: string): boolean {
  // Exact match for dashboard, prefix match for all others
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname === href || pathname.startsWith(href + "/");
}

// ── Project selector ──────────────────────────────────────────────────────────

function ProjectSelector({ collapsed }: { collapsed: boolean }) {
  const { projects, isLoading } = useProjects();
  const [open,     setOpen]     = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Auto-select first project on load
  useEffect(() => {
    if (!activeId && projects.length > 0) setActiveId(projects[0].id);
  }, [projects, activeId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const active = projects.find((p) => p.id === activeId) ?? projects[0] ?? null;
  const initial = active?.name?.[0]?.toUpperCase() ?? "P";

  // Icon-only mode: show project initial badge
  if (collapsed) {
    return (
      <div className="flex justify-center border-b border-gray-100 py-3 dark:border-gray-800">
        <div
          title={active?.name ?? "Projet"}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
        >
          {initial}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative border-b border-gray-100 px-3 py-3 dark:border-gray-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500 text-[11px] font-bold text-white">
          {initial}
        </div>
        <span className="flex-1 truncate text-left text-gray-700 dark:text-gray-300">
          {isLoading
            ? "Chargement…"
            : active?.name ?? "Choisir un projet"}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      </button>

      {open && projects.length > 0 && (
        <ul
          role="listbox"
          aria-label="Projets"
          className="absolute left-3 right-3 top-full z-50 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {projects.map((p) => (
            <li key={p.id} role="option" aria-selected={p.id === activeId}>
              <button
                type="button"
                onClick={() => { setActiveId(p.id); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-500 text-[10px] font-bold text-white">
                  {p.name[0].toUpperCase()}
                </div>
                <span className="flex-1 truncate text-left">{p.name}</span>
                {p.id === activeId && (
                  <Check className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({
  item,
  pathname,
  collapsed,
}: {
  item:      NavItemDef;
  pathname:  string;
  collapsed: boolean;
}) {
  const Icon   = item.icon;
  const active = item.children
    ? item.children.some((c) => routeIsActive(c.href, pathname))
    : routeIsActive(item.href, pathname);

  const [open, setOpen] = useState(active);

  // ── With children (collapsible sub-menu) ─────────────────────────────────

  if (item.children) {
    // Icon-only: just link to the parent route, no sub-menu shown
    if (collapsed) {
      return (
        <Link
          href={item.href}
          title={item.label}
          aria-current={active ? "page" : undefined}
          className={[
            "mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
            active
              ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white",
          ].join(" ")}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </Link>
      );
    }

    return (
      <div>
        {/* Collapsible trigger */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={[
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active
              ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white",
          ].join(" ")}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            aria-hidden="true"
            className={[
              "h-4 w-4 shrink-0 transition-transform duration-200",
              open ? "rotate-0" : "-rotate-90",
            ].join(" ")}
          />
        </button>

        {/* Animated sub-menu */}
        <div
          aria-hidden={!open}
          className={[
            "overflow-hidden transition-all duration-200 ease-in-out",
            open ? "max-h-32 opacity-100" : "max-h-0 opacity-0",
          ].join(" ")}
        >
          <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-100 pl-3 dark:border-gray-800">
            {item.children.map((child) => {
              const childActive = routeIsActive(child.href, pathname);
              const ChildIcon   = child.icon;
              return (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    aria-current={childActive ? "page" : undefined}
                    className={[
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                      childActive
                        ? "font-medium text-indigo-600 dark:text-indigo-400"
                        : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
                    ].join(" ")}
                  >
                    <ChildIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {child.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  // ── Simple link ───────────────────────────────────────────────────────────

  if (collapsed) {
    return (
      <Link
        href={item.href}
        title={item.label}
        aria-current={active ? "page" : undefined}
        className={[
          "mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white",
        ].join(" ")}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={[
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white",
      ].join(" ")}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen:  boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  // Auto-close on mobile when route changes
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Backdrop — shown only when sidebar is fully expanded on mobile */}
      {isOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/*
       * Spacer: keeps the main content offset 56 px from the left on mobile
       * so it doesn't slide under the fixed icon sidebar.
       * Hidden on desktop (sidebar participates in flex layout instead).
       */}
      <div className="w-14 shrink-0 lg:hidden" aria-hidden="true" />

      {/*
       * Sidebar panel
       * Mobile (default):   fixed, w-14, icon-only
       * Mobile (isOpen):    fixed, w-64, full labels + backdrop
       * Desktop (lg+):      sticky, w-64, always visible
       */}
      <aside
        aria-label="Navigation principale"
        className={[
          "flex flex-col border-r border-gray-200 bg-white",
          "dark:border-gray-700 dark:bg-gray-900",
          "transition-[width] duration-200 ease-in-out",
          // Fixed on mobile, sticky on desktop
          "fixed top-0 bottom-0 left-0 z-50",
          "lg:sticky lg:top-16 lg:bottom-auto lg:left-auto lg:z-auto lg:h-[calc(100vh-4rem)]",
          // Width: narrow on mobile unless expanded
          isOpen ? "w-64" : "w-14",
          "lg:w-64",
        ].join(" ")}
      >
        {/* ── Mobile header (logo + close) — visible only when expanded ── */}
        <div className={["flex items-center border-b border-gray-100 dark:border-gray-800 lg:hidden", isOpen ? "h-16 justify-between px-4" : "h-16 justify-center px-2"].join(" ")}>
          {isOpen ? (
            <>
              <Link
                href="/dashboard"
                onClick={onClose}
                className="text-lg font-bold tracking-tight text-gray-900 dark:text-white"
              >
                BRAND<span className="text-indigo-500">PILOT</span>
              </Link>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer le menu"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </>
          ) : (
            /* Icon-only: show indigo logo initial */
            <Link
              href="/dashboard"
              aria-label="Aller au tableau de bord"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-xs font-extrabold text-white"
            >
              B
            </Link>
          )}
        </div>

        {/* ── Project selector ──
         *  Two renders, CSS-toggled:
         *  • icon-only  : mobile collapsed (isOpen=false)
         *  • full       : mobile expanded (isOpen=true) + desktop (lg+)
         */}
        <div className={["lg:hidden", isOpen ? "hidden" : "block"].join(" ")}>
          <ProjectSelector collapsed={true} />
        </div>
        <div className={[isOpen ? "block" : "hidden lg:block"].join(" ")}>
          <ProjectSelector collapsed={false} />
        </div>

        {/* ── Navigation ── */}
        <nav
          className="flex flex-1 flex-col overflow-y-auto py-3"
          aria-label="Menu principal"
        >
          {/* Mobile collapsed: icons only */}
          <div className={["flex flex-col gap-1 px-2 lg:hidden", isOpen ? "hidden" : "flex"].join(" ")}>
            {NAV.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} collapsed={true} />
            ))}
          </div>

          {/* Mobile expanded + desktop: full labels */}
          <div className={["flex flex-col gap-0.5 px-3", isOpen ? "flex" : "hidden lg:flex"].join(" ")}>
            {NAV.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} collapsed={false} />
            ))}
          </div>
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
