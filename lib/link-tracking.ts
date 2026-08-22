import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { getSafeAccessDestination } from "@/lib/access-path";
import {
  OPEN_EVENT_TOKEN_PATTERN,
  VISIT_ID_PATTERN
} from "@/lib/link-tracking-shared";

export {
  OPEN_EVENT_ID_PARAM,
  OPEN_EVENT_TOKEN_PARAM,
  OPEN_EVENT_TOKEN_PATTERN,
  VISIT_ID_PATTERN,
  validOpenEventClientTarget,
  type OpenEventClientTarget
} from "@/lib/link-tracking-shared";

export const PENDING_OPEN_COOKIE = "saintagram_pending_open";
export const LOCATION_OPEN_COOKIE = "saintagram_location_open";
export const VISIT_SESSION_COOKIE = "saintagram_visit_session";
export const COMMON_VISIT_COOKIE = "saintagram_common_visit";
export const COMMON_ENTRY_BYPASS_COOKIE = "saintagram_common_entry_bypass";
export const QR_VISIT_COOKIE = "saintagram_qr_visit";
export const VISIT_SESSION_TTL_SECONDS = 30 * 60;
// Repeated unclaimed opens from the same browser/source are treated as one visit
// for this amount of time. The row keeps an openCount instead of creating spam.
export const ANONYMOUS_VISIT_WINDOW_SECONDS = VISIT_SESSION_TTL_SECONDS;

export function validCampaign(value: string | null): string | null {
  if (!value) return null;
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value) ? value : null;
}

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, 100) : "";

type CloudflareRequest = Request & {
  cf?: Record<string, unknown>;
};

export function approximateLocation(requestOrHeaders: Request | Headers) {
  const request =
    requestOrHeaders instanceof Headers
      ? null
      : (requestOrHeaders as CloudflareRequest);
  const headers =
    requestOrHeaders instanceof Headers
      ? requestOrHeaders
      : requestOrHeaders.headers;
  const cf = request?.cf;
  const hostname = request ? new URL(request.url).hostname : "";
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  const city =
    clean(cf?.city) ||
    clean(headers.get("cf-ipcity")) ||
    (isLocalhost ? "Localhost" : "");
  const region = clean(cf?.region) || clean(headers.get("cf-region"));
  const country = clean(cf?.country) || clean(headers.get("cf-ipcountry"));
  const latitude =
    clean(cf?.latitude) || clean(headers.get("cf-iplatitude")) || null;
  const longitude =
    clean(cf?.longitude) || clean(headers.get("cf-iplongitude")) || null;
  const parts = [city, region, country].filter(Boolean);

  return {
    city: city || null,
    region: region || null,
    country: country || null,
    latitude,
    longitude,
    locationLabel: parts.length ? parts.join(", ") : "Location unavailable",
    locationSource: isLocalhost
      ? ("localhost" as const)
      : parts.length
        ? ("cloudflare" as const)
        : ("unavailable" as const)
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * The browser receives this one-time opaque token alongside the event id.
 * APIs require the matching SHA-256 hash before allowing that browser to enrich
 * the event. This avoids depending only on redirect cookies, which can be
 * unreliable across the multi-redirect Saintagram entry flow on some browsers.
 */
export function createOpenEventTrackingToken(): string {
  return `${crypto.randomUUID().replaceAll("-", "")}${crypto
    .randomUUID()
    .replaceAll("-", "")}`;
}

export async function hashOpenEventTrackingToken(
  value: unknown
): Promise<string | null> {
  if (typeof value !== "string" || !OPEN_EVENT_TOKEN_PATTERN.test(value)) {
    return null;
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return bytesToHex(new Uint8Array(digest));
}

export async function recordLinkOpen(
  request: Request,
  source: "qr" | "common"
) {
  const url = new URL(request.url);
  const destination = getSafeAccessDestination(url.searchParams.get("next"));
  const ref = getFirebaseAdminFirestore().collection("linkOpenEvents").doc();
  const trackingToken = createOpenEventTrackingToken();
  const browserTrackingTokenHash = await hashOpenEventTrackingToken(
    trackingToken
  );

  if (!browserTrackingTokenHash) {
    throw new Error("Could not create a browser tracking token.");
  }

  await ref.set({
    visitId: ref.id,
    id: ref.id,
    trackingVersion: 3,
    browserTrackingTokenHash,
    source,
    campaign: validCampaign(url.searchParams.get("campaign")),
    openedAt: FieldValue.serverTimestamp(),
    lastOpenedAt: FieldValue.serverTimestamp(),
    openCount: 1,
    userId: null,
    claimedAt: null,
    ...approximateLocation(request),
    destination
  });

  return { id: ref.id, destination, trackingToken };
}

/**
 * Reuse an existing unclaimed visit only when it is the same tracked source,
 * campaign and destination. This is how repeated anonymous opens from the same
 * browser become one history row with a larger openCount.
 *
 * Once the visit has been claimed by a signed-in user, it is never reused; the
 * next tracked link open becomes a new visit.
 */
export async function reuseUnclaimedLinkOpen(
  eventId: string,
  request: Request,
  source: "qr" | "common"
): Promise<{
  id: string;
  destination: string;
  trackingToken: string;
} | null> {
  if (!VISIT_ID_PATTERN.test(eventId)) return null;

  const url = new URL(request.url);
  const campaign = validCampaign(url.searchParams.get("campaign"));
  const destination = getSafeAccessDestination(url.searchParams.get("next"));
  const db = getFirebaseAdminFirestore();
  const ref = db.collection("linkOpenEvents").doc(eventId);
  const trackingToken = createOpenEventTrackingToken();
  const browserTrackingTokenHash = await hashOpenEventTrackingToken(
    trackingToken
  );

  if (!browserTrackingTokenHash) {
    return null;
  }

  let reused = false;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;

    const storedUserId = snapshot.get("userId");
    const storedSource = snapshot.get("source");
    const storedCampaign = snapshot.get("campaign") ?? null;
    const storedDestination = getSafeAccessDestination(
      typeof snapshot.get("destination") === "string"
        ? snapshot.get("destination")
        : "/"
    );

    if (
      storedUserId ||
      storedSource !== source ||
      storedCampaign !== campaign ||
      storedDestination !== destination
    ) {
      return;
    }

    transaction.update(ref, {
      trackingVersion: 3,
      browserTrackingTokenHash,
      openCount: FieldValue.increment(1),
      lastOpenedAt: FieldValue.serverTimestamp()
    });
    reused = true;
  });

  return reused ? { id: eventId, destination, trackingToken } : null;
}
