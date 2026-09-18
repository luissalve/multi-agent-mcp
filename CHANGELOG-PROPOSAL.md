# Changelog proposal

The next five commits for this v1 scaffold, in order. Commits 1 and 2 are implemented in this revision. Commits 3 to 5 are proposals: nothing described under them exists in the code yet.

Size key: S is under about 100 changed lines, M is about 100 to 300, L is more.

Every acceptance check below runs offline, with no API key and no network.

---

## 1. `test(router,mcp): cover route selection and validate MCP tool arguments` (implemented)

**Files:** `src/lib/pure.ts`, `src/agents/router.ts`, `src/lib/tool-schemas.ts` (new), `src/mcp-server.ts`, `tests/router.test.ts` (new), `tests/mcp-server.test.ts` (new).

**What changes:**

- Reply parsing moves out of `classify()` into the pure function `parseRouterReply()`.
- A bug found by the new tests is fixed. `pickRoute` used a fixed priority (research, then creative, then direct) over the whole reply. A reply such as "direct — not a creative task", with an em dash instead of a hyphen, was therefore routed to `creative`. It now picks the route keyword that appears first, and the separator accepts a hyphen, en dash or em dash next to whitespace.
- The tool arguments get zod schemas that trim input, reject empty strings and cap length: 1,000 characters for `query` and 8,000 for `note`.
- The note store moves inside `buildServer()`, so each server instance has its own. The orchestrator runs one server process per request, so its behaviour is unchanged. Tests get isolation.
- `classify()` is tested with a fake Anthropic client. Validation is tested against the real `McpServer` over the SDK's in-memory transport.

**Acceptance check:**

```bash
npx vitest run tests/router.test.ts tests/mcp-server.test.ts --maxWorkers=4 --minWorkers=1
npm run typecheck
```

**Size:** M.

---

## 2. `fix(mcp): start the server when run directly on Windows` (implemented)

**Files:** `src/lib/pure.ts` (`isDirectRun`), `src/mcp-server.ts`, `tests/direct-run.test.ts` (new).

**What changes:** the entry check compared `import.meta.url` with `"file://" + process.argv[1]`. That never matches a Windows path, or any path with characters that are percent-encoded in a URL, such as spaces. On Windows, `npm run mcp` exited without starting the server, and `npm run demo` could not connect to it. The check now compares against `pathToFileURL(process.argv[1]).href`.

**Acceptance check:**

```bash
npx vitest run tests/direct-run.test.ts --maxWorkers=4 --minWorkers=1
npm run mcp   # prints "multi-agent-mcp server up on stdio" on stderr, on Windows too
```

**Size:** S.

---

## 3. `fix(agents): fail loudly when an MCP tool call returns isError` (proposal)

**Why:** the MCP SDK reports invalid arguments as a tool result with `isError` set, not as an exception. `research.ts`, `writer.ts` and `orchestrator.ts` read only the text, so a rejected call is passed on as if it were content.

**Files:** `src/lib/pure.ts` (a helper such as `toolTextOrThrow(result, toolName)`), `src/agents/research.ts`, `src/agents/writer.ts`, `src/orchestrator.ts`, `tests/agents.test.ts` (new).

**What changes:** every `callTool` result goes through the helper, which throws an error naming the tool when `isError` is set.

**Acceptance check:** a test runs `research()` with a fake Anthropic client whose distilled note exceeds the note limit, against an in-memory server, and expects the promise to reject with an error that names `save_note`.

```bash
npx vitest run tests/agents.test.ts --maxWorkers=4 --minWorkers=1
```

**Size:** S.

---

## 4. `feat(research): let Claude choose MCP tools in a bounded tool-use loop` (proposal)

**Why:** today the research agent runs a fixed sequence (plan, `web_lookup`, distill, `save_note`). The TODO in `src/agents/research.ts` asks for a loop where Claude decides which tools to call.

**Files:** `src/agents/research.ts`, `src/lib/pure.ts` (mapping from MCP tool definitions to Anthropic tool definitions), `tests/research.test.ts` (new).

**What changes:** the agent lists tools with `mcp.listTools()`, passes them as `tools` to `messages.create`, runs each `tool_use` block through `mcp.callTool`, and sends back `tool_result` blocks. It stops on `end_turn` or after a fixed maximum number of turns.

**Acceptance check:** a scripted fake client asks for `web_lookup`, then `save_note`, then ends. The test asserts that both calls reached the in-memory server in that order, and that a fake which never ends is stopped at the turn cap.

```bash
npx vitest run tests/research.test.ts --maxWorkers=4 --minWorkers=1
```

**Size:** M.

---

## 5. `feat(mcp): serve the tools over Streamable HTTP when MCP_TRANSPORT is http` (proposal)

**Why:** `.env.example` lists MCP_TRANSPORT, but no code reads it.

**Files:** `src/lib/transport.ts` (new, picks the transport from the environment), `src/mcp-server.ts`, `src/orchestrator.ts`, `tests/transport.test.ts` (new), `README.md`.

**What changes:** stdio stays the default. With `http`, the same `buildServer()` is served through the SDK's Streamable HTTP server transport on a localhost port. Authentication is not part of this commit, so HTTP mode binds to the loopback interface only. OAuth 2.1 for remote clients remains planned.

**Acceptance check:** a test starts the server on an ephemeral localhost port, connects with the SDK's Streamable HTTP client transport and lists three tools. An unknown MCP_TRANSPORT value fails at startup with a clear error.

```bash
npx vitest run tests/transport.test.ts --maxWorkers=4 --minWorkers=1
```

**Size:** M to L.
