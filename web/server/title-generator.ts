/**
 * Generate a concise, descriptive title from a user message.
 * Similar to ChatGPT/Claude.ai's auto-generated titles.
 */
export function generateTitle(message: string): string {
  // Clean up the message
  const cleaned = message
    .replace(/\s+/g, " ")
    .trim();

  // If message is short enough, use it directly
  if (cleaned.length <= 50) {
    return cleaned;
  }

  // Extract key phrases or first sentence
  const firstSentence = cleaned.split(/[.!?]/)[0].trim();

  if (firstSentence.length <= 50) {
    return firstSentence;
  }

  // Truncate intelligently at word boundary
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
