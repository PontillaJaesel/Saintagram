import { describe, expect, it } from "vitest";
import {
  normalizeUsernameCode,
  usernameAccountEmail
} from "@/lib/account-identity";

describe("provisioned account identity", () => {
  it("normalizes issued username codes without exposing credentials", () => {
    expect(normalizeUsernameCode(" usr001 ")).toBe("USR001");
    expect(normalizeUsernameCode("usrtest")).toBe("USRTEST");
    expect(normalizeUsernameCode("usrtest2")).toBe("USRTEST2");
    expect(normalizeUsernameCode("person@example.com")).toBeNull();
  });

  it("maps username codes to Firebase Auth placeholder emails", () => {
    expect(usernameAccountEmail("USR046")).toBe(
      "usr046@accounts.saintagram.local"
    );
    expect(usernameAccountEmail("USRTEST2")).toBe(
      "usrtest2@accounts.saintagram.local"
    );
    expect(usernameAccountEmail("USR9999")).toBeNull();
  });
});
