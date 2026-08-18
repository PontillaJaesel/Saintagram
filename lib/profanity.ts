export const COMMON_PROFANITY = [
  "anal",
  "anus",
  "bastard",
  "bobo",
  "bitch",
  "bobo",
  "bulok",
  "dick",
  "dumb",
  "ewan",
  "fuck",
  "gago",
  "gaga",
  "gagi",
  "hayop",
  "inutil",
  "leche",
  "pakyu",
  "peste",
  "putangina",
  "puta",
  "putanginamo",
  "shet",
  "shit",
  "stupid",
  "tanga",
  "tangina",
  "walang hiya",
  "yawa",
  "idiot"
] as const;

export function normalizeProfanityText(value: string): string {
  const leetMap: Record<string, string> = {
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
    "!": "i",
    "?": "",
    ".": "",
    ",": "",
    ":": "",
    ";": "",
    "-": "",
    "_": "",
    " ": "",
    "\n": "",
    "\r": "",
    "*": "",
    "(": "",
    ")": "",
    "[": "",
    "]": "",
    "/": "",
    "\\": ""
  };

  let normalized = value.toLowerCase().normalize("NFKD");
  normalized = normalized.replace(/[\u0300-\u036f]/g, "");
  normalized = Array.from(normalized)
    .map((character) => leetMap[character] ?? character)
    .join("");
  return normalized.replace(/[^a-z0-9]/g, "");
}

export function findProfanityMatches(value: string): string[] {
  const normalized = normalizeProfanityText(value);
  const matches = new Set<string>();

  for (const entry of COMMON_PROFANITY) {
    const target = normalizeProfanityText(entry);
    if (target && normalized.includes(target)) {
      matches.add(entry);
    }
  }

  return [...matches];
}
