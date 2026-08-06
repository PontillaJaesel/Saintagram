import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  download: vi.fn()
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    loading: false,
    mode: "firebase",
    user: { id: "alice" }
  })
}));

vi.mock("@/lib/profile-images", () => ({
  downloadFirebaseProfileImage: mocks.download,
  isLocalProfileImageSource: (value: string) =>
    value.startsWith("data:image/")
}));

import { ProfileAvatar } from "@/components/ui/profile-avatar";

const IMAGE_PATH =
  "users/alice/profile/04fefae1-e03e-42ee-9cd4-dc86823426e8.png";

describe("ProfileAvatar private image resolution", () => {
  beforeEach(() => {
    mocks.download.mockResolvedValue(
      "https://firebase.example/profile-image.png"
    );
  });

  it("renders a Firebase download URL after auth is ready", async () => {
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
    expect(image).toHaveAttribute(
      "src",
      "https://firebase.example/profile-image.png"
    );
    expect(mocks.download).toHaveBeenCalledWith(IMAGE_PATH);

    view.unmount();
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
