/**
 * Argument schemas for the MCP tools, kept apart from the server so they can be
 * unit-tested directly. The SDK validates every tools/call against these before a
 * handler runs, and publishes them to clients as JSON Schema via tools/list.
 */
import { z } from "zod";

/**
 * Upper bounds sit well above what the agents can emit: the research agent plans its
 * query with max_tokens 120 and distills its note with max_tokens 400. They exist to
 * stop an arbitrary MCP client from pushing unbounded payloads into the server.
 */
export const MAX_QUERY_CHARS = 1_000;
export const MAX_NOTE_CHARS = 8_000;

export const webLookupArgs = {
  query: z
    .string()
    .trim()
    .min(1, "query must not be empty")
    .max(MAX_QUERY_CHARS, `query must be at most ${MAX_QUERY_CHARS} characters`)
    .describe("what to look up"),
};

export const saveNoteArgs = {
  note: z
    .string()
    .trim()
    .min(1, "note must not be empty")
    .max(MAX_NOTE_CHARS, `note must be at most ${MAX_NOTE_CHARS} characters`)
    .describe("a distilled factual note"),
};

/** list_notes takes no arguments. */
export const listNotesArgs = {};
