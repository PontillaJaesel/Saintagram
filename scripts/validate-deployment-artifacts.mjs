import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync
} from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = process.cwd();
const serverRoot = resolve(projectRoot, "dist", "server");
const clientRoot = resolve(projectRoot, "dist", "client");
const serverEntry = resolve(serverRoot, "index.js");
const buildIdPath = resolve(serverRoot, "BUILD_ID");
const clientManifestPath = resolve(serverRoot, "vinext-client-assets.js");
const headersPath = resolve(clientRoot, "_headers");

const requiredFiles = [
  serverEntry,
  buildIdPath,
  clientManifestPath,
  headersPath
];

const missing = requiredFiles.filter((file) => !existsSync(file));

function walkJavaScript(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) files.push(...walkJavaScript(path));
    else if (stats.isFile() && /\.(?:m?js)$/.test(entry)) files.push(path);
  }
  return files;
}

if (missing.length === 0) {
  const importPattern =
    /(?:from\s*|import\s*\(?\s*)["'](\.{1,2}\/[^"']+)["']/g;

  for (const modulePath of walkJavaScript(serverRoot)) {
    const source = readFileSync(modulePath, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const importedPath = resolve(dirname(modulePath), match[1]);
      if (!existsSync(importedPath)) missing.push(importedPath);
    }
  }

  const clientManifest = readFileSync(clientManifestPath, "utf8");
  const assetPattern = /["'](\/_next\/static\/[^"']+)["']/g;
  for (const match of clientManifest.matchAll(assetPattern)) {
    const assetPath = resolve(clientRoot, match[1].slice(1));
    if (!existsSync(assetPath)) missing.push(assetPath);
  }

  const headers = readFileSync(headersPath, "utf8");
  if (
    !headers.includes("/_next/static/*") ||
    !headers.includes("public, max-age=31536000, immutable")
  ) {
    throw new Error(
      "The built static asset cache policy is missing or incomplete."
    );
  }
}

const uniqueMissing = [...new Set(missing)];
if (uniqueMissing.length > 0) {
  throw new Error(
    `Deployment artifact validation failed. Missing files:\n${uniqueMissing
      .map((file) => `- ${file}`)
      .join("\n")}`
  );
}

const buildId = readFileSync(buildIdPath, "utf8").trim();
if (!buildId) throw new Error("The deployment BUILD_ID is empty.");

console.log(`Validated one complete deployment build (${buildId}).`);
