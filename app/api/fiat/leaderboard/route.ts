import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { eligibleFiatCount, fiatPeriodBounds, isFiatCategory } from "@/lib/fiat";
import type { FiatLeaderboardEntry, FiatLeaderboardPeriod, ReflectionPost } from "@/types";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const bearer = request.headers.get("authorization") ?? "";
    if (!bearer.startsWith("Bearer ")) return NextResponse.json({ error: "Authentication is required." }, { status: 401, headers });
    const token = await getFirebaseAdminAuth().verifyIdToken(bearer.slice(7), true);
    const url = new URL(request.url);
    const period = url.searchParams.get("period") as FiatLeaderboardPeriod;
    const today = url.searchParams.get("today") ?? "";
    if (!["today", "week", "month"].includes(period) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return NextResponse.json({ error: "Invalid leaderboard period." }, { status: 400, headers });
    const db = getFirebaseAdminFirestore();
    const [reflections, profiles] = await Promise.all([db.collection("reflectionPosts").get(), db.collection("socialProfiles").get()]);
    const profileMap = new Map(profiles.docs.map((doc) => [doc.id, doc.data()]));
    const byUser = new Map<string, ReflectionPost[]>();
    for (const doc of reflections.docs) {
      const data = doc.data();
      const userId = typeof data.userId === "string" ? data.userId : "";
      if (!userId || !profileMap.has(userId) || !isFiatCategory(data.fiatCategory)) continue;
      const createdAt = data.createdAt?.toDate?.()?.toISOString?.() ?? String(data.createdAt ?? "");
      const post: ReflectionPost = { id: doc.id, userId, content: "", isPrivate: Boolean(data.isPrivate), createdAt, updatedAt: createdAt, fiatCategory: data.fiatCategory, ...(typeof data.fiatDateKey === "string" ? { fiatDateKey: data.fiatDateKey } : {}) };
      byUser.set(userId, [...(byUser.get(userId) ?? []), post]);
    }
    const bounds = fiatPeriodBounds(period, today);
    const ranked = [...byUser.entries()].map(([userId, posts]) => {
      const profile = profileMap.get(userId)!;
      return { userId, profileName: typeof profile.profileName === "string" ? profile.profileName : "Saintagram user", imagePath: typeof profile.imagePath === "string" ? profile.imagePath : "", eligibleCount: eligibleFiatCount(posts, bounds.start, bounds.end) };
    }).filter((entry) => entry.eligibleCount > 0).sort((a, b) => b.eligibleCount - a.eligibleCount || a.profileName.localeCompare(b.profileName) || a.userId.localeCompare(b.userId)).map((entry, index): FiatLeaderboardEntry => ({ ...entry, rank: index + 1 }));
    return NextResponse.json({ entries: ranked.slice(0, 50), currentUser: ranked.find((entry) => entry.userId === token.uid) ?? null, period, bounds }, { headers });
  } catch {
    return NextResponse.json({ error: "The FiAt leaderboard could not be loaded." }, { status: 401, headers });
  }
}
