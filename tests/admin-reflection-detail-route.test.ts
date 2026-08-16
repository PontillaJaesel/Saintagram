import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  updateAdminReflection: vi.fn(),
  deleteAdminReflection: vi.fn()
}));

vi.mock("@/lib/admin-auth", () => ({
  noStoreHeaders: { "Cache-Control": "no-store" },
  requireAdmin: mocks.requireAdmin,
  adminError: () => Response.json({ error: "Denied" }, { status: 401 })
}));

vi.mock("@/lib/admin-reflections", () => ({
  updateAdminReflection: mocks.updateAdminReflection,
  deleteAdminReflection: mocks.deleteAdminReflection
}));

import { DELETE, PATCH } from "@/app/api/admin/reflections/[reflectionId]/route";

const context = { params: Promise.resolve({ reflectionId: "reflection-1" }) };

describe("admin reflection detail endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ uid: "admin-1" });
  });

  it("updates through the verified administrator identity", async () => {
    mocks.updateAdminReflection.mockResolvedValue({ id: "reflection-1", content: "Updated" });
    const response = await PATCH(new Request("https://admin.example/api/admin/reflections/reflection-1", { method: "PATCH", body: JSON.stringify({ title: "Title", content: "Updated" }) }), context);

    expect(mocks.updateAdminReflection).toHaveBeenCalledWith("admin-1", "reflection-1", { title: "Title", content: "Updated" });
    expect(response.status).toBe(200);
  });

  it("deletes through the verified administrator identity", async () => {
    const response = await DELETE(new Request("https://admin.example/api/admin/reflections/reflection-1", { method: "DELETE" }), context);

    expect(mocks.deleteAdminReflection).toHaveBeenCalledWith("admin-1", "reflection-1");
    await expect(response.json()).resolves.toEqual({ deleted: true });
  });

  it("does not mutate when administrator verification fails", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Denied"));
    const response = await DELETE(new Request("https://admin.example/api/admin/reflections/reflection-1", { method: "DELETE" }), context);

    expect(response.status).toBe(401);
    expect(mocks.deleteAdminReflection).not.toHaveBeenCalled();
  });
});
