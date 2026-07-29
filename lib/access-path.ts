const INTERNAL_ORIGIN = "https://saintagram.internal";
const DEFAULT_DESTINATION = "/";

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

export function getSafeAccessDestination(
  candidate: unknown,
  fallback = DEFAULT_DESTINATION
): string {
  if (
    typeof candidate !== "string" ||
    candidate.length === 0 ||
    candidate.length > 2048 ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    hasControlCharacters(candidate)
  ) {
    return fallback;
  }

  try {
    const destination = new URL(candidate, INTERNAL_ORIGIN);
    if (destination.origin !== INTERNAL_ORIGIN) return fallback;

    if (
      !destination.pathname.startsWith("/") ||
      destination.pathname.startsWith("//") ||
      destination.pathname.includes("\\") ||
      hasControlCharacters(destination.pathname) ||
      destination.pathname === "/access" ||
      destination.pathname.startsWith("/api/access")
    ) {
      return fallback;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
