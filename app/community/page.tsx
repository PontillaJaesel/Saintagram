import { RouteGuard } from "@/components/auth/route-guard";
import { AppShell } from "@/components/layout/app-shell";
import { UserDirectory } from "@/components/social/user-directory";

export default function CommunityPage() {
  return (
    <RouteGuard requireProfile>
      <AppShell
        title="Community"
        description="Find people whose public reflections you would like to follow."
      >
        <UserDirectory />
      </AppShell>
    </RouteGuard>
  );
}