import { describe, it, expect, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { classify } from "../src/agents/router.js";
import { parseRouterReply, pickRoute } from "../src/lib/pure.js";

/** Stand-in for the Anthropic client: returns canned content blocks and never touches the network. */
function fakeClient(content: Array<Record<string, unknown>>) {
  const create = vi.fn().mockResolvedValue({ content });
  return { client: { messages: { create } } as unknown as Anthropic, create };
}

const textBlock = (text: string) => ({ type: "text", text });

describe("parseRouterReply", () => {
  it("splits the route word from the rationale at the first spaced dash", () => {
    expect(parseRouterReply("research_heavy - needs current facts")).toEqual({
      route: "research_heavy",
      rationale: "needs current facts",
    });
  });

  it("keeps hyphens that appear inside the rationale", () => {
    expect(parseRouterReply("creative - an open-ended writing task")).toEqual({
      route: "creative",
      rationale: "an open-ended writing task",
    });
  });

  it("accepts en and em dashes as the separator", () => {
    expect(parseRouterReply("research_heavy – needs prices")).toEqual({
      route: "research_heavy",
      rationale: "needs prices",
    });
    expect(parseRouterReply("direct — general knowledge")).toEqual({
      route: "direct",
      rationale: "general knowledge",
    });
  });

  it("does not split inside a hyphenated route word", () => {
    expect(parseRouterReply("research-heavy - needs facts")).toEqual({
      route: "research_heavy",
      rationale: "needs facts",
    });
  });

  it("routes by the leading keyword even when the rationale names another route", () => {
    // Regression: these used to route to "creative" / "research_heavy" because the
    // whole reply was scanned with a fixed keyword priority.
    expect(parseRouterReply("direct — not a creative task").route).toBe("direct");
    expect(parseRouterReply("direct, not a research question").route).toBe("direct");
    expect(parseRouterReply("creative: no research needed").route).toBe("creative");
  });

  it("keeps the whole reply as the rationale when there is no separator", () => {
    expect(parseRouterReply("  research_heavy  ")).toEqual({
      route: "research_heavy",
      rationale: "research_heavy",
    });
  });

  it("defaults to direct on empty or unrecognised output", () => {
    expect(parseRouterReply("")).toEqual({ route: "direct", rationale: "" });
    expect(parseRouterReply("no idea - sorry").route).toBe("direct");
  });
});

describe("pickRoute keyword order", () => {
  it("picks the keyword that appears first rather than a fixed priority", () => {
    expect(pickRoute("creative, not research")).toBe("creative");
    expect(pickRoute("direct creative research")).toBe("direct");
    expect(pickRoute("research then creative")).toBe("research_heavy");
  });
});

describe("classify (router agent)", () => {
  it("sends the task as the only user message and returns the parsed route", async () => {
    const { client, create } = fakeClient([textBlock("research_heavy - needs current prices")]);

    await expect(classify(client, "What does a GPU hour cost today?")).resolves.toEqual({
      route: "research_heavy",
      rationale: "needs current prices",
    });

    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0]?.[0];
    expect(params.messages).toEqual([{ role: "user", content: "What does a GPU hour cost today?" }]);
    expect(params.max_tokens).toBe(150);
    expect(params.system).toContain("research_heavy");
  });

  it("joins text blocks and ignores non-text blocks", async () => {
    const { client } = fakeClient([
      textBlock("direct"),
      { type: "tool_use", id: "tu_1", name: "noop", input: {} },
      textBlock("- answerable from general knowledge"),
    ]);

    await expect(classify(client, "Explain recursion")).resolves.toEqual({
      route: "direct",
      rationale: "answerable from general knowledge",
    });
  });

  it("falls back to direct when the reply carries no text", async () => {
    const { client } = fakeClient([]);
    await expect(classify(client, "anything")).resolves.toEqual({ route: "direct", rationale: "" });
  });

  it("does not misroute when an em-dash rationale mentions another route", async () => {
    const { client } = fakeClient([textBlock("direct — not a creative task")]);
    await expect(classify(client, "What is 2 + 2?")).resolves.toMatchObject({ route: "direct" });
  });

  it("propagates API failures to the caller", async () => {
    const create = vi.fn().mockRejectedValue(new Error("rate limited"));
    const client = { messages: { create } } as unknown as Anthropic;
    await expect(classify(client, "anything")).rejects.toThrow("rate limited");
  });
});
