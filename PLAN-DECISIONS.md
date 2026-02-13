# Feature Plan Decisions: Cross-Conversation Command Interface

## Feature Overview

A CLI-like `;command` system within the chat interface that enables cross-conversation interaction, content piping, and a Neo4j-powered graph visualization showing how conversations relate to each other.

**Value propositions:**
- Break the one-dimensional chat silo — conversations can reference and build on each other
- `;commands` provide power-user efficiency (select, summarize, inject across convos)
- Graph visualization reveals hidden relationships and patterns across conversations
- "Leaf notes" pattern — select multiple answers, ask questions about the aggregate

---

## Decision 1: Command Scope → Full Suite (6+)

**Must-have commands for initial release:**

| Command | Purpose |
|---------|---------|
| `;select <msg-ids>` | Select specific messages from current or another conversation |
| `;summarize [convo-id]` | Summarize a conversation or selection |
| `;keypoints [convo-id]` | Extract key points as a bullet list |
| `;inject <convo-id>` | Pull content from another conversation into current chat |
| `;compare <convo-id-1> <convo-id-2>` | Diff/compare two conversations |
| `;ask <question> about <selection>` | Query across a selection of messages |
| `;search <query>` | Search across all conversations |
| `;tag <convo-id> <tag>` | Tag a conversation for organization |
| `;link <convo-id-1> <convo-id-2>` | Manually create a relationship between conversations |

---

## Decision 2: Graph Database → Neo4j Docker + Fully Interactive

- **Self-hosted Neo4j** via Docker Compose
- **Full interactivity** in the graph panel:
  - Drag/reposition nodes
  - Create manual links between conversations
  - Filter nodes by tags
  - Zoom into subgraphs
  - Click nodes to navigate to conversations

---

## Decision 3: UI Layout → Resizable 3-Panel

```
┌──────────┬──────────────────────┬────────────────┐
│          │                      │                │
│ Sidebar  │       Chat           │   Graph Panel  │
│ (convos) │  (messages + input)  │   (Neo4j viz)  │
│          │                      │                │
│          │  ┌──────────────┐    │                │
│          │  │ Command      │    │                │
│          │  │ Output Panel │    │                │
│          │  └──────────────┘    │                │
│          │  [input bar]         │                │
└──────────┴──────────────────────┴────────────────┘
```

- **Three columns with draggable dividers**
- Graph panel can be collapsed/expanded
- Chat area shrinks when graph is visible
- All panels are resizable

---

## Decision 4: Architecture → Server-Side Execution + Command-Based Edges

**Command execution:** All `;commands` are sent to a dedicated backend API endpoint. The server:
1. Parses the command syntax
2. Fetches referenced conversations from the database
3. Calls OpenRouter for AI processing (summarize, keypoints, ask, compare)
4. Creates Neo4j edges when commands reference other conversations
5. Returns structured results

**Graph model:** Edges in Neo4j are created **only from explicit `;commands`**:
- `;inject` → creates `SOURCED_FROM` edge
- `;link` → creates `LINKED_TO` edge
- `;compare` → creates `COMPARED_WITH` edge
- `;select` (cross-convo) → creates `REFERENCED` edge

This keeps the graph clean, intentional, and meaningful.

---

## Decision 5: Command UX → Dedicated Command Output Panel

- Command results appear in a **collapsible panel below the chat input** (terminal-like)
- Errors show inline in this panel with syntax help
- Separates command output from regular chat messages
- Panel can be resized, collapsed, or dismissed
- Command history accessible (up/down arrows in input)

---

## Existing Stack (Build On Top Of)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Runtime | Bun |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| Database | Supabase Postgres + Drizzle ORM |
| Auth | Supabase Auth |
| AI | OpenRouter (configurable model) |
| Linting | Biome |
| Validation | Agent Browser CLI (already installed) |

**New additions needed:**
- Neo4j (Docker) for graph storage
- Graph visualization library (e.g., react-force-graph, d3-force, or vis-network)
- Command parser (server-side)
- New API endpoints for command execution
- Neo4j driver for Node.js
