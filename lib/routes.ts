import type { AppUser } from "@/types";

export type AuthDestination =
  | "/settings"
  | "/privacy"
  | "/introduction"
  | "/create"
  | "/profile";

export function resolvePostAuthRoute(
  user: AppUser
): AuthDestination {
  if (!user.profileCompleted) {
    return "/create";
  }

  if (user.mustChangePassword !== false) {
    return "/settings";
  }

  if (!user.privacyConsentAt) {
    return "/privacy";
  }

  return "/profile";
}
