import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  deleteAllNonAdminRecords: vi.fn()
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: mocks.requireAdmin,
  noStoreHeaders: { "Cache-Control": "no-store" },
  adminError: () => Response.json({ error: "Admin request failed." }, { status: 500 })
}));
vi.mock("@/lib/admin-delete-records", () => ({
  deleteAllNonAdminRecords: mocks.deleteAllNonAdminRecords
}));

import { POST } from "@/app/api/admin/delete-all-records/route";

describe("admin delete-all-records route", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ uid: "admin-1", admin: true });
    mocks.deleteAllNonAdminRecords.mockResolvedValue({ firestoreRecords: 10, mediaFiles: 3, userAccounts: 2 });
  });

  it("rejects a request without the exact destructive confirmation", async () => {
    const response = await POST(new Request("http://localhost/api/admin/delete-all-records", { method: "POST", body: JSON.stringify({ confirmation: "delete" }) }));
    expect(response.status).toBe(400);
    expect(mocks.deleteAllNonAdminRecords).not.toHaveBeenCalled();
  });

  it("deletes records only after verified admin confirmation", async () => {
    const response = await POST(new Request("http://localhost/api/admin/delete-all-records", { method: "POST", body: JSON.stringify({ confirmation: "DELETE ALL RECORDS" }) }));
    expect(response.status).toBe(200);
    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.deleteAllNonAdminRecords).toHaveBeenCalledWith("admin-1");
    expect(await response.json()).toEqual({ firestoreRecords: 10, mediaFiles: 3, userAccounts: 2 });
  });
});
