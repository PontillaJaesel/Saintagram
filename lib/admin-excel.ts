import "server-only";

import ExcelJS from "exceljs";
import { jsonValue, loadAdminUsers, loadUserData } from "@/lib/admin-data";
import { getFirebaseAdminStorage } from "@/lib/firebase-admin";
import type { AdminUserData, AdminUserSummary } from "@/types";

const excluded = (key: string) => /token|password|secret|privateKey|rawIp|accessCode/i.test(key);
const isoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const title = (value: string) => value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());

function dateTimePlace(value: string, record: Record<string, unknown>): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const place = String(record.locationLabel || [record.city, record.region, record.country].filter(Boolean).join(", ") || "").trim();
  return `${part("year")}-${part("month")}-${part("day")}; ${part("hour")}:${part("minute")}:${part("second")}${place ? `; ${place}` : ""}`;
}

function safe(value: unknown, record: Record<string, unknown>): string | number | boolean {
  const normalized = jsonValue(value);
  let serialized: string;
  if (typeof normalized === "string" && isoDate.test(normalized)) serialized = dateTimePlace(normalized, record);
  else if (Array.isArray(normalized)) serialized = normalized.map((item) => typeof item === "object" ? Object.entries(item as Record<string, unknown>).map(([key, child]) => `${title(key)}: ${String(child)}`).join("; ") : String(item)).join(", ");
  else if (typeof normalized === "object" && normalized !== null) serialized = Object.entries(normalized as Record<string, unknown>).map(([key, child]) => `${title(key)}: ${String(child)}`).join("; ");
  else serialized = String(normalized ?? "");
  return /^[=+\-@]/.test(serialized) ? `'${serialized}` : serialized;
}

function uniqueSheetName(name: string, used: Set<string>): string {
  const clean = name.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "User";
  let candidate = clean; let suffix = 2;
  while (used.has(candidate.toLocaleLowerCase())) { const marker = ` ${suffix++}`; candidate = `${clean.slice(0, 31 - marker.length)}${marker}`; }
  used.add(candidate.toLocaleLowerCase()); return candidate;
}

async function mediaLink(path: string): Promise<ExcelJS.CellHyperlinkValue | string> {
  try {
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucketName) return "Media unavailable";
    const [url] = await getFirebaseAdminStorage().bucket(bucketName).file(path).getSignedUrl({ action: "read", expires: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    return { text: "Download media", hyperlink: url, tooltip: "Download this media file (link valid for 7 days)" };
  } catch { return "Media unavailable"; }
}

function buildReferences(allUsers: AdminUserSummary[], owner: AdminUserSummary, data: AdminUserData): Map<string, string> {
  const references = new Map(allUsers.map((user) => [user.id, `${user.name} (${user.email || "Guest account"})`]));
  references.set(owner.id, `${owner.name} (${owner.email || "Guest account"})`);
  Object.values(data.collections).forEach((rows) => rows.forEach((record, index) => {
    if (typeof record.id !== "string") return;
    const assigned = record.title || record.name || record.profileName || record.content;
    references.set(record.id, typeof assigned === "string" ? assigned.slice(0, 80) : `Record ${index + 1}`);
  }));
  return references;
}

async function addSection(sheet: ExcelJS.Worksheet, section: string, records: Record<string, unknown>[], references: Map<string, string>) {
  const heading = sheet.addRow([section]); heading.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 }; heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF52705A" } }; sheet.mergeCells(heading.number, 1, heading.number, 3);
  if (!records.length) { sheet.addRow(["No recorded data"]); sheet.addRow([]); return; }
  for (let recordIndex = 0; recordIndex < records.length; recordIndex++) {
    const record = records[recordIndex];
    if (records.length > 1) { const recordHeader = sheet.addRow([`${section} ${recordIndex + 1}`]); recordHeader.font = { bold: true, color: { argb: "FF36523F" } }; }
    let entries = Object.entries(record).filter(([key]) => !excluded(key) && !["city", "region", "country", "locationLabel"].includes(key));
    if (section === "Profile") entries = entries.filter(([key]) => key !== "id" && key !== "userId");
    if (section === "Account") {
      entries = entries.filter(([key]) => key !== "privacyPreferences");
      const privacy = record.privacyPreferences as Record<string, unknown> | undefined;
      if (privacy) entries.push(["privacyCheck", privacy.requirePrivateCheck === true ? "Allowed" : "Not allowed"], ["reflectionDates", privacy.showReflectionDates === true ? "Shown" : "Hidden"]);
    }
    for (const [key, value] of entries) {
      let resolved: ExcelJS.CellValue;
      if ((key === "imagePath" || key === "path") && typeof value === "string" && value.startsWith("users/")) resolved = await mediaLink(value);
      else if ((key === "id" || key.endsWith("Id")) && typeof value === "string") resolved = references.get(value) || `Record ${recordIndex + 1}`;
      else if (key === "media" && Array.isArray(value)) {
        const links = await Promise.all(value.map((item) => mediaLink(String((item as { path?: unknown }).path || ""))));
        resolved = links.map((link) => typeof link === "string" ? link : link.hyperlink).join("\n");
      } else resolved = safe(value, record);
      const row = sheet.addRow([key === "privacyCheck" ? "Privacy Check" : title(key), resolved]);
      if (typeof resolved === "object" && resolved && "hyperlink" in resolved) row.getCell(2).font = { color: { argb: "FF2F6B4F" }, underline: true };
    }
    if (recordIndex < records.length - 1) sheet.addRow([]);
  }
  sheet.addRow([]);
}

export async function createAdminWorkbook(options: { userId?: string; from?: string; to?: string; include?: string[] }) {
  const workbook = new ExcelJS.Workbook(); workbook.creator = "Saintagram Admin"; workbook.created = new Date();
  const allUsers = await loadAdminUsers(); const users = options.userId ? allUsers.filter((user) => user.id === options.userId) : allUsers; const usedNames = new Set<string>();
  for (const user of users) {
    const data = await loadUserData(user.id); const references = buildReferences(allUsers, user, data);
    const sheet = workbook.addWorksheet(uniqueSheetName(user.name || user.email || user.id, usedNames), { views: [{ state: "frozen", ySplit: 4, showGridLines: false }] });
    sheet.columns = [{ width: 30 }, { width: 78 }, { width: 2 }];
    const pageTitle = sheet.addRow([user.name]); pageTitle.font = { bold: true, size: 18, color: { argb: "FF24352A" } }; sheet.mergeCells(pageTitle.number, 1, pageTitle.number, 3);
    sheet.addRow(["Username", user.email || "Guest account"]); sheet.addRow(["Assigned User", `${user.name} (${user.email || "Guest account"})`]); sheet.addRow(["Exported", dateTimePlace(new Date().toISOString(), {})]); sheet.addRow([]);
    await addSection(sheet, "Account", [data.user], references); await addSection(sheet, "Profile", data.profile ? [data.profile] : [], references); await addSection(sheet, "Private Profile", data.privateProfile ? [data.privateProfile] : [], references); await addSection(sheet, "Profile Draft", data.draft ? [data.draft] : [], references);
    for (const [name, rows] of Object.entries(data.collections)) await addSection(sheet, title(name), rows, references);
    sheet.getColumn(1).font = { bold: true, color: { argb: "FF52645A" } }; sheet.getColumn(2).alignment = { vertical: "top", wrapText: true }; sheet.eachRow((row) => { if (!row.height) row.height = 20; });
  }
  if (!users.length) workbook.addWorksheet("No Users").addRow(["No user records were available for export."]);
  return workbook.xlsx.writeBuffer();
}
