import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser, ProfileDraftData } from "@/types";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  refreshUser: vi.fn(),
  cancelAccountCreation: vi.fn(),
  notify: vi.fn(),
  getDraft: vi.fn(),
  saveDraft: vi.fn(),
  deleteDraft: vi.fn(),
  uploadProfileImage: vi.fn(),
  deleteProfileImage: vi.fn(),
  completeProfile: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    push: mocks.push
  })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    user: TEST_USER,
    refreshUser: mocks.refreshUser,
    cancelAccountCreation: mocks.cancelAccountCreation
  })
}));

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ notify: mocks.notify })
}));

vi.mock("@/lib/app-service", () => ({
  appService: {
    getDraft: mocks.getDraft,
    saveDraft: mocks.saveDraft,
    deleteDraft: mocks.deleteDraft,
    uploadProfileImage: mocks.uploadProfileImage,
    deleteProfileImage: mocks.deleteProfileImage,
    completeProfile: mocks.completeProfile
  }
}));

import { ProfileWizard } from "@/components/profile/profile-wizard";

const TEST_USER: AppUser = {
  id: "user-1",
  email: "beloved@example.com",
  authProvider: "password",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
  privacyConsentAt: "2026-01-02T00:00:00.000Z",
  spiritualIntroSeenAt: "2026-01-03T00:00:00.000Z",
  profileCompleted: false,
  mustChangePassword: true
};

const COMPLETED_DRAFT: ProfileDraftData = {
  profileName: "Beloved Child of God",
  imagePath: "",
  selectedSymbol: "cross",
  spiritualBio: "Beloved",
  spiritualGuides: ["Mary"],
  lifeDirections: ["Jesus"],
  onboardingPostTitles: [""],
  onboardingPosts: ["A quiet kindness"],
  heartSeeks: ["Peace"],
  hiddenStory: "A private story held before God.",
  godsComment: "You are loved.",
  heavenlyHashtag: "#Beloved"
};
const RESTORED_IMAGE_PATH =
  "users/user-1/profile/04fefae1-e03e-42ee-9cd4-dc86823426e8.png";
const STAGED_IMAGE_PATH =
  "users/user-1/profile/14fefae1-e03e-42ee-9cd4-dc86823426e8.png";

describe("ProfileWizard completion", () => {
  beforeEach(() => {
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: vi.fn()
    });
    mocks.getDraft.mockResolvedValue({
      id: TEST_USER.id,
      userId: TEST_USER.id,
      currentStep: 10,
      draftData: COMPLETED_DRAFT,
      updatedAt: "2026-07-28T08:00:00.000Z"
    });
    mocks.saveDraft.mockResolvedValue(undefined);
    mocks.deleteDraft.mockResolvedValue(undefined);
    mocks.uploadProfileImage.mockResolvedValue(STAGED_IMAGE_PATH);
    mocks.deleteProfileImage.mockResolvedValue(undefined);
    mocks.completeProfile.mockResolvedValue(undefined);
    mocks.refreshUser.mockResolvedValue({
      ...TEST_USER,
      profileCompleted: true
    });
    mocks.cancelAccountCreation.mockResolvedValue(undefined);
  });

  it("saves the reviewed profile and requires the permanent password next", async () => {
    const user = userEvent.setup();
    render(<ProfileWizard />);

    const saveButton = await screen.findByRole("button", {
      name: "Create My Profile"
    });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mocks.completeProfile).toHaveBeenCalledWith(
        TEST_USER.id,
        COMPLETED_DRAFT
      );
      expect(mocks.refreshUser).toHaveBeenCalledTimes(1);
      expect(mocks.replace).toHaveBeenCalledWith("/settings");
    });
    expect(mocks.completeProfile.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.refreshUser.mock.invocationCallOrder[0]);
    expect(mocks.refreshUser.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.replace.mock.invocationCallOrder[0]);
  });

  it("shows the save error and does not navigate when completion fails", async () => {
    const user = userEvent.setup();
    mocks.completeProfile.mockRejectedValue(
      new Error("Your profile could not be stored.")
    );
    render(<ProfileWizard />);

    await user.click(
      await screen.findByRole("button", {
        name: "Create My Profile"
      })
    );

    expect(
      await screen.findByRole("alert", {
        name: ""
      })
    ).toHaveTextContent("Your profile could not be stored.");
    expect(mocks.refreshUser).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("blocks a whitespace-only required answer and focuses its inline error", async () => {
    const user = userEvent.setup();
    mocks.getDraft.mockResolvedValue(null);
    render(<ProfileWizard />);

    const name = await screen.findByLabelText(
      /What display name would you like to use/
    );
    expect(screen.queryByText("A few gentle ideas")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Still Growing" })
    ).not.toBeInTheDocument();
    await user.type(name, "   ");
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Add a display name before continuing."
    );
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByRole("heading", { name: "Display name" })
    ).toBeInTheDocument();

    await user.clear(name);
    await user.type(name, "Juan Dela Cruz");

    expect(name).toHaveValue("Juan Dela Cruz");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "false");
  });

  it("locks step picking and requires each sequential question before advancing", async () => {
    const user = userEvent.setup();
    mocks.getDraft.mockResolvedValue(null);
    render(<ProfileWizard />);

    const name = await screen.findByLabelText(
      /What display name would you like to use/
    );
    expect(screen.getByRole("button", { name: "Image" })).toBeDisabled();

    await user.type(name, "Still Growing");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByRole("heading", { name: "Choose a profile symbol or photo" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create My Profile" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a profile picture or spiritual symbol before continuing."
    );
    expect(
      screen.getByRole("heading", { name: "Choose a profile symbol or photo" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Seed/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create My Profile" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByRole("heading", { name: "Display name" })).toBeInTheDocument();
  });

  it("keeps a restored image until its replacement draft is durable", async () => {
    const user = userEvent.setup();
    let resolveSave: (() => void) | undefined;
    mocks.getDraft.mockResolvedValue({
      id: TEST_USER.id,
      userId: TEST_USER.id,
      currentStep: 1,
      draftData: {
        ...COMPLETED_DRAFT,
        imagePath: RESTORED_IMAGE_PATH,
        selectedSymbol: ""
      },
      updatedAt: "2026-07-28T08:00:00.000Z"
    });
    mocks.saveDraft.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );
    render(<ProfileWizard />);

    await user.click(
      await screen.findByRole("button", {
        name: /Seed/
      })
    );

    expect(mocks.deleteProfileImage).not.toHaveBeenCalled();
    await waitFor(
      () => expect(mocks.saveDraft).toHaveBeenCalledTimes(1),
      { timeout: 2_000 }
    );
    expect(mocks.deleteProfileImage).not.toHaveBeenCalled();

    resolveSave?.();
    await waitFor(() => {
      expect(mocks.deleteProfileImage).toHaveBeenCalledWith(
        TEST_USER.id,
        RESTORED_IMAGE_PATH
      );
    });
  });

  it("removes an unsaved staged upload on unmount but preserves the restored image", async () => {
    const user = userEvent.setup();
    mocks.getDraft.mockResolvedValue({
      id: TEST_USER.id,
      userId: TEST_USER.id,
      currentStep: 1,
      draftData: {
        ...COMPLETED_DRAFT,
        imagePath: RESTORED_IMAGE_PATH,
        selectedSymbol: ""
      },
      updatedAt: "2026-07-28T08:00:00.000Z"
    });
    const view = render(<ProfileWizard />);
    const file = new File(["image"], "avatar.png", { type: "image/png" });

    await user.upload(
      await screen.findByLabelText("Upload profile image"),
      file
    );
    expect(mocks.uploadProfileImage).toHaveBeenCalledWith(TEST_USER.id, file);

    view.unmount();
    await waitFor(() => {
      expect(mocks.deleteProfileImage).toHaveBeenCalledWith(
        TEST_USER.id,
        STAGED_IMAGE_PATH
      );
    });
    expect(mocks.deleteProfileImage).not.toHaveBeenCalledWith(
      TEST_USER.id,
      RESTORED_IMAGE_PATH
    );
  });
});
