import "server-only";

type CachedToken = {
  value: string;
  expiresAt: number;
};

const tokenCache = new Map<string, CachedToken>();

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

export async function getGoogleServiceAccountAccessToken(
  scopes: string[]
): Promise<string> {
  const normalizedScopes = [...new Set(scopes)]
    .sort()
    .join(" ");

  const cached = tokenCache.get(normalizedScopes);

  if (
    cached &&
    cached.expiresAt > Date.now() + 60_000
  ) {
    return cached.value;
  }

  const clientEmail = env(
    "FIREBASE_ADMIN_CLIENT_EMAIL"
  );

  const privateKey = env(
    "FIREBASE_ADMIN_PRIVATE_KEY"
  ).replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Firebase service-account credentials are not configured."
    );
  }

  const now = Math.floor(
    Date.now() / 1000
  );

  const header = base64Url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT"
    })
  );

  const claim = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: normalizedScopes,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })
  );

  const pem = privateKey.replace(
    /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,
    ""
  );

  const keyBytes = Uint8Array.from(
    atob(pem),
    (character) =>
      character.charCodeAt(0)
  );

  const key =
    await crypto.subtle.importKey(
      "pkcs8",
      keyBytes,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

  const unsignedToken =
    `${header}.${claim}`;

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(
        unsignedToken
      )
    )
  );

  const assertion =
    `${unsignedToken}.${base64Url(
      signature
    )}`;

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type:
          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    }
  );

  const result =
    (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

  if (
    !response.ok ||
    !result.access_token
  ) {
    throw new Error(
      `Google OAuth failed: ${
        result.error_description ??
        result.error ??
        response.statusText
      }`
    );
  }

  const value = result.access_token;

  tokenCache.set(normalizedScopes, {
    value,
    expiresAt:
      Date.now() +
      (result.expires_in ?? 3600) *
        1000
  });

  return value;
}