import type { AppUser } from "@/types";

export type AuthDestination =
  | "/auth?changePassword=1"
  | "/privacy"
  | "/introduction"
  | "/create"
  | "/profile";

export function resolvePostAuthRoute(user: AppUser): AuthDestination {
  if (user.mustChangePassword) return "/auth?changePassword=1";
  if (!user.privacyConsentAt) return "/privacy";
  if (!user.profileCompleted && !user.spiritualIntroSeenAt) return "/introduction";
  if (!user.profileCompleted) return "/create";
  return "/profile";
}
