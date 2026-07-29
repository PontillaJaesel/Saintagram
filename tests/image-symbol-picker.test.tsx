import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/providers/toast-provider";

const IMAGE_PATH =
  "users/user-1/profile/04fefae1-e03e-42ee-9cd4-dc86823426e8.png";

const mocks = vi.hoisted(() => ({
  uploadProfileImage: vi.fn(),
  deleteProfileImage: vi.fn()
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "user-1" }
  })
}));

vi.mock("@/components/ui/profile-avatar", () => ({
  ProfileAvatar: () => <div data-testid="profile-avatar" />
}));

vi.mock("@/lib/app-service", () => ({
  appService: {
    uploadProfileImage: mocks.uploadProfileImage,
    deleteProfileImage: mocks.deleteProfileImage
  }
}));

import { ImageSymbolPicker } from "@/components/forms/image-symbol-picker";

type PickerChange = React.ComponentProps<typeof ImageSymbolPicker>["onChange"];

function renderPicker({
  imagePath = "",
  onChange = vi.fn<PickerChange>()
}: {
  imagePath?: string;
  onChange?: PickerChange;
} = {}) {
  return render(
    <ToastProvider>
      <ImageSymbolPicker
        imagePath={imagePath}
        selectedSymbol=""
        profileName="Alice"
        onChange={onChange}
      />
    </ToastProvider>
  );
}

describe("ImageSymbolPicker upload lifecycle", () => {
  beforeEach(() => {
    mocks.uploadProfileImage.mockReset();
    mocks.deleteProfileImage.mockReset();
    mocks.deleteProfileImage.mockResolvedValue(undefined);
  });

  it("shows a success popup after an image is uploaded", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<PickerChange>();
    mocks.uploadProfileImage.mockResolvedValue(IMAGE_PATH);
    renderPicker({ onChange });
    const file = new File(["image"], "avatar.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("Upload profile image"), file);

    expect(onChange).toHaveBeenCalledWith({
      imagePath: IMAGE_PATH,
      selectedSymbol: ""
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your profile image was uploaded."
    );
  });

  it("shows an error popup and inline message when an upload fails", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<PickerChange>();
    mocks.uploadProfileImage.mockRejectedValue(
      new Error("The image storage service is unavailable.")
    );
    renderPicker({ onChange });
    const file = new File(["image"], "avatar.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("Upload profile image"), file);

    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(2);
    alerts.forEach((alert) =>
      expect(alert).toHaveTextContent(
        "The image storage service is unavailable."
      )
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows an error popup when the selected file is invalid", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPicker();
    const file = new File(["text"], "notes.txt", { type: "text/plain" });

    await user.upload(screen.getByLabelText("Upload profile image"), file);

    const alerts = await screen.findAllByRole("alert");
    expect(alerts).toHaveLength(2);
    alerts.forEach((alert) =>
      expect(alert).toHaveTextContent("Choose a JPG, PNG, or WebP image.")
    );
    expect(mocks.uploadProfileImage).not.toHaveBeenCalled();
  });

  it("deletes a late upload result instead of updating an unmounted form", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<PickerChange>();
    let finishUpload: ((path: string) => void) | undefined;
    mocks.uploadProfileImage.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finishUpload = resolve;
        })
    );
    const view = renderPicker({ onChange });
    const file = new File(["image"], "avatar.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("Upload profile image"), file);
    expect(mocks.uploadProfileImage).toHaveBeenCalledWith("user-1", file);

    view.unmount();
    finishUpload?.(IMAGE_PATH);

    await waitFor(() => {
      expect(mocks.deleteProfileImage).toHaveBeenCalledWith(
        "user-1",
        IMAGE_PATH
      );
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
