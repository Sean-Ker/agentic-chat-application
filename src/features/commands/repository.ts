import { eq, or } from "drizzle-orm";

import { db } from "@/core/database/client";

import type { CrossReference, NewCrossReference } from "./models";
import { crossReferences } from "./models";

export async function createCrossReference(data: NewCrossReference): Promise<CrossReference> {
  const results = await db.insert(crossReferences).values(data).returning();
  const ref = results[0];
  if (!ref) {
    throw new Error("Failed to create cross-reference");
  }
  return ref;
}

export async function findReferencesBySource(conversationId: string): Promise<CrossReference[]> {
  return db
    .select()
    .from(crossReferences)
    .where(eq(crossReferences.sourceConversationId, conversationId));
}

export async function findReferencesByTarget(conversationId: string): Promise<CrossReference[]> {
  return db
    .select()
    .from(crossReferences)
    .where(eq(crossReferences.targetConversationId, conversationId));
}

export async function findAllReferences(conversationId: string): Promise<CrossReference[]> {
  return db
    .select()
    .from(crossReferences)
    .where(
      or(
        eq(crossReferences.sourceConversationId, conversationId),
        eq(crossReferences.targetConversationId, conversationId),
      ),
    );
}

export async function deleteReferencesBySource(conversationId: string): Promise<void> {
  await db.delete(crossReferences).where(eq(crossReferences.sourceConversationId, conversationId));
}
