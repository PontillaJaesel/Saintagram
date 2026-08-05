import vinextHandler from "vinext/server/fetch-handler";

import { applyResponseCachePolicy } from "./lib/cache-policy";

type VinextFetch = typeof vinextHandler.fetch;

export default {
  async fetch(
    request: Parameters<VinextFetch>[0],
    env: Parameters<VinextFetch>[1],
    context: Parameters<VinextFetch>[2]
  ): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/_next/static/")) {
      const response = await env.ASSETS.fetch(request);
      return applyResponseCachePolicy(request, response);
    }

    const response = await vinextHandler.fetch(request, env, context);
    return applyResponseCachePolicy(request, response);
  }
};
