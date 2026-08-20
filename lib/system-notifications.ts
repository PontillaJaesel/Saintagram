"use client";

import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe
} from "firebase/firestore";

import { getFirebaseServices } from "@/lib/firebase";
import type { SystemNotification } from "@/types";

function iso(value: unknown): string {
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

function notificationType(value: unknown): SystemNotification["type"] {
  if (value === "admin_reflection" || value === "fiat_streak_lost") {
    return value;
  }
  return "profile_reminder";
}

export function subscribeSystemNotifications(
  userId: string,
  onData: (items: SystemNotification[]) => void,
  onError: (message: string) => void
): Unsubscribe {
  const services = getFirebaseServices();
  if (!services) return () => undefined;

  return onSnapshot(
    query(
      collection(services.db, "systemNotifications"),
      where("userId", "==", userId)
    ),
    (snapshot) => {
      onData(
        snapshot.docs
          .map((document) => {
            const data = document.data();
            return {
              id: document.id,
              userId: String(data.userId),
              type: notificationType(data.type),
              title: String(data.title ?? "Saintagram notification"),
              message: String(data.message ?? ""),
              missingFields: Array.isArray(data.missingFields)
                ? data.missingFields.filter((value): value is string => typeof value === "string")
                : [],
              ...(typeof data.reflectionId === "string"
                ? { reflectionId: data.reflectionId }
                : {}),
              ...(typeof data.fiatLostDate === "string"
                ? { fiatLostDate: data.fiatLostDate }
                : {}),
              ...(typeof data.previousStreak === "number"
                ? { previousStreak: data.previousStreak }
                : {}),
              createdByAdminId: String(data.createdByAdminId ?? ""),
              createdAt: iso(data.createdAt),
              readAt: data.readAt ? iso(data.readAt) : null
            } satisfies SystemNotification;
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    },
    () => onError("System notifications could not be updated.")
  );
}

export async function markSystemNotificationRead(id: string) {
  const services = getFirebaseServices();
  if (!services) throw new Error("Firebase is not configured.");

  await updateDoc(doc(services.db, "systemNotifications", id), {
    readAt: serverTimestamp()
  });
}
