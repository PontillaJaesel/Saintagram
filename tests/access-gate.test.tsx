import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  next: null as string | null,
  navigate: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (name: string) => (name === "next" ? mocks.next : null)
  })
}));

vi.mock("@/lib/browser-navigation", () => ({
  replaceBrowserLocation: mocks.navigate
}));

import { AccessGate } from "@/components/access/access-gate";

function accessResponse(
  ok: boolean,
  body: Record<string, unknown>
): Pick<Response, "json" | "ok"> {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body)
  };
}

describe("AccessGate", () => {
  beforeEach(() => {
    mocks.next = null;
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("presents a simple, accessible, visible code field", () => {
    render(<AccessGate />);

    const code = screen.getByLabelText("Access code");
    const submit = screen.getByRole("button", { name: "Enter Saintagram" });

    expect(
      screen.getByRole("heading", { name: "Access code" })
    ).toBeInTheDocument();
    expect(code).toHaveAttribute("type", "text");
    expect(code).toHaveAttribute(
      "aria-describedby",
      "access-renewal-note"
    );
    expect(code).toHaveFocus();
    expect(submit).toBeEnabled();
  });

  it("shows and focuses an accessible error for a whitespace-only code", async () => {
    const user = userEvent.setup();
    render(<AccessGate />);

    const code = screen.getByLabelText("Access code");
    await user.type(code, "   ");
    await user.click(
      screen.getByRole("button", { name: "Enter Saintagram" })
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter your access code to continue."
    );
    await waitFor(() => expect(code).toHaveFocus());
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("submits by keyboard, reports a denial, and clears it when edited", async () => {
    mocks.next = "/profile?tab=private";
    mocks.fetch.mockResolvedValue(
      accessResponse(false, {
        error: "That access code was not recognized. Please try again."
      })
    );
    const user = userEvent.setup();
    render(<AccessGate />);

    const code = screen.getByLabelText("Access code");
    await user.type(code, "incorrect-code{Enter}");

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    expect(mocks.fetch).toHaveBeenCalledWith(
      "/api/access",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "incorrect-code",
          next: "/profile?tab=private"
        })
      })
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Wrong access code. Try again."
    );
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveAttribute("aria-describedby", "access-code-error");
    expect(mocks.navigate).not.toHaveBeenCalled();

    await user.type(code, "x");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(code).toHaveAttribute("aria-invalid", "false");
    expect(code).toHaveAttribute(
      "aria-describedby",
      "access-renewal-note"
    );
  });

  it("disables the form while checking and prevents duplicate submissions", async () => {
    let resolveRequest:
      | ((value: Pick<Response, "json" | "ok">) => void)
      | undefined;
    mocks.fetch.mockReturnValue(
      new Promise<Pick<Response, "json" | "ok">>((resolve) => {
        resolveRequest = resolve;
      })
    );
    const user = userEvent.setup();
    render(<AccessGate />);

    const code = screen.getByLabelText("Access code");
    await user.type(code, "invitation-code");
    const submit = screen.getByRole("button", { name: "Enter Saintagram" });
    await user.click(submit);

    expect(code).toBeDisabled();
    expect(screen.getByRole("button", { name: /Checking your code/ }))
      .toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Checking your code/ }));
    expect(mocks.fetch).toHaveBeenCalledOnce();

    resolveRequest?.(accessResponse(true, { ok: true, next: "/profile" }));
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/profile")
    );
  });

  it("uses the server destination, refreshes, and never writes the code to browser storage", async () => {
    mocks.next = "/journey?day=1";
    mocks.fetch.mockResolvedValue(
      accessResponse(true, { ok: true, next: "/journey?day=1" })
    );
    const localSetItem = vi.spyOn(Storage.prototype, "setItem");
    const user = userEvent.setup();
    render(<AccessGate />);

    await user.type(screen.getByLabelText("Access code"), "invitation-code");
    await user.click(
      screen.getByRole("button", { name: "Enter Saintagram" })
    );

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/journey?day=1");
    });
    expect(localSetItem).not.toHaveBeenCalled();
  });

  it("falls back to the home page if a successful response contains an unsafe destination", async () => {
    mocks.fetch.mockResolvedValue(
      accessResponse(true, {
        ok: true,
        next: "https://example.com/steal-session"
      })
    );
    const user = userEvent.setup();
    render(<AccessGate />);

    await user.type(screen.getByLabelText("Access code"), "invitation-code");
    await user.click(
      screen.getByRole("button", { name: "Enter Saintagram" })
    );

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/"));
  });

  it("shows a useful alert when the private entrance cannot be reached", async () => {
    mocks.fetch.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<AccessGate />);

    await user.type(screen.getByLabelText("Access code"), "invitation-code");
    await user.click(
      screen.getByRole("button", { name: "Enter Saintagram" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not reach the private entrance. Check your connection and try again."
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
