/**
 * High-confidence benign terms that are safe to mask before text is sent to the
 * external profanity API.
 *
 * IMPORTANT:
 * - These terms are NOT exemptions from Saintagram's local moderation.
 * - Local profanity checks always run before this masking step.
 * - Keep this list limited to clearly benign app/faith vocabulary. Do not add
 *   context-sensitive slang or words that can themselves be used as insults.
 */
export const APP_PROFANITY_API_SAFE_TERMS = [
  "account",
  "accounts",
  "admin",
  "admins",
  "administrator",
  "administrators",
  "bulletin",
  "bulletins",
  "comment",
  "comments",
  "email",
  "emails",
  "fiat",
  "follower",
  "followers",
  "following",
  "login",
  "logins",
  "moderator",
  "moderators",
  "notification",
  "notifications",
  "password",
  "passwords",
  "post",
  "posts",
  "profile",
  "profiles",
  "reflection",
  "reflections",
  "reply",
  "replies",
  "saintagram",
  "tester",
  "testers",
  "user",
  "users",
  "username",
  "usernames"
] as const;

export const ENGLISH_FAITH_PROFANITY_API_SAFE_TERMS = [
  "bible",
  "biblical",
  "christ",
  "church",
  "churches",
  "faith",
  "gospel",
  "god",
  "holy",
  "jesus",
  "ministry",
  "ministries",
  "parish",
  "parishes",
  "prayer",
  "prayers",
  "praying",
  "saint",
  "saints",
  "scripture",
  "scriptures",
  "spirit",
  "verse",
  "verses",
  "worship"
] as const;

export const FILIPINO_FAITH_PROFANITY_API_SAFE_TERMS = [
  "bibliya",
  "dasal",
  "diyos",
  "ebanghelyo",
  "hesus",
  "kristo",
  "misa",
  "panalangin",
  "pananampalataya",
  "pagninilay",
  "parokya",
  "repleksyon",
  "santa",
  "santo",
  "simbahan",
  "talata"
] as const;

export const PROFANITY_API_SAFE_TERMS = [
  ...APP_PROFANITY_API_SAFE_TERMS,
  ...ENGLISH_FAITH_PROFANITY_API_SAFE_TERMS,
  ...FILIPINO_FAITH_PROFANITY_API_SAFE_TERMS
] as const;

const SAFE_TERM_REPLACEMENT = "community";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Masks only complete safe terms before remote moderation. The surrounding
 * sentence and every non-safe word remain intact, so profanity elsewhere in
 * the text is still visible to the API.
 *
 * Example:
 *   "The user wrote profanity in a comment"
 * becomes
 *   "The community wrote profanity in a community"
 *
 * We intentionally do not use substring replacement, so a future safe term
 * cannot silently alter the middle of another word.
 */
export function prepareTextForProfanityApi(value: string): string {
  let prepared = value ?? "";
  const terms = [...new Set(PROFANITY_API_SAFE_TERMS)].sort(
    (left, right) => right.length - left.length
  );

  for (const term of terms) {
    const escaped = escapeRegex(term);
    const boundaryPattern = new RegExp(
      `(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`,
      "gi"
    );
    prepared = prepared.replace(
      boundaryPattern,
      (_match, prefix: string) => `${prefix}${SAFE_TERM_REPLACEMENT}`
    );
  }

  return prepared;
}
