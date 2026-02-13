"use client";

import { Link2 } from "lucide-react";

interface ReferenceBadgeProps {
  conversationId: string;
  referenceCount: number;
}

export function ReferenceBadge({ conversationId, referenceCount }: ReferenceBadgeProps) {
  if (referenceCount === 0) {
    return null;
  }

  return (
    <output
      className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"
      title={`${referenceCount} reference${referenceCount === 1 ? "" : "s"}`}
      aria-label={`${referenceCount} reference${referenceCount === 1 ? "" : "s"} for conversation ${conversationId}`}
    >
      <Link2 className="size-3" />
      <span>{referenceCount}</span>
    </output>
  );
}
