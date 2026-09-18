# Architecture — multi-agent-mcp

## The one idea

Agents are **callers**. Capabilities are **tools behind an MCP boundary**. The orchestrator only decides **who runs when**. Keeping these three concerns separate is what lets the same tools serve a local pipeline today and a remote Claude/ChatGPT client tomorrow.

```
User task
   │
   ▼
Orchestrator (control flow only)
   │  1. router.classify(task)        → { route, rationale }
   │  2. research.run(task, route)     → calls MCP tools, saves notes
   │  3. writer.compose(task, notes)   → final answer
   ▼
Final answer
```

## Components

| File | Responsibility | Holds domain logic? |
|---|---|---|
| `src/orchestrator.ts` | Sequences the three agents; passes state between them. | No |
| `src/agents/router.ts` | Classifies the task into a route via Claude, returns structured JSON. | Decision only |
| `src/agents/research.ts` | Gathers material by calling MCP tools (`web_lookup`, `save_note`). | Yes |
| `src/agents/writer.ts` | Reads saved notes, composes the final grounded answer. | Yes |
| `src/mcp-server.ts` | Defines and serves the tools. The single tool boundary. | Tools only |
| `src/lib/pure.ts` | Pure helpers (route selection, redaction) — no I/O, unit-tested. | Pure |

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

1. **Portability** — mount `mcp-server.ts` in Claude Desktop or ChatGPT and the same tools work, unchanged.
2. **One governance point** — auth, rate limits, logging, and versioning live at the tool boundary, not scattered across agents.
3. **Model-agnostic agents** — an agent is just something that decides which tool to call; swap the model or the transport freely.

## Transports: stdio (here) vs. HTTP + OAuth 2.1 (production)

- **This repo uses stdio** — the orchestrator spawns/connects to the MCP server in-process for a self-contained demo.
- **The production path is HTTP + OAuth 2.1** — the same `McpServer` served over a streamable HTTP transport behind an OAuth 2.1 authorization server, so remote clients (claude.ai, ChatGPT) can connect with scoped tokens. That path is intentionally *not* implemented here (it needs real secrets and an auth server); the tool definitions are identical either way — only the transport and an auth middleware change.

## Control flow is linear on purpose

A DAG/graph runtime (parallel research fan-out, conditional writer passes) is a natural v2. v1 keeps a readable linear pipeline so the MCP pattern is the thing on display, not the scheduler.

## Extending it

- Add a tool: register it once in `src/mcp-server.ts`; any agent (and any external MCP client) can now use it.
- Add an agent: add a file under `src/agents/`, give it a single responsibility, and let the orchestrator sequence it.
- Make research real: replace the `web_lookup` stub with a search API call; nothing else changes.
