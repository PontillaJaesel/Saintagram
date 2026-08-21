"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseServices } from "@/lib/firebase";
import {
  OPEN_EVENT_ID_PARAM,
  OPEN_EVENT_TOKEN_PARAM,
  validOpenEventClientTarget,
  type OpenEventClientTarget
} from "@/lib/link-tracking-shared";

const LOCATION_ATTEMPTS = 3;
const LOCATION_TIMEOUT_MS = 15_000;
const TARGET_ACCURACY_METERS = 25;

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function readTrackedTargetFromUrl(): OpenEventClientTarget | null {
  const url = new URL(window.location.href);
  return validOpenEventClientTarget(
    url.searchParams.get(OPEN_EVENT_ID_PARAM),
    url.searchParams.get(OPEN_EVENT_TOKEN_PARAM)
  );
}

function removeTrackedTargetFromVisibleUrl(): void {
  const url = new URL(window.location.href);
  const hadEvent = url.searchParams.has(OPEN_EVENT_ID_PARAM);
  const hadToken = url.searchParams.has(OPEN_EVENT_TOKEN_PARAM);

  if (!hadEvent && !hadToken) {
    return;
  }

  url.searchParams.delete(OPEN_EVENT_ID_PARAM);
  url.searchParams.delete(OPEN_EVENT_TOKEN_PARAM);
  const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", cleanUrl);
}

function requestHighAccuracyPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: LOCATION_TIMEOUT_MS,
      maximumAge: 0
    });
  });
}

async function saveDeviceLocation(
  position: GeolocationPosition,
  complete: boolean,
  target: OpenEventClientTarget | null
): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch("/api/open-events/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          complete,
          ...(target ?? {})
        })
      });

      if (response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          updated?: boolean;
          keptMoreAccurate?: boolean;
        };

        return result.updated === true || result.keptMoreAccurate === true;
      }

      if (response.status < 500) {
        return false;
      }
    } catch {
      // Retry transient network failures below.
    }

    if (attempt < 2) {
      await wait(500 * (attempt + 1));
    }
  }

  return false;
}

async function captureDeviceLocation(
  target: OpenEventClientTarget | null
): Promise<boolean> {
  if (!("geolocation" in navigator)) {
    return false;
  }

  let bestPosition: GeolocationPosition | null = null;
  let savedAnyPosition = false;
  let finalized = false;

  for (let attempt = 0; attempt < LOCATION_ATTEMPTS; attempt += 1) {
    try {
      const position = await requestHighAccuracyPosition();

      if (
        !bestPosition ||
        position.coords.accuracy < bestPosition.coords.accuracy
      ) {
        bestPosition = position;
      }

      const targetReached =
        bestPosition.coords.accuracy <= TARGET_ACCURACY_METERS;
      const isLastAttempt = attempt === LOCATION_ATTEMPTS - 1;
      const complete = targetReached || isLastAttempt;

      // Save the best reading immediately so the admin screen can move away
      // from Cloudflare's approximate location without waiting for all retries.
      // If it is still coarse, later attempts may improve the same visit.
      savedAnyPosition =
        (await saveDeviceLocation(bestPosition, complete, target)) ||
        savedAnyPosition;
      finalized = complete;

      if (targetReached) {
        return savedAnyPosition;
      }
    } catch (error) {
      const geolocationError = error as GeolocationPositionError;

      // Permission denial is not temporary. Retrying would only repeat the
      // same browser rejection and cannot improve the location.
      if (geolocationError?.code === 1) {
        break;
      }
    }

    if (attempt < LOCATION_ATTEMPTS - 1) {
      await wait(750 * (attempt + 1));
    }
  }

  // If a good-but-not-target reading was already stored and the final attempt
  // failed, mark the best saved reading complete so its targeting state can be
  // cleaned up without losing the coordinates we already captured.
  if (bestPosition && !finalized) {
    savedAnyPosition =
      (await saveDeviceLocation(bestPosition, true, target)) ||
      savedAnyPosition;
  }

  return savedAnyPosition;
}

async function claimPendingOpen(
  target: OpenEventClientTarget | null
): Promise<void> {
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
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify(target ?? {})
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
  const locationCapture = useRef<Promise<boolean> | null>(null);
  const [trackingState, setTrackingState] = useState<{
    ready: boolean;
    target: OpenEventClientTarget | null;
  }>({ ready: false, target: null });

  // Every tracked redirect carries a short-lived event id + opaque token in
  // addition to the compatibility cookies. Read them once, remove them from
  // the visible URL, then use that explicit target for GPS and login claiming.
  // This makes enrichment reliable even if a browser/redirect chain drops one
  // of the HttpOnly tracking cookies.
  useEffect(() => {
    const target = readTrackedTargetFromUrl();
    removeTrackedTargetFromVisibleUrl();
    setTrackingState({ ready: true, target });

    locationCapture.current = captureDeviceLocation(target);
    void locationCapture.current.catch(() => false);
  }, []);

  // Claim the visit as soon as Firebase authentication is ready. Do not wait
  // for GPS; identity and location update the same event independently.
  useEffect(() => {
    if (
      !trackingState.ready ||
      loading ||
      !user ||
      mode !== "firebase"
    ) {
      return;
    }

    void claimPendingOpen(trackingState.target).catch(() => undefined);
  }, [
    trackingState.ready,
    trackingState.target?.eventId,
    trackingState.target?.trackingToken,
    loading,
    user?.id,
    mode
  ]);

  return children;
}
