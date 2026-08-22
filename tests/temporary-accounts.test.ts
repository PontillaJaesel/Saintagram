import { describe, expect, it } from "vitest";
// @ts-expect-error TypeScript does not associate the sibling declaration with
// an explicitly imported .mjs file under bundler resolution.
import { TEMPORARY_ACCOUNTS } from "@/lib/temporary-accounts.data.mjs";

interface TemporaryAccount {
  fullName: string;
  username: string;
  temporaryPassword: string;
  role: "user" | "tester";
}

const userAccounts = TEMPORARY_ACCOUNTS.filter(
  (account: TemporaryAccount) => account.role === "user"
) as TemporaryAccount[];

function findDuplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return [...duplicates];
}

describe("temporary accounts", () => {
  it("contains normal user accounts", () => {
    expect(userAccounts.length).toBeGreaterThan(0);
  });

  it("keeps all user usernames unique", () => {
    const usernames = userAccounts.map((account) => account.username);
    const duplicates = findDuplicates(usernames);

    expect(
      duplicates,
      `Duplicate usernames found: ${duplicates.join(", ")}`
    ).toEqual([]);
  });

  it("keeps all temporary passwords unique", () => {
    const passwords = userAccounts.map(
      (account) => account.temporaryPassword
    );
    const duplicates = findDuplicates(passwords);

    expect(
      duplicates,
      `Duplicate temporary passwords found: ${duplicates.join(", ")}`
    ).toEqual([]);
  });

  it("requires every normal user to have a full name", () => {
    for (const account of userAccounts) {
      expect(account.fullName.trim()).not.toBe("");
    }
  });

  it("requires every normal user to have a username", () => {
    for (const account of userAccounts) {
      expect(account.username.trim()).not.toBe("");
    }
  });

  it("requires every normal user to have a temporary password", () => {
    for (const account of userAccounts) {
      expect(account.temporaryPassword.trim()).not.toBe("");
    }
  });

  it("keeps the expected number of normal user accounts", () => {
    expect(userAccounts).toHaveLength(152);
  });

  it("keeps normal user credentials assigned by their USR number", () => {
    userAccounts.forEach((account, index) => {
      const code = String(index + 1).padStart(
        3,
        "0"
      );

      expect(account.username).toBe(
        `USR${code}`
      );

      expect(account.temporaryPassword).toBe(
        `Serve@${code}`
      );

      expect(account.role).toBe("user");

      expect(
        account.fullName.trim()
      ).not.toBe("");
    });
  });

  it("keeps tester account usernames unique", () => {
    const testerUsernames = testerAccounts.map(
      (account) => account.username
    );

    expect(
      new Set(testerUsernames).size
    ).toBe(testerUsernames.length);
  });

  it("requires every tester account to have valid credentials", () => {
    testerAccounts.forEach((account) => {
      expect(account.username).toMatch(
        /^USRTEST\d+$/
      );

      expect(
        account.fullName.trim()
      ).not.toBe("");

      expect(
        account.temporaryPassword.trim()
      ).not.toBe("");

      expect(account.role).toBe("tester");
    });
  });

  it("recognizes USRTEST3 as a valid tester account", () => {
    const account = accounts.find(
      (item) => item.username === "USRTEST3"
    );

    expect(account).toBeDefined();
    expect(account?.username).toBe("USR047");
  });
});