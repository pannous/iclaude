import { DEFAULT_ANTHROPIC_MODEL, getSettings } from "./settings-manager.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
const OPENROUTER_MODEL = "anthropic/claude-haiku-4-5";
const TITLE_PROMPT = "Generate a concise 3-5 word session title for this user request. Output only the title.";

export type ProviderKeyStatus = "ok" | "error" | "unknown";
export interface KeyHealthEntry { status: ProviderKeyStatus; error?: string; at: number }
type ProviderId = "anthropic" | "openai" | "openrouter";

const keyHealth: Record<ProviderId, KeyHealthEntry | null> = {
  anthropic: null,
  openai: null,
  openrouter: null,
};

export function recordKeyHealth(provider: ProviderId, status: ProviderKeyStatus, error?: string) {
  keyHealth[provider] = { status, error, at: Date.now() };
}

/** Clear health entry for a provider (e.g. when the key is changed) */
export function clearKeyHealth(provider: ProviderId) {
  keyHealth[provider] = null;
}

/** Get current health status for all providers */
export function getKeyHealth(): Record<ProviderId, KeyHealthEntry | null> {
  return { ...keyHealth };
}

function sanitizeTitle(raw: string): string | null {
  const title = raw.replace(/^"|"$/g, "").replace(/^'|'$/g, "").trim();
  if (!title || title.length >= 100) return null;
  return title;
}

/**
 * Local fallback: abbreviate the first user message into a short title.
 * No AI needed — just take first few meaningful words.
 */
function abbreviateMessage(message: string): string {
  // Strip system tags, markdown fences, URLs
  const cleaned = message
    .replace(/<[^>]+>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  const title = words.slice(0, 6).join(" ");
  if (title.length > 60) return title.slice(0, 57) + "...";
  if (words.length > 6) return title + "...";
  return title || "New session";
}

function buildPrompt(firstUserMessage: string): string {
  const truncated = firstUserMessage.slice(0, 500);
  return `${TITLE_PROMPT}\n\nRequest: ${truncated}`;
}

async function generateViaAnthropic(
  apiKey: string,
  model: string,
  prompt: string,
  signal: AbortSignal,
): Promise<string | null> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
    signal,
  });

  if (!res.ok) {
    console.warn(`[auto-namer] Anthropic request failed: ${res.status} ${res.statusText}`);
    recordKeyHealth("anthropic", "error", `${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json() as {
    content?: Array<{ type: string; text?: string }>;
  };
  const raw = data.content?.[0]?.type === "text" ? (data.content[0].text ?? "") : "";
  const title = sanitizeTitle(raw);
  if (title) recordKeyHealth("anthropic", "ok");
  return title;
}

async function generateViaOpenAI(
  apiKey: string,
  prompt: string,
  signal: AbortSignal,
): Promise<string | null> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
    signal,
  });

  if (!res.ok) {
    console.warn(`[auto-namer] OpenAI request failed: ${res.status} ${res.statusText}`);
    recordKeyHealth("openai", "error", `${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const title = sanitizeTitle(raw);
  if (title) recordKeyHealth("openai", "ok");
  return title;
}

async function generateViaOpenRouter(
  apiKey: string,
  prompt: string,
  signal: AbortSignal,
): Promise<string | null> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
    signal,
  });

  if (!res.ok) {
    console.warn(`[auto-namer] OpenRouter request failed: ${res.status} ${res.statusText}`);
    recordKeyHealth("openrouter", "error", `${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const title = sanitizeTitle(raw);
  if (title) recordKeyHealth("openrouter", "ok");
  return title;
}

type GeneratorFn = (signal: AbortSignal) => Promise<string | null>;

/**
 * Generates a short session title using the preferred AI provider, falling back to others.
 * Returns null if no provider is configured or all attempts fail.
 */
export async function generateSessionTitle(
  firstUserMessage: string,
  options?: {
    timeoutMs?: number;
  },
): Promise<string | null> {
  const timeout = options?.timeoutMs || 15_000;
  const settings = getSettings();
  const anthropicKey = settings.anthropicApiKey.trim();
  const openaiKey = settings.openaiApiKey.trim();
  const openrouterKey = settings.openrouterApiKey.trim();

  if (!anthropicKey && !openaiKey && !openrouterKey) {
    return abbreviateMessage(firstUserMessage);
  }

  const prompt = buildPrompt(firstUserMessage);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  // Build ordered list: preferred provider first, then fallbacks
  const generators: GeneratorFn[] = [];
  const addAnthropic = () => {
    if (anthropicKey) {
      const model = settings.anthropicModel?.trim() || DEFAULT_ANTHROPIC_MODEL;
      generators.push((sig) => generateViaAnthropic(anthropicKey, model, prompt, sig));
    }
  };
  const addOpenAI = () => {
    if (openaiKey) generators.push((sig) => generateViaOpenAI(openaiKey, prompt, sig));
  };
  const addOpenRouter = () => {
    if (openrouterKey) generators.push((sig) => generateViaOpenRouter(openrouterKey, prompt, sig));
  };

  // Preferred provider first
  const preferred = settings.aiProvider;
  if (preferred === "anthropic") { addAnthropic(); addOpenRouter(); addOpenAI(); }
  else if (preferred === "openai") { addOpenAI(); addAnthropic(); addOpenRouter(); }
  else { addOpenRouter(); addAnthropic(); addOpenAI(); }

  try {
    for (const gen of generators) {
      const title = await gen(controller.signal);
      if (title) return title;
    }
    // All AI providers failed — use local abbreviation as fallback
    console.log("[auto-namer] All AI providers failed, using local abbreviation");
    return abbreviateMessage(firstUserMessage);
  } catch (err) {
    console.warn("[auto-namer] Failed to generate session title:", err);
    return abbreviateMessage(firstUserMessage);
  } finally {
    clearTimeout(timer);
  }
}
