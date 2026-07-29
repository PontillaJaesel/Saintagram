import { NextResponse } from "next/server";
import { getSafeAccessDestination } from "@/lib/access-path";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_SESSION_TTL_SECONDS,
  constantTimeTextEqual,
  createAccessSessionToken,
  hasValidAccessConfiguration
} from "@/lib/access-session";

const MAXIMUM_REQUEST_BYTES = 1024;
const MAXIMUM_SUBMITTED_CODE_LENGTH = 256;
const encoder = new TextEncoder();

interface AccessRequestBody {
  code?: unknown;
  next?: unknown;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return jsonResponse(
      { error: "That access code was not recognized. Please try again." },
      401
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAXIMUM_REQUEST_BYTES
  ) {
    return jsonResponse(
      { error: "That access code was not recognized. Please try again." },
      401
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return jsonResponse(
      { error: "That access code was not recognized. Please try again." },
      401
    );
  }

  if (encoder.encode(rawBody).byteLength > MAXIMUM_REQUEST_BYTES) {
    return jsonResponse(
      { error: "That access code was not recognized. Please try again." },
      401
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return jsonResponse(
      { error: "That access code was not recognized. Please try again." },
      401
    );
  }

  if (
    typeof parsedBody !== "object" ||
    parsedBody === null ||
    Array.isArray(parsedBody)
  ) {
    return jsonResponse(
      { error: "That access code was not recognized. Please try again." },
      401
    );
  }

  const body = parsedBody as AccessRequestBody;
  const submittedCode =
    typeof body.code === "string" ? body.code.trim() : "";
  if (
    submittedCode.length === 0 ||
    submittedCode.length > MAXIMUM_SUBMITTED_CODE_LENGTH
  ) {
    return jsonResponse(
      { error: "That access code was not recognized. Please try again." },
      401
    );
  }

  const accessCode = process.env.SITE_ACCESS_CODE;
  const sessionSecret = process.env.SITE_ACCESS_SESSION_SECRET;
  if (!hasValidAccessConfiguration(accessCode, sessionSecret)) {
    console.error(
      "The site access gate is missing a valid server-side configuration."
    );
    return jsonResponse(
      {
        error:
          "Private access is temporarily unavailable. Please contact the site owner."
      },
      503
    );
  }

  if (!(await constantTimeTextEqual(submittedCode, accessCode as string))) {
    return jsonResponse(
      { error: "That access code was not recognized. Please try again." },
      401
    );
  }

  const token = await createAccessSessionToken(sessionSecret as string);
  const response = jsonResponse(
    {
      ok: true,
      next: getSafeAccessDestination(body.next)
    },
    200
  );
  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_SESSION_TTL_SECONDS,
    priority: "high"
  });
  return response;
}
