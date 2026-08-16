import "server-only";
import { normalizeUsernameCode } from "@/lib/account-identity";
// @ts-expect-error TypeScript does not associate the sibling declaration with
// an explicitly imported .mjs file under bundler resolution.
import { TEMPORARY_ACCOUNTS as ACCOUNT_DATA } from "@/lib/temporary-accounts.data.mjs";

export interface TemporaryAccountCredential {
  fullName: string;
  username: string;
  temporaryPassword: string;
  role: "user" | "tester";
}

export const TEMPORARY_ACCOUNTS: readonly TemporaryAccountCredential[] = ACCOUNT_DATA;

export function findTemporaryAccount(username: string) {
  const normalized = normalizeUsernameCode(username);
  return normalized
    ? TEMPORARY_ACCOUNTS.find((account) => account.username === normalized)
    : undefined;
}
