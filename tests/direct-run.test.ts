import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { isDirectRun } from "../src/lib/pure.js";

describe("isDirectRun", () => {
  // A path with a space and a tilde: both are percent-encoded in a file URL.
  const script = join(tmpdir(), "dir with space~", "mcp-server.ts");
  const moduleUrl = pathToFileURL(script).href;

  it("recognises the entry script on this platform, including encoded characters", () => {
    expect(isDirectRun(moduleUrl, script)).toBe(true);
    // The previous check, `file://` + argv[1], never matches such a path
    // (and never matches any Windows path, which uses drive letters and backslashes).
    expect(moduleUrl === `file://${script}`).toBe(false);
  });

  it("is false when the module is imported by another entry point", () => {
    expect(isDirectRun(moduleUrl, join(tmpdir(), "vitest.mjs"))).toBe(false);
  });

  it("is false when there is no script argument", () => {
    expect(isDirectRun(moduleUrl, undefined)).toBe(false);
    expect(isDirectRun(moduleUrl, "")).toBe(false);
  });
});
