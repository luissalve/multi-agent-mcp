import type Anthropic from "@anthropic-ai/sdk";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { mcpText } from "../lib/pure.js";

const MODEL = process.env.MODEL ?? "claude-sonnet-5";

/**
 * Gather material for the task by calling MCP tools, then save a distilled note.
 *
 * v1 is a deliberately simple single-pass loop (plan query -> web_lookup -> distill -> save_note).
 * TODO: promote to a full multi-turn tool-use loop where Claude itself decides which
 * MCP tools to call and when, passing MCP tool schemas straight into `tools:`.
 */
export async function research(client: Anthropic, mcp: Client, task: string): Promise<void> {
  // 1. Decide what to look up.
  const plan = await client.messages.create({
    model: MODEL,
    max_tokens: 120,
    system: "Given a task, output ONE concise search query that would gather the key facts. Output only the query.",
    messages: [{ role: "user", content: task }],
  });
  const query = plan.content.map((b) => (b.type === "text" ? b.text : "")).join(" ").trim();

  // 2. Call the MCP web_lookup tool (across the protocol boundary).
  const lookup = await mcp.callTool({ name: "web_lookup", arguments: { query } });
  const found = mcpText(lookup);

  // 3. Distill into a note and persist it via the MCP save_note tool.
  const distilled = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: "Distill the raw context into 2-4 factual bullet points relevant to the task. If the context is empty/stubbed, say so plainly.",
    messages: [{ role: "user", content: `Task: ${task}\n\nRaw context:\n${found}` }],
  });
  const note = distilled.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
  await mcp.callTool({ name: "save_note", arguments: { note } });
}
