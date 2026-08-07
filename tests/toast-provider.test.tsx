import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToastProvider, useToast } from "@/components/providers/toast-provider";

function ToastHarness() {
  const { notify } = useToast();

  return (
    <button type="button" onClick={() => notify("Draft saved")}>
      Notify
    </button>
  );
}

describe("ToastProvider", () => {
  it("deduplicates the same notification while it is still fresh", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>
    );

    await user.click(screen.getByRole("button", { name: "Notify" }));
    await user.click(screen.getByRole("button", { name: "Notify" }));

    expect(screen.getAllByText("Draft saved")).toHaveLength(1);
  });
});
