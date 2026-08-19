import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const rules = readFileSync(resolve(process.cwd(), "storage.rules"), "utf8");

describe("Firebase Storage policy", () => {
  it("allows signed-in profile-image reads while keeping writes owner-only", () => {
    expect(rules).toContain("match /users/{userId}/profile/{imageName}");
    expect(rules).toContain("request.auth.token.get('email_verified', false) == true");
    expect(rules).toContain("allow create: if isOwner(userId)");
    expect(rules).toContain("imageName.matches('^[A-Za-z0-9_-]+\\\\.(jpg|png|webp)$')");
    expect(rules).toContain("request.resource.size < 2097152");
    expect(rules).toContain("request.resource.contentType.matches('image/(jpeg|png|webp)')");
    expect(rules).toContain("allow delete: if isOwner(userId);");
    expect(rules).toContain("allow update: if false;");
  });

  it("allows only owner-created cover photos up to 5 MB", () => {
    expect(rules).toContain("match /users/{userId}/cover/{imageName}");
    expect(rules).toContain("request.resource.size < 5242880");
    expect(rules).toContain("allow delete: if isOwner(userId);");
  });
});
