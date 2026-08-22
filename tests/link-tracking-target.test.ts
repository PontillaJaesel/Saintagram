import { describe, expect, it } from "vitest";
import {
  createOpenEventTrackingToken,
  hashOpenEventTrackingToken
} from "@/lib/link-tracking";
import {
  OPEN_EVENT_TOKEN_PATTERN,
  validOpenEventClientTarget
} from "@/lib/link-tracking-shared";

describe("link tracking browser target", () => {
  it("creates a token that can securely target one tracked event", async () => {
    const token = createOpenEventTrackingToken();
    expect(token).toMatch(OPEN_EVENT_TOKEN_PATTERN);

    const firstHash = await hashOpenEventTrackingToken(token);
    const secondHash = await hashOpenEventTrackingToken(token);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    expect(secondHash).toBe(firstHash);

    expect(validOpenEventClientTarget("event_123", token)).toEqual({
      eventId: "event_123",
      trackingToken: token
    });
    expect(validOpenEventClientTarget("event_123", "bad-token")).toBeNull();
  });
});
