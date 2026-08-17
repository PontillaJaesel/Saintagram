import { describe, expect, it } from "vitest";
import { resolvePostAuthRoute } from "@/lib/routes";
import type { AppUser } from "@/types";

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    email: "beloved@example.com",
    authProvider: "password",
    mustChangePassword: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    privacyConsentAt: null,
    spiritualIntroSeenAt: null,
    profileCompleted: false,
    ...overrides
  };
}

describe("resolvePostAuthRoute", () => {
  it.each([
    {
      state: "is using a temporary password without a completed profile",
      user: makeUser({ mustChangePassword: true }),
      expected: "/create"
    },
    {
      state: "has not accepted privacy",
      user: makeUser(),
      expected: "/create"
    },
    {
      state: "accepted privacy but has not read the introduction",
      user: makeUser({
        privacyConsentAt: "2026-01-02T00:00:00.000Z"
      }),
      expected: "/create"
    },
    {
      state: "read the introduction but has not completed a profile",
      user: makeUser({
        privacyConsentAt: "2026-01-02T00:00:00.000Z",
        spiritualIntroSeenAt: "2026-01-03T00:00:00.000Z"
      }),
      expected: "/create"
    },
    {
      state: "has completed a profile",
      user: makeUser({
        privacyConsentAt: "2026-01-02T00:00:00.000Z",
        spiritualIntroSeenAt: "2026-01-03T00:00:00.000Z",
        profileCompleted: true
      }),
      expected: "/profile"
    }
  ])("returns $expected when the user $state", ({ user, expected }) => {
    expect(resolvePostAuthRoute(user)).toBe(expected);
  });

  it("sends a completed legacy user to the profile even without an intro timestamp", () => {
    const user = makeUser({
      privacyConsentAt: "2026-01-02T00:00:00.000Z",
      profileCompleted: true
    });

    expect(resolvePostAuthRoute(user)).toBe("/profile");
  });

  it("requires a completed temporary-password user to change the password", () => {
    const user = makeUser({ profileCompleted: true, mustChangePassword: true });

    expect(resolvePostAuthRoute(user)).toBe("/settings");
  });
});
