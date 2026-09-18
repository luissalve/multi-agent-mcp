# Architecture — multi-agent-mcp

## The one idea

Agents are **callers**. Capabilities are **tools behind an MCP boundary**. The orchestrator only decides **who runs when**. Keeping these three concerns separate is what lets the same tools serve a local pipeline today and a remote MCP client later (the HTTP transport is planned, not implemented).

```
User task
   │
   ▼
Orchestrator (control flow only)
   │  1. classify(client, task)          → { route, rationale }
   │  2. research(client, mcp, task)     → only for research_heavy: web_lookup, then save_note
   │     (other routes: the orchestrator saves one fixed note via save_note)
   │  3. write(client, mcp, task)        → list_notes, then the final answer
   ▼
Final answer
```

## Components

| File | Responsibility | Holds domain logic? |
|---|---|---|
| `src/orchestrator.ts` | Sequences the three agents; passes state between them. | No |
| `src/agents/router.ts` | Classifies the task via Claude; `parseRouterReply` turns the free-text reply into a route and rationale. | Decision only |
| `src/agents/research.ts` | Gathers material by calling MCP tools (`web_lookup`, `save_note`). | Yes |
| `src/agents/writer.ts` | Reads saved notes, composes the final grounded answer. | Yes |
| `src/mcp-server.ts` | Defines and serves the tools, with one note store per server instance. The single tool boundary. | Tools only |
| `src/lib/tool-schemas.ts` | Zod schemas for the tool arguments (trimmed, non-empty, length-capped). | Validation only |
| `src/lib/pure.ts` | Pure helpers (route parsing, entry-point check, redaction, MCP text) — no I/O, unit-tested. | Pure |

## Why the MCP boundary (not direct function calls)

A naive multi-agent app imports tool functions directly:

```ts
import { webLookup } from "./tools";   // tight coupling, no boundary
```

Here, the research agent instead calls tools **through an MCP client session**:

```ts
const result = await mcp.callTool({ name: "web_lookup", arguments: { query } });
```

The payoff:

1. **Portability** — mount `mcp-server.ts` in any stdio MCP client, such as Claude Desktop, and the same tools work unchanged. Remote clients need the planned HTTP transport.
2. **One governance point** — argument validation lives at the tool boundary today; auth, rate limits and logging would go there too (planned), not scattered across agents.
3. **Model-agnostic agents** — an agent is just something that decides which tool to call; swap the model or the transport freely.

## Transports: stdio (here) vs. HTTP + OAuth 2.1 (production)

- **This repo uses stdio** — the orchestrator spawns the MCP server as a child process and talks to it over stdio, for a self-contained demo.
- **The production path is HTTP + OAuth 2.1** — the same `McpServer` served over a streamable HTTP transport behind an OAuth 2.1 authorization server, so remote MCP clients can connect with scoped tokens. That path is intentionally *not* implemented here (it needs real secrets and an auth server); the tool definitions are identical either way — only the transport and an auth middleware change.

## Control flow is linear on purpose

A DAG/graph runtime (parallel research fan-out, conditional writer passes) is a natural v2. v1 keeps a readable linear pipeline so the MCP pattern is the thing on display, not the scheduler.

## Extending it

- Add a tool: register it once in `src/mcp-server.ts`; any agent (and any external MCP client) can now use it.
- Add an agent: add a file under `src/agents/`, give it a single responsibility, and let the orchestrator sequence it.
- Make research real: replace the `web_lookup` stub with a search API call; nothing else changes.
