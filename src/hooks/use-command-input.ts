"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CommandType } from "@/features/commands/constants";
import { COMMAND_DESCRIPTIONS, VALID_COMMANDS } from "@/features/commands/constants";
import type { ParsedCommand } from "@/features/commands/parser";
import { hasCommands, parseCommands } from "@/features/commands/parser";

interface CommandDefinition {
  type: CommandType;
  description: string;
}

interface ConversationMatch {
  id: string;
  title: string;
  updatedAt: string;
}

const ALL_COMMANDS: CommandDefinition[] = VALID_COMMANDS.map((type) => ({
  type,
  description: COMMAND_DESCRIPTIONS[type],
}));

interface UseCommandInputReturn {
  isPopoverOpen: boolean;
  popoverMode: "commands" | "conversations";
  filteredCommands: CommandDefinition[];
  filteredConversations: ConversationMatch[];
  selectedIndex: number;
  handleInputChange: (value: string, cursorPosition: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  handleSelectCommand: (command: CommandType) => void;
  handleSelectConversation: (title: string) => void;
  dismissPopover: () => void;
  pendingCommands: ParsedCommand[];
  hasPendingCommands: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
}

export function useCommandInput(): UseCommandInputReturn {
  const [inputValue, setInputValue] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [popoverMode, setPopoverMode] = useState<"commands" | "conversations">("commands");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<CommandDefinition[]>(ALL_COMMANDS);
  const [filteredConversations, setFilteredConversations] = useState<ConversationMatch[]>([]);
  const [commandTriggerIndex, setCommandTriggerIndex] = useState(-1);
  const [, setSelectedCommand] = useState<CommandType | null>(null);
  const [conversationFilter, setConversationFilter] = useState("");
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingCommands = parseCommands(inputValue);
  const hasPendingCommands = hasCommands(inputValue);

  const dismissPopover = useCallback(() => {
    setIsPopoverOpen(false);
    setPopoverMode("commands");
    setSelectedIndex(0);
    setCommandTriggerIndex(-1);
    setSelectedCommand(null);
    setConversationFilter("");
    setFilteredConversations([]);
  }, []);

  // Fetch conversations when in conversation mode with debounce
  useEffect(() => {
    if (popoverMode !== "conversations") {
      return;
    }

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/chat/conversations/search?q=${encodeURIComponent(conversationFilter)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as { conversations: ConversationMatch[] };
          setFilteredConversations(data.conversations);
          setSelectedIndex(0);
        }
      } catch {
        // Silently ignore fetch errors
      }
    }, 200);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [conversationFilter, popoverMode]);

  const handleInputChange = useCallback(
    (value: string, cursor: number) => {
      setInputValue(value);
      setCursorPosition(cursor);

      if (popoverMode === "conversations") {
        // In conversation mode, track text typed after the command
        // The user is typing the @title portion
        const textAfterCommand = value.slice(commandTriggerIndex);
        // Find the @ sign if present
        const atIndex = textAfterCommand.indexOf("@");
        if (atIndex >= 0) {
          const filterText = textAfterCommand.slice(atIndex + 1);
          setConversationFilter(filterText);
        }
        return;
      }

      // Look for ; trigger at or before cursor
      const textUpToCursor = value.slice(0, cursor);
      const lastSemicolon = textUpToCursor.lastIndexOf(";");

      if (lastSemicolon === -1) {
        if (isPopoverOpen) {
          dismissPopover();
        }
        return;
      }

      // Check that ; is at start of word (preceded by space, newline, or start of string)
      const charBefore = lastSemicolon > 0 ? value[lastSemicolon - 1] : undefined;
      const isStartOfWord =
        lastSemicolon === 0 ||
        charBefore === " " ||
        charBefore === "\n" ||
        charBefore === "\r" ||
        charBefore === "\t";

      if (!isStartOfWord) {
        if (isPopoverOpen) {
          dismissPopover();
        }
        return;
      }

      const fragment = textUpToCursor.slice(lastSemicolon + 1);

      // If fragment contains a space, the user has moved past the command portion
      if (fragment.includes(" ") || fragment.includes("@")) {
        if (isPopoverOpen) {
          dismissPopover();
        }
        return;
      }

      // Filter commands based on what's typed after ;
      const matches = ALL_COMMANDS.filter((cmd) =>
        cmd.type.toLowerCase().startsWith(fragment.toLowerCase()),
      );

      setFilteredCommands(matches);
      setSelectedIndex(0);
      setCommandTriggerIndex(lastSemicolon);

      if (!isPopoverOpen) {
        setIsPopoverOpen(true);
        setPopoverMode("commands");
      }
    },
    [isPopoverOpen, popoverMode, commandTriggerIndex, dismissPopover],
  );

  const handleSelectCommand = useCallback(
    (command: CommandType) => {
      setSelectedCommand(command);

      // Replace the text from the trigger ; to cursor with the full command + @
      const before = inputValue.slice(0, commandTriggerIndex);
      const after = inputValue.slice(cursorPosition);
      const newValue = `${before};${command} @`;
      setInputValue(newValue + after);
      setCursorPosition(newValue.length);

      setPopoverMode("conversations");
      setSelectedIndex(0);
      setConversationFilter("");
    },
    [inputValue, commandTriggerIndex, cursorPosition],
  );

  const handleSelectConversation = useCallback(
    (title: string) => {
      // Replace dashes in title with hyphens (conversation titles use hyphens in commands)
      const hyphenatedTitle = title.replace(/\s+/g, "-");

      // Find where the @ is after command trigger
      const textFromTrigger = inputValue.slice(commandTriggerIndex);
      const atIndex = textFromTrigger.indexOf("@");
      if (atIndex === -1) {
        dismissPopover();
        return;
      }

      const insertPoint = commandTriggerIndex + atIndex + 1; // after the @
      const before = inputValue.slice(0, insertPoint);
      // Find the end of what the user typed after @, which is the rest until space or end
      const afterAt = inputValue.slice(insertPoint);
      const nextSpace = afterAt.search(/[\s]/);
      const after = nextSpace >= 0 ? afterAt.slice(nextSpace) : "";

      const newValue = `${before}${hyphenatedTitle}${after.length > 0 ? after : " "}`;
      setInputValue(newValue);
      setCursorPosition(before.length + hyphenatedTitle.length + 1);

      dismissPopover();
    },
    [inputValue, commandTriggerIndex, dismissPopover],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isPopoverOpen) {
        return false;
      }

      const items = popoverMode === "commands" ? filteredCommands : filteredConversations;
      const itemCount = items.length;

      if (e.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev + 1) % Math.max(itemCount, 1));
        return true;
      }

      if (e.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev - 1 + Math.max(itemCount, 1)) % Math.max(itemCount, 1));
        return true;
      }

      if (e.key === "Enter" || e.key === "Tab") {
        if (itemCount === 0) {
          return false;
        }
        if (popoverMode === "commands") {
          const selected = filteredCommands[selectedIndex];
          if (selected) {
            handleSelectCommand(selected.type);
          }
        } else {
          const selected = filteredConversations[selectedIndex];
          if (selected) {
            handleSelectConversation(selected.title);
          }
        }
        return true;
      }

      if (e.key === "Escape") {
        dismissPopover();
        return true;
      }

      return false;
    },
    [
      isPopoverOpen,
      popoverMode,
      filteredCommands,
      filteredConversations,
      selectedIndex,
      handleSelectCommand,
      handleSelectConversation,
      dismissPopover,
    ],
  );

  return {
    isPopoverOpen,
    popoverMode,
    filteredCommands,
    filteredConversations,
    selectedIndex,
    handleInputChange,
    handleKeyDown,
    handleSelectCommand,
    handleSelectConversation,
    dismissPopover,
    pendingCommands,
    hasPendingCommands,
    inputValue,
    setInputValue,
  };
}
