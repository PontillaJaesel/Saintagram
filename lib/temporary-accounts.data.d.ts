export interface TemporaryAccountData {
  fullName: string;
  username: string;
  temporaryPassword: string;
  role: "user" | "tester" | "app_admin";
}
export const TEMPORARY_ACCOUNT_NAMES: readonly string[];
export const TEMPORARY_ACCOUNTS: readonly TemporaryAccountData[];
