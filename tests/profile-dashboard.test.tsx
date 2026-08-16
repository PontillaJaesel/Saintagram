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
  subscribeProfile: vi.fn(),
  subscribeReflections: vi.fn(),
  subscribeProfileImageHistory: vi.fn(),
  getProfileView: vi.fn(),
  getPublicReflections: vi.fn(),
  getPrivateStory: vi.fn(),
  getPrivateReflections: vi.fn(),
  getReflections: vi.fn(),
  downloadFirebaseProfileImage: vi.fn()
  ,reflectionMediaUrl: vi.fn()
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

vi.mock("@/components/social/social-reflection-card", () => ({
  SocialReflectionCard: ({ post }: { post: ReflectionPost }) => (
    <article>{post.content}</article>
  )
}));

vi.mock("@/lib/app-service", () => ({
  appService: {
    subscribeProfile: mocks.subscribeProfile,
    subscribeReflections: mocks.subscribeReflections,
    subscribeProfileImageHistory: mocks.subscribeProfileImageHistory,
    getProfileView: mocks.getProfileView,
    getPublicReflections: mocks.getPublicReflections,
    getPrivateStory: mocks.getPrivateStory,
    getPrivateReflections: mocks.getPrivateReflections
    ,getReflections: mocks.getReflections
  }
}));

vi.mock("@/lib/profile-images", () => ({
  downloadFirebaseProfileImage: mocks.downloadFirebaseProfileImage,
  isLocalProfileImageSource: (value: string) => value.startsWith("data:image/")
}));

vi.mock("@/lib/reflection-media", () => ({
  reflectionMediaUrl: mocks.reflectionMediaUrl
}));

import { ProfileDashboard } from "@/components/profile/profile-dashboard";

const TEST_USER: AppUser = {
  id: "user-1",
  email: "beloved@example.com",
  authProvider: "password",
  mustChangePassword: false,
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
  coverColor: "#DDD2F6",
  imagePath: "",
  selectedSymbol: "seed",
  spiritualBio: "Learning to receive grace.",
  spiritualGuides: ["Mary"],
  lifeDirections: ["Jesus"],
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

const PROFILE_IMAGE_HISTORY = {
  id: "image-history-1",
  userId: TEST_USER.id,
  imagePath: "users/user-1/profile/image-history-1.webp",
  createdAt: "2026-07-29T08:00:00.000Z",
  updatedAt: "2026-07-29T08:00:00.000Z"
};

describe("ProfileDashboard private content", () => {
  beforeEach(() => {
    mocks.getReflections.mockResolvedValue([]);
    TEST_USER.privacyPreferences = {
      requirePrivateCheck: true,
      showReflectionDates: true
    };
    mocks.getProfileView.mockResolvedValue({
      ...PROFILE,
      hiddenStory: PUBLIC_VIEW_SECRET
    });
    mocks.getPublicReflections.mockResolvedValue([]);
    mocks.getPrivateStory.mockResolvedValue(PRIVATE_STORY);
    mocks.getPrivateReflections.mockResolvedValue([PRIVATE_REFLECTION]);
    mocks.downloadFirebaseProfileImage.mockResolvedValue(
      "https://images.example.test/profile-history.png"
    );
    mocks.subscribeProfile.mockImplementation(
      (_userId, callback) => {
        callback({ ...PROFILE, hiddenStory: PUBLIC_VIEW_SECRET });
        return () => undefined;
      }
    );
    mocks.subscribeReflections.mockImplementation(
      (_userId, _visibility, callback) => {
        callback([]);
        return () => undefined;
      }
    );
    mocks.subscribeProfileImageHistory.mockImplementation(
      (_userId, callback) => {
        callback([PROFILE_IMAGE_HISTORY]);
        return () => undefined;
      }
    );
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

  it("opens private content directly when confirmation is disabled", async () => {
    TEST_USER.privacyPreferences = {
      requirePrivateCheck: false,
      showReflectionDates: true
    };
    const user = userEvent.setup();
    render(<ProfileDashboard />);

    await screen.findByRole("heading", { name: PROFILE.profileName });
    await user.click(
      screen.getByRole("tab", { name: "Private Reflections" })
    );
    await user.click(screen.getByRole("button", { name: "Privacy check" }));

    expect(
      screen.queryByRole("alertdialog", { name: "Is this a private moment?" })
    ).not.toBeInTheDocument();
    expect(await screen.findByText(PRIVATE_STORY)).toBeInTheDocument();
    expect(screen.getByText(PRIVATE_POST)).toBeInTheDocument();
  });

  it("shows recent reflection media in the Media tab", async () => {
    mocks.reflectionMediaUrl.mockResolvedValue("https://media.example/photo.webp");
    mocks.subscribeReflections.mockImplementation((_userId, _visibility, callback) => {
      callback([{ id: "media-post", userId: TEST_USER.id, title: "A visible grace", content: "Media reflection", isPrivate: false, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z", media: [{ type: "image", path: "users/user-1/reflections/media-post/photo.webp" }] }]);
      return () => undefined;
    });
    const user = userEvent.setup();
    render(<ProfileDashboard />);

    await screen.findByRole("heading", { name: PROFILE.profileName });
    await user.click(screen.getByRole("tab", { name: "Media" }));

    expect(await screen.findByText("A visible grace")).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Reflection photo 1" })).toBeInTheDocument();
    expect(mocks.reflectionMediaUrl).toHaveBeenCalledWith("users/user-1/reflections/media-post/photo.webp");
  });
});
