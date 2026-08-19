import {
  RouteGuard
} from "@/components/auth/route-guard";

import {
  AppShell
} from "@/components/layout/app-shell";

import {
  FollowRequestsPage
} from "@/components/social/follow-requests-page";

export default function FollowRequestsRoute() {
  return (
    <RouteGuard
      requireProfile
    >
      <AppShell
        title="Follow Requests"
        description="Approve or reject people who want to follow your private account."
      >
        <FollowRequestsPage />
      </AppShell>
    </RouteGuard>
  );
}