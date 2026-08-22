import "server-only";

import {
  Timestamp,
  type DocumentData,
  type Firestore
} from "firebase-admin/firestore";

import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import type {
  BulletinItem,
  BulletinItemType
} from "@/types";

const TITLE_LIMIT = 100;
const DESCRIPTION_LIMIT = 280;
const LOCATION_LIMIT = 120;
const LINK_LIMIT = 600;
const BULLETIN_IMAGE_PATH = /^bulletins\/[A-Za-z0-9_-]{1,128}\/[0-9a-f-]+\.(?:jpg|png|webp)$/i;

export interface AdminBulletinInput {
  type?: unknown;
  title?: unknown;
  description?: unknown;
  eventAt?: unknown;
  location?: unknown;
  linkUrl?: unknown;
  imagePath?: unknown;
  expiresAt?: unknown;
  pinned?: unknown;
}

function normalizedText(
  value: unknown,
  maximumLength: number
): string {
  return typeof value === "string"
    ? value
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maximumLength)
    : "";
}

function normalizedType(
  value: unknown
): BulletinItemType {
  if (
    value === "announcement" ||
    value === "event"
  ) {
    return value;
  }

  throw new Error(
    "BULLETIN_INVALID_TYPE"
  );
}

function storedType(
  value: unknown
): BulletinItemType {
  return value === "event"
    ? "event"
    : "announcement";
}

function normalizedDate(
  value: unknown
): Date | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(
      "BULLETIN_INVALID_DATE"
    );
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "BULLETIN_INVALID_DATE"
    );
  }

  return date;
}

function normalizedUrl(
  value: unknown
): string {
  const url = normalizedText(
    value,
    LINK_LIMIT
  );

  if (!url) {
    return "";
  }

  try {
    const parsed =
      new URL(url);

    if (
      parsed.protocol !== "https:" &&
      parsed.protocol !== "http:"
    ) {
      throw new Error(
        "BULLETIN_INVALID_URL"
      );
    }

    return parsed.toString();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "BULLETIN_INVALID_URL"
    ) {
      throw error;
    }

    throw new Error(
      "BULLETIN_INVALID_URL"
    );
  }
}

/**
 * Converts values coming from either:
 *
 * 1. the normal Firebase Admin SDK, where timestamps
 *    may be Timestamp instances, or
 *
 * 2. Saintagram's Firestore REST adapter, where
 *    timestampValue is decoded to an ISO string.
 */
function normalizedImagePath(value: unknown): string {
  const path = normalizedText(value, 300);
  if (path && !BULLETIN_IMAGE_PATH.test(path)) throw new Error("BULLETIN_INVALID_IMAGE");
  return path;
}

function timestampIso(
  value: unknown
): string | null {
  if (
    value instanceof Timestamp
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (
    value instanceof Date
  ) {
    return value.toISOString();
  }

  if (
    typeof value === "string"
  ) {
    const date =
      new Date(value);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date.toISOString();
  }

  /*
   * Defensive support for an older malformed timestamp
   * that may have been stored as a map containing
   * seconds/nanoseconds.
   */
  if (
    value &&
    typeof value === "object"
  ) {
    const record =
      value as Record<
        string,
        unknown
      >;

    const seconds =
      typeof record.seconds ===
      "number"
        ? record.seconds
        : typeof record._seconds ===
            "number"
          ? record._seconds
          : null;

    const nanoseconds =
      typeof record.nanoseconds ===
      "number"
        ? record.nanoseconds
        : typeof record._nanoseconds ===
            "number"
          ? record._nanoseconds
          : 0;

    if (seconds !== null) {
      return new Date(
        seconds * 1000 +
          nanoseconds /
            1_000_000
      ).toISOString();
    }
  }

  return null;
}

function storedBulletin(
  id: string,
  data: DocumentData
): BulletinItem {
  return {
    id,

    type:
      storedType(
        data.type
      ),

    title:
      String(
        data.title ?? ""
      ),

    description:
      String(
        data.description ?? ""
      ),

    eventAt:
      timestampIso(
        data.eventAt
      ),

    location:
      String(
        data.location ?? ""
      ),

    linkUrl:
      String(
        data.linkUrl ?? ""
      ),

    imagePath: String(data.imagePath ?? ""),

    expiresAt:
      timestampIso(
        data.expiresAt
      ),

    pinned:
      data.pinned === true,

    createdAt:
      timestampIso(
        data.createdAt
      ) ?? "",

    updatedAt:
      timestampIso(
        data.updatedAt
      ) ?? ""
  };
}

function normalizedInput(
  input: AdminBulletinInput
) {
  const type =
    normalizedType(
      input.type
    );

  const title =
    normalizedText(
      input.title,
      TITLE_LIMIT
    );

  const description =
    normalizedText(
      input.description,
      DESCRIPTION_LIMIT
    );

  const eventAt =
    normalizedDate(
      input.eventAt
    );

  const expiresAt =
    normalizedDate(
      input.expiresAt
    );

  const location =
    normalizedText(
      input.location,
      LOCATION_LIMIT
    );

  const linkUrl =
    normalizedUrl(
      input.linkUrl
    );

  const imagePath = normalizedImagePath(input.imagePath);

  const pinned =
    input.pinned === true;

  if (!title) {
    throw new Error(
      "BULLETIN_TITLE_REQUIRED"
    );
  }

  if (
    type === "event" &&
    !eventAt
  ) {
    throw new Error(
      "BULLETIN_EVENT_DATE_REQUIRED"
    );
  }

  if (
    type ===
      "announcement" &&
    eventAt
  ) {
    throw new Error(
      "BULLETIN_ANNOUNCEMENT_HAS_EVENT_DATE"
    );
  }

  if (
    eventAt &&
    expiresAt &&
    expiresAt.getTime() <
      eventAt.getTime()
  ) {
    throw new Error(
      "BULLETIN_EXPIRY_BEFORE_EVENT"
    );
  }

  return {
    type,
    title,
    description,
    eventAt,
    location,
    linkUrl,
    imagePath,
    expiresAt,
    pinned
  };
}

/**
 * Lists Admin bulletin items.
 *
 * IMPORTANT:
 * Saintagram's server-side Firestore implementation
 * uses the custom REST adapter from firestore-rest.ts.
 *
 * That adapter currently supports .get(), .where(),
 * and .limit(), but not .orderBy().
 *
 * Therefore the documents are loaded first and sorted
 * locally, matching the approach already used by
 * Saintagram's other Admin services.
 */
export async function listAdminBulletins(
  db: Firestore =
    getFirebaseAdminFirestore()
): Promise<BulletinItem[]> {
  const snapshot =
    await db
      .collection(
        "bulletins"
      )
      .get();

  return snapshot.docs
    .map(
      (document) =>
        storedBulletin(
          document.id,
          document.data()
        )
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(
          a.createdAt
        )
    );
}

export async function createAdminBulletin(
  input: AdminBulletinInput,
  db: Firestore =
    getFirebaseAdminFirestore()
): Promise<BulletinItem> {
  const normalized =
    normalizedInput(input);

  const reference =
    db
      .collection(
        "bulletins"
      )
      .doc();

  /*
   * Use native Date objects instead of Firebase Timestamp
   * objects here.
   *
   * Saintagram's Firestore REST adapter explicitly knows
   * how to encode Date as Firestore timestampValue.
   */
  const now =
    new Date();

  await reference.set({
    id: reference.id,

    type:
      normalized.type,

    title:
      normalized.title,

    description:
      normalized.description,

    eventAt:
      normalized.eventAt,

    location:
      normalized.location,

    linkUrl:
      normalized.linkUrl,

    imagePath:
      normalized.imagePath,

    expiresAt:
      normalized.expiresAt,

    pinned:
      normalized.pinned,

    createdAt:
      now,

    updatedAt:
      now
  });

  return {
    id: reference.id,

    type:
      normalized.type,

    title:
      normalized.title,

    description:
      normalized.description,

    eventAt:
      normalized.eventAt
        ?.toISOString() ??
      null,

    location:
      normalized.location,

    linkUrl:
      normalized.linkUrl,

    imagePath:
      normalized.imagePath,

    expiresAt:
      normalized.expiresAt
        ?.toISOString() ??
      null,

    pinned:
      normalized.pinned,

    createdAt:
      now.toISOString(),

    updatedAt:
      now.toISOString()
  };
}

export async function updateAdminBulletin(
  bulletinId: string,
  input: AdminBulletinInput,
  db: Firestore =
    getFirebaseAdminFirestore()
): Promise<BulletinItem> {
  const reference =
    db
      .collection(
        "bulletins"
      )
      .doc(
        bulletinId
      );

  const snapshot =
    await reference.get();

  if (!snapshot.exists) {
    throw new Error(
      "BULLETIN_NOT_FOUND"
    );
  }

  const normalized =
    normalizedInput(input);

  const updatedAt =
    new Date();

  /*
   * Preserve the original creation timestamp.
   *
   * With Saintagram's REST adapter, snapshot.get("createdAt")
   * normally returns an ISO string rather than a Firebase
   * Timestamp object.
   */
  const createdAt =
    timestampIso(
      snapshot.get(
        "createdAt"
      )
    ) ??
    updatedAt.toISOString();

  await reference.update({
    type:
      normalized.type,

    title:
      normalized.title,

    description:
      normalized.description,

    eventAt:
      normalized.eventAt,

    location:
      normalized.location,

    linkUrl:
      normalized.linkUrl,

    imagePath:
      normalized.imagePath,

    expiresAt:
      normalized.expiresAt,

    pinned:
      normalized.pinned,

    updatedAt
  });

  return {
    id: bulletinId,

    type:
      normalized.type,

    title:
      normalized.title,

    description:
      normalized.description,

    eventAt:
      normalized.eventAt
        ?.toISOString() ??
      null,

    location:
      normalized.location,

    linkUrl:
      normalized.linkUrl,

    imagePath:
      normalized.imagePath,

    expiresAt:
      normalized.expiresAt
        ?.toISOString() ??
      null,

    pinned:
      normalized.pinned,

    createdAt,

    updatedAt:
      updatedAt.toISOString()
  };
}

export async function deleteAdminBulletin(
  bulletinId: string,
  db: Firestore =
    getFirebaseAdminFirestore()
): Promise<void> {
  const reference =
    db
      .collection(
        "bulletins"
      )
      .doc(
        bulletinId
      );

  const snapshot =
    await reference.get();

  if (!snapshot.exists) {
    throw new Error(
      "BULLETIN_NOT_FOUND"
    );
  }

  await reference.delete();
}
