import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface WranglerConfig {
  main?: string;
  assets?: {
    run_worker_first?: boolean | string[];
  };
}

describe("Cloudflare Worker configuration", () => {
  it("uses the cache-policy Worker entrypoint", () => {
    const configPath = join(process.cwd(), "wrangler.jsonc");
    const config = JSON.parse(
      readFileSync(configPath, "utf8")
    ) as WranglerConfig;

    expect(config.main).toBe("worker.ts");
  });

  it("runs the Worker before static assets so the access gate cannot be bypassed", () => {
    const configPath = join(process.cwd(), "wrangler.jsonc");
    const config = JSON.parse(
      readFileSync(configPath, "utf8")
    ) as WranglerConfig;

    expect(config.assets?.run_worker_first).toEqual([
      "/*",
      "!/_next/static/*",
      "!/favicon.ico",
      "!/robots.txt"
    ]);
  });

  it("marks hashed Next.js static assets as immutable", () => {
    const headers = readFileSync(
      join(process.cwd(), "public", "_headers"),
      "utf8"
    );

    expect(headers).toContain("/_next/static/*");
    expect(headers).toContain(
      "Cache-Control: public, max-age=31536000, immutable"
    );
  });
});
