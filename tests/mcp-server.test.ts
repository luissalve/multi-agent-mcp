import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { buildServer } from "../src/mcp-server.js";
import { mcpText } from "../src/lib/pure.js";
import {
  MAX_NOTE_CHARS,
  MAX_QUERY_CHARS,
  saveNoteArgs,
  webLookupArgs,
} from "../src/lib/tool-schemas.js";

/** Connect an MCP client to a fresh server instance, entirely in-process (no stdio, no network). */
async function connectClient(): Promise<Client> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await buildServer().connect(serverSide);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientSide);
  return client;
}

describe("tool argument schemas", () => {
  const lookup = z.object(webLookupArgs);
  const note = z.object(saveNoteArgs);

  it("trims and accepts ordinary input", () => {
    expect(lookup.parse({ query: "  mcp transports  " })).toEqual({ query: "mcp transports" });
    expect(note.parse({ note: "- a fact\n" })).toEqual({ note: "- a fact" });
  });

  it("rejects missing, empty, whitespace-only and non-string values", () => {
    for (const bad of [{}, { query: "" }, { query: "   " }, { query: 42 }, { query: null }]) {
      expect(lookup.safeParse(bad).success).toBe(false);
    }
    for (const bad of [{}, { note: "" }, { note: "\n\t" }, { note: ["a"] }]) {
      expect(note.safeParse(bad).success).toBe(false);
    }
  });

  it("enforces the upper bounds exactly", () => {
    expect(lookup.safeParse({ query: "q".repeat(MAX_QUERY_CHARS) }).success).toBe(true);
    expect(lookup.safeParse({ query: "q".repeat(MAX_QUERY_CHARS + 1) }).success).toBe(false);
    expect(note.safeParse({ note: "n".repeat(MAX_NOTE_CHARS) }).success).toBe(true);
    expect(note.safeParse({ note: "n".repeat(MAX_NOTE_CHARS + 1) }).success).toBe(false);
  });
});

describe("MCP server over an in-memory transport", () => {
  let client: Client;

  beforeEach(async () => {
    client = await connectClient();
  });

  afterEach(async () => {
    await client.close();
  });

  async function expectInvalidArgs(name: string, args: Record<string, unknown>): Promise<void> {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError).toBe(true);
    expect(mcpText(result)).toContain(`Invalid arguments for tool ${name}`);
  }

  it("advertises the three tools with their bounds in the input schema", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["list_notes", "save_note", "web_lookup"]);

    const lookup = tools.find((t) => t.name === "web_lookup");
    expect(lookup?.inputSchema.required).toEqual(["query"]);
    expect(lookup?.inputSchema.properties?.query).toMatchObject({
      type: "string",
      minLength: 1,
      maxLength: MAX_QUERY_CHARS,
    });
  });

  it("answers a valid web_lookup with the stubbed result for the trimmed query", async () => {
    const result = await client.callTool({ name: "web_lookup", arguments: { query: "  mcp  " } });
    expect(result.isError).toBeFalsy();
    expect(mcpText(result)).toContain('STUBBED RESULT for "mcp"');
  });

  it.each([
    ["missing query", {}],
    ["empty query", { query: "" }],
    ["whitespace-only query", { query: "   " }],
    ["non-string query", { query: 42 }],
    ["oversized query", { query: "q".repeat(MAX_QUERY_CHARS + 1) }],
  ])("rejects web_lookup with %s", async (_label, args) => {
    await expectInvalidArgs("web_lookup", args);
  });

  it("rejects invalid notes and does not store them", async () => {
    await expectInvalidArgs("save_note", { note: 123 });
    await expectInvalidArgs("save_note", { note: "n".repeat(MAX_NOTE_CHARS + 1) });

    const listed = await client.callTool({ name: "list_notes", arguments: {} });
    expect(mcpText(listed)).toBe("(no notes yet)");
  });

  it("stores trimmed notes and lists them in insertion order", async () => {
    const first = await client.callTool({ name: "save_note", arguments: { note: " first fact " } });
    expect(mcpText(first)).toBe("saved note #1");
    await client.callTool({ name: "save_note", arguments: { note: "second fact" } });

    const listed = await client.callTool({ name: "list_notes", arguments: {} });
    expect(mcpText(listed)).toBe("first fact\n---\nsecond fact");
  });

  it("keeps a separate note store per server instance", async () => {
    await client.callTool({ name: "save_note", arguments: { note: "only on the first server" } });

    const other = await connectClient();
    try {
      const listed = await other.callTool({ name: "list_notes", arguments: {} });
      expect(mcpText(listed)).toBe("(no notes yet)");
    } finally {
      await other.close();
    }
  });
});
