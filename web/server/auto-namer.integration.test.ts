/**
 * Integration test for auto-namer using real API endpoints.
 * Requires a valid OpenAI API key in ~/.companion/settings.json (openaiApiKey field)
 * or ANTHROPIC_API_KEY / OPENAI_API_KEY env vars.
 *
 * Skipped in CI — runs only when a real key is available.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function loadKey(field: string): string {
  try {
    const raw = readFileSync(join(homedir(), ".companion", "settings.json"), "utf-8");
    const settings = JSON.parse(raw) as Record<string, unknown>;
    return typeof settings[field] === "string" ? (settings[field] as string).trim() : "";
  } catch {
    return "";
  }
}

const openaiKey = loadKey("openaiApiKey") || process.env.OPENAI_API_KEY || "";
const anthropicKey = loadKey("anthropicApiKey") || process.env.ANTHROPIC_API_KEY || "";

// Skip the entire suite if no keys are available
const hasAnyKey = !!(openaiKey || anthropicKey);

describe.skipIf(!hasAnyKey)("auto-namer integration (real API calls)", () => {
  // Validates that the auto-namer produces real titles from live APIs,
  // not just mock responses. This catches auth issues, model changes,
  // and response format drift that mocks can't detect.

  if (openaiKey) {
    it("generates a title via OpenAI API", async () => {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 256,
          messages: [
            {
              role: "user",
              content:
                "Generate a concise 3-5 word session title for this user request. Output only the title.\n\nRequest: Fix the authentication bug in the login page",
            },
          ],
          temperature: 0.2,
        }),
      });

      expect(res.ok).toBe(true);
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const title = data.choices?.[0]?.message?.content?.trim() ?? "";
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThan(100);
      console.log(`[integration] OpenAI generated title: "${title}"`);
    }, 15_000);
  }

  if (anthropicKey) {
    it("generates a title via Anthropic API", async () => {
      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          messages: [
            {
              role: "user",
              content:
                "Generate a concise 3-5 word session title for this user request. Output only the title.\n\nRequest: Refactor the database connection pooling",
            },
          ],
          temperature: 0.2,
        }),
      });

      expect(res.ok).toBe(true);
      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const title =
        data.content?.[0]?.type === "text"
          ? (data.content[0].text ?? "").replace(/^"|"$/g, "").trim()
          : "";
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThan(100);
      console.log(`[integration] Anthropic generated title: "${title}"`);
    }, 15_000);
  }

  if (openaiKey) {
    it("generates title through the full generateSessionTitle function via OpenAI", async () => {
      // This test exercises the actual generateSessionTitle function end-to-end
      // with real settings, bypassing mocks entirely.
      const { _resetForTest, updateSettings } = await import("./settings-manager.js");
      const { generateSessionTitle } = await import("./auto-namer.js");

      // Use a temp settings path to avoid clobbering real settings
      const tmpPath = join(
        process.env.TMPDIR || "/tmp",
        `auto-namer-integration-${Date.now()}.json`,
      );
      _resetForTest(tmpPath);
      updateSettings({ anthropicApiKey: "", openaiApiKey: openaiKey });

      try {
        const title = await generateSessionTitle(
          "Help me set up a CI/CD pipeline for my Node.js app",
          { timeoutMs: 15_000 },
        );

        expect(title).not.toBeNull();
        expect(typeof title).toBe("string");
        expect(title!.length).toBeGreaterThan(0);
        expect(title!.length).toBeLessThan(100);
        console.log(`[integration] Full function generated title: "${title}"`);
      } finally {
        // Clean up temp settings
        _resetForTest();
        try {
          const { unlinkSync } = await import("node:fs");
          unlinkSync(tmpPath);
        } catch { /* ignore */ }
      }
    }, 20_000);
  }
});
