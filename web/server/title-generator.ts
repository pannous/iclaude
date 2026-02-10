/**
 * Generate a concise, descriptive title from a user message.
 * Creates a summary rather than just truncating.
 */
export function generateTitle(message: string): string {
  // Clean up the message
  const cleaned = message
    .replace(/\s+/g, " ")
    .trim();

  // Remove common question starters to get to the core request
  let summarized = cleaned
    .replace(/^(can you|could you|please|would you|will you|hey|hi|hello)\s+/i, "")
    .replace(/^(help me|i need|i want|i would like)\s+(to\s+)?/i, "")
    .trim();

  // Capitalize first letter
  summarized = summarized.charAt(0).toUpperCase() + summarized.slice(1);

  // If it's short enough now, use it
  if (summarized.length <= 50) {
    return summarized;
  }

  // Extract main action and object from common patterns
  const patterns = [
    // "create a X" -> "Create X"
    { regex: /^(create|make|build|write|add|implement|fix|debug|update|modify|change|delete|remove)\s+(?:a|an|the|some)?\s*(.+)/i, format: (_: string, action: string, object: string) => `${capitalize(action)} ${object}` },
    // "how to X" -> "How to X"
    { regex: /^how (?:do i|can i|to)\s+(.+)/i, format: (_: string, rest: string) => `How to ${rest}` },
    // "what is X" -> "What is X"
    { regex: /^what (?:is|are)\s+(.+)/i, format: (_: string, rest: string) => `What is ${rest}` },
    // "why does X" -> "Why X"
    { regex: /^why (?:does|do|is|are)\s+(.+)/i, format: (_: string, rest: string) => `Why ${rest}` },
  ];

  for (const { regex, format } of patterns) {
    const match = summarized.match(regex);
    if (match) {
      summarized = format(...match as [string, ...string[]]);
      break;
    }
  }

  // If still too long, intelligently truncate
  if (summarized.length > 50) {
    // Get first sentence or clause
    const firstPart = summarized.split(/[.!?,;]/)[0].trim();

    if (firstPart.length <= 50) {
      return firstPart;
    }

    // Truncate at word boundary
    const words = firstPart.split(" ");
    let title = "";
    for (const word of words) {
      if ((title + " " + word).length > 47) {
        break;
      }
      title += (title ? " " : "") + word;
    }
    return title + "...";
  }

  return summarized;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
