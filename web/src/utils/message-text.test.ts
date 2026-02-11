import { describe, it, expect } from "vitest";
import { messageToText, conversationToText } from "./message-text.js";
import type { ChatMessage } from "../types.js";

function msg(overrides: Partial<ChatMessage> & Pick<ChatMessage, "role">): ChatMessage {
  return { id: "1", content: "", timestamp: Date.now(), ...overrides };
}

describe("messageToText", () => {
  it("returns content for plain messages", () => {
    expect(messageToText(msg({ role: "user", content: "hello" }))).toBe("hello");
  });

  it("extracts text from contentBlocks", () => {
    const m = msg({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "text", text: "first" },
        { type: "tool_use", id: "t1", name: "Bash", input: {} },
        { type: "text", text: "second" },
      ],
    });
    expect(messageToText(m)).toBe("first\n\nsecond");
  });

  it("includes thinking blocks", () => {
    const m = msg({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "thinking", thinking: "hmm" },
        { type: "text", text: "answer" },
      ],
    });
    expect(messageToText(m)).toBe("hmm\n\nanswer");
  });

  it("falls back to content when contentBlocks has no text", () => {
    const m = msg({
      role: "assistant",
      content: "fallback",
      contentBlocks: [{ type: "tool_use", id: "t1", name: "Bash", input: {} }],
    });
    expect(messageToText(m)).toBe("fallback");
  });
});

describe("conversationToText", () => {
  it("formats user and assistant messages with labels", () => {
    const msgs = [
      msg({ id: "1", role: "user", content: "hi" }),
      msg({ id: "2", role: "assistant", content: "hello" }),
    ];
    const result = conversationToText(msgs);
    expect(result).toContain("User:\nhi");
    expect(result).toContain("Assistant:\nhello");
    expect(result).toContain("---");
  });

  it("skips system messages and subagent children", () => {
    const msgs = [
      msg({ id: "1", role: "system", content: "sys" }),
      msg({ id: "2", role: "user", content: "question" }),
      msg({ id: "3", role: "assistant", content: "sub-answer", parentToolUseId: "task1" }),
      msg({ id: "4", role: "assistant", content: "answer" }),
    ];
    const result = conversationToText(msgs);
    expect(result).not.toContain("sys");
    expect(result).not.toContain("sub-answer");
    expect(result).toContain("question");
    expect(result).toContain("answer");
  });

  it("skips messages with empty text", () => {
    const msgs = [
      msg({ id: "1", role: "assistant", content: "", contentBlocks: [{ type: "tool_use", id: "t1", name: "Bash", input: {} }] }),
      msg({ id: "2", role: "user", content: "hi" }),
    ];
    const result = conversationToText(msgs);
    expect(result).toBe("User:\nhi");
  });
});
