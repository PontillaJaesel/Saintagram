import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { PENDING_OPEN_COOKIE, VISIT_ID_PATTERN } from "@/lib/link-tracking";

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
    if (!(await ref.get()).exists) return response({ updated: false });
    const coordinateLabel = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    await ref.update({ latitude: String(latitude), longitude: String(longitude), locationLabel: coordinateLabel, locationSource: "device", locationAccuracyMeters: Number.isFinite(accuracy) && accuracy >= 0 ? Math.round(accuracy) : null, locationUpdatedAt: FieldValue.serverTimestamp() });
    return response({ updated: true });
  } catch {
    return response({ error: "Device location could not be saved." }, 500);
  }
}
