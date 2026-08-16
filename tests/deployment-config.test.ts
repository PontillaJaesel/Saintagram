import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const nextConfig = readFileSync(resolve("next.config.ts"), "utf8");
const packageJson = JSON.parse(
  readFileSync(resolve("package.json"), "utf8")
) as { scripts: Record<string, string> };
const buildRunner = readFileSync(
  resolve("scripts/run-vinext-build.mjs"),
  "utf8"
);

describe("production deployment versioning", () => {
  it("passes a unique deployment ID into each standard production build", () => {
    expect(nextConfig).toContain(
      "deploymentId: process.env.NEXT_DEPLOYMENT_ID"
    );
    expect(packageJson.scripts.build).toContain("run-vinext-build.mjs");
    expect(packageJson.scripts["build:vinext"]).toContain(
      "run-vinext-build.mjs"
    );
    expect(packageJson.scripts.deploy).toContain("npm run build");
    expect(buildRunner).toContain("NEXT_DEPLOYMENT_ID: deploymentId");
    expect(buildRunner).toContain("randomUUID()");
  });
});
