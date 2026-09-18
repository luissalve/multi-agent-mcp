/**
 * The custom MCP server — the single tool boundary.
 *
 * Agents call these tools across the MCP protocol; they never import tool code
 * directly. The exact same server can be mounted in Claude Desktop or ChatGPT.
 * Here it runs over stdio for a self-contained demo; the production path is the
 * same McpServer served over HTTP behind OAuth 2.1 (see ARCHITECTURE.md).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// In-memory note store, shared for the lifetime of this process (demo only —
// a production server would persist notes per session/tenant behind auth).
const notes: string[] = [];

export function buildServer(): McpServer {
  const server = new McpServer({ name: "multi-agent-mcp", version: "0.1.0" });

  server.tool(
    "web_lookup",
    "Look up factual context for a query. v1 is STUBBED — swap in a real search API (Tavily/Brave/SerpAPI).",
    { query: z.string().describe("what to look up") },
    async ({ query }) => {
      // TODO: replace with a real search API call.
      const stub = `STUBBED RESULT for "${query}" — wire a search API here to return real snippets.`;
      return { content: [{ type: "text", text: stub }] };
    },
  );

  server.tool(
    "save_note",
    "Persist a research note that the writer agent can read later.",
    { note: z.string().describe("a distilled factual note") },
    async ({ note }) => {
      notes.push(note);
      return { content: [{ type: "text", text: `saved note #${notes.length}` }] };
    },
  );

  server.tool(
    "list_notes",
    "Return every research note saved so far, so the writer can compose a grounded answer.",
    {},
    async () => ({
      content: [{ type: "text", text: notes.length ? notes.join("\n---\n") : "(no notes yet)" }],
    }),
  );

  return server;
}

// Run standalone over stdio when invoked directly (`npm run mcp`).
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr, so it doesn't corrupt the stdio JSON-RPC stream on stdout.
  console.error("multi-agent-mcp server up on stdio (tools: web_lookup, save_note, list_notes)");
}
