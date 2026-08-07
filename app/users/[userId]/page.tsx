import { RouteGuard } from "@/components/auth/route-guard";
import { AppShell } from "@/components/layout/app-shell";
import { SocialProfileView } from "@/components/social/social-profile-view";

export default async function UserProfilePage({
  params
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <RouteGuard requireProfile>
      <AppShell>
        <SocialProfileView userId={userId} />
      </AppShell>
    </RouteGuard>
  );
}