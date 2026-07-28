import { LIMITS } from "@/lib/constants";

export function cleanText(value: string, maxLength: number): string {
  return value.replace(/\u0000/g, "").trim().slice(0, maxLength);
}

export function normalizeList(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => cleanText(value, LIMITS.listEntry))
    .filter((value) => {
      const key = value.toLocaleLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30);
}

export function normalizeHashtag(value: string): string {
  const cleaned = cleanText(value, LIMITS.hashtag)
    .replace(/\s+/g, "")
    .replace(/[^#\p{L}\p{N}_-]/gu, "")
    .replace(/#/g, "");
  if (!cleaned || !/[\p{L}\p{N}]/u.test(cleaned)) return "";
  return `#${cleaned}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function passwordError(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Include at least one letter and one number.";
  }
  return null;
}

export function validateImage(file: File): string | null {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) return "Choose a JPG, PNG, or WebP image.";
  if (file.size > LIMITS.imageBytes) return "Choose an image smaller than 2 MB.";
  return null;
}

export function formatFriendlyDate(iso: string, includeTime = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {})
  }).format(date);
}
