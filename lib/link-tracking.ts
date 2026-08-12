import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { getSafeAccessDestination } from "@/lib/access-path";
export const PENDING_OPEN_COOKIE = "saintagram_pending_open";
export function validCampaign(value: string | null): string | null { if (!value) return null; return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value) ? value : null; }
const clean = (value: string | null) => (value ?? "").trim().slice(0, 100);
export function approximateLocation(headers: Headers) { const city=clean(headers.get("cf-ipcity")); const region=clean(headers.get("cf-region")); const country=clean(headers.get("cf-ipcountry")); const parts=[city,region,country].filter(Boolean); return { city, region, country, locationLabel: parts.length ? parts.join(", ") : "Location unavailable", locationSource: parts.length ? "cloudflare" as const : "unavailable" as const }; }
export async function recordLinkOpen(request: Request, source: "qr" | "common") { const url=new URL(request.url); const destination=getSafeAccessDestination(url.searchParams.get("next")); const ref=getFirebaseAdminFirestore().collection("linkOpenEvents").doc(); await ref.set({ id:ref.id, source, campaign:validCampaign(url.searchParams.get("campaign")), openedAt:FieldValue.serverTimestamp(), userId:null, claimedAt:null, ...approximateLocation(request.headers), destination }); return { id:ref.id, destination }; }
