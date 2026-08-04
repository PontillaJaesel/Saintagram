import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReflectionCard } from "@/components/reflections/reflection-card";
import type { ReflectionPost } from "@/types";

const BACKDATED_POST: ReflectionPost = {
  id: "reflection-1",
  userId: "user-1",
  title: "A remembered grace",
  content: "I remembered a meaningful moment.",
  isPrivate: true,
  createdAt: "2026-04-02T12:00:00.000Z",
  updatedAt: "2026-08-04T12:00:00.000Z"
};

describe("ReflectionCard dates and edit status", () => {
  it("shows a private reflection date without marking a new backdated post as edited", () => {
    const { container } = render(<ReflectionCard post={BACKDATED_POST} />);

    const date = container.querySelector("time");
    expect(date).toHaveAttribute("datetime", BACKDATED_POST.createdAt);
    expect(date).not.toHaveTextContent("Date unavailable");
    expect(screen.queryByText("Edited")).not.toBeInTheDocument();
  });

  it("shows Edited only when the reflection has an explicit edit timestamp", () => {
    render(
      <ReflectionCard
        post={{
          ...BACKDATED_POST,
          editedAt: "2026-08-05T12:00:00.000Z"
        }}
      />
    );

    expect(screen.getByText("Edited")).toBeInTheDocument();
  });
});
