import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [configArgument, expectedName, expectedMode] = process.argv.slice(2);
if (!configArgument || !expectedName || !expectedMode) {
  throw new Error("Usage: validate-deployment-target CONFIG WORKER_NAME APP_MODE");
}

const config = JSON.parse(readFileSync(resolve(configArgument), "utf8"));
const actualMode = config.vars?.SAINTAGRAM_APP_MODE;
if (config.name !== expectedName || actualMode !== expectedMode) {
  throw new Error(
    `Deployment target mismatch: expected ${expectedName}/${expectedMode}, received ${String(config.name)}/${String(actualMode)}.`
  );
}

console.log(`Validated deployment target ${expectedName} (${expectedMode}).`);
