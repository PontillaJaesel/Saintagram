/**
 * Browser-safe constants used by both the tracked-entry redirect and the
 * client-side provider that enriches a visit with Firebase identity and GPS.
 *
 * Keep this file free of firebase-admin/server-only imports because it is also
 * bundled into the browser.
 */
export const OPEN_EVENT_ID_PARAM = "__sg_open";
export const OPEN_EVENT_TOKEN_PARAM = "__sg_token";

export const VISIT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const OPEN_EVENT_TOKEN_PATTERN = /^[A-Fa-f0-9]{64}$/;

export type OpenEventClientTarget = {
  eventId: string;
  trackingToken: string;
};

export function validOpenEventClientTarget(
  eventId: unknown,
  trackingToken: unknown
): OpenEventClientTarget | null {
  if (
    typeof eventId !== "string" ||
    typeof trackingToken !== "string" ||
    !VISIT_ID_PATTERN.test(eventId) ||
    !OPEN_EVENT_TOKEN_PATTERN.test(trackingToken)
  ) {
    return null;
  }

  return { eventId, trackingToken };
}
