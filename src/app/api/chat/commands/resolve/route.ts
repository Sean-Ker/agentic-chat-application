import type { NextRequest } from "next/server";

import { handleApiError } from "@/core/api/errors";
import { getLogger } from "@/core/logging";
import { ResolveCommandsSchema } from "@/features/commands/schemas";
import { resolveCommands } from "@/features/commands/service";

const logger = getLogger("api.chat.commands.resolve");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { commands, sourceConversationId } = ResolveCommandsSchema.parse(body);

    logger.info({ commandCount: commands.length }, "commands.resolve_api_started");
    const result = await resolveCommands(commands, sourceConversationId);
    logger.info({ resolvedCount: result.resolved.length }, "commands.resolve_api_completed");

    return Response.json({ resolved: result.resolved, errors: result.errors });
  } catch (error) {
    return handleApiError(error);
  }
}
