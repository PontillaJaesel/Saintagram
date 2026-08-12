import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FiatCategorySelector } from "@/components/fiat/fiat-category-selector";

describe("FiatCategorySelector", () => {
  it("requires and limits a description when Other is selected", async () => {
    const onOtherTextChange = vi.fn();
    render(<FiatCategorySelector value="other" onChange={vi.fn()} otherText={"x".repeat(25)} onOtherTextChange={onOtherTextChange} />);
    const input = screen.getByLabelText("Please specify");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("maxlength", "25");
    expect(screen.getByText("25 / 25")).toBeInTheDocument();
    await userEvent.type(input, "more");
    expect(input).toHaveValue("x".repeat(25));
    expect(onOtherTextChange).not.toHaveBeenCalled();
  });
});
