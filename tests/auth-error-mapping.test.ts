import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "@/lib/app-service";

describe("Firebase auth error mapping", () => {
  it("maps modern invalid-login credentials to the user-facing mismatch message", () => {
    expect(friendlyAuthError({ code: "auth/invalid-login-credentials" }).message).toBe(
      "That username and password do not match. Please try again."
    );
  });
});
