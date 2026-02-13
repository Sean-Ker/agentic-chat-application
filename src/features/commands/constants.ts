export const COMMAND_PREFIX = ";";

export const VALID_COMMANDS = [
  "select",
  "select:user",
  "select:assistant",
  "select:last",
  "summarize",
  "keypoints",
  "inject",
  "link",
] as const;

export type CommandType = (typeof VALID_COMMANDS)[number];

export const COMMAND_DESCRIPTIONS: Record<CommandType, string> = {
  select: "Pull all messages from a conversation",
  "select:user": "Pull only user messages",
  "select:assistant": "Pull only assistant messages",
  "select:last": "Pull the last user+assistant exchange",
  summarize: "Summarize a conversation into key points",
  keypoints: "Extract bullet-point takeaways",
  inject: "Ask a question about a conversation",
  link: "Create a reference link between conversations",
};

export const MAX_SELECT_CHARS = 4000;
export const MAX_SUMMARY_CHARS = 1000;

// Regex for parsing commands from text
// Matches: ;command @Conversation-Title or ;command @Conversation-Title "question"
export const COMMAND_REGEX =
  /;(select(?::user|:assistant|:last)?|summarize|keypoints|inject|link)\s+@([^\s"]+)(?:\s+"([^"]*)")?/g;
