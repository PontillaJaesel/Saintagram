import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useExclusivePopup } from "@/components/ui/use-exclusive-popup";

function Popup({ name }: { name: "fiat-streak" | "fiat-leaderboard" | "notifications" }) {
  const [open, setOpen] = useState(false);
  useExclusivePopup(name, open, setOpen);
  return <button onClick={() => setOpen((current) => !current)}>{name}: {open ? "open" : "closed"}</button>;
}

describe("exclusive popup coordination", () => {
  it("closes an existing popup when another popup opens", () => {
    render(<><Popup name="notifications" /><Popup name="fiat-streak" /><Popup name="fiat-leaderboard" /></>);

    fireEvent.click(screen.getByRole("button", { name: "notifications: closed" }));
    expect(screen.getByRole("button", { name: "notifications: open" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "fiat-streak: closed" }));
    expect(screen.getByRole("button", { name: "notifications: closed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "fiat-streak: open" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "fiat-leaderboard: closed" }));
    expect(screen.getByRole("button", { name: "fiat-streak: closed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "fiat-leaderboard: open" })).toBeInTheDocument();
  });
});
