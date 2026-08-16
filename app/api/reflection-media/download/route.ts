import { Readable } from "node:stream";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore,
  getFirebaseAdminStorage
} from "@/lib/firebase-admin";

export const runtime = "nodejs";

const MEDIA_PATH = /^users\/([A-Za-z0-9_-]{1,128})\/reflections\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9_-]+\.(?:jpg|png|webp|mp4|webm|mov))$/;

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return jsonError("Authentication is required.", 401);
    const verified = await getFirebaseAdminAuth().verifyIdToken(authorization.slice(7), true);
    const body = await request.json() as { path?: unknown };
    if (typeof body.path !== "string") return jsonError("A valid media path is required.", 400);
    const match = MEDIA_PATH.exec(body.path);
    if (!match) return jsonError("A valid media path is required.", 400);
    const [, ownerId, reflectionId, filename] = match;
    const reflection = await getFirebaseAdminFirestore().collection("reflectionPosts").doc(reflectionId).get();
    const storedMedia = reflection.get("media");
    const belongsToReflection = Array.isArray(storedMedia)
      && storedMedia.some((item) => item && typeof item === "object" && (item as { path?: unknown }).path === body.path);
    if (!reflection.exists || reflection.get("userId") !== ownerId || !belongsToReflection) {
      return jsonError("That media could not be found.", 404);
    }
    if (reflection.get("isPrivate") === true && verified.uid !== ownerId && verified.admin !== true) {
      return jsonError("You do not have permission to download that media.", 403);
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucketName) throw new Error("Firebase Storage is not configured.");
    const file = getFirebaseAdminStorage().bucket(bucketName).file(body.path);
    const [metadata] = await file.getMetadata();
    const stream = Readable.toWeb(file.createReadStream()) as ReadableStream;
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        ...(metadata.size ? { "Content-Length": String(metadata.size) } : {})
      }
    });
  } catch (error) {
    console.error("Reflection media download failed.", error);
    return jsonError("The media could not be downloaded.", 500);
  }
}
