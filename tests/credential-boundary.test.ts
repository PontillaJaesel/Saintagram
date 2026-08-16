import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("issued credential boundary", () => {
  it("keeps temporary passwords out of client-reachable authentication code", () => {
    const clientSources = [
      source("app/auth/page.tsx"),
      source("components/providers/auth-provider.tsx"),
      source("lib/app-service.ts"),
      source("lib/account-identity.ts")
    ].join("\n");

    expect(clientSources).not.toContain("Serve@");
    expect(clientSources).not.toContain("NewTemp@2026");
    expect(clientSources).not.toContain("temporary-accounts.server");
  });

  it("marks the issued-account registry as server-only", () => {
    const registry = source("lib/temporary-accounts.server.ts");
    const data = source("lib/temporary-accounts.data.mjs");
    expect(registry).toContain('import "server-only"');
    expect(registry).toContain("temporary-accounts.data.mjs");
    expect(data).toContain("Serve@");
  });
});
