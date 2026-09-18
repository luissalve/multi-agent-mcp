/**
 * Pure, side-effect-free helpers. No I/O, no SDK calls — trivially unit-testable.
 * The orchestrator and agents depend on these so the interesting logic stays testable.
 */
import { pathToFileURL } from "node:url";

export type Route = "research_heavy" | "direct" | "creative";
export const ROUTES: readonly Route[] = ["research_heavy", "direct", "creative"];

const ROUTE_KEYWORDS: ReadonlyArray<readonly [keyword: string, route: Route]> = [
  ["research", "research_heavy"],
  ["creative", "creative"],
  ["direct", "direct"],
];

/**
 * Map a router agent's free-text label (which may be noisy model output like
 * "Route: research_heavy - needs facts") to a valid Route, defaulting safely to "direct".
 * The router is told to lead with the route word, so the keyword that appears first wins.
 */
export function pickRoute(label: string): Route {
  const norm = label.toLowerCase().replace(/[^a-z_]/g, "");
  const hits = ROUTE_KEYWORDS.map(([keyword, route]) => ({ at: norm.indexOf(keyword), route }))
    .filter((hit) => hit.at >= 0)
    .sort((a, b) => a.at - b.at);
  return hits[0]?.route ?? "direct";
}

/** A hyphen, en dash or em dash with whitespace on at least one side ("word - why", "word— why"). */
const LABEL_SEPARATOR = /\s[-–—]|[-–—]\s/;

/**
 * Split a router reply ("<route word> - <rationale>") into a route and a rationale.
 * A dash inside a word ("research-heavy", "open-ended") is not treated as the separator.
 * Without a separator the whole reply is used both to pick the route and as the rationale.
 */
export function parseRouterReply(text: string): { route: Route; rationale: string } {
  const reply = text.trim();
  const sep = LABEL_SEPARATOR.exec(reply);
  const label = sep ? reply.slice(0, sep.index) : reply;
  const rationale = sep ? reply.slice(sep.index + sep[0].length).trim() : "";
  return { route: pickRoute(label), rationale: rationale || reply };
}

/**
 * True when `moduleUrl` (a module's import.meta.url) is the script Node was started with.
 * Comparing against pathToFileURL(argv[1]) works on Windows and with percent-encoded paths,
 * unlike building the URL by hand with "file://" + argv[1].
 */
export function isDirectRun(moduleUrl: string, argv1: string | undefined): boolean {
  if (!argv1) return false;
  return pathToFileURL(argv1).href === moduleUrl;
}

/** Mask obvious secrets before logging tool I/O (defense-in-depth for demos and prod). */
export function redactSecrets(text: string): string {
  return text
    .replace(/sk-ant-[A-Za-z0-9-]{6,}/g, "sk-ant-***")
    .replace(/\b[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "***@***");
}

/** Collapse an MCP tool result's content blocks into a single text string. */
export function mcpText(result: unknown): string {
  const content = (result as { content?: Array<{ type?: string; text?: string }> })?.content ?? [];
  return content.map((c) => c?.text ?? "").join("\n").trim();
}
