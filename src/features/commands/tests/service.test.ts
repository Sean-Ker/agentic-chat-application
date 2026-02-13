import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { CommandType } from "../constants";
import type { CrossReference } from "../models";
import type { ResolvedCommand } from "../resolver";

// Mock the repository module
const mockRepository = {
  createCrossReference: mock<(data: unknown) => Promise<CrossReference>>(() =>
    Promise.resolve({} as CrossReference),
  ),
  findReferencesBySource: mock<(id: string) => Promise<CrossReference[]>>(() =>
    Promise.resolve([]),
  ),
  findReferencesByTarget: mock<(id: string) => Promise<CrossReference[]>>(() =>
    Promise.resolve([]),
  ),
  findAllReferences: mock<(id: string) => Promise<CrossReference[]>>(() => Promise.resolve([])),
  deleteReferencesBySource: mock<(id: string) => Promise<void>>(() => Promise.resolve()),
};

// Mock the resolver module
const mockResolver = {
  resolveCommand: mock<
    (type: CommandType, title: string, question?: string) => Promise<ResolvedCommand>
  >(() =>
    Promise.resolve({
      type: "select" as CommandType,
      conversationId: "550e8400-e29b-41d4-a716-446655440000",
      conversationTitle: "Test",
      content: "resolved content",
      messageCount: 5,
    }),
  ),
  findConversationByTitle: mock<(title: string) => Promise<{ id: string; title: string }>>(() =>
    Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000", title: "Test" }),
  ),
};

mock.module("../repository", () => mockRepository);
mock.module("../resolver", () => mockResolver);

const { resolveCommands } = await import("../service");

const mockResolvedCommand: ResolvedCommand = {
  type: "select",
  conversationId: "550e8400-e29b-41d4-a716-446655440000",
  conversationTitle: "Test Conversation",
  content: "User: Hello\nAssistant: Hi there",
  messageCount: 2,
};

const mockCrossReference: CrossReference = {
  id: "660e8400-e29b-41d4-a716-446655440000",
  sourceConversationId: "770e8400-e29b-41d4-a716-446655440000",
  targetConversationId: "550e8400-e29b-41d4-a716-446655440000",
  command: "select",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("resolveCommands", () => {
  beforeEach(() => {
    mockResolver.resolveCommand.mockReset();
    mockRepository.createCrossReference.mockReset();
    mockResolver.resolveCommand.mockResolvedValue(mockResolvedCommand);
    mockRepository.createCrossReference.mockResolvedValue(mockCrossReference);
  });

  it("resolves an array of commands", async () => {
    const result = await resolveCommands([
      { type: "select", conversationTitle: "Test Conversation" },
    ]);

    expect(result.resolved.length).toBe(1);
    expect(result.errors.length).toBe(0);
    expect(result.resolved[0]).toEqual(mockResolvedCommand);
    expect(mockResolver.resolveCommand).toHaveBeenCalledWith(
      "select",
      "Test Conversation",
      undefined,
    );
  });

  it("creates cross-references when sourceConversationId is provided", async () => {
    const sourceId = "770e8400-e29b-41d4-a716-446655440000";

    await resolveCommands([{ type: "select", conversationTitle: "Test Conversation" }], sourceId);

    expect(mockRepository.createCrossReference).toHaveBeenCalledTimes(1);
    expect(mockRepository.createCrossReference).toHaveBeenCalledWith({
      sourceConversationId: sourceId,
      targetConversationId: mockResolvedCommand.conversationId,
      command: "select",
    });
  });

  it("does not create cross-references without sourceConversationId", async () => {
    await resolveCommands([{ type: "select", conversationTitle: "Test Conversation" }]);

    expect(mockRepository.createCrossReference).not.toHaveBeenCalled();
  });

  it("handles multiple commands of different types", async () => {
    const summaryResult: ResolvedCommand = {
      type: "summarize",
      conversationId: "880e8400-e29b-41d4-a716-446655440000",
      conversationTitle: "Another Conv",
      content: "Summary: This is a summary",
      messageCount: 10,
    };

    mockResolver.resolveCommand
      .mockResolvedValueOnce(mockResolvedCommand)
      .mockResolvedValueOnce(summaryResult);

    const result = await resolveCommands([
      { type: "select", conversationTitle: "Test Conversation" },
      { type: "summarize", conversationTitle: "Another Conv" },
    ]);

    expect(result.resolved.length).toBe(2);
    expect(result.errors.length).toBe(0);
    expect(result.resolved[0]?.type).toBe("select");
    expect(result.resolved[1]?.type).toBe("summarize");
  });

  it("returns partial results when some commands fail", async () => {
    mockResolver.resolveCommand
      .mockResolvedValueOnce(mockResolvedCommand)
      .mockRejectedValueOnce(new Error("Conversation not found: Missing"));

    const result = await resolveCommands([
      { type: "select", conversationTitle: "Test Conversation" },
      { type: "select", conversationTitle: "Missing" },
    ]);

    expect(result.resolved.length).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]?.conversationTitle).toBe("Missing");
    expect(result.errors[0]?.error).toBe("Conversation not found: Missing");
  });

  it("passes question to resolveCommand for inject type", async () => {
    await resolveCommands([
      { type: "inject", conversationTitle: "Test", question: "What happened?" },
    ]);

    expect(mockResolver.resolveCommand).toHaveBeenCalledWith("inject", "Test", "What happened?");
  });
});
