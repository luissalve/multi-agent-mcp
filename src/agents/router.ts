import type Anthropic from "@anthropic-ai/sdk";
import { parseRouterReply, type Route } from "../lib/pure.js";

const MODEL = process.env.MODEL ?? "claude-sonnet-5";

/** Classify the task into exactly one route. A decision only — no side effects. */
export async function classify(
  client: Anthropic,
  task: string,
): Promise<{ route: Route; rationale: string }> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 150,
    system:
      "You are a routing agent. Classify the task into exactly one route: " +
      "research_heavy (needs external/current facts), direct (answerable from general knowledge), " +
      "or creative (open-ended writing). Reply with the route word, a dash, then a one-line rationale.",
    messages: [{ role: "user", content: task }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join(" ");
  return parseRouterReply(text);
}
