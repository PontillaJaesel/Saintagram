import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { normalizeDraft, toPublicProfile } from "@/lib/profile";
import type { ProfileDraftData, SpiritualProfile } from "@/types";

export const runtime = "nodejs";
const reply = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return reply({ error: "Authentication is required." }, 401);
    const token = await getFirebaseAdminAuth().verifyIdToken(authorization.slice(7), true);
    const body = await request.json() as { profile?: ProfileDraftData };
    if (!body.profile) return reply({ error: "Profile details are required." }, 400);
    const data = normalizeDraft(body.profile);
    // The current profile wizard has two required steps: a display name and
    // either an owned photo or a spiritual symbol. The remaining profile
    // fields are optional and can be completed later from profile editing.
    const complete = Boolean(
      data.profileName && (data.imagePath || data.selectedSymbol)
    );
    const ownedImage = !data.imagePath || data.imagePath.startsWith(`users/${token.uid}/profile/`);
    if (!complete || !ownedImage || (data.imagePath && data.selectedSymbol)) return reply({ error: "Complete the required profile details before continuing." }, 400);

    const db = getFirebaseAdminFirestore(), now = new Date().toISOString();
    const profileRef = db.collection("profiles").doc(token.uid), userRef = db.collection("users").doc(token.uid);
    const [existing, userSnapshot] = await Promise.all([profileRef.get(), userRef.get()]);
    if (!userSnapshot.exists) return reply({ error: "Your account record could not be found." }, 404);
    const profile: SpiritualProfile = {
      id: token.uid, userId: token.uid, profileName: data.profileName,
      imagePath: data.imagePath, selectedSymbol: data.selectedSymbol,
      spiritualBio: data.spiritualBio, spiritualGuides: data.spiritualGuides,
      lifeDirections: data.lifeDirections, heartSeeks: data.heartSeeks,
      godsComment: data.godsComment, heavenlyHashtag: data.heavenlyHashtag,
      hiddenStory: data.hiddenStory,
      createdAt: existing.exists ? String(existing.get("createdAt") ?? now) : now,
      updatedAt: now
    };
    const batch = db.batch();
    batch.set(profileRef, toPublicProfile(profile));
    batch.set(db.collection("privateProfiles").doc(token.uid), { userId: token.uid, hiddenStory: data.hiddenStory, updatedAt: now });
    batch.set(db.collection("socialProfiles").doc(token.uid), { id: token.uid, userId: token.uid, profileName: data.profileName, imagePath: data.imagePath, spiritualBio: data.spiritualBio, heavenlyHashtag: data.heavenlyHashtag, createdAt: profile.createdAt, updatedAt: now });
    batch.update(userRef, { profileCompleted: true, updatedAt: now });
    batch.delete(db.collection("drafts").doc(token.uid));
    data.onboardingPosts.forEach((content, index) => {
      const ref = db.collection("reflectionPosts").doc();
      batch.set(ref, { id: ref.id, userId: token.uid, title: data.onboardingPostTitles?.[index] || `Moment ${index + 1}`, content, isPrivate: false, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    });
    await batch.commit();
    return reply({ profile }, 200);
  } catch (error) {
    console.error("Profile completion failed.", error);
    return reply({ error: "Your profile could not be created. Please sign in again and retry." }, 500);
  }
}
