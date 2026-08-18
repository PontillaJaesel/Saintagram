import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminRouteGuard } from "@/components/admin/admin-route-guard";
import { AdminShell } from "@/components/admin/admin-shell";

const LOGO_VERSION = "20260818";

export const metadata: Metadata = {
  icons: {
    icon: `/Saintagram_Logo.svg?v=${LOGO_VERSION}`,
    shortcut: `/Saintagram_Logo.svg?v=${LOGO_VERSION}`,
    apple: `/Saintagram_Logo.png?v=${LOGO_VERSION}`
  }
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <AdminRouteGuard>
      <AdminShell>{children}</AdminShell>
    </AdminRouteGuard>
  );
}
