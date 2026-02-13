# Cross-Conversation Command System & Knowledge Graph

Build a cross-conversation command system with a rich Markdown editor input, injectable context via `;commands`, and a Neo4j-powered knowledge graph visualization. Users type `;` to trigger a command palette that can pull content from other conversations, summarize, extract key points, and link conversations — all rendered in a live graph panel.

## Problem Statement

Chat interfaces today are **isolated silos**. Each conversation is a dead-end thread with no way to reference, compose, or relate conversations to each other. Context is static — you get the last N messages and nothing else.

**Solution**: Turn conversations into **composable, addressable units** with a Unix pipe-like `;command` syntax. Replace the plain textarea with a Markdown editor that supports inline commands, context injection, and a live knowledge graph showing how conversations connect.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript (strict), Tailwind CSS 4, shadcn/ui |
| Rich Editor | CodeMirror 6 (@codemirror/view, @codemirror/state, @codemirror/lang-markdown) |
| Graph Viz | @neo4j-nvl/react (Neo4j Visualization Library) or react-force-graph-2d |
| Backend | Next.js API Routes (App Router) |
| Database | Supabase PostgreSQL via Drizzle ORM (existing) |
| Graph DB | Neo4j (neo4j-driver, bolt protocol) |
| LLM | OpenRouter API (existing) |
| Testing | Bun test + React Testing Library + agent-browser CLI |

## Existing Codebase Context

This builds on top of an existing chat application. Key files that MUST NOT be broken:

| File | Purpose | Modify? |
|------|---------|---------|
| `src/core/database/schema.ts` | Drizzle schema — extend with new tables | YES (append only) |
| `src/core/database/client.ts` | DB client | NO |
| `src/core/config/env.ts` | Env vars — add NEO4J vars | YES (append only) |
| `src/core/api/errors.ts` | Error handler | NO |
| `src/core/logging/index.ts` | Structured logging | NO |
| `src/features/chat/` | Chat feature vertical slice | YES (extend, don't break) |
| `src/hooks/use-chat.ts` | Chat state management hook | YES (extend interface) |
| `src/components/chat/chat-layout.tsx` | Main layout — add graph panel | YES |
| `src/components/chat/chat-input.tsx` | REPLACED by new Markdown editor | YES (rewrite) |
| `src/components/chat/message-bubble.tsx` | Message rendering — extend for injected context | YES |
| `src/app/api/chat/send/route.ts` | Send endpoint — extend for command processing | YES |

### Existing Database Schema (DO NOT MODIFY existing tables)

```sql
-- Already exists in schema.ts
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

### Existing API Endpoints (DO NOT BREAK)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/chat/send` | Send message + stream response |
| POST | `/api/chat/conversations` | Create conversation |
| GET | `/api/chat/conversations/[id]` | Get conversation |
| PATCH | `/api/chat/conversations/[id]` | Rename conversation |
| DELETE | `/api/chat/conversations/[id]` | Delete conversation |
| GET | `/api/chat/conversations/[id]/messages` | Get messages |

## Project Structure (New & Modified Files)

```
src/
├── core/
│   ├── config/
│   │   └── env.ts                          # MODIFY: add NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
│   ├── database/
│   │   └── schema.ts                       # MODIFY: add command_executions, conversation_links tables
│   └── neo4j/
│       ├── client.ts                       # NEW: Neo4j driver singleton
│       └── index.ts                        # NEW: public exports
├── features/
│   ├── chat/
│   │   ├── schemas.ts                      # MODIFY: extend SendMessageSchema with commands
│   │   ├── service.ts                      # MODIFY: add command processing
│   │   ├── repository.ts                   # MODIFY: add cross-conversation queries
│   │   ├── errors.ts                       # MODIFY: add command-specific errors
│   │   └── index.ts                        # MODIFY: export new functions
│   ├── commands/
│   │   ├── models.ts                       # NEW: Drizzle types for command tables
│   │   ├── schemas.ts                      # NEW: Zod schemas for command validation
│   │   ├── errors.ts                       # NEW: command error classes
│   │   ├── parser.ts                       # NEW: ;command syntax parser
│   │   ├── executor.ts                     # NEW: command execution engine
│   │   ├── registry.ts                     # NEW: command registry (maps names to handlers)
│   │   ├── handlers/
│   │   │   ├── select.ts                   # NEW: ;select command handler
│   │   │   ├── summarize.ts                # NEW: ;summarize command handler
│   │   │   ├── keypoints.ts                # NEW: ;keypoints command handler
│   │   │   ├── inject.ts                   # NEW: ;inject command handler
│   │   │   ├── link.ts                     # NEW: ;link command handler
│   │   │   ├── search.ts                   # NEW: ;search command handler
│   │   │   ├── diff.ts                     # NEW: ;diff command handler
│   │   │   └── ask.ts                      # NEW: ;ask command handler
│   │   ├── repository.ts                   # NEW: DB queries for commands
│   │   ├── service.ts                      # NEW: command business logic
│   │   ├── index.ts                        # NEW: public exports
│   │   └── tests/
│   │       ├── parser.test.ts              # NEW
│   │       ├── executor.test.ts            # NEW
│   │       ├── registry.test.ts            # NEW
│   │       ├── select.test.ts              # NEW
│   │       ├── summarize.test.ts           # NEW
│   │       └── schemas.test.ts             # NEW
│   └── graph/
│       ├── models.ts                       # NEW: graph node/edge types
│       ├── schemas.ts                      # NEW: Zod schemas for graph API
│       ├── errors.ts                       # NEW: graph error classes
│       ├── repository.ts                   # NEW: Neo4j queries
│       ├── service.ts                      # NEW: graph business logic
│       ├── index.ts                        # NEW: public exports
│       └── tests/
│           ├── repository.test.ts          # NEW
│           └── service.test.ts             # NEW
├── components/
│   ├── chat/
│   │   ├── chat-layout.tsx                 # MODIFY: add graph panel, resize handle
│   │   ├── chat-input.tsx                  # REWRITE: CodeMirror markdown editor
│   │   ├── command-popover.tsx             # NEW: ;command autocomplete popover
│   │   ├── command-palette.tsx             # NEW: full command palette (Cmd+;)
│   │   ├── injected-context-badge.tsx      # NEW: inline badge for injected content
│   │   ├── injected-context-preview.tsx    # NEW: expandable preview of injected content
│   │   ├── conversation-picker.tsx         # NEW: dialog to pick conversations/messages
│   │   ├── message-bubble.tsx              # MODIFY: render injected context blocks
│   │   └── message-list.tsx                # MODIFY: handle command result messages
│   ├── graph/
│   │   ├── graph-panel.tsx                 # NEW: Neo4j graph visualization panel
│   │   ├── graph-node.tsx                  # NEW: custom node renderer
│   │   ├── graph-controls.tsx              # NEW: zoom, fit, filter controls
│   │   └── graph-tooltip.tsx               # NEW: hover tooltip for nodes/edges
│   └── ui/
│       ├── resizable.tsx                   # NEW: shadcn resizable panel
│       └── popover.tsx                     # NEW: shadcn popover (if not exists)
├── hooks/
│   ├── use-chat.ts                         # MODIFY: add command processing to sendMessage
│   ├── use-commands.ts                     # NEW: command state management
│   ├── use-graph.ts                        # NEW: graph data fetching and state
│   └── use-codemirror.ts                   # NEW: CodeMirror integration hook
├── app/
│   └── api/
│       ├── chat/
│       │   └── send/
│       │       └── route.ts                # MODIFY: process commands before LLM call
│       ├── commands/
│       │   ├── execute/
│       │   │   └── route.ts                # NEW: POST execute a command
│       │   ├── preview/
│       │   │   └── route.ts                # NEW: POST preview command result
│       │   └── suggestions/
│       │       └── route.ts                # NEW: GET command suggestions
│       ├── conversations/
│       │   └── search/
│       │       └── route.ts                # NEW: GET search conversations by content
│       └── graph/
│           ├── route.ts                    # NEW: GET graph data (nodes + edges)
│           ├── nodes/
│           │   └── route.ts                # NEW: GET/POST graph nodes
│           └── edges/
│               └── route.ts                # NEW: GET/POST graph edges
└── lib/
    └── command-utils.ts                    # NEW: shared command parsing utilities
```

## Agent Build Order & Communication

### Team Structure

| Agent | Owns | Does NOT Touch |
|-------|------|----------------|
| **database** | `src/core/database/schema.ts` (append), `src/core/neo4j/`, `src/features/commands/models.ts`, `src/features/commands/repository.ts`, `src/features/graph/models.ts`, `src/features/graph/repository.ts`, `src/core/config/env.ts` (append) | Components, hooks, API routes |
| **backend** | `src/features/commands/` (except models.ts, repository.ts), `src/features/graph/` (except models.ts, repository.ts), `src/features/chat/` (modify service, schemas, errors), `src/app/api/`, `src/lib/command-utils.ts` | Components, hooks, schema.ts |
| **frontend** | `src/components/`, `src/hooks/`, `src/app/page.tsx` | Database schema, feature services, API route handlers |

### Phase 1: All Agents Start Simultaneously (Contracts Below)

All three agents begin work immediately using the contracts defined in this plan. No agent waits for another — contracts are the source of truth.

### Phase 2: Lead Validation

1. Contract diff — compare backend endpoints vs frontend fetch calls
2. Start dev server (`bun run dev`)
3. Run `bun run lint && npx tsc --noEmit`
4. Run `bun test`
5. Run agent-browser E2E tests

---

## Database Schema Extensions

### New Tables (append to `src/core/database/schema.ts`)

```typescript
import { integer, jsonb, boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Command executions table — tracks every ;command run.
 */
export const commandExecutions = pgTable("command_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => chatConversations.id, { onDelete: "cascade" }),
  commandName: text("command_name").notNull(),          // e.g., "select", "summarize"
  commandInput: text("command_input").notNull(),         // Raw command string
  commandArgs: text("command_args"),                     // JSON: parsed arguments
  resultContent: text("result_content"),                 // The output of the command
  sourceConversationIds: text("source_conversation_ids"), // JSON: array of UUIDs referenced
  status: text("status").notNull().default("pending"),   // "pending", "completed", "failed"
  errorMessage: text("error_message"),
  ...timestamps,
});

/**
 * Conversation links table — explicit relationships between conversations.
 * Created by ;link commands or implicitly by ;select cross-references.
 */
export const conversationLinks = pgTable("conversation_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceConversationId: uuid("source_conversation_id")
    .notNull()
    .references(() => chatConversations.id, { onDelete: "cascade" }),
  targetConversationId: uuid("target_conversation_id")
    .notNull()
    .references(() => chatConversations.id, { onDelete: "cascade" }),
  linkType: text("link_type").notNull().default("reference"), // "reference", "summary", "keypoints", "continuation", "manual"
  label: text("label"),                                       // Optional user label
  commandExecutionId: uuid("command_execution_id")
    .references(() => commandExecutions.id, { onDelete: "set null" }),
  metadata: text("metadata"),                                 // JSON: additional context
  ...timestamps,
});

/**
 * Injected contexts table — stores injected content blocks within messages.
 * When a user sends a message with ;select or ;inject, the resolved content is stored here.
 */
export const injectedContexts = pgTable("injected_contexts", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => chatMessages.id, { onDelete: "cascade" }),
  sourceConversationId: uuid("source_conversation_id")
    .references(() => chatConversations.id, { onDelete: "set null" }),
  sourceMessageIds: text("source_message_ids"),         // JSON: array of message UUIDs
  commandName: text("command_name").notNull(),           // Which command produced this
  resolvedContent: text("resolved_content").notNull(),   // The actual text that was injected
  summary: text("summary"),                              // Optional summary of injected content
  tokenCount: integer("token_count"),                    // Estimated token count
  ...timestamps,
});
```

### Drizzle Migration

After adding tables, run:
```bash
bun run db:generate
bun run db:migrate
```

### Neo4j Schema

Neo4j stores the graph visualization data. It mirrors the relational data but is optimized for graph traversal.

**Node types:**
```cypher
(:Conversation {id: UUID, title: String, messageCount: Int, createdAt: DateTime, updatedAt: DateTime})
(:Message {id: UUID, role: String, contentPreview: String, conversationId: UUID})
(:Command {id: UUID, name: String, input: String, status: String})
```

**Edge types:**
```cypher
(:Conversation)-[:LINKS_TO {type: String, label: String, createdAt: DateTime}]->(:Conversation)
(:Conversation)-[:HAS_MESSAGE]->(:Message)
(:Message)-[:REFERENCES {commandName: String}]->(:Conversation)
(:Command)-[:EXECUTED_IN]->(:Conversation)
(:Command)-[:REFERENCES]->(:Conversation)
```

### Neo4j Client Setup

New file: `src/core/neo4j/client.ts`

```typescript
import neo4j from "neo4j-driver";
import { env } from "@/core/config/env";

const driver = neo4j.driver(
  env.NEO4J_URI,
  neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD),
);

export { driver };

export async function getSession() {
  return driver.session();
}

export async function closeDriver() {
  await driver.close();
}
```

### Environment Variables (append to env.ts)

```typescript
// Neo4j config
NEO4J_URI: getOptionalEnv("NEO4J_URI", "bolt://localhost:7687"),
NEO4J_USER: getOptionalEnv("NEO4J_USER", "neo4j"),
NEO4J_PASSWORD: getOptionalEnv("NEO4J_PASSWORD", "password"),
```

---

## Command System Specification

### Command Syntax

```
;command-name [arguments] [flags]
```

**Inline usage** (within a message):
```
Here is my analysis based on ;select @conversation-title --role user --last 5:

I think the key insight is...
```

**Standalone usage** (entire message is a command):
```
;summarize @conversation-title --format bullet
```

### Command Registry

| Command | Syntax | Description | Creates Edge? |
|---------|--------|-------------|---------------|
| `;select` | `;select @<conv> [--role user\|assistant] [--last N] [--range N:M]` | Select messages from a conversation | YES (reference) |
| `;summarize` | `;summarize @<conv> [--format prose\|bullet\|oneline]` | Summarize a conversation via LLM | YES (summary) |
| `;keypoints` | `;keypoints @<conv> [--max N]` | Extract key points via LLM | YES (keypoints) |
| `;inject` | `;inject @<conv> [--as context\|quote\|code]` | Inject full conversation as context block | YES (reference) |
| `;link` | `;link @<conv> [--label "description"]` | Create manual link between conversations | YES (manual) |
| `;search` | `;search "query" [--limit N]` | Search across all conversations | NO |
| `;diff` | `;diff @<conv1> @<conv2>` | Compare two conversations | YES (reference) |
| `;ask` | `;ask @<conv> "question"` | Ask a question about another conversation | YES (reference) |

### Conversation Reference Syntax

The `@` prefix references conversations:

| Syntax | Resolves To |
|--------|-------------|
| `@this` | Current conversation |
| `@this:user` | User messages from current conversation |
| `@this:assistant` | Assistant messages from current conversation |
| `@<title>` | Conversation matched by title (fuzzy) |
| `@<uuid>` | Conversation matched by exact ID |
| `@last` | Most recently updated conversation (not current) |
| `@all` | All conversations (for search) |

### Command Parser Specification

The parser (`src/features/commands/parser.ts`) must handle:

1. **Detection**: Find `;command` tokens in a string
2. **Extraction**: Parse command name, arguments, flags
3. **Validation**: Ensure command exists, arguments are valid
4. **Resolution**: Resolve `@references` to actual conversation IDs

**Parser output type:**

```typescript
interface ParsedCommand {
  raw: string;                          // Original command string
  name: string;                         // "select", "summarize", etc.
  references: ConversationReference[];  // Resolved @references
  flags: Record<string, string | boolean>;
  position: { start: number; end: number }; // Position in original text
}

interface ConversationReference {
  raw: string;           // "@conversation-title"
  type: "title" | "id" | "keyword"; // "this", "last", "all" are keywords
  value: string;         // The title, ID, or keyword
  filter?: {
    role?: "user" | "assistant";
    last?: number;
    range?: [number, number];
  };
}
```

**Parser rules:**
- Commands start with `;` followed by a letter (not whitespace)
- `@` references are parsed within commands
- Flags use `--flag value` or `--flag` (boolean) syntax
- Quoted strings: `"multi word title"` or `'single quotes'`
- Commands end at the next `;command`, newline after standalone, or end of input
- A message can contain multiple commands
- Text outside commands is treated as regular message content

---

## API Contract

### New Endpoints

| Method | Endpoint | Request Body | Response |
|--------|----------|-------------|----------|
| POST | `/api/commands/execute` | `ExecuteCommandRequest` | `CommandExecutionResponse` (200) |
| POST | `/api/commands/preview` | `PreviewCommandRequest` | `CommandPreviewResponse` (200) |
| GET | `/api/commands/suggestions?q=<partial>` | — | `CommandSuggestion[]` (200) |
| GET | `/api/conversations/search?q=<query>&limit=<n>` | — | `ConversationSearchResult[]` (200) |
| GET | `/api/graph` | — | `GraphData` (200) |
| GET | `/api/graph/nodes?conversationId=<id>` | — | `GraphNode[]` (200) |
| POST | `/api/graph/edges` | `CreateEdgeRequest` | `GraphEdge` (201) |

### Modified Endpoints

**POST `/api/chat/send`** — Extended to process commands.

New request body:
```json
{
  "content": "string (may contain ;commands)",
  "conversationId": "uuid | undefined",
  "commands": [
    {
      "raw": ";select @other-chat --last 5",
      "name": "select",
      "references": [{"type": "title", "value": "other-chat", "filter": {"last": 5}}],
      "flags": {"last": "5"},
      "position": {"start": 24, "end": 58}
    }
  ]
}
```

The `commands` array is **optional**. If absent, behaves exactly as before (backward compatible). If present, the backend:
1. Resolves each command
2. Builds injected context
3. Constructs the augmented prompt
4. Sends to LLM with injected context
5. Stores command executions
6. Creates graph edges
7. Streams response as before

New SSE event types (in addition to existing `content`, `done`, `error`):
```typescript
type StreamEvent =
  | { type: "content"; content: string }                    // Existing
  | { type: "done"; saved: boolean }                        // Existing
  | { type: "error"; message: string }                      // Existing
  | { type: "command_start"; commandName: string; raw: string }  // NEW
  | { type: "command_result"; commandName: string; preview: string; tokenCount: number } // NEW
  | { type: "command_error"; commandName: string; error: string }  // NEW
  | { type: "context_injected"; totalTokens: number; sourceCount: number }  // NEW
```

### Response Shapes

**ExecuteCommandRequest:**
```json
{
  "command": ";select @other-chat --last 5",
  "conversationId": "uuid"
}
```

**CommandExecutionResponse:**
```json
{
  "id": "uuid",
  "commandName": "select",
  "status": "completed",
  "resultContent": "Message 1\nMessage 2\n...",
  "sourceConversationIds": ["uuid1"],
  "tokenCount": 150,
  "createdAt": "ISO8601"
}
```

**PreviewCommandRequest:**
```json
{
  "command": ";select @other-chat --last 5",
  "conversationId": "uuid"
}
```

**CommandPreviewResponse:**
```json
{
  "commandName": "select",
  "preview": "5 messages from 'other-chat' (est. 150 tokens)",
  "resolvedContent": "User: Hello\nAssistant: Hi there...",
  "tokenCount": 150,
  "sourceConversations": [{"id": "uuid", "title": "other-chat"}]
}
```

**CommandSuggestion:**
```json
{
  "name": "select",
  "description": "Select messages from a conversation",
  "syntax": ";select @<conversation> [--role user|assistant] [--last N]",
  "examples": [";select @this:user", ";select @my-chat --last 10"]
}
```

**ConversationSearchResult:**
```json
{
  "id": "uuid",
  "title": "string",
  "messageCount": 42,
  "lastMessage": "Preview of last message...",
  "updatedAt": "ISO8601",
  "relevanceScore": 0.85
}
```

**GraphData:**
```json
{
  "nodes": [
    {
      "id": "uuid",
      "type": "conversation",
      "title": "string",
      "messageCount": 42,
      "x": 100,
      "y": 200
    }
  ],
  "edges": [
    {
      "id": "uuid",
      "source": "uuid",
      "target": "uuid",
      "type": "reference",
      "label": "string|null",
      "commandName": "select",
      "createdAt": "ISO8601"
    }
  ]
}
```

**CreateEdgeRequest:**
```json
{
  "sourceConversationId": "uuid",
  "targetConversationId": "uuid",
  "type": "manual",
  "label": "Related to authentication discussion"
}
```

---

## Frontend Components Specification

### ChatLayout (MODIFIED)

The layout changes from a two-panel (sidebar + chat) to a three-panel layout with a resizable graph panel.

```
┌──────────┬────────────────────────────┬──────────────┐
│          │                            │              │
│ Sidebar  │     Chat Messages          │   Graph      │
│ (w-72)   │     (flex-1)               │   Panel      │
│          │                            │  (w-80,      │
│          │                            │   resizable) │
│          │                            │              │
│          ├────────────────────────────┤              │
│          │ Markdown Editor Input      │              │
│          │ (min-h-[120px], max-h-60%) │              │
│          │ with Command Popover       │              │
└──────────┴────────────────────────────┴──────────────┘
```

**Layout specifications:**
- Sidebar: `w-72` (unchanged, hidden on mobile)
- Chat area: `flex-1 min-w-0`
- Graph panel: `w-80` default, resizable from `w-60` to `w-[400px]`, collapsible
- Graph panel position: right side, `border-l border-border/50`
- Resize handle: `w-1 hover:w-1.5 bg-border hover:bg-primary/50 cursor-col-resize`
- Mobile: graph panel hidden, accessible via tab/button in header

**New header elements:**
- Graph toggle button (right side, before theme toggle): `aria-label="Toggle graph panel"`
- Command palette trigger: keyboard shortcut `Cmd+;` or `Ctrl+;`

### ChatInput (REWRITTEN — Now MarkdownEditor)

Replace the entire `chat-input.tsx` with a CodeMirror 6-based Markdown editor.

**Layout:**
- Container: `border-t border-border/50 bg-background/80 backdrop-blur-sm p-4`
- Editor wrapper: `mx-auto max-w-3xl rounded-xl bg-muted/50 border border-border/30`
- Editor area: `min-h-[120px] max-h-[40vh] overflow-y-auto`
- Bottom bar inside editor: `flex items-center justify-between px-3 py-2 border-t border-border/20`
  - Left side: command hint text `text-xs text-muted-foreground/50` — "Type ; for commands"
  - Right side: Send button + character count
- No more "Enter to send" hint below — the editor has its own controls

**CodeMirror configuration:**
- Language: Markdown (with GFM extensions)
- Theme: matches app dark/light mode (`@codemirror/theme-one-dark` for dark, default for light)
- Extensions:
  - Markdown language support
  - Syntax highlighting
  - Line wrapping (`EditorView.lineWrapping`)
  - Placeholder: "Type a message... (use ; for commands)"
  - Custom keymap: `Cmd+Enter` or `Ctrl+Enter` to send (NOT plain Enter)
  - `;` key handler: triggers command popover
  - `@` key handler within commands: triggers conversation picker
  - Tab completion for command names

**Send behavior:**
- `Cmd+Enter` or `Ctrl+Enter`: Send message
- `Enter`: Regular newline (this is a Markdown editor, not a chat input)
- Send button: always visible in bottom bar, disabled when empty or streaming

**Accessibility:**
- `aria-label="Message editor"`
- `role="textbox"`
- `aria-multiline="true"`
- `aria-placeholder="Type a message... (use ; for commands)"`

### CommandPopover

A floating popover that appears when the user types `;` in the editor.

**Trigger:** Typing `;` at the start of a line or after a space.

**Position:** Directly above the cursor position in the editor, anchored to the `;` character.

**Layout:**
- Container: `w-72 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg`
- Padding: `p-1`
- Each item: `flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent`
  - Icon: `size-4 text-muted-foreground`
  - Name: `text-sm font-medium` (e.g., "select")
  - Description: `text-xs text-muted-foreground truncate`
- Active item: `bg-accent`
- Category headers: `px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider`

**Behavior:**
- Appears when `;` is typed (after debounce of 50ms)
- Filters as user continues typing (e.g., `;sel` shows only "select")
- Arrow keys navigate, Enter selects
- Escape dismisses
- Clicking outside dismisses
- Selecting a command inserts it and positions cursor for arguments
- Shows at most 8 items at a time (scrollable)

**Categories in popover:**
1. **Context** — ;select, ;inject
2. **Analysis** — ;summarize, ;keypoints, ;ask
3. **Navigation** — ;search, ;diff, ;link

**Each command item shows:**
```
  📋 select
  Select messages from a conversation
```

### ConversationPicker

A dialog that appears when the user types `@` within a command in the editor.

**Trigger:** Typing `@` within a `;command` context.

**Layout:**
- Container: `w-80 max-h-80 rounded-lg border border-border bg-popover shadow-lg`
- Search input at top: `px-3 py-2 border-b border-border/50`
  - `placeholder="Search conversations..."`
  - `aria-label="Search conversations"`
- Results list: `overflow-y-auto max-h-60`
- Each result: `flex items-center justify-between px-3 py-2 hover:bg-accent cursor-pointer`
  - Left: conversation title (truncated, `max-w-48`)
  - Right: message count badge `text-xs text-muted-foreground`
- Special entries at top (always visible):
  - `@this` — "Current conversation"
  - `@this:user` — "User messages (current)"
  - `@this:assistant` — "Assistant messages (current)"
  - `@last` — "Most recent conversation"
- Separator after special entries: `border-t border-border/30 my-1`
- Regular conversations below, sorted by `updatedAt` descending

**Behavior:**
- Search filters by title (debounced 150ms)
- Arrow keys navigate, Enter selects
- Selected conversation inserts `@title` (or `@this`, `@last`, etc.)
- If title contains spaces, wraps in quotes: `@"my conversation title"`

### InjectedContextBadge

An inline badge rendered within messages that had injected context.

**Layout:**
- Inline element: `inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium`
- Icon: `size-3` (e.g., `ArrowDownRight` from lucide)
- Text: "from: [conversation title]" (truncated at 20 chars)
- Clickable: clicking opens the source conversation in sidebar

### InjectedContextPreview

An expandable block shown above the message content when a message includes injected context.

**Layout (collapsed):**
- Container: `flex items-center gap-2 px-3 py-1.5 mb-2 rounded-md bg-muted/50 border border-border/30 cursor-pointer`
- Icon: `ChevronRight size-4 text-muted-foreground` (rotates to `ChevronDown` when expanded)
- Text: `text-xs text-muted-foreground` — "Context from 2 conversations (est. 450 tokens)"
- Expand/collapse: `transition-all duration-200`

**Layout (expanded):**
- Full container: `px-3 py-2 mb-2 rounded-md bg-muted/30 border border-border/30`
- Each source block:
  - Header: `flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1`
    - Source icon + "from @conversation-title"
  - Content: `text-xs text-muted-foreground/80 max-h-32 overflow-y-auto whitespace-pre-wrap`
  - Separator between blocks: `border-t border-border/20 my-2`

### GraphPanel

A resizable panel on the right showing the Neo4j conversation graph.

**Layout:**
- Container: `h-full flex flex-col border-l border-border/50 bg-background`
- Header: `flex items-center justify-between px-3 py-2 border-b border-border/50`
  - Title: `text-sm font-semibold` — "Knowledge Graph"
  - Controls: zoom in/out/fit buttons, `size-7` each
  - Close button: `size-7` with `X` icon, `aria-label="Close graph panel"`
- Graph area: `flex-1 relative` (canvas fills this)
- Empty state: centered text "Send messages with ;commands to see relationships appear"

**Graph rendering:**
- Use `react-force-graph-2d` or `@neo4j-nvl/react`
- Nodes: circles with conversation title labels
  - Current conversation: `fill: hsl(var(--primary))`, larger radius (8px)
  - Other conversations: `fill: hsl(var(--muted-foreground))`, radius 6px
  - Hover: radius increases by 2px, shows tooltip
- Edges: lines connecting conversations
  - Reference: `stroke: hsl(var(--border))`, solid
  - Summary: `stroke: hsl(var(--primary)/0.5)`, dashed
  - Manual: `stroke: hsl(var(--primary))`, solid, thicker
  - Label on hover (edge type)
- Click node: navigates to that conversation (calls `selectConversation`)
- Zoom: scroll wheel, pinch
- Pan: drag background

**Graph controls:**
- Zoom in: `+` button
- Zoom out: `-` button
- Fit all: `Maximize2` icon button
- Refresh: `RefreshCw` icon button
- All buttons: `size-7 variant="ghost"` with `aria-label`

**Graph tooltip (on hover):**
- Container: `absolute z-50 rounded-md bg-popover border border-border shadow-md px-3 py-2`
- Title: `text-sm font-medium`
- Stats: `text-xs text-muted-foreground` — "42 messages · 3 links"
- Position: offset from cursor, stays within viewport

---

## Hooks Specification

### useCommands Hook

```typescript
interface UseCommandsReturn {
  suggestions: CommandSuggestion[];
  isLoadingSuggestions: boolean;
  parseCommands: (text: string) => ParsedCommand[];
  previewCommand: (command: string, conversationId: string | null) => Promise<CommandPreview>;
  executeCommand: (command: string, conversationId: string) => Promise<CommandResult>;
  conversationSearch: (query: string) => Promise<ConversationSearchResult[]>;
}
```

### useGraph Hook

```typescript
interface UseGraphReturn {
  graphData: GraphData | null;
  isLoading: boolean;
  isGraphOpen: boolean;
  toggleGraph: () => void;
  refreshGraph: () => void;
  highlightNode: (conversationId: string | null) => void;
  highlightedNodeId: string | null;
}
```

### useCodeMirror Hook

```typescript
interface UseCodeMirrorReturn {
  editorRef: RefObject<HTMLDivElement>;
  view: EditorView | null;
  getValue: () => string;
  setValue: (text: string) => void;
  focus: () => void;
  insertAtCursor: (text: string) => void;
  getCursorPosition: () => { line: number; col: number };
}
```

### useChat Modifications

Add to the existing `useChat` return:
```typescript
{
  // ... existing fields
  processedCommands: ParsedCommand[];      // Commands in current input
  injectedContexts: InjectedContext[];     // Contexts injected in current message
  sendMessageWithCommands: (content: string, commands: ParsedCommand[]) => Promise<void>;
}
```

---

## Cross-Cutting Concerns

| Concern | Owner | Coordinates With | Detail |
|---------|-------|-----------------|--------|
| Command parsing consistency | Backend | Frontend | Parser runs on BOTH sides — frontend for preview/popover, backend for execution. Must produce identical results. Share parser via `src/lib/command-utils.ts`. |
| `@reference` resolution | Backend | Frontend | Frontend does fuzzy title matching for the picker. Backend does exact resolution. Backend is authoritative. |
| Graph sync | Backend | Frontend | Backend writes to Neo4j on every command execution. Frontend polls graph endpoint. No WebSocket — poll every 5s when graph panel is open. |
| Token counting | Backend | Frontend | Backend provides `tokenCount` in command results. Frontend displays it. Use simple estimation: `Math.ceil(text.length / 4)` for MVP. |
| Backward compatibility | Backend | Frontend | Messages without commands work exactly as before. The `commands` field in the send request is optional. |
| Editor keyboard shortcuts | Frontend | — | `Cmd+Enter` sends. `Enter` is newline. `;` opens popover. `@` opens picker (within command). `Escape` closes popovers. |
| SSE event types | Backend | Frontend | New event types (`command_start`, `command_result`, `command_error`, `context_injected`) are added to the stream. Frontend must handle them gracefully — unknown types are ignored. |
| Graph panel responsive | Frontend | — | Desktop: always available (collapsible). Mobile: hidden, accessible via header button that opens a sheet/drawer. |
| Dark mode | Frontend | — | All new components must support dark mode via Tailwind's dark: prefix and CSS variables. CodeMirror theme switches with app theme. |

---

## Dependencies to Install

### npm packages (Frontend)

```bash
bun add codemirror @codemirror/view @codemirror/state @codemirror/lang-markdown @codemirror/language @codemirror/commands @codemirror/theme-one-dark @codemirror/autocomplete react-force-graph-2d
```

### npm packages (Backend / Full-stack)

```bash
bun add neo4j-driver
```

### shadcn/ui components to add

```bash
bunx shadcn@canary add popover resizable tooltip
```

---

## Validation Gates

Every gate must pass before the feature is considered complete. Gates are organized by domain and numbered for tracking.

### Database Validation (DB-001 through DB-050)

**Schema Creation:**
- DB-001: `bun run db:generate` succeeds without errors
- DB-002: `bun run db:migrate` succeeds without errors
- DB-003: `command_executions` table exists in Supabase
- DB-004: `conversation_links` table exists in Supabase
- DB-005: `injected_contexts` table exists in Supabase
- DB-006: All foreign keys reference correct tables
- DB-007: `ON DELETE CASCADE` works for `command_executions` when conversation deleted
- DB-008: `ON DELETE CASCADE` works for `conversation_links` (source) when conversation deleted
- DB-009: `ON DELETE CASCADE` works for `conversation_links` (target) when conversation deleted
- DB-010: `ON DELETE CASCADE` works for `injected_contexts` when message deleted
- DB-011: `ON DELETE SET NULL` works for `conversation_links.commandExecutionId`
- DB-012: `ON DELETE SET NULL` works for `injected_contexts.sourceConversationId`
- DB-013: Default values apply correctly (status = "pending", timestamps = now)
- DB-014: Existing `chat_conversations` table is unchanged
- DB-015: Existing `chat_messages` table is unchanged
- DB-016: Existing `users` table is unchanged
- DB-017: Existing `projects` table is unchanged

**CRUD Operations — command_executions:**
- DB-018: Can insert a command execution with all fields
- DB-019: Can insert with null optional fields (resultContent, errorMessage)
- DB-020: Can query command executions by conversation ID
- DB-021: Can update status from "pending" to "completed"
- DB-022: Can update status from "pending" to "failed"
- DB-023: Can delete a command execution
- DB-024: Deleting a conversation cascades to its command executions

**CRUD Operations — conversation_links:**
- DB-025: Can insert a link between two conversations
- DB-026: Can insert with all link types: "reference", "summary", "keypoints", "continuation", "manual"
- DB-027: Can query links by source conversation ID
- DB-028: Can query links by target conversation ID
- DB-029: Can query bidirectional links (source OR target matches)
- DB-030: Can delete a specific link
- DB-031: Deleting source conversation cascades to its outgoing links
- DB-032: Deleting target conversation cascades to its incoming links

**CRUD Operations — injected_contexts:**
- DB-033: Can insert an injected context for a message
- DB-034: Can insert with null optional fields (summary, tokenCount, sourceConversationId)
- DB-035: Can query injected contexts by message ID
- DB-036: Can query injected contexts by source conversation ID
- DB-037: Deleting a message cascades to its injected contexts

**Neo4j:**
- DB-038: Neo4j driver connects successfully
- DB-039: Can create a Conversation node
- DB-040: Can create a LINKS_TO edge between two Conversation nodes
- DB-041: Can query all nodes
- DB-042: Can query all edges
- DB-043: Can query neighbors of a specific node
- DB-044: Can delete a node (and its edges)
- DB-045: Can update node properties (messageCount, title)
- DB-046: Node IDs match PostgreSQL conversation UUIDs
- DB-047: Edge types match link types from PostgreSQL
- DB-048: Can perform a 2-hop traversal (conversation → linked → linked)
- DB-049: Graph is empty when no links exist
- DB-050: Duplicate edges are prevented (unique constraint on source+target+type)

### Environment & Config Validation (ENV-001 through ENV-010)

- ENV-001: `NEO4J_URI` defaults to `bolt://localhost:7687` when not set
- ENV-002: `NEO4J_USER` defaults to `neo4j` when not set
- ENV-003: `NEO4J_PASSWORD` defaults to `password` when not set
- ENV-004: Neo4j client initializes without error in dev
- ENV-005: `env.ts` still exports all existing vars unchanged
- ENV-006: No TypeScript errors after env.ts modification
- ENV-007: `bun run lint` passes after env.ts modification
- ENV-008: Neo4j client gracefully handles connection failure (logs error, doesn't crash app)
- ENV-009: App starts successfully without Neo4j (graph features degrade gracefully)
- ENV-010: App starts successfully with Neo4j running

### Command Parser Validation (CMD-001 through CMD-060)

**Basic parsing:**
- CMD-001: Empty string returns no commands
- CMD-002: Plain text (no `;`) returns no commands
- CMD-003: `;select` at start of string is detected
- CMD-004: `;select` after space in middle of string is detected
- CMD-005: `;select @this` parses reference correctly
- CMD-006: `;select @this:user` parses role filter correctly
- CMD-007: `;select @this:assistant` parses role filter correctly
- CMD-008: `;select @"my conversation"` parses quoted title
- CMD-009: `;select @my-chat --last 5` parses flag correctly
- CMD-010: `;select @my-chat --range 1:10` parses range flag
- CMD-011: `;select @my-chat --role user --last 3` parses multiple flags
- CMD-012: `;summarize @this` parses correctly
- CMD-013: `;summarize @this --format bullet` parses format flag
- CMD-014: `;summarize @this --format prose` parses format flag
- CMD-015: `;summarize @this --format oneline` parses format flag
- CMD-016: `;keypoints @this` parses correctly
- CMD-017: `;keypoints @this --max 5` parses max flag
- CMD-018: `;inject @other-chat` parses correctly
- CMD-019: `;inject @other-chat --as context` parses inject mode
- CMD-020: `;inject @other-chat --as quote` parses inject mode
- CMD-021: `;inject @other-chat --as code` parses inject mode
- CMD-022: `;link @other-chat` parses correctly
- CMD-023: `;link @other-chat --label "see also"` parses label flag
- CMD-024: `;search "keyword"` parses search query
- CMD-025: `;search "keyword" --limit 10` parses limit flag
- CMD-026: `;diff @chat1 @chat2` parses two references
- CMD-027: `;ask @other-chat "what happened?"` parses question
- CMD-028: Unknown command `;foobar` returns parse error
- CMD-029: `;` alone (no command name) is not treated as a command

**Multiple commands:**
- CMD-030: Two commands in one message are both parsed
- CMD-031: Three commands in one message are all parsed
- CMD-032: Commands with text between them preserve text positions
- CMD-033: Command positions (start/end) are correct for first command
- CMD-034: Command positions are correct for second command
- CMD-035: Mixed text and commands: text portions identified correctly

**Reference resolution:**
- CMD-036: `@this` resolves to current conversation ID
- CMD-037: `@last` resolves to most recently updated conversation (not current)
- CMD-038: `@all` is marked as special keyword (for search)
- CMD-039: `@<exact-uuid>` resolves to the UUID directly
- CMD-040: `@<title>` fuzzy matches conversation by title
- CMD-041: `@<title>` returns closest match when multiple similar titles exist
- CMD-042: `@<non-existent>` returns resolution error
- CMD-043: `@this` returns error when no active conversation

**Edge cases:**
- CMD-044: Semicolon in regular text (e.g., `hello; world`) is NOT parsed as command
- CMD-045: Semicolon in code block is NOT parsed as command
- CMD-046: Semicolon in URL is NOT parsed as command
- CMD-047: `@` in email addresses is NOT parsed as reference
- CMD-048: Escaped semicolon `\;` is NOT parsed as command
- CMD-049: Nested quotes in flag values are handled
- CMD-050: Very long command strings don't crash parser
- CMD-051: Unicode characters in titles are handled
- CMD-052: Empty flags (e.g., `--last` without value) handled gracefully
- CMD-053: Duplicate flags use the last value

**Parser output format:**
- CMD-054: Output includes `raw` field matching input
- CMD-055: Output includes `name` field (lowercase)
- CMD-056: Output includes `references` array
- CMD-057: Output includes `flags` object
- CMD-058: Output includes `position` with correct start/end
- CMD-059: Position start is the index of `;`
- CMD-060: Position end is the index after the last character of the command

### Command Execution Validation (EXEC-001 through EXEC-050)

**;select:**
- EXEC-001: `;select @this` returns all messages from current conversation
- EXEC-002: `;select @this:user` returns only user messages
- EXEC-003: `;select @this:assistant` returns only assistant messages
- EXEC-004: `;select @other --last 5` returns last 5 messages
- EXEC-005: `;select @other --last 5 --role user` returns last 5 user messages
- EXEC-006: `;select @other --range 1:3` returns messages 1-3
- EXEC-007: Result content is newline-separated messages with role prefix
- EXEC-008: Creates a command_execution record in DB
- EXEC-009: Creates a conversation_link with type "reference"
- EXEC-010: Creates a Neo4j edge

**;summarize:**
- EXEC-011: `;summarize @this` produces a summary via LLM
- EXEC-012: `;summarize @this --format bullet` produces bullet list
- EXEC-013: `;summarize @this --format oneline` produces single sentence
- EXEC-014: Summary is stored in command_execution.resultContent
- EXEC-015: Creates conversation_link with type "summary"
- EXEC-016: Creates Neo4j edge with type "summary"
- EXEC-017: Handles empty conversation gracefully (no messages to summarize)

**;keypoints:**
- EXEC-018: `;keypoints @this` produces key points list
- EXEC-019: `;keypoints @this --max 3` limits to 3 points
- EXEC-020: Key points are stored in command_execution.resultContent
- EXEC-021: Creates conversation_link with type "keypoints"

**;inject:**
- EXEC-022: `;inject @other` injects full conversation content
- EXEC-023: `;inject @other --as context` wraps in context block
- EXEC-024: `;inject @other --as quote` wraps in blockquote
- EXEC-025: Creates injected_context record in DB
- EXEC-026: injected_context.tokenCount is populated

**;link:**
- EXEC-027: `;link @other` creates manual link
- EXEC-028: `;link @other --label "see also"` creates labeled link
- EXEC-029: Link appears in graph immediately after creation
- EXEC-030: Duplicate link (same source+target+type) is prevented

**;search:**
- EXEC-031: `;search "hello"` returns conversations containing "hello"
- EXEC-032: Search is case-insensitive
- EXEC-033: `;search "hello" --limit 3` returns at most 3 results
- EXEC-034: Results include conversation title, message count, relevance score
- EXEC-035: Search does NOT create a graph edge

**;diff:**
- EXEC-036: `;diff @chat1 @chat2` produces a comparison
- EXEC-037: Comparison is generated via LLM
- EXEC-038: Creates reference edges to both conversations

**;ask:**
- EXEC-039: `;ask @other "what was discussed?"` sends question to LLM with other's context
- EXEC-040: Response is based on the referenced conversation's content
- EXEC-041: Creates reference edge

**Error handling:**
- EXEC-042: Non-existent conversation reference returns error
- EXEC-043: Empty conversation (no messages) handled gracefully
- EXEC-044: LLM failure (OpenRouter error) returns command_error SSE event
- EXEC-045: Network timeout handled gracefully
- EXEC-046: Command execution status set to "failed" on error
- EXEC-047: Error message stored in command_execution.errorMessage
- EXEC-048: Failed command does NOT create graph edge
- EXEC-049: Partial failure (1 of 2 commands fails) — successful one still executes
- EXEC-050: Command execution logged with structured logging pattern

### API Endpoint Validation (API-001 through API-040)

**POST /api/commands/execute:**
- API-001: Returns 200 with CommandExecutionResponse on success
- API-002: Returns 400 on invalid command syntax
- API-003: Returns 404 when referenced conversation doesn't exist
- API-004: Returns 500 on internal error
- API-005: Response includes tokenCount
- API-006: Response includes sourceConversationIds

**POST /api/commands/preview:**
- API-007: Returns 200 with preview on success
- API-008: Preview includes estimated token count
- API-009: Preview includes resolved content (truncated at 500 chars)
- API-010: Returns 400 on invalid command syntax
- API-011: Preview does NOT execute the command (no DB writes)
- API-012: Preview does NOT create graph edges

**GET /api/commands/suggestions:**
- API-013: Returns all commands when `q` is empty
- API-014: Filters commands by prefix when `q` provided
- API-015: Returns command name, description, syntax, examples
- API-016: Response is sorted alphabetically

**GET /api/conversations/search:**
- API-017: Returns matching conversations
- API-018: Query parameter `q` is required
- API-019: Query parameter `limit` defaults to 10
- API-020: Returns 400 when `q` is missing
- API-021: Results include title, messageCount, lastMessage preview
- API-022: Search matches against message content
- API-023: Search matches against conversation title

**POST /api/chat/send (modified):**
- API-024: Existing behavior (no commands) works identically
- API-025: With `commands` array, commands are processed before LLM call
- API-026: `command_start` SSE event emitted for each command
- API-027: `command_result` SSE event emitted after each command completes
- API-028: `command_error` SSE event emitted on command failure
- API-029: `context_injected` SSE event emitted with total token count
- API-030: Injected context is prepended to the prompt
- API-031: LLM receives augmented prompt with context
- API-032: Response streaming works identically after context injection
- API-033: `X-Conversation-Id` header still returned for new conversations

**GET /api/graph:**
- API-034: Returns nodes and edges arrays
- API-035: Nodes include id, type, title, messageCount
- API-036: Edges include id, source, target, type, label
- API-037: Returns empty arrays when no data exists
- API-038: Handles Neo4j connection failure gracefully (returns empty graph, not 500)

**POST /api/graph/edges:**
- API-039: Creates edge and returns 201
- API-040: Returns 400 on invalid request body

### Frontend Component Validation (UI-001 through UI-100)

**MarkdownEditor (replaces ChatInput):**
- UI-001: CodeMirror editor renders in the chat input area
- UI-002: Editor has minimum height of 120px
- UI-003: Editor has maximum height of 40vh
- UI-004: Editor scrolls when content exceeds max height
- UI-005: Placeholder text "Type a message... (use ; for commands)" is visible when empty
- UI-006: Send button is visible in bottom bar
- UI-007: Send button is disabled when editor is empty
- UI-008: Send button is disabled during streaming
- UI-009: `Cmd+Enter` sends the message (macOS)
- UI-010: `Ctrl+Enter` sends the message (Windows/Linux)
- UI-011: Regular `Enter` creates a newline (does NOT send)
- UI-012: Editor clears after message is sent
- UI-013: Editor regains focus after message is sent
- UI-014: Markdown syntax is highlighted in the editor
- UI-015: Code blocks in the editor have syntax highlighting
- UI-016: Editor supports dark mode
- UI-017: Editor switches theme when app theme changes
- UI-018: "Type ; for commands" hint visible in bottom bar
- UI-019: Character count shown in bottom bar
- UI-020: `aria-label="Message editor"` is present
- UI-021: Editor wrapper has `rounded-xl` border radius
- UI-022: Editor wrapper has `bg-muted/50` background
- UI-023: Bottom bar has `border-t border-border/20` separator
- UI-024: Old "Enter to send · Shift+Enter for new line" hint is REMOVED
- UI-025: Old textarea-based ChatInput no longer renders

**CommandPopover:**
- UI-026: Popover appears when `;` is typed at start of line
- UI-027: Popover appears when `;` is typed after a space
- UI-028: Popover does NOT appear when `;` is inside a word (e.g., `http://foo;bar`)
- UI-029: Popover filters as user types (`;sel` filters to "select")
- UI-030: Popover shows at most 8 items
- UI-031: Arrow Down moves selection down
- UI-032: Arrow Up moves selection up
- UI-033: Enter selects the active command
- UI-034: Escape closes the popover
- UI-035: Clicking outside closes the popover
- UI-036: Selected command is inserted into the editor
- UI-037: Cursor is positioned after the command name for arguments
- UI-038: Popover width is `w-72`
- UI-039: Popover max height is `max-h-64`
- UI-040: Each item shows icon, name, and description
- UI-041: Active item has `bg-accent` background
- UI-042: Category headers are visible (Context, Analysis, Navigation)
- UI-043: Popover has `shadow-lg` and `border border-border`
- UI-044: Popover is positioned above cursor (not below)

**ConversationPicker:**
- UI-045: Picker appears when `@` is typed within a command context
- UI-046: Picker does NOT appear when `@` is typed in regular text
- UI-047: Search input is focused on open
- UI-048: `@this` is always listed first
- UI-049: `@this:user` is listed second
- UI-050: `@this:assistant` is listed third
- UI-051: `@last` is listed fourth
- UI-052: Separator exists between special entries and conversation list
- UI-053: Conversations are sorted by `updatedAt` descending
- UI-054: Selecting a conversation inserts `@title` into editor
- UI-055: Titles with spaces are wrapped in quotes: `@"title with spaces"`
- UI-056: Search filters conversations by title (debounced 150ms)
- UI-057: Arrow keys navigate the list
- UI-058: Enter selects highlighted conversation
- UI-059: Escape closes the picker
- UI-060: Picker width is `w-80`
- UI-061: Picker max height is `max-h-80`
- UI-062: `aria-label="Search conversations"` on search input

**InjectedContextPreview:**
- UI-063: Collapsed state shows summary text
- UI-064: Collapsed state shows token count
- UI-065: Collapsed state shows source count ("from 2 conversations")
- UI-066: Clicking expands the preview
- UI-067: Expanded state shows each source block
- UI-068: Each source block shows conversation title
- UI-069: Each source block shows content (truncated at 500 chars)
- UI-070: Collapse/expand has smooth transition (200ms)
- UI-071: Chevron icon rotates on expand/collapse
- UI-072: Container has `bg-muted/50 border border-border/30 rounded-md`
- UI-073: Preview renders above the message content (not below)

**GraphPanel:**
- UI-074: Graph panel renders on the right side
- UI-075: Graph panel default width is `w-80`
- UI-076: Graph panel is resizable (drag left edge)
- UI-077: Graph panel minimum width is `w-60`
- UI-078: Graph panel maximum width is `w-[400px]`
- UI-079: Graph panel is collapsible (close button or toggle)
- UI-080: Header shows "Knowledge Graph" title
- UI-081: Header has zoom in/out/fit buttons
- UI-082: Header has close button with `aria-label="Close graph panel"`
- UI-083: Graph toggle button exists in ChatHeader
- UI-084: Graph toggle button has `aria-label="Toggle graph panel"`
- UI-085: Empty state message shown when no graph data
- UI-086: Conversation nodes render as circles
- UI-087: Current conversation node is highlighted (primary color)
- UI-088: Other conversation nodes are muted color
- UI-089: Edges render as lines between nodes
- UI-090: Node labels (conversation titles) are visible
- UI-091: Clicking a node navigates to that conversation
- UI-092: Hovering a node shows tooltip with title and stats
- UI-093: Zoom in button works
- UI-094: Zoom out button works
- UI-095: Fit all button works
- UI-096: Scroll wheel zooms
- UI-097: Drag pans the graph
- UI-098: Graph panel has `border-l border-border/50`
- UI-099: On mobile, graph panel is hidden (available via sheet)
- UI-100: Resize handle has `cursor-col-resize`

### ChatLayout Validation (LAYOUT-001 through LAYOUT-020)

- LAYOUT-001: Three-panel layout renders (sidebar + chat + graph)
- LAYOUT-002: Sidebar width is unchanged (`w-72`)
- LAYOUT-003: Chat area is `flex-1`
- LAYOUT-004: Graph panel is to the right of chat area
- LAYOUT-005: Resize handle between chat and graph panel is visible on hover
- LAYOUT-006: Resizing graph panel works (drag handle)
- LAYOUT-007: Closing graph panel expands chat area to fill space
- LAYOUT-008: Reopening graph panel restores previous width
- LAYOUT-009: Mobile: only sidebar and chat visible
- LAYOUT-010: Mobile: graph accessible via header button → sheet
- LAYOUT-011: MarkdownEditor replaces old ChatInput component
- LAYOUT-012: Message list still renders above the editor
- LAYOUT-013: Loading skeleton still works
- LAYOUT-014: Empty state ("How can I help you today?") still works
- LAYOUT-015: Streaming indicator still works
- LAYOUT-016: Chat header still shows conversation title
- LAYOUT-017: Chat header still has mobile menu button
- LAYOUT-018: Chat header still has theme toggle
- LAYOUT-019: Chat header now has graph toggle button (to the left of theme toggle)
- LAYOUT-020: Overall layout does not overflow viewport

### Hook Validation (HOOK-001 through HOOK-030)

**useCommands:**
- HOOK-001: `parseCommands("")` returns empty array
- HOOK-002: `parseCommands("hello")` returns empty array
- HOOK-003: `parseCommands(";select @this")` returns one parsed command
- HOOK-004: `previewCommand` calls `/api/commands/preview`
- HOOK-005: `previewCommand` returns preview without executing
- HOOK-006: `executeCommand` calls `/api/commands/execute`
- HOOK-007: `conversationSearch` calls `/api/conversations/search`
- HOOK-008: `suggestions` includes all 8 commands
- HOOK-009: Suggestions filter by partial name

**useGraph:**
- HOOK-010: `graphData` is null initially
- HOOK-011: `graphData` populates after fetch
- HOOK-012: `isGraphOpen` defaults to false (or localStorage preference)
- HOOK-013: `toggleGraph` toggles `isGraphOpen`
- HOOK-014: `refreshGraph` re-fetches graph data
- HOOK-015: `highlightNode` sets highlighted node ID
- HOOK-016: Graph data polls every 5 seconds when panel is open
- HOOK-017: Polling stops when panel is closed
- HOOK-018: Graph panel open/close state persists in localStorage

**useCodeMirror:**
- HOOK-019: Editor mounts in the ref element
- HOOK-020: `getValue()` returns current editor content
- HOOK-021: `setValue()` replaces editor content
- HOOK-022: `focus()` focuses the editor
- HOOK-023: `insertAtCursor()` inserts text at cursor position
- HOOK-024: Theme updates when app theme changes

**useChat (modified):**
- HOOK-025: `sendMessage` still works for plain text (no commands)
- HOOK-026: `sendMessageWithCommands` sends commands array in request body
- HOOK-027: New SSE event types are handled (`command_start`, `command_result`, etc.)
- HOOK-028: `command_start` event doesn't break streaming
- HOOK-029: `command_error` shows toast notification
- HOOK-030: Existing conversations still load and display correctly

### Integration Validation (INT-001 through INT-040)

**Command → Database flow:**
- INT-001: Executing `;select @other` creates a record in `command_executions`
- INT-002: Executing `;select @other` creates a record in `conversation_links`
- INT-003: Executing `;summarize @other` stores summary in `command_executions.resultContent`
- INT-004: Sending a message with `;inject @other` creates record in `injected_contexts`
- INT-005: Command execution record has correct `conversationId`
- INT-006: Command execution record has correct `sourceConversationIds`

**Command → Neo4j flow:**
- INT-007: Executing `;link @other` creates edge in Neo4j
- INT-008: Executing `;select @other` creates edge in Neo4j
- INT-009: Graph API returns the new edge after creation
- INT-010: Graph panel updates to show new edge (within 5s poll interval)

**Command → LLM flow:**
- INT-011: `;summarize @other` sends messages to LLM for summarization
- INT-012: `;keypoints @other` sends messages to LLM for extraction
- INT-013: `;ask @other "question"` sends question + context to LLM
- INT-014: `;diff @a @b` sends both conversations to LLM for comparison
- INT-015: LLM response is stored in command_execution.resultContent

**Frontend → Backend flow:**
- INT-016: Typing `;` in editor triggers popover (client-side)
- INT-017: Selecting command from popover inserts into editor (client-side)
- INT-018: Typing `@` in command triggers conversation picker
- INT-019: Picker searches conversations via `/api/conversations/search`
- INT-020: Sending message with commands calls `/api/chat/send` with commands array
- INT-021: SSE events render correctly during command processing
- INT-022: After all commands processed, LLM streaming begins normally
- INT-023: Injected context preview renders in the sent message bubble

**Graph → Frontend flow:**
- INT-024: Graph panel fetches data from `/api/graph` on open
- INT-025: Graph panel polls every 5 seconds
- INT-026: New edges appear in graph after command execution
- INT-027: Clicking a graph node calls `selectConversation`
- INT-028: Current conversation is highlighted in graph
- INT-029: Graph survives page refresh (data from API, not local state)

**Backward compatibility:**
- INT-030: Sending a plain text message (no commands) works exactly as before
- INT-031: All existing conversations are visible in sidebar
- INT-032: Message history loads correctly for existing conversations
- INT-033: Conversation rename still works
- INT-034: Conversation delete still works
- INT-035: Streaming responses still work for plain messages
- INT-036: New conversation auto-creation still works on first message
- INT-037: `X-Conversation-Id` header still returned
- INT-038: Error toasts still appear for API failures
- INT-039: Mobile responsive layout still works
- INT-040: Dark/light theme still works

### Build & Lint Validation (BUILD-001 through BUILD-015)

- BUILD-001: `npx tsc --noEmit` passes with no errors
- BUILD-002: `bun run lint` passes (warnings OK, no errors)
- BUILD-003: `bun run build` succeeds
- BUILD-004: `bun run dev` starts without errors
- BUILD-005: No new `any` types introduced (no new lint warnings for `noExplicitAny`)
- BUILD-006: All new files use named exports (no default exports except pages/layouts)
- BUILD-007: All new files use `type` imports for type-only imports
- BUILD-008: All new files use `const` over `let`
- BUILD-009: All imports use path aliases (`@/*`, `@/core/*`, `@/features/*`, `@/shared/*`)
- BUILD-010: Biome formatting is correct (2-space indent, double quotes, 100 char width)
- BUILD-011: No unused imports
- BUILD-012: No unused variables
- BUILD-013: No `console.log` statements (use structured logger)
- BUILD-014: All Zod imports are from `zod/v4`
- BUILD-015: `bun run lint:fix` makes no changes (already clean)

### Test Validation (TEST-001 through TEST-035)

- TEST-001: `bun test` passes with all new tests
- TEST-002: Parser test file exists at `src/features/commands/tests/parser.test.ts`
- TEST-003: Parser tests cover all CMD-* gates (minimum 30 test cases)
- TEST-004: Executor test file exists at `src/features/commands/tests/executor.test.ts`
- TEST-005: Executor tests cover EXEC-001 through EXEC-020 (happy paths)
- TEST-006: Registry test file exists at `src/features/commands/tests/registry.test.ts`
- TEST-007: Registry tests verify all 8 commands are registered
- TEST-008: Schema test file exists at `src/features/commands/tests/schemas.test.ts`
- TEST-009: Schema tests validate command execution schemas
- TEST-010: Select handler test exists
- TEST-011: Summarize handler test exists
- TEST-012: Graph service test exists at `src/features/graph/tests/service.test.ts`
- TEST-013: Graph repository test exists at `src/features/graph/tests/repository.test.ts`
- TEST-014: All tests use `describe` and `it` blocks from `bun:test`
- TEST-015: No test uses `any` type
- TEST-016: All test files follow naming convention `*.test.ts`
- TEST-017: Test coverage for commands feature > 70%
- TEST-018: Test coverage for graph feature > 60%
- TEST-019: Existing tests still pass (`src/features/chat/tests/`)
- TEST-020: Existing tests still pass (`src/features/projects/tests/`)
- TEST-021: Parser handles malformed input without throwing
- TEST-022: Parser tests for edge cases (CMD-044 through CMD-053)
- TEST-023: Command execution tests mock LLM calls
- TEST-024: Command execution tests mock database calls
- TEST-025: Graph tests mock Neo4j driver
- TEST-026: Hook tests exist for useCommands
- TEST-027: Hook tests exist for useGraph
- TEST-028: Component tests exist for CommandPopover
- TEST-029: Component tests exist for ConversationPicker
- TEST-030: Component tests use `@testing-library/react`
- TEST-031: Component tests use `render`, `screen`, `userEvent`
- TEST-032: All mocks are properly cleaned up after each test
- TEST-033: No test depends on external services (Neo4j, OpenRouter)
- TEST-034: Test files are in `tests/` subfolder per feature slice convention
- TEST-035: `bun test --coverage` reports > 70% for new code

### E2E Validation with agent-browser CLI (E2E-001 through E2E-050)

These tests use the agent-browser CLI to validate the full user experience.

**Setup:**
```bash
bun run dev &
sleep 5
```

**Basic navigation:**
- E2E-001: Open `http://localhost:3000` — page loads without errors
- E2E-002: Sidebar is visible with "New Chat" button
- E2E-003: MarkdownEditor is visible (NOT the old textarea)
- E2E-004: Editor has placeholder text
- E2E-005: Graph toggle button visible in header

**Sending plain messages (backward compat):**
- E2E-006: Type "Hello" in editor → editor content updates
- E2E-007: Press `Cmd+Enter` → message is sent
- E2E-008: User message appears in message list (right-aligned, blue)
- E2E-009: Streaming response appears (left-aligned, gray)
- E2E-010: New conversation appears in sidebar
- E2E-011: Editor is cleared after send
- E2E-012: Can type and send a second message

**Command popover:**
- E2E-013: Type `;` in editor → command popover appears
- E2E-014: Popover shows list of commands (select, summarize, keypoints, etc.)
- E2E-015: Type `;sel` → popover filters to show "select"
- E2E-016: Press Enter → "select" is inserted into editor
- E2E-017: Press Escape → popover closes
- E2E-018: Click outside popover → popover closes

**Conversation picker:**
- E2E-019: Within a command context, type `@` → picker appears
- E2E-020: Picker shows `@this`, `@this:user`, `@this:assistant`, `@last`
- E2E-021: Picker shows list of existing conversations
- E2E-022: Search filters conversations in picker
- E2E-023: Select a conversation → `@title` inserted into editor
- E2E-024: Escape closes the picker

**Cross-conversation commands:**
- E2E-025: Create conversation A, send "The capital of France is Paris"
- E2E-026: Create conversation B (new chat)
- E2E-027: In B, send `;select @<A-title> --last 1`
- E2E-028: Verify command_start SSE event appears (visual indicator)
- E2E-029: Verify injected context preview appears in the message
- E2E-030: Verify LLM response references the injected content

**;summarize command:**
- E2E-031: Send multiple messages in conversation A
- E2E-032: In conversation B, type `;summarize @<A-title>`
- E2E-033: Verify summary is generated and displayed
- E2E-034: Verify injected context preview shows summary

**;link command:**
- E2E-035: In conversation B, send `;link @<A-title> --label "related"`
- E2E-036: Verify link creation confirmation message

**Graph panel:**
- E2E-037: Click graph toggle button → graph panel opens
- E2E-038: Graph panel shows conversation nodes
- E2E-039: Graph panel shows edges between linked conversations
- E2E-040: Click a node in graph → navigates to that conversation
- E2E-041: Current conversation node is highlighted
- E2E-042: Zoom controls work (zoom in, zoom out, fit)
- E2E-043: Close button closes the graph panel
- E2E-044: Reopening graph panel preserves state

**Persistence:**
- E2E-045: Refresh page → conversations still visible in sidebar
- E2E-046: Select conversation with commands → message history loads with injected context
- E2E-047: Graph data persists across refresh

**Responsive:**
- E2E-048: On mobile viewport (375px), graph panel is hidden
- E2E-049: On mobile, graph is accessible via header button → sheet
- E2E-050: On mobile, command popover is usable

---

## Acceptance Criteria

1. **Markdown Editor**: The old textarea input is replaced with a CodeMirror Markdown editor. Users can write rich text, use `Cmd+Enter` to send, and `Enter` for newlines.

2. **Command Popover**: Typing `;` triggers a command palette with all available commands. Autocomplete, keyboard navigation, and category organization.

3. **Conversation Picker**: Typing `@` within a command triggers a picker showing all conversations with special entries (`@this`, `@last`). Search and keyboard navigation.

4. **Cross-Conversation Commands**: `;select`, `;summarize`, `;keypoints`, `;inject`, `;ask`, `;diff`, `;link`, `;search` all work end-to-end. Content from one conversation can be injected into another.

5. **Injected Context UI**: Messages with injected context show a collapsible preview block. Context source conversations are linked and clickable.

6. **Knowledge Graph**: Neo4j-powered graph visualization in a resizable right panel. Shows conversations as nodes and relationships as edges. Interactive (click to navigate, zoom, pan). Updates as commands create new links.

7. **Backward Compatibility**: Everything that worked before still works identically. Plain messages without commands behave exactly the same.

8. **Build Quality**: `bun run lint`, `npx tsc --noEmit`, `bun run build`, and `bun test` all pass. No regressions.

---

## Agent Spawn Prompts

### Database Agent Prompt

```
You are the DATABASE agent for this build.

## Your Ownership
- You own: `src/core/database/schema.ts` (append only — add new tables after existing ones)
- You own: `src/core/config/env.ts` (append only — add NEO4J env vars)
- You own: `src/core/neo4j/` (new directory — client.ts, index.ts)
- You own: `src/features/commands/models.ts` (new file)
- You own: `src/features/commands/repository.ts` (new file)
- You own: `src/features/graph/models.ts` (new file)
- You own: `src/features/graph/repository.ts` (new file)
- Do NOT touch: Components, hooks, API routes, services, parsers

## What You're Building

1. Three new Drizzle tables: `commandExecutions`, `conversationLinks`, `injectedContexts`
2. Neo4j client setup
3. Drizzle models and repository functions for CRUD on new tables
4. Graph repository for Neo4j queries

## Contracts You Produce

### Database Functions (for Backend agent)
[Include full schema from plan, all repository function signatures]

### Neo4j Functions (for Backend agent)
[Include full Neo4j schema and query functions]

## Before Reporting Done

Run these validations:
1. `bun run db:generate` — succeeds
2. `bun run db:migrate` — succeeds (or `bun run db:push` for dev)
3. `npx tsc --noEmit` — no type errors
4. `bun run lint` — no errors
5. Verify all DB-* validation gates you can test locally
```

### Backend Agent Prompt

```
You are the BACKEND agent for this build.

## Your Ownership
- You own: `src/features/commands/` (except models.ts, repository.ts — those are database agent's)
- You own: `src/features/graph/` (except models.ts, repository.ts)
- You own: `src/features/chat/` (modify existing files — schemas, service, errors, index)
- You own: `src/app/api/` (all API routes — modify existing, create new)
- You own: `src/lib/command-utils.ts` (shared parser)
- Do NOT touch: Components, hooks, schema.ts

## What You're Building

1. Command parser (`src/lib/command-utils.ts` + `src/features/commands/parser.ts`)
2. Command executor and handler system
3. Command registry mapping names to handlers
4. New API routes for commands, search, graph
5. Modified chat/send route with command processing
6. New SSE event types for command status

## Contracts You Consume
[Include full DB function signatures and Neo4j query signatures]

## Contracts You Produce
[Include full API contract from plan — endpoints, request/response shapes, SSE events]

## Cross-Cutting Concerns You Own
- Command parser must work on both client and server (shared via command-utils.ts)
- SSE event types must include command_start, command_result, command_error, context_injected
- Token counting: `Math.ceil(text.length / 4)` for MVP
- Backward compatibility: commands field in send request is optional

## Before Reporting Done

Run these validations:
1. `npx tsc --noEmit` — no type errors
2. `bun run lint` — no errors
3. `bun test` — all tests pass
4. Test each API endpoint with curl
5. Verify all CMD-*, EXEC-*, API-* validation gates
```

### Frontend Agent Prompt

```
You are the FRONTEND agent for this build.

## Your Ownership
- You own: `src/components/` (all component files — modify existing, create new)
- You own: `src/hooks/` (all hook files — modify existing, create new)
- You own: `src/app/page.tsx` (if layout changes needed)
- Do NOT touch: Database schema, feature services, API route handlers

## What You're Building

1. CodeMirror Markdown editor replacing ChatInput
2. Command popover (triggers on `;`)
3. Conversation picker (triggers on `@` within commands)
4. Injected context preview component
5. Graph panel with Neo4j visualization
6. Modified ChatLayout for three-panel layout
7. Modified MessageBubble for injected context display
8. New hooks: useCommands, useGraph, useCodeMirror

## Contracts You Consume
[Include full API contract — endpoints, response shapes, SSE events]

## Dependencies to Install
```bash
bun add codemirror @codemirror/view @codemirror/state @codemirror/lang-markdown @codemirror/language @codemirror/commands @codemirror/theme-one-dark @codemirror/autocomplete react-force-graph-2d
bunx shadcn@canary add popover resizable tooltip
bun run lint:fix  # After adding shadcn components
```

## Cross-Cutting Concerns You Own
- Editor keyboard shortcuts (Cmd+Enter sends, Enter is newline, ; opens popover, @ opens picker)
- Graph panel responsive behavior (hidden on mobile, collapsible on desktop)
- Dark mode for ALL new components
- aria-labels on ALL interactive elements

## Before Reporting Done

Run these validations:
1. `npx tsc --noEmit` — no type errors
2. `bun run lint` — no errors
3. `bun run build` — succeeds
4. `bun run dev` — starts without errors
5. Verify all UI-*, LAYOUT-*, HOOK-* validation gates
6. Run agent-browser E2E tests for E2E-001 through E2E-050
```

---

## E2E Test Script (for Lead Agent)

After all agents complete, run this end-to-end validation:

```bash
# Start dev server
bun run dev &
DEV_PID=$!
sleep 5

# Verify server is running
curl -s http://localhost:3000 | head -1 && echo "✓ Server running"

# Install agent-browser if needed
which agent-browser || npm install -g agent-browser
agent-browser install 2>/dev/null

# E2E Flow
agent-browser open "http://localhost:3000"
agent-browser snapshot -i
agent-browser screenshot e2e-01-initial.png

# Verify editor (not textarea)
agent-browser snapshot -i
# Look for CodeMirror editor element, NOT textarea

# Verify graph toggle button
# Look for button with aria-label "Toggle graph panel"

# Create first conversation
agent-browser fill @<editor-ref> "The capital of France is Paris"
agent-browser key "Meta+Enter"  # Send with Cmd+Enter
sleep 3
agent-browser snapshot -i
agent-browser screenshot e2e-02-first-message.png

# Verify message appears
# Verify conversation in sidebar

# Test command popover
agent-browser click @<editor-ref>
agent-browser key ";"
sleep 1
agent-browser snapshot -i
agent-browser screenshot e2e-03-command-popover.png
# Verify popover is visible with commands

# Dismiss popover
agent-browser key "Escape"

# Create second conversation
agent-browser click @<new-chat-button>
agent-browser fill @<editor-ref> ";select @<first-conv-title> --last 1"
agent-browser key "Meta+Enter"
sleep 5
agent-browser snapshot -i
agent-browser screenshot e2e-04-cross-conversation.png

# Verify injected context
# Verify command result

# Test graph panel
agent-browser click @<graph-toggle-button>
sleep 2
agent-browser snapshot -i
agent-browser screenshot e2e-05-graph-panel.png
# Verify graph panel shows nodes and edges

# Test link command
agent-browser click @<editor-ref>
agent-browser fill @<editor-ref> ";link @<first-conv-title> --label \"related topic\""
agent-browser key "Meta+Enter"
sleep 3
agent-browser snapshot -i
agent-browser screenshot e2e-06-link-created.png

# Verify new edge in graph
agent-browser snapshot -i
agent-browser screenshot e2e-07-graph-updated.png

# Refresh page and verify persistence
agent-browser open "http://localhost:3000"
sleep 3
agent-browser snapshot -i
agent-browser screenshot e2e-08-persistence.png
# Verify conversations still in sidebar
# Verify graph data persists

# Take final screenshot
agent-browser screenshot e2e-final.png

# Cleanup
kill $DEV_PID
```

**Success criteria:**
- All screenshots show expected state
- No console errors in browser
- No server errors in terminal
- All 8 commands work end-to-end
- Graph panel shows real relationship data
- Persistence works across page refresh
- Backward compatibility: plain messages still work

---

## Summary

| Metric | Count |
|--------|-------|
| New files | ~30 |
| Modified files | ~12 |
| New database tables | 3 (PostgreSQL) + 3 node types + 5 edge types (Neo4j) |
| New API endpoints | 7 |
| Modified API endpoints | 1 |
| New components | 10 |
| Modified components | 4 |
| New hooks | 4 |
| Modified hooks | 1 |
| New npm packages | ~10 |
| Validation gates | 350 |
| E2E test steps | 50 |
| Commands | 8 |
