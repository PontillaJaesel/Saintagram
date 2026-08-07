import { RouteGuard } from "@/components/auth/route-guard";
import { AppShell } from "@/components/layout/app-shell";
import { FollowingFeed } from "@/components/social/following-feed";

export default function FeedPage() {
  return (
    <RouteGuard requireProfile>
      <AppShell
        title="Following"
        description="Public reflections shared by people you follow."
      >
        <FollowingFeed />
      </AppShell>
    </RouteGuard>
  );
}