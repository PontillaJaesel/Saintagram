import { RouteGuard } from "@/components/auth/route-guard";
import { JourneyTimeline } from "@/components/journey/journey-timeline";
import { AppShell } from "@/components/layout/app-shell";

export default function JourneyPage() {
  return (
    <RouteGuard requireProfile>
      <AppShell>
        <JourneyTimeline />
      </AppShell>
    </RouteGuard>
  );
}
