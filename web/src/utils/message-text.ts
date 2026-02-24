import type { ChatMessage, ContentBlock } from "../types.js";

/** Format a tool_use block as readable text */
function toolUseToText(block: Extract<ContentBlock, { type: "tool_use" }>): string {
  const { name, input } = block;
  if (name === "Bash" && typeof input.command === "string") {
    const desc = typeof input.description === "string" ? input.description : "";
    return desc
      ? `[Terminal] ${desc}\n$ ${input.command}`
      : `[Terminal] $ ${input.command}`;
  }
  if ((name === "Read" || name === "Write" || name === "Edit") && input.file_path) {
    const label = name === "Read" ? "Read File" : name === "Write" ? "Write File" : "Edit File";
    return `[${label}] ${input.file_path}`;
  }
  if (name === "Glob" && input.pattern) return `[Find Files] ${input.pattern}`;
  if (name === "Grep" && input.pattern) return `[Search] ${input.pattern}`;
  if ((name === "WebSearch" || name === "web_search") && input.query) return `[Web Search] ${input.query}`;
  if (name === "WebFetch" && input.url) return `[Web Fetch] ${input.url}`;
  if (name === "Task" && input.description) return `[Subagent] ${input.description}`;
  return `[${name}]`;
}

/** Extract the plain text content from a single message (text + tool_use + thinking blocks) */
export function messageToText(msg: ChatMessage): string {
  if (msg.content && (!msg.contentBlocks || msg.contentBlocks.length === 0)) {
    return msg.content;
  }

  const parts: string[] = [];
  for (const block of msg.contentBlocks || []) {
    if (block.type === "text") parts.push(block.text);
    else if (block.type === "thinking") parts.push(block.thinking);
    else if (block.type === "tool_use") parts.push(toolUseToText(block));
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
