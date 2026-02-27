import { DEFAULT_OPENROUTER_MODEL, getSettings } from "./settings-manager.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5-20251001";

function sanitizeTitle(raw: string): string | null {
  const title = raw
    .replace(/<[^>]*>/g, "")          // strip any XML/HTML tags from AI output
    .replace(/^"|"$/g, "")
    .replace(/^'|'$/g, "")
    .trim();
  if (!title || title.length >= 100) return null;
  return title;
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const maybe = item as { text?: unknown };
          return typeof maybe.text === "string" ? maybe.text : "";
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

/**
 * Generates a short session title via OpenRouter (primary) or OpenAI (fallback).
 * Returns null if neither provider is configured or if generation fails.
 */
export async function generateSessionTitle(
  firstUserMessage: string,
  _model: string,
  options?: {
    timeoutMs?: number;
  },
): Promise<string | null> {
  const timeout = options?.timeoutMs || 15_000;
  const settings = getSettings();
  const provider = settings.aiProvider ?? "openrouter";

  // Strip system-injected XML tags before sending so they don't pollute the title.
  const cleaned = firstUserMessage.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  const truncated = cleaned.slice(0, 500);
  if (!truncated) return null;
  const userPrompt = `Generate a concise 3-5 word session title for this user request. Output only the title.\n\nRequest: ${truncated}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    if (provider === "claude") {
      const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim() || "";
      if (!anthropicKey) return null;

      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: DEFAULT_CLAUDE_MODEL,
          max_tokens: 64,
          messages: [{ role: "user", content: userPrompt }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        console.warn(`[auto-namer] Anthropic request failed: ${res.status} ${res.statusText}`);
        return null;
      }

      const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
      const raw = data.content?.find((b) => b.type === "text")?.text ?? "";
      return sanitizeTitle(raw);
    }

    // OpenRouter / OpenAI fallback path
    const openrouterKey = settings.openrouterApiKey.trim();
    const openaiKey = (settings.openaiApiKey?.trim() || process.env.OPENAI_API_KEY || "").trim();

    let endpoint: string;
    let apiKey: string;
    let model: string;
    if (openrouterKey) {
      endpoint = OPENROUTER_URL;
      apiKey = openrouterKey;
      model = settings.openrouterModel?.trim() || DEFAULT_OPENROUTER_MODEL;
    } else if (openaiKey) {
      endpoint = OPENAI_URL;
      apiKey = openaiKey;
      model = DEFAULT_OPENAI_MODEL;
    } else {
      return null;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[auto-namer] ${endpoint === OPENAI_URL ? "OpenAI" : "OpenRouter"} request failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const raw = extractTextContent(data.choices?.[0]?.message?.content);
    return sanitizeTitle(raw);
  } catch (err) {
    console.warn("[auto-namer] Failed to generate session title:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
