const USERNAME_CODE_PATTERN = /^USR(?:\d{3}|TEST)$/i;

export function normalizeUsernameCode(value: string): string | null {
  const normalized = value.trim().toLocaleUpperCase();
  return USERNAME_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function usernameAccountEmail(username: string): string | null {
  const normalized = normalizeUsernameCode(username);
  return normalized
    ? `${normalized.toLocaleLowerCase()}@accounts.saintagram.local`
    : null;
}
