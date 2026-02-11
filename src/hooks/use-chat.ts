"use client";

import { useCallback, useEffect, useState } from "react";

import { useLocalStorage } from "./use-local-storage";

interface ChatMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (accumulated: string) => void,
): Promise<string> {
  const decoder = new TextDecoder();
  let accumulated = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const text = decoder.decode(value, { stream: true });
    const lines = text.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) {
        continue;
      }
      const data = line.slice(6);
      if (data === "[DONE]") {
        return accumulated;
      }
      try {
        const parsed = JSON.parse(data) as { content?: string };
        if (parsed.content) {
          accumulated += parsed.content;
          onChunk(accumulated);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  return accumulated;
}

function makeTempMessage(conversationId: string, role: string, content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}`,
    conversationId,
    role,
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function useChat() {
  const {
    items: conversations,
    addItem,
    removeItem,
    updateItem,
  } = useLocalStorage("chat-conversations");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/chat/conversations/${activeConversationId}/messages`);
        if (res.ok) {
          const data = (await res.json()) as { messages: ChatMessage[] };
          setMessages(data.messages);
        }
      } catch {
        // Ignore fetch errors
      }
    };

    void fetchMessages();
  }, [activeConversationId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming || !content.trim()) {
        return;
      }

      setIsStreaming(true);
      setStreamingContent("");

      const tempUserMessage = makeTempMessage(activeConversationId ?? "", "user", content);
      setMessages((prev) => [...prev, tempUserMessage]);

      try {
        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            conversationId: activeConversationId ?? undefined,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to send message");
        }

        const conversationId = res.headers.get("X-Conversation-Id");

        if (!activeConversationId && conversationId) {
          setActiveConversationId(conversationId);
          const title = content.length > 50 ? `${content.substring(0, 50)}...` : content;
          addItem({ id: conversationId, title, updatedAt: new Date().toISOString() });
          setMessages((prev) =>
            prev.map((m) => (m.id === tempUserMessage.id ? { ...m, conversationId } : m)),
          );
        } else if (activeConversationId) {
          updateItem(activeConversationId, { updatedAt: new Date().toISOString() });
        }

        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error("No reader");
        }

        const accumulated = await readSSEStream(reader, setStreamingContent);

        if (accumulated) {
          const assistantMessage = makeTempMessage(
            conversationId ?? activeConversationId ?? "",
            "assistant",
            accumulated,
          );
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } catch {
        // Could show error toast here
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
      }
    },
    [activeConversationId, isStreaming, addItem, updateItem],
  );

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setStreamingContent("");
  }, []);

  const createNewChat = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setStreamingContent("");
  }, []);

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        const res = await fetch(`/api/chat/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (res.ok) {
          updateItem(id, { title });
        }
      } catch {
        // Ignore errors
      }
    },
    [updateItem],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
        removeItem(id);
        if (activeConversationId === id) {
          setActiveConversationId(null);
          setMessages([]);
        }
      } catch {
        // Ignore errors
      }
    },
    [activeConversationId, removeItem],
  );

  return {
    conversations,
    activeConversationId,
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    selectConversation,
    createNewChat,
    renameConversation,
    deleteConversation,
  };
}
