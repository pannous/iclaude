import { createContext } from "react";

/** Provides sessionId to nested feed components (for lazy tool result fetching) */
export const FeedSessionIdContext = createContext<string>("");
