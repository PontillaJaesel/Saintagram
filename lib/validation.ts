import { LIMITS } from "@/lib/constants";

export function cleanText(value: string, maxLength: number): string {
  return value.split("\u0000").join("").trim().slice(0, maxLength);
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

export function normalizeCoverColor(value: unknown): string {
  const color = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : "#DDD2F6";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const BLOCKED_SIGNUP_DOMAINS = new Set([
  "10minutemail.com",
  "example.com",
  "example.net",
  "example.org",
  "fake.com",
  "mailinator.com",
  "temp-mail.org",
  "test.com",
  "yopmail.com"
]);

/**
 * Rejects addresses that are explicitly reserved for examples/tests or use a
 * small set of well-known disposable providers. Mailbox ownership itself can
 * only be established by completing the Firebase verification email.
 */
export function registrationEmailError(email: string): string | null {
  const normalized = email.trim().toLocaleLowerCase();
  if (!isValidEmail(normalized)) return "Enter a valid email address.";

  const domain = normalized.slice(normalized.lastIndexOf("@") + 1);
  if (
    BLOCKED_SIGNUP_DOMAINS.has(domain) ||
    domain.endsWith(".test") ||
    domain.endsWith(".example") ||
    domain.endsWith(".invalid") ||
    domain.endsWith(".localhost")
  ) {
    return "Use a real, non-temporary email address that you can verify.";
  }

  return null;
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
