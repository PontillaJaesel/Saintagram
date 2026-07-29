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
  const getIdTokenResult = vi.fn();
  return {
    upload,
    download,
    remove,
    list,
    from,
    getIdToken,
    getIdTokenResult,
    supabaseConfigured: true,
    currentUser: {
      uid: "alice",
      getIdToken,
      getIdTokenResult
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
    mocks.getIdTokenResult.mockResolvedValue({
      claims: { role: "authenticated" }
    });
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

  it("force-refreshes a missing Firebase role before downloading", async () => {
    mocks.getIdTokenResult
      .mockResolvedValueOnce({ claims: {} })
      .mockResolvedValueOnce({ claims: { role: "authenticated" } });

    await expect(
      downloadSupabaseProfileImage(VALID_IMAGE_PATH)
    ).resolves.toEqual(expect.any(Blob));
    expect(mocks.getIdTokenResult).toHaveBeenNthCalledWith(1);
    expect(mocks.getIdTokenResult).toHaveBeenNthCalledWith(2, true);
    expect(mocks.download).toHaveBeenCalledWith(VALID_IMAGE_PATH);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("automatically enables image access and refreshes the Firebase token", async () => {
    mocks.getIdTokenResult
      .mockResolvedValueOnce({ claims: {} })
      .mockResolvedValueOnce({ claims: {} })
      .mockResolvedValueOnce({ claims: { role: "authenticated" } });

    await expect(
      downloadSupabaseProfileImage(VALID_IMAGE_PATH)
    ).resolves.toEqual(expect.any(Blob));

    expect(mocks.getIdToken).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      "/api/image-access",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer header.payload.signature"
        },
        cache: "no-store",
        credentials: "same-origin"
      })
    );
    expect(mocks.getIdTokenResult).toHaveBeenNthCalledWith(3, true);
    expect(mocks.download).toHaveBeenCalledWith(VALID_IMAGE_PATH);
  });

  it("fails closed when automatic image-access setup is rejected", async () => {
    mocks.getIdTokenResult.mockResolvedValue({ claims: {} });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error:
            "Automatic image access setup is unavailable. Please contact the site owner."
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    await expect(
      downloadSupabaseProfileImage(VALID_IMAGE_PATH)
    ).rejects.toThrow(/automatic image access setup is unavailable/i);
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("fails closed if the refreshed token still lacks the claim", async () => {
    mocks.getIdTokenResult.mockResolvedValue({ claims: {} });

    await expect(
      downloadSupabaseProfileImage(VALID_IMAGE_PATH)
    ).rejects.toThrow(/refreshed sign-in session is missing/i);
    expect(fetch).toHaveBeenCalledOnce();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("reports missing Supabase configuration before changing claims", async () => {
    mocks.supabaseConfigured = false;
    mocks.getIdTokenResult.mockResolvedValue({ claims: {} });

    await expect(
      downloadSupabaseProfileImage(VALID_IMAGE_PATH)
    ).rejects.toThrow(/Supabase image storage is not configured/i);
    expect(mocks.getIdTokenResult).not.toHaveBeenCalled();
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
