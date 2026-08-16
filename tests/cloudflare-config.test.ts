import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface WranglerConfig {
  name?: string;
  main?: string;
  vars?: Record<string, string>;
  assets?: {
    run_worker_first?: boolean | string[];
  };
}

describe("Cloudflare Worker configuration", () => {
  it("defines the CommonJS dirname global required by Firebase Admin", () => {
    const viteConfig = readFileSync(
      join(process.cwd(), "vite.config.ts"),
      "utf8"
    );

    expect(viteConfig).toContain('__dirname: JSON.stringify("/")');
  });

  it("rebuilds and validates artifacts before every direct deployment", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8")
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.deploy).toContain("npm run build");
    expect(packageJson.scripts?.["deploy:vinext"]).toBe("npm run deploy");
    expect(packageJson.scripts?.build).toContain(
      "scripts/validate-deployment-artifacts.mjs"
    );
  });

  it("uses the cache-policy Worker entrypoint", () => {
    const configPath = join(process.cwd(), "wrangler.jsonc");
    const config = JSON.parse(
      readFileSync(configPath, "utf8")
    ) as WranglerConfig;

    expect(config.main).toBe("worker.ts");
    expect(config.name).toBe("saintagram");
    expect(config.vars?.SAINTAGRAM_APP_MODE).toBe("normal");
  });

  it("uses separate fail-closed deployment targets", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8")
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.deploy).toContain(
      "dist/server/wrangler.json saintagram normal"
    );
    expect(packageJson.scripts?.["deploy:admin"]).toContain(
      "dist/server/wrangler.admin.json saintagram-admin admin"
    );
  });

  it("runs hashed static assets through the cache-policy Worker", () => {
    const configPath = join(process.cwd(), "wrangler.jsonc");
    const config = JSON.parse(
      readFileSync(configPath, "utf8")
    ) as WranglerConfig;

    expect(config.assets?.run_worker_first).toEqual([
      "/*",
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
