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

  it("extracts text and tool_use from contentBlocks", () => {
    const m = msg({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "text", text: "first" },
        { type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } },
        { type: "text", text: "second" },
      ],
    });
    expect(messageToText(m)).toBe("first\n\n[Terminal] $ ls\n\nsecond");
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

  it("formats Bash tool_use with description and command", () => {
    const m = msg({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "tool_use", id: "t1", name: "Bash", input: { command: "bun run test", description: "Run tests" } },
      ],
    });
    expect(messageToText(m)).toBe("[Terminal] Run tests\n$ bun run test");
  });

  it("formats file tool_use blocks", () => {
    const m = msg({
      role: "assistant",
      content: "",
      contentBlocks: [
        { type: "tool_use", id: "t1", name: "Read", input: { file_path: "/src/app.ts" } },
      ],
    });
    expect(messageToText(m)).toBe("[Read File] /src/app.ts");
  });

  it("falls back to content when tool_use blocks have no extractable info", () => {
    const m = msg({
      role: "assistant",
      content: "fallback",
      contentBlocks: [{ type: "tool_use", id: "t1", name: "Unknown", input: {} }],
    });
    // tool_use produces "[Unknown]", so content blocks win over fallback
    expect(messageToText(m)).toBe("[Unknown]");
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

  it("includes tool_use blocks in conversation output", () => {
    const msgs = [
      msg({ id: "1", role: "assistant", content: "", contentBlocks: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "git status" } }] }),
      msg({ id: "2", role: "user", content: "hi" }),
    ];
    const result = conversationToText(msgs);
    expect(result).toContain("[Terminal] $ git status");
    expect(result).toContain("User:\nhi");
  });
});
