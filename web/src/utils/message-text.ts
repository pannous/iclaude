import type { ChatMessage, ContentBlock } from "../types.js";

/** Extract the plain text content from a single message (text + thinking blocks) */
export function messageToText(msg: ChatMessage): string {
  if (msg.content && (!msg.contentBlocks || msg.contentBlocks.length === 0)) {
    return msg.content;
  }

  const parts: string[] = [];
  for (const block of msg.contentBlocks || []) {
    if (block.type === "text") parts.push(block.text);
    else if (block.type === "thinking") parts.push(block.thinking);
  }
  return parts.join("\n\n") || msg.content;
}

/** Format a full conversation as copyable text */
export function conversationToText(messages: ChatMessage[]): string {
  return messages
    .filter(m => m.role !== "system" && !m.parentToolUseId)
    .map(m => {
      const label = m.role === "user" ? "User" : "Assistant";
      const text = messageToText(m);
      return text ? `${label}:\n${text}` : null;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}
