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

describe("temporary accounts", () => {
  it("keeps all merged user credentials unique", () => {
    expect(userAccounts).toHaveLength(144);
    expect(new Set(userAccounts.map((account) => account.username)).size).toBe(144);
    expect(new Set(userAccounts.map((account) => account.temporaryPassword)).size).toBe(144);
  });

  it("preserves Alex Pontilla as USR047", () => {
    expect(
      userAccounts.find((account) => account.fullName === "Alex Pontilla")
    ).toEqual({
      fullName: "Alex Pontilla",
      username: "USR047",
      temporaryPassword: "Serve@047",
      role: "user"
    });
  });

  it("keeps the first 47 issued credential assignments unchanged", () => {
    const legacyNames = [
      "Abigail Jacobo", "Alex", "ANA Yanex", "Angelica Sarabia", "Ariana Duran",
      "Arlene Lazareno", "Avigail Altamirano Chavez", "Baudelia Martinez", "Bridget",
      "Carmela D", "Carmen Verduzco", "cinthia castillo", "Cindy Altamirano",
      "Claudia Alvarado", "Davy Ranjel", "Desly Solano", "Evelyn Ventura",
      "Faby Lopez", "Fatima Gutierrez", "Gabby Perez", "GABRIELA ZARAGOZA",
      "Giselle Martinez", "Hector Sarabia", "Herminia Valdez", "Jesus",
      "Jessica Garcia", "Jorge Reynosa", "jorg4006", "Layla", "Leah Valenzuela",
      "Leslie Corona", "lluvia padilla", "Maria Ayala", "Maria Garcia",
      "Maria Martinez", "Mariana Castillo Ortiz", "Martha Valencia", "Miguel",
      "Miley Anguiano", "Monica Cervantes", "Rupert", "Samuel G", "socorro estrada",
      "Sonia Perez", "Victoria Palacios", "Yesenia Rodriguez", "Alex Pontilla"
    ];

    legacyNames.forEach((fullName, index) => {
      const code = String(index + 1).padStart(3, "0");
      expect(userAccounts[index]).toEqual({
        fullName,
        username: `USR${code}`,
        temporaryPassword: `Serve@${code}`,
        role: "user"
      });
    });
  });

  it("recognizes USRTEST3 and its issued temporary credentials", () => {
    expect(TEMPORARY_ACCOUNTS.find((account: TemporaryAccount) => account.username === "USRTEST3")).toEqual({
      fullName: "Saintagram Replacement Test User",
      username: "USRTEST3",
      temporaryPassword: "NewTemp3@2026",
      role: "tester"
    });
  });
});
