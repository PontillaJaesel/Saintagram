import "server-only";

const FIREBASE_CUSTOM_TOKEN_AUDIENCE =
  "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function base64Url(value: string | Uint8Array): string {
  const bytes =
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : value;

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function importPrivateKey(privateKey: string): Promise<CryptoKey> {
  const pem = privateKey.replace(
    /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,
    ""
  );

  const keyBytes = Uint8Array.from(
    atob(pem),
    (character) => character.charCodeAt(0)
  );

  return crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
}

export async function createFirebaseCustomToken(
  userId: string
): Promise<string> {
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(userId)) {
    throw new Error("Invalid Firebase user ID.");
  }

  const clientEmail = env("FIREBASE_ADMIN_CLIENT_EMAIL");
  const privateKey = env("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Firebase service-account credentials are not configured."
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT"
    })
  );
  const payload = base64Url(
    JSON.stringify({
      iss: clientEmail,
      sub: clientEmail,
      aud: FIREBASE_CUSTOM_TOKEN_AUDIENCE,
      iat: now,
      exp: now + 5 * 60,
      uid: userId
    })
  );
  const unsignedToken = `${header}.${payload}`;
  const key = await importPrivateKey(privateKey);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsignedToken)
    )
  );

  return `${unsignedToken}.${base64Url(signature)}`;
}
