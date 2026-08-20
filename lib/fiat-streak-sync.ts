"use client";

import { getFirebaseServices } from "@/lib/firebase";
import { localDateKey } from "@/lib/fiat";

let currentRequest: Promise<void> | null = null;

export async function syncFiatStreakLossNotification(): Promise<void> {
  const services = getFirebaseServices();
  const firebaseUser = services?.auth.currentUser;

  if (!services || !firebaseUser || !firebaseUser.emailVerified) {
    return;
  }

  if (currentRequest) {
    return currentRequest;
  }

  currentRequest = (async () => {
    const token = await firebaseUser.getIdToken(true);
    const response = await fetch("/api/fiat/streak/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ today: localDateKey() }),
      cache: "no-store",
      credentials: "same-origin"
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(result.error ?? "FiAt streak status could not be synchronized.");
    }
  })();

  try {
    await currentRequest;
  } finally {
    currentRequest = null;
  }
}
