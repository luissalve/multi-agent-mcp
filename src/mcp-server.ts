/**
 * The custom MCP server — the single tool boundary.
 *
 * Agents call these tools across the MCP protocol; they never import tool code
 * directly. Over stdio it can also be mounted in any stdio MCP client (for example
 * Claude Desktop). Remote clients need an HTTP transport behind OAuth 2.1, which is
 * planned and not implemented here (see ARCHITECTURE.md).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { isDirectRun } from "./lib/pure.js";
import { listNotesArgs, saveNoteArgs, webLookupArgs } from "./lib/tool-schemas.js";

export function buildServer(): McpServer {
  const server = new McpServer({ name: "multi-agent-mcp", version: "0.1.0" });

  // In-memory note store, one per server instance (demo only — a production server
  // would persist notes per session/tenant behind auth).
  const notes: string[] = [];

  // Arguments are validated by the SDK against the zod schemas before each handler
  // runs; invalid calls come back to the client as an isError tool result.
  server.tool(
    "web_lookup",
    "Look up factual context for a query. v1 is STUBBED — swap in a real search API (Tavily/Brave/SerpAPI).",
    webLookupArgs,
    async ({ query }) => {
      // TODO: replace with a real search API call.
      const stub = `STUBBED RESULT for "${query}" — wire a search API here to return real snippets.`;
      return { content: [{ type: "text", text: stub }] };
    },
  );

  server.tool(
    "save_note",
    "Persist a research note that the writer agent can read later.",
    saveNoteArgs,
    async ({ note }) => {
      notes.push(note);
      return { content: [{ type: "text", text: `saved note #${notes.length}` }] };
    },
  );

  server.tool(
    "list_notes",
    "Return every research note saved so far, so the writer can compose a grounded answer.",
    listNotesArgs,
    async () => ({
      content: [{ type: "text", text: notes.length ? notes.join("\n---\n") : "(no notes yet)" }],
    }),
  );

  return server;
}

// Run standalone over stdio when invoked directly (`npm run mcp`, or spawned by the orchestrator).
if (isDirectRun(import.meta.url, process.argv[1])) {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr, so it doesn't corrupt the stdio JSON-RPC stream on stdout.
  console.error("multi-agent-mcp server up on stdio (tools: web_lookup, save_note, list_notes)");
}
