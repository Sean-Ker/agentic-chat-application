import { sql } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { db } from "@/core/database/client";
import { chatConversations } from "@/core/database/schema";
import { getLogger } from "@/core/logging";

const logger = getLogger("api.chat.conversations.search");

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length === 0) {
    return Response.json({ conversations: [] });
  }

  logger.info({ query: q }, "conversations.search_started");

  const results = await db
    .select({
      id: chatConversations.id,
      title: chatConversations.title,
      updatedAt: chatConversations.updatedAt,
    })
    .from(chatConversations)
    .where(sql`lower(${chatConversations.title}) like lower(${`${q}%`})`)
    .limit(10);

  const conversations = results.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt.toISOString(),
  }));

  logger.info({ query: q, count: conversations.length }, "conversations.search_completed");
  return Response.json({ conversations });
}
