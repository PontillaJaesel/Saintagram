import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  download: vi.fn()
}));

vi.mock("@/lib/firebase", () => ({
  isFirebaseConfigured: true
}));

vi.mock("@/lib/profile-images", () => ({
  downloadSupabaseProfileImage: mocks.download,
  isLocalProfileImageSource: (value: string) =>
    value.startsWith("data:image/")
}));

import { ProfileAvatar } from "@/components/ui/profile-avatar";

const IMAGE_PATH =
  "users/alice/profile/04fefae1-e03e-42ee-9cd4-dc86823426e8.png";

describe("ProfileAvatar private image resolution", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:private-profile-image")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });
    mocks.download.mockResolvedValue(
      new Blob(["image"], { type: "image/png" })
    );
  });

  it("renders an authenticated Blob URL and revokes it on unmount", async () => {
    const view = render(
      <ProfileAvatar
        imagePath={IMAGE_PATH}
        symbol="seed"
        profileName="Alice"
      />
    );

    const image = await screen.findByRole("img", {
      name: "Alice profile"
    });
    expect(image).toHaveAttribute("src", "blob:private-profile-image");
    expect(mocks.download).toHaveBeenCalledWith(IMAGE_PATH);

    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:private-profile-image"
    );
  });

  it("does not render legacy inline image data in hosted mode", async () => {
    render(
      <ProfileAvatar
        imagePath="data:image/png;base64,aGVsbG8="
        symbol="seed"
        profileName="Alice"
      />
    );

    await waitFor(() => {
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
