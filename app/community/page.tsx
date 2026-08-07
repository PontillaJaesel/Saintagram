import { RouteGuard } from "@/components/auth/route-guard";
import { AppShell } from "@/components/layout/app-shell";
import { CommunityHub } from "@/components/social/community-hub";

export default function CommunityPage() {
  return (
    <RouteGuard requireProfile>
      <AppShell>
        <CommunityHub />
      </AppShell>
    </RouteGuard>
  );
}