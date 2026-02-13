import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/core/database/client";
import { chatConversations } from "@/core/database/schema";
import { getLogger } from "@/core/logging";
import { findAllReferences } from "@/features/commands/repository";

const logger = getLogger("api.chat.conversations.references");

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  logger.info({ conversationId: id }, "conversations.references_started");

  // Verify conversation exists
  const conversations = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1);

  if (conversations.length === 0) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const references = await findAllReferences(id);

  // Enrich with target titles by looking up conversation titles
  const enriched = await Promise.all(
    references.map(async (ref) => {
      const targetId =
        ref.sourceConversationId === id ? ref.targetConversationId : ref.sourceConversationId;
      const target = await db
        .select({ title: chatConversations.title })
        .from(chatConversations)
        .where(eq(chatConversations.id, targetId))
        .limit(1);
      return {
        id: ref.id,
        sourceConversationId: ref.sourceConversationId,
        targetConversationId: ref.targetConversationId,
        targetTitle: target[0]?.title ?? "Unknown",
        command: ref.command,
        createdAt: ref.createdAt.toISOString(),
      };
    }),
  );

  logger.info({ conversationId: id, count: enriched.length }, "conversations.references_completed");
  return Response.json({ references: enriched });
}
