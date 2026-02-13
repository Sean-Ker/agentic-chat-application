"use client";

import { cn } from "@/lib/utils";

interface ConversationMatch {
  id: string;
  title: string;
  updatedAt: string;
}

interface ConversationPickerProps {
  conversations: ConversationMatch[];
  selectedIndex: number;
  onSelect: (title: string) => void;
  filterText: string;
}

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHrs = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }
  if (diffHrs < 24) {
    return `${diffHrs} hour${diffHrs === 1 ? "" : "s"} ago`;
  }
  if (diffDays < 2) {
    return "yesterday";
  }
  return `${diffDays} days ago`;
}

export function ConversationPicker({
  conversations,
  selectedIndex,
  onSelect,
  filterText,
}: ConversationPickerProps) {
  if (conversations.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
        {filterText ? "No matching conversations" : "No conversations available"}
      </div>
    );
  }

  return (
    <div role="listbox" aria-label="Conversations">
      {conversations.map((conversation, index) => (
        <div
          key={conversation.id}
          role="option"
          tabIndex={-1}
          aria-selected={index === selectedIndex}
          aria-label={conversation.title}
          className={cn(
            "flex cursor-pointer items-center justify-between px-3 py-2 text-sm",
            index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
          )}
          onClick={() => onSelect(conversation.title)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSelect(conversation.title);
            }
          }}
        >
          <span className="truncate">{conversation.title}</span>
          <span className="ml-2 shrink-0 text-xs text-muted-foreground">
            {formatRelativeTime(conversation.updatedAt)}
          </span>
        </div>
      ))}
    </div>
  );
}
