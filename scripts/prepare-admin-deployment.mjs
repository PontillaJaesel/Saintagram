import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const normalConfigPath = resolve("dist", "server", "wrangler.json");
const adminConfigPath = resolve("dist", "server", "wrangler.admin.json");
const normalConfig = JSON.parse(readFileSync(normalConfigPath, "utf8"));

if (normalConfig.name !== "saintagram") {
  throw new Error(
    `Refusing to derive the admin deployment from unexpected Worker ${JSON.stringify(normalConfig.name)}.`
  );
}

if (normalConfig.vars?.SAINTAGRAM_APP_MODE !== "normal") {
  throw new Error("The normal Worker must declare SAINTAGRAM_APP_MODE=normal.");
}

const adminConfig = {
  ...normalConfig,
  name: "saintagram-admin",
  topLevelName: "saintagram-admin",
  vars: {
    ...normalConfig.vars,
    SAINTAGRAM_APP_MODE: "admin"
  }
};

writeFileSync(adminConfigPath, `${JSON.stringify(adminConfig)}\n`);
console.log("Prepared isolated admin deployment config for Worker saintagram-admin.");
