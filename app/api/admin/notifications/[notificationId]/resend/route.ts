import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminError, noStoreHeaders, requireAdmin } from "@/lib/admin-auth";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { writeAudit } from "@/lib/admin-data";

export async function POST(request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  try {
    const admin = await requireAdmin(request);
    const { notificationId } = await params;
    const db = getFirebaseAdminFirestore();
    const original = await db.collection("systemNotifications").doc(notificationId).get();
    if (!original.exists) return NextResponse.json({ error: "Notification not found." }, { status: 404, headers: noStoreHeaders });
    const notification = original.data()!;
    if (notification.readAt) return NextResponse.json({ error: "This notification has already been read." }, { status: 409, headers: noStoreHeaders });
    const ref = db.collection("systemNotifications").doc();
    await ref.set({ id: ref.id, userId: notification.userId, type: notification.type, title: notification.title, message: notification.message, missingFields: Array.isArray(notification.missingFields) ? notification.missingFields : [], ...(typeof notification.reflectionId === "string" ? { reflectionId: notification.reflectionId } : {}), createdByAdminId: admin.uid, createdAt: FieldValue.serverTimestamp(), readAt: null, resentFromNotificationId: notificationId });
    await writeAudit(admin.uid, "notification_resent", String(notification.userId ?? ""), { notificationId: ref.id, resentFromNotificationId: notificationId });
    return NextResponse.json({ sent: true, id: ref.id }, { headers: noStoreHeaders });
  } catch (error) { return adminError(error); }
}
