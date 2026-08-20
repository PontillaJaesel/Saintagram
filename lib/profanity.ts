import { FILIPINO_PROFANITY } from "@/lib/filipino-profanity";

const ENGLISH_AND_EXISTING_PROFANITY = [
  "anal",
  "anus",
  "asshole",
  "bastard",
  "bitch",
  "bobo",
  "bulok",
  "cock",
  "cunt",
  "dick",
  "dumb",
  "ewan",
  "fuck",
  "fucker",
  "fucking",
  "gaga",
  "gagi",
  "gago",
  "hayop",
  "idiot",
  "inutil",
  "leche",
  "motherfucker",
  "pakyu",
  "peste",
  "pussy",
  "puta",
  "putangina",
  "putanginamo",
  "shet",
  "shit",
  "slut",
  "stupid",
  "tanga",
  "tangina",
  "walang hiya",
  "whore",
  "yawa"
] as const;

export const COMMON_PROFANITY = [
  ...ENGLISH_AND_EXISTING_PROFANITY,
  ...FILIPINO_PROFANITY
] as const;

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "2": "z",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  "$": "s",
  "+": "t"
};

function normalizeCharacters(value: string): string {
  let normalized = (value ?? "").toLowerCase().normalize("NFKD");
  normalized = normalized.replace(/[\u0300-\u036f]/g, "");
  const characters = Array.from(normalized);

  return characters
    .map((character, index) => {
      // Treat ! as an i only when it is used inside a word (for example sh!t).
      // Sentence-ending !!! should remain separators rather than changing the word.
      if (character === "!") {
        const previous = characters[index - 1] ?? "";
        const next = characters[index + 1] ?? "";
        return /[a-z0-9]/.test(previous) && /[a-z0-9]/.test(next) ? "i" : " ";
      }
      return LEET_MAP[character] ?? character;
    })
    .join("");
}

/**
 * Compact normalization kept for compatibility with existing callers/tests.
 * Matching itself uses word/phrase boundaries below to avoid substring false
 * positives such as matching a blocked term inside an unrelated longer word.
 */
export function normalizeProfanityText(value: string): string {
  return normalizeCharacters(value).replace(/[^a-z0-9]/g, "");
}

function normalizeBoundaryText(value: string): string {
  return normalizeCharacters(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseSpacedLetters(value: string): string {
  const tokens = value.split(" ").filter(Boolean);
  const collapsed: string[] = [];

  for (let index = 0; index < tokens.length; ) {
    if (tokens[index].length !== 1) {
      collapsed.push(tokens[index]);
      index += 1;
      continue;
    }

    let end = index;
    let joined = "";
    while (end < tokens.length && tokens[end].length === 1) {
      joined += tokens[end];
      end += 1;
    }

    if (end - index >= 3) {
      collapsed.push(joined);
    } else {
      collapsed.push(...tokens.slice(index, end));
    }
    index = end;
  }

  return collapsed.join(" ");
}

function containsWholePhrase(haystack: string, phrase: string): boolean {
  if (!haystack || !phrase) return false;
  return (` ${haystack} `).includes(` ${phrase} `);
}

export function findProfanityMatches(value: string): string[] {
  const normalized = normalizeBoundaryText(value);
  if (!normalized) return [];

  // The second form catches deliberate spacing such as "g a g o" or
  // "p u t a n g i n a" while retaining whole-word matching.
  const collapsedSpelling = collapseSpacedLetters(normalized);
  const normalizedTokens = new Set(normalized.split(" "));
  const collapsedTokens = new Set(collapsedSpelling.split(" "));
  const matches = new Set<string>();

  for (const entry of COMMON_PROFANITY) {
    const targetPhrase = normalizeBoundaryText(entry);
    const compactTarget = normalizeProfanityText(entry);
    if (!targetPhrase || !compactTarget) continue;

    if (
      containsWholePhrase(normalized, targetPhrase) ||
      containsWholePhrase(collapsedSpelling, targetPhrase) ||
      normalizedTokens.has(compactTarget) ||
      collapsedTokens.has(compactTarget)
    ) {
      matches.add(entry);
    }
  }

  return [...matches];
}
