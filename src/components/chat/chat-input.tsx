"use client";

import { Send } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useCallback, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCommandInput } from "@/hooks/use-command-input";

import { CommandPopover } from "./command-popover";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    isPopoverOpen,
    popoverMode,
    filteredCommands,
    filteredConversations,
    selectedIndex,
    handleInputChange,
    handleKeyDown: handlePopoverKeyDown,
    handleSelectCommand,
    handleSelectConversation,
    dismissPopover,
    pendingCommands,
    hasPendingCommands,
    inputValue,
    setInputValue,
  } = useCommandInput();

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || disabled) {
      return;
    }
    onSend(trimmed);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [inputValue, disabled, onSend, setInputValue]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (handlePopoverKeyDown(e)) {
        e.preventDefault();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handlePopoverKeyDown, handleSend],
  );

  return (
    <div className="border-t border-border/50 bg-background/80 p-4 backdrop-blur-sm">
      <div className="relative mx-auto max-w-3xl">
        <CommandPopover
          isOpen={isPopoverOpen}
          mode={popoverMode}
          commands={filteredCommands}
          conversations={filteredConversations}
          selectedIndex={selectedIndex}
          onSelectCommand={handleSelectCommand}
          onSelectConversation={handleSelectConversation}
          onDismiss={dismissPopover}
        />
        <div className="chat-input-glow flex items-end gap-2 rounded-xl bg-muted/50 p-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value, e.target.selectionStart ?? 0)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... Use ; for commands"
            disabled={disabled}
            className="max-h-32 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            rows={1}
          />
          {hasPendingCommands && (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {pendingCommands.length} cmd{pendingCommands.length > 1 ? "s" : ""}
            </span>
          )}
          <Button
            onClick={handleSend}
            disabled={disabled || !inputValue.trim()}
            size="icon"
            className="send-button-glow shrink-0"
            aria-label={hasPendingCommands ? "Send (commands will be resolved)" : "Send message"}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground/50 mt-1.5 text-center text-xs">
        Enter to send · Shift+Enter for new line · Type ; for commands
      </p>
    </div>
  );
}
