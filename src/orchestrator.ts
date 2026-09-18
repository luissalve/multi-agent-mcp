/**
 * Orchestrator — control flow only. It sequences router -> research -> writer,
 * and connects them to the custom MCP server. It holds no domain logic.
 *
 * Run: npm run demo -- "your task here"
 */
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { classify } from "./agents/router.js";
import { research } from "./agents/research.js";
import { write } from "./agents/writer.js";

async function main(): Promise<void> {
  const task = process.argv.slice(2).join(" ").trim();
  if (!task) {
    console.error('Usage: npm run demo -- "your task here"');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY in .env (copy from .env.example).");
    process.exit(1);
  }

  const client = new Anthropic();

  // Connect to the custom MCP server over stdio (spawns src/mcp-server.ts).
  const transport = new StdioClientTransport({ command: "tsx", args: ["src/mcp-server.ts"] });
  const mcp = new Client({ name: "orchestrator", version: "0.1.0" });
  await mcp.connect(transport);

  try {
    console.log(`\n▸ task: ${task}\n`);

    const { route, rationale } = await classify(client, task);
    console.log(`▸ router → ${route}  (${rationale})`);

    if (route === "research_heavy") {
      await research(client, mcp, task);
      console.log("▸ research → material gathered and saved via MCP tools");
    } else {
      await mcp.callTool({
        name: "save_note",
        arguments: { note: `(${route}) answered from general knowledge; no external lookup needed.` },
      });
    }

    const answer = await write(client, mcp, task);
    console.log(`\n=== ANSWER ===\n${answer}\n`);
  } finally {
    await mcp.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
