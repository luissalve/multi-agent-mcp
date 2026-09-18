import type Anthropic from "@anthropic-ai/sdk";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { mcpText } from "../lib/pure.js";

const MODEL = process.env.MODEL ?? "claude-sonnet-5";

/** Read the notes saved to the MCP server, then compose the grounded final answer. */
export async function write(client: Anthropic, mcp: Client, task: string): Promise<string> {
  const notesResult = await mcp.callTool({ name: "list_notes", arguments: {} });
  const notes = mcpText(notesResult);

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system:
      "You are the writer. Compose a clear, well-structured answer to the task, grounded ONLY in the provided research notes. " +
      "If the notes are thin or stubbed, state what is uncertain rather than inventing facts.",
    messages: [{ role: "user", content: `Task: ${task}\n\nResearch notes:\n${notes || "(none)"}` }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
}
