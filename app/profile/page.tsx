"use client";

import { Suspense } from "react";
import { RouteGuard } from "@/components/auth/route-guard";
import { AppShell } from "@/components/layout/app-shell";
import { ProfileDashboard } from "@/components/profile/profile-dashboard";
import { LoadingState } from "@/components/ui/loading-state";

export default function ProfilePage() {
  return (
    <RouteGuard requireProfile>
      <AppShell>
        <Suspense fallback={<LoadingState label="Opening your profile…" />}>
          <ProfileDashboard />
        </Suspense>
      </AppShell>
    </RouteGuard>
  );
}
