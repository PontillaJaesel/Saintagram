import { RouteGuard } from "@/components/auth/route-guard";
import { AppShell } from "@/components/layout/app-shell";
import { FiatLeaderboardPage } from "@/components/fiat/fiat-leaderboard-page";

export default function FiatLeaderboardRoute() {
  return (
    <RouteGuard requireProfile>
      <AppShell>
        <FiatLeaderboardPage />
      </AppShell>
    </RouteGuard>
  );
}