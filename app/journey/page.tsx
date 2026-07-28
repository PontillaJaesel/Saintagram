import { RouteGuard } from "@/components/auth/route-guard";
import { JourneyTimeline } from "@/components/journey/journey-timeline";
import { AppShell } from "@/components/layout/app-shell";

export default function JourneyPage() {
  return (
    <RouteGuard requireProfile>
      <AppShell
        title="Spiritual Journey"
        description="Look back with compassion at how your reflections and profile have grown."
      >
        <JourneyTimeline />
      </AppShell>
    </RouteGuard>
  );
}
