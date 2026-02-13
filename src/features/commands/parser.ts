import type { CommandType } from "@/features/commands/constants";
import { COMMAND_REGEX } from "@/features/commands/constants";

export interface ParsedCommand {
  type: CommandType;
  conversationTitle: string;
  question?: string;
  startIndex: number;
  endIndex: number;
  raw: string;
}

/**
 * Parse all ;commands from input text.
 * Returns an array of parsed commands with their positions.
 */
export function parseCommands(text: string): ParsedCommand[] {
  const regex = new RegExp(COMMAND_REGEX.source, COMMAND_REGEX.flags);
  const commands: ParsedCommand[] = [];

  for (const match of text.matchAll(regex)) {
    const type = match[1] as CommandType;
    const conversationTitle = match[2];
    const question = match[3];

    if (type === undefined || conversationTitle === undefined || match.index === undefined) {
      continue;
    }

    const command: ParsedCommand = {
      type,
      conversationTitle,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      raw: match[0],
    };

    if (question !== undefined) {
      command.question = question;
    }

    commands.push(command);
  }

  return commands;
}

/**
 * Check if text contains any ;commands.
 */
export function hasCommands(text: string): boolean {
  const regex = new RegExp(COMMAND_REGEX.source, COMMAND_REGEX.flags);
  return regex.test(text);
}

/**
 * Replace resolved commands back into the original text.
 * Replaces from end to start to maintain correct indices.
 * The key of the resolutions map is the `raw` string of the command.
 */
export function replaceCommands(text: string, resolutions: Map<string, string>): string {
  const commands = parseCommands(text);

  // Sort by startIndex descending so replacing from end doesn't corrupt earlier indices
  const sorted = [...commands].sort((a, b) => b.startIndex - a.startIndex);

  let result = text;
  for (const cmd of sorted) {
    const resolved = resolutions.get(cmd.raw);
    if (resolved !== undefined) {
      result = result.slice(0, cmd.startIndex) + resolved + result.slice(cmd.endIndex);
    }
  }

  return result;
}
