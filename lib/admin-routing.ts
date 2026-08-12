export const ADMIN_ROOT_PATH = "/admin";
const ADMIN_API_PATH = "/api/admin";

export type SaintagramAppMode = "normal" | "admin";

export function getSaintagramAppMode(): SaintagramAppMode {
  return process.env.SAINTAGRAM_APP_MODE === "admin" ? "admin" : "normal";
}

export function isAdminPagePath(pathname: string): boolean {
  return pathname === ADMIN_ROOT_PATH || pathname.startsWith(`${ADMIN_ROOT_PATH}/`);
}

export function isAdminApiPath(pathname: string): boolean {
  return pathname === ADMIN_API_PATH || pathname.startsWith(`${ADMIN_API_PATH}/`);
}

export function normalizeHostname(value: string): string {
  const hostname = value.trim().toLowerCase();
  if (hostname.startsWith("[")) {
    const closingBracket = hostname.indexOf("]");
    return closingBracket >= 0 ? hostname.slice(1, closingBracket) : hostname;
  }
  return hostname.split(":", 1)[0];
}

export function isLocalDevelopmentHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}
