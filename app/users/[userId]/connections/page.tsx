import { RouteGuard } from "@/components/auth/route-guard";
import { AppShell } from "@/components/layout/app-shell";
import { SocialConnectionsView } from "@/components/social/social-connections-view";

export default async function UserConnectionsPage({
  params
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <RouteGuard requireProfile>
      <AppShell>
        <SocialConnectionsView userId={userId} />
      </AppShell>
    </RouteGuard>
  );
}
