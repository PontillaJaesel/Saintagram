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

describe("temporary test accounts", () => {
  it("recognizes USRTEST3 and its issued temporary credentials", () => {
    expect(TEMPORARY_ACCOUNTS.find((account: TemporaryAccount) => account.username === "USRTEST3")).toEqual({
      fullName: "Saintagram Replacement Test User",
      username: "USRTEST3",
      temporaryPassword: "NewTemp3@2026",
      role: "tester"
    });
  });
});
