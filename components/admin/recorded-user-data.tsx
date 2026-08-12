"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Download, LoaderCircle } from "lucide-react";
import { adminDownload, adminFetch } from "@/lib/admin-api";
import { ReflectionMediaView } from "@/components/reflections/reflection-media-view";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { useToast } from "@/components/providers/toast-provider";
import { downloadFirebaseProfileImage } from "@/lib/profile-images";
import type { AdminUserData, AdminUserSummary, ReflectionMedia, SpiritualSymbol } from "@/types";

const hiddenField = (key: string) => /token|password|secret|privateKey|rawIp|accessCode/i.test(key);
const label = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
const isoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function dateTimePlace(value: string, row?: Record<string, unknown>): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const time = `${part("hour")}:${part("minute")}:${part("second")}`;
  const place = String(row?.locationLabel || [row?.city, row?.region, row?.country].filter(Boolean).join(", ") || "").trim();
  return `${date}; ${time}${place ? `; ${place}` : ""}`;
}

function plainValue(value: unknown, row?: Record<string, unknown>): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && isoDate.test(value)) return dateTimePlace(value, row);
  if (Array.isArray(value)) return value.map((item) => plainValue(item)).join(", ") || "—";
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${label(key)}: ${plainValue(item)}`).join("; ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function ProfileImageDownload({ path, preview = false, profileName = "User" }: { path: string; preview?: boolean; profileName?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => { let active = true; void downloadFirebaseProfileImage(path).then((value) => { if (active) setUrl(value); }).catch(() => undefined); return () => { active = false; }; }, [path]);
  if (!url) return <span className="text-muted">Preparing image…</span>;
  return <div className={preview ? "space-y-3" : ""}>
    {preview && <img src={url} alt={`${profileName} profile`} className="size-40 rounded-2xl border border-sage-100 bg-sage-50 object-cover sm:size-48" />}
    <a className="inline-flex items-center gap-2 font-bold text-sage-700 underline underline-offset-4" href={url} download target="_blank" rel="noreferrer"><Download className="size-4" />Download profile image</a>
  </div>;
}

type Resolver = (key: string, value: unknown, row: Record<string, unknown>, rowIndex?: number, collection?: string) => ReactNode;

function accountRows(record: Record<string, unknown>): Array<[string, unknown]> {
  const rows = Object.entries(record).filter(([key]) => !hiddenField(key) && key !== "privacyPreferences");
  const privacy = record.privacyPreferences as Record<string, unknown> | undefined;
  if (privacy) {
    rows.push(["privacyCheck", privacy.requirePrivateCheck === true ? "Allowed" : "Not allowed"]);
    rows.push(["reflectionDates", privacy.showReflectionDates === true ? "Shown" : "Hidden"]);
  }
  return rows;
}

function RecordTable({ title, record, resolve }: { title: string; record: Record<string, unknown> | null; resolve: Resolver }) {
  let rows = title === "Account" ? accountRows(record ?? {}) : Object.entries(record ?? {}).filter(([key]) => !hiddenField(key) && key !== "media");
  if (title === "Profile") rows = rows.filter(([key]) => key !== "id" && key !== "userId");
  return <section className="surface overflow-hidden"><div className="border-b border-sage-100 bg-sage-50/70 px-5 py-4"><h2 className="font-serif text-xl font-bold">{title}</h2></div>{rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{rows.map(([key, value]) => <tr className="border-t border-sage-100 first:border-t-0" key={key}><th className="w-52 px-5 py-3 align-top font-semibold text-muted">{key === "privacyCheck" ? "Privacy Check" : label(key)}</th><td className="break-words px-5 py-3">{resolve(key, value, record ?? {})}</td></tr>)}</tbody></table></div> : <p className="p-5 text-sm italic text-muted">No recorded data.</p>}</section>;
}

function CollectionTable({ name, rows, resolve }: { name: string; rows: Record<string, unknown>[]; resolve: Resolver }) {
  const excludedLocationParts = new Set(["city", "region", "country", "locationLabel"]);
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).filter((key) => !hiddenField(key) && key !== "media" && !excludedLocationParts.has(key));
  return <section className="surface overflow-hidden"><div className="border-b border-sage-100 bg-sage-50/70 px-5 py-4"><h2 className="font-serif text-xl font-bold">{label(name)} <span className="text-sm font-normal text-muted">({rows.length})</span></h2></div>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-sm"><thead><tr className="text-muted">{keys.map((key) => <th className="px-4 py-3" key={key}>{key === "userId" ? "Assigned User" : key === "id" ? "Assigned Record" : label(key)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr className="border-t border-sage-100" key={String(row.id ?? index)}>{keys.map((key) => <td className="max-w-sm break-words px-4 py-3 align-top" key={key}>{resolve(key, row[key], row, index, name)}</td>)}</tr>)}</tbody></table></div> : <p className="p-5 text-sm italic text-muted">No recorded entries.</p>}
    {rows.map((row, index) => { const media = Array.isArray(row.media) ? row.media as ReflectionMedia[] : []; return media.length ? <div className="border-t border-sage-100 p-5" key={`media-${String(row.id ?? index)}`}><p className="text-sm font-bold">Media for {String(row.title || `record ${index + 1}`)}</p><ReflectionMediaView media={media} compact /></div> : null; })}
  </section>;
}

export function RecordedUserData({ userId }: { userId: string }) {
  const [data, setData] = useState<AdminUserData | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const { notify } = useToast();
  useEffect(() => { void Promise.all([adminFetch<AdminUserData>(`/api/admin/user-data?userId=${encodeURIComponent(userId)}`), adminFetch<{ users: AdminUserSummary[] }>("/api/admin/users")]).then(([userData, userList]) => { setData(userData); setUsers(userList.users); }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "User data could not be loaded.")); }, [userId]);
  const profileName = String(data?.profile?.profileName || data?.user.email || "User");
  const references = useMemo(() => { const map = new Map<string, string>(); if (!data) return map; users.forEach((user) => map.set(user.id, `${user.name} (${user.email || "Guest account"})`)); map.set(userId, `${profileName} (${String(data.user.email || "Guest account")})`); Object.values(data.collections).forEach((rows) => rows.forEach((row, index) => { if (typeof row.id !== "string") return; const assigned = row.title || row.name || row.profileName || row.content; map.set(row.id, typeof assigned === "string" ? assigned.slice(0, 80) : `Record ${index + 1}`); })); return map; }, [data, profileName, userId, users]);
  const resolve: Resolver = (key, value, row, rowIndex = 0, collection = "record") => {
    if (key === "imagePath" && typeof value === "string" && value) return <ProfileImageDownload path={value} />;
    if ((key === "id" || key.endsWith("Id")) && typeof value === "string") return references.get(value) || `Record ${rowIndex + 1}`;
    return plainValue(value, row);
  };
  const exportUser = async () => { setExporting(true); try { const blob = await adminDownload("/api/admin/export", { userId, include: [] }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `saintagram-user-data-${userId}.xlsx`; link.click(); URL.revokeObjectURL(link.href); notify("User data exported."); } catch (exportError) { notify(exportError instanceof Error ? exportError.message : "The export could not be generated.", "error"); } finally { setExporting(false); } };
  if (error) return <><Link className="btn-secondary mb-5" href="/admin/data"><ArrowLeft className="size-4" />Back to User Data</Link><p className="rounded-xl bg-clay-50 p-4 text-clay-700" role="alert">{error}</p></>;
  if (!data) return <div className="surface p-8 text-center text-muted">Loading recorded data…</div>;
  return <><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><Link className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-sage-700" href="/admin/data"><ArrowLeft className="size-4" />All users</Link><h1 className="font-serif text-3xl font-bold">{profileName}</h1><p className="mt-1 text-sm text-muted">{String(data.user.email || "Guest account")}</p></div><button className="btn-primary" type="button" disabled={exporting} onClick={() => void exportUser()}>{exporting ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}{exporting ? "Exporting…" : "Export This User"}</button></div>
    {(data.profile?.imagePath || data.profile?.selectedSymbol) && <section className="surface mb-5 p-5"><h2 className="font-serif text-xl font-bold">Profile Media</h2><div className="mt-4">{data.profile.imagePath ? <ProfileImageDownload path={String(data.profile.imagePath)} preview profileName={profileName} /> : <div className="flex items-center gap-4"><ProfileAvatar imagePath="" symbol={(data.profile.selectedSymbol || "") as SpiritualSymbol} profileName={profileName} /><p className="text-sm text-muted">This profile uses a symbol.</p></div>}</div></section>}
    <div className="grid gap-5"><RecordTable title="Account" record={data.user} resolve={resolve} /><RecordTable title="Profile" record={data.profile} resolve={resolve} /><RecordTable title="Private Profile" record={data.privateProfile} resolve={resolve} /><RecordTable title="Profile Draft" record={data.draft} resolve={resolve} />{Object.entries(data.collections).map(([name, rows]) => <CollectionTable key={name} name={name} rows={rows} resolve={resolve} />)}</div>
  </>;
}
