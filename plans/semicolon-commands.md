# Semicolon Commands: Cross-Conversation Composition for Chat

Build a `;command` system that lets users compose context from multiple conversations, transform content, and link conversations together — turning isolated chat threads into a composable, pipe-like knowledge workspace.

## Problem Statement

Every chat conversation in the current app is an isolated silo. Users cannot reference, summarize, or inject content from one conversation into another. There is no way to build on prior conversations without manually copy-pasting. This makes the chat interface single-use rather than a compounding knowledge tool.

**Solution**: Add a `;command` syntax parsed in the chat input that can select, summarize, transform, and inject content from any conversation into the current prompt before sending it to the LLM. Track cross-conversation references in the database. Show a command popover when the user types `;` for discoverability.

## Tech Stack (existing — no new infrastructure)

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui | Exists |
| Backend | Next.js App Router API routes | Exists |
| Database | Supabase Postgres via Drizzle ORM | Exists |
| LLM | OpenRouter (claude-haiku-4.5) | Exists |
| Testing | Bun test runner, agent-browser CLI | Exists |

**No new infrastructure.** No Neo4j, no new databases, no new services. Everything builds on top of what exists.

## Current Architecture (what exists today)

### Database Schema (Drizzle — `src/core/database/schema.ts`)
```
users          → id, email, displayName, avatarUrl, timestamps
projects       → id, name, slug, description, isPublic, ownerId, timestamps
chatConversations → id, title, timestamps
chatMessages   → id, conversationId (FK), role, content, timestamps
```

All tables use `TABLE_PREFIX=streletz` in production (prefixed as `streletz_*`).

### API Routes
```
POST   /api/chat/send                          → Send message, stream SSE response
GET    /api/chat/conversations/[id]/messages    → Get messages for conversation
POST   /api/chat/conversations                  → Create conversation
GET    /api/chat/conversations/[id]             → Get single conversation
PATCH  /api/chat/conversations/[id]             → Rename conversation
DELETE /api/chat/conversations/[id]             → Delete conversation
```

### Frontend Components (`src/components/chat/`)
```
chat-layout.tsx       → Main layout: sidebar + chat area
chat-sidebar.tsx      → Conversation list with new/rename/delete
chat-header.tsx       → Title bar with theme toggle
chat-input.tsx        → Textarea + send button (THIS GETS MODIFIED)
message-list.tsx      → Scrollable message display
message-bubble.tsx    → Individual message with avatar
conversation-item.tsx → Sidebar item with dropdown menu
markdown-content.tsx  → Markdown renderer with syntax highlighting
```

### Hooks (`src/hooks/`)
```
use-chat.ts           → Core chat state: conversations, messages, send, CRUD
use-local-storage.ts  → Conversation list persistence (localStorage)
use-auto-scroll.ts    → Auto-scroll on new messages
```

### Key Flow: Sending a Message
1. User types in `ChatInput` textarea → calls `onSend(content)`
2. `useChat.sendMessage(content)` → POST to `/api/chat/send`
3. Route creates conversation if needed, saves user message, calls OpenRouter
4. SSE stream returns chunks → `readSSEStream` accumulates → sets `streamingContent`
5. On stream complete, assistant message added to local state

## Feature Design

### The `;command` Syntax

Commands are prefixed with `;` and can appear anywhere in the message text. They are parsed and resolved **before** sending to the LLM — the LLM never sees raw `;commands`, only the resolved content.

#### Core Commands (8 total)

| Command | Syntax | Description |
|---------|--------|-------------|
| `;select` | `;select @ConvoTitle` | Inject all messages from a conversation |
| `;select:user` | `;select:user @ConvoTitle` | Inject only user messages from a conversation |
| `;select:assistant` | `;select:assistant @ConvoTitle` | Inject only assistant messages from a conversation |
| `;select:last` | `;select:last @ConvoTitle` | Inject only the last message pair (user+assistant) |
| `;summarize` | `;summarize @ConvoTitle` | Summarize a conversation into key points via LLM |
| `;keypoints` | `;keypoints @ConvoTitle` | Extract bullet-point key takeaways via LLM |
| `;inject` | `;inject @ConvoTitle "question"` | Ask a question about a conversation's content |
| `;link` | `;link @ConvoTitle` | Create an explicit reference link between conversations |

#### How Parsing Works

**Input (what the user types):**
```
Based on ;summarize @Project-Planning and ;select:last @API-Design,
write me a technical spec for the auth module.
```

**Resolved (what the LLM receives):**
```
Based on [Summary of "Project Planning": The team decided to use
Next.js with Supabase. Key decisions include vertical slice architecture,
OpenRouter for LLM calls, and Drizzle ORM for database access.]
and [Last exchange from "API Design":
User: What should the auth endpoints look like?
Assistant: I recommend POST /api/auth/login and POST /api/auth/register...],
write me a technical spec for the auth module.
```

#### Conversation Title Matching

- Titles are matched **case-insensitively** with **fuzzy prefix matching**
- Spaces in titles are replaced with `-` in the `@reference` syntax
- Example: conversation "My Project Planning" → `@My-Project-Planning` or `@my-project`
- If ambiguous (multiple matches), the command resolver returns an error asking the user to be more specific

### The Command Popover

When the user types `;` in the textarea, a floating popover appears **above the cursor position** showing available commands. This is similar to Notion's `/` menu or VS Code's command palette.

#### Popover Behavior
- **Trigger**: User types `;` at the start of a word (not inside another word like `semi;colon`)
- **Filtering**: As the user continues typing after `;`, the list filters (e.g., `;su` shows only `;summarize` and `;select:user`)
- **Conversation selection**: After selecting a command that takes `@ConvoTitle`, show a second-level list of available conversations
- **Keyboard navigation**: Arrow keys to navigate, Enter to select, Escape to dismiss
- **Mouse**: Click to select
- **Dismiss**: Escape key, clicking outside, or pressing Backspace past the `;`
- **Position**: Anchored to the textarea, appears directly above it (not above cursor inside textarea — the textarea is plain, not a rich editor)
- **Max height**: 240px with scroll for long conversation lists
- **Width**: Same width as the textarea container (max-w-3xl)

#### Popover Visual Design
```
┌─────────────────────────────────────────────┐
│ ;commands                                    │
├─────────────────────────────────────────────┤
│ ▸ ;select @ConvoTitle     Pull messages in   │
│   ;select:user @...       User messages only │
│   ;select:assistant @...  AI messages only   │
│   ;select:last @...       Last exchange      │
│ ─────────────────────────────────────────── │
│   ;summarize @...         Summarize convo    │
│   ;keypoints @...         Key takeaways      │
│   ;inject @... "?"        Ask about convo    │
│ ─────────────────────────────────────────── │
│   ;link @...              Link conversations │
└─────────────────────────────────────────────┘
```

After selecting a command, the conversation picker appears:
```
┌─────────────────────────────────────────────┐
│ Select conversation              ⌨ Type to  │
│                                    filter   │
├─────────────────────────────────────────────┤
│ ▸ Project Planning          3 min ago        │
│   API Design               1 hour ago       │
│   Database Schema          2 hours ago       │
│   Frontend Components      yesterday         │
└─────────────────────────────────────────────┘
```

### Database: Cross-Reference Tracking

Add a new table to track when one conversation references another:

```sql
CREATE TABLE chat_cross_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  target_conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  command TEXT NOT NULL,        -- 'select', 'summarize', 'keypoints', 'inject', 'link'
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_cross_refs_source ON chat_cross_references(source_conversation_id);
CREATE INDEX idx_cross_refs_target ON chat_cross_references(target_conversation_id);
```

### New API Endpoints

| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| `POST` | `/api/chat/commands/resolve` | `{ commands: CommandInput[], sourceConversationId?: string }` | `{ resolved: ResolvedCommand[] }` |
| `GET` | `/api/chat/conversations/[id]/references` | — | `{ references: CrossReference[] }` |
| `GET` | `/api/chat/conversations/search?q=...` | — | `{ conversations: ConversationMatch[] }` |

#### Request/Response Shapes

**POST /api/chat/commands/resolve**

Request:
```json
{
  "commands": [
    { "type": "select", "conversationTitle": "Project Planning", "filter": "all" },
    { "type": "summarize", "conversationTitle": "API Design" }
  ],
  "sourceConversationId": "uuid-of-current-conversation"
}
```

Response:
```json
{
  "resolved": [
    {
      "type": "select",
      "conversationId": "uuid",
      "conversationTitle": "Project Planning",
      "content": "User: What stack should we use?\nAssistant: I recommend Next.js...",
      "messageCount": 12
    },
    {
      "type": "summarize",
      "conversationId": "uuid",
      "conversationTitle": "API Design",
      "content": "Key points from API Design:\n- REST endpoints for auth...\n- SSE for streaming...",
      "messageCount": 8
    }
  ]
}
```

**GET /api/chat/conversations/search?q=project**

Response:
```json
{
  "conversations": [
    { "id": "uuid", "title": "Project Planning", "updatedAt": "2026-02-13T..." },
    { "id": "uuid", "title": "My Project Ideas", "updatedAt": "2026-02-12T..." }
  ]
}
```

**GET /api/chat/conversations/[id]/references**

Response:
```json
{
  "references": [
    {
      "id": "uuid",
      "sourceConversationId": "uuid",
      "targetConversationId": "uuid",
      "targetTitle": "API Design",
      "command": "summarize",
      "createdAt": "2026-02-13T..."
    }
  ]
}
```

### Conversation References Badge (Sidebar)

When a conversation has cross-references (either as source or target), show a small badge/indicator on the conversation item in the sidebar:

- A subtle link icon (🔗) or a small count badge next to the title
- Tooltip on hover showing "References 2 conversations" or "Referenced by 3 conversations"
- Clicking the badge could expand to show the linked conversations (stretch goal — not required for MVP)

## Project Structure (new files only)

```
src/
├── features/
│   └── commands/                          ← NEW FEATURE SLICE
│       ├── models.ts                      ← Drizzle types for cross_references
│       ├── schemas.ts                     ← Zod schemas for command input/output
│       ├── repository.ts                  ← DB queries for cross-references
│       ├── service.ts                     ← Command resolution business logic
│       ├── parser.ts                      ← Parse ;command syntax from text
│       ├── resolver.ts                    ← Resolve parsed commands to content
│       ├── errors.ts                      ← Command-specific error classes
│       ├── constants.ts                   ← Command definitions, regex patterns
│       ├── index.ts                       ← Public API
│       └── tests/
│           ├── parser.test.ts             ← Parser unit tests
│           ├── resolver.test.ts           ← Resolver unit tests
│           ├── schemas.test.ts            ← Schema validation tests
│           ├── errors.test.ts             ← Error class tests
│           └── service.test.ts            ← Service integration tests
├── components/
│   └── chat/
│       ├── command-popover.tsx            ← NEW: Popover UI component
│       ├── conversation-picker.tsx        ← NEW: Conversation selection list
│       └── reference-badge.tsx            ← NEW: Cross-reference indicator
├── hooks/
│   └── use-command-input.ts              ← NEW: Command parsing + popover state hook
├── app/
│   └── api/
│       └── chat/
│           ├── commands/
│           │   └── resolve/
│           │       ├── route.ts           ← NEW: Command resolution endpoint
│           │       └── route.test.ts      ← NEW: Endpoint tests
│           └── conversations/
│               ├── search/
│               │   ├── route.ts           ← NEW: Conversation search endpoint
│               │   └── route.test.ts      ← NEW: Search endpoint tests
│               └── [id]/
│                   └── references/
│                       ├── route.ts       ← NEW: References endpoint
│                       └── route.test.ts  ← NEW: References tests
└── core/
    └── database/
        └── schema.ts                      ← MODIFIED: Add chatCrossReferences table
```

## Agent Build Order & Communication

### Agent Roles (3 agents)

| Agent | Name | Ownership | Does NOT Touch |
|-------|------|-----------|----------------|
| 1 | **database** | `src/core/database/schema.ts` (add table), `src/features/commands/models.ts`, `src/features/commands/repository.ts`, `src/features/commands/errors.ts`, `src/features/commands/constants.ts`, `drizzle/migrations/` | Components, hooks, API routes |
| 2 | **backend** | `src/features/commands/parser.ts`, `src/features/commands/resolver.ts`, `src/features/commands/service.ts`, `src/features/commands/schemas.ts`, `src/features/commands/index.ts`, all `route.ts` files under `src/app/api/chat/commands/` and `src/app/api/chat/conversations/search/` and `src/app/api/chat/conversations/[id]/references/`, `src/app/api/chat/send/route.ts` (modify to support resolved commands), all backend test files | Components, hooks |
| 3 | **frontend** | `src/components/chat/command-popover.tsx`, `src/components/chat/conversation-picker.tsx`, `src/components/chat/reference-badge.tsx`, `src/components/chat/chat-input.tsx` (modify), `src/components/chat/conversation-item.tsx` (modify for badge), `src/components/chat/chat-layout.tsx` (modify for popover integration), `src/hooks/use-command-input.ts`, `src/hooks/use-chat.ts` (modify sendMessage to resolve commands first), all frontend test files | Database schema, features/commands service/repository |

## Contract Definitions

### Contract 1: Database → Backend

**Drizzle table definition** (added to `src/core/database/schema.ts`):
```typescript
export const chatCrossReferences = pgTable("chat_cross_references", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceConversationId: uuid("source_conversation_id")
    .notNull()
    .references(() => chatConversations.id, { onDelete: "cascade" }),
  targetConversationId: uuid("target_conversation_id")
    .notNull()
    .references(() => chatConversations.id, { onDelete: "cascade" }),
  command: text("command").notNull(), // 'select', 'summarize', 'keypoints', 'inject', 'link'
  ...timestamps,
});
```

**Models** (`src/features/commands/models.ts`):
```typescript
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { chatCrossReferences as crossReferences } from "@/core/database/schema";

export { crossReferences };

export type CrossReference = InferSelectModel<typeof crossReferences>;
export type NewCrossReference = InferInsertModel<typeof crossReferences>;
```

**Repository functions** (`src/features/commands/repository.ts`):
```typescript
// Create a cross-reference
export async function createCrossReference(data: NewCrossReference): Promise<CrossReference>

// Find references where conversation is the source
export async function findReferencesBySource(conversationId: string): Promise<CrossReference[]>

// Find references where conversation is the target
export async function findReferencesByTarget(conversationId: string): Promise<CrossReference[]>

// Find all references for a conversation (both directions)
export async function findAllReferences(conversationId: string): Promise<CrossReference[]>

// Delete references by source conversation
export async function deleteReferencesBySource(conversationId: string): Promise<void>
```

**Error classes** (`src/features/commands/errors.ts`):
```typescript
export type CommandErrorCode =
  | "CONVERSATION_NOT_FOUND"
  | "AMBIGUOUS_CONVERSATION"
  | "INVALID_COMMAND"
  | "COMMAND_RESOLUTION_FAILED";

export class CommandError extends Error {
  readonly code: CommandErrorCode;
  readonly statusCode: HttpStatusCode;
}

export class ConversationNotFoundError extends CommandError {
  // code: "CONVERSATION_NOT_FOUND", statusCode: 404
}

export class AmbiguousConversationError extends CommandError {
  // code: "AMBIGUOUS_CONVERSATION", statusCode: 400
  readonly matches: string[]; // titles of matching conversations
}

export class InvalidCommandError extends CommandError {
  // code: "INVALID_COMMAND", statusCode: 400
}

export class CommandResolutionError extends CommandError {
  // code: "COMMAND_RESOLUTION_FAILED", statusCode: 500
}
```

**Constants** (`src/features/commands/constants.ts`):
```typescript
export const COMMAND_PREFIX = ";";

export const VALID_COMMANDS = [
  "select",
  "select:user",
  "select:assistant",
  "select:last",
  "summarize",
  "keypoints",
  "inject",
  "link",
] as const;

export type CommandType = typeof VALID_COMMANDS[number];

export const COMMAND_DESCRIPTIONS: Record<CommandType, string> = {
  "select": "Pull all messages from a conversation",
  "select:user": "Pull only user messages",
  "select:assistant": "Pull only assistant messages",
  "select:last": "Pull the last user+assistant exchange",
  "summarize": "Summarize a conversation into key points",
  "keypoints": "Extract bullet-point takeaways",
  "inject": "Ask a question about a conversation",
  "link": "Create a reference link between conversations",
};

// Max characters to inject from a single ;select command
export const MAX_SELECT_CHARS = 4000;

// Max characters for a summary
export const MAX_SUMMARY_CHARS = 1000;

// Regex for parsing commands from text
// Matches: ;command @Conversation-Title or ;command @Conversation-Title "question"
export const COMMAND_REGEX = /;(select(?::user|:assistant|:last)?|summarize|keypoints|inject|link)\s+@([^\s"]+)(?:\s+"([^"]*)")?/g;
```

### Contract 2: Backend → Frontend

**Parser output** (`src/features/commands/parser.ts`):
```typescript
export interface ParsedCommand {
  type: CommandType;
  conversationTitle: string; // Raw title from @reference (with dashes)
  question?: string;         // Only for ;inject
  startIndex: number;        // Position in original text
  endIndex: number;          // End position in original text
  raw: string;               // Original matched text
}

// Parse all ;commands from input text
export function parseCommands(text: string): ParsedCommand[]

// Check if text contains any ;commands
export function hasCommands(text: string): boolean

// Replace resolved commands back into the original text
export function replaceCommands(text: string, resolutions: Map<string, string>): string
```

**Schemas** (`src/features/commands/schemas.ts`):
```typescript
import { z } from "zod/v4";

export const CommandInputSchema = z.object({
  type: z.enum(VALID_COMMANDS),
  conversationTitle: z.string().min(1).max(200),
  filter: z.enum(["all", "user", "assistant", "last"]).optional(),
  question: z.string().max(500).optional(),
});

export const ResolveCommandsSchema = z.object({
  commands: z.array(CommandInputSchema).min(1).max(10),
  sourceConversationId: z.string().uuid().optional(),
});

export const ResolvedCommandSchema = z.object({
  type: z.enum(VALID_COMMANDS),
  conversationId: z.string().uuid(),
  conversationTitle: z.string(),
  content: z.string(),
  messageCount: z.number().int().nonnegative(),
});

export const ConversationSearchSchema = z.object({
  q: z.string().min(1).max(200),
});

export const CrossReferenceResponseSchema = z.object({
  id: z.string().uuid(),
  sourceConversationId: z.string().uuid(),
  targetConversationId: z.string().uuid(),
  targetTitle: z.string(),
  command: z.string(),
  createdAt: z.string(),
});
```

**API route contracts:**

**POST /api/chat/commands/resolve** → Resolves commands to content
- Request body matches `ResolveCommandsSchema`
- Returns `{ resolved: ResolvedCommand[] }`
- Each command resolves independently; if one fails, returns error for that command
- 200 on success, 400 on validation error, 404 if conversation not found

**GET /api/chat/conversations/search?q=...** → Search conversations by title
- Query param `q` matches `ConversationSearchSchema`
- Returns `{ conversations: { id, title, updatedAt }[] }`
- Case-insensitive prefix match
- Max 10 results
- 200 always (empty array if no matches)

**GET /api/chat/conversations/[id]/references** → Get cross-references
- Returns `{ references: CrossReferenceResponse[] }`
- Includes references in BOTH directions (source and target)
- 200 on success, 404 if conversation not found

**Modified POST /api/chat/send** → Now accepts pre-resolved content
- Request body gains optional `resolvedContent` field:
  ```json
  {
    "content": "original user text with ;commands",
    "resolvedContent": "text with commands replaced by resolved content",
    "conversationId": "uuid",
    "references": [
      { "targetConversationId": "uuid", "command": "summarize" }
    ]
  }
  ```
- If `resolvedContent` is provided, use it for the LLM context instead of `content`
- Store the original `content` as the user message (so UI shows what user typed)
- The `references` array is used to create cross-reference records

### Contract 3: Frontend ↔ Frontend (internal)

**Hook: `useCommandInput`** (`src/hooks/use-command-input.ts`):
```typescript
interface UseCommandInputReturn {
  // Popover state
  isPopoverOpen: boolean;
  popoverMode: "commands" | "conversations";
  filteredCommands: CommandDefinition[];
  filteredConversations: ConversationMatch[];
  selectedIndex: number;

  // Input handling
  handleInputChange: (value: string) => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleSelectCommand: (command: CommandType) => void;
  handleSelectConversation: (title: string) => void;
  dismissPopover: () => void;

  // Command detection
  pendingCommands: ParsedCommand[];
  hasPendingCommands: boolean;
}
```

**Component: `CommandPopover`** (`src/components/chat/command-popover.tsx`):
- Props: `{ isOpen, mode, commands, conversations, selectedIndex, onSelectCommand, onSelectConversation, onDismiss }`
- Renders absolute-positioned above the textarea container
- Two modes: command list and conversation picker
- Keyboard navigable (aria-listbox pattern)

**Component: `ConversationPicker`** (`src/components/chat/conversation-picker.tsx`):
- Props: `{ conversations, selectedIndex, onSelect, filterText }`
- Shows conversation title + relative time
- Excludes current active conversation from the list

**Component: `ReferenceBadge`** (`src/components/chat/reference-badge.tsx`):
- Props: `{ conversationId, referenceCount }`
- Small link icon with count
- Only renders when referenceCount > 0

## Cross-Cutting Concerns

| Concern | Owner | Coordinates With | Detail |
|---------|-------|-----------------|--------|
| Command regex parsing | Backend (parser.ts) | Frontend (use-command-input.ts) | Backend defines the authoritative regex in constants.ts. Frontend imports and uses the same regex for client-side preview. |
| Conversation title matching | Backend (resolver.ts) | Frontend (conversation-picker) | Case-insensitive, dash-to-space conversion, prefix matching. Backend is authoritative; frontend provides preview. |
| Resolved content injection | Backend (send route) | Frontend (use-chat.ts) | Frontend resolves commands via API before sending. Send route receives both original and resolved content. |
| Cross-reference creation | Backend (send route) | Database (repository) | Send route creates cross-reference records when `references` array is provided. |
| UI accessibility | Frontend | All components | Popover uses aria-listbox, aria-activedescendant. All interactive elements have aria-labels. |
| Error display | Frontend (use-chat.ts) | Backend (error shapes) | Command resolution errors shown as toast notifications with specific messages. |

## Validation Gates

Each agent must verify these gates before reporting done. The lead agent runs end-to-end validation after all agents complete.

### Database Agent Validation (Gates D1–D20)

**Schema & Types:**
- D1: `chatCrossReferences` table exists in `schema.ts` with correct columns (id, sourceConversationId, targetConversationId, command, timestamps)
- D2: Foreign keys reference `chatConversations.id` with `ON DELETE CASCADE`
- D3: Both indexes exist (`idx_cross_refs_source`, `idx_cross_refs_target`)
- D4: `CrossReference` and `NewCrossReference` types are exported from `models.ts`
- D5: `crossReferences` table re-export from `models.ts`

**Repository Functions:**
- D6: `createCrossReference` creates a record and returns it with all fields populated
- D7: `findReferencesBySource` returns only references where the given ID is the source
- D8: `findReferencesByTarget` returns only references where the given ID is the target
- D9: `findAllReferences` returns references in both directions
- D10: `deleteReferencesBySource` removes all references where the given ID is source
- D11: Cascade delete works — deleting a conversation removes its cross-references

**Error Classes:**
- D12: `CommandError` base class has `code` and `statusCode` properties
- D13: `ConversationNotFoundError` has code `"CONVERSATION_NOT_FOUND"` and statusCode 404
- D14: `AmbiguousConversationError` has code `"AMBIGUOUS_CONVERSATION"`, statusCode 400, and `matches` array
- D15: `InvalidCommandError` has code `"INVALID_COMMAND"` and statusCode 400
- D16: `CommandResolutionError` has code `"COMMAND_RESOLUTION_FAILED"` and statusCode 500

**Constants:**
- D17: `VALID_COMMANDS` array contains all 8 command types
- D18: `COMMAND_DESCRIPTIONS` has an entry for every command type
- D19: `COMMAND_REGEX` correctly matches all command patterns
- D20: `MAX_SELECT_CHARS` and `MAX_SUMMARY_CHARS` are defined

**Run command:** `bun run lint && bun run --bun tsc --noEmit && bun test src/features/commands/tests/errors.test.ts`

### Backend Agent Validation (Gates B1–B50)

**Parser (`parser.ts`):**
- B1: `parseCommands(";select @My-Convo")` returns `[{ type: "select", conversationTitle: "My-Convo", startIndex: 0, endIndex: 19 }]`
- B2: `parseCommands(";select:user @Test")` returns filter type `"select:user"`
- B3: `parseCommands(";select:assistant @Test")` returns filter type `"select:assistant"`
- B4: `parseCommands(";select:last @Test")` returns filter type `"select:last"`
- B5: `parseCommands(";summarize @My-Chat")` returns type `"summarize"`
- B6: `parseCommands(";keypoints @My-Chat")` returns type `"keypoints"`
- B7: `parseCommands(';inject @My-Chat "What was the conclusion?"')` returns type `"inject"` with question
- B8: `parseCommands(";link @My-Chat")` returns type `"link"`
- B9: `parseCommands("Hello ;select @A and ;summarize @B world")` returns 2 commands with correct indices
- B10: `parseCommands("no commands here")` returns empty array
- B11: `parseCommands("")` returns empty array
- B12: `parseCommands(";invalid @Test")` returns empty array (invalid command name)
- B13: `hasCommands(";select @Test")` returns true
- B14: `hasCommands("no commands")` returns false
- B15: `replaceCommands` correctly substitutes resolved content at the right positions
- B16: `replaceCommands` handles multiple commands without index corruption (replaces from end to start)

**Resolver (`resolver.ts`):**
- B17: Resolver matches conversation title case-insensitively ("my-project" matches "My Project")
- B18: Resolver converts dashes to spaces for matching ("My-Project" → "My Project")
- B19: Resolver supports prefix matching ("My-Pro" matches "My Project Planning")
- B20: Resolver throws `ConversationNotFoundError` when no conversation matches
- B21: Resolver throws `AmbiguousConversationError` when multiple conversations match, with matches listed
- B22: `;select` returns all messages formatted as "Role: content\n" pairs
- B23: `;select:user` returns only messages where role === "user"
- B24: `;select:assistant` returns only messages where role === "assistant"
- B25: `;select:last` returns only the last user message and last assistant message
- B26: `;select` truncates content at `MAX_SELECT_CHARS` with "[truncated]" suffix
- B27: `;summarize` calls the LLM with a system prompt asking for a summary
- B28: `;summarize` returns a string starting with "Summary of [title]:"
- B29: `;keypoints` calls the LLM with a system prompt asking for key points
- B30: `;keypoints` returns a bulleted list
- B31: `;inject` calls the LLM with the conversation content and the user's question
- B32: `;link` does not produce content but creates a cross-reference record
- B33: Resolver does not return content for `;link` commands (content is empty string)

**Service (`service.ts`):**
- B34: `resolveCommands` accepts an array of commands and returns resolved content for each
- B35: `resolveCommands` creates cross-reference records for each resolved command
- B36: `resolveCommands` handles mixed command types in a single call
- B37: `resolveCommands` returns partial results if some commands fail (does not fail the whole batch)
- B38: Service uses `getLogger("commands.service")` with proper log messages

**Schemas (`schemas.ts`):**
- B39: `CommandInputSchema` validates command type against `VALID_COMMANDS`
- B40: `ResolveCommandsSchema` requires at least 1 command, max 10
- B41: `ConversationSearchSchema` requires non-empty query string
- B42: Invalid command types are rejected with clear error messages

**API Routes:**
- B43: `POST /api/chat/commands/resolve` returns 200 with resolved content
- B44: `POST /api/chat/commands/resolve` returns 400 for invalid command format
- B45: `POST /api/chat/commands/resolve` returns 404 when conversation not found
- B46: `GET /api/chat/conversations/search?q=test` returns matching conversations
- B47: `GET /api/chat/conversations/search?q=test` is case-insensitive
- B48: `GET /api/chat/conversations/search?q=test` returns max 10 results
- B49: `GET /api/chat/conversations/[id]/references` returns cross-references
- B50: Modified `POST /api/chat/send` accepts and uses `resolvedContent` field, stores original `content` as user message, and creates cross-reference records from `references` array

**Run command:** `bun run lint && bun run --bun tsc --noEmit && bun test src/features/commands/tests/ src/app/api/chat/commands/ src/app/api/chat/conversations/search/`

### Frontend Agent Validation (Gates F1–F55)

**Command Popover (`command-popover.tsx`):**
- F1: Popover renders when `isOpen` is true
- F2: Popover does NOT render when `isOpen` is false
- F3: Popover shows all 8 commands when no filter text
- F4: Popover filters commands as user types (";su" shows "summarize" and "select:user")
- F5: Popover has `role="listbox"` for accessibility
- F6: Each command item has `role="option"`
- F7: Selected item has `aria-selected="true"`
- F8: Popover has visible command descriptions next to each command name
- F9: Popover has a subtle header showing ";commands"
- F10: Popover has separator lines between command groups (select variants, transform commands, link)
- F11: Popover max height is 240px with overflow scroll
- F12: Popover width matches the textarea container width
- F13: Popover is positioned above the textarea input area (using absolute positioning)
- F14: Popover has `z-50` to appear above other UI elements
- F15: Popover uses `bg-popover` background with `border` and `rounded-lg shadow-md`

**Conversation Picker (`conversation-picker.tsx`):**
- F16: Picker renders list of conversations with titles and relative timestamps
- F17: Picker excludes the currently active conversation
- F18: Picker filters as user types after `@`
- F19: Picker shows "No matching conversations" when filter has no results
- F20: Picker items are keyboard navigable (arrow keys)
- F21: Enter selects the highlighted conversation
- F22: Escape dismisses the picker and returns to command list
- F23: Each item has `role="option"` and proper `aria-label`

**useCommandInput Hook (`use-command-input.ts`):**
- F24: Typing `;` at word start opens the popover in "commands" mode
- F25: Typing `;` in the middle of a word does NOT open the popover
- F26: Arrow down moves `selectedIndex` forward
- F27: Arrow up moves `selectedIndex` backward
- F28: Arrow navigation wraps around (bottom to top, top to bottom)
- F29: Enter selects the currently highlighted command
- F30: After selecting a command that needs `@ConvoTitle`, popover switches to "conversations" mode
- F31: After selecting `;link`, popover switches to "conversations" mode
- F32: Escape dismisses the popover
- F33: Backspace past the `;` character dismisses the popover
- F34: `handleSelectConversation` inserts the full command text (e.g., `;select @Title`) into the textarea
- F35: `pendingCommands` contains parsed commands from current textarea value
- F36: `hasPendingCommands` is true when textarea contains valid `;commands`

**Modified ChatInput (`chat-input.tsx`):**
- F37: ChatInput renders the `CommandPopover` component
- F38: ChatInput passes `useCommandInput` state to the popover
- F39: Textarea placeholder changes to "Type a message... Use ; for commands"
- F40: ChatInput shows a subtle indicator when pending commands exist (e.g., small badge showing command count)
- F41: Send button tooltip/aria-label changes to "Send (commands will be resolved)" when commands are present
- F42: Pressing Enter with commands triggers resolution before sending
- F43: The ChatInput help text updates from "Enter to send · Shift+Enter for new line" to include "Type ; for commands"

**Modified useChat (`use-chat.ts`) — sendMessage flow:**
- F44: `sendMessage` calls `parseCommands` on the input text
- F45: If commands are found, calls `POST /api/chat/commands/resolve` to resolve them
- F46: If resolution succeeds, calls `replaceCommands` to build `resolvedContent`
- F47: Sends both `content` (original) and `resolvedContent` (resolved) to `/api/chat/send`
- F48: If resolution fails, shows a toast error with the specific failure reason
- F49: If resolution fails, does NOT send the message (user can fix and retry)
- F50: References array is included in the send request for cross-reference tracking

**Reference Badge (`reference-badge.tsx`):**
- F51: Badge renders a link icon when `referenceCount > 0`
- F52: Badge does NOT render when `referenceCount` is 0
- F53: Badge shows the count number next to the icon
- F54: Badge has a tooltip showing "X references"

**Modified ConversationItem (`conversation-item.tsx`):**
- F55: ConversationItem renders `ReferenceBadge` when references exist

**Run command:** `bun run lint && bun run --bun tsc --noEmit && bun test src/components/chat/tests/ src/hooks/`

### End-to-End Validation (Lead Agent — Gates E1–E25)

The lead agent runs these after all agents report done, using agent-browser CLI.

**Setup:**
```bash
# Ensure dev server is running on localhost:3000
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Should return 200
```

**Basic Chat Still Works (Regression):**
- E1: Open http://localhost:3000, verify the chat layout loads (sidebar + main area)
- E2: Type "Hello" in the textarea and click Send — message appears in chat
- E3: Assistant response streams in
- E4: New conversation appears in sidebar
- E5: Click "New Chat" — clears the conversation, empty state shows

**Command Popover Interaction:**
- E6: Click into the textarea, type `;` — command popover appears above the input
- E7: Popover shows all 8 commands with descriptions
- E8: Type `;se` — popover filters to show only "select" variants
- E9: Press Escape — popover dismisses
- E10: Type `;` again, press ArrowDown twice, press Enter — command is inserted into textarea
- E11: After selecting a command, conversation picker appears showing existing conversations

**Cross-Conversation Command Flow:**
- E12: Create conversation "Alpha" by sending "Tell me about TypeScript"
- E13: Wait for response, verify it appears
- E14: Click "New Chat" to create a new conversation
- E15: Type `;summarize @Alpha` in the textarea
- E16: Verify the command text appears in the textarea (no popover auto-resolution yet)
- E17: Press Enter/Send — the message is sent
- E18: Verify the assistant response contains a summary of the Alpha conversation
- E19: The new conversation appears in the sidebar

**;select Command:**
- E20: Create a new chat, type `;select:last @Alpha What patterns were mentioned?`
- E21: Send the message, verify the response references content from Alpha

**Reference Badge:**
- E22: Check the sidebar — Alpha conversation should show a reference indicator (linked by the new conversation)

**Error Handling:**
- E23: Type `;select @Nonexistent-Conversation` and send — toast error appears saying conversation not found
- E24: Type `;invalidcmd @Alpha` and send — treated as plain text (no command parsing)

**Full Round-Trip:**
- E25: Create 3 conversations with different topics, then create a 4th that uses `;select` and `;summarize` from the other 3. Verify the response synthesizes information from all referenced conversations.

**Run commands:**
```bash
bun run lint && bun run --bun tsc --noEmit && bun test
```

## Schema Migration

After the database agent adds the `chatCrossReferences` table to `schema.ts`, generate and run the migration:

```bash
bun run db:generate
bun run db:migrate
```

If `db:migrate` fails due to the known Drizzle Kit bug with Supabase check constraints, use `db:push` as fallback, or run the raw SQL manually in Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS chat_cross_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  target_conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cross_refs_source ON chat_cross_references(source_conversation_id);
CREATE INDEX IF NOT EXISTS idx_cross_refs_target ON chat_cross_references(target_conversation_id);
```

## Definition of Done

The build is complete when:
1. All 3 agents report their work is done
2. All validation gates pass (D1–D20, B1–B50, F1–F55)
3. End-to-end validation passes (E1–E25)
4. `bun run lint` has zero errors
5. `bun run --bun tsc --noEmit` has zero errors
6. `bun test` passes all tests
7. The dev server runs without console errors
8. Cross-conversation commands work end-to-end: type `;summarize @ConvoTitle` in one chat, get a summary of another chat's content in the response
