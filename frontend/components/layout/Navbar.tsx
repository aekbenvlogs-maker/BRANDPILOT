"use client";
// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/components/layout/Navbar.tsx
// ============================================================

import React, { useRef, useState } from "react";
import { Menu, LogOut, User, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = user
    ? [user.first_name?.[0], user.last_name?.[0]].filter(Boolean).join("").toUpperCase() ||
      user.email[0].toUpperCase()
    : "?";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900">
      {/* Left — hamburger + logo */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Ouvrir le menu de navigation"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:hidden dark:hover:bg-gray-800"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link
          href="/dashboard"
          className="text-lg font-bold tracking-tight text-gray-900 dark:text-white"
        >
          BRAND<span className="text-indigo-500">SCALE</span>
        </Link>
      </div>

      {/* Right — user menu */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          aria-label="Menu utilisateur"
          aria-expanded={dropdownOpen}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
            {initials}
          </span>
          <span className="hidden sm:block max-w-[120px] truncate">
            {user?.first_name ?? user?.email ?? "Compte"}
          </span>
          <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <Link
              href="/profile"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <User className="h-4 w-4" aria-hidden="true" />
              Profil
            </Link>
            <button
              type="button"
              onClick={() => { setDropdownOpen(false); void logout(); }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Navbar;
