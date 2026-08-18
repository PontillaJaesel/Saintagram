"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { LoadingState } from "@/components/ui/loading-state";
import { resolvePostAuthRoute } from "@/lib/routes";
import { isIntentionalAuthExitPending } from "@/lib/auth-navigation";

export function RouteGuard({
  children,
  requireConsent = true,
  redirectCompleted = false
}: {
  children: ReactNode;
  requireConsent?: boolean;
  requireIntroduction?: boolean;
  requireProfile?: boolean;
  redirectCompleted?: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  let destination: string | null = null;
  if (!loading) {
    if (!user) {
      destination = isIntentionalAuthExitPending()
        ? "/"
        : `/auth?mode=login&next=${encodeURIComponent(pathname)}`;
    } else if (!user.profileCompleted) {
      destination =
        pathname === "/create"
          ? null
          : "/create";
    } else if (user.mustChangePassword !== false) {
      destination =
        pathname === "/settings"
          ? null
          : "/settings";
    } else if (requireConsent && !user.privacyConsentAt) {
      destination = "/privacy";
    } else if (redirectCompleted && user.profileCompleted) {
      destination = resolvePostAuthRoute(user);
    }
  }

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  if (loading || destination) {
    return <LoadingState label="Opening your private space…" fullPage />;
  }

  return <>{children}</>;
}
