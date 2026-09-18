import { describe, it, expect } from "vitest";
import { pickRoute, redactSecrets, mcpText, ROUTES } from "../src/lib/pure.js";

describe("pickRoute", () => {
  it("maps clean labels to routes", () => {
    expect(pickRoute("research_heavy")).toBe("research_heavy");
    expect(pickRoute("Creative")).toBe("creative");
    expect(pickRoute("  DIRECT ")).toBe("direct");
  });

  it("matches on substrings from noisy model output", () => {
    expect(pickRoute("Route: research_heavy - needs current facts")).toBe("research_heavy");
    expect(pickRoute("this is a creative task")).toBe("creative");
  });

  it("defaults to direct on unknown or empty labels", () => {
    expect(pickRoute("???")).toBe("direct");
    expect(pickRoute("")).toBe("direct");
  });

  it("only ever returns a valid route", () => {
    for (const label of ["x", "research", "creative", "direct", "", "12345", "RESEARCH_HEAVY!!"]) {
      expect(ROUTES).toContain(pickRoute(label));
    }
  });
});

describe("redactSecrets", () => {
  it("masks anthropic keys and emails", () => {
    expect(redactSecrets("key sk-ant-abc123def456 here")).toContain("sk-ant-***");
    expect(redactSecrets("mail me at a.person@example.com please")).toContain("***@***");
  });

  it("leaves clean text untouched", () => {
    expect(redactSecrets("hello world, no secrets here")).toBe("hello world, no secrets here");
  });
});

describe("mcpText", () => {
  it("flattens content blocks to text", () => {
    expect(mcpText({ content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] })).toBe("a\nb");
  });

  it("is safe on malformed results", () => {
    expect(mcpText(undefined)).toBe("");
    expect(mcpText({})).toBe("");
  });
});
