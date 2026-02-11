"use client";

import { Bot } from "lucide-react";
import { useEffect, useRef } from "react";

import { useAutoScroll } from "@/hooks/use-auto-scroll";

import { MessageBubble } from "./message-bubble";

interface Message {
  id: string;
  role: string;
  content: string;
}

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
}

export function MessageList({ messages, streamingContent, isStreaming }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isScrolledToBottom } = useAutoScroll(containerRef);

  useEffect(() => {
    if (isScrolledToBottom()) {
      const el = containerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  });

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl py-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} role={message.role} content={message.content} />
        ))}
        {isStreaming && streamingContent && (
          <div className="flex gap-3 px-4 py-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
              <Bot className="text-muted-foreground size-4" />
            </div>
            <div className="bg-muted text-foreground max-w-[80%] rounded-2xl px-4 py-2.5">
              <p className="text-sm whitespace-pre-wrap">
                {streamingContent}
                <span className="streaming-cursor ml-0.5 inline-block h-4 w-1.5 align-middle" />
              </p>
            </div>
          </div>
        )}
        {isStreaming && !streamingContent && (
          <div className="flex gap-3 px-4 py-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
              <Bot className="text-muted-foreground size-4" />
            </div>
            <div className="bg-muted max-w-[80%] rounded-2xl px-4 py-2.5">
              <div className="flex items-center gap-1">
                <span className="bg-primary/60 size-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
                <span className="bg-primary/60 size-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
                <span className="bg-primary/60 size-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
