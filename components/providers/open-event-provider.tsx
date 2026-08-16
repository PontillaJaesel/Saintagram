"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseServices } from "@/lib/firebase";

function captureDeviceLocation(): Promise<void> {
  if (!("geolocation" in navigator)) return Promise.resolve();
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void fetch("/api/open-events/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }) }).finally(resolve);
      },
      () => resolve(),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export function OpenEventProvider({ children }: { children: ReactNode }) {
  const { user, loading, mode } = useAuth();
  const locationCapture = useRef<Promise<void> | null>(null);
  useEffect(() => {
    let active = true;
    locationCapture.current ??= captureDeviceLocation();
    void locationCapture.current.then(async () => {
      if (!active || loading || !user || mode !== "firebase") return;
      const current = getFirebaseServices()?.auth.currentUser;
      if (!current) return;
      const token = await current.getIdToken();
      if (active) await fetch("/api/open-events/claim", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [loading, user?.id, mode]);
  return children;
}
