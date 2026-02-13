import { describe, expect, it } from "bun:test";

import { CommandInputSchema, ConversationSearchSchema, ResolveCommandsSchema } from "../schemas";

describe("CommandInputSchema", () => {
  it("validates a valid select command", () => {
    const result = CommandInputSchema.parse({
      type: "select",
      conversationTitle: "My Conversation",
    });
    expect(result.type).toBe("select");
    expect(result.conversationTitle).toBe("My Conversation");
  });

  it("validates all valid command types", () => {
    const validTypes = [
      "select",
      "select:user",
      "select:assistant",
      "select:last",
      "summarize",
      "keypoints",
      "inject",
      "link",
    ] as const;

    for (const type of validTypes) {
      const result = CommandInputSchema.parse({
        type,
        conversationTitle: "Test",
      });
      expect(result.type).toBe(type);
    }
  });

  it("rejects invalid command type", () => {
    expect(() =>
      CommandInputSchema.parse({
        type: "invalid",
        conversationTitle: "Test",
      }),
    ).toThrow();
  });

  it("rejects empty conversationTitle", () => {
    expect(() =>
      CommandInputSchema.parse({
        type: "select",
        conversationTitle: "",
      }),
    ).toThrow();
  });

  it("rejects conversationTitle longer than 200 characters", () => {
    expect(() =>
      CommandInputSchema.parse({
        type: "select",
        conversationTitle: "a".repeat(201),
      }),
    ).toThrow();
  });

  it("accepts optional filter field", () => {
    const result = CommandInputSchema.parse({
      type: "select",
      conversationTitle: "Test",
      filter: "user",
    });
    expect(result.filter).toBe("user");
  });

  it("rejects invalid filter value", () => {
    expect(() =>
      CommandInputSchema.parse({
        type: "select",
        conversationTitle: "Test",
        filter: "invalid",
      }),
    ).toThrow();
  });

  it("accepts optional question field", () => {
    const result = CommandInputSchema.parse({
      type: "inject",
      conversationTitle: "Test",
      question: "What is this about?",
    });
    expect(result.question).toBe("What is this about?");
  });

  it("rejects question longer than 500 characters", () => {
    expect(() =>
      CommandInputSchema.parse({
        type: "inject",
        conversationTitle: "Test",
        question: "a".repeat(501),
      }),
    ).toThrow();
  });
});

describe("ResolveCommandsSchema", () => {
  it("validates a valid resolve request with one command", () => {
    const result = ResolveCommandsSchema.parse({
      commands: [{ type: "select", conversationTitle: "Test" }],
    });
    expect(result.commands.length).toBe(1);
  });

  it("validates a valid resolve request with sourceConversationId", () => {
    const result = ResolveCommandsSchema.parse({
      commands: [{ type: "select", conversationTitle: "Test" }],
      sourceConversationId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.sourceConversationId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects empty commands array", () => {
    expect(() =>
      ResolveCommandsSchema.parse({
        commands: [],
      }),
    ).toThrow();
  });

  it("rejects more than 10 commands", () => {
    const commands = Array.from({ length: 11 }, () => ({
      type: "select" as const,
      conversationTitle: "Test",
    }));
    expect(() => ResolveCommandsSchema.parse({ commands })).toThrow();
  });

  it("accepts exactly 10 commands", () => {
    const commands = Array.from({ length: 10 }, () => ({
      type: "select" as const,
      conversationTitle: "Test",
    }));
    const result = ResolveCommandsSchema.parse({ commands });
    expect(result.commands.length).toBe(10);
  });

  it("rejects invalid sourceConversationId", () => {
    expect(() =>
      ResolveCommandsSchema.parse({
        commands: [{ type: "select", conversationTitle: "Test" }],
        sourceConversationId: "not-a-uuid",
      }),
    ).toThrow();
  });
});

describe("ConversationSearchSchema", () => {
  it("validates a valid search query", () => {
    const result = ConversationSearchSchema.parse({ q: "hello" });
    expect(result.q).toBe("hello");
  });

  it("rejects empty search query", () => {
    expect(() => ConversationSearchSchema.parse({ q: "" })).toThrow();
  });

  it("rejects search query longer than 200 characters", () => {
    expect(() => ConversationSearchSchema.parse({ q: "a".repeat(201) })).toThrow();
  });

  it("accepts search query at max length", () => {
    const result = ConversationSearchSchema.parse({ q: "a".repeat(200) });
    expect(result.q.length).toBe(200);
  });
});
