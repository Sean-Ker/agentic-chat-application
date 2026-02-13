import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

// Use a loosely-typed mock for db.select() since it returns different chain shapes
// depending on whether we're querying conversations or messages.
// biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible return types
const mockSelect: ReturnType<typeof mock<(...args: any[]) => any>> = mock(() => ({
  from: mock(() => []),
}));

mock.module("@/core/database/client", () => ({
  db: {
    select: mockSelect,
  },
}));

mock.module("@/core/logging", () => ({
  getLogger: () => ({
    info: mock(),
    error: mock(),
    warn: mock(),
    debug: mock(),
  }),
}));

// Now import the resolver (uses mocked db)
const { findConversationByTitle, resolveCommand } = await import("../resolver");

// Helper to set up mock conversations
function mockConversations(conversations: { id: string; title: string }[]) {
  const fromMock = mock(() => conversations);
  mockSelect.mockReturnValue({ from: fromMock });
}

// Helper to set up mock messages
function mockConversationsAndMessages(
  conversations: { id: string; title: string }[],
  messages: { role: string; content: string }[],
) {
  let callCount = 0;
  mockSelect.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return { from: mock(() => conversations) };
    }
    const orderByMock = mock(() => messages);
    const whereMock = mock(() => ({ orderBy: orderByMock }));
    const fromMock = mock(() => ({ where: whereMock }));
    return { from: fromMock };
  });
}

describe("findConversationByTitle", () => {
  beforeEach(() => {
    mockSelect.mockReset();
  });

  it("B17: matches case-insensitively", async () => {
    mockConversations([{ id: "1", title: "My Chat" }]);
    const result = await findConversationByTitle("my-chat");
    expect(result.id).toBe("1");
    expect(result.title).toBe("My Chat");
  });

  it("B18: converts dashes to spaces", async () => {
    mockConversations([{ id: "1", title: "My Cool Chat" }]);
    const result = await findConversationByTitle("My-Cool-Chat");
    expect(result.id).toBe("1");
    expect(result.title).toBe("My Cool Chat");
  });

  it("B19: supports prefix matching", async () => {
    mockConversations([{ id: "1", title: "My Long Conversation Title" }]);
    const result = await findConversationByTitle("My-Long");
    expect(result.id).toBe("1");
    expect(result.title).toBe("My Long Conversation Title");
  });

  it("B20: throws ConversationNotFoundError when no match", async () => {
    mockConversations([]);
    await expect(findConversationByTitle("Nonexistent")).rejects.toThrow(
      "Conversation not found: Nonexistent",
    );
  });

  it("B21: throws AmbiguousConversationError when multiple matches", async () => {
    mockConversations([
      { id: "1", title: "Chat About Dogs" },
      { id: "2", title: "Chat About Cats" },
    ]);
    await expect(findConversationByTitle("Chat")).rejects.toThrow(
      'Ambiguous conversation title: "Chat"',
    );
  });

  it("resolves exact match when multiple prefix matches exist", async () => {
    mockConversations([
      { id: "1", title: "Chat" },
      { id: "2", title: "Chat About Dogs" },
    ]);
    const result = await findConversationByTitle("Chat");
    expect(result.id).toBe("1");
    expect(result.title).toBe("Chat");
  });
});

describe("resolveCommand", () => {
  beforeEach(() => {
    mockSelect.mockReset();
  });

  it("B22: select returns all messages formatted as Role: content pairs", async () => {
    mockConversationsAndMessages(
      [{ id: "1", title: "Test Chat" }],
      [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    );

    const result = await resolveCommand("select", "Test-Chat");
    expect(result.type).toBe("select");
    expect(result.conversationId).toBe("1");
    expect(result.content).toBe("User: Hello\nAssistant: Hi there");
    expect(result.messageCount).toBe(2);
  });

  it("B23: select:user returns only user messages", async () => {
    mockConversationsAndMessages(
      [{ id: "1", title: "Test Chat" }],
      [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: "How are you?" },
      ],
    );

    const result = await resolveCommand("select:user", "Test-Chat");
    expect(result.content).toBe("User: Hello\nUser: How are you?");
  });

  it("B24: select:assistant returns only assistant messages", async () => {
    mockConversationsAndMessages(
      [{ id: "1", title: "Test Chat" }],
      [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: "How are you?" },
        { role: "assistant", content: "I am fine" },
      ],
    );

    const result = await resolveCommand("select:assistant", "Test-Chat");
    expect(result.content).toBe("Assistant: Hi there\nAssistant: I am fine");
  });

  it("B25: select:last returns last user and last assistant message", async () => {
    mockConversationsAndMessages(
      [{ id: "1", title: "Test Chat" }],
      [
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Second question" },
        { role: "assistant", content: "Second answer" },
      ],
    );

    const result = await resolveCommand("select:last", "Test-Chat");
    expect(result.content).toBe("User: Second question\nAssistant: Second answer");
  });

  it("B26: select truncates at MAX_SELECT_CHARS", async () => {
    const longContent = "A".repeat(5000);
    mockConversationsAndMessages(
      [{ id: "1", title: "Test Chat" }],
      [{ role: "user", content: longContent }],
    );

    const result = await resolveCommand("select", "Test-Chat");
    expect(result.content.length).toBeLessThanOrEqual(4000 + " [truncated]".length + 10);
    expect(result.content).toContain("[truncated]");
  });

  it("B32: link returns empty string content", async () => {
    mockConversationsAndMessages([{ id: "1", title: "Test Chat" }], []);

    const result = await resolveCommand("link", "Test-Chat");
    expect(result.content).toBe("");
    expect(result.type).toBe("link");
  });

  it("B33: link does not produce content", async () => {
    mockConversationsAndMessages(
      [{ id: "1", title: "Test Chat" }],
      [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "World" },
      ],
    );

    const result = await resolveCommand("link", "Test-Chat");
    expect(result.content).toBe("");
  });
});

describe("resolveCommand LLM calls", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mockSelect.mockReset();
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockLLMResponse(content: string) {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  }

  it("B27: summarize calls LLM and prefixes with conversation title", async () => {
    mockConversationsAndMessages(
      [{ id: "1", title: "Test Chat" }],
      [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
    );
    mockLLMResponse("This was a greeting conversation.");

    const result = await resolveCommand("summarize", "Test-Chat");
    expect(result.content).toBe('Summary of "Test Chat": This was a greeting conversation.');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("B28: keypoints calls LLM for bullet-point extraction", async () => {
    mockConversationsAndMessages(
      [{ id: "1", title: "Test Chat" }],
      [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ],
    );
    mockLLMResponse("- Greeting exchanged\n- Brief interaction");

    const result = await resolveCommand("keypoints", "Test-Chat");
    expect(result.content).toBe("- Greeting exchanged\n- Brief interaction");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("B29: inject calls LLM with conversation and question", async () => {
    mockConversationsAndMessages(
      [{ id: "1", title: "Test Chat" }],
      [
        { role: "user", content: "What is TypeScript?" },
        { role: "assistant", content: "TypeScript is a typed superset of JavaScript." },
      ],
    );
    mockLLMResponse("The conclusion was that TypeScript adds types to JavaScript.");

    const result = await resolveCommand("inject", "Test-Chat", "What was the conclusion?");
    expect(result.content).toBe("The conclusion was that TypeScript adds types to JavaScript.");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("B30: inject uses default question when none provided", async () => {
    mockConversationsAndMessages(
      [{ id: "1", title: "Test Chat" }],
      [{ role: "user", content: "Hello" }],
    );
    mockLLMResponse("Key insight: greeting");

    const result = await resolveCommand("inject", "Test-Chat");
    expect(result.content).toBe("Key insight: greeting");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("B31: LLM failure throws CommandResolutionError", async () => {
    mockConversationsAndMessages(
      [{ id: "1", title: "Test Chat" }],
      [{ role: "user", content: "Hello" }],
    );
    fetchSpy.mockResolvedValue(new Response("Internal Server Error", { status: 500 }));

    await expect(resolveCommand("summarize", "Test-Chat")).rejects.toThrow("LLM call failed: 500");
  });
});
