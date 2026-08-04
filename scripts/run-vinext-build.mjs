import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const deploymentId =
  process.env.NEXT_DEPLOYMENT_ID ||
  `saintagram-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

const result = spawnSync(
  process.execPath,
  [resolve("node_modules", "vinext", "dist", "cli.js"), "build"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_DEPLOYMENT_ID: deploymentId
    },
    stdio: "inherit"
  }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
