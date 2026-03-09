"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login") return;
    const token = localStorage.getItem("bs_token");
    if (!token) {
      router.replace("/login");
    }
  }, [pathname, router]);

  return <>{children}</>;
}
