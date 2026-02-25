import type { Hono } from "hono";
import type { WsBridge } from "../ws-bridge.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
/** Fast, cheap model for inline completions. */
const COMPLETION_MODEL = "claude-haiku-4-5-20251001";
const MAX_HISTORY_MESSAGES = 20;

const SYSTEM_PROMPT =
  "You are an input completion assistant for an AI coding assistant interface. " +
  "Predict what the user wants to type next. " +
  "Return ONLY the completion text — no explanations, no quotes, no preamble. " +
  "If you cannot make a useful prediction, return an empty string.";

function extractAssistantText(message: { content: unknown }): string {
  const blocks = message.content;
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b): b is { type: string; text: string } =>
      typeof b === "object" && b !== null && (b as { type: string }).type === "text",
    )
    .map((b) => b.text)
    .join("")
    .trim();
}

export function registerCompleteRoutes(api: Hono, deps: { wsBridge: WsBridge }): void {
  // POST /api/sessions/:id/complete
  // Body: { partial: string }
  // Returns: { suggestion: string | null }
  api.post("/sessions/:id/complete", async (c) => {
    const sessionId = c.req.param("id");
    const body = await c.req.json<{ partial?: string }>().catch(() => ({ partial: "" }));
    const partial = body.partial ?? "";

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return c.json({ suggestion: null });

    const session = deps.wsBridge.resolveSession(sessionId);
    if (!session) return c.json({ suggestion: null });

    // Build a conversation snapshot for context (user + assistant turns only)
    const history = session.messageHistory
      .filter((m) => m.type === "user_message" || m.type === "assistant")
      .slice(-MAX_HISTORY_MESSAGES);

    // Require at least one prior exchange so suggestions are meaningful
    if (history.length < 2 && !partial) return c.json({ suggestion: null });

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const msg of history) {
      if (msg.type === "user_message") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.type === "assistant" && msg.message) {
        const text = extractAssistantText(msg.message as { content: unknown });
        if (text) messages.push({ role: "assistant", content: text });
      }
    }

    const taskContent = partial
      ? `The user has started typing: "${partial}"\nComplete what they are typing. Return ONLY the continuation (nothing already typed). Max 150 chars.`
      : `Based on the conversation, suggest a concise follow-up message the user might want to send. Max 150 chars.`;

    messages.push({ role: "user", content: taskContent });

    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: COMPLETION_MODEL,
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages,
        }),
      });

      if (!res.ok) return c.json({ suggestion: null });

      const data = await res.json() as { content?: Array<{ type: string; text: string }> };
      const raw = data.content?.find((b) => b.type === "text")?.text.trim() ?? "";
      return c.json({ suggestion: raw || null });
    } catch {
      return c.json({ suggestion: null });
    }
  });
}
