import "server-only";
import { normalizeUsernameCode } from "@/lib/account-identity";

export interface TemporaryAccountCredential {
  fullName: string;
  username: string;
  temporaryPassword: string;
  role: "user" | "tester";
}

const USER_NAMES = [
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
  "Sonia Perez", "Victoria Palacios", "Yesenia Rodriguez"
] as const;

export const TEMPORARY_ACCOUNTS: readonly TemporaryAccountCredential[] = [
  ...USER_NAMES.map((fullName, index) => {
    const code = String(index + 1).padStart(3, "0");
    return {
      fullName,
      username: `USR${code}`,
      temporaryPassword: `Serve@${code}`,
      role: "user" as const
    };
  }),
  {
    fullName: "Saintagram Test User",
    username: "USRTEST",
    temporaryPassword: "NewTemp@2026",
    role: "tester"
  }
];

export function findTemporaryAccount(username: string) {
  const normalized = normalizeUsernameCode(username);
  return normalized
    ? TEMPORARY_ACCOUNTS.find((account) => account.username === normalized)
    : undefined;
}
