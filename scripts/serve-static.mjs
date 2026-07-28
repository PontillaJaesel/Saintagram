import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve("dist");
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function resolveRequestPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = normalize(decoded).replace(/^([/\\])+/, "");
  const candidate = resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;

  const possibilities = [
    candidate,
    join(candidate, "index.html"),
    `${candidate}.html`,
    join(root, "404.html")
  ];
  return possibilities.find(
    (path) => existsSync(path) && statSync(path).isFile()
  );
}

createServer((request, response) => {
  try {
    const filePath = resolveRequestPath(request.url || "/");
    if (!filePath) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Bad request");
      return;
    }
    const isNotFound = filePath.endsWith(`${sep}404.html`);
    response.writeHead(isNotFound ? 404 : 200, {
      "Content-Type":
        contentTypes[extname(filePath).toLowerCase()] ||
        "application/octet-stream",
      "Cache-Control": filePath.endsWith(".html")
        ? "no-cache"
        : "public, max-age=31536000, immutable"
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Server error");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Saintagram is available at http://127.0.0.1:${port}`);
});
