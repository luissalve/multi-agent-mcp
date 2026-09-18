/**
 * Pure, side-effect-free helpers. No I/O, no SDK calls — trivially unit-testable.
 * The orchestrator and agents depend on these so the interesting logic stays testable.
 */

export type Route = "research_heavy" | "direct" | "creative";
export const ROUTES: readonly Route[] = ["research_heavy", "direct", "creative"];

/**
 * Map a router agent's free-text label (which may be noisy model output like
 * "Route: research_heavy - needs facts") to a valid Route, defaulting safely to "direct".
 */
export function pickRoute(label: string): Route {
  const norm = label.toLowerCase().replace(/[^a-z_]/g, "");
  if (norm.includes("research")) return "research_heavy";
  if (norm.includes("creative")) return "creative";
  if (norm.includes("direct")) return "direct";
  return "direct";
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
