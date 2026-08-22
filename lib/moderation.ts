import { findProfanityMatches } from "@/lib/profanity";

export const MODERATION_TEXT_ERROR =
  "Please remove inappropriate or vulgar language before submitting.";
export const MODERATION_POLICY_ERROR =
  "This content cannot be posted because it violates our community guidelines.";
export const MODERATION_IMAGE_ERROR =
  "This image cannot be uploaded because it violates our community guidelines.";
export const MODERATION_UNAVAILABLE_ERROR =
  "Moderation is temporarily unavailable. Please try again.";
export const LIVE_MODERATION_DEBOUNCE_MS = 500;

export function formatMatchedProfanityReason(matchedTerms: string[]): string {
  const uniqueTerms: string[] = [];
  const seen = new Set<string>();

  for (const term of matchedTerms) {
    const trimmed = term.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueTerms.push(trimmed);
  }

  if (uniqueTerms.length === 0) return MODERATION_TEXT_ERROR;

  const formattedTerms = uniqueTerms.map((term) => `"${term}"`).join(", ");
  const noun = uniqueTerms.length === 1 ? "term" : "terms";

  return `Inappropriate language detected: ${formattedTerms}. Please revise ${noun === "term" ? "this term" : "these terms"} before submitting.`;
}

export interface ModerationDecision {
  allowed: boolean;
  blocked: boolean;
  reason: string;
  matchedTerms: string[];
  source: "local" | "profanity-api" | "openai" | "none";
}

export function normalizeModerationText(value: string): string {
  const text = (value ?? "").trim();
  if (!text) return "";

  let normalized = text.toLowerCase().normalize("NFKD");
  normalized = normalized.replace(/[\u0300-\u036f]/g, "");
  normalized = normalized
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/!/g, "i")
    .replace(/\+/g, "t")
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/:/g, "")
    .replace(/;/g, "")
    .replace(/-/g, "")
    .replace(/_/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");

  return normalized.replace(/[0-9]/g, (digit) => {
    if (digit === "0") return "o";
    if (digit === "1") return "i";
    if (digit === "3") return "e";
    if (digit === "4") return "a";
    if (digit === "5") return "s";
    if (digit === "7") return "t";
    return digit;
  });
}

export function localModerationDecision(value: string): ModerationDecision {
  const text = (value ?? "").trim();
  if (!text) {
    return { allowed: true, blocked: false, reason: "", matchedTerms: [], source: "local" };
  }

  const matches = findProfanityMatches(text);
  if (matches.length > 0) {
    return {
      allowed: false,
      blocked: true,
      reason: formatMatchedProfanityReason(matches),
      matchedTerms: matches,
      source: "local"
    };
  }

  return { allowed: true, blocked: false, reason: "", matchedTerms: [], source: "local" };
}

export function validateModerationImageFile(file: File): string | null {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) {
    return MODERATION_IMAGE_ERROR;
  }
  if (file.size > 10 * 1024 * 1024) {
    return MODERATION_IMAGE_ERROR;
  }
  return null;
}

export async function moderateTextContent(value: string): Promise<ModerationDecision> {
  // Local-only by design. Private content can safely use this function without
  // sending journal/profile text to a third-party service.
  return localModerationDecision(value);
}

export async function moderateTextForLiveCheck(
  value: string,
  options: { signal?: AbortSignal } = {}
): Promise<ModerationDecision> {
  const local = localModerationDecision(value);
  if (!local.allowed || !value.trim()) return local;

  try {
    const response = await fetch("/api/moderation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "text", text: value, purpose: "live" }),
      signal: options.signal
    });

    const payload = (await response.json().catch(() => ({}))) as {
      allowed?: boolean;
      blocked?: boolean;
      message?: string;
      matchedTerms?: string[];
      source?: ModerationDecision["source"];
    };

    // Live warnings are best-effort. A temporary server/API outage must not
    // freeze the editor; the mandatory final submission check remains in place.
    if (!response.ok && response.status >= 500) return local;

    if (payload.allowed === false || payload.blocked) {
      return {
        allowed: false,
        blocked: true,
        reason: payload.message || MODERATION_TEXT_ERROR,
        matchedTerms: Array.isArray(payload.matchedTerms) ? payload.matchedTerms : [],
        source: payload.source ?? "profanity-api"
      };
    }

    if (!response.ok) return local;

    return {
      allowed: true,
      blocked: false,
      reason: "",
      matchedTerms: [],
      source: payload.source ?? "profanity-api"
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    return local;
  }
}

export async function moderateTextForSubmission(value: string): Promise<ModerationDecision> {
  const local = localModerationDecision(value);
  if (!local.allowed || !value.trim()) return local;

  try {
    await moderateWithServerRoute(value, "text");
    return local;
  } catch (error) {
    const reason =
      error instanceof Error && error.message
        ? error.message
        : MODERATION_POLICY_ERROR;

    // A route/network outage should not break an existing save flow. The server
    // route also falls back to the local filter when the external API is down.
    if (reason === MODERATION_UNAVAILABLE_ERROR) return local;

    return {
      allowed: false,
      blocked: true,
      reason,
      matchedTerms: [],
      source: "none"
    };
  }
}

export async function moderateWithServerRoute(value: string, kind: "text" | "image" = "text", extra?: Record<string, unknown>): Promise<void> {
  let response: Response;

  try {
    response = await fetch("/api/moderation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, text: value, ...extra })
    });
  } catch {
    throw new Error(MODERATION_UNAVAILABLE_ERROR);
  }

  const payload = await response.json().catch(() => ({
    allowed: false,
    blocked: true,
    message: MODERATION_UNAVAILABLE_ERROR
  }));

  if (!response.ok || payload.allowed === false || payload.blocked) {
    throw new Error(payload.message || MODERATION_POLICY_ERROR);
  }
}

export async function moderateServerTextContent(value: string): Promise<ModerationDecision> {
  const local = localModerationDecision(value);
  if (!local.allowed) return local;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return local;

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ input: value })
    });

    if (!response.ok) {
      throw new Error("OpenAI moderation service is unavailable.");
    }

    const payload = await response.json();
    const flagged = Boolean(payload?.results?.[0]?.flagged);
    if (flagged) {
      const categories = payload?.results?.[0]?.categories ?? {};
      const reasons = Object.entries(categories)
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key);
      return {
        allowed: false,
        blocked: true,
        reason: MODERATION_POLICY_ERROR,
        matchedTerms: reasons.length ? reasons : ["unsafe-content"],
        source: "openai"
      };
    }

    return { allowed: true, blocked: false, reason: "", matchedTerms: [], source: "openai" };
  } catch (error) {
    throw new Error(MODERATION_UNAVAILABLE_ERROR);
  }
}
