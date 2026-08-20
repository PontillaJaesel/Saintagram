import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { localDateKey } from "@/lib/fiat";

const mocks = vi.hoisted(() => ({
  getReflections: vi.fn(),
  updateUser: vi.fn()
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "alice", fiatIntroSeenAt: null },
    updateUser: mocks.updateUser
  })
}));

vi.mock("@/lib/app-service", () => ({
  appService: { getReflections: mocks.getReflections }
}));

import { FiatStreakInterface } from "@/components/fiat/fiat-streak-interface";

describe("FiAt streak interface", () => {
  beforeEach(() => {
    mocks.getReflections.mockReset();
    mocks.updateUser.mockReset();
    mocks.updateUser.mockResolvedValue({ id: "alice", fiatIntroSeenAt: new Date().toISOString() });
  });

  it("shows the activity screen immediately when the user already has FiAt activity", async () => {
    const today = localDateKey();
    mocks.getReflections.mockResolvedValue([
      {
        id: "fiat-1",
        userId: "alice",
        content: "A faithful yes",
        isPrivate: false,
        createdAt: `${today}T12:00:00.000Z`,
        updatedAt: `${today}T12:00:00.000Z`,
        fiatCategory: "prayer",
        fiatDateKey: today
      }
    ]);

    const user = userEvent.setup();
    render(<FiatStreakInterface />);

    const trigger = await screen.findByRole("button", {
      name: /FiAt current streak: 1 days/i
    });
    await user.click(trigger);

    expect(screen.getByRole("dialog", { name: "FiAt activity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "FiAt streak" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add today's FiAt" })).toHaveAttribute("href", "/reflect");
    await waitFor(() =>
      expect(screen.getByTitle("FiAt recorded")).toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "Back to What is FiAt" }));
    expect(screen.getByRole("heading", { name: /Your daily/i })).toBeInTheDocument();
  });

  it("shows onboarding first when the user has never used FiAt", async () => {
    mocks.getReflections.mockResolvedValue([]);

    const user = userEvent.setup();
    render(<FiatStreakInterface />);

    const trigger = await screen.findByRole("button", {
      name: /FiAt current streak: 0 days/i
    });
    await user.click(trigger);

    expect(screen.getByRole("heading", { name: /Your daily/i })).toBeInTheDocument();
    expect(screen.getByText(/1 Fi@/i)).toBeInTheDocument();
    expect(screen.getByText(/Miss a third consecutive day/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue to FiAt" }));
    await waitFor(() => {
      expect(mocks.updateUser).toHaveBeenCalledWith({
        fiatIntroSeenAt: expect.any(String)
      });
    });
    expect(screen.getByRole("heading", { name: "FiAt streak" })).toBeInTheDocument();
  });
});
