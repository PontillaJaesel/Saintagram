import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { PENDING_OPEN_COOKIE, VISIT_ID_PATTERN } from "@/lib/link-tracking";
import { reverseGeocode } from "@/lib/google-geocoding";

const response = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  try {
    const jar = await cookies();
    const eventId = jar.get(PENDING_OPEN_COOKIE)?.value;
    if (!eventId || !VISIT_ID_PATTERN.test(eventId)) return response({ updated: false });
    const body = await request.json().catch(() => ({})) as { latitude?: unknown; longitude?: unknown; accuracy?: unknown };
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracy = Number(body.accuracy);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return response({ error: "Invalid device location." }, 400);
    const ref = getFirebaseAdminFirestore().collection("linkOpenEvents").doc(eventId);
    const event = await ref.get();
    if (!event.exists) return response({ updated: false });
    const coordinateLabel = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    let address = null;
    try {
      address = await reverseGeocode(latitude, longitude);
    } catch (error) {
      console.error("Reverse geocoding failed; saving coordinates only.", error instanceof Error ? { name: error.name, message: error.message } : String(error));
    }
    await ref.update({
      latitude: String(latitude),
      longitude: String(longitude),
      locationLabel: address?.formattedAddress || coordinateLabel,
      locationSource: "device",
      locationAccuracyMeters: Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : null,
      ...(address ? {
        streetAddress: address.streetAddress,
        city: address.city ?? event.get("city") ?? null,
        region: address.region ?? event.get("region") ?? null,
        country: address.country ?? event.get("country") ?? null,
        postalCode: address.postalCode,
        formattedAddress: address.formattedAddress,
        geocodingPlaceId: address.placeId,
        geocodingLocationType: address.geocodingLocationType,
        geocodedAt: FieldValue.serverTimestamp()
      } : {}),
      locationUpdatedAt: FieldValue.serverTimestamp()
    });
    return response({ updated: true, addressResolved: Boolean(address) });
  } catch {
    return response({ error: "Device location could not be saved." }, 500);
  }
}
