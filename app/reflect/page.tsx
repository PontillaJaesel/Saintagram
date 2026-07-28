import { RouteGuard } from "@/components/auth/route-guard";
import { AppShell } from "@/components/layout/app-shell";
import { ReflectionManager } from "@/components/reflections/reflection-manager";

export default function ReflectPage() {
  return (
    <RouteGuard requireProfile>
      <AppShell
        title="Reflect"
        description="A private place to notice moments that mattered—even when no one applauded."
      >
        <ReflectionManager />
      </AppShell>
    </RouteGuard>
  );
}
