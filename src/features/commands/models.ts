import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import { chatCrossReferences as crossReferences } from "@/core/database/schema";

export { crossReferences };

export type CrossReference = InferSelectModel<typeof crossReferences>;
export type NewCrossReference = InferInsertModel<typeof crossReferences>;
