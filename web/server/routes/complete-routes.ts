import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Hono } from "hono";
import type { WsBridge } from "../ws-bridge.js";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
/** Fast, cheap model for inline completions. */
const COMPLETION_MODEL = "gpt-4o-mini";
const MAX_HISTORY_MESSAGES = 20;

const SYSTEM_PROMPT =
  "You are an input completion assistant for an AI coding assistant interface. " +
  "Predict what the user wants to type next. " +
  "Return ONLY the completion text — no explanations, no quotes, no preamble. " +
  "If you cannot make a useful prediction, return an empty string.";

/** Read OPENAI_API_KEY from env, falling back to ~/.keys export lines. */
function resolveOpenAiKey(): string | null {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const keysFile = join(homedir(), ".keys");
  if (!existsSync(keysFile)) return null;
  try {
    const content = readFileSync(keysFile, "utf-8");
    const match = content.match(/^export OPENAI_API_KEY="([^"]+)"/m);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

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

    const apiKey = resolveOpenAiKey();
    if (!apiKey) return c.json({ suggestion: null });

    const session = deps.wsBridge.resolveSession(sessionId);
    if (!session) return c.json({ suggestion: null });

    // Build a conversation snapshot for context (user + assistant turns only)
    const history = session.messageHistory
      .filter((m) => m.type === "user_message" || m.type === "assistant")
      .slice(-MAX_HISTORY_MESSAGES);

    // Require at least one prior exchange so suggestions are meaningful
    if (history.length < 2 && !partial) return c.json({ suggestion: null });

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

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
      const res = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: COMPLETION_MODEL,
          max_tokens: 200,
          messages,
        }),
      });

      if (!res.ok) return c.json({ suggestion: null });

      const data = await res.json() as { choices?: Array<{ message: { content: string } }> };
      const raw = data.choices?.[0]?.message.content.trim() ?? "";
      return c.json({ suggestion: raw || null });
    } catch {
      return c.json({ suggestion: null });
    }
  });
}
