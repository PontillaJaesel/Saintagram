import "server-only";
import { FieldValue, Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { computeAdminProfileCompletion } from "@/lib/admin-profile-completion";
import { ANONYMOUS_VISIT_WINDOW_SECONDS } from "@/lib/link-tracking";
import type { AdminDashboardOverview, AdminUserData, AdminUserSummary, LinkOpenEvent, SystemNotification } from "@/types";

export const ADMIN_COLLECTIONS=["users","profiles","privateProfiles","drafts","reflectionPosts","socialProfiles","follows","reflectionLikes","reflectionComments","notifications","systemNotifications","passwordResetRequests","profileImageHistory","profileJourneyEvents","linkOpenEvents"] as const;
export function jsonValue(value:unknown):unknown { if(value instanceof Timestamp)return value.toDate().toISOString(); if(Array.isArray(value))return value.map(jsonValue); if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,jsonValue(v)])); return value; }
const records=(snapshot:FirebaseFirestore.QuerySnapshot)=>snapshot.docs.map(doc=>jsonValue({id:doc.id,...doc.data()}) as Record<string,unknown>);
const str=(value:unknown)=>typeof value==="string"?value:"";
export async function loadAdminUsers(
  db: Firestore = getFirebaseAdminFirestore()
): Promise<AdminUserSummary[]> {
  const [users, profiles, drafts, posts, opens] = await Promise.all(
    ["users", "profiles", "drafts", "reflectionPosts", "linkOpenEvents"].map(
      (name) => db.collection(name).get()
    )
  );

  const byId = (snapshot: FirebaseFirestore.QuerySnapshot) =>
    new Map(snapshot.docs.map((document) => [document.id, document.data()]));

  const profileMap = byId(profiles);
  const draftMap = byId(drafts);
  const postUsers = new Set(posts.docs.map((document) => str(document.get("userId"))));
  const lastOpen = new Map<string, string>();

  for (const document of opens.docs) {
    const uid = str(document.get("userId"));
    const time = jsonValue(document.get("openedAt")) as string;
    if (uid && time && (!lastOpen.get(uid) || time > lastOpen.get(uid)!)) {
      lastOpen.set(uid, time);
    }
  }

  return users.docs
    .map((document) => {
      const data = document.data();
      const profile = profileMap.get(document.id) ?? null;
      const draft = draftMap.get(document.id) ?? null;
      const username = str(data.username);
      const fullName = str(data.fullName) || username || str(data.email) || "Unnamed user";
      const displayName =
        str(profile?.profileName) ||
        str((draft?.draftData as DocumentData | undefined)?.profileName);

      const storedRole = str(data.role).toLowerCase();
      const accountRole: AdminUserSummary["accountRole"] =
        storedRole === "tester"
          ? "tester"
          : storedRole === "app_admin" ||
              storedRole === "admin_user" ||
              storedRole === "admin"
            ? "app_admin"
            : "user";

      return {
        id: document.id,
        email: str(data.email),
        // Keep `name` for existing admin screens that expect one display label.
        name: displayName || fullName,
        fullName,
        displayName,
        username,
        accountRole,
        authProvider: str(data.authProvider) || "password",
        createdAt: str(jsonValue(data.createdAt)),
        profileCompleted: data.profileCompleted === true,
        completion: computeAdminProfileCompletion(
          profile,
          draft as { draftData?: never } | null,
          postUsers.has(document.id)
        ),
        lastLinkOpen: lastOpen.get(document.id) ?? null
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function locationRank(event: LinkOpenEvent): number {
  switch (event.locationSource) {
    case "device":
      return 3;
    case "localhost":
      return 2;
    case "cloudflare":
      return 1;
    default:
      return 0;
  }
}

function eventTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bestLocation(events: LinkOpenEvent[]): LinkOpenEvent {
  return [...events].sort((a, b) => {
    const rankDifference = locationRank(b) - locationRank(a);
    if (rankDifference) return rankDifference;

    // When two device readings exist, prefer the more accurate one.
    if (a.locationSource === "device" && b.locationSource === "device") {
      const aAccuracy = a.locationAccuracyMeters ?? Number.POSITIVE_INFINITY;
      const bAccuracy = b.locationAccuracyMeters ?? Number.POSITIVE_INFINITY;
      if (aAccuracy !== bAccuracy) return aAccuracy - bAccuracy;
    }

    // Otherwise prefer the most recently updated/opened member of the group.
    return eventTime(b.lastOpenedAt) - eventTime(a.lastOpenedAt);
  })[0];
}

function mergeLinkEventGroup(
  events: LinkOpenEvent[],
  userId: string | null
): LinkOpenEvent {
  const identity = userId
    ? events.find((event) => event.userId === userId) ?? events[0]
    : events.find((event) => !event.userId) ?? events[0];
  const location = bestLocation(events);
  const earliest = [...events].sort(
    (a, b) => eventTime(a.openedAt) - eventTime(b.openedAt)
  )[0];
  const latest = [...events].sort(
    (a, b) => eventTime(b.lastOpenedAt) - eventTime(a.lastOpenedAt)
  )[0];
  const claimed = events
    .map((event) => event.claimedAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? identity.claimedAt;

  return {
    ...identity,
    userId,
    openedAt: earliest.openedAt,
    lastOpenedAt: latest.lastOpenedAt,
    openCount: events.reduce(
      (total, event) => total + Math.max(1, event.openCount || 1),
      0
    ),
    claimedAt: claimed,
    streetAddress: location.streetAddress,
    city: location.city,
    region: location.region,
    country: location.country,
    postalCode: location.postalCode,
    formattedAddress: location.formattedAddress,
    latitude: location.latitude,
    longitude: location.longitude,
    locationAccuracyMeters: location.locationAccuracyMeters,
    locationLabel: location.locationLabel,
    locationSource: location.locationSource,
    // Anonymous rows intentionally have no user/profile labels. Identified rows
    // inherit these from the claimed event's account lookup.
    userName: userId ? identity.userName : undefined,
    userFullName: userId ? identity.userFullName : undefined,
    userDisplayName: userId ? identity.userDisplayName : undefined,
    username: userId ? identity.username : undefined
  };
}

export async function loadLinkEvents(
  db: Firestore = getFirebaseAdminFirestore()
): Promise<LinkOpenEvent[]> {
  const [events, users] = await Promise.all([
    db.collection("linkOpenEvents").get(),
    loadAdminUsers(db)
  ]);

  const usersById = new Map(users.map((user) => [user.id, user]));

  return records(events)
    .map((row) => {
      const userId = typeof row.userId === "string" ? row.userId : null;
      const user = userId ? usersById.get(userId) : undefined;
      const openedAt = str(row.openedAt);
      const lastOpenedAt = str(row.lastOpenedAt) || openedAt;
      const rawOpenCount = Number(row.openCount);

      return {
        ...row,
        visitId: str(row.visitId) || str(row.id),
        id: str(row.id),
        trackingVersion:
          Number.isFinite(Number(row.trackingVersion))
            ? Number(row.trackingVersion)
            : 1,
        source: row.source === "qr" ? "qr" : "common",
        campaign: typeof row.campaign === "string" ? row.campaign : null,
        openedAt,
        lastOpenedAt,
        openCount:
          Number.isFinite(rawOpenCount) && rawOpenCount > 0
            ? Math.floor(rawOpenCount)
            : 1,
        userId,
        visitStatus: userId ? "logged_in" : "awaiting_login",
        claimedAt: typeof row.claimedAt === "string" ? row.claimedAt : null,
        streetAddress: str(row.streetAddress) || null,
        city: str(row.city) || null,
        region: str(row.region) || null,
        country: str(row.country) || null,
        postalCode: str(row.postalCode) || null,
        formattedAddress: str(row.formattedAddress) || null,
        latitude: str(row.latitude) || null,
        longitude: str(row.longitude) || null,
        locationAccuracyMeters:
          typeof row.locationAccuracyMeters === "number"
            ? row.locationAccuracyMeters
            : null,
        locationLabel:
          str(row.formattedAddress) ||
          str(row.locationLabel) ||
          "Location unavailable",
        locationSource:
          row.locationSource === "device"
            ? "device"
            : row.locationSource === "cloudflare"
              ? "cloudflare"
              : row.locationSource === "localhost"
                ? "localhost"
                : "unavailable",
        destination: str(row.destination) || "/",
        userName: user?.name,
        userFullName: user?.fullName,
        userDisplayName: user?.displayName,
        username: user?.username
      } as LinkOpenEvent;
    })
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

/**
 * Full admin Link History.
 *
 * New tracking uses one Firestore document for repeated, unclaimed opens from
 * the same browser/source for 30 minutes. Older app versions sometimes wrote
 * several documents for one open. The small legacy burst window below only
 * repairs those historical duplicates; it is not used to identify a person.
 *
 * Rules:
 * - no login => keep one anonymous row (with its best available GPS location)
 * - one account claims a burst => show the account and keep the best GPS data
 * - multiple accounts in a burst => never guess which anonymous rows belong to
 *   which person; keep each known account plus one anonymous remainder
 */
export async function loadAdminLinkEvents(
  db: Firestore = getFirebaseAdminFirestore()
): Promise<LinkOpenEvent[]> {
  const raw = [...(await loadLinkEvents(db))].sort(
    (a, b) => eventTime(a.openedAt) - eventTime(b.openedAt)
  );
  const legacyBurstWindowMs = 15_000;
  const groups = new Map<
    string,
    { lastTime: number; events: LinkOpenEvent[] }[]
  >();

  for (const event of raw) {
    if (event.trackingVersion >= 2) continue;

    const key = [
      event.source,
      event.campaign ?? "",
      event.destination
    ].join("|");
    const time = eventTime(event.openedAt);
    const keyGroups = groups.get(key) ?? [];
    const current = keyGroups[keyGroups.length - 1];

    if (current && time - current.lastTime <= legacyBurstWindowMs) {
      current.events.push(event);
      current.lastTime = Math.max(current.lastTime, eventTime(event.lastOpenedAt));
    } else {
      keyGroups.push({
        lastTime: Math.max(time, eventTime(event.lastOpenedAt)),
        events: [event]
      });
      groups.set(key, keyGroups);
    }
  }

  // Version 2 records already represent one browser visit and must never be
  // heuristically combined with another row. Only legacy records enter the
  // burst-recovery logic below.
  const result: LinkOpenEvent[] = raw.filter(
    (event) => event.trackingVersion >= 2
  );

  for (const keyGroups of groups.values()) {
    for (const group of keyGroups) {
      const identifiedUserIds = [
        ...new Set(
          group.events
            .map((event) => event.userId)
            .filter((value): value is string => Boolean(value))
        )
      ];
      const anonymousEvents = group.events.filter((event) => !event.userId);

      if (!identifiedUserIds.length) {
        result.push(mergeLinkEventGroup(group.events, null));
        continue;
      }

      if (identifiedUserIds.length === 1) {
        // A single known account in a short legacy burst is the only safe case
        // where old anonymous GPS data can be folded back into the claimed row.
        result.push(
          mergeLinkEventGroup(group.events, identifiedUserIds[0])
        );
        continue;
      }

      for (const userId of identifiedUserIds) {
        result.push(
          mergeLinkEventGroup(
            group.events.filter((event) => event.userId === userId),
            userId
          )
        );
      }

      if (anonymousEvents.length) {
        result.push(mergeLinkEventGroup(anonymousEvents, null));
      }
    }
  }

  const now = Date.now();
  const anonymousWindowMs = ANONYMOUS_VISIT_WINDOW_SECONDS * 1000;

  return result
    .map((event): LinkOpenEvent => ({
      ...event,
      visitStatus: event.userId
        ? "logged_in"
        : now - eventTime(event.lastOpenedAt) >= anonymousWindowMs
          ? "did_not_login"
          : "awaiting_login"
    }))
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

// Backward-compatible alias for any older imports while the admin page migrates
// to the clearer loadAdminLinkEvents name.
export const loadIdentifiedLinkEvents = loadAdminLinkEvents;
export async function loadReminders(db:Firestore=getFirebaseAdminFirestore()):Promise<SystemNotification[]> {
  const snapshot = await db.collection("systemNotifications").get();
  return records(snapshot)
    .map((row): SystemNotification => ({
      id: str(row.id),
      userId: str(row.userId),
      type: row.type === "admin_reflection" ? "admin_reflection" : "profile_reminder",
      title: str(row.title) || "Saintagram notification",
      message: str(row.message),
      missingFields: Array.isArray(row.missingFields)
        ? row.missingFields.filter((value): value is string => typeof value === "string")
        : [],
      ...(typeof row.reflectionId === "string" ? { reflectionId: row.reflectionId } : {}),
      createdByAdminId: str(row.createdByAdminId),
      createdAt: str(row.createdAt),
      readAt: typeof row.readAt === "string" ? row.readAt : null
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function loadOverview(): Promise<AdminDashboardOverview> {
  const [users, events, reminders] = await Promise.all([
    loadAdminUsers(),
    loadAdminLinkEvents(),
    loadReminders()
  ]);
  const qrVisits = events.filter((event) => event.source === "qr").length;
  const commonVisits = events.filter((event) => event.source === "common").length;

  return {
    totalUsers: users.length,
    completeProfiles: users.filter((user) => user.completion.status === "Complete").length,
    incompleteProfiles: users.filter((user) => user.completion.status !== "Complete").length,
    totalVisits: events.length,
    qrVisits,
    commonVisits,
    qrOpensToday: qrVisits,
    commonOpensToday: commonVisits,
    recentActivity: events.slice(0, 8),
    recentUsers: users.slice(0, 8),
    recentReminders: reminders.slice(0, 8)
  };
}
export async function loadUserData(userId:string, auditAdminId?:string):Promise<AdminUserData>{const db=getFirebaseAdminFirestore();const [user,profile,privateProfile,draft,...sets]=await Promise.all([db.collection("users").doc(userId).get(),db.collection("profiles").doc(userId).get(),db.collection("privateProfiles").doc(userId).get(),db.collection("drafts").doc(userId).get(),...ADMIN_COLLECTIONS.slice(4).map(name=>db.collection(name).get())]);if(!user.exists)throw new Error("USER_NOT_FOUND");const collections:Record<string,Record<string,unknown>[]>= {}; ADMIN_COLLECTIONS.slice(4).forEach((name,index)=>{collections[name]=records(sets[index]).filter(row=>Object.values(row).includes(userId));});if(auditAdminId)await writeAudit(auditAdminId,"user_data_viewed",userId,{});return{user:jsonValue({id:user.id,...user.data()}) as Record<string,unknown>,profile:profile.exists?jsonValue(profile.data()) as Record<string,unknown>:null,privateProfile:privateProfile.exists?jsonValue(privateProfile.data()) as Record<string,unknown>:null,draft:draft.exists?jsonValue(draft.data()) as Record<string,unknown>:null,collections};}
export async function writeAudit(adminId:string,action:"profile_reminder_sent"|"notification_resent"|"user_data_viewed"|"export_generated"|"admin_reflection_published"|"admin_reflection_updated"|"admin_reflection_deleted",targetUserId:string|null,metadata:Record<string,unknown>){const ref=getFirebaseAdminFirestore().collection("adminAuditLogs").doc();await ref.set({id:ref.id,adminId,action,targetUserId,createdAt:FieldValue.serverTimestamp(),metadata});return ref.id;}
