"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseServices } from "@/lib/firebase";

function captureDeviceLocation(): Promise<void> {
  if (!("geolocation" in navigator)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void fetch("/api/open-events/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
        }).finally(resolve);
      },
      () => resolve(),
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 0
      }
    );
  });
}

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function claimPendingOpen(): Promise<void> {
  const authUser = getFirebaseServices()?.auth.currentUser;

  if (!authUser) {
    return;
  }

  // A transient Worker/network problem should not permanently leave an event
  // unidentified. Retry server failures, but do not loop on a real 4xx result.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const token = await authUser.getIdToken(attempt > 0);
      const response = await fetch("/api/open-events/claim", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        cache: "no-store"
      });

      if (response.ok) {
        return;
      }

      if (response.status < 500) {
        return;
      }
    } catch {
      // Retry below.
    }

    if (attempt < 2) {
      await wait(500 * (attempt + 1));
    }
  }
}

export function OpenEventProvider({
  children
}: {
  children: ReactNode;
}) {
  const { user, loading, mode } = useAuth();
  const locationCapture = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let active = true;

    locationCapture.current ??= captureDeviceLocation();

    void locationCapture.current
      .then(async () => {
        if (!active || loading || !user || mode !== "firebase") {
          return;
        }

        await claimPendingOpen();
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [loading, user?.id, mode]);

  return children;
}
