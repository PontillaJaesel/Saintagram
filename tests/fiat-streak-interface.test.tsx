import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { localDateKey } from "@/lib/fiat";

const mocks = vi.hoisted(() => ({ getReflections: vi.fn() }));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "alice" } })
}));
vi.mock("@/lib/app-service", () => ({
  appService: { getReflections: mocks.getReflections }
}));

import { FiatStreakInterface } from "@/components/fiat/fiat-streak-interface";

describe("FiAt streak interface", () => {
  beforeEach(() => mocks.getReflections.mockReset());

  it("shows the weekly streak UI and Add today's FiAt action", async () => {
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
    const trigger = await screen.findByRole("button", { name: /FiAt current streak: 1 days/i });
    await user.click(trigger);

    expect(screen.getByRole("dialog", { name: "FiAt streak" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "FiAt streak" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add today's FiAt" })).toHaveAttribute("href", "/reflect");
    await waitFor(() => expect(screen.getByLabelText(/FiAt recorded/i)).toBeInTheDocument());

    await user.click(
      screen.getByRole("button", {
        name: "Close FiAt streak"
      })
    );

    await waitFor(
      () => {
        expect(
          screen.queryByRole("dialog", {
            name: "FiAt streak"
          })
        ).not.toBeInTheDocument();
      },
      {
        timeout: 2000
      }
    );
  });
});
