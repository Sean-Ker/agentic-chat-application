import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";

import type { Conversation, Message } from "@/features/chat";

const mockConversation: Conversation = {
  id: "conv-123",
  title: "Test Conversation",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockMessage: Message = {
  id: "msg-123",
  conversationId: "conv-123",
  role: "user",
  content: "Hello",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// Mock the repository (database layer)
const mockCreateConversation = mock(() => Promise.resolve(mockConversation));
const mockFindMessagesByConversationId = mock(() => Promise.resolve([mockMessage]));
const mockCreateMessage = mock(() => Promise.resolve(mockMessage));

mock.module("@/features/chat/repository", () => ({
  createConversation: mockCreateConversation,
  findConversationById: mock(() => Promise.resolve(mockConversation)),
  updateConversation: mock(() => Promise.resolve(mockConversation)),
  deleteConversation: mock(() => Promise.resolve(true)),
  findMessagesByConversationId: mockFindMessagesByConversationId,
  createMessage: mockCreateMessage,
}));

// Mock the stream module
const mockStreamChatCompletion = mock(() => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"content":"Hello"}\n\n'));
      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return Promise.resolve({ stream, fullResponse: Promise.resolve("Hello") });
});

mock.module("@/features/chat/stream", () => ({
  streamChatCompletion: mockStreamChatCompletion,
  buildMessages: mock((history: Message[]) => [
    { role: "system", content: "test" },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ]),
}));

// Import route after mocking
const { POST } = await import("./route");

describe("POST /api/chat/send", () => {
  beforeEach(() => {
    mockCreateConversation.mockClear();
    mockFindMessagesByConversationId.mockClear();
    mockCreateMessage.mockClear();
    mockStreamChatCompletion.mockClear();
  });

  it("returns SSE response with correct headers", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/send", {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");
  });

  it("returns X-Conversation-Id header", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/send", {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);

    expect(response.headers.get("X-Conversation-Id")).toBe("conv-123");
  });

  it("creates new conversation when no conversationId provided", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/send", {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(mockCreateConversation).toHaveBeenCalledTimes(1);
  });

  it("uses existing conversation when conversationId provided", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/send", {
      method: "POST",
      body: JSON.stringify({
        content: "Hello",
        conversationId: "550e8400-e29b-41d4-a716-446655440000",
      }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(mockCreateConversation).not.toHaveBeenCalled();
  });

  it("returns 400 for empty content", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/send", {
      method: "POST",
      body: JSON.stringify({ content: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for missing content", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/send", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("saves user message and assistant message", async () => {
    const request = new NextRequest("http://localhost:3000/api/chat/send", {
      method: "POST",
      body: JSON.stringify({ content: "Hello" }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    // Wait for the fire-and-forget assistant message save
    await new Promise((resolve) => setTimeout(resolve, 50));

    // User message + assistant message
    expect(mockCreateMessage).toHaveBeenCalledTimes(2);
  });
});
