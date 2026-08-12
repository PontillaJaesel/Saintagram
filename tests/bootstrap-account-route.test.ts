import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  updateUser: vi.fn(),
  userGet: vi.fn(),
  userSet: vi.fn()
}));

vi.mock("@/lib/firebase-admin", () => ({
  getFirebaseAdminAuth: () => ({
    getUserByEmail: mocks.getUserByEmail,
    createUser: mocks.createUser,
    deleteUser: mocks.deleteUser,
    updateUser: mocks.updateUser
  }),
  getFirebaseAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({ get: mocks.userGet, set: mocks.userSet })
    })
  })
}));

vi.mock("@/lib/temporary-accounts.server", () => ({
  findTemporaryAccount: (username: string) =>
    username.trim().toUpperCase() === "USRTEST"
      ? {
          username: "USRTEST",
          temporaryPassword: "Temporary123!",
          fullName: "Test User",
          role: "tester"
        }
      : undefined
}));

import { POST } from "@/app/api/bootstrap-account/route";

function request(username: string, password: string) {
  return new Request("http://localhost/api/bootstrap-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
}

describe("temporary Firebase account provisioning", () => {
  beforeEach(() => {
    mocks.getUserByEmail.mockReset();
    mocks.createUser.mockReset();
    mocks.deleteUser.mockReset();
    mocks.updateUser.mockReset();
    mocks.userGet.mockReset();
    mocks.userSet.mockReset();
  });

  it("rejects invalid credentials without touching Firebase", async () => {
    const response = await POST(request("USRTEST", "wrong"));
    expect(response.status).toBe(401);
    expect(mocks.getUserByEmail).not.toHaveBeenCalled();
  });

  it("creates a UID-linked Auth user and first-login metadata", async () => {
    mocks.getUserByEmail.mockRejectedValue({ code: "auth/user-not-found" });
    mocks.createUser.mockResolvedValue({ uid: "firebase-uid" });
    mocks.userSet.mockResolvedValue(undefined);

    const response = await POST(request("usrtest", "Temporary123!"));

    expect(response.status).toBe(201);
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "usrtest@accounts.saintagram.local",
        password: "Temporary123!",
        emailVerified: true
      })
    );
    expect(mocks.userSet).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "firebase-uid",
        username: "USRTEST",
        mustChangePassword: true,
        role: "tester"
      })
    );
  });

  it("does not reactivate a completed first-login credential", async () => {
    mocks.getUserByEmail.mockResolvedValue({ uid: "firebase-uid" });
    mocks.userGet.mockResolvedValue({
      exists: true,
      get: (field: string) => field === "mustChangePassword" ? false : undefined
    });

    const response = await POST(request("USRTEST", "Temporary123!"));

    expect(response.status).toBe(401);
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.userSet).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("repairs a rotated temporary password only during first login", async () => {
    mocks.getUserByEmail.mockResolvedValue({ uid: "firebase-uid" });
    mocks.userGet.mockResolvedValue({
      exists: true,
      get: (field: string) => field === "mustChangePassword" ? true : undefined
    });
    mocks.updateUser.mockResolvedValue({ uid: "firebase-uid" });

    const response = await POST(request("USRTEST", "Temporary123!"));

    expect(response.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledWith("firebase-uid", {
      password: "Temporary123!",
      emailVerified: true,
      displayName: "USRTEST"
    });
  });
});
