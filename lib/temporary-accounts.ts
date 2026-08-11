export interface TemporaryAccountCredential {
  username: string;
  temporaryPassword: string;
}

// Fixed access codes issued by the administrator. These are bootstrap
// credentials only; the application requires replacement after first use.
export const TEMPORARY_ACCOUNTS: readonly TemporaryAccountCredential[] = [
  ...Array.from({ length: 46 }, (_, index) => {
    const code = String(index + 1).padStart(3, "0");
    return { username: `USR${code}`, temporaryPassword: `Serve@${code}` };
  }),
  { username: "USRTEST", temporaryPassword: "TempPass123!" }
];

export function findTemporaryAccount(username: string) {
  const normalized = username.trim().toLocaleUpperCase();
  return TEMPORARY_ACCOUNTS.find((account) => account.username === normalized);
}

export function usernameAccountEmail(username: string): string {
  return `${username.trim().toLocaleLowerCase()}@accounts.saintagram.local`;
}
