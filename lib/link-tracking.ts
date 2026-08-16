import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { getSafeAccessDestination } from "@/lib/access-path";
export const PENDING_OPEN_COOKIE = "saintagram_pending_open";
export const VISIT_SESSION_COOKIE = "saintagram_visit_session";
export const VISIT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export function validCampaign(value: string | null): string | null { if (!value) return null; return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value) ? value : null; }
const clean = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 100) : "";
type CloudflareRequest = Request & { cf?: Record<string, unknown> };
export function approximateLocation(requestOrHeaders: Request | Headers) {
  const request = requestOrHeaders instanceof Headers ? null : requestOrHeaders as CloudflareRequest;
  const headers = requestOrHeaders instanceof Headers ? requestOrHeaders : requestOrHeaders.headers;
  const cf = request?.cf;
  const hostname = request ? new URL(request.url).hostname : "";
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  const city = clean(cf?.city) || clean(headers.get("cf-ipcity")) || (isLocalhost ? "Localhost" : "");
  const region = clean(cf?.region) || clean(headers.get("cf-region"));
  const country = clean(cf?.country) || clean(headers.get("cf-ipcountry"));
  const latitude = clean(cf?.latitude) || clean(headers.get("cf-iplatitude")) || null;
  const longitude = clean(cf?.longitude) || clean(headers.get("cf-iplongitude")) || null;
  const parts = [city, region, country].filter(Boolean);
  return { city: city || null, region: region || null, country: country || null, latitude, longitude, locationLabel: parts.length ? parts.join(", ") : "Location unavailable", locationSource: isLocalhost ? "localhost" as const : parts.length ? "cloudflare" as const : "unavailable" as const };
}
export async function recordLinkOpen(request: Request, source: "qr" | "common") { const url=new URL(request.url); const destination=getSafeAccessDestination(url.searchParams.get("next")); const ref=getFirebaseAdminFirestore().collection("linkOpenEvents").doc(); await ref.set({ visitId:ref.id, id:ref.id, source, campaign:validCampaign(url.searchParams.get("campaign")), openedAt:FieldValue.serverTimestamp(), userId:null, claimedAt:null, ...approximateLocation(request), destination }); return { id:ref.id, destination }; }
