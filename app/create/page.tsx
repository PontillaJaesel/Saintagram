import { RouteGuard } from "@/components/auth/route-guard";
import { ProfileWizard } from "@/components/profile/profile-wizard";

export default function CreateProfilePage() {
  return (
    <RouteGuard requireConsent={false} redirectCompleted>
      <ProfileWizard />
    </RouteGuard>
  );
}
