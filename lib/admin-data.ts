import "server-only";
import { FieldValue, Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { computeAdminProfileCompletion } from "@/lib/admin-profile-completion";
import type { AdminDashboardOverview, AdminUserData, AdminUserSummary, LinkOpenEvent, SystemNotification } from "@/types";

export const ADMIN_COLLECTIONS=["users","profiles","privateProfiles","drafts","reflectionPosts","socialProfiles","follows","reflectionLikes","reflectionComments","notifications","systemNotifications","passwordResetRequests","profileImageHistory","profileJourneyEvents","linkOpenEvents"] as const;
export function jsonValue(value:unknown):unknown { if(value instanceof Timestamp)return value.toDate().toISOString(); if(Array.isArray(value))return value.map(jsonValue); if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,jsonValue(v)])); return value; }
const records=(snapshot:FirebaseFirestore.QuerySnapshot)=>snapshot.docs.map(doc=>jsonValue({id:doc.id,...doc.data()}) as Record<string,unknown>);
const str=(value:unknown)=>typeof value==="string"?value:"";
export async function loadAdminUsers(db:Firestore=getFirebaseAdminFirestore()):Promise<AdminUserSummary[]> { const [users,profiles,drafts,posts,opens]=await Promise.all(["users","profiles","drafts","reflectionPosts","linkOpenEvents"].map(name=>db.collection(name).get())); const byId=(s:FirebaseFirestore.QuerySnapshot)=>new Map(s.docs.map(d=>[d.id,d.data()])); const profileMap=byId(profiles),draftMap=byId(drafts); const postUsers=new Set(posts.docs.map(d=>str(d.get("userId")))); const lastOpen=new Map<string,string>(); for(const d of opens.docs){const uid=str(d.get("userId"));const time=jsonValue(d.get("openedAt")) as string;if(uid&&time&&(!lastOpen.get(uid)||time>lastOpen.get(uid)!))lastOpen.set(uid,time);} return users.docs.map(doc=>{const data=doc.data(),profile=profileMap.get(doc.id)??null,draft=draftMap.get(doc.id)??null;return {id:doc.id,email:str(data.email),name:
  str(profile?.profileName) ||
  str(
    (draft?.draftData as DocumentData | undefined)
      ?.profileName
  ) ||
  str(data.fullName) ||
  str(data.username) ||
  str(data.email) ||
  "Unnamed user",authProvider:str(data.authProvider)||"password",createdAt:str(jsonValue(data.createdAt)),profileCompleted:data.profileCompleted===true,completion:computeAdminProfileCompletion(profile,draft as {draftData?:never}|null,postUsers.has(doc.id)),lastLinkOpen:lastOpen.get(doc.id)??null};}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)); }
export async function loadLinkEvents(db:Firestore=getFirebaseAdminFirestore()):Promise<LinkOpenEvent[]> { const [events,users]=await Promise.all([db.collection("linkOpenEvents").get(),loadAdminUsers(db)]);const names=new Map(users.map(u=>[u.id,u.name]));return records(events).map(row=>({...row,visitId:str(row.visitId)||str(row.id),id:str(row.id),source:row.source==="qr"?"qr":"common",campaign:typeof row.campaign==="string"?row.campaign:null,openedAt:str(row.openedAt),userId:typeof row.userId==="string"?row.userId:null,claimedAt:typeof row.claimedAt==="string"?row.claimedAt:null,streetAddress:str(row.streetAddress)||null,city:str(row.city)||null,region:str(row.region)||null,country:str(row.country)||null,postalCode:str(row.postalCode)||null,formattedAddress:str(row.formattedAddress)||null,latitude:str(row.latitude)||null,longitude:str(row.longitude)||null,locationAccuracyMeters:typeof row.locationAccuracyMeters==="number"?row.locationAccuracyMeters:null,locationLabel:str(row.formattedAddress)||str(row.locationLabel)||"Location unavailable",locationSource:row.locationSource==="device"?"device":row.locationSource==="cloudflare"?"cloudflare":row.locationSource==="localhost"?"localhost":"unavailable",destination:str(row.destination)||"/",userName:typeof row.userId==="string"?names.get(row.userId):undefined} as LinkOpenEvent)).sort((a,b)=>b.openedAt.localeCompare(a.openedAt)); }
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
export async function loadOverview():Promise<AdminDashboardOverview>{const [users,events,reminders]=await Promise.all([loadAdminUsers(),loadLinkEvents(),loadReminders()]);const qrVisits=events.filter(e=>e.source==="qr").length,commonVisits=events.filter(e=>e.source==="common").length;return{totalUsers:users.length,completeProfiles:users.filter(u=>u.completion.status==="Complete").length,incompleteProfiles:users.filter(u=>u.completion.status!=="Complete").length,totalVisits:events.length,qrVisits,commonVisits,qrOpensToday:qrVisits,commonOpensToday:commonVisits,recentActivity:events.slice(0,8),recentUsers:users.slice(0,8),recentReminders:reminders.slice(0,8)};}
export async function loadUserData(userId:string, auditAdminId?:string):Promise<AdminUserData>{const db=getFirebaseAdminFirestore();const [user,profile,privateProfile,draft,...sets]=await Promise.all([db.collection("users").doc(userId).get(),db.collection("profiles").doc(userId).get(),db.collection("privateProfiles").doc(userId).get(),db.collection("drafts").doc(userId).get(),...ADMIN_COLLECTIONS.slice(4).map(name=>db.collection(name).get())]);if(!user.exists)throw new Error("USER_NOT_FOUND");const collections:Record<string,Record<string,unknown>[]>= {}; ADMIN_COLLECTIONS.slice(4).forEach((name,index)=>{collections[name]=records(sets[index]).filter(row=>Object.values(row).includes(userId));});if(auditAdminId)await writeAudit(auditAdminId,"user_data_viewed",userId,{});return{user:jsonValue({id:user.id,...user.data()}) as Record<string,unknown>,profile:profile.exists?jsonValue(profile.data()) as Record<string,unknown>:null,privateProfile:privateProfile.exists?jsonValue(privateProfile.data()) as Record<string,unknown>:null,draft:draft.exists?jsonValue(draft.data()) as Record<string,unknown>:null,collections};}
export async function writeAudit(adminId:string,action:"profile_reminder_sent"|"notification_resent"|"user_data_viewed"|"export_generated"|"admin_reflection_published"|"admin_reflection_updated"|"admin_reflection_deleted",targetUserId:string|null,metadata:Record<string,unknown>){const ref=getFirebaseAdminFirestore().collection("adminAuditLogs").doc();await ref.set({id:ref.id,adminId,action,targetUserId,createdAt:FieldValue.serverTimestamp(),metadata});return ref.id;}
