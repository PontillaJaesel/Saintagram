import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Firebase configuration", () => {
  it("binds storage and uses the Worker-compatible Firestore transport", () => {
    const browser = readFileSync(resolve(process.cwd(), "lib/firebase.ts"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "lib/firebase-admin.ts"), "utf8");

    expect(browser).toContain("storageBucket: firebaseStorageBucket");
    expect(browser).toContain("`${firebaseProjectId}.firebasestorage.app`");
    expect(browser).toContain("storage: getStorage(app)");
    expect(admin).toContain("`${adminProjectId}.firebasestorage.app`");
    expect(admin).toContain("{ storageBucket }");
    expect(admin).toContain("getFirestoreRestClient() as unknown as Firestore");
  });
});
