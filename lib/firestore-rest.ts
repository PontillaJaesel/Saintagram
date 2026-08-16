type JsonObject = Record<string, unknown>;
type RestValue = Record<string, unknown>;
type RestDocument = { name: string; fields?: Record<string, RestValue> };

let cachedToken: { value: string; expiresAt: number } | null = null;

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function base64Url(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const clientEmail = env("FIREBASE_ADMIN_CLIENT_EMAIL");
  const privateKey = env("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Firebase service-account credentials are not configured.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const pem = privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (character) => character.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`)));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claim}.${base64Url(signature)}` })
  });
  const result = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !result.access_token) throw new Error(`Firebase OAuth failed: ${result.error_description ?? response.statusText}`);
  cachedToken = { value: result.access_token, expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

function projectId(): string {
  const value = env("FIREBASE_ADMIN_PROJECT_ID") || env("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!value) throw new Error("The Firebase project ID is not configured.");
  return value;
}

function documentRoot(): string {
  return `projects/${projectId()}/databases/(default)/documents`;
}

function apiRoot(): string {
  return `https://firestore.googleapis.com/v1/${documentRoot()}`;
}

async function firestoreFetch(path: string, init?: RequestInit, allowNotFound = false): Promise<Response> {
  const response = await fetch(`${apiRoot()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...init?.headers }
  });
  if (allowNotFound && response.status === 404) return response;
  if (!response.ok) throw new Error(`Firestore REST ${response.status}: ${await response.text()}`);
  return response;
}

function isServerTimestamp(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && value.constructor?.name === "ServerTimestampTransform");
}

function encodeValue(value: unknown): RestValue {
  if (isServerTimestamp(value)) return { timestampValue: new Date().toISOString() };
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (value && typeof value === "object") return { mapValue: { fields: encodeFields(value as JsonObject) } };
  return { nullValue: null };
}

function encodeFields(data: JsonObject): Record<string, RestValue> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined).map(([key, value]) => [key, encodeValue(value)]));
}

function decodeValue(value: RestValue): unknown {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("bytesValue" in value) return value.bytesValue;
  if ("geoPointValue" in value) return value.geoPointValue;
  if ("arrayValue" in value) return ((value.arrayValue as { values?: RestValue[] }).values ?? []).map(decodeValue);
  if ("mapValue" in value) return decodeFields((value.mapValue as { fields?: Record<string, RestValue> }).fields ?? {});
  return null;
}

function decodeFields(fields: Record<string, RestValue>): JsonObject {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

class RestDocumentSnapshot {
  readonly exists: boolean;
  readonly id: string;
  readonly ref: RestDocumentReference;
  private readonly value?: JsonObject;
  constructor(ref: RestDocumentReference, document?: RestDocument) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = Boolean(document);
    this.value = document ? decodeFields(document.fields ?? {}) : undefined;
  }
  data(): JsonObject | undefined { return this.value; }
  get(field: string): unknown { return this.value?.[field]; }
}

class RestQuerySnapshot {
  readonly size: number;
  constructor(readonly docs: RestDocumentSnapshot[]) { this.size = docs.length; }
}

class RestDocumentReference {
  readonly id: string;
  constructor(readonly path: string) { this.id = path.split("/").at(-1) ?? ""; }
  async get(): Promise<RestDocumentSnapshot> {
    const response = await firestoreFetch(`/${this.path}`, undefined, true);
    return response.status === 404 ? new RestDocumentSnapshot(this) : new RestDocumentSnapshot(this, await response.json() as RestDocument);
  }
  async set(data: JsonObject): Promise<void> {
    await firestoreFetch(`/${this.path}`, { method: "PATCH", body: JSON.stringify({ fields: encodeFields(data) }) });
  }
  async update(data: JsonObject): Promise<void> {
    const query = Object.keys(data).filter((key) => data[key] !== undefined).map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join("&");
    await firestoreFetch(`/${this.path}?${query}`, { method: "PATCH", body: JSON.stringify({ fields: encodeFields(data) }) });
  }
  async delete(): Promise<void> { await firestoreFetch(`/${this.path}`, { method: "DELETE" }, true); }
}

class RestQuery {
  constructor(readonly collectionPath: string, readonly field?: string, readonly expected?: unknown, readonly maximum?: number) {}
  where(field: string, operator: string, expected: unknown): RestQuery {
    if (operator !== "==") throw new Error(`Unsupported Firestore REST query operator: ${operator}`);
    return new RestQuery(this.collectionPath, field, expected, this.maximum);
  }
  limit(maximum: number): RestQuery { return new RestQuery(this.collectionPath, this.field, this.expected, maximum); }
  async get(): Promise<RestQuerySnapshot> {
    const documents: RestDocument[] = [];
    let pageToken = "";
    do {
      const remaining = this.maximum ? this.maximum - documents.length : 1000;
      if (remaining <= 0) break;
      const query = new URLSearchParams({ pageSize: String(Math.min(1000, remaining)), showMissing: "false" });
      if (pageToken) query.set("pageToken", pageToken);
      const response = await firestoreFetch(`/${this.collectionPath}?${query}`);
      const result = await response.json() as { documents?: RestDocument[]; nextPageToken?: string };
      documents.push(...(result.documents ?? []));
      pageToken = result.nextPageToken ?? "";
    } while (pageToken);
    const snapshots = documents.map((document) => new RestDocumentSnapshot(new RestDocumentReference(document.name.split("/documents/")[1] ?? ""), document));
    return new RestQuerySnapshot(this.field ? snapshots.filter((snapshot) => snapshot.get(this.field!) === this.expected) : snapshots);
  }
}

class RestCollectionReference extends RestQuery {
  constructor(path: string) { super(path); }
  doc(id = crypto.randomUUID().replace(/-/g, "")): RestDocumentReference { return new RestDocumentReference(`${this.collectionPath}/${id}`); }
  async add(data: JsonObject): Promise<RestDocumentReference> { const ref = this.doc(); await ref.set(data); return ref; }
}

type BatchOperation = { kind: "set" | "update" | "delete"; ref: RestDocumentReference; data?: JsonObject };
class RestWriteBatch {
  private operations: BatchOperation[] = [];
  set(ref: RestDocumentReference, data: JsonObject): this { this.operations.push({ kind: "set", ref, data }); return this; }
  update(ref: RestDocumentReference, data: JsonObject): this { this.operations.push({ kind: "update", ref, data }); return this; }
  delete(ref: RestDocumentReference): this { this.operations.push({ kind: "delete", ref }); return this; }
  async commit(): Promise<void> {
    const writes = this.operations.map((operation) => operation.kind === "delete"
      ? { delete: `${documentRoot()}/${operation.ref.path}` }
      : {
          update: { name: `${documentRoot()}/${operation.ref.path}`, fields: encodeFields(operation.data ?? {}) },
          ...(operation.kind === "update" ? { updateMask: { fieldPaths: Object.keys(operation.data ?? {}).filter((key) => operation.data?.[key] !== undefined) } } : {})
        });
    await firestoreFetch(":commit", { method: "POST", body: JSON.stringify({ writes }) });
  }
}

export class FirestoreRestClient {
  collection(path: string): RestCollectionReference { return new RestCollectionReference(path); }
  batch(): RestWriteBatch { return new RestWriteBatch(); }
}

let client: FirestoreRestClient | null = null;
export function getFirestoreRestClient(): FirestoreRestClient {
  client ??= new FirestoreRestClient();
  return client;
}
