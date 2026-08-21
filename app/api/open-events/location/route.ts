import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import {
  LOCATION_OPEN_COOKIE,
  PENDING_OPEN_COOKIE,
  VISIT_ID_PATTERN,
  hashOpenEventTrackingToken
} from "@/lib/link-tracking";
import { validOpenEventClientTarget } from "@/lib/link-tracking-shared";
import { reverseGeocode } from "@/lib/google-geocoding";

const response = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      eventId?: unknown;
      trackingToken?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      accuracy?: unknown;
      complete?: unknown;
    };
    const explicitTarget = validOpenEventClientTarget(
      body.eventId,
      body.trackingToken
    );

    const jar = await cookies();
    const locationCookieEventId = jar.get(LOCATION_OPEN_COOKIE)?.value;
    const pendingCookieEventId = jar.get(PENDING_OPEN_COOKIE)?.value;

    // Prefer the explicit redirect target. Cookies remain as compatibility
    // fallback for older entry URLs. This is what makes GPS attachment survive
    // browser/redirect cookie loss in production.
    const eventId =
      explicitTarget?.eventId ??
      (locationCookieEventId && VISIT_ID_PATTERN.test(locationCookieEventId)
        ? locationCookieEventId
        : pendingCookieEventId && VISIT_ID_PATTERN.test(pendingCookieEventId)
          ? pendingCookieEventId
          : null);

    if (!eventId) {
      return response({ updated: false, reason: "missing_target" });
    }

    const explicitTokenHash = explicitTarget
      ? await hashOpenEventTrackingToken(explicitTarget.trackingToken)
      : null;

    if (explicitTarget && !explicitTokenHash) {
      return response({ error: "Invalid tracking target." }, 400);
    }

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracy = Number(body.accuracy);
    const complete = body.complete === true;

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return response({ error: "Invalid device location." }, 400);
    }

    const ref = getFirebaseAdminFirestore()
      .collection("linkOpenEvents")
      .doc(eventId);
    const event = await ref.get();

    if (!event.exists) {
      return response({ updated: false, reason: "missing_event" }, 404);
    }

    if (
      explicitTokenHash &&
      event.get("browserTrackingTokenHash") !== explicitTokenHash
    ) {
      return response({ error: "The tracking target is no longer valid." }, 403);
    }

    const normalizedAccuracy =
      Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : null;
    const existingAccuracyValue = event.get("locationAccuracyMeters");
    const existingAccuracy =
      typeof existingAccuracyValue === "number" &&
      Number.isFinite(existingAccuracyValue) &&
      existingAccuracyValue >= 0
        ? existingAccuracyValue
        : null;
    const hasBetterExistingDeviceLocation =
      event.get("locationSource") === "device" &&
      normalizedAccuracy !== null &&
      existingAccuracy !== null &&
      existingAccuracy < normalizedAccuracy;

    // Never replace a strictly more accurate device reading with a worse one if
    // a retry/page reload happens for the same tracked visit.
    if (hasBetterExistingDeviceLocation) {
      const result = response({
        updated: false,
        keptMoreAccurate: true,
        accuracy: existingAccuracy
      });
      if (complete && locationCookieEventId === eventId) {
        result.cookies.delete(LOCATION_OPEN_COOKIE);
      }
      return result;
    }

    const coordinateLabel = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    let address = null;

    // Intermediate GPS samples only update coordinates/accuracy. Reverse
    // geocode the final best sample so retries do not multiply Google API use.
    if (complete) {
      try {
        address = await reverseGeocode(latitude, longitude);
      } catch (error) {
        console.error(
          "Reverse geocoding failed; saving coordinates only.",
          error instanceof Error
            ? { name: error.name, message: error.message }
            : String(error)
        );
      }
    }

    await ref.update({
      latitude: String(latitude),
      longitude: String(longitude),
      locationLabel: address?.formattedAddress || coordinateLabel,
      locationSource: "device",
      locationAccuracyMeters: normalizedAccuracy,
      ...(address
        ? {
            streetAddress: address.streetAddress,
            city: address.city ?? event.get("city") ?? null,
            region: address.region ?? event.get("region") ?? null,
            country: address.country ?? event.get("country") ?? null,
            postalCode: address.postalCode,
            formattedAddress: address.formattedAddress,
            geocodingPlaceId: address.placeId,
            geocodingLocationType: address.geocodingLocationType,
            geocodedAt: FieldValue.serverTimestamp()
          }
        : {}),
      locationUpdatedAt: FieldValue.serverTimestamp()
    });

    const result = response({
      updated: true,
      addressResolved: Boolean(address),
      accuracy: normalizedAccuracy
    });

    if (complete && locationCookieEventId === eventId) {
      result.cookies.delete(LOCATION_OPEN_COOKIE);
    }
    return result;
  } catch (error) {
    console.error("Device location could not be saved.", error);
    return response({ error: "Device location could not be saved." }, 500);
  }
}
