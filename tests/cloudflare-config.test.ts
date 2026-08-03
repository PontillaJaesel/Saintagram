import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface WranglerConfig {
  assets?: {
    run_worker_first?: boolean | string[];
  };
}

describe("Cloudflare Worker configuration", () => {
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
});
