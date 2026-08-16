"use client";
import { getFirebaseServices } from "@/lib/firebase";

let verifiedAdminToken: string | null = null;

export function setVerifiedAdminToken(token: string | null): void {
  verifiedAdminToken = token;
}

export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
  idToken?: string
): Promise<T> {
  const services = getFirebaseServices();
  const user = services?.auth.currentUser;
  if (!idToken && !user && !verifiedAdminToken) {
    throw new Error("Please sign in with an administrator account.");
  }
  const token = idToken ?? (user ? await user.getIdToken() : verifiedAdminToken!);
  const response = await fetch(path, { ...init, cache: "no-store", headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers, Authorization: `Bearer ${token}` } });
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error ?? "The admin request failed."); }
  return response.json() as Promise<T>;
}
export async function adminDownload(path: string, body: unknown): Promise<Blob> {
  const services = getFirebaseServices(); const user = services?.auth.currentUser;
  if (!user) throw new Error("Please sign in with an administrator account.");
  const response = await fetch(path, { method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as {error?:string}).error ?? "Export failed.");
  return response.blob();
}
