"use client";

import {
  Timestamp,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  type DocumentData
} from "firebase/firestore";

import { getFirebaseServices } from "@/lib/firebase";
import type { BulletinItem, BulletinItemType } from "@/types";

const BULLETIN_READ_LIMIT = 60;

function timestampIso(value: unknown): string | null {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

function bulletinType(value: unknown): BulletinItemType {
  return value === "event" ? "event" : "announcement";
}

function storedBulletin(id: string, data: DocumentData): BulletinItem {
  return {
    id,
    type: bulletinType(data.type),
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : "",
    eventAt: timestampIso(data.eventAt),
    location: typeof data.location === "string" ? data.location : "",
    linkUrl: typeof data.linkUrl === "string" ? data.linkUrl : "",
    expiresAt: timestampIso(data.expiresAt),
    pinned: data.pinned === true,
    createdAt: timestampIso(data.createdAt) ?? "",
    updatedAt: timestampIso(data.updatedAt) ?? ""
  };
}

export async function getPublicBulletins(): Promise<BulletinItem[]> {
  const services = getFirebaseServices();

  if (!services) {
    throw new Error("Bulletins are unavailable because Firebase is not configured.");
  }

  const snapshot = await getDocs(
    query(
      collection(services.db, "bulletins"),
      orderBy("createdAt", "desc"),
      limit(BULLETIN_READ_LIMIT)
    )
  );

  const now = Date.now();

  return snapshot.docs
    .map((document) => storedBulletin(document.id, document.data()))
    .filter((item) => {
      if (!item.title) return false;
      if (!item.expiresAt) return true;
      const expiry = new Date(item.expiresAt).getTime();
      return Number.isNaN(expiry) || expiry > now;
    })
    .sort((left, right) => {
      if (left.pinned !== right.pinned) {
        return left.pinned ? -1 : 1;
      }

      return right.createdAt.localeCompare(left.createdAt);
    });
}