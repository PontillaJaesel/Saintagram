import { RouteGuard } from "@/components/auth/route-guard";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsPanel } from "@/components/settings/settings-panel";

export default function SettingsPage() {
  return (
    <RouteGuard requireConsent={false}>
      <AppShell>
        <SettingsPanel />
      </AppShell>
    </RouteGuard>
  );
}
