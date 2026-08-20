import { getFirebaseServices, isFirebaseConfigured } from "@/lib/firebase";

export async function syncRequiredFollows(): Promise<void> {
  if (!isFirebaseConfigured) return;
  const currentUser = getFirebaseServices()?.auth.currentUser;
  if (!currentUser) return;
  const response = await fetch("/api/social/sync-required-follows", {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${await currentUser.getIdToken()}`
    }
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Required follows could not be synchronized.");
  }
}
