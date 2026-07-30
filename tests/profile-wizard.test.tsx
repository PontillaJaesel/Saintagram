import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser, ProfileDraftData } from "@/types";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  refreshUser: vi.fn(),
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
    refreshUser: mocks.refreshUser
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
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
  privacyConsentAt: "2026-01-02T00:00:00.000Z",
  spiritualIntroSeenAt: "2026-01-03T00:00:00.000Z",
  profileCompleted: false
};

const COMPLETED_DRAFT: ProfileDraftData = {
  profileName: "Beloved Child of God",
  imagePath: "",
  selectedSymbol: "cross",
  spiritualBio: "Learning to trust grace.",
  followers: ["Mary"],
  following: ["Jesus"],
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
  });

  it("saves the reviewed profile and immediately navigates to it", async () => {
    const user = userEvent.setup();
    render(<ProfileWizard />);

    const saveButton = await screen.findByRole("button", {
      name: "Save and View My Profile"
    });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mocks.completeProfile).toHaveBeenCalledWith(
        TEST_USER.id,
        COMPLETED_DRAFT
      );
      expect(mocks.refreshUser).toHaveBeenCalledTimes(1);
      expect(mocks.replace).toHaveBeenCalledWith("/profile?created=1");
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
        name: "Save and View My Profile"
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
