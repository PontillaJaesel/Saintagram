"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { OpenEventProvider } from "@/components/providers/open-event-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <ThemeProvider>
      {pathname === "/access" ? (
        children
      ) : isAdminRoute ? (
        <ToastProvider>{children}</ToastProvider>
      ) : (
        <AuthProvider>
          <ToastProvider><OpenEventProvider>{children}</OpenEventProvider></ToastProvider>
        </AuthProvider>
      )}
    </ThemeProvider>
  );
}
