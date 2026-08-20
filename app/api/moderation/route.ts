import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { MODERATION_POLICY_ERROR, MODERATION_UNAVAILABLE_ERROR, MODERATION_IMAGE_ERROR } from "@/lib/moderation";
import { moderateTextWithProfanityApi } from "@/lib/profanity-api";

export const runtime = "nodejs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      await getFirebaseAdminAuth().verifyIdToken(authHeader.slice(7), true);
    }

    const body = (await request.json().catch(() => ({}))) as {
      kind?: "text" | "image";
      text?: string;
      imageDataUrl?: string;
      fileName?: string;
      mimeType?: string;
      size?: number;
    };

    const kind = body.kind === "image" ? "image" : "text";
    const text = normalizeText(body.text);

    if (kind === "image") {
      const mimeType = body.mimeType ?? "";
      const size = Number(body.size ?? 0);
      if (!/^(image\/jpeg|image\/png|image\/webp)$/.test(mimeType) || size > 10 * 1024 * 1024) {
        return NextResponse.json({ allowed: false, blocked: true, message: MODERATION_IMAGE_ERROR }, { status: 400 });
      }

      const imageDataUrl = normalizeText(body.imageDataUrl);
      if (!imageDataUrl.startsWith("data:image/")) {
        return NextResponse.json({ allowed: false, blocked: true, message: MODERATION_IMAGE_ERROR }, { status: 400 });
      }

      if (!OPENAI_API_KEY) {
        return NextResponse.json({ allowed: true, blocked: false }, { status: 200 });
      }

      const response = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: [
            {
              type: "image_url",
              image_url: { url: imageDataUrl }
            }
          ]
        })
      });

      if (!response.ok) {
        return NextResponse.json({ allowed: false, blocked: true, message: MODERATION_UNAVAILABLE_ERROR }, { status: 503 });
      }

      const payload = await response.json();
      const flagged = Boolean(payload?.results?.[0]?.flagged);
      if (flagged) {
        return NextResponse.json({ allowed: false, blocked: true, message: MODERATION_POLICY_ERROR }, { status: 400 });
      }

      return NextResponse.json({ allowed: true, blocked: false }, { status: 200 });
    }

    if (!text.trim()) {
      return NextResponse.json({ allowed: true, blocked: false }, { status: 200 });
    }

    const decision = await moderateTextWithProfanityApi(text);
    if (!decision.allowed || decision.blocked) {
      return NextResponse.json(
        { allowed: false, blocked: true, message: decision.reason, source: decision.source },
        { status: 400 }
      );
    }

    return NextResponse.json({ allowed: true, blocked: false, source: decision.source }, { status: 200 });
  } catch (error) {
    console.error("Moderation failed.", error);
    return NextResponse.json({ allowed: false, blocked: true, message: MODERATION_UNAVAILABLE_ERROR }, { status: 503 });
  }
}
