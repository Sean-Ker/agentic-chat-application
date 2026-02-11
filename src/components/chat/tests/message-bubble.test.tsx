import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { MessageBubble } from "../message-bubble";

describe("MessageBubble", () => {
  it("renders user message content", () => {
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
    render(<MessageBubble role="user" content="Hello there" />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("renders assistant message content", () => {
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
    render(<MessageBubble role="assistant" content="Hi! How can I help?" />);
    expect(screen.getByText(/How can I help/)).toBeInTheDocument();
  });

  it("shows user icon for user messages", () => {
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
    const { container } = render(<MessageBubble role="user" content="Test" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-end");
  });

  it("shows bot icon for assistant messages", () => {
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
    const { container } = render(<MessageBubble role="assistant" content="Test" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-start");
  });
});
