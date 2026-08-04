import { describe, expect, it } from "vitest";

import {
  applyResponseCachePolicy,
  HTML_CACHE_CONTROL,
  STATIC_CACHE_CONTROL
} from "@/lib/cache-policy";

describe("Cloudflare response cache policy", () => {
  it("disables caching for HTML while preserving other headers", async () => {
    const request = new Request("https://saintagram.example/profile");
    const response = new Response("<html></html>", {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Cloudflare-CDN-Cache-Control": "public, max-age=300",
        "Content-Type": "text/html; charset=utf-8",
        "X-Saintagram": "preserved"
      }
    });

    const result = applyResponseCachePolicy(request, response);

    expect(result.headers.get("cache-control")).toBe(HTML_CACHE_CONTROL);
    expect(result.headers.get("cloudflare-cdn-cache-control")).toBeNull();
    expect(result.headers.get("x-saintagram")).toBe("preserved");
    expect(await result.text()).toBe("<html></html>");
  });

  it("caches successful hashed static assets for one year", () => {
    const request = new Request(
      "https://saintagram.example/_next/static/chunks/app-a1b2c3.js"
    );
    const response = new Response("asset", {
      headers: { "Content-Type": "text/javascript" }
    });

    const result = applyResponseCachePolicy(request, response);

    expect(result.headers.get("cache-control")).toBe(STATIC_CACHE_CONTROL);
  });

  it("does not cache missing static assets", () => {
    const request = new Request(
      "https://saintagram.example/_next/static/chunks/missing.js"
    );
    const response = new Response("missing", {
      status: 404,
      headers: { "Cache-Control": "no-store" }
    });

    const result = applyResponseCachePolicy(request, response);

    expect(result).toBe(response);
    expect(result.headers.get("cache-control")).toBe("no-store");
  });

  it("leaves non-HTML application responses unchanged", () => {
    const request = new Request("https://saintagram.example/api/access");
    const response = Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );

    expect(applyResponseCachePolicy(request, response)).toBe(response);
  });
});
