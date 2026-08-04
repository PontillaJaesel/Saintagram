export const HTML_CACHE_CONTROL = "no-store";
export const STATIC_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

const NEXT_STATIC_PREFIX = "/_next/static/";

export function applyResponseCachePolicy(
  request: Request,
  response: Response
): Response {
  const pathname = new URL(request.url).pathname;
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const isSuccessfulStaticAsset =
    pathname.startsWith(NEXT_STATIC_PREFIX) && response.ok;
  const isHtml = contentType.includes("text/html");

  if (!isSuccessfulStaticAsset && !isHtml) return response;

  const headers = new Headers(response.headers);
  headers.set(
    "Cache-Control",
    isSuccessfulStaticAsset ? STATIC_CACHE_CONTROL : HTML_CACHE_CONTROL
  );

  // These Cloudflare-specific headers take precedence over Cache-Control when
  // present. Removing them keeps one unambiguous policy for HTML responses.
  if (isHtml) {
    headers.delete("Cloudflare-CDN-Cache-Control");
    headers.delete("CDN-Cache-Control");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
