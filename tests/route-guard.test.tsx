import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/types";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: vi.fn(() => "/profile"),
  useAuth: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => mocks.pathname()
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => mocks.useAuth()
}));

import { RouteGuard } from "@/components/auth/route-guard";

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    email: "beloved@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    privacyConsentAt: "2026-01-02T00:00:00.000Z",
    spiritualIntroSeenAt: "2026-01-03T00:00:00.000Z",
    profileCompleted: true,
    ...overrides
  };
}

describe("RouteGuard", () => {
  beforeEach(() => {
    mocks.pathname.mockReturnValue("/profile");
    mocks.useAuth.mockReturnValue({
      user: makeUser(),
      loading: false
    });
  });

  it("shows an accessible loading state while authentication initializes", () => {
    mocks.useAuth.mockReturnValue({ user: null, loading: true });

    render(
      <RouteGuard>
        <p>Private profile</p>
      </RouteGuard>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Private profile")).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("redirects an anonymous visitor to login with the intended path", async () => {
    mocks.pathname.mockReturnValue("/journey/private");
    mocks.useAuth.mockReturnValue({ user: null, loading: false });

    render(
      <RouteGuard>
        <p>Private journey</p>
      </RouteGuard>
    );

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith(
        "/auth?mode=login&next=%2Fjourney%2Fprivate"
      );
    });
    expect(screen.queryByText("Private journey")).not.toBeInTheDocument();
  });

  it("requires privacy consent before protected content is shown", async () => {
    mocks.useAuth.mockReturnValue({
      user: makeUser({ privacyConsentAt: null, profileCompleted: true }),
      loading: false
    });

    render(
      <RouteGuard>
        <p>Private profile</p>
      </RouteGuard>
    );

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/privacy"));
    expect(screen.queryByText("Private profile")).not.toBeInTheDocument();
  });

  it("sends an incomplete temporary-password user to profile creation first", async () => {
    mocks.useAuth.mockReturnValue({
      user: makeUser({ mustChangePassword: true, profileCompleted: false }),
      loading: false
    });

    render(
      <RouteGuard requireProfile>
        <p>Private profile</p>
      </RouteGuard>
    );

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/create")
    );
    expect(screen.queryByText("Private profile")).not.toBeInTheDocument();
  });

  it("allows a temporary-password user to open Settings", () => {
    mocks.pathname.mockReturnValue("/settings");
    mocks.useAuth.mockReturnValue({
      user: makeUser({ mustChangePassword: true, profileCompleted: true }),
      loading: false
    });

    render(
      <RouteGuard requireConsent={false}>
        <p>Password settings</p>
      </RouteGuard>
    );

    expect(screen.getByText("Password settings")).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("can render the privacy flow before consent when consent is not required", () => {
    mocks.useAuth.mockReturnValue({
      user: makeUser({ privacyConsentAt: null, profileCompleted: true }),
      loading: false
    });

    render(
      <RouteGuard requireConsent={false}>
        <h1>Privacy and consent</h1>
      </RouteGuard>
    );

    expect(
      screen.getByRole("heading", { name: "Privacy and consent" })
    ).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("sends an incomplete user directly to profile creation", async () => {
    mocks.useAuth.mockReturnValue({
      user: makeUser({
        spiritualIntroSeenAt: null,
        profileCompleted: false
      }),
      loading: false
    });

    render(
      <RouteGuard requireIntroduction>
        <p>Introduction complete</p>
      </RouteGuard>
    );

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/create")
    );
    expect(screen.queryByText("Introduction complete")).not.toBeInTheDocument();
  });

  it("redirects an incomplete user to profile creation when a profile is required", async () => {
    mocks.useAuth.mockReturnValue({
      user: makeUser({ profileCompleted: false }),
      loading: false
    });

    render(
      <RouteGuard requireProfile>
        <p>Completed profile</p>
      </RouteGuard>
    );

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/create"));
    expect(screen.queryByText("Completed profile")).not.toBeInTheDocument();
  });

  it("redirects completed users away from onboarding", async () => {
    mocks.useAuth.mockReturnValue({
      user: makeUser(),
      loading: false
    });

    render(
      <RouteGuard redirectCompleted>
        <p>Create a profile</p>
      </RouteGuard>
    );

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/profile"));
    expect(screen.queryByText("Create a profile")).not.toBeInTheDocument();
  });

  it("renders authorized content without navigation", () => {
    render(
      <RouteGuard requireProfile>
        <h1>My Profile Before God</h1>
      </RouteGuard>
    );

    expect(
      screen.getByRole("heading", { name: "My Profile Before God" })
    ).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
