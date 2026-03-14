import type { StateCreator } from "zustand";
import type { AppState } from "./index.js";
import type { ChatMessage } from "../types.js";
import { setInMap, deleteFromMap } from "./utils.js";

export interface ChatSlice {
  messages: Map<string, ChatMessage[]>;
  streaming: Map<string, string>;
  streamingStartedAt: Map<string, number>;
  streamingOutputTokens: Map<string, number>;

  appendMessage: (sessionId: string, msg: ChatMessage) => void;
  setMessages: (sessionId: string, msgs: ChatMessage[]) => void;
  updateLastAssistantMessage: (sessionId: string, updater: (msg: ChatMessage) => ChatMessage) => void;
  setStreaming: (sessionId: string, text: string | null) => void;
  setStreamingStats: (sessionId: string, stats: { startedAt?: number; outputTokens?: number } | null) => void;
}

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (set) => ({
  messages: new Map(),
  streaming: new Map(),
  streamingStartedAt: new Map(),
  streamingOutputTokens: new Map(),

  appendMessage: (sessionId, msg) =>
    set((s) => {
      const existing = s.messages.get(sessionId) || [];
      // Deduplicate: skip if a message with same ID already exists
      if (msg.id && existing.some((m) => m.id === msg.id)) return s;
      return { messages: setInMap(s.messages, sessionId, [...existing, msg]) };
    }),

  setMessages: (sessionId, msgs) =>
    set((s) => ({ messages: setInMap(s.messages, sessionId, msgs) })),

  updateLastAssistantMessage: (sessionId, updater) =>
    set((s) => {
      const list = [...(s.messages.get(sessionId) || [])];
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].role === "assistant") { list[i] = updater(list[i]); break; }
      }
      return { messages: setInMap(s.messages, sessionId, list) };
    }),

  setStreaming: (sessionId, text) =>
    set((s) => ({
      streaming: text === null ? deleteFromMap(s.streaming, sessionId) : setInMap(s.streaming, sessionId, text),
    })),

  setStreamingStats: (sessionId, stats) =>
    set((s) => {
      if (stats === null) {
        return {
          streamingStartedAt: deleteFromMap(s.streamingStartedAt, sessionId),
          streamingOutputTokens: deleteFromMap(s.streamingOutputTokens, sessionId),
        };
      }
      return {
        streamingStartedAt: stats.startedAt !== undefined ? setInMap(s.streamingStartedAt, sessionId, stats.startedAt) : s.streamingStartedAt,
        streamingOutputTokens: stats.outputTokens !== undefined ? setInMap(s.streamingOutputTokens, sessionId, stats.outputTokens) : s.streamingOutputTokens,
      };
    }),
});
