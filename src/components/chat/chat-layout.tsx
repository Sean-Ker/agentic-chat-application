"use client";

import { MessageSquare } from "lucide-react";
import { useCallback, useState } from "react";

import { useChat } from "@/hooks/use-chat";

import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { ChatSidebar } from "./chat-sidebar";
import { MessageList } from "./message-list";

export function ChatLayout() {
  const {
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
  } = useChat();

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const activeTitle = conversations.find((c) => c.id === activeConversationId)?.title ?? null;

  const toggleSidebar = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="flex h-screen">
      <ChatSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onNewChat={createNewChat}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
        isMobileOpen={isMobileOpen}
        onMobileClose={closeMobile}
      />

      <div className="chat-gradient-bg flex flex-1 flex-col">
        <ChatHeader title={activeTitle} onToggleSidebar={toggleSidebar} />

        {hasMessages ? (
          <MessageList
            messages={messages}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
            <div className="bg-primary/10 flex size-16 items-center justify-center rounded-2xl">
              <MessageSquare className="text-primary size-8" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold">How can I help you today?</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Start a conversation by typing a message below.
              </p>
            </div>
          </div>
        )}

        <ChatInput onSend={sendMessage} disabled={isStreaming} />
      </div>
    </div>
  );
}
