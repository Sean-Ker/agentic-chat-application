import type { HttpStatusCode } from "@/core/api/errors";

/** Known error codes for command operations. */
export type CommandErrorCode =
  | "CONVERSATION_NOT_FOUND"
  | "AMBIGUOUS_CONVERSATION"
  | "INVALID_COMMAND"
  | "COMMAND_RESOLUTION_FAILED";

/**
 * Base error for command-related errors.
 */
export class CommandError extends Error {
  readonly code: CommandErrorCode;
  readonly statusCode: HttpStatusCode;

  constructor(message: string, code: CommandErrorCode, statusCode: HttpStatusCode) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ConversationNotFoundError extends CommandError {
  constructor(title: string) {
    super(`Conversation not found: ${title}`, "CONVERSATION_NOT_FOUND", 404);
  }
}

export class AmbiguousConversationError extends CommandError {
  readonly matches: string[];

  constructor(title: string, matches: string[]) {
    super(
      `Ambiguous conversation title: "${title}" matches: ${matches.join(", ")}`,
      "AMBIGUOUS_CONVERSATION",
      400,
    );
    this.matches = matches;
  }
}

export class InvalidCommandError extends CommandError {
  constructor(command: string) {
    super(`Invalid command: ${command}`, "INVALID_COMMAND", 400);
  }
}

export class CommandResolutionError extends CommandError {
  constructor(message: string) {
    super(message, "COMMAND_RESOLUTION_FAILED", 500);
  }
}
