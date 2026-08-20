import { describe, expect, it } from "vitest";

// @ts-expect-error TypeScript does not associate the sibling declaration with
// an explicitly imported .mjs file under bundler resolution.
import { TEMPORARY_ACCOUNTS } from "@/lib/temporary-accounts.data.mjs";

interface TemporaryAccount {
  fullName: string;
  username: string;
  temporaryPassword: string;
  role: "user" | "tester" | "app_admin";
}

const accounts = TEMPORARY_ACCOUNTS as TemporaryAccount[];

const userAccounts = accounts.filter(
  (account) => account.role === "user"
);

const testerAccounts = accounts.filter(
  (account) => account.role === "tester"
);

describe("temporary accounts", () => {
  it("keeps all issued usernames unique", () => {
    const usernames = accounts.map(
      (account) => account.username
    );

    expect(
      new Set(usernames).size
    ).toBe(usernames.length);
  });

  it("keeps all issued temporary passwords unique", () => {
    const passwords = accounts.map(
      (account) => account.temporaryPassword
    );

    expect(
      new Set(passwords).size
    ).toBe(passwords.length);
  });

  it("requires every account to have valid account data", () => {
    accounts.forEach((account) => {
      expect(account.fullName.trim()).not.toBe("");
      expect(account.username.trim()).not.toBe("");
      expect(account.temporaryPassword.trim()).not.toBe("");

      expect([
        "user",
        "tester",
        "app_admin"
      ]).toContain(account.role);
    });
  });

  it("keeps the expected number of normal user accounts", () => {
    expect(userAccounts).toHaveLength(144);
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

    expect(account).toMatchObject({
      username: "USRTEST3",
      role: "tester"
    });

    expect(
      account?.fullName.trim()
    ).not.toBe("");

    expect(
      account?.temporaryPassword.trim()
    ).not.toBe("");
  });
});