import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AppUser,
  PublicSpiritualProfile,
  ReflectionPost
} from "@/types";

const PUBLIC_VIEW_SECRET = "PRIVATE-SENTINEL-IN-PROFILE";
const PRIVATE_STORY = "PRIVATE-SENTINEL-AFTER-CONFIRMATION";
const PRIVATE_POST = "PRIVATE-JOURNAL-SENTINEL-AFTER-CONFIRMATION";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  notify: vi.fn(),
  updateUser: vi.fn(),
  getProfileView: vi.fn(),
  getPublicReflections: vi.fn(),
  getPrivateStory: vi.fn(),
  getPrivateReflections: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => ({ get: () => null })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    user: TEST_USER,
    updateUser: mocks.updateUser
  })
}));

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ notify: mocks.notify })
}));

vi.mock("@/lib/app-service", () => ({
  appService: {
    getProfileView: mocks.getProfileView,
    getPublicReflections: mocks.getPublicReflections,
    getPrivateStory: mocks.getPrivateStory,
    getPrivateReflections: mocks.getPrivateReflections
  }
}));

import { ProfileDashboard } from "@/components/profile/profile-dashboard";

const TEST_USER: AppUser = {
  id: "user-1",
  email: "beloved@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
  privacyConsentAt: "2026-01-02T00:00:00.000Z",
  spiritualIntroSeenAt: "2026-01-03T00:00:00.000Z",
  profileCompleted: true,
  privacyPreferences: {
    requirePrivateCheck: true,
    showReflectionDates: true
  }
};

const PROFILE: PublicSpiritualProfile = {
  id: TEST_USER.id,
  userId: TEST_USER.id,
  profileName: "Still Growing",
  imagePath: "",
  selectedSymbol: "seed",
  spiritualBio: "Learning to receive grace.",
  followers: ["Mary"],
  following: ["Jesus"],
  heartSeeks: ["Peace"],
  godsComment: "You are known and loved.",
  heavenlyHashtag: "#StillGrowing",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-07-28T08:00:00.000Z"
};

const PRIVATE_REFLECTION: ReflectionPost = {
  id: "private-post-1",
  userId: TEST_USER.id,
  content: PRIVATE_POST,
  isPrivate: true,
  createdAt: "2026-07-28T08:00:00.000Z",
  updatedAt: "2026-07-28T08:00:00.000Z"
};

describe("ProfileDashboard private content", () => {
  beforeEach(() => {
    mocks.getProfileView.mockResolvedValue({
      ...PROFILE,
      hiddenStory: PUBLIC_VIEW_SECRET
    });
    mocks.getPublicReflections.mockResolvedValue([]);
    mocks.getPrivateStory.mockResolvedValue(PRIVATE_STORY);
    mocks.getPrivateReflections.mockResolvedValue([PRIVATE_REFLECTION]);
  });

  it("never renders a leaked Hidden Story in the normal view and loads private content only after confirmation", async () => {
    const user = userEvent.setup();
    render(<ProfileDashboard />);

    expect(
      await screen.findByRole("heading", { name: PROFILE.profileName })
    ).toBeInTheDocument();
    expect(screen.queryByText(PUBLIC_VIEW_SECRET)).not.toBeInTheDocument();
    expect(screen.queryByText(PRIVATE_STORY)).not.toBeInTheDocument();
    expect(screen.queryByText(PRIVATE_POST)).not.toBeInTheDocument();
    expect(mocks.getPrivateStory).not.toHaveBeenCalled();
    expect(mocks.getPrivateReflections).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("tab", { name: "Private Reflections" })
    );
    expect(screen.queryByText(PRIVATE_STORY)).not.toBeInTheDocument();
    expect(screen.queryByText(PRIVATE_POST)).not.toBeInTheDocument();
    expect(mocks.getPrivateStory).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Privacy check" })
    );
    expect(
      screen.getByRole("alertdialog", { name: "Is this a private moment?" })
    ).toBeInTheDocument();
    expect(screen.queryByText(PRIVATE_STORY)).not.toBeInTheDocument();
    expect(screen.queryByText(PRIVATE_POST)).not.toBeInTheDocument();
    expect(mocks.getPrivateStory).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Open private reflections" })
    );

    await waitFor(() => {
      expect(mocks.getPrivateStory).toHaveBeenCalledWith(TEST_USER.id);
      expect(mocks.getPrivateReflections).toHaveBeenCalledWith(TEST_USER.id);
    });
    expect(await screen.findByText(PRIVATE_STORY)).toBeInTheDocument();
    expect(screen.getByText(PRIVATE_POST)).toBeInTheDocument();
    expect(screen.queryByText(PUBLIC_VIEW_SECRET)).not.toBeInTheDocument();
  });
});
