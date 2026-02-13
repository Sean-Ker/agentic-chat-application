import { describe, expect, it } from "bun:test";

import { hasCommands, parseCommands, replaceCommands } from "../parser";

describe("parseCommands", () => {
  it("B1: parses ;select @My-Convo", () => {
    const result = parseCommands(";select @My-Convo");
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("select");
    expect(result[0]?.conversationTitle).toBe("My-Convo");
    expect(result[0]?.startIndex).toBe(0);
    expect(result[0]?.endIndex).toBe(";select @My-Convo".length);
    expect(result[0]?.raw).toBe(";select @My-Convo");
    expect(result[0]?.question).toBeUndefined();
  });

  it("B2: parses ;select:user @Test", () => {
    const result = parseCommands(";select:user @Test");
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("select:user");
    expect(result[0]?.conversationTitle).toBe("Test");
  });

  it("B3: parses ;select:assistant @Test", () => {
    const result = parseCommands(";select:assistant @Test");
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("select:assistant");
    expect(result[0]?.conversationTitle).toBe("Test");
  });

  it("B4: parses ;select:last @Test", () => {
    const result = parseCommands(";select:last @Test");
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("select:last");
    expect(result[0]?.conversationTitle).toBe("Test");
  });

  it("B5: parses ;summarize @My-Chat", () => {
    const result = parseCommands(";summarize @My-Chat");
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("summarize");
    expect(result[0]?.conversationTitle).toBe("My-Chat");
  });

  it("B6: parses ;keypoints @My-Chat", () => {
    const result = parseCommands(";keypoints @My-Chat");
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("keypoints");
    expect(result[0]?.conversationTitle).toBe("My-Chat");
  });

  it('B7: parses ;inject @My-Chat "What was the conclusion?"', () => {
    const result = parseCommands(';inject @My-Chat "What was the conclusion?"');
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("inject");
    expect(result[0]?.conversationTitle).toBe("My-Chat");
    expect(result[0]?.question).toBe("What was the conclusion?");
  });

  it("B8: parses ;link @My-Chat", () => {
    const result = parseCommands(";link @My-Chat");
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("link");
    expect(result[0]?.conversationTitle).toBe("My-Chat");
  });

  it("B9: parses multiple commands with correct indices", () => {
    const text = "Hello ;select @A and ;summarize @B world";
    const result = parseCommands(text);
    expect(result).toHaveLength(2);

    expect(result[0]?.type).toBe("select");
    expect(result[0]?.conversationTitle).toBe("A");
    expect(result[0]?.startIndex).toBe(6);
    expect(result[0]?.endIndex).toBe(6 + ";select @A".length);

    expect(result[1]?.type).toBe("summarize");
    expect(result[1]?.conversationTitle).toBe("B");
    expect(result[1]?.startIndex).toBe(21);
    expect(result[1]?.endIndex).toBe(21 + ";summarize @B".length);
  });

  it("B10: returns empty array for text with no commands", () => {
    const result = parseCommands("no commands here");
    expect(result).toEqual([]);
  });

  it("B11: returns empty array for empty string", () => {
    const result = parseCommands("");
    expect(result).toEqual([]);
  });

  it("B12: returns empty array for invalid command", () => {
    const result = parseCommands(";invalid @Test");
    expect(result).toEqual([]);
  });
});

describe("hasCommands", () => {
  it("B13: returns true when text contains a command", () => {
    expect(hasCommands(";select @Test")).toBe(true);
  });

  it("B14: returns false when text has no commands", () => {
    expect(hasCommands("no commands")).toBe(false);
  });
});

describe("replaceCommands", () => {
  it("B15: correctly substitutes resolved content", () => {
    const text = "Here is ;select @MyChat for context";
    const resolutions = new Map<string, string>();
    resolutions.set(";select @MyChat", "[resolved content]");

    const result = replaceCommands(text, resolutions);
    expect(result).toBe("Here is [resolved content] for context");
  });

  it("B16: handles multiple commands without index corruption", () => {
    const text = "Start ;select @A middle ;summarize @B end";
    const resolutions = new Map<string, string>();
    resolutions.set(";select @A", "[content-A]");
    resolutions.set(";summarize @B", "[summary-B]");

    const result = replaceCommands(text, resolutions);
    expect(result).toBe("Start [content-A] middle [summary-B] end");
  });

  it("leaves text unchanged when resolution map is empty", () => {
    const text = "Hello ;select @Test world";
    const resolutions = new Map<string, string>();

    const result = replaceCommands(text, resolutions);
    expect(result).toBe(text);
  });

  it("handles replacement with longer content", () => {
    const text = ";select @A ;select @B";
    const resolutions = new Map<string, string>();
    resolutions.set(";select @A", "This is a very long replacement text for A");
    resolutions.set(";select @B", "Short B");

    const result = replaceCommands(text, resolutions);
    expect(result).toBe("This is a very long replacement text for A Short B");
  });
});
