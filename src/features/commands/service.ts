import { getLogger } from "@/core/logging";

import type { CommandType } from "./constants";
import * as repository from "./repository";
import type { ResolvedCommand } from "./resolver";
import { resolveCommand } from "./resolver";

const logger = getLogger("commands.service");

interface ResolveResult {
  resolved: ResolvedCommand[];
  errors: Array<{ type: CommandType; conversationTitle: string; error: string }>;
}

/**
 * Resolve an array of commands. Returns partial results if some fail.
 * Also creates cross-reference records for each resolved command.
 */
export async function resolveCommands(
  commands: Array<{ type: CommandType; conversationTitle: string; question?: string | undefined }>,
  sourceConversationId?: string,
): Promise<ResolveResult> {
  logger.info({ commandCount: commands.length, sourceConversationId }, "commands.resolve_started");

  const resolved: ResolvedCommand[] = [];
  const errors: ResolveResult["errors"] = [];

  for (const cmd of commands) {
    try {
      const result = await resolveCommand(cmd.type, cmd.conversationTitle, cmd.question);
      resolved.push(result);

      // Create cross-reference if we have a source conversation
      if (sourceConversationId) {
        await repository.createCrossReference({
          sourceConversationId,
          targetConversationId: result.conversationId,
          command: cmd.type,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push({
        type: cmd.type,
        conversationTitle: cmd.conversationTitle,
        error: message,
      });
      logger.warn(
        { type: cmd.type, conversationTitle: cmd.conversationTitle, error: message },
        "commands.resolve_partial_failure",
      );
    }
  }

  logger.info(
    { resolvedCount: resolved.length, errorCount: errors.length },
    "commands.resolve_completed",
  );
  return { resolved, errors };
}
