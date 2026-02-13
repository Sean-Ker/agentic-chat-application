import postgres from "postgres";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false });

async function migrate() {
  console.log("Creating chat_cross_references table...");

  await sql`
    CREATE TABLE IF NOT EXISTS chat_cross_references (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      target_conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      command TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;

  console.log("Creating indexes...");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_cross_refs_source
    ON chat_cross_references(source_conversation_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_cross_refs_target
    ON chat_cross_references(target_conversation_id)
  `;

  console.log("Migration complete.");
  await sql.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
