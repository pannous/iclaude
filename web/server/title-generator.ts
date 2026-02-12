import Anthropic from "@anthropic-ai/sdk";

/**
 * Generate a concise, descriptive title from a user message using Claude.
 */
export async function generateTitle(message: string): Promise<string> {
  const cleaned = message.replace(/\s+/g, " ").trim();

  // If message is very short, just use it as-is
  if (cleaned.length <= 40) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // Check if API key is configured before attempting to use Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No API key configured - silently fall back to simple title generation
    return fallbackTitle(cleaned);
  }

  // Use Claude to generate a smart title
  try {
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [{
        role: "user",
        content: `Generate a concise 3-7 word title for this request. Just return the title, nothing else:\n\n"${cleaned}"`
      }]
    });

    const title = response.content[0].type === "text"
      ? response.content[0].text.trim().replace(/^["']|["']$/g, "")
      : "";

    // Fallback to truncation if Claude's response is empty or too long
    if (!title || title.length > 60) {
      return fallbackTitle(cleaned);
    }

    return title;
  } catch (error) {
    console.warn("[title-generator] Failed to generate title with Claude, using fallback");
    return fallbackTitle(cleaned);
  }
}

/**
 * Fallback title generation if Claude API fails
 */
function fallbackTitle(message: string): string {
  // Simple truncation at word boundary
  const firstSentence = message.split(/[.!?]/)[0].trim();

  if (firstSentence.length <= 50) {
    return firstSentence;
  }

  const words = firstSentence.split(" ");
  let title = "";
  for (const word of words) {
    if ((title + " " + word).length > 47) {
      break;
    }
    title += (title ? " " : "") + word;
  }
  return title + "...";
}
