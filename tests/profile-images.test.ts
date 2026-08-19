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
  const uploadBytes = vi.fn();
  const getDownloadURL = vi.fn();
  const deleteObject = vi.fn();
  const listAll = vi.fn();
  const moderateWithServerRoute = vi.fn();
  const validateModerationImageFile = vi.fn();
  const ref = vi.fn((storage, fullPath) => ({ storage, fullPath }));
  const getIdToken = vi.fn();
  return {
    uploadBytes,
    getDownloadURL,
    deleteObject,
    listAll,
    moderateWithServerRoute,
    validateModerationImageFile,
    ref,
    getIdToken,
    storage: {},
    currentUser: {
      uid: "alice",
      getIdToken
    }
  };
});

vi.mock("@/lib/firebase", () => ({
  getFirebaseServices: () => ({
    auth: { currentUser: mocks.currentUser },
    storage: mocks.storage
  })
}));

vi.mock("@/lib/moderation", () => ({
  MODERATION_IMAGE_ERROR:
    "This image cannot be uploaded because it violates our community guidelines.",
  moderateWithServerRoute: mocks.moderateWithServerRoute,
  validateModerationImageFile: mocks.validateModerationImageFile
}));

vi.mock("firebase/storage", () => ({
  deleteObject: mocks.deleteObject,
  getDownloadURL: mocks.getDownloadURL,
  listAll: mocks.listAll,
  ref: mocks.ref,
  uploadBytes: mocks.uploadBytes
}));

import {
  deleteAllFirebaseProfileImages,
  deleteFirebaseProfileImage,
  downloadFirebaseProfileImage,
  isLocalProfileImageSource,
  isOwnedProfileImagePath,
  profileImageFolder,
  uploadFirebaseProfileImage
} from "@/lib/profile-images";

describe("Firebase profile-image storage", () => {
  beforeEach(() => {
    mocks.currentUser.uid = "alice";
    mocks.getIdToken.mockResolvedValue("header.payload.signature");
    mocks.uploadBytes.mockResolvedValue({ metadata: {} });
    mocks.getDownloadURL.mockResolvedValue(
      "https://firebase.example/profile-image.png"
    );
    mocks.deleteObject.mockResolvedValue(undefined);
    mocks.listAll.mockResolvedValue({ items: [], prefixes: [] });
    mocks.validateModerationImageFile.mockReturnValue(null);
    mocks.moderateWithServerRoute.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("uses the exact owner folder for a new UUID object", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "04fefae1-e03e-42ee-9cd4-dc86823426e8"
    );
    const file = new File(["image"], "avatar.png", { type: "image/png" });

    await expect(uploadFirebaseProfileImage("alice", file)).resolves.toBe(
      VALID_IMAGE_PATH
    );
    expect(mocks.ref).toHaveBeenCalledWith(mocks.storage, VALID_IMAGE_PATH);
    expect(mocks.uploadBytes).toHaveBeenCalledWith(
      expect.objectContaining({ fullPath: VALID_IMAGE_PATH }),
      file,
      expect.objectContaining({
        cacheControl: "300",
        contentType: "image/png"
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

  it("downloads the stored URL from Firebase Storage", async () => {
    await expect(
      downloadFirebaseProfileImage(VALID_IMAGE_PATH)
    ).resolves.toBe("https://firebase.example/profile-image.png");
    expect(mocks.getIdToken).toHaveBeenCalledOnce();
    expect(mocks.getDownloadURL).toHaveBeenCalledWith(
      expect.objectContaining({ fullPath: VALID_IMAGE_PATH })
    );
  });

  it("rejects another user's path before sending a delete request", async () => {
    await expect(
      deleteFirebaseProfileImage(
        "alice",
        "users/bob/profile/14fefae1-e03e-42ee-9cd4-dc86823426e8.png"
      )
    ).rejects.toThrow(/does not belong/i);
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("deletes an image from the signed-in owner's storage folder", async () => {
    await expect(
      deleteFirebaseProfileImage("alice", VALID_IMAGE_PATH)
    ).resolves.toBeUndefined();

    expect(mocks.getIdToken).toHaveBeenCalledOnce();
    expect(mocks.ref).toHaveBeenCalledWith(mocks.storage, VALID_IMAGE_PATH);
    expect(mocks.deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({ fullPath: VALID_IMAGE_PATH })
    );
  });

  it("surfaces an actionable error when Firebase Storage rejects access", async () => {
    mocks.uploadBytes.mockRejectedValueOnce({
      code: "storage/unauthorized",
      message: "Permission denied"
    });
    const file = new File(["image"], "avatar.png", { type: "image/png" });

    await expect(uploadFirebaseProfileImage("alice", file)).rejects.toThrow(
      /Check Firebase Storage rules/i
    );
  });

  it("rejects an image when moderation blocks it", async () => {
    mocks.moderateWithServerRoute.mockRejectedValueOnce(
      new Error("blocked by moderation")
    );
    const file = new File(["image"], "avatar.png", { type: "image/png" });

    await expect(uploadFirebaseProfileImage("alice", file)).rejects.toThrow(
      "This image cannot be uploaded because it violates our community guidelines."
    );
    expect(mocks.uploadBytes).not.toHaveBeenCalled();
  });

  it("removes every listed object during account deletion", async () => {
    mocks.listAll.mockResolvedValueOnce({
      items: [
        {
          fullPath: `${profileImageFolder("alice")}/a.png`
        },
        {
          fullPath: `${profileImageFolder("alice")}/b.png`
        }
      ],
      prefixes: []
    });

    await expect(deleteAllFirebaseProfileImages("alice")).resolves.toBeUndefined();
    expect(mocks.listAll).toHaveBeenCalledWith(
      expect.objectContaining({ fullPath: profileImageFolder("alice") })
    );
    expect(mocks.deleteObject).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ fullPath: `${profileImageFolder("alice")}/a.png` })
    );
    expect(mocks.deleteObject).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ fullPath: `${profileImageFolder("alice")}/b.png` })
    );
  });

  it("fails when nested storage folders appear unexpectedly", async () => {
    mocks.listAll.mockResolvedValueOnce({
      items: [],
      prefixes: [{ fullPath: `${profileImageFolder("alice")}/archive` }]
    });

    await expect(deleteAllFirebaseProfileImages("alice")).rejects.toThrow(
      /nested profile-image folders/i
    );
  });
});
