import type { AppUser } from "@/types";

export type AuthDestination =
  | "/settings"
  | "/privacy"
  | "/introduction"
  | "/create"
  | "/profile";

export function resolvePostAuthRoute(user: AppUser): AuthDestination {
  if (user.mustChangePassword) return "/settings";
  if (!user.privacyConsentAt) return "/privacy";
  if (!user.profileCompleted && !user.spiritualIntroSeenAt) return "/introduction";
  if (!user.profileCompleted) return "/create";
  return "/profile";
}
