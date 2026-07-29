import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const vinextServerEntry = resolve("dist", "server", "index.mjs");
const sitesServerEntry = resolve("dist", "server", "index.js");
const vinextSsrEntry = resolve("dist", "server", "ssr", "index.mjs");
const sitesSsrEntry = resolve("dist", "server", "ssr", "index.js");
const hostingSource = resolve(".openai", "hosting.json");
const hostingDirectory = resolve("dist", ".openai");
const hostingDestination = resolve(hostingDirectory, "hosting.json");

function ensureJavaScriptEntrypoint(javaScriptPath, modulePath, label, relativeImport) {
  if (existsSync(javaScriptPath)) return;
  if (!existsSync(modulePath)) {
    throw new Error(`The vinext ${label} entrypoint was not created.`);
  }
  writeFileSync(
    javaScriptPath,
    `export { default } from "${relativeImport}";\nexport * from "${relativeImport}";\n`,
  );
}

ensureJavaScriptEntrypoint(
  sitesServerEntry,
  vinextServerEntry,
  "server",
  "./index.mjs",
);
ensureJavaScriptEntrypoint(
  sitesSsrEntry,
  vinextSsrEntry,
  "SSR",
  "./index.mjs",
);

if (!existsSync(hostingSource)) {
  throw new Error("The Sites project configuration is missing.");
}

mkdirSync(hostingDirectory, { recursive: true });
copyFileSync(hostingSource, hostingDestination);

console.log("Prepared the Sites runtime entrypoint and metadata in ./dist.");
