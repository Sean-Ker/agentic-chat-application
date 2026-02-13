import { describe, expect, it } from "bun:test";

import {
  AmbiguousConversationError,
  CommandError,
  CommandResolutionError,
  ConversationNotFoundError,
  InvalidCommandError,
} from "../errors";

describe("CommandError", () => {
  it("has code and statusCode properties", () => {
    const error = new CommandError("test error", "INVALID_COMMAND", 400);
    expect(error.message).toBe("test error");
    expect(error.code).toBe("INVALID_COMMAND");
    expect(error.statusCode).toBe(400);
    expect(error).toBeInstanceOf(Error);
  });

  it("sets the constructor name", () => {
    const error = new CommandError("test", "INVALID_COMMAND", 400);
    expect(error.name).toBe("CommandError");
  });
});

describe("ConversationNotFoundError", () => {
  it("has code CONVERSATION_NOT_FOUND and statusCode 404", () => {
    const error = new ConversationNotFoundError("My Chat");
    expect(error.message).toBe("Conversation not found: My Chat");
    expect(error.code).toBe("CONVERSATION_NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error).toBeInstanceOf(CommandError);
  });
});

describe("AmbiguousConversationError", () => {
  it("has code AMBIGUOUS_CONVERSATION, statusCode 400, and matches array", () => {
    const matches = ["Chat A", "Chat B"];
    const error = new AmbiguousConversationError("Chat", matches);
    expect(error.message).toBe('Ambiguous conversation title: "Chat" matches: Chat A, Chat B');
    expect(error.code).toBe("AMBIGUOUS_CONVERSATION");
    expect(error.statusCode).toBe(400);
    expect(error.matches).toEqual(["Chat A", "Chat B"]);
    expect(error).toBeInstanceOf(CommandError);
  });
});

describe("InvalidCommandError", () => {
  it("has code INVALID_COMMAND and statusCode 400", () => {
    const error = new InvalidCommandError("badcmd");
    expect(error.message).toBe("Invalid command: badcmd");
    expect(error.code).toBe("INVALID_COMMAND");
    expect(error.statusCode).toBe(400);
    expect(error).toBeInstanceOf(CommandError);
  });
});

describe("CommandResolutionError", () => {
  it("has code COMMAND_RESOLUTION_FAILED and statusCode 500", () => {
    const error = new CommandResolutionError("resolution failed");
    expect(error.message).toBe("resolution failed");
    expect(error.code).toBe("COMMAND_RESOLUTION_FAILED");
    expect(error.statusCode).toBe(500);
    expect(error).toBeInstanceOf(CommandError);
  });
});
