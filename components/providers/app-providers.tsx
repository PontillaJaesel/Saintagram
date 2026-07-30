"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/providers/toast-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <ThemeProvider>
      {pathname === "/access" ? (
        children
      ) : (
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      )}
    </ThemeProvider>
  );
}
