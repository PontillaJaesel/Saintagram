export const ACCESS_COOKIE_NAME = "saintagram_access";
export const ACCESS_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MINIMUM_ACCESS_CODE_LENGTH = 12;
export const MINIMUM_SESSION_SECRET_LENGTH = 32;

const TOKEN_VERSION = 1;
const encoder = new TextEncoder();

interface AccessSessionPayload {
  version: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

  try {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(
      value.replace(/-/g, "+").replace(/_/g, "/") + padding
    );
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function importSigningKey(
  secret: string,
  usage: KeyUsage[]
): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage
  );
}

async function signPayload(payload: string, secret: string): Promise<Uint8Array> {
  const key = await importSigningKey(secret, ["sign"]);
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return new Uint8Array(signature);
}

function createNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function hasValidAccessConfiguration(
  accessCode: string | undefined,
  sessionSecret: string | undefined
): boolean {
  return Boolean(
    accessCode &&
      accessCode.length >= MINIMUM_ACCESS_CODE_LENGTH &&
      sessionSecret &&
      sessionSecret.length >= MINIMUM_SESSION_SECRET_LENGTH
  );
}

export async function constantTimeTextEqual(
  submitted: string,
  expected: string
): Promise<boolean> {
  const [submittedKey, expectedSignature] = await Promise.all([
    importSigningKey(submitted, ["verify"]),
    signPayload("saintagram-access-code", expected)
  ]);
  return globalThis.crypto.subtle.verify(
    "HMAC",
    submittedKey,
    bytesToArrayBuffer(expectedSignature),
    encoder.encode("saintagram-access-code")
  );
}

export async function createAccessSessionToken(
  sessionSecret: string,
  now = Date.now()
): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  const payload: AccessSessionPayload = {
    version: TOKEN_VERSION,
    issuedAt,
    expiresAt: issuedAt + ACCESS_SESSION_TTL_SECONDS,
    nonce: createNonce()
  };
  const encodedPayload = bytesToBase64Url(
    encoder.encode(JSON.stringify(payload))
  );
  const signature = await signPayload(encodedPayload, sessionSecret);
  return `${encodedPayload}.${bytesToBase64Url(signature)}`;
}

export async function verifyAccessSessionToken(
  token: string | undefined,
  sessionSecret: string,
  now = Date.now()
): Promise<boolean> {
  if (!token || token.length > 1024) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [encodedPayload, encodedSignature] = parts;
  const signature = base64UrlToBytes(encodedSignature);
  const payloadBytes = base64UrlToBytes(encodedPayload);
  if (!signature || signature.length !== 32 || !payloadBytes) return false;

  try {
    const key = await importSigningKey(sessionSecret, ["verify"]);
    const validSignature = await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      bytesToArrayBuffer(signature),
      encoder.encode(encodedPayload)
    );
    if (!validSignature) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(payloadBytes)
    ) as Partial<AccessSessionPayload>;
    const nowInSeconds = Math.floor(now / 1000);

    return Boolean(
      payload.version === TOKEN_VERSION &&
        Number.isInteger(payload.issuedAt) &&
        Number.isInteger(payload.expiresAt) &&
        typeof payload.nonce === "string" &&
        payload.nonce.length >= 16 &&
        (payload.issuedAt as number) <= nowInSeconds + 60 &&
        (payload.expiresAt as number) > nowInSeconds &&
        (payload.expiresAt as number) - (payload.issuedAt as number) ===
          ACCESS_SESSION_TTL_SECONDS
    );
  } catch {
    return false;
  }
}
