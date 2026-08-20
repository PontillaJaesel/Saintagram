import { NextResponse } from "next/server";

import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore
} from "@/lib/firebase-admin";
import {
  findLatestFiatStreakLoss,
  isFiatCategory
} from "@/lib/fiat";
import type { ReflectionPost } from "@/types";

export const runtime = "nodejs";

const headers = {
  "Cache-Control": "no-store"
};

function asIso(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return typeof value === "string" ? value : "";
}

function formatLossDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication is required." },
        { status: 401, headers }
      );
    }

    const token = await getFirebaseAdminAuth().verifyIdToken(authorization.slice(7));
    const body = (await request.json().catch(() => ({}))) as { today?: unknown };
    const today = typeof body.today === "string" ? body.today : "";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      return NextResponse.json(
        { error: "A valid local date is required." },
        { status: 400, headers }
      );
    }

    const db = getFirebaseAdminFirestore();
    const snapshot = await db
      .collection("reflectionPosts")
      .where("userId", "==", token.uid)
      .get();

    const posts: ReflectionPost[] = snapshot.docs.flatMap((document) => {
      const data = document.data();
      if (!isFiatCategory(data.fiatCategory)) return [];

      const createdAt = asIso(data.createdAt);
      if (!createdAt) return [];

      return [{
        id: document.id,
        userId: token.uid,
        content: "",
        isPrivate: data.isPrivate === true,
        createdAt,
        updatedAt: asIso(data.updatedAt) || createdAt,
        fiatCategory: data.fiatCategory,
        ...(typeof data.fiatDateKey === "string"
          ? { fiatDateKey: data.fiatDateKey }
          : {})
      }];
    });

    const loss = findLatestFiatStreakLoss(posts, today);
    if (!loss) {
      return NextResponse.json({ created: false, loss: null }, { headers });
    }

    const notificationId = `fiat-streak-lost_${token.uid}_${loss.lostDate}`;
    const notificationRef = db.collection("systemNotifications").doc(notificationId);
    const existing = await notificationRef.get();

    if (!existing.exists) {
      await notificationRef.set({
        id: notificationId,
        userId: token.uid,
        type: "fiat_streak_lost",
        title: "FiAt streak lost",
        message: `Your ${loss.previousStreak}-day FiAt streak ended on ${formatLossDate(loss.lostDate)} after both freeze days were used. Your next FiAt starts a new streak.`,
        missingFields: [],
        fiatLostDate: loss.lostDate,
        previousStreak: loss.previousStreak,
        createdByAdminId: "saintagram-system",
        createdAt: new Date().toISOString(),
        readAt: null
      });
    }

    return NextResponse.json(
      {
        created: !existing.exists,
        loss
      },
      { headers }
    );
  } catch (error) {
    console.error("FiAt streak notification sync failed.", error);
    return NextResponse.json(
      { error: "FiAt streak status could not be synchronized." },
      { status: 500, headers }
    );
  }
}
