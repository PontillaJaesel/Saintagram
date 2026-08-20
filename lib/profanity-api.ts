import "server-only";

import {
  MODERATION_TEXT_ERROR,
  localModerationDecision,
  type ModerationDecision
} from "@/lib/moderation";

const DEFAULT_PROFANITY_API_URL = "https://vector.profanity.dev";
const DEFAULT_PROFANITY_API_THRESHOLD = 0.9;
const DEFAULT_PROFANITY_API_TIMEOUT_MS = 3000;

interface ProfanityApiPayload {
  isProfanity?: unknown;
  profanity?: unknown;
  score?: unknown;
  confidence?: unknown;
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function profanityScore(payload: ProfanityApiPayload): number | null {
  const candidate = payload.score ?? payload.confidence;
  const parsed = typeof candidate === "number" ? candidate : Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

function profanityFlag(payload: ProfanityApiPayload): boolean | null {
  for (const candidate of [payload.isProfanity, payload.profanity]) {
    if (typeof candidate === "boolean") return candidate;
    if (typeof candidate === "string") {
      const normalized = candidate.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }
  return null;
}

export async function moderateTextWithProfanityApi(
  value: string
): Promise<ModerationDecision> {
  // Keep Saintagram's existing Filipino/custom terms as the first line of defense.
  const local = localModerationDecision(value);
  if (!local.allowed || !value.trim()) return local;

  const url = process.env.PROFANITY_API_URL?.trim() || DEFAULT_PROFANITY_API_URL;
  const threshold = Math.min(
    1,
    Math.max(0, numberFromEnv(process.env.PROFANITY_API_THRESHOLD, DEFAULT_PROFANITY_API_THRESHOLD))
  );
  const timeoutMs = Math.min(
    10000,
    Math.max(500, numberFromEnv(process.env.PROFANITY_API_TIMEOUT_MS, DEFAULT_PROFANITY_API_TIMEOUT_MS))
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: value }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Profanity API returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as ProfanityApiPayload;
    const explicitFlag = profanityFlag(payload);
    const score = profanityScore(payload);

    if (explicitFlag === null && score === null) {
      throw new Error("Profanity API returned an unexpected response.");
    }

    const blocked = explicitFlag ?? (score !== null && score >= threshold);

    if (blocked) {
      return {
        allowed: false,
        blocked: true,
        reason: MODERATION_TEXT_ERROR,
        matchedTerms: [],
        source: "profanity-api"
      };
    }

    return {
      allowed: true,
      blocked: false,
      reason: "",
      matchedTerms: [],
      source: "profanity-api"
    };
  } catch (error) {
    // The external service must never become a single point of failure.
    // If it is unavailable, keep the existing local moderation decision.
    console.warn(
      "Profanity API unavailable; using Saintagram local profanity filter.",
      error instanceof Error ? error.message : error
    );
    return local;
  } finally {
    clearTimeout(timeout);
  }
}
