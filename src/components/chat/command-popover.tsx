"use client";

import { useEffect, useRef } from "react";

import type { CommandType } from "@/features/commands/constants";
import { cn } from "@/lib/utils";

import { ConversationPicker } from "./conversation-picker";

interface CommandDefinition {
  type: CommandType;
  description: string;
}

interface ConversationMatch {
  id: string;
  title: string;
  updatedAt: string;
}

interface CommandPopoverProps {
  isOpen: boolean;
  mode: "commands" | "conversations";
  commands: CommandDefinition[];
  conversations: ConversationMatch[];
  selectedIndex: number;
  onSelectCommand: (command: CommandType) => void;
  onSelectConversation: (title: string) => void;
  onDismiss: () => void;
}

// Group boundaries: select variants (0-3), transform (4-6), link (7)
const SELECT_GROUP_END = 4;
const TRANSFORM_GROUP_END = 7;

export function CommandPopover({
  isOpen,
  mode,
  commands,
  conversations,
  selectedIndex,
  onSelectCommand,
  onSelectConversation,
  onDismiss,
}: CommandPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDismiss();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onDismiss]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-60 overflow-y-auto rounded-lg border bg-popover shadow-md"
    >
      {mode === "commands" ? (
        <div>
          <div className="px-3 pt-2 pb-1 text-xs text-muted-foreground">;commands</div>
          <div role="listbox" aria-label="Commands">
            {commands.map((cmd, index) => {
              const showSeparator = index === SELECT_GROUP_END || index === TRANSFORM_GROUP_END;
              return (
                <div key={cmd.type}>
                  {showSeparator && <div className="border-t border-border/50" />}
                  <div
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === selectedIndex}
                    className={cn(
                      "flex cursor-pointer items-baseline gap-2 px-3 py-2 text-sm",
                      index === selectedIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50",
                    )}
                    onClick={() => onSelectCommand(cmd.type)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onSelectCommand(cmd.type);
                      }
                    }}
                  >
                    <span className="shrink-0 font-mono text-xs text-primary">;{cmd.type}</span>
                    <span className="text-muted-foreground">{cmd.description}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="text-xs text-muted-foreground">Select conversation</span>
            <span className="text-xs text-muted-foreground/60">Type to filter</span>
          </div>
          <ConversationPicker
            conversations={conversations}
            selectedIndex={selectedIndex}
            onSelect={onSelectConversation}
            filterText=""
          />
        </div>
      )}
    </div>
  );
}
