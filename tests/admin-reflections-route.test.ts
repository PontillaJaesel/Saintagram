import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  publishAdminReflection: vi.fn(),
  listAdminReflections: vi.fn()
}));

vi.mock("@/lib/admin-auth", () => ({
  noStoreHeaders: { "Cache-Control": "no-store" },
  requireAdmin: mocks.requireAdmin,
  adminError: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : "Admin request failed." },
      { status: 401 }
    )
}));

vi.mock("@/lib/admin-reflections", () => ({
  publishAdminReflection: mocks.publishAdminReflection,
  listAdminReflections: mocks.listAdminReflections
}));

import { GET, POST } from "@/app/api/admin/reflections/route";

describe("admin reflection endpoint", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset();
    mocks.publishAdminReflection.mockReset();
    mocks.listAdminReflections.mockReset();
    mocks.requireAdmin.mockResolvedValue({ uid: "admin-1" });
  });

  it("lists only reflections owned by the verified administrator", async () => {
    mocks.listAdminReflections.mockResolvedValue([{ id: "reflection-1", title: "Grace" }]);

    const response = await GET(new Request("https://admin.example/api/admin/reflections"));

    expect(mocks.listAdminReflections).toHaveBeenCalledWith("admin-1");
    await expect(response.json()).resolves.toEqual({
      reflections: [{ id: "reflection-1", title: "Grace" }]
    });
  });

  it("publishes through the verified administrator identity", async () => {
    mocks.publishAdminReflection.mockResolvedValue({
      reflectionId: "reflection-1",
      notifiedUsers: 12
    });

    const response = await POST(
      new Request("https://admin.saintagram.com/api/admin/reflections", {
        method: "POST",
        body: JSON.stringify({ title: "Grace", content: "A public reflection" })
      })
    );

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.publishAdminReflection).toHaveBeenCalledWith("admin-1", {
      title: "Grace",
      content: "A public reflection"
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      reflectionId: "reflection-1",
      notifiedUsers: 12
    });
  });

  it("does not publish when administrator verification fails", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Administrator access is required."));

    const response = await POST(
      new Request("https://admin.saintagram.com/api/admin/reflections", {
        method: "POST",
        body: JSON.stringify({ content: "Not authorized" })
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.publishAdminReflection).not.toHaveBeenCalled();
  });
});
