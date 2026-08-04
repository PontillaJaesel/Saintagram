import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

const VALID_IMAGE_PATH =
  "users/alice/profile/04fefae1-e03e-42ee-9cd4-dc86823426e8.png";

const mocks = vi.hoisted(() => {
  const upload = vi.fn();
  const download = vi.fn();
  const remove = vi.fn();
  const list = vi.fn();
  const from = vi.fn(() => ({ upload, download, remove, list }));
  const getIdToken = vi.fn();
  return {
    upload,
    download,
    remove,
    list,
    from,
    getIdToken,
    supabaseConfigured: true,
    currentUser: {
      uid: "alice",
      getIdToken
    }
  };
});

vi.mock("@/lib/firebase", () => ({
  getFirebaseServices: () => ({
    auth: { currentUser: mocks.currentUser }
  })
}));

vi.mock("@/lib/supabase", () => ({
  PROFILE_IMAGES_BUCKET: "profile-images",
  get isSupabaseConfigured() {
    return mocks.supabaseConfigured;
  },
  getSupabaseClient: () => ({
    storage: { from: mocks.from }
  })
}));

import {
  deleteAllSupabaseProfileImages,
  deleteSupabaseProfileImage,
  downloadSupabaseProfileImage,
  isLocalProfileImageSource,
  isOwnedProfileImagePath,
  profileImageFolder,
  uploadSupabaseProfileImage
} from "@/lib/profile-images";

describe("Supabase profile-image storage", () => {
  beforeEach(() => {
    mocks.currentUser.uid = "alice";
    mocks.supabaseConfigured = true;
    mocks.getIdToken.mockResolvedValue("header.payload.signature");
    mocks.upload.mockResolvedValue({ data: {}, error: null });
    mocks.download.mockResolvedValue({
      data: new Blob(["image"], { type: "image/png" }),
      error: null
    });
    mocks.remove.mockResolvedValue({
      data: [{ id: "removed", name: "avatar.png" }],
      error: null
    });
    mocks.list.mockResolvedValue({ data: [], error: null });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the exact bucket and owner folder for a new UUID object", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "04fefae1-e03e-42ee-9cd4-dc86823426e8"
    );
    const file = new File(["image"], "avatar.png", { type: "image/png" });

    await expect(uploadSupabaseProfileImage("alice", file)).resolves.toBe(
      VALID_IMAGE_PATH
    );
    expect(mocks.from).toHaveBeenCalledWith("profile-images");
    expect(mocks.upload).toHaveBeenCalledWith(
      VALID_IMAGE_PATH,
      file,
      expect.objectContaining({
        contentType: "image/png",
        upsert: false
      })
    );
  });

  it("recognizes only exact owner paths and local demo image data", () => {
    expect(profileImageFolder("alice")).toBe("users/alice/profile");
    expect(isOwnedProfileImagePath(VALID_IMAGE_PATH, "alice")).toBe(true);
    expect(isOwnedProfileImagePath(VALID_IMAGE_PATH, "bob")).toBe(false);
    expect(
      isOwnedProfileImagePath(
        "users/alice/profile/not-a-uuid.png",
        "alice"
      )
    ).toBe(false);
    expect(
      isLocalProfileImageSource("data:image/webp;base64,aGVsbG8=")
    ).toBe(true);
    expect(isLocalProfileImageSource("https://example.test/image.png")).toBe(
      false
    );
  });

  it("uses the Firebase token directly without provisioning a custom role", async () => {
    await expect(
      downloadSupabaseProfileImage(VALID_IMAGE_PATH)
    ).resolves.toEqual(expect.any(Blob));
    expect(mocks.getIdToken).toHaveBeenCalledOnce();
    expect(mocks.download).toHaveBeenCalledWith(VALID_IMAGE_PATH);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports missing Supabase configuration before changing claims", async () => {
    mocks.supabaseConfigured = false;
    await expect(
      downloadSupabaseProfileImage(VALID_IMAGE_PATH)
    ).rejects.toThrow(/Supabase image storage is not configured/i);
    expect(mocks.getIdToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects another user's path before sending a delete request", async () => {
    await expect(
      deleteSupabaseProfileImage(
        "alice",
        "users/bob/profile/14fefae1-e03e-42ee-9cd4-dc86823426e8.png"
      )
    ).rejects.toThrow(/does not belong/i);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("deletes an image from the signed-in owner's storage folder", async () => {
    await expect(
      deleteSupabaseProfileImage("alice", VALID_IMAGE_PATH)
    ).resolves.toBeUndefined();

    expect(mocks.getIdToken).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith("profile-images");
    expect(mocks.remove).toHaveBeenCalledWith([VALID_IMAGE_PATH]);
  });

  it("reports an actionable error when refreshed image access is rejected", async () => {
    const policyError = {
      statusCode: "403",
      message: "new row violates row-level security policy"
    };
    mocks.upload
      .mockResolvedValueOnce({ data: null, error: policyError })
      .mockResolvedValueOnce({ data: null, error: policyError });
    const file = new File(["image"], "avatar.png", { type: "image/png" });

    await expect(uploadSupabaseProfileImage("alice", file)).rejects.toThrow(
      /apply the Supabase image-access migration/i
    );
  });

  it("refreshes the Firebase token and retries upload without a server auth call", async () => {
    mocks.upload
      .mockResolvedValueOnce({
        data: null,
        error: {
          statusCode: "403",
          message: "new row violates row-level security policy"
        }
      })
      .mockResolvedValueOnce({ data: {}, error: null });
    const file = new File(["image"], "avatar.png", { type: "image/png" });

    await expect(uploadSupabaseProfileImage("alice", file)).resolves.toMatch(
      /^users\/alice\/profile\//
    );

    expect(mocks.getIdToken).toHaveBeenCalledWith(true);
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports an actionable error when the private bucket is missing", async () => {
    mocks.upload.mockResolvedValueOnce({
      data: null,
      error: { statusCode: "404", message: "Bucket not found" }
    });
    const file = new File(["image"], "avatar.png", { type: "image/png" });

    await expect(uploadSupabaseProfileImage("alice", file)).rejects.toThrow(
      /private image bucket is missing/i
    );
  });

  it("removes every listed object during account deletion", async () => {
    mocks.list
      .mockResolvedValueOnce({
        data: [
          {
            id: "first",
            name: "04fefae1-e03e-42ee-9cd4-dc86823426e8.png"
          },
          {
            id: "second",
            name: "14fefae1-e03e-42ee-9cd4-dc86823426e8.webp"
          }
        ],
        error: null
      })
      .mockResolvedValueOnce({ data: [], error: null });
    mocks.remove.mockResolvedValueOnce({
      data: [{ id: "first" }, { id: "second" }],
      error: null
    });

    await deleteAllSupabaseProfileImages("alice");

    expect(mocks.remove).toHaveBeenCalledWith([
      VALID_IMAGE_PATH,
      "users/alice/profile/14fefae1-e03e-42ee-9cd4-dc86823426e8.webp"
    ]);
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it("fails closed when cleanup finds a nested folder or makes no progress", async () => {
    mocks.list.mockResolvedValueOnce({
      data: [{ id: null, name: "unexpected" }],
      error: null
    });
    await expect(
      deleteAllSupabaseProfileImages("alice")
    ).rejects.toThrow(/nested/i);

    mocks.list.mockResolvedValueOnce({
      data: [
        {
          id: "first",
          name: "04fefae1-e03e-42ee-9cd4-dc86823426e8.png"
        }
      ],
      error: null
    });
    mocks.remove.mockResolvedValueOnce({ data: [], error: null });
    await expect(
      deleteAllSupabaseProfileImages("alice")
    ).rejects.toThrow(/make progress/i);
  });
});
