export const HTML_CACHE_CONTROL = "no-store";
export const STATIC_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

const NEXT_STATIC_PREFIX = "/_next/static/";

export function applyResponseCachePolicy(
  request: Request,
  response: Response
): Response {
  const pathname = new URL(request.url).pathname;
  const isSuccessfulStaticAsset =
    pathname.startsWith(NEXT_STATIC_PREFIX) && response.ok;

  const headers = new Headers(response.headers);
  headers.set(
    "Cache-Control",
    isSuccessfulStaticAsset ? STATIC_CACHE_CONTROL : HTML_CACHE_CONTROL
  );

  // These Cloudflare-specific headers take precedence over Cache-Control.
  // Remove them for every dynamic, HTML, RSC, API, redirect, and error response
  // so nothing can override the no-store policy.
  if (!isSuccessfulStaticAsset) {
    headers.delete("Cloudflare-CDN-Cache-Control");
    headers.delete("CDN-Cache-Control");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
