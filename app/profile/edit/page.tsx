import { RouteGuard } from "@/components/auth/route-guard";
import { AppShell } from "@/components/layout/app-shell";
import { ProfileEditor } from "@/components/profile/profile-editor";

export default function EditProfilePage() {
  return (
    <RouteGuard requireProfile>
      <AppShell
        title="Edit Profile"
        description="Your answers can grow with you. Only the profile name is required."
      >
        <div className="mx-auto max-w-3xl">
          <ProfileEditor />
        </div>
      </AppShell>
    </RouteGuard>
  );
}
